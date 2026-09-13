#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fusionne les fiches de dégustation (fiches/*.json) dans vins.json et data.js."""
import glob, json, os, sys

base = os.path.dirname(os.path.abspath(__file__))
vins = json.load(open(os.path.join(base, "vins.json"), encoding="utf-8"))

fiches = {}
doublons = []
for f in sorted(glob.glob(os.path.join(base, "fiches", "*.json"))):
    for fiche in json.load(open(f, encoding="utf-8")):
        i = fiche["id"]
        if i in fiches:
            doublons.append(i)
        fiches[i] = fiche

manquants = []
for v in vins["vins"]:
    f = fiches.get(v["id"])
    if not f:
        manquants.append(v["id"])
        continue
    v["fiche"] = {k: f[k] for k in ("nez", "bouche", "finale", "accords", "service", "carafe", "boire")}

vins["meta"]["fiches"] = len(vins["vins"]) - len(manquants)

json.dump(vins, open(os.path.join(base, "vins.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

compact = []
for v in vins["vins"]:
    w = {k: x for k, x in v.items() if k not in ("q", "section")}
    if w.get("notes") == w.get("cepages"):
        w["notes"] = ""
    compact.append(w)
with open(os.path.join(base, "data.js"), "w", encoding="utf-8") as f:
    f.write("window.CARTE = ")
    json.dump(dict(meta=vins["meta"], vins=compact), f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("fiches rédigées : %d / %d" % (vins["meta"]["fiches"], len(vins["vins"])))
if doublons:
    print("⚠ doublons :", sorted(set(doublons)))
if manquants:
    print("reste à écrire :", manquants[0], "→", manquants[-1], "(%d)" % len(manquants))
