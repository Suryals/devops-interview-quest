export type Actor = "c" | "s" | "u";
export type FlowStep = [Actor, string, string];

export interface Concept {
  cat: "host" | "client" | "server" | "concept";
  icon: string; // lucide icon key resolved in App
  t: string;
  s: string;
  quick: string[];
  methods: string[];
  facts: string[];
  trap: string;
  dep?: boolean;
  flow?: "crash" | "notready";
  more?: string[];
  wire?: string;
  intro?: string[];
}

/* Runbook step-throughs (actor labels reused: c=You, s=Cluster, u=Check) */
export const FLOWS: Record<"crash" | "notready", FlowStep[]> = {
  crash: [
    ["c", "You", "kubectl get pods -n <ns> — confirm CrashLoopBackOff and restart count"],
    ["c", "You", "kubectl describe pod <pod> — events: OOMKilled? probe failures? image pull?"],
    ["c", "You", "kubectl logs <pod> --previous — the crash output from the LAST container run"],
    ["u", "Check", "Exit code 137 = OOM/SIGKILL · 1 = app error · probe config vs app startup time"],
    ["c", "You", "Fix the cause (limits, probe timing, config/secret, image) in the manifest"],
    ["s", "Cluster", "kubectl rollout status — new ReplicaSet becomes Ready, restarts stop"],
  ],
  notready: [
    ["c", "You", "kubectl get nodes — identify the NotReady node and how long it's been down"],
    ["c", "You", "kubectl describe node <node> — Conditions: MemoryPressure, DiskPressure, PIDPressure, Ready"],
    ["u", "Check", "ssh/debug: systemctl status kubelet · journalctl -u kubelet — kubelet talking to the API server?"],
    ["u", "Check", "Container runtime up? CNI pods healthy? Disk full? Certificate expiry?"],
    ["c", "You", "Fix and restart kubelet; workloads reschedule per tolerations/eviction timeouts"],
    ["s", "Cluster", "Node returns Ready — uncordon if you cordoned it during the repair"],
  ],
};

