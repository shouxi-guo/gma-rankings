# -*- coding: utf-8 -*-
"""Merge per-edition GMA nominee/winner CSVs into docs/data/gma.json.

Input : data/raw/第N屆金曲獎入圍名單.csv / 第N屆金曲獎得獎名單.csv
        columns: 年度,屆別,獎項名稱,{入圍|得獎}作品,{入圍|得獎}單位/者,報名單位
Output: docs/data/gma.json  {meta, records:[{e,y,cat,work,who,unit,win}]}
"""
import csv, json, re, sys, io
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "docs" / "data" / "gma.json"


def read_csv(path):
    data = path.read_bytes()
    for enc in ("utf-8-sig", "cp950", "big5"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"cannot decode {path}")
    rows = list(csv.reader(io.StringIO(text)))
    return [r for r in rows if any(c.strip() for c in r)]


def norm(s):
    return re.sub(r"\s+", "", s or "")


def parse_rows(path, kind):
    """kind: 'nom' or 'win'. Yields dicts.

    Header variants across editions:
      年度,屆別,獎項名稱,{入圍|得獎}作品,{入圍|得獎}單位/者,報名單位
      年度,屆別,獎項類別,獎項名稱,...,報名單位[,演唱者/演奏者/導演[/錄音團隊]]
    """
    rows = read_csv(path)
    header = [norm(h) for h in rows[0]]
    if not any("獎項" in h for h in header):
        raise ValueError(f"{path.name}: unexpected header {rows[0]}")

    def col(*needles):
        for i, h in enumerate(header):
            if any(n in h for n in needles):
                return i
        return None

    c_roc, c_ed = col("年度"), col("屆別")
    c_grp, c_cat = col("獎項類別"), col("獎項名稱")
    c_work, c_who = col("作品"), col("單位/者")
    c_unit, c_perf = col("報名單位"), col("演唱者", "演奏者")

    def get(r, i):
        return r[i].strip() if i is not None and i < len(r) else ""

    for r in rows[1:]:
        cat = get(r, c_cat)
        if not cat:
            continue
        roc_s = re.sub(r"\D", "", get(r, c_roc))
        ed_s = re.sub(r"\D", "", get(r, c_ed))
        if not ed_s:  # derive edition from filename (e.g. vacant-award rows)
            m = re.search(r"第(\d+)屆", path.name)
            ed_s = m.group(1) if m else ""
        if not ed_s:
            print(f"  skip bad row in {path.name}: {r}", file=sys.stderr)
            continue
        edition = int(ed_s)
        # 1st GMA was 1990 (ROC 79); year = ROC+1911, or derived from edition
        year = int(roc_s) + 1911 if roc_s else edition + 1989
        rec = {"e": edition, "y": year, "cat": cat, "work": get(r, c_work),
               "who": get(r, c_who), "unit": get(r, c_unit), "kind": kind}
        grp, perf = get(r, c_grp), get(r, c_perf)
        if grp:
            rec["grp"] = grp
        if perf:
            rec["perf"] = perf
        yield rec


def main():
    # editions 1-19: 第N屆金曲獎入圍名單; 20+: 第N屆金曲獎流行音樂類入圍名單
    nom_files = sorted(RAW.glob("第*屆金曲獎*入圍名單.csv"))
    win_files = sorted(RAW.glob("第*屆金曲獎*得獎名單.csv"))
    if not nom_files and not win_files:
        sys.exit("no raw CSVs found; run scripts/download_raw.sh first")

    records = []          # final list
    index = {}            # lookup keys -> record, for winner matching
    editions = {}

    def keys(rec):
        e, cat = rec["e"], norm(rec["cat"])
        yield (e, cat, norm(rec["work"]), norm(rec["who"]))
        yield (e, cat, norm(rec["who"]))
        if rec["work"]:
            yield (e, cat, "W:" + norm(rec["work"]))

    for f in nom_files:
        for rec in parse_rows(f, "nom"):
            rec["win"] = False
            del rec["kind"]
            records.append(rec)
            editions.setdefault(rec["e"], rec["y"])
            for k in keys(rec):
                index.setdefault(k, rec)

    unmatched = 0
    for f in win_files:
        for rec in parse_rows(f, "win"):
            editions.setdefault(rec["e"], rec["y"])
            hit = None
            for k in keys(rec):
                if k in index:
                    hit = index[k]
                    break
            if hit is not None and not hit["win"]:
                hit["win"] = True
                # winner file sometimes has fuller name; prefer nominee text
            else:
                # winner with no nominee row (early editions had no公示入围)
                rec["win"] = True
                del rec["kind"]
                records.append(rec)
                for k in keys(rec):
                    index.setdefault(k, rec)
                unmatched += 1

    records.sort(key=lambda r: (r["e"], r["cat"], not r["win"], r["who"]))
    out = {
        "meta": {
            "source": "文化部影視及流行音樂產業局開放資料（流行音樂金曲獎歷屆得獎入圍名單）",
            "sourceUrl": "https://data.gov.tw/dataset/58037",
            "generated": date.today().isoformat(),
            "editions": {str(k): v for k, v in sorted(editions.items())},
        },
        "records": records,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")

    wins = sum(1 for r in records if r["win"])
    cats = len({r["cat"] for r in records})
    print(f"editions: {len(editions)} ({min(editions)}-{max(editions)})")
    print(f"records: {len(records)}  wins: {wins}  categories: {cats}")
    print(f"winner rows without nominee match (added as win-only): {unmatched}")
    print(f"wrote {OUT} ({OUT.stat().st_size//1024} KB)")


if __name__ == "__main__":
    main()
