import json, os, sys
BANK_MAP = {  # ops domains
  "core": "core-questions.json",
  "netstore": "netstore-questions.json",
  "troubleshoot": "troubleshoot-questions.json",
  "openshift": "openshift-questions.json",
  "sre": "sre-questions.json",
}
CARD_FILES = ["core-cards.json", "netstore-cards.json", "troubleshoot-cards.json", "openshift-cards.json", "sre-cards.json"]
D = "/tmp/quest-bank-ops"
APP = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "src"))

bank, report = {}, []
for domain, fn in BANK_MAP.items():
    p = os.path.join(D, fn)
    if not os.path.exists(p):
        bank[domain] = []; report.append(f"{domain}: MISSING ({fn})"); continue
    qs = json.load(open(p))
    ok, seen, dist = [], set(), [0,0,0,0]
    for q in qs:
        if not (isinstance(q.get("q"), str) and isinstance(q.get("o"), list) and len(q["o"]) == 4
                and isinstance(q.get("a"), int) and 0 <= q["a"] <= 3 and isinstance(q.get("x"), str)):
            report.append(f"{domain}: DROPPED malformed: {str(q.get('q'))[:60]}"); continue
        key = q["q"].strip().lower()
        if key in seen:
            report.append(f"{domain}: DROPPED dup: {q['q'][:60]}"); continue
        seen.add(key); dist[q["a"]] += 1
        ok.append({k: v for k, v in q.items() if k in ("q","o","a","x","h","t")})
    bank[domain] = ok
    report.append(f"{domain}: {len(ok)} questions, answer dist {dist}")

cards = []
for fn in CARD_FILES:
    p = os.path.join(D, fn)
    if not os.path.exists(p): report.append(f"cards: MISSING {fn}"); continue
    for c in json.load(open(p)):
        req = {"key","cat","icon","t","s","quick","facts","trap"}
        if req - set(c): report.append(f"cards: DROPPED {c.get('key')} missing {req-set(c)}"); continue
        c.setdefault("methods", [])
        cards.append(c)
report.append(f"cards: {len(cards)} total: {[c['key'] for c in cards]}")

json.dump(bank, open(os.path.join(APP, "bank.json"), "w"), indent=0)
json.dump(cards, open(os.path.join(APP, "cards.json"), "w"), indent=0)
total = sum(len(v) for v in bank.values())
report.append(f"TOTAL bank: {total} generated (+28 legacy seeds in app)")
print("\n".join(report))