export const EXPLORE: Record<string, Concept> = {
  pods: {
    cat: "host", icon: "box", t: "Pods", s: "The atomic unit of scheduling",
    quick: ["Smallest deployable unit — 1+ containers", "Shared network namespace & volumes", "Ephemeral by design — never pet a pod"],
    methods: ["kubectl get pods", "kubectl describe pod", "kubectl logs"],
    facts: [
      "A pod is one or more containers sharing an IP, localhost, and volumes — scheduled together on one node, living and dying together.",
      "Pods are cattle: controllers (Deployments, StatefulSets) replace them; you almost never create bare pods in production.",
      "initContainers run to completion, in order, before app containers start; sidecars run alongside the app container.",
      "Liveness probes restart a stuck container; readiness probes gate Service traffic; startup probes protect slow-booting apps from the liveness probe.",
      "Resource requests drive scheduling; limits drive CPU throttling and memory OOM kills.",
    ],
    trap: "Readiness failure ≠ restart. Only the LIVENESS probe restarts containers; readiness just pulls the pod out of Service endpoints.",
  },
  workloads: {
    cat: "host", icon: "layers", t: "Workload controllers", s: "Deployments · StatefulSets · DaemonSets · Jobs",
    quick: ["Deployment → ReplicaSet → Pods", "StatefulSet: stable identity + storage", "DaemonSet: one per node"],
    methods: ["kubectl rollout", "kubectl scale"],
    facts: [
      "A Deployment manages stateless replicas via ReplicaSets; a rolling update creates a new RS and scales the old one down (maxSurge / maxUnavailable control the pace).",
      "kubectl rollout undo reverts to the previous ReplicaSet revision — old RSes are kept at 0 replicas as history.",
      "StatefulSet gives ordinal names (app-0, app-1), stable DNS via a headless Service, and per-replica PVCs that survive rescheduling.",
      "DaemonSet runs exactly one pod per matching node — log shippers, CNI agents, node exporters.",
      "Job runs pods to completion with retries; CronJob schedules Jobs — know concurrencyPolicy and startingDeadlineSeconds.",
    ],
    trap: "Scaling a StatefulSet down does NOT delete its PVCs — data deliberately outlives the pod.",
  },
  services: {
    cat: "client", icon: "cable", t: "Services & networking", s: "Stable virtual IPs over ephemeral pods",
    quick: ["ClusterIP → NodePort → LoadBalancer", "kube-proxy programs the rules", "DNS: name.ns.svc.cluster.local"],
    methods: ["kubectl get svc", "kubectl get endpoints"],
    facts: [
      "A Service selects pods by label and balances across READY endpoints only — empty Endpoints is the #1 'service is broken' cause (selector mismatch or nothing ready).",
      "ClusterIP is virtual — it never answers ping; kube-proxy (iptables/IPVS) rewrites connections to pod IPs.",
      "NodePort exposes the Service on every node (default range 30000-32767); LoadBalancer builds on NodePort with a cloud LB; headless (clusterIP: None) returns pod IPs directly in DNS.",
      "Ingress routes HTTP by host/path to Services and requires an ingress controller to actually do anything.",
      "NetworkPolicies: traffic is default-allow until any policy selects a pod — then that direction becomes default-deny for it.",
    ],
    trap: "kubectl get endpoints is the interview reflex: a Service with no endpoints means selector mismatch or failing readiness — not a DNS problem.",
  },
  storage: {
    cat: "client", icon: "filetext", t: "Storage — PV, PVC, StorageClass", s: "Claims decouple pods from disks",
    quick: ["PVC = request · PV = the disk", "StorageClass = dynamic provisioning", "Access modes are node-level"],
    methods: ["kubectl get pv,pvc,sc"],
    facts: [
      "A pod mounts a PVC; the PVC binds a PV; a StorageClass provisions PVs on demand — hand-created PVs are rare in modern clusters.",
      "volumeBindingMode: WaitForFirstConsumer delays provisioning until the pod schedules, so the disk lands in the right zone.",
      "Access modes: RWO (one node), ROX (read-only many), RWX (many nodes — needs NFS/CephFS-class storage).",
      "reclaimPolicy Delete removes the backing disk with the PVC; Retain keeps it (PV goes Released and needs manual cleanup).",
      "PVC stuck Pending → no matching StorageClass/PV, or WaitForFirstConsumer with an unschedulable pod.",
    ],
    trap: "Two pods on the SAME node can share an RWO volume — RWO restricts nodes, not pods. Classic trick question.",
  },
  openshift: {
    cat: "server", icon: "shield", t: "OpenShift deltas", s: "What Red Hat adds & restricts",
    quick: ["Routes predate Ingress", "SCCs: no root by default", "Projects · ImageStreams · Operators"],
    methods: ["oc new-app", "oc get route", "oc get co"],
    facts: [
      "Routes are OpenShift's L7 exposure with edge / passthrough / re-encrypt TLS; Ingress objects are translated to Routes by the HAProxy router.",
      "Security Context Constraints (SCCs) gate pod privileges; the default restricted SCC runs containers as a random non-root UID — images assuming root or a fixed UID break here first.",
      "Projects are namespaces plus request/quota machinery; oc new-project is the self-service path.",
      "ImageStreams track image tags and can trigger redeployments on new pushes; BuildConfigs / S2I build images in-cluster from source.",
      "The platform is operator-managed end to end — oc get clusteroperators is the first health check in any OpenShift incident scenario.",
    ],
    trap: "\"Runs on my K8s, permission denied on OpenShift\" → SCC / arbitrary-UID issue, not RBAC. Fix the image (GID 0 writable), don't grant anyuid.",
  },
  rbac: {
    cat: "server", icon: "key", t: "RBAC & auth", s: "Who can do what, where",
    quick: ["Role/ClusterRole = verbs on resources", "Bindings attach subjects", "Additive only — no deny"],
    methods: ["kubectl auth can-i"],
    facts: [
      "Roles are namespaced, ClusterRoles cluster-wide; bindings connect users, groups, or ServiceAccounts to them.",
      "RBAC is purely additive — there are no deny rules; least privilege means granting narrowly.",
      "Workloads authenticate as ServiceAccounts with projected tokens — which is why default-SA-with-broad-grants is an anti-pattern.",
      "kubectl auth can-i <verb> <resource> --as=<subject> is the fastest 403 debugger.",
      "Vanilla K8s has no user objects — humans arrive via certs or OIDC; OpenShift adds real User/Group APIs and an OAuth server.",
    ],
    trap: "A RoleBinding can reference a ClusterRole — granting those permissions ONLY inside that namespace. Frequently mis-answered.",
  },
  slo: {
    cat: "concept", icon: "gauge", t: "SLI · SLO · error budgets", s: "Reliability as a number you spend",
    quick: ["SLI measures · SLO targets · budget = 1−SLO", "Alert on burn rate", "100% is the wrong target"],
    methods: [],
    facts: [
      "An SLI is a measured good/total ratio (successful requests over all requests); an SLO is the target for it over a window (99.9% / 30 days).",
      "Error budget = 1 − SLO: 99.9% monthly ≈ 43 minutes of full downtime to 'spend' on releases, experiments, and incidents.",
      "Budget exhausted → the pre-agreed policy fires: feature freeze, reliability work first. The budget is the dev-velocity ↔ stability contract.",
      "Page on burn RATE (multi-window, multi-burn-rate), not instantaneous error blips.",
      "SLAs are external contracts with penalties; SLOs are internal targets set tighter than any SLA.",
    ],
    trap: "\"Why not 100%?\" — the last nine costs exponentially more, users can't perceive it, and a zero budget forbids all change.",
  },
  triage: {
    cat: "concept", icon: "alert", t: "Troubleshooting method", s: "The triage loop interviewers grade", flow: "crash",
    quick: ["Observe → hypothesize → test → iterate", "describe + events + logs first", "Mitigate before root-cause"],
    methods: ["kubectl describe", "kubectl logs --previous", "kubectl get events"],
    facts: [
      "Interview troubleshooting is graded on METHOD: say what you observe, form a hypothesis, name the command that tests it, interpret, iterate.",
      "The triage trio: kubectl describe (events!), kubectl logs (--previous for crashed containers), kubectl get events --sort-by=.lastTimestamp.",
      "Pending = scheduling (resources, taints, affinity, PVC). CrashLoopBackOff = starts then dies (app, probes, OOM). ImagePullBackOff = registry, tag, or pull secret.",
      "In incidents: mitigate first (rollback, scale, failover), root-cause after — say this out loud.",
      "kubectl debug with ephemeral containers is the modern answer to 'the image has no shell'.",
    ],
    trap: "Reaching for logs on a Pending pod is the classic fail — Pending pods never started, so there are no logs; the answer is in describe/events.",
  },
};

