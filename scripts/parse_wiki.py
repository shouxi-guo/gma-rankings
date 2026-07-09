# -*- coding: utf-8 -*-
"""Parse zh.wikipedia wikitext of recent GMA editions (36th, 37th) into CSVs
matching the official open-data format, written to data/manual/.

Column semantics are derived from each wikitable's header row, since layouts
vary per award and per edition.

Input : data/manual/gma36.wiki, gma37.wiki (raw wikitext, action=raw)
Output: data/manual/第N屆金曲獎流行音樂類入圍名單.csv / 得獎名單.csv
"""
import csv, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANUAL = ROOT / "data" / "manual"

EDITIONS = {36: 114, 37: 115}  # edition -> ROC year

# section heading -> official 獎項類別 value (as used in 35th official CSV)
SECTION_GRP = {
    "演唱類【出版獎】": "演唱類出版獎",
    "演唱類【個人獎】": "演唱類個人獎",
    "演奏類【出版獎】": "演奏類出版獎",
    "演奏類【個人獎】": "演奏類個人獎",
    "技術類【出版獎】": "技術類出版獎",
    "技術類【個人獎】": "技術類個人獎",
}

AWARD_NAMES = {
    "年度專輯獎", "年度歌曲獎", "最佳華語專輯獎", "最佳台語專輯獎",
    "最佳客語專輯獎", "最佳原住民語專輯獎", "最佳作曲人獎", "最佳作詞人獎",
    "最佳編曲人獎", "最佳專輯製作人獎", "最佳單曲製作人獎",
    "最佳華語男歌手獎", "最佳華語女歌手獎", "最佳台語男歌手獎",
    "最佳台語女歌手獎", "最佳客語歌手獎", "最佳原住民語歌手獎",
    "最佳樂團獎", "最佳演唱組合獎", "最佳新人獎",
    "演奏類最佳專輯獎", "演奏類最佳專輯製作人獎", "演奏類最佳作曲人獎",
    "最佳MV獎", "最佳演唱錄音專輯獎", "最佳演奏錄音專輯獎", "最佳裝幀設計獎",
}
# level-3 sections that are themselves awards (winner-only tables)
SPECIAL_AWARDS = {"評審團獎", "特別貢獻獎"}

WINNER_MARK = "Yellow Dots"


def sem_of(header):
    """Map a table header cell to a semantic column name."""
    h = re.sub(r"[\s]", "", header)
    if not h:
        return ""
    if ("入圍者／作品" in h or "入圍者/作品" in h):
        return "whowork"
    if "演唱" in h and "專輯" in h:
        return "singeralbum"
    if "演奏" in h and "專輯" in h and ("／" in h or "/" in h):
        return "playeralbum"
    if "歌曲" in h:
        return "song"
    if "收錄專輯" in h:
        return "album2"
    if "專輯" in h:
        return "album"
    if "導演" in h:
        return "director"
    if "錄音" in h:
        return "recorder"
    if "入圍者" in h or "得獎者" in h:
        return "who"
    if "作品" in h:
        return "workx"
    if "作曲" in h:
        return "composer"
    if "作詞" in h:
        return "lyricist"
    if "演唱" in h:
        return "singer"
    if "演奏" in h:
        return "player"
    if "報名單位" in h:
        return "unit"
    return ""


