# 每日晨間新聞彙整追蹤

公開網頁，彙整團隊每日開盤前的國際、社會、天象與市場重點，方便內部與外部用手機直向閱讀。

- 網站：https://peasema.github.io/
- 原始碼：https://github.com/peasema/peasema.github.io（`main` 分支根目錄即 GitHub Pages 來源）

## 頁面怎麼運作

`index.html` 會以 `fetch('./data/briefs.json', { cache: 'no-store' })` 讀取資料，依日期下拉選單顯示當日總結、四面總覽，以及預設收合的細項。燈號依台股慣例：

| tone 值 | 顏色 | 意義 |
|---|---|---|
| `bull` | 紅 | 偏多／上漲 |
| `warning` | 黃 | 謹慎／中性／波動大 |
| `bear` | 綠 | 偏空／下跌 |

頂層欄位 `summaryTone` 與各面向、各細項的 `tone` 都使用同一組值。

## 如何追加某一天的晨間彙整

只更新 `data/briefs.json`，不要另開新頁。這個檔案是**純 JSON 陣列**，**最新日期放在最前面**。

每日早班建議流程：

1. 用 GitHub API / MCP 的 `get_file_contents` 讀取 `peasema/peasema.github.io` 的 `data/briefs.json`（`ref` 設為 `main`），記下回傳的 blob SHA。
2. 把當天物件插入陣列第 0 筆（若該日期已存在則覆寫，不要重複）。
3. 用 `create_or_update_file` 寫回同一個路徑，`branch` 為 `main`，並帶上剛才的 SHA。

新增一筆時請包含：

- `date`：`YYYY-MM-DD`
- `weekday`：例如 `週四`
- `summary`：一句總結
- `summaryTone`：`bull` / `warning` / `bear`
- `domains`：四個面向，建議依序為國際面、社會面、天象面、市場指標。每個面向包含 `id`、`icon`、`name`、`source`、`direction`、`tone`、`summary`、`keyFigures`，以及 `items` 陣列。
- 每則 `items` 包含 `title`、`tone`、`detail`，以及可選的 `notes`（字串陣列，會以縮排細項顯示）。

本頁僅供彙整與查閱，不構成投資建議。