export interface Q { q: string; o: string[]; a: number; x: string; t?: string; h?: string }
export interface Level {
  id: string; n: number; t: string; badge: string;
  qs?: Q[]; builder?: boolean; boss?: boolean;
  pool?: string; draw?: number; w?: number;
}

/* Seed questions per domain — grown to interview scale by the generation
   pipeline (scripts/merge.py + the agent prompts documented in the README). */
export const LEVELS: Level[] = [
  { id: "seed-core", n: 0, t: "seeds", badge: "", qs: [
    { q: "A Deployment rollout is stuck: the new pod is Pending, old ones still run. maxUnavailable is 0, maxSurge is 1, and the cluster is at capacity. What's happening?", o: ["The image tag is invalid", "The surge pod can't schedule for lack of resources, and zero-unavailable forbids freeing capacity by stopping old pods", "kube-proxy is misconfigured", "The rollout awaits manual approval"], a: 1, x: "maxSurge:1 needs headroom for one extra pod; with none, and maxUnavailable:0 blocking scale-down, the rollout cannot progress.", h: "Walk the surge/unavailable math.", t: "Constraint-interaction stems like this are the interview norm — narrate the mechanism." },
    { q: "Which probe failure causes a container restart?", o: ["Readiness", "Liveness", "Startup succeeding", "Any probe"], a: 1, x: "Liveness failures restart the container; readiness only removes the pod from Service endpoints.", h: "One gates traffic, one gates life." },
    { q: "A pod shows OOMKilled, exit code 137. First fix to evaluate?", o: ["Raise the liveness timeout", "Right-size the container memory limit after checking real usage", "Add a second replica", "Move it to another node"], a: 1, x: "137 = SIGKILL from the OOM killer: usage exceeded the memory limit. Right-size or fix the leak.", h: "128 + 9." },
    { q: "kubectl get endpoints myservice returns no addresses. Most likely cause?", o: ["CoreDNS is down", "The Service selector doesn't match pod labels, or no matching pod is Ready", "ClusterIP range exhausted", "kubelet stopped"], a: 1, x: "Empty endpoints = selector mismatch or readiness failure. DNS resolving the name proves nothing about endpoints.", t: "DNS is the planted decoy." },
  ]},
  { id: "seed-plat", n: 0, t: "seeds", badge: "", qs: [
    { q: "An image that runs on vanilla K8s fails on OpenShift with 'permission denied' writing /var/cache. Why?", o: ["OpenShift forbids writable filesystems", "The restricted SCC runs it as a random non-root UID lacking write access to that path", "SELinux is disabled", "The Route is misconfigured"], a: 1, x: "The default restricted SCC assigns an arbitrary UID; images must be group-writable (GID 0) rather than assume root or a fixed UID.", h: "Think UID, not RBAC." },
    { q: "TLS termination where the router decrypts and re-encrypts to the pod is which Route type?", o: ["Edge", "Passthrough", "Re-encrypt", "Mutual"], a: 2, x: "Edge decrypts at the router (plain to pod); passthrough never decrypts; re-encrypt decrypts then re-encrypts." },
    { q: "First command to assess overall OpenShift cluster health in an incident?", o: ["oc get pods -A", "oc get clusteroperators", "oc adm top nodes", "oc get routes"], a: 1, x: "Cluster operators aggregate platform health — a degraded operator points directly at the failing subsystem." },
    { q: "A RoleBinding in namespace dev references ClusterRole admin. The subject can now…", o: ["Administer the whole cluster", "Administer only the dev namespace", "Nothing — invalid combination", "Read all namespaces"], a: 1, x: "RoleBinding + ClusterRole = that role's verbs scoped to the binding's namespace — reuse without cluster-wide grant.", t: "The reverse (ClusterRoleBinding → Role) is the invalid one." },
  ]},
  { id: "seed-sre", n: 0, t: "seeds", badge: "", qs: [
    { q: "A service has a 99.9% 30-day SLO. Roughly how much full-downtime budget is that?", o: ["4.3 hours", "43 minutes", "8.7 minutes", "4.3 minutes"], a: 1, x: "0.1% of 30 days ≈ 43 minutes. Know 99.9 / 99.95 / 99.99 by heart.", h: "0.1% of 43,200 minutes." },
    { q: "The error budget is exhausted mid-quarter. The textbook SRE response is…", o: ["Raise the SLO", "Pause feature releases and spend engineering time on reliability, per the pre-agreed policy", "Silence alerts until the window rolls", "Add replicas everywhere"], a: 1, x: "The budget is a contract: exhaustion triggers the agreed policy — typically a release freeze plus reliability work." },
    { q: "Why alert on burn rate instead of raw error rate?", o: ["Cheaper to compute", "It pages only when budget is being consumed fast enough to matter — quiet on blips, early on real burns", "Raw error rate can't be measured", "Tooling requires it"], a: 1, x: "Multi-window burn-rate alerting maps urgency to budget impact." },
    { q: "During a major incident, your first responsibility is…", o: ["Find the root cause", "Mitigate user impact — rollback, failover, shed load — then investigate", "Write the postmortem", "Update the status page"], a: 1, x: "Mitigation before diagnosis — say it explicitly; it's what incident commanders are graded on." },
  ]},
];

export const BUILDS = [
  { t: "CrashLoopBackOff — assemble the runbook", steps: FLOWS.crash },
  { t: "Node NotReady — assemble the runbook", steps: FLOWS.notready },
];

export const RANKS: [number, string][] = [[0, "Candidate"], [150, "On-caller"], [450, "Senior"], [800, "Staff Material"]];
export const XP_MAX = 1000;

/* ---- generated content merge (intros + extra concept cards) ---- */
import INTROS from "./intros.json";
import EXTRA_CARDS from "./cards.json";
for (const [k, v] of Object.entries(INTROS as Record<string, string[]>)) {
  if (EXPLORE[k]) EXPLORE[k].intro = v;
}
for (const c of EXTRA_CARDS as (Concept & { key: string })[]) {
  EXPLORE[c.key] = c;
}
