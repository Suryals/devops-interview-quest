# 🧰 Ops Interview Quest

A gamified study companion for **DevOps / SRE interview preparation** — Kubernetes, OpenShift, and SRE practice. Built on the quest-engine extracted from [MCP Architecture Quest](../../Downloads/mcp-architecture-quest/): concept cards with three-depth deep dives, domain-mapped quiz levels with random draws from a question bank, runbook-ordering puzzles, XP/badges, saved progress, and an AI guide in every deep dive.

**No build needed to use it.** `index.html` (once built) is a single self-contained file.

## Status: scaffold

The engine is complete and working. Content is **starter-level**:

- 8 concept cards (Pods, Workloads, Services & networking, Storage, OpenShift deltas, RBAC, SLO/error budgets, Troubleshooting method)
- 2 runbook builders (CrashLoopBackOff, Node NotReady)
- 12 seed questions across 5 domains (`core`, `netstore`, `troubleshoot`, `openshift`, `sre`)

## The AI guide — designed for people WITHOUT a beefy machine

Default provider is **"My Claude app"** (or "My ChatGPT app"): one click opens a chat in the user's own claude.ai / chatgpt.com subscription with the concept's study notes and question preloaded — no API key, no local model. The quick prompt **"Interview me on this topic"** turns it into a mock interviewer. Local LLM (LM Studio/Ollama) and Anthropic API remain as power options in GUIDE settings.

## Develop

```bash
cd app
npm install
npm run dev          # hot-reload dev server
# ship a single file:
npx vite build && node -e '…inline dist assets…'   # see scripts/build-single.md
```

## Growing the content (the pipeline)

1. Content lives in `app/src/`: `data.ts` (cards, runbooks, seed questions), `bank.json` (generated question pools), `cards.json` + `intros.json` (generated cards/intros).
2. Generate at scale with LLM agents, one per domain, each **grounded in official docs** (kubernetes.io/docs, docs.redhat.com OpenShift, sre.google/books). Have each agent emit JSON matching `{"q","o"[4],"a",“x”,"h"?,"t"?}` to `/tmp/quest-bank-ops/<domain>-questions.json`.
3. `scripts/merge.py` validates (4 options, answer index, dedupe, answer-key distribution) and writes `bank.json` / `cards.json`. Update its `BANK_MAP` keys to: core, netstore, troubleshoot, openshift, sre.
4. Domain emphasis on the level cards is set in `app/src/questions.ts` (`w:` fields) — tune to the target interview, not an exam grid.

Question style guidance: favor **scenario stems** ("a rollout is stuck…", "permission denied on OpenShift…") over definitions; add `t` (trap notes) for classically confused pairs (readiness vs liveness, RWO node-vs-pod, RoleBinding+ClusterRole scope).

## Ideas queued

- Interviewer rubric mode: guide asks → user answers in own words → guide scores against a grounded rubric
- Terminal-output reading questions (here's `kubectl describe`, what's wrong?)
- More runbooks: PVC Pending, DNS failures, cert expiry, etcd alarms
- Second pack: cloud (AWS), Terraform, CI/CD

## Disclaimer

Community study aid. Not affiliated with the CNCF, Red Hat, or any certification body. Verify everything against the official docs.

MIT — see [LICENSE](LICENSE).
