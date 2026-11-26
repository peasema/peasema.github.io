// Presentation helpers shared by the page and scripts/verify.mjs.
//
// Tone values in the live file are a historical CSS mapping, not English:
//   "danger" / "bull"  -> up   -> red  (台股紅漲、偏多)
//   "success" / "bear" -> down -> green (台股綠跌、偏空)
//   "warning"          -> mid  -> amber (謹慎、中性、波動)
// Social copy never uses 多/空. directionLabel() rewrites those words
// only for the social desk.

const UP = new Set(["danger", "bull", "up", "red", "positive"]);
const DOWN = new Set(["success", "bear", "down", "green", "negative"]);
const MID = new Set(["warning", "warn", "mid", "neutral", "mixed", "caution"]);

const SOCIAL_EXACT = new Map([
  ["安定", "安定"],
  ["偏安定", "偏安定"],
  ["中性", "中性"],
  ["偏分裂", "偏分裂"],
  ["分裂", "分裂"],
  ["偏多", "偏安定"],
  ["看多", "偏安定"],
  ["多", "安定"],
  ["多頭", "安定"],
  ["偏空", "偏分裂"],
  ["看空", "偏分裂"],
  ["空", "分裂"],
  ["空頭", "分裂"],
  ["bull", "偏安定"],
  ["bear", "偏分裂"],
  ["bullish", "偏安定"],
  ["bearish", "偏分裂"],
]);

const SOCIAL_PHRASES = [
  ["看多", "偏安定"],
  ["看空", "偏分裂"],
  ["偏多", "偏安定"],
  ["偏空", "偏分裂"],
  ["多頭", "安定"],
  ["空頭", "分裂"],
];

const CHANGE_RE = /[+＋\-−－]\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*%|\s*點)/g;

const EMPTY_RE = /^(無|無。|無實質修正|無實質修正項目|今日無實質修正項目|—|–|-|n\/a|na|none|null)$/i;

export function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function normalizeTone(tone) {
  const value = asText(tone).trim().toLowerCase();
  if (UP.has(value)) return "up";
  if (DOWN.has(value)) return "down";
  if (MID.has(value)) return "mid";
  return "mid";
}

export function isEmptyMarker(value) {
  const text = asText(value).trim();
  if (!text) return true;
  return EMPTY_RE.test(text);
}

export function socialDirectionLabel(raw) {
  const text = asText(raw).trim();
  if (!text) return "";
  const exact = SOCIAL_EXACT.get(text) || SOCIAL_EXACT.get(text.toLowerCase());
  if (exact) return exact;
  let next = text;
  for (const [from, to] of SOCIAL_PHRASES) {
    next = next.split(from).join(to);
  }
  if (next.length <= 8 && /[多空]/.test(next)) {
    if (next.includes("多") && !next.includes("空")) return next.includes("偏") ? "偏安定" : "安定";
    if (next.includes("空") && !next.includes("多")) return next.includes("偏") ? "偏分裂" : "分裂";
  }
  return next;
}

export function directionLabel(domain) {
  const raw = asText(domain && domain.direction).trim();
  if (domain && domain.id === "social") return socialDirectionLabel(raw);
  return raw;
}

export function normalizeQuery(query) {
  return asText(query).trim();
}

export function contains(text, query) {
  const needle = normalizeQuery(query).toLowerCase();
  if (!needle) return false;
  return asText(text).toLowerCase().includes(needle);
}

export function splitChanges(text) {
  const raw = asText(text);
  const tokens = [];
  let last = 0;
  for (const match of raw.matchAll(CHANGE_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ text: raw.slice(last, index), kind: "" });
    const token = match[0];
    tokens.push({ text: token, kind: /^[+＋]/.test(token) ? "up" : "down" });
    last = index + token.length;
  }
  if (last < raw.length || tokens.length === 0) {
    tokens.push({ text: raw.slice(last), kind: "" });
  }
  return tokens;
}

export function flagKind(text) {
  const raw = asText(text).trim();
  if (!raw || raw === "—" || raw === "-") return "";
  if (raw.includes("跌停")) return "down";
  if (raw.includes("漲停")) return "up";
  if (raw.includes("劇烈")) return "mid";
  return "";
}

export function sectionId(id) {
  const safe = asText(id).replace(/[^A-Za-z0-9_-]/g, "");
  return `domain-${safe || "x"}`;
}

export function sessionRank(session) {
  if (session === "morning") return 0;
  if (session === "evening") return 2;
  return 1;
}

export function shortSession(brief) {
  if (!brief) return "彙整";
  if (brief.session === "morning") return "晨報";
  if (brief.session === "evening") return "晚報";
  return brief.sessionLabel || "彙整";
}

export function groupByDate(briefs) {
  const groups = [];
  const map = new Map();
  for (const brief of briefs || []) {
    const key = brief.date || brief.id;
    let group = map.get(key);
    if (!group) {
      group = { date: brief.date || "", weekday: brief.weekday || "", briefs: [] };
      map.set(key, group);
      groups.push(group);
    } else if (!group.weekday && brief.weekday) {
      group.weekday = brief.weekday;
    }
    group.briefs.push(brief);
  }
  return groups;
}

export function formatDateCompact(iso, weekday) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asText(iso));
  const core = match ? `${match[1]}/${match[2]}/${match[3]}` : asText(iso);
  return [core, weekday].filter(Boolean).join(" ");
}

export function formatDateSelect(iso, weekday) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asText(iso));
  if (!match) return formatDateCompact(iso, weekday);
  const core = `${Number(match[2])}/${Number(match[3])}`;
  return weekday ? `${core} ${weekday}` : core;
}

export function formatDateLong(iso, weekday) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asText(iso));
  const core = match
    ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
    : asText(iso) || "未標日期";
  return [core, weekday].filter(Boolean).join(" ");
}

export function formatUpdated(iso) {
  const raw = asText(iso).trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}.${pick("month")}.${pick("day")} ${pick("hour")}:${pick("minute")} 台北`;
}

export function pickBriefForDate(briefs, date, preferredSession) {
  const group = groupByDate(briefs).find((item) => item.date === date);
  if (!group || !group.briefs.length) return null;
  return (
    group.briefs.find((item) => item.session === preferredSession) ||
    group.briefs.find((item) => item.session === "evening") ||
    group.briefs[0]
  );
}
