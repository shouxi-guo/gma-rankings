#!/bin/bash
# Download all GMA nominee/winner CSVs listed in the MOC open-data index.
# Index: https://www.bamid.gov.tw/OpenData.aspx?SN=0FBD3266D50B85F7
set -u
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw"
mkdir -p "$RAW"

INDEX="$RAW/index.json"
curl -s -A "$UA" "https://www.bamid.gov.tw/OpenData.aspx?SN=0FBD3266D50B85F7" -o "$INDEX"

# Extract "名称(URL)" pairs from the 相關檔案 field
grep -o "第[0-9]*屆金曲獎[^(]*(https://file.moc.gov.tw/[^)]*)" "$INDEX" | while IFS= read -r entry; do
  name="${entry%%(*}"
  url="${entry#*(}"; url="${url%)}"
  out="$RAW/${name}.csv"
  if [ -s "$out" ]; then echo "skip $name"; continue; fi
  code=$(curl -sL -A "$UA" --compressed "$url" -o "$out" -w "%{http_code}")
  # Cloudflare challenge pages are HTML; detect and flag
  if head -c 200 "$out" | grep -qi "<!DOCTYPE\|<html"; then
    echo "BLOCKED $name (http $code)"; mv "$out" "$out.blocked"
  else
    echo "ok $name (http $code, $(wc -c <"$out") bytes)"
  fi
  sleep 1
done
echo "DONE. files: $(ls "$RAW"/*.csv 2>/dev/null | wc -l)"
