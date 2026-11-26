# 每日資訊早晚報

公開網頁，彙整平日早晨與晚間的國際、社群、天象、股市四方情報，用手機直向或桌面螢幕往下讀。

- 網站：https://peasema.github.io/
- 原始碼：https://github.com/peasema/peasema.github.io（`main` 分支根目錄即 GitHub Pages 來源，沒有建置步驟）

## 頁面怎麼運作

`index.html` 只放版面骨架。樣式在 `assets/css/app.css`，行為拆在 `assets/js/`：

| 檔案 | 職責 |
|---|---|
| `format.js` | 時區、漲跌著色、社群用詞、日期分組 |
| `normalize.js` | 把 `data/briefs.json` 收成穩定形狀，缺欄位不會讓頁面中斷 |
| `match.js` | 關鍵字比對 |
| `render.js` | 只用 DOM API 畫出這一期（不用 `innerHTML`） |
| `app.js` | 載入、主題、時段切換、捲動定位、搜尋 |

資料以 `fetch("data/briefs.json?t=" + Date.now(), { cache: "no-store" })` 讀取。早晚班直接推上 `main` 後，重新整理就會看到新檔，不會卡在瀏覽器快取。

外觀可切換淺色／深色，選擇記在 `localStorage`（`brief-theme`）。第一次開啟時跟隨系統；沒有系統偏好則用淺色編輯風。

## 閱讀慣例

四個面向用色條區分：國際藍、社群琥珀、天象紫、股市青綠。

漲跌數字（`+2.50%`、`-956` 這類帶正負號的百分比或點數）依台股慣例：**紅漲、綠跌**。資料裡的 `tone` 沿用既有對應，不是英文語意：

| `tone` | 顏色 | 意義 |
|---|---|---|
| `danger` 或舊稱 `bull` | 紅 | 偏多／上漲 |
| `warning` | 黃 | 謹慎／中性／波動 |
| `success` 或舊稱 `bear` | 綠 | 偏空／下跌 |

社群面只顯示「安定、偏安定、中性、偏分裂、分裂」。若資料誤寫成多空用語，頁面會改寫成這五段，不會把「偏空」畫在社群徽章上。徽章顏色走琥珀濃淡，不用紅漲綠跌。

`dailyReview` 沒有實質內容（空陣列、缺欄，或內容是「無」）時，頁尾顯示「今日無實質修正項目」。

## 資料格式

`data/briefs.json` 維持現在這個物件，**不要改回純陣列，也不要另開新頁**：

```json
{
  "updatedAt": "2026-11-26T21:38:00+08:00",
  "defaultId": "2026-11-26-evening",
  "briefs": []
}
```

`briefs` 最新一筆放最前面。每一筆使用這些欄位：

- `id`：`YYYY-MM-DD-morning` 或 `YYYY-MM-DD-evening`
- `date`、`weekday`、`session`（`morning` / `evening`）、`sessionLabel`
- `summaryLead`、`summary`、`summaryTone`
- `rhNote`：整期查核說明，可省略
- `domains`：建議依序為國際、社群、天象、股市。每面含 `id`（`world` / `social` / `astro` / `market`）、`heading`、`shortName`、`direction`、`tone`、`keyMetric`、`rh`、`facts`（`label` / `value`）、`highlights`、`details`
- 股市若有表，放在 `table.columns` 與 `table.rows`；`漲跌幅` 欄會套紅漲綠跌，`標註` 裡的漲停／跌停亦然
- `dailyReview`：`unit`、`gap`（現象／落差）、`fix`（修正方法）。沒有檢討就給 `[]`

頁面也容忍舊形狀：頂層純陣列、`name` / `items` / `keyFigures` / `source`、`tone` 用 `bull` / `bear`、檢討寫成「無」。缺欄位會略過，不會整頁空白。

每日寫入仍只改這個檔：

1. 讀取 `peasema/peasema.github.io` 的 `data/briefs.json`（`ref` 為 `main`），記下 blob SHA。
2. 把當期物件插入 `briefs` 第 0 筆；同一 `id` 已存在就覆寫，不要重複。保留 `updatedAt`（`+08:00`）與 `defaultId`。
3. 寫回同一路徑、同一分支，帶上剛才的 SHA。

本頁僅供彙整與查閱，不構成投資建議。

## 驗證

```bash
node scripts/verify.mjs
```

會檢查腳本語法、JSON 能否正規化、社群用詞、紅漲綠跌，以及缺欄位與舊格式不會拋錯。
