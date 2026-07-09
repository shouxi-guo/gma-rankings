# 金曲獎資料庫 GMA Rankings

非官方的台灣金曲獎（流行音樂類）歷屆入圍/得獎紀錄查詢網站，靈感來自 [CSRankings](https://csrankings.org)。
純靜態站，無後端、無構建步驟。

## 使用

```bash
cd docs && python -m http.server 8000
# 打開 http://localhost:8000
```

## 目錄結構

- `docs/` — 靜態網站（index.html / app.js / style.css / data/gma.json）
- `data/raw/` — 官方開放資料原始 CSV（第 1–35 屆，入圍+得獎各一份）
- `scripts/download_raw.sh` — 從文化部開放資料下載原始 CSV
- `scripts/build_data.py` — 清洗合併 CSV 生成 `docs/data/gma.json`

## 資料來源

[文化部影視及流行音樂產業局開放資料：流行音樂金曲獎歷屆得獎入圍名單](https://data.gov.tw/dataset/58037)（政府資料開放授權條款第 1 版）。

資料更新流程：`bash scripts/download_raw.sh && python scripts/build_data.py`

## 已知限制（v1）

- 官方開放資料僅到第 35 屆（2024）；第 36/37 屆需另行從官方公告補入。
- 未做實體消歧：同一人的本名/藝名/團體身份視為不同字串；專輯類獎項的 `who`
  多為唱片公司，歌手在 `perf`（演唱者）欄位，排行榜按 `who` 聚合會低估歌手的專輯類得獎。
- 第 20 屆前的「傳統暨藝術音樂類」獎項與流行類混列（當年同屬金曲獎）。

本站為非官方資料整理，與主辦單位無關。