def strip_markup(text):
    t = text
    t = re.sub(r"<ref[^>]*/>", "", t)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"</?(small|big|span|center|div)[^>]*>", "", t)
    t = re.sub(r"<br\s*/?>", "、", t)
    t = re.sub(r"\[\[File:[^\]]*\]\]", "", t)
    for _ in range(4):  # nested templates
        t = re.sub(r"\{\{(?:[Nn]owrap|[Bb]ox)\|([^{}]*)\}\}", r"\1", t)
    t = re.sub(r"\{\{wbr\}\}", "", t)
    t = re.sub(r"-\{([^{}]*)\}-", r"\1", t)  # {-zh variant-} markers
    t = re.sub(r"\{\{[^{}]*\}\}", "", t)  # drop any remaining templates

    def link(m):
        target, disp = m.group(1).strip(), m.group(2).strip()
        # [[蔡依林|JOLIN蔡依林]] -> 蔡依林 (canonical, matches official CSVs);
        # [[旺福|姚小民]] (member linked to band) keeps the display text
        if target and "(" not in target and "（" not in target and target in disp:
            return target
        return disp

    t = re.sub(r"\[\[([^|\]]*)\|([^\]]*)\]\]", link, t)
    t = re.sub(r"\[\[([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"'''?", "", t)
    t = re.sub(r"\s+", " ", t).strip().lstrip("|").strip()
    # <br> inside a wrapped company name became 、 — rejoin before 公司 suffixes
    return re.sub(r"、(?=(股份)?有限公司)", "", t)


def strip_style(cell):
    """Drop leading style=...| / width=...| attribute prefix of a table cell."""
    m = re.match(r'^\s*[a-zA-Z-]+\s*=\s*"[^"]*"\s*(?:[a-zA-Z-]+\s*=\s*"[^"]*"\s*)*\|(?!\|)', cell)
    return cell[m.end():] if m else cell


def unquote(s, open_q, close_q):
    s = (s or "").strip()
    if s.startswith(open_q) and s.endswith(close_q):
        return s[1:-1].strip()
    return s


def parse_tables(wikitext):
    """Yield (award_name, grp, sems, rows) where rows = [(is_winner, cells)]."""
    cur_grp = ""
    heads = list(re.finditer(r"^(={3,4})\s*(.*?)\s*={3,4}\s*$", wikitext, re.M))
    for i, m in enumerate(heads):
        level, title = len(m.group(1)), m.group(2)
        lm = re.match(r"\[\[([^|\]]*?)(?:[\s_]*\(金曲獎\))?\|[^\]]*\]\]$", title)
        name = lm.group(1) if lm else re.sub(r"\[\[|\]\]", "", title)
        name = name.replace("金曲獎最佳MV獎", "最佳MV獎").replace("_", "").strip()
        if level == 3 and name not in SPECIAL_AWARDS:
            cur_grp = SECTION_GRP.get(name, "")
            continue
        grp = name if level == 3 else cur_grp  # special awards: 獎項類別 = 獎項名稱
        if name not in AWARD_NAMES and name not in SPECIAL_AWARDS:
            continue
        body = wikitext[m.end(): heads[i + 1].start() if i + 1 < len(heads) else len(wikitext)]
        tm = re.search(r"\{\|.*?\|\}", body, re.S)
        if not tm:
            continue
        sems, rows = [], []
        for block in re.split(r"\n\|-[^\n]*", tm.group(0))[1:]:
            block = block.strip()
            if not block or block.startswith("|}"):
                continue
            if block.startswith("!"):
                hdr = re.sub(r"\s*\n!(?![-}])", "!!", block).replace("\n", " ")
                cells = [strip_style(c) for c in hdr.lstrip("!").split("!!")]
                sems = [sem_of(strip_markup(c)) for c in cells]
                continue
            body_txt = block.split("\n|}")[0].strip()
            # a newline starting with a single "|" begins a new cell
            joined = re.sub(r"\s*\n\|(?![-}])", "||", body_txt)
            # strip exactly ONE leading pipe: "|||A" means empty marker cell + A
            joined = re.sub(r"^\|", "", joined.replace("\n", " ").strip())
            cells = [strip_style(c) for c in joined.split("||")]
            if len(cells) < 2:
                continue
            win = WINNER_MARK in cells[0]
            data = [strip_markup(c) for c in cells[1:]]
            rows.append((win, data))
        if name in SPECIAL_AWARDS and not any(w for w, _ in rows):
            continue  # e.g. the jury-committee table under a same-named heading
        yield name, grp, sems[1:] if sems else [], rows


def to_record(award, sems, data):
    """Map wiki cells to official CSV fields. Returns (work, who, unit, perf)."""
    v = {}
    for sem, val in zip(sems, data):
        if sem and sem not in v:
            v[sem] = val.strip()

    song = unquote(v.get("song", ""), "〈", "〉")
    song = unquote(song, "《", "》")
    album = unquote(v.get("album", ""), "《", "》")
    album2 = unquote(v.get("album2", ""), "《", "》")
    who = v.get("who", "")
    singer = v.get("singer", "")
    player = v.get("player", "")

    if "whowork" in v:  # 「人名／作品」combined cell
        parts = v["whowork"].split("／", 1)
        who = parts[0].strip()
        w = parts[1].strip() if len(parts) > 1 else ""
        wm = re.match(r"^〈?([^《〉]*)〉?\s*《([^》]*)》$", w)
        if wm and wm.group(1).strip():
            song, album2 = wm.group(1).strip(), wm.group(2).strip()
        else:
            album = album or unquote(w, "《", "》")
    sa = v.get("singeralbum", "") or v.get("playeralbum", "")
    if sa:
        parts = sa.split("／", 1)
        name = parts[0].strip()
        if "playeralbum" in v:
            player = player or name
        else:
            singer = singer or name
        if len(parts) > 1 and not (album or album2):
            album2 = unquote(parts[1], "《", "》")
    if "workx" in v:  # generic 入圍作品: song, or 《album》, or song《album》
        w = v["workx"].strip()
        wm = re.match(r"^〈?([^《〉]*)〉?\s*《([^》]*)》$", w)
        if wm and wm.group(1).strip():
            song, album2 = song or wm.group(1).strip(), album2 or wm.group(2).strip()
        elif w.startswith("《"):
            album = album or unquote(w, "《", "》")
        else:
            song = song or w

    work = f"{song}《{album2}》" if song and album2 else (song or album or album2)

    perf_bits = []
    if v.get("director"):
        perf_bits.append(f"導演：{v['director']}")   # official MV rows: director only
    elif award != "最佳裝幀設計獎":                   # official 裝幀 rows: empty perf
        if v.get("recorder"):
            r = v["recorder"]
            perf_bits.append(r if "人員" in r or "：" in r else f"錄音人員：{r}")
        if singer:
            perf_bits.append(f"演唱者：{singer}")
        if player:
            perf_bits.append(f"演奏者：{player}")
        if v.get("composer"):
            perf_bits.append(f"作曲人：{v['composer']}")
        if v.get("lyricist"):
            perf_bits.append(f"作詞人：{v['lyricist']}")
    perf = "／".join(perf_bits)

    unit = v.get("unit", "")
    if not who:
        who = unit  # 出版獎: official recipient is the registering label
    return work, who, unit, perf


def main():
    header = ["年度", "屆別", "獎項類別", "獎項名稱", "入圍作品",
              "入圍單位/者", "報名單位", "演唱者/演奏者/導演/錄音團隊"]
    win_header = [h.replace("入圍", "得獎", 1) if i in (4, 5) else h
                  for i, h in enumerate(header)]

    for ed, roc in EDITIONS.items():
        src = MANUAL / f"gma{ed}.wiki"
        if not src.exists():
            print(f"skip edition {ed}: {src} missing")
            continue
        wikitext = src.read_text(encoding="utf-8")
        noms, wins, seen_awards = [], [], []
        for award, grp, sems, rows in parse_tables(wikitext):
            n_win = 0
            for win, data in rows:
                work, who, unit, perf = to_record(award, sems, data)
                if not who and not work:
                    continue
                rec = [str(roc), str(ed), grp, award, work, who, unit, perf]
                noms.append(rec)
                if win:
                    wins.append(rec)
                    n_win += 1
            seen_awards.append((award, len(rows), n_win))

        nom_path = MANUAL / f"第{ed}屆金曲獎流行音樂類入圍名單.csv"
        win_path = MANUAL / f"第{ed}屆金曲獎流行音樂類得獎名單.csv"
        with nom_path.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f); w.writerow(header); w.writerows(noms)
        with win_path.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f); w.writerow(win_header); w.writerows(wins)

        print(f"=== 第{ed}屆: {len(seen_awards)} awards, "
              f"{len(noms)} nominee rows, {len(wins)} winner rows ===")
        for award, n, nw in seen_awards:
            flag = "" if nw == 1 or award == "特別貢獻獎" else f"  <-- {nw} winners!"
            print(f"  {award}: {n} rows, {nw} win{flag}")


if __name__ == "__main__":
    main()
