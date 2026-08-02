import { useMemo, useRef, useState } from "react";
import {
  Home, Plug, Terminal, Cloud, Users, Layers, Cable, Wrench, FileText,
  MessageSquare, Hand, Satellite, Repeat, RadioTower, Check, Trophy,
  Copy, Moon, Sun, ChevronLeft, ChevronRight, RotateCcw, ArrowLeft,
  Compass, Swords, Lightbulb, Target, X as XIcon, Flame,
} from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { EXPLORE, FLOWS, BUILDS, RANKS, XP_MAX, type Concept, type Level } from "./data";
import { QUEST_LEVELS as LEVELS, POOLS, sample, bossDraw, BANK_SIZE } from "./questions";
import { GuideButton, AskGuide } from "./guide";
import { Shield, KeyRound, AlertTriangle, Puzzle, GitBranch, Globe, Gauge, Braces, Activity, Box } from "lucide-react";

/* ---------------- shared bits ---------------- */
const ICONS: Record<string, any> = {
  home: Home, plug: Plug, terminal: Terminal, cloud: Cloud, users: Users,
  layers: Layers, cable: Cable, wrench: Wrench, filetext: FileText,
  message: MessageSquare, hand: Hand, satellite: Satellite, repeat: Repeat, radio: RadioTower,
  shield: Shield, key: KeyRound, alert: AlertTriangle, puzzle: Puzzle, branch: GitBranch, globe: Globe,
  gauge: Gauge, braces: Braces, activity: Activity, box: Box,
};
const CAT_BAR: Record<string, string> = {
  host: "bg-[hsl(var(--host))]", client: "bg-[hsl(var(--client))]",
  server: "bg-[hsl(var(--server))]", concept: "bg-[hsl(var(--concept))]",
};
const CAT_TEXT: Record<string, string> = {
  host: "text-[hsl(var(--host))]", client: "text-[hsl(var(--client))]",
  server: "text-[hsl(var(--server))]", concept: "text-[hsl(var(--concept))]",
};
const CAT_SOFT: Record<string, string> = {
  host: "bg-[hsl(var(--host)/.10)]", client: "bg-[hsl(var(--client)/.12)]",
  server: "bg-[hsl(var(--server)/.10)]", concept: "bg-[hsl(var(--concept)/.10)]",
};
const WHO_TEXT: Record<string, string> = { c: "text-[hsl(var(--client))]", s: "text-[hsl(var(--server))]", u: "text-[hsl(var(--concept))]" };

function MethodChip({ m }: { m: string }) {
  return <code className="max-w-[32%] truncate rounded-md border bg-secondary px-1.5 py-0.5 text-[11px] text-foreground/80" title={m}>{m}</code>;
}

/* ---------------- app state ---------------- */
interface AppState {
  mode: "learn" | "exam"; xp: number; visited: Set<string>;
  best: Record<string, number>; badges: Set<string>; streak: number;
}

const STATE_KEY = "mcpquest.state";
const THEME_KEY = "mcpquest.theme";
const FRESH: AppState = { mode: "learn", xp: 0, visited: new Set(), best: {}, badges: new Set(), streak: 0 };
function loadState(): AppState {
  try {
    const j = JSON.parse(localStorage.getItem(STATE_KEY) || "");
    return { mode: j.mode ?? "learn", xp: j.xp ?? 0, visited: new Set(j.visited ?? []), best: j.best ?? {}, badges: new Set(j.badges ?? []), streak: j.streak ?? 0 };
  } catch { return { ...FRESH, visited: new Set(), badges: new Set() }; }
}

