# 金曲獎資料庫 GMA Rankings

非官方的台灣金曲獎歷屆入圍/得獎紀錄查詢網站，靈感來自 [CSRankings](https://csrankings.org)。
純靜態站，無後端、無構建步驟，支援簡繁切換與簡繁互搜。

## 使用

```bash
cd docs && python -m http.server 8000
# 打開 http://localhost:8000
```

## 目錄結構

- `docs/` — 靜態網站（index.html / app.js / style.css / t2s.js / data/gma.json）
- `data/raw/` — 官方開放資料原始 CSV（第 1–35 屆）
- `data/manual/` — 官方開放資料未覆蓋的屆次（第 36/37 屆，自維基百科解析）
- `scripts/download_raw.sh` — 下載官方開放資料 CSV
- `scripts/parse_wiki.py` — 解析維基百科第 36/37 屆條目 → 官方同格式 CSV
- `scripts/award_map.py` — 獎項沿革歸併表（(軌道, 原始獎名) → 規範獎項）
- `scripts/build_data.py` — 清洗合併全部 CSV → `docs/data/gma.json`
- `scripts/gen_t2s.py` — 生成繁→簡字表 `docs/t2s.js`（OpenCC）

資料更新流程：

```bash
bash scripts/download_raw.sh          # 官方 CSV（1-35 屆，之後官方更新會自動多出新屆）
python scripts/parse_wiki.py          # 36/37 屆（需先把維基 wikitext 存到 data/manual/gmaNN.wiki）
python scripts/build_data.py          # 合併 → docs/data/gma.json
python scripts/gen_t2s.py             # 繁簡字表
```

## 獎項沿革歸併

同一獎項 37 屆間多次改名（最佳國語男演唱人獎 → 最佳國語男歌手獎 → 最佳華語男歌手獎），
且同名獎項可能分屬不同軌道（流行演唱／演奏／傳統暨藝術／世界華人，如 18–27 屆「最佳專輯獎」
實為演奏類專輯獎）。`scripts/award_map.py` 以 (軌道, 原始獎名) 雙鍵把 110 個原始獎名歸併為
58 個規範獎項；軌道由來源檔名＋「獎項類別」欄位推斷。完整沿革可在網站「獎項沿革」頁查看。

驗證錨點：歸併後最佳華語男歌手獎沿革中殷正洋、陳奕迅各 3 冠，與維基百科記載一致；
第 36/37 屆入圍作品數（169/167 件）與官方公告一致。

## 資料來源

- 第 1–35 屆：[文化部影視及流行音樂產業局開放資料](https://data.gov.tw/dataset/58037)（政府資料開放授權條款第 1 版）
- 第 36/37 屆：維基百科[第36屆](https://zh.wikipedia.org/wiki/第36屆金曲獎)/[第37屆金曲獎](https://zh.wikipedia.org/wiki/第37屆金曲獎)條目（CC BY-SA 4.0），官方開放資料更新後可替換

## 已知限制

- 未做實體消歧：同一人的本名/藝名（江淑惠（江蕙））、公司改名（風潮有聲→風潮音樂）視為不同字串。
- 排行榜把 who 與 perf（演唱/演奏者）拆分計入個人，專輯類獎項會同時給唱片公司與歌手記一筆。
- 簡繁轉換為字級映射（OpenCC t2s），極少數多字詞轉換可能不精準。

本站為非官方資料整理，與主辦單位無關。
