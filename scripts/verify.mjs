import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else acc.push(path);
  }
  return acc;
}

const jsFiles = walk(join(root, "assets/js")).filter((path) => path.endsWith(".js"));
assert(jsFiles.length >= 5, "expected modular scripts under assets/js");

for (const path of jsFiles) {
  const check = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (check.status !== 0) fail(`${relative(root, path)} failed syntax check\n${check.stderr}`);
  const source = readFileSync(path, "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/[&](?:amp|lt|gt|quot|#39|#x27);/.test(code)) {
    fail(`${relative(root, path)} contains an HTML entity`);
  }
  if (/\binnerHTML\b|\bouterHTML\b|\binsertAdjacentHTML\b|\bdocument\.write\b/.test(code)) {
    fail(`${relative(root, path)} builds markup from HTML strings`);
  }
}

const html = readFileSync(join(root, "index.html"), "utf8");
assert(html.includes("每日資訊早晚報"), "title missing from index.html");
assert(html.includes('src="assets/js/app.js'), "index.html does not load the module");
assert(html.includes('href="assets/css/app.css'), "index.html does not load the stylesheet");
assert(!html.includes("function render"), "index.html still contains the old renderer");
for (const id of ["domain-world", "domain-social", "domain-astro", "domain-market", "review"]) {
  assert(html.includes(`#${id}`), `missing jump target #${id}`);
}

const css = readFileSync(join(root, "assets/css/app.css"), "utf8");
for (const token of ["--world", "--social", "--astro", "--market", "--up", "--down", "data-theme"]) {
  assert(css.includes(token), `stylesheet missing ${token}`);
}
assert(css.includes('"Inter"'), "stylesheet is missing Inter");
assert(!/\bserif\b/.test(css.replace(/sans-serif/g, "")), "stylesheet still names a serif family");
assert(html.includes("fonts.googleapis.com") && html.includes("display=swap"), "Google Fonts stylesheet missing");
assert(html.includes("Noto+Sans+TC"), "Noto Sans TC is not loaded");

const format = await import(pathToFileURL(join(root, "assets/js/format.js")).href);
const normalize = await import(pathToFileURL(join(root, "assets/js/normalize.js")).href);
const match = await import(pathToFileURL(join(root, "assets/js/match.js")).href);
await import(pathToFileURL(join(root, "assets/js/render.js")).href);

assert(format.normalizeTone("danger") === "up", "danger should be red/up");
assert(format.normalizeTone("bull") === "up", "bull should be red/up");
assert(format.normalizeTone("success") === "down", "success should be green/down");
assert(format.normalizeTone("bear") === "down", "bear should be green/down");
assert(format.normalizeTone("warning") === "mid", "warning should be mid");

for (const [raw, expected] of [
  ["偏分裂", "偏分裂"],
  ["分裂", "分裂"],
  ["安定", "安定"],
  ["偏安定", "偏安定"],
  ["中性", "中性"],
  ["偏空", "偏分裂"],
  ["偏多", "偏安定"],
  ["看空", "偏分裂"],
  ["看多", "偏安定"],
  ["空", "分裂"],
  ["多", "安定"],
  ["bull", "偏安定"],
  ["bear", "偏分裂"],
]) {
  const label = format.socialDirectionLabel(raw);
  assert(label === expected, `social label ${raw} -> ${label}, expected ${expected}`);
  assert(!/[多空]/.test(label), `social label still has a market term: ${label}`);
}
assert(format.directionLabel({ id: "market", direction: "偏空" }) === "偏空", "market keeps 偏空");
assert(format.directionLabel({ id: "social", direction: "偏空" }) === "偏分裂", "social rewrites 偏空");

const up = format.splitChanges("強彈 +956.38 點（+2.50%）與台積電 -0.23%");
assert(up.some((token) => token.kind === "up" && token.text.includes("2.50")), "missing red up token");
assert(up.some((token) => token.kind === "down" && token.text.includes("0.23")), "missing green down token");
assert(format.splitChanges("情緒 -1.5").every((token) => !token.kind), "sentiment score must not use stock colors");
assert(format.splitChanges("2026-11-26").every((token) => !token.kind), "dates must not look like price changes");
assert(format.flagKind("收盤漲停") === "up", "limit-up flag");
assert(format.flagKind("收盤跌停") === "down", "limit-down flag");
assert(format.formatUpdated("2026-11-26T21:38:00+08:00").includes("21:38"), "Taipei timestamp");
assert(format.formatUpdated("2026-11-26T21:38:00+08:00").includes("台北"), "Taipei label");

