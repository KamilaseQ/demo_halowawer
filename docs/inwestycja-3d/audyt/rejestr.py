"""Generuje docs/inwestycja-3d/defekty.md z defekty.json (jedno źródło rejestru).

    python rejestr.py
"""
import json
import os
from collections import Counter


def short(t, n):
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
d = json.load(open(os.path.join(BASE, "defekty.json"), encoding="utf-8"))
items = d["defekty"]
open_items = [x for x in items if x["status"] not in ("zamknięty", "odrzucony") and not x["status"].startswith("zastąpiony")]
L = ["# Rejestr defektów /domy (BOR2)", "",
     "Prowadzi audytor (e3). Źródło: [defekty.json](defekty.json), ten plik generuje `audyt/rejestr.py`. "
     "Status „zamknięty” nadaje tylko audytor po ponownym sweepie.", "",
     f"**Otwarte: {len(open_items)} z {len(items)}.** Wg poziomu: " + ", ".join(f"{k} {v}" for k, v in sorted(Counter(x['poziom'] for x in open_items).items())) +
     ". Wg właściciela: " + ", ".join(f"{k} {v}" for k, v in sorted(Counter(x['wlasciciel'] for x in open_items).items())) + ".", "",
     "## Iteracje", "", "| sweep | data | stan sceny | wzorzec | pozy | arkusze | scorecard ΔE (L2) |", "|---|---|---|---|---|---|---|"]
for it in d["iteracje"]:
    L.append(f"| {it['id']} | {it['data']} | {it['stan']} | {it['wzorzec']} | `{it['pozy']}` | `{it['arkusze']}` | {it.get('scorecard', '—')} |")
L += ["", "## Lista", "", "| ID | poziom | miejsce | opis | właściciel | status |", "|---|---|---|---|---|---|"]
for x in items:
    L.append(f"| [{x['id']}](#{x['id'].lower()}) | {x['poziom']} | {short(x['miejsce'], 90)} | {short(x['opis'], 130)} | {x['wlasciciel']} | {x['status']} |")
L += ["", "## Szczegóły", ""]
for x in items:
    L += [f"### {x['id']}", "",
          f"- **Poziom:** {x['poziom']} · **Status:** {x['status']} · **Właściciel:** {x['wlasciciel']} · **Źródło:** {x['zrodlo']}",
          f"- **Miejsce:** {x['miejsce']}",
          f"- **Opis:** {x['opis']}",
          f"- **Przyczyna:** {x['przyczyna']}",
          f"- **Propozycja:** {x['propozycja']}",
          "- **Dowód przed:** " + (", ".join(f"[{os.path.basename(p)}]({p})" for p in x["dowod_przed"]) or "—"),
          "- **Dowód po:** " + (", ".join(f"[{os.path.basename(p)}]({p})" for p in x["dowod_po"]) or "—"), ""]
L += ["## Sprawdzone bez uwag", ""] + [f"- {s}" for s in d["sprawdzone_bez_uwag"]] + [""]
open(os.path.join(BASE, "defekty.md"), "w", encoding="utf-8").write("\n".join(L))
print("defekty.md:", len(items), "pozycji,", len(open_items), "otwartych")
