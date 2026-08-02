import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Check, Loader2, Send, Settings2, Square, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Concept } from "./data";

/* ---------------- config ---------------- */
export interface GuideCfg {
  provider: "local" | "anthropic" | "claude-app" | "chatgpt-app";
  baseUrl: string;
  model: string;
  apiKey: string;
}
const CFG_KEY = "mcpquest.guide";
const DEFAULTS: GuideCfg = { provider: "claude-app", baseUrl: "http://localhost:1234/v1", model: "", apiKey: "" };

export function loadCfg(): GuideCfg {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
export function isConfigured(c: GuideCfg) {
  if (c.provider === "claude-app" || c.provider === "chatgpt-app") return true;
  return c.provider === "local" ? !!c.baseUrl : !!c.apiKey;
}
export const isHandoff = (c: GuideCfg) => c.provider === "claude-app" || c.provider === "chatgpt-app";

/* ---------------- streaming ---------------- */
async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const l of lines) if (l.startsWith("data:")) yield l.slice(5).trim();
  }
}

export interface ChatMsg { role: "user" | "assistant"; content: string }

export async function* streamChat(cfg: GuideCfg, system: string, history: ChatMsg[], signal: AbortSignal): AsyncGenerator<string> {
  if (cfg.provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: cfg.model || "claude-sonnet-5",
        max_tokens: 1024, system, stream: true,
        messages: history,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    for await (const d of sseLines(res)) {
      if (!d || d === "[DONE]") continue;
      try {
        const j = JSON.parse(d);
        if (j.type === "content_block_delta" && j.delta?.text) yield j.delta.text;
        if (j.type === "error") throw new Error(j.error?.message || "stream error");
      } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
    }
  } else {
    const res = await fetch(cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST", signal,
      headers: {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model || "local-model",
        stream: true, temperature: 0.4, max_tokens: 1024,
        messages: [{ role: "system", content: system }, ...history],
      }),
    });
    if (!res.ok) throw new Error(`LLM endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
    for await (const d of sseLines(res)) {
      if (!d || d === "[DONE]") continue;
      try {
        const t = JSON.parse(d).choices?.[0]?.delta?.content;
        if (t) yield t;
      } catch { continue; }
    }
  }
}

/* ---------------- settings form ---------------- */
function SettingsForm({ onSaved }: { onSaved?: (c: GuideCfg) => void }) {
  const [cfg, setCfg] = useState<GuideCfg>(loadCfg);
  const [test, setTest] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");
  const set = (p: Partial<GuideCfg>) => { setCfg(c => ({ ...c, ...p })); setTest("idle"); };

  const save = () => { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); onSaved?.(cfg); };

  const testConn = async () => {
    setTest("busy"); setTestMsg("");
    try {
      if (cfg.provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
          headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        });
        if (!r.ok) throw new Error(`${r.status}`);
      } else {
        const r = await fetch(cfg.baseUrl.replace(/\/+$/, "") + "/models", {
          headers: cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {},
        });
        if (!r.ok) throw new Error(`${r.status}`);
        const j = await r.json().catch(() => null);
        const first = j?.data?.[0]?.id;
        if (first && !cfg.model) set({ model: first });
        setTestMsg(first ? `found model: ${first}` : "");
      }
      setTest("ok");
    } catch (e: any) {
      setTest("fail");
      setTestMsg(e?.message === "Failed to fetch"
        ? "Unreachable — is the server running with CORS enabled?"
        : String(e?.message || e));
    }
  };

  const inputCls = "w-full rounded-lg border bg-background px-3 py-1.5 text-[13px] outline-none focus:border-[hsl(var(--primary))]";
  return (
    <div className="space-y-3.5">
      <div>
        <div className="kicker mb-1.5">Provider</div>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border">
          {([["claude-app", "My Claude app"], ["chatgpt-app", "My ChatGPT app"], ["local", "Local LLM"], ["anthropic", "Anthropic API"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => set({ provider: id })}
              className={"border-collapse px-3 py-1.5 text-xs font-semibold transition-colors " + (cfg.provider === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {isHandoff(cfg) ? (
        <p className="text-[12px] text-muted-foreground">
          No setup needed. Questions open a new chat in {cfg.provider === "claude-app" ? "claude.ai" : "chatgpt.com"} with
          the concept's study notes preloaded — you chat there on your existing subscription. The prompt is also
          copied to your clipboard as a fallback.
        </p>
      ) : cfg.provider === "local" ? (
        <>
          <div>
            <div className="kicker mb-1.5">Base URL</div>
            <input className={inputCls} value={cfg.baseUrl} onChange={e => set({ baseUrl: e.target.value })} placeholder="http://localhost:1234/v1" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              LM Studio: <code>http://localhost:1234/v1</code> (enable CORS in server settings) · Ollama: <code>http://localhost:11434/v1</code> (start with <code>OLLAMA_ORIGINS=*</code>)
            </p>
          </div>
          <div>
            <div className="kicker mb-1.5">Model <span className="normal-case tracking-normal">(optional — test fills it in)</span></div>
            <input className={inputCls} value={cfg.model} onChange={e => set({ model: e.target.value })} placeholder="auto-detect via Test" />
          </div>
          <div>
            <div className="kicker mb-1.5">API key <span className="normal-case tracking-normal">(only if your endpoint needs one)</span></div>
            <input className={inputCls} type="password" value={cfg.apiKey} onChange={e => set({ apiKey: e.target.value })} placeholder="usually empty for local" />
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="kicker mb-1.5">API key</div>
            <input className={inputCls} type="password" value={cfg.apiKey} onChange={e => set({ apiKey: e.target.value })} placeholder="sk-ant-…" />
          </div>
          <div>
            <div className="kicker mb-1.5">Model</div>
            <input className={inputCls} value={cfg.model} onChange={e => set({ model: e.target.value })} placeholder="claude-sonnet-5" />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!isHandoff(cfg) && <Button size="sm" variant="outline" onClick={testConn} disabled={test === "busy"}>
          {test === "busy" ? <Loader2 size={13} className="mr-1 animate-spin" /> : test === "ok" ? <Check size={13} className="mr-1 text-[hsl(var(--good-text))]" /> : null}
          Test connection
        </Button>}
        <Button size="sm" onClick={save}>Save</Button>
        {test === "ok" && <span className="text-[11.5px] text-[hsl(var(--good-text))]">Connected{testMsg ? ` — ${testMsg}` : ""}</span>}
        {test === "fail" && <span className="text-[11.5px] text-[hsl(var(--bad))]">{testMsg}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Settings & key are stored only in this browser's localStorage — nothing leaves your machine except your own requests to the endpoint above.
      </p>
    </div>
  );
}

/* ---------------- header button + modal ---------------- */
export function GuideButton() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(() => isConfigured(loadCfg()));
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("guide-settings" as any, h);
    return () => window.removeEventListener("guide-settings" as any, h);
  }, []);
  return (
    <>
      <Button variant="outline" size="sm" className="h-8 px-2.5 text-[10px] font-bold tracking-widest" onClick={() => setOpen(true)} aria-label="AI guide settings">
        <Bot size={12} className="mr-1" /> GUIDE
        <span className={"ml-1.5 inline-block h-1.5 w-1.5 rounded-full " + (ready ? "bg-[hsl(var(--good))]" : "bg-[hsl(var(--border))]")} />
      </Button>
      {open && createPortal(
        <div className="anim-static-in fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-5" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }} role="dialog" aria-modal="true" aria-label="AI guide settings">
          <div className="anim-chan crt-panel w-full max-w-md rounded-2xl border bg-card p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[hsl(var(--concept)/.12)]"><Settings2 size={16} className="text-[hsl(var(--concept))]" /></span>
              <div>
                <h3 className="text-xl tracking-tight">AI Guide</h3>
                <p className="text-[12px] text-muted-foreground">Plug in a local LLM (recommended) or an API key, then ask questions inside any deep dive.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground"><XIcon size={15} /></button>
            </div>
            <SettingsForm onSaved={c => { setReady(isConfigured(c)); setOpen(false); }} />
          </div>
        </div>, document.body)}
    </>
  );
}

/* ---------------- ask-the-guide (inside deep dives) ---------------- */
const QUICK = [
  "Explain this like I'm new to Kubernetes",
  "Interview me on this topic — one question at a time",
  "Give me a production scenario to solve",
  "What do interviewers probe here?",
];

function conceptContext(e: Concept) {
  return [
    `CONCEPT: ${e.t} — ${e.s}`,
    `ESSENTIALS:\n- ${e.facts.join("\n- ")}`,
    e.more ? `DEEP DETAIL:\n- ${e.more.join("\n- ")}` : "",
    e.trap ? `COMMON INTERVIEW TRAP: ${e.trap}` : "",
    e.wire ? `EXAMPLE:\n${e.wire}` : "",
  ].filter(Boolean).join("\n\n");
}

export function AskGuide({ e }: { e: Concept }) {
  const [cfg, setCfg] = useState<GuideCfg>(loadCfg);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { const h = () => setCfg(loadCfg()); window.addEventListener("focus", h); return () => window.removeEventListener("focus", h); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);

  const handoff = (question: string) => {
    if (!question.trim()) return;
    const prompt =
      "You are a precise, friendly coach for Kubernetes, OpenShift, and SRE practice, helping me prepare for DevOps/SRE interviews. " +
      "Answer directly, no preamble about me. Ground your answers in these notes; if they don't cover something, say so rather than guessing.\n\n" +
      conceptContext(e) +
      "\n\nMy question: " + question;
    try { navigator.clipboard?.writeText(prompt); } catch { /* clipboard is best-effort */ }
    const url = cfg.provider === "claude-app"
      ? "https://claude.ai/new?q=" + encodeURIComponent(prompt)
      : "https://chatgpt.com/?q=" + encodeURIComponent(prompt);
    window.open(url, "_blank", "noopener");
    setQ("");
  };

  const ask = async (question: string) => {
    if (isHandoff(cfg)) { handoff(question); return; }
    if (!question.trim() || busy) return;
    setQ("");
    setBusy(true); setErr("");
    const history: ChatMsg[] = [...msgs, { role: "user", content: question }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const system =
      "You are a precise, friendly coach for Kubernetes, OpenShift, and SRE practice, helping someone prepare for DevOps/SRE interviews. " +
      "Answer the question directly — never open with a preamble about the user, their background, or their experience level. " +
      "An infrastructure or distributed-systems analogy is welcome occasionally when it genuinely clarifies, but only after the direct answer, and never introduced with phrases like 'since you're from an SRE background'. " +
      "This is an ongoing conversation: build on your earlier answers when the user follows up. " +
      "Ground every answer in the notes below; if the notes don't cover something, say so rather than guessing. Be concise.\n\n" +
      conceptContext(e);
    try {
      for await (const chunk of streamChat(cfg, system, history, ctrl.signal)) {
        setMsgs(m => {
          const n = [...m];
          n[n.length - 1] = { role: "assistant", content: n[n.length - 1].content + chunk };
          return n;
        });
      }
    } catch (ex: any) {
      if (ex?.name !== "AbortError") setErr(String(ex?.message || ex));
    } finally {
      setBusy(false); abortRef.current = null;
    }
  };
  const stop = () => abortRef.current?.abort();
  const clear = () => { stop(); setMsgs([]); setErr(""); };

  if (!isConfigured(cfg)) {
    return (
      <div className="mt-5 border-t pt-4">
        <div className="kicker mb-2">Ask the guide</div>
        <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
          <Bot size={15} className="flex-none text-[hsl(var(--concept))]" />
          <span>Connect a local LLM or API key to ask questions about this concept.</span>
          <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new Event("guide-settings"))}>Set up</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex items-center gap-2">
        <div className="kicker">Ask the guide</div>
        {msgs.length > 0 && (
          <button onClick={clear} className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            clear conversation
          </button>
        )}
      </div>
      {msgs.length === 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK.map(p => (
            <button key={p} disabled={busy} onClick={() => ask(p)}
              className="rounded-full border px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-[hsl(var(--primary)/.6)] hover:text-foreground disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>
      )}
      {msgs.length > 0 && (
        <div className="mt-3 flex max-h-80 flex-col gap-2.5 overflow-y-auto pr-1">
          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} className="self-end max-w-[85%] rounded-lg border border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.07)] px-3 py-2 text-[13px]">
              {m.content}
            </div>
          ) : (
            <div key={i} className="max-w-[95%] rounded-lg border border-[hsl(var(--concept)/.4)] bg-[hsl(var(--concept)/.05)] px-3.5 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[hsl(var(--concept))]">
                <Bot size={12} /> Guide {busy && i === msgs.length - 1 && <Loader2 size={11} className="animate-spin" />}
              </div>
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{m.content || "…"}</div>
            </div>
          ))}
          {err && <p className="text-[12.5px] text-[hsl(var(--bad))]">{err}</p>}
          <div ref={endRef} />
        </div>
      )}
      <form className="mt-2.5 flex gap-2" onSubmit={ev => { ev.preventDefault(); ask(q); }}>
        <input value={q} onChange={ev => setQ(ev.target.value)} disabled={busy}
          placeholder={isHandoff(cfg) ? `Opens in ${cfg.provider === "claude-app" ? "Claude" : "ChatGPT"} with the study notes attached…` : msgs.length ? "Reply or ask a follow-up…" : `Ask anything about ${e.t}…`}
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-[13px] outline-none focus:border-[hsl(var(--primary))]" />
        {busy
          ? <Button type="button" size="sm" variant="outline" onClick={stop}><Square size={12} className="mr-1" /> Stop</Button>
          : <Button type="submit" size="sm" disabled={!q.trim()}><Send size={12} className="mr-1" /> {isHandoff(cfg) ? "Open chat" : msgs.length ? "Reply" : "Ask"}</Button>}
      </form>
      {isHandoff(cfg) && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Uses your existing {cfg.provider === "claude-app" ? "Claude" : "ChatGPT"} subscription — the conversation continues there. Prompt is also copied to your clipboard.
        </p>
      )}
    </div>
  );
}