const payload = normalize.normalizePayload(JSON.parse(readFileSync(join(root, "data/briefs.json"), "utf8")));
assert(payload.briefs.length === 2, `expected 2 briefs, got ${payload.briefs.length}`);
assert(normalize.chooseInitialId(payload, "") === "2026-11-26-evening", "default edition");
assert(normalize.chooseInitialId(payload, "2026-11-26-morning") === "2026-11-26-morning", "requested id");

const evening = payload.briefs.find((brief) => brief.id === "2026-11-26-evening");
const morning = payload.briefs.find((brief) => brief.id === "2026-11-26-morning");
assert(evening && morning, "missing morning or evening brief");
assert(evening.domains.map((domain) => domain.id).join(",") === "world,social,astro,market", "domain order");
assert(evening.summaryTone === "mid", "evening summary tone");
assert(evening.domains[1].direction === "偏分裂", "social direction preserved");
assert(format.directionLabel(evening.domains[1]) === "偏分裂", "social display label");
assert(!/[多空]/.test(format.directionLabel(evening.domains[1])), "live social label uses market words");
assert(evening.domains[3].table && evening.domains[3].table.rows.length === 7, "market table rows");
assert(evening.dailyReview.length === 5, "evening review items");
for (const item of evening.dailyReview) {
  assert(item.unit && item.gap && item.fix, `review item incomplete: ${item.unit}`);
}
assert(morning.dailyReview.length === 0, "morning review should be the empty state");
assert(evening.domains.every((domain) => domain.highlights.length >= 2), "takeaways dropped");
assert(evening.domains[0].facts.length === 3, "world facts dropped");
assert(match.briefMatchCount(evening, "台積電") >= 1, "search should find 台積電");
assert(match.domainMatches(evening.domains[3], "漲停"), "market table should match 漲停");
assert(!match.domainMatches(evening.domains[0], "智邦"), "world should not match a market-only name");

const legacy = normalize.normalizePayload([
  {
    date: "2026-11-20",
    weekday: "週五",
    summary: "舊格式總結",
    summaryTone: "bull",
    domains: [
      {
        name: "社會面",
        direction: "偏空",
        tone: "bear",
        summary: "舊摘要",
        keyFigures: "情緒 -1",
        items: [{ title: "路權", tone: "warning", detail: "未解", notes: ["樣本偏差"] }],
      },
    ],
    dailyReview: "無",
  },
]);
const old = legacy.briefs[0];
assert(old.summaryTone === "up", "legacy bull tone");
assert(old.domains[0].id === "social", "legacy social id");
assert(old.domains[0].tone === "down", "legacy bear tone");
assert(old.domains[0].highlights.some((item) => item.text.includes("路權")), "legacy item title");
assert(old.domains[0].details.includes("樣本偏差"), "legacy notes");
assert(old.domains[0].keyMetric.includes("情緒"), "legacy key figure");
assert(format.directionLabel(old.domains[0]) === "偏分裂", "legacy social wording");
assert(old.dailyReview.length === 0, "marker 無 should be an empty review");

const sparse = normalize.normalizeBrief({ date: "2026-11-01" }, 3);
assert(sparse.id === "2026-11-01-morning-3", "id fallback");
assert(Array.isArray(sparse.domains) && sparse.domains.length === 0, "missing domains");
assert(sparse.dailyReview.length === 0, "missing review");

const partial = normalize.normalizeReview([
  { unit: "股市（SM股市）", gap: "權值背離", fix: "無" },
  { unit: "無", gap: "無", fix: "" },
  null,
]);
assert(partial.length === 1 && partial[0].fix === "" && partial[0].gap === "權值背離", "partial review");

const groups = format.groupByDate(payload.briefs);
assert(groups.length === 1 && groups[0].briefs.length === 2, "date grouping");
const picked = format.pickBriefForDate(payload.briefs, "2026-11-26", "morning");
assert(picked && picked.session === "morning", "session preference");

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`verified ${jsFiles.length} scripts, ${payload.briefs.length} briefs, legacy + sparse fixtures`);