export default function App() {
  const [st, setSt] = useState<AppState>(loadState);
  const [tab, setTab] = useState<"explore" | "quest">("explore");
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === "crt");
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem(THEME_KEY, dark ? "crt" : "paper"); }, [dark]);
  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...st, visited: [...st.visited], badges: [...st.badges] }));
  }, [st]);
  useEffect(() => { if (st.xp > 0) showToast(`Progress restored — ${st.xp} XP`); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const resetAll = () => { localStorage.removeItem(STATE_KEY); setSt({ ...FRESH, visited: new Set(), badges: new Set() }); showToast("Progress reset"); };
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const rank = useMemo(() => { let r = RANKS[0][1]; for (const [t, n] of RANKS) if (st.xp >= t) r = n; return r; }, [st.xp]);

  const showToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  };
  const addXP = (n: number, msg?: string) => {
    setSt(s => ({ ...s, xp: s.xp + n }));
    if (msg) showToast(`+${n} XP · ${msg}`);
  };

  const visit = (k: string) => {
    if (st.visited.has(k)) return;
    const e = EXPLORE[k];
    setSt(s => {
      const visited = new Set(s.visited); visited.add(k);
      const badges = new Set(s.badges);
      let xp = s.xp + 5;
      if (visited.size >= Object.keys(EXPLORE).length && !badges.has("explorer")) { badges.add("explorer"); xp += 20; }
      return { ...s, visited, badges, xp };
    });
    showToast(`+5 XP · explored: ${e.t}`);
  };

  const openDeep = (k: string) => { visit(k); setOpenKey(k); };
  const toggleDark = () => setDark(d => !d);

  return (
    <div className="anim-power-on min-h-screen">
      {/* header */}
      <header className="status-strip sticky top-0 z-40 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.12)] font-display text-lg text-[hsl(var(--primary))]" style={{ boxShadow: "0 0 12px hsl(var(--glow)/.4)" }}>
              &gt;_
            </div>
            <div className="leading-tight">
              <div className="cursor-blink font-display text-xl uppercase tracking-wide text-[hsl(var(--primary))]">DevOps Interview Quest</div>
              <div className="text-[11px] text-muted-foreground">DEVOPS · SRE · K8S · OPENSHIFT</div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border">
              {(["learn", "exam"] as const).map(m => (
                <button key={m}
                  className={"px-3.5 py-1.5 text-xs font-semibold transition-colors " + (st.mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => { setSt(s => ({ ...s, mode: m })); showToast(m === "learn" ? "Learn mode — hints on" : "Interview mode — trap notes on"); }}>
                  {m === "learn" ? "Learn" : "Interview"}
                </button>
              ))}
            </div>
            <GuideButton />
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-[10px] font-bold tracking-widest" onClick={toggleDark} aria-label="Toggle paper / CRT theme">
              {dark ? <><Sun size={12} className="mr-1" /> PAPER</> : <><Moon size={12} className="mr-1" /> CRT</>}
            </Button>
            <div className="flex items-center gap-2.5">
              <span className="border border-[hsl(var(--concept)/.5)] bg-[hsl(var(--concept)/.1)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--concept))]">[{rank}]</span>
              <div className="xp-track h-2.5 w-28 overflow-hidden">
                <div className="xp-fill h-full" style={{ width: Math.min(100, (100 * st.xp) / XP_MAX) + "%" }} />
              </div>
              <span className="tabnum w-14 text-xs text-muted-foreground">{st.xp} XP</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16 pt-6">
        {/* tabs */}
        <div className="mb-6 flex gap-1 border-b">
          {([["explore", "Explore the architecture", Compass], ["quest", "Quest levels", Swords]] as const).map(([id, label, Ic]) => (
            <button key={id} onClick={() => setTab(id)}
              className={"relative flex items-center gap-2 px-4 pb-2.5 pt-1 text-sm font-semibold transition-colors " + (tab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Ic size={15} /> {label}
              {tab === id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded bg-[hsl(var(--host))]" />}
            </button>
          ))}
        </div>

        {tab === "explore"
          ? <Explore st={st} openDeep={openDeep} />
          : <Quest st={st} setSt={setSt} addXP={addXP} showToast={showToast} rank={rank} onReset={resetAll} />}
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-8 text-xs text-muted-foreground">
        Community study aid for DevOps / SRE interview preparation — Kubernetes, OpenShift, and SRE practice.
        Verify details against the official <a className="text-[hsl(var(--host))] hover:underline" href="https://kubernetes.io/docs/" target="_blank" rel="noreferrer">Kubernetes docs</a> and <a className="text-[hsl(var(--host))] hover:underline" href="https://docs.redhat.com/en/documentation/openshift_container_platform" target="_blank" rel="noreferrer">OpenShift docs</a>. 🎓
      </footer>

      {/* deep-dive dialog */}
      <DeepDive k={openKey} mode={st.mode} onClose={() => setOpenKey(null)} />

      {/* toast */}
      {toast && (
        <div className="anim-pop fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-foreground px-5 py-2 text-[13px] font-semibold text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------- explore ---------------- */
function Explore({ st, openDeep }: { st: AppState; openDeep: (k: string) => void }) {
  return (
    <section className="anim-rise">
      <div className="crt-panel mb-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="kicker mb-1.5">The map</div>
        <h2 className="text-2xl tracking-tight">Interview-ready, one concept at a time</h2>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
          Kubernetes core, networking &amp; storage, troubleshooting method, OpenShift deltas, and SRE practice —
          the topics DevOps/SRE interviews actually probe. Learn the cards, then drill the quest levels.
          The <b className="text-foreground">AI guide</b> in every deep dive can mock-interview you on the spot.
        </p>
      </div>

      <div className="crt-panel rounded-2xl border bg-card p-6 shadow-sm">
        <div className="kicker mb-1.5">Concept map</div>
        <h2 className="text-2xl tracking-tight">{Object.keys(EXPLORE).length} concepts, three depths</h2>
        <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
          Essentials at a glance on every card; open a <b className="text-foreground">deep dive</b> for a plain-language
          explanation, spec-precise detail, and a wire example. Visit them all for the Explorer badge.
        </p>
        <div className="stagger mt-5 grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(EXPLORE).map(([k, e]) => <ConceptCard key={k} k={k} e={e} visited={st.visited.has(k)} onOpen={() => openDeep(k)} />)}
        </div>
      </div>
    </section>
  );
}

function ConceptCard({ k, e, visited, onOpen }: { k: string; e: Concept; visited: boolean; onOpen: () => void }) {
  const Ic = ICONS[e.icon] ?? Layers;
  return (
    <button onClick={onOpen} id={"card-" + k}
      className={"group term-hover relative flex flex-col gap-2.5 rounded-xl border bg-card p-4 pl-5 text-left shadow-sm hover:-translate-y-0.5 " + (e.dep ? "border-dashed" : "")}>
      <span className={"absolute bottom-3 left-0 top-3 w-1 rounded-r " + CAT_BAR[e.cat]} />
      <div className="flex items-center gap-2.5">
        <span className={"flex h-7 w-7 items-center justify-center rounded-lg " + CAT_SOFT[e.cat]}>
          <Ic size={15} className={CAT_TEXT[e.cat]} />
        </span>
        <div className="min-w-0">
          <div className="line-clamp-1 flex items-center gap-2 text-[13.5px] font-bold leading-tight">{e.t}
            {e.dep && <span className="rounded border border-[hsl(var(--server)/.5)] bg-[hsl(var(--server)/.08)] px-1 text-[9px] font-extrabold tracking-wide text-[hsl(var(--server))]">DEPRECATED</span>}
          </div>
          <div className="line-clamp-1 text-[11.5px] text-muted-foreground">{e.s}</div>
        </div>
      </div>
      <ul className="space-y-1">
        {e.quick.map((q, i) => (
          <li key={i} className="flex gap-1.5 text-xs text-muted-foreground"><span className="text-border">—</span><span className="line-clamp-1">{q}</span></li>
        ))}
      </ul>
      {e.methods.length > 0 && <div className="flex h-[24px] gap-1.5 overflow-hidden">{e.methods.slice(0, 3).map(m => <MethodChip key={m} m={m} />)}</div>}
      <div className="mt-auto flex items-center pt-0.5">
        <span className="text-xs font-semibold text-[hsl(var(--host))] transition-transform duration-200 group-hover:translate-x-0.5">Deep dive →</span>
        {visited && <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--good-text))]"><Check size={11} /> visited</span>}
      </div>
    </button>
  );
}


/* ---------------- deep-dive dialog (self-contained portal) ---------------- */
const HL_RE = /(kubectl [a-z-]+(?: [a-z/-]+)?|oc [a-z-]+(?: [a-z-]+)?|CrashLoopBackOff|ImagePullBackOff|OOMKilled|NotReady|Pending|ClusterIP|NodePort|LoadBalancer|Ingress|NetworkPolic(?:y|ies)|ReplicaSet|StatefulSet|DaemonSet|Deployment|CronJob|ConfigMap|Secret|PersistentVolume(?:Claim)?|StorageClass|PVC|PV|RWO|RWX|ROX|ServiceAccount|RoleBinding|ClusterRole(?:Binding)?|SCC|Route|ImageStream|BuildConfig|kubelet|kube-proxy|CoreDNS|CNI|etcd|SLI|SLOs?|SLA|error budget|burn rate|maxSurge|maxUnavailable|readinessProbe|livenessProbe|startupProbe|initContainers?|systemctl|journalctl|exit code 137)/g;
const hl = (t: string) => t.replace(HL_RE, '<code class="rounded border bg-secondary px-1 py-px text-[.85em] text-foreground">$1</code>');

function FactList({ items, delay = 0 }: { items: string[]; delay?: number }) {
  return (
    <div className="space-y-2.5">
      {items.map((f, i) => (
        <div key={i} className="anim-rise flex gap-2.5 text-[13.5px] text-muted-foreground" style={{ animationDelay: delay + i * 45 + "ms" }}>
          <span className="select-none font-semibold text-border">—</span>
          <span dangerouslySetInnerHTML={{ __html: hl(f) }} />
        </div>
      ))}
    </div>
  );
}

function DeepDive({ k, mode, onClose }: { k: string | null; mode: "learn" | "exam"; onClose: () => void }) {
  const e = k ? EXPLORE[k] : null;
  const [step, setStep] = useState(0);
  const Ic = e ? (ICONS[e.icon] ?? Layers) : Layers;
  const steps = e?.flow ? FLOWS[e.flow] : null;
  const close = () => { onClose(); setStep(0); };
  useEffect(() => {
    if (!e) return;
    const h = (ev: KeyboardEvent) => { if (ev.key === "Escape") close(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e]);
  if (!e) return null;
  return createPortal(
    <div className="anim-static-in fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-5" onClick={ev => { if (ev.target === ev.currentTarget) close(); }} role="dialog" aria-modal="true" aria-label={e.t}>
      <div className="anim-chan crt-panel max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card shadow-2xl">
        {e && (
          <div>
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b bg-card/95 px-6 pb-3 pt-5 backdrop-blur">
              <span className={"mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl " + CAT_SOFT[e.cat]}>
                <Ic size={19} className={CAT_TEXT[e.cat]} />
              </span>
              <div className="pr-2">
                <h3 className="text-xl tracking-tight">{e.t}</h3>
                <p className="text-[12.5px] text-muted-foreground">{e.s}</p>
              </div>
              <button onClick={close} aria-label="Close" className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:text-foreground">
                <XIcon size={15} />
              </button>
            </div>
            <div className="px-6 pb-6 pt-4">
              {e.intro && (
                <div className="mb-5">
                  <div className="kicker mb-2">In plain words</div>
                  <div className="space-y-2.5">
                    {e.intro.map((p, i) => (
                      <p key={i} className="anim-rise text-[14.5px] leading-relaxed text-foreground/90" style={{ animationDelay: i * 60 + "ms" }}>{p}</p>
                    ))}
                  </div>
                  <div className="kicker mb-2 mt-5 border-t pt-4">Essentials</div>
                </div>
              )}
              <FactList items={e.facts} />
              {e.more && (
                <div className="mt-5 border-t pt-4">
                  <div className="kicker mb-2.5">Deep detail</div>
                  <FactList items={e.more} delay={e.facts.length * 45} />
                </div>
              )}
              {e.wire && (
                <div className="mt-5 border-t pt-4">
                  <div className="kicker mb-2.5">On the wire</div>
                  <pre className="wire anim-rise" style={{ animationDelay: "120ms" }}>{e.wire}</pre>
                </div>
              )}
              {mode === "exam" && e.trap && (
                <div className="anim-rise mt-4 rounded-r-lg border-l-[3px] border-[hsl(var(--gold))] bg-[hsl(var(--concept)/.07)] px-3.5 py-2.5 text-[13px]">
                  <span className="mr-1.5 inline-flex items-center gap-1 font-bold"><Target size={13} className="text-[hsl(var(--gold))]" /> Interview trap:</span>{e.trap}
                </div>
              )}
              {e.dep && <p className="mt-3 text-xs text-muted-foreground">Deprecated features remain part of the specification during the ≥12-month deprecation window (removal eligible 2027-07-28).</p>}
              {steps && (
                <div className="mt-5 border-t pt-4">
                  <div className="kicker mb-2.5">Step through the flow</div>
                  <div className="space-y-1.5">
                    {steps.map((s, i) => (
                      <div key={i}
                        className={"flex items-baseline gap-2.5 rounded-lg border px-3 py-2 text-[12.5px] transition-all duration-200 " +
                          (i <= step ? "opacity-100 " : "opacity-35 ") +
                          (i === step ? "border-[hsl(var(--host)/.6)] bg-[hsl(var(--host)/.06)] flow-step-in" : "")}>
                        <span className={"w-14 flex-none text-[10px] font-extrabold uppercase tracking-wider " + WHO_TEXT[s[0]]}>{s[1]}</span>
                        <span className={i <= step ? "text-foreground" : "text-muted-foreground"}>{s[2]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}><ChevronLeft size={14} /> Back</Button>
                    <Button size="sm" disabled={step >= steps.length - 1} onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}>Next <ChevronRight size={14} /></Button>
                  </div>
                </div>
              )}
              <AskGuide e={e} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---------------- quest ---------------- */
function Quest({ st, setSt, addXP, showToast, rank, onReset }: {
  st: AppState; setSt: React.Dispatch<React.SetStateAction<AppState>>;
  addXP: (n: number, m?: string) => void; showToast: (m: string) => void; rank: string; onReset: () => void;
}) {
  const [active, setActive] = useState<Level | null>(null);

  const finishLevel = (L: Level, pct: number) => {
    setSt(s => {
      const best = { ...s.best, [L.id]: Math.max(s.best[L.id] ?? 0, pct) };
      const badges = new Set(s.badges);
      let xp = s.xp;
      if (pct >= 80 && !badges.has(L.id)) { badges.add(L.id); xp += 25; }
      return { ...s, best, badges, xp };
    });
  };

  const share = () => {
    const lines = [`🗺️ DevOps Interview Quest — spec 2026-07-28`, `Rank: ${rank} · ${st.xp} XP`];
    LEVELS.forEach(L => { if (st.best[L.id] !== undefined) lines.push(`Level ${L.n} ${L.t}: ${st.best[L.id]}%${st.badges.has(L.id) ? " " + L.badge.split(" ")[0] : ""}`); });
    if (st.badges.has("explorer")) lines.push("🧭 Explorer: all 12 concepts visited");
    lines.push("DevOps / SRE interview prep — K8s · OpenShift · SRE");
    const txt = lines.join("\n");
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => showToast("Run summary copied!")).catch(() => window.prompt("Copy your run summary:", txt));
    else window.prompt("Copy your run summary:", txt);
  };

  if (active) {
    return active.builder
      ? <BuilderLevel L={active} st={st} addXP={addXP} onDone={pct => finishLevel(active, pct)} onExit={() => setActive(null)} />
      : <QuizLevel L={active} st={st} setSt={setSt} addXP={addXP} onDone={pct => finishLevel(active, pct)} onExit={() => setActive(null)} />;
  }

  return (
    <section className="anim-rise crt-panel rounded-2xl border bg-card p-6 shadow-sm">
      <div className="kicker mb-1.5">Quest — mapped to interview domains</div>
      <h2 className="text-2xl tracking-tight">Seven levels, seven badges</h2>
      <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
        Each run draws fresh questions from a {BANK_SIZE}-question bank proportioned by interview emphasis — retake freely.
        Score ≥80% for the badge. Interview mode adds trap notes; Learn mode adds hints. Progress is saved in this browser.
      </p>
      <div className="stagger mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map(L => {
          const best = st.best[L.id];
          const numBg = L.boss ? "bg-[hsl(var(--server))]" : L.builder ? "bg-[hsl(var(--concept))]" : "bg-[hsl(var(--host))]";
          return (
            <button key={L.id} onClick={() => setActive(L)}
              className="group term-hover rounded-xl border bg-card p-4 text-left shadow-sm hover:-translate-y-0.5">
              <div className="flex items-center gap-2.5">
                <span className={"flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-extrabold text-primary-foreground " + numBg}>{L.n}</span>
                <span className="text-sm font-bold">{L.t}</span>
                {st.badges.has(L.id) && <span className="ml-auto anim-pop text-base">{L.badge.split(" ")[0]}</span>}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {L.builder ? "Assemble the troubleshooting runbooks in the right order"
                  : L.boss ? "12 mixed questions across all domains — the mock interview"
                  : `draws ${L.draw} of ${(POOLS[L.pool!] ?? []).length} pool questions · ${L.w}% focus`}
              </p>
              {best !== undefined && <div className="mt-2 text-[11.5px] font-semibold text-[hsl(var(--good-text))]">Best: {best}%</div>}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {[["explorer", "🧭 Explorer"], ...LEVELS.map(L => [L.id, L.badge] as [string, string])].map(([k, n]) => (
          <span key={k} className={"rounded-full border px-3 py-1 text-xs " + (st.badges.has(k) ? "anim-pop border-[hsl(var(--gold)/.6)] bg-card font-semibold shadow-sm" : "bg-secondary text-muted-foreground")}>{n}</span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={share}><Copy size={14} className="mr-1.5" /> Copy my run summary</Button>
        <ResetButton onReset={onReset} />
        <span className="text-xs text-muted-foreground">Progress auto-saves to this browser.</span>
      </div>
    </section>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return armed
    ? <Button variant="outline" size="sm" className="border-[hsl(var(--bad)/.6)] text-[hsl(var(--bad))]" onClick={onReset}>Really reset all progress?</Button>
    : <Button variant="outline" size="sm" onClick={() => setArmed(true)}><RotateCcw size={13} className="mr-1" /> Reset progress</Button>;
}

/* ---------------- quiz level ---------------- */
function QuizLevel({ L, st, setSt, addXP, onDone, onExit }: {
  L: Level; st: AppState; setSt: React.Dispatch<React.SetStateAction<AppState>>;
  addXP: (n: number, m?: string) => void; onDone: (pct: number) => void; onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const [runId, setRunId] = useState(0);
  // each run draws a fresh random set from the level's domain pool
  const qs = useMemo(
    () => L.qs ?? (L.boss ? bossDraw() : sample(POOLS[L.pool!] ?? [], L.draw ?? 8)),
    [L, runId]
  );
  const q = qs[Math.min(i, qs.length - 1)];

  const pick = (j: number) => {
    if (picked !== null) return;
    setPicked(j);
    const ok = j === q.a;
    if (ok) {
      setScore(s => s + 1);
      setSt(s => ({ ...s, streak: s.streak + 1 }));
      const bonus = Math.min(10, st.streak * 2);
      addXP(10 + bonus);
    } else setSt(s => ({ ...s, streak: 0 }));
  };
  const next = () => {
    if (i + 1 < qs.length) { setI(i + 1); setPicked(null); setShowHint(false); }
    else { const pct = Math.round((100 * (score)) / qs.length); onDone(pct); setFinished(true); }
  };

  if (finished) {
    const pct = Math.round((100 * score) / qs.length);
    return <ResultCard pct={pct} sub={`${score} / ${qs.length} on ${L.t}`} badge={pct >= 80 ? L.badge : undefined} onRetry={() => { setI(0); setScore(0); setPicked(null); setFinished(false); setRunId(r => r + 1); }} onExit={onExit} />;
  }

  return (
    <section className="anim-rise">
      <div className="crt-panel rounded-2xl border bg-card p-6 shadow-sm">
        <div className="tabnum flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="font-bold text-foreground/80">Level {L.n} · {L.t}</span>
          <span>Question {i + 1} / {qs.length}</span><span>Score {score}</span>
          {st.streak > 1 && <span className="flex items-center gap-1 font-bold text-[hsl(var(--server))]"><Flame size={12} /> ×{st.streak}</span>}
        </div>
        <h3 className="mb-4 mt-2 max-w-2xl text-[22px] leading-snug tracking-tight">{q.q}</h3>
        <div className="space-y-2">
          {q.o.map((o, j) => {
            const state = picked === null ? "" : j === q.a ? "correct" : j === picked ? "wrong" : "dim";
            return (
              <button key={j} disabled={picked !== null} onClick={() => pick(j)}
                className={"flex w-full gap-2.5 rounded-xl border px-4 py-2.5 text-left text-[13.5px] transition-all duration-150 " +
                  (state === "correct" ? "anim-glow border-[hsl(var(--good))] bg-[hsl(var(--client)/.1)] " :
                   state === "wrong" ? "anim-shake border-[hsl(var(--bad))] " :
                   state === "dim" ? "opacity-55 " : "hover:border-muted-foreground/40 hover:bg-secondary/60 ")}>
                <span className={"font-extrabold " + (state === "correct" ? "text-[hsl(var(--good-text))]" : state === "wrong" ? "text-[hsl(var(--bad))]" : "text-muted-foreground")}>{String.fromCharCode(65 + j)}</span>
                <span>{o}</span>
              </button>
            );
          })}
        </div>
        {st.mode === "learn" && q.h && picked === null && (
          <div className="mt-3">
            {!showHint
              ? <Button variant="outline" size="sm" onClick={() => setShowHint(true)}><Lightbulb size={13} className="mr-1" /> Hint</Button>
              : <div className="anim-rise rounded-r-lg border-l-[3px] border-[hsl(var(--client))] bg-[hsl(var(--client)/.08)] px-3 py-2 text-[13px] text-muted-foreground">{q.h}</div>}
          </div>
        )}
        {picked !== null && (
          <div className={"anim-rise mt-4 rounded-xl border px-4 py-3 text-[13.5px] " + (picked === q.a ? "border-[hsl(var(--good)/.5)]" : "border-[hsl(var(--bad)/.5)]")}>
            <b className={picked === q.a ? "text-[hsl(var(--good-text))]" : "text-[hsl(var(--bad))]"}>{picked === q.a ? "✓ Correct" : "✕ Not quite"}</b> — {q.x}
            {st.mode === "exam" && q.t && (
              <div className="mt-2 rounded-r-lg border-l-[3px] border-[hsl(var(--gold))] bg-[hsl(var(--concept)/.07)] px-3 py-2 text-[12.5px]">
                <b className="mr-1 inline-flex items-center gap-1"><Target size={12} className="text-[hsl(var(--gold))]" /> Interview trap:</b>{q.t}
              </div>
            )}
            <div className="mt-3"><Button size="sm" onClick={next}>{i + 1 < qs.length ? <>Next <ChevronRight size={14} /></> : "Finish level"}</Button></div>
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" className="mt-3" onClick={onExit}><ArrowLeft size={13} className="mr-1" /> Level select</Button>
    </section>
  );
}

/* ---------------- builder level ---------------- */
function shuffle(n: number) { return Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5); }

function BuilderLevel({ L, addXP, onDone, onExit }: {
  L: Level; st: AppState; addXP: (n: number, m?: string) => void; onDone: (pct: number) => void; onExit: () => void;
}) {
  const [round, setRound] = useState(0);
  const [pool, setPool] = useState<number[]>(() => shuffle(BUILDS[0].steps.length));
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [wins, setWins] = useState(0);
  const [finished, setFinished] = useState(false);
  const r = BUILDS[Math.min(round, BUILDS.length - 1)];

  const reset = (ri: number) => { setPool(shuffle(BUILDS[ri].steps.length)); setOrder([]); setChecked(false); };
  const check = () => { setChecked(true); if (order.every((v, idx) => v === idx)) { setWins(w => w + 1); addXP(15, "perfect sequence!"); } };
  const next = () => {
    if (round + 1 < BUILDS.length) { setRound(round + 1); reset(round + 1); }
    else { const ok = wins + (checked && order.every((v, idx) => v === idx) && round === BUILDS.length - 1 ? 0 : 0); const pct = Math.round((100 * wins) / BUILDS.length); onDone(pct); setFinished(true); void ok; }
  };

  if (finished) {
    const pct = Math.round((100 * wins) / BUILDS.length);
    return <ResultCard pct={pct} sub={`${wins} / ${BUILDS.length} flows assembled perfectly`} badge={pct >= 80 ? L.badge : undefined}
      onRetry={() => { setRound(0); reset(0); setWins(0); setFinished(false); }} onExit={onExit} />;
  }

  const chip = (idx: number, placed: boolean) => {
    const s = r.steps[idx];
    const ok = checked && placed ? order[order.indexOf(idx)] === idx && order.indexOf(idx) === idx : null;
    return (
      <button key={idx} disabled={checked}
        onClick={() => placed ? (setOrder(o => o.filter(x => x !== idx)), setPool(p => [...p, idx])) : (setPool(p => p.filter(x => x !== idx)), setOrder(o => [...o, idx]))}
        className={"anim-pop rounded-lg border bg-card px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 " +
          (placed ? "bg-[hsl(var(--host)/.07)] " : "") +
          (checked && placed ? (order.indexOf(idx) === idx ? "border-[hsl(var(--good))]" : "border-[hsl(var(--bad))]") : "")}>
        <span className={"mr-1.5 text-[9.5px] font-extrabold uppercase tracking-wider " + WHO_TEXT[s[0]]}>{s[1]}</span>{s[2]}
        {ok !== null && null}
      </button>
    );
  };

  return (
    <section className="anim-rise">
      <div className="crt-panel rounded-2xl border bg-card p-6 shadow-sm">
        <div className="tabnum flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-bold text-foreground/80">Level {L.n} · {L.t}</span><span>Round {round + 1} / {BUILDS.length}</span>
        </div>
        <h3 className="mb-3 mt-2 text-[22px] leading-snug tracking-tight">{r.t}</h3>
        <div className="kicker mb-1.5">Your sequence — tap a placed chip to remove it</div>
        <div className="flex min-h-[52px] flex-wrap gap-2 rounded-xl border-[1.5px] border-dashed border-[hsl(var(--host)/.5)] p-2.5">
          {order.length ? order.map(idx => chip(idx, true)) : <span className="self-center text-xs text-muted-foreground">— empty —</span>}
        </div>
        <div className="kicker mb-1.5 mt-4">Available steps</div>
        <div className="flex min-h-[52px] flex-wrap gap-2 rounded-xl border-[1.5px] border-dashed p-2.5">
          {pool.length ? pool.map(idx => chip(idx, false)) : <span className="self-center text-xs text-muted-foreground">all placed</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={pool.length !== 0 || checked} onClick={check}>Check sequence</Button>
          <Button variant="outline" size="sm" onClick={() => reset(round)}><RotateCcw size={13} className="mr-1" /> Reset</Button>
          <Button variant="outline" size="sm" onClick={onExit}><ArrowLeft size={13} className="mr-1" /> Level select</Button>
        </div>
        {checked && (
          <div className={"anim-rise mt-4 rounded-xl border px-4 py-3 text-[13.5px] " + (order.every((v, idx) => v === idx) ? "border-[hsl(var(--good)/.5)]" : "border-[hsl(var(--bad)/.5)]")}>
            {order.every((v, idx) => v === idx)
              ? <><b className="text-[hsl(var(--good-text))]">✓ Perfect sequence</b> — that's exactly how the spec sequences it.</>
              : <><b className="text-[hsl(var(--bad))]">✕ Order is off</b> — red chips are misplaced. Correct order:
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                    {r.steps.map((s, idx) => <li key={idx}><b className={WHO_TEXT[s[0]]}>{s[1]}</b>: {s[2]}</li>)}
                  </ol></>}
            <div className="mt-3"><Button size="sm" onClick={next}>{round + 1 < BUILDS.length ? <>Next round <ChevronRight size={14} /></> : "Finish level"}</Button></div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- result ---------------- */
function ResultCard({ pct, sub, badge, onRetry, onExit }: { pct: number; sub: string; badge?: string; onRetry: () => void; onExit: () => void }) {
  return (
    <section className="anim-rise crt-panel rounded-2xl border bg-card p-10 text-center shadow-sm">
      <div className="hero-num anim-pop font-display text-7xl tracking-tight">{pct}%</div>
      <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
      {badge && <p className="anim-pop mt-3 text-sm" style={{ animationDelay: "150ms" }}><Trophy size={14} className="mr-1 inline text-[hsl(var(--gold))]" /> Badge earned: <b>{badge}</b> (+25 XP)</p>}
      {!badge && <p className="mt-2 text-xs text-muted-foreground">Score ≥80% for the badge — the study-kit digests have every answer.</p>}
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}><RotateCcw size={13} className="mr-1" /> Retry</Button>
        <Button size="sm" onClick={onExit}>Level select</Button>
      </div>
    </section>
  );
}
