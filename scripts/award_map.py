# -*- coding: utf-8 -*-
"""金曲獎獎項沿革歸併表.

同一個獎在 37 屆間多次改名（如 最佳國語男演唱人獎 → 最佳國語男歌手獎 →
最佳華語男歌手獎），且同名獎項可能分屬不同軌道（流行演唱 / 演奏 / 傳統暨
藝術 / 世界華人），因此歸併鍵是 (track, 原始獎項名稱)。

track 由 build_data.py 依「來源檔名 + 獎項類別(grp)」推斷：
  trad = 傳統暨藝術音樂類（含早期「非流行音樂」）
  inst = 演奏類
  whc  = 第 8 屆「世界華人作品獎」特別軌
  pop  = 其餘（流行演唱類、技術類、特別獎）

AWARD_GROUPS: aid -> {name: 現行/最終名稱, section, lang, members: [(track, 原名)]}
未列入 members 的 (track, cat) 自動以原名自成一個獎（fallback），不會丟資料。
"""

AWARD_GROUPS = {
    # ── 年度大獎 ──────────────────────────────────────────────
    "song-of-year": {
        "name": "年度歌曲獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳年度歌曲獎"), ("pop", "最佳年度歌曲"),
                    ("pop", "年度歌曲獎")],
    },
    "album-of-year": {
        "name": "年度專輯獎", "section": "演唱類", "lang": "",
        # 第2屆的綜合「最佳專輯獎」視為年度專輯前身；18-27 屆同名獎屬演奏類，
        # 由 track=inst 另歸 inst-album，不會混入
        "members": [("pop", "最佳專輯獎"), ("pop", "年度專輯獎")],
    },
    # ── 歌手獎（語種 × 性別）──────────────────────────────────
    "singer-m-mandarin": {
        "name": "最佳華語男歌手獎", "section": "演唱類", "lang": "華語",
        "members": [("pop", "最佳男演唱人獎"), ("pop", "最佳國語歌曲男演唱人獎"),
                    ("pop", "最佳國語男演唱人獎"), ("pop", "最佳國語男歌手獎"),
                    ("pop", "最佳華語男歌手獎")],
    },
    "singer-f-mandarin": {
        "name": "最佳華語女歌手獎", "section": "演唱類", "lang": "華語",
        "members": [("pop", "最佳女演唱人獎"), ("pop", "最佳國語歌曲女演唱人獎"),
                    ("pop", "最佳國語女演唱人獎"), ("pop", "最佳國語女歌手獎"),
                    ("pop", "最佳華語女歌手獎")],
    },
    "singer-m-taiwanese": {
        "name": "最佳台語男歌手獎", "section": "演唱類", "lang": "台語",
        "members": [("pop", "最佳方言歌曲男演唱人獎"), ("pop", "最佳方言男演唱人獎"),
                    ("pop", "最佳台語男演唱人獎"), ("pop", "最佳台語男歌手獎")],
    },
    "singer-f-taiwanese": {
        "name": "最佳台語女歌手獎", "section": "演唱類", "lang": "台語",
        "members": [("pop", "最佳方言歌曲女演唱人獎"), ("pop", "最佳方言女演唱人獎"),
                    ("pop", "最佳台語女演唱人獎"), ("pop", "最佳台語女歌手獎")],
    },
    "singer-hakka": {
        "name": "最佳客語歌手獎", "section": "演唱類", "lang": "客語",
        "members": [("pop", "最佳客語演唱人獎"), ("pop", "最佳客語歌手獎")],
    },
    "singer-indigenous": {
        "name": "最佳原住民語歌手獎", "section": "演唱類", "lang": "原住民語",
        "members": [("pop", "最佳原住民語演唱人獎"), ("pop", "最佳原住民語歌手獎")],
    },
    # ── 專輯獎（語種）─────────────────────────────────────────
    "album-mandarin": {
        "name": "最佳華語專輯獎", "section": "演唱類", "lang": "華語",
        "members": [("pop", "最佳國語流行音樂演唱專輯獎"), ("pop", "最佳國語專輯獎"),
                    ("pop", "最佳華語專輯獎")],
    },
    "album-taiwanese": {
        "name": "最佳台語專輯獎", "section": "演唱類", "lang": "台語",
        "members": [("pop", "最佳台語流行音樂演唱專輯獎"), ("pop", "最佳台語專輯獎")],
    },
    "album-hakka": {
        "name": "最佳客語專輯獎", "section": "演唱類", "lang": "客語",
        "members": [("pop", "最佳客語流行音樂演唱專輯獎"), ("pop", "最佳客語專輯獎")],
    },
    "album-indigenous": {
        "name": "最佳原住民語專輯獎", "section": "演唱類", "lang": "原住民語",
        "members": [("pop", "最佳原住民語流行音樂演唱專輯獎"),
                    ("pop", "最佳原住民語專輯獎")],
    },
    "album-vocal": {  # 語種分家（16 屆起）前的演唱專輯主獎
        "name": "最佳流行音樂演唱專輯獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳演唱專輯獎"), ("pop", "最佳演唱專輯"),
                    ("pop", "最佳流行音樂演唱唱片獎"),
                    ("pop", "最佳流行音樂演唱專輯獎")],
    },
    # ── 創作/製作個人獎 ───────────────────────────────────────
    "composer": {
        "name": "最佳作曲人獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳作曲人獎")],
    },
    "lyricist": {
        "name": "最佳作詞人獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳作詞人獎"), ("pop", "最佳國語歌曲作詞人獎")],
    },
    "lyricist-dialect": {
        "name": "最佳方言歌曲作詞人獎", "section": "演唱類", "lang": "台語",
        "members": [("pop", "最佳方言歌曲作詞人獎")],
    },
    "arranger": {
        "name": "最佳編曲人獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳編曲人獎")],
    },
    "producer-album": {
        "name": "最佳專輯製作人獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳專輯製作人獎"), ("pop", "最佳演唱專輯製作人獎"),
                    ("pop", "最佳唱片製作人獎")],
    },
    "producer-single": {
        "name": "最佳單曲製作人獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳單曲製作人獎")],
    },
    "newcomer": {
        "name": "最佳新人獎", "section": "演唱類", "lang": "",
        "members": [("pop", "新人獎"), ("pop", "最佳新人獎"),
                    ("pop", "最佳演唱新人獎"), ("pop", "最佳流行音樂演唱新人獎"),
                    ("pop", "最具潛力新人獎"), ("pop", "最佳國語演唱新人獎"),
                    ("pop", "最佳台語演唱新人獎"), ("pop", "最佳客語演唱新人獎"),
                    ("pop", "最佳原住民語演唱新人獎")],
    },
    "band": {
        "name": "最佳樂團獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳樂團獎")],
    },
    "vocal-group": {
        "name": "最佳演唱組合獎", "section": "演唱類", "lang": "",
        "members": [("pop", "最佳演唱組獎"), ("pop", "最佳演唱團體獎"),
                    ("pop", "最佳重唱組合獎"), ("pop", "最佳演唱組合獎")],
    },
    # ── 演奏類 ────────────────────────────────────────────────
    "inst-album": {
        "name": "演奏類最佳專輯獎", "section": "演奏類", "lang": "",
        "members": [("pop", "最佳演奏專輯獎"), ("pop", "最佳流行音樂演奏唱片獎"),
                    ("pop", "最佳流行音樂演奏專輯獎"),
                    ("inst", "最佳流行音樂演奏專輯獎"),
                    ("inst", "最佳專輯獎"), ("inst", "演奏類最佳專輯獎")],
    },
    "inst-producer": {
        "name": "演奏類最佳專輯製作人獎", "section": "演奏類", "lang": "",
        "members": [("pop", "最佳演奏專輯製作人獎"), ("inst", "最佳專輯製作人獎"),
                    ("inst", "演奏類最佳專輯製作人獎")],
    },
    "inst-composer": {
        "name": "演奏類最佳作曲人獎", "section": "演奏類", "lang": "",
        "members": [("inst", "最佳作曲人獎"), ("inst", "演奏類最佳作曲人獎")],
    },
    # ── 技術類 ────────────────────────────────────────────────
    "mv": {
        "name": "最佳MV獎", "section": "技術類", "lang": "",
        "members": [("pop", "最佳單曲歌唱錄影帶影片獎"), ("pop", "最佳音樂錄影帶獎"),
                    ("pop", "最佳MV獎")],
    },
    "mv-director": {
        "name": "最佳音樂錄影帶導演獎", "section": "技術類", "lang": "",
        "members": [("pop", "最佳單曲歌唱錄影帶導演獎"),
                    ("pop", "最佳音樂錄影帶導演獎")],
    },
    "packaging": {
        "name": "最佳裝幀設計獎", "section": "技術類", "lang": "",
        "members": [("pop", "最佳專輯包裝獎"), ("pop", "最佳專輯裝幀設計獎"),
                    ("pop", "最佳裝幀設計獎")],
    },
    "recording-early": {
        "name": "最佳錄音獎", "section": "技術類", "lang": "",
        "members": [("pop", "最佳錄音獎")],
    },
    "recording-vocal": {
        "name": "最佳演唱錄音專輯獎", "section": "技術類", "lang": "",
        "members": [("pop", "最佳演唱錄音專輯獎")],
    },
    "recording-inst": {
        "name": "最佳演奏錄音專輯獎", "section": "技術類", "lang": "",
        "members": [("pop", "最佳演奏錄音專輯獎")],
    },
    # ── 特別獎 ────────────────────────────────────────────────
    "jury": {
        "name": "評審團獎", "section": "特別獎", "lang": "",
        "members": [("pop", "評審團獎")],
    },
    "special": {
        "name": "特別獎", "section": "特別獎", "lang": "",
        "members": [("pop", "特別獎")],
    },
    "contribution": {
        "name": "特別貢獻獎", "section": "特別獎", "lang": "",
        "members": [("pop", "特別貢獻獎")],
    },
    # ── 傳統暨藝術音樂類（第 25 屆起分家為傳藝金曲獎）──────────
    "trad-vocalist": {
        "name": "最佳演唱獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳演唱人獎"), ("trad", "最佳演唱獎")],
    },
    "trad-instrumentalist": {
        "name": "最佳演奏獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳演奏人獎"), ("trad", "最佳演奏獎")],
    },
    "trad-composer": {
        "name": "最佳作曲人獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳作曲人獎")],
    },
    "trad-arranger": {
        "name": "最佳編曲人獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳編曲人獎")],
    },
    "trad-producer": {
        "name": "最佳專輯製作人獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳專輯製作人獎"), ("trad", "最佳唱片製作人獎")],
    },
    "trad-lyricist": {
        "name": "最佳作詞人獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳作詞人獎")],
    },
    "trad-packaging": {  # 21-24 屆包裝獎流行/傳藝兩類各自評選
        "name": "最佳專輯包裝獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳專輯包裝獎")],
    },
    "trad-jury": {
        "name": "評審團獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "評審團獎")],
    },
    "trad-contribution": {
        "name": "特別貢獻獎（傳藝）", "section": "傳藝類", "lang": "",
        "members": [("trad", "特別貢獻獎")],
    },
    "trad-classical": {
        "name": "最佳古典音樂專輯獎", "section": "傳藝類", "lang": "",
        # 8-10 屆「唱片獎」時期 grp 未標非流行，track 判為 pop，一併收於此
        "members": [("trad", "最佳古典音樂唱片獎"), ("pop", "最佳古典音樂唱片獎"),
                    ("trad", "最佳古典音樂專輯獎")],
    },
    "trad-ethnic": {
        "name": "最佳民族音樂專輯獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳民族樂曲唱片獎"), ("pop", "最佳民族樂曲唱片獎"),
                    ("trad", "最佳民族樂曲專輯獎"),
                    ("trad", "最佳傳統音樂專輯獎"), ("trad", "最佳民族音樂專輯獎")],
    },
    "trad-song-art": {
        "name": "最佳傳統歌樂專輯獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳傳統歌樂專輯獎")],
    },
    "trad-interpretation": {
        "name": "最佳傳統音樂詮釋獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳傳統音樂詮釋獎")],
    },
    "trad-opera": {
        "name": "最佳戲曲曲藝專輯獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳地方戲劇唱片獎"), ("pop", "最佳地方戲劇唱片獎"),
                    ("trad", "最佳民俗曲藝唱片獎"), ("pop", "最佳民俗曲藝唱片獎"),
                    ("trad", "最佳地方戲劇專輯獎"), ("trad", "最佳民俗曲藝專輯獎"),
                    ("trad", "最佳戲曲曲藝專輯獎")],
    },
    "trad-children": {
        "name": "最佳兒童音樂專輯獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳兒童樂曲（故事）唱片獎"),
                    ("pop", "最佳兒童樂曲（故事）唱片獎"),
                    ("trad", "最佳兒童樂曲專輯獎"), ("trad", "最佳兒童音樂專輯獎")],
    },
    "trad-spoken": {
        "name": "最佳口語說講唱片獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳口語說講唱片獎"), ("pop", "最佳口語說講唱片獎")],
    },
    "trad-religious": {
        "name": "最佳宗教音樂專輯獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳宗教音樂專輯獎")],
    },
    "crossover": {
        "name": "最佳跨界音樂專輯獎", "section": "傳藝類", "lang": "",
        "members": [("trad", "最佳跨界音樂專輯獎"), ("pop", "最佳跨界音樂專輯獎")],
    },
    # ── 第 8 屆世界華人作品獎（一次性）────────────────────────
    "whc-singer-m": {
        "name": "最佳男演唱人獎（世界華人）", "section": "特別獎", "lang": "",
        "members": [("whc", "最佳男演唱人獎")],
    },
    "whc-singer-f": {
        "name": "最佳女演唱人獎（世界華人）", "section": "特別獎", "lang": "",
        "members": [("whc", "最佳女演唱人獎")],
    },
    "whc-composer": {
        "name": "大陸作曲人獎", "section": "特別獎", "lang": "",
        "members": [("whc", "大陸作曲人獎"), ("pop", "大陸作曲人獎")],
    },
    "whc-vocal": {
        "name": "大陸演唱人獎", "section": "特別獎", "lang": "",
        "members": [("whc", "大陸演唱人獎"), ("pop", "大陸演唱人獎")],
    },
    "whc-inst": {
        "name": "大陸演奏人獎", "section": "特別獎", "lang": "",
        "members": [("whc", "大陸演奏人獎"), ("pop", "大陸演奏人獎")],
    },
    "whc-performer": {
        "name": "最佳演奏人獎（世界華人）", "section": "特別獎", "lang": "",
        "members": [("whc", "最佳演奏人獎")],
    },
}


def build_lookup():
    """(track, cat) -> aid"""
    lookup = {}
    for aid, g in AWARD_GROUPS.items():
        for track, cat in g["members"]:
            key = (track, cat)
            if key in lookup:
                raise ValueError(f"duplicate member {key}: {lookup[key]} / {aid}")
            lookup[key] = aid
    return lookup
