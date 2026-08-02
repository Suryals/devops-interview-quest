import { LEVELS as SEEDS, type Level, type Q } from "./data";
import BANK from "./bank.json";

/* Question pools by interview domain. Generated questions land in bank.json
   (see scripts/merge.py); hand-written seeds fold in from data.ts. */
const seed = (id: string): Q[] => SEEDS.find(l => l.id === id)?.qs ?? [];

export const POOLS: Record<string, Q[]> = {
  core: [...seed("seed-core"), ...(BANK.core as Q[])],
  netstore: BANK.netstore as Q[],
  troubleshoot: BANK.troubleshoot as Q[],
  openshift: [...seed("seed-plat"), ...(BANK.openshift as Q[])],
  sre: [...seed("seed-sre"), ...(BANK.sre as Q[])],
};

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const sample = (pool: Q[], n: number): Q[] => shuffle(pool).slice(0, Math.min(n, pool.length));

/** Mock round: mixed draw across all domains. */
export function bossDraw(): Q[] {
  return shuffle([
    ...sample(POOLS.core, 3),
    ...sample(POOLS.netstore, 2),
    ...sample(POOLS.troubleshoot, 3),
    ...sample(POOLS.openshift, 2),
    ...sample(POOLS.sre, 2),
  ]);
}

export const BANK_SIZE = Object.values(POOLS).reduce((n, p) => n + p.length, 0);

/* Interview domains. Weights are prep-emphasis, not an official exam split. */
export const QUEST_LEVELS: Level[] = [
  { id: "core", n: 1, t: "Kubernetes Core", badge: "📦 Pod Wrangler", pool: "core", draw: 8, w: 25 },
  { id: "netstore", n: 2, t: "Networking & Storage", badge: "🕸️ Wire Walker", pool: "netstore", draw: 8, w: 20 },
  { id: "troubleshoot", n: 3, t: "Troubleshooting Scenarios", badge: "🚑 Incident Surgeon", pool: "troubleshoot", draw: 10, w: 25 },
  { id: "openshift", n: 4, t: "OpenShift", badge: "🎩 Route Master", pool: "openshift", draw: 8, w: 15 },
  { id: "builder", n: 5, t: "Runbook Builder", badge: "📋 Runbook Ronin", builder: true },
  { id: "sre", n: 6, t: "SRE & Operations", badge: "🔥 Budget Keeper", pool: "sre", draw: 8, w: 15 },
  { id: "boss", n: 7, t: "Mock Round", badge: "🏆 Offer Magnet", boss: true, draw: 12 },
];
