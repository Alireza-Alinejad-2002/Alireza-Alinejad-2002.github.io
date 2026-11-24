"""Collapse an audit-*.csv (one row per component instance) to one row per source file.

usage: python summarize-audit.py out/audit-fm13.csv [--root D:/Programming/SolidWorks/Dragonfly/FM13]
Writes <csv>.files.csv next to the input and prints a compact table.
"""
import argparse
import csv
from collections import Counter, OrderedDict
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--root", default="")
    a = ap.parse_args()
    rows = list(csv.DictReader(open(a.csv, encoding="utf-8-sig")))
    files: "OrderedDict[str, dict]" = OrderedDict()
    for r in rows:
        f = files.setdefault(r["file"], dict(r, n=0, sup=Counter(), hidden=0, names=[]))
        f["n"] += 1
        f["sup"][r["suppression"]] += 1
        f["hidden"] += r["hidden"] == "yes"
        f["names"].append(r["component"].split("/")[-1])
    root = a.root.replace("/", "\\").rstrip("\\") + "\\" if a.root else ""
    out = Path(a.csv).with_suffix(".files.csv")
    with open(out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "kind", "instances", "suppression", "hidden", "imported", "imported_features", "author", "example_instance"])
        for i, (p, f) in enumerate(files.items(), 1):
            rel = p[len(root):] if root and p.lower().startswith(root.lower()) else p
            sup = " ".join(f"{k}:{v}" for k, v in f["sup"].items())
            w.writerow([rel, f["kind"], f["n"], sup, f["hidden"], f["imported"], f["imported_features"], f["author"], f["names"][0]])
            print(f"{i:>2}. {f['n']:>3}x {f['kind']:<5} imp={f['imported'] or '-':<3} hid={f['hidden']:<2} {sup:<22} {rel}"
                  + (f"  [{f['imported_features'][:50]}]" if f["imported"] == "yes" else "")
                  + (f"  author={f['author']}" if f["author"] else ""))
    print(f"\n{len(rows)} instances, {len(files)} files -> {out}")


if __name__ == "__main__":
    main()
