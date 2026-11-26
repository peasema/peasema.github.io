import { asText, isEmptyMarker, normalizeTone } from "./format.js";

const KNOWN_IDS = new Set(["world", "social", "astro", "market"]);

const DEFAULTS = {
  world: { heading: "國際（WD世界）", shortName: "國際" },
  social: { heading: "社群（CY社會）", shortName: "社群" },
  astro: { heading: "天象（SW銀河）", shortName: "天象" },
  market: { heading: "股市（SM股市）", shortName: "股市" },
};

function inferId(domain, index) {
  const given = asText(domain.id).trim().toLowerCase();
  if (KNOWN_IDS.has(given)) return given;
  const blob = [domain.id, domain.heading, domain.name, domain.shortName, domain.source]
    .map((part) => asText(part))
    .join(" ");
  if (/world|國際|世界|\bwd\b/i.test(blob)) return "world";
  if (/social|社群|社會|\bcy\b/i.test(blob)) return "social";
  if (/astro|天象|銀河|星象|\bsw\b/i.test(blob)) return "astro";
  if (/market|股市|市場|台股|\bsm\b/i.test(blob)) return "market";
  return given || `extra-${index}`;
}

function normalizeFacts(domain) {
  if (Array.isArray(domain.facts) && domain.facts.length) {
    return domain.facts
      .map((fact) => {
        if (fact == null) return null;
        if (typeof fact === "string" || typeof fact === "number") {
          const value = asText(fact).trim();
          return value ? { label: "重點", value } : null;
        }
        if (typeof fact !== "object") return null;
        const label = asText(fact.label ?? fact.name).trim();
        const value = asText(fact.value ?? fact.text).trim();
        if (!label && !value) return null;
        return { label, value };
      })
      .filter(Boolean);
  }

  const figures = domain.keyFigures ?? domain.keyFigure;
  if (figures == null || figures === "") return [];
  if (typeof figures === "string" || typeof figures === "number") {
    const value = asText(figures).trim();
    return value ? [{ label: "指標", value }] : [];
  }
  if (Array.isArray(figures)) {
    return figures
      .map((item) => {
        if (item == null) return null;
        if (typeof item === "string" || typeof item === "number") {
          const value = asText(item).trim();
          return value ? { label: "指標", value } : null;
        }
        if (typeof item !== "object") return null;
        const label = asText(item.label ?? item.name).trim() || "指標";
        const value = asText(item.value ?? item.text).trim();
        if (!value && !label) return null;
        return { label, value };
      })
      .filter(Boolean);
  }
  if (typeof figures === "object") {
    return Object.entries(figures)
      .map(([label, value]) => ({ label: asText(label), value: asText(value).trim() }))
      .filter((fact) => fact.label || fact.value);
  }
  return [];
}

function normalizeHighlight(item) {
  if (item == null) return null;
  if (typeof item === "string" || typeof item === "number") {
    const text = asText(item).trim();
    return text ? { text, tone: "" } : null;
  }
  if (typeof item !== "object") return null;
  const title = asText(item.title ?? item.text).trim();
  const detail = asText(item.detail).trim();
  let text = "";
  if (title && detail && title !== detail) text = `${title}：${detail}`;
  else text = title || detail;
  if (!text) return null;
  const tone = item.tone ? normalizeTone(item.tone) : "";
  return { text, tone };
}

function pushDetail(details, value) {
  if (Array.isArray(value)) {
    for (const entry of value) pushDetail(details, entry);
    return;
  }
  const text = asText(value).trim();
  if (text) details.push(text);
}

function normalizeTable(table) {
  if (!table || typeof table !== "object" || Array.isArray(table)) return null;
  const columns = Array.isArray(table.columns)
    ? table.columns.map((column) => asText(column))
    : Array.isArray(table.headers)
      ? table.headers.map((column) => asText(column))
      : [];
  const sourceRows = Array.isArray(table.rows) ? table.rows : [];
  const rows = sourceRows
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => asText(cell)));
  if (!rows.length) return null;
  return { columns, rows };
}

export function normalizeDomain(domain, index) {
  const source = domain && typeof domain === "object" ? domain : {};
  const id = inferId(source, index);
  const defaults = DEFAULTS[id] || { heading: "其他", shortName: "其他" };
  const facts = normalizeFacts(source);
  const highlights = [];
  for (const item of Array.isArray(source.highlights) ? source.highlights : []) {
    const highlight = normalizeHighlight(item);
    if (highlight) highlights.push(highlight);
  }
  const summary = asText(source.summary).trim();
  if (summary && !highlights.some((item) => item.text === summary)) {
    highlights.push({ text: summary, tone: "" });
  }
  const details = [];
  pushDetail(details, source.details);
  for (const item of Array.isArray(source.items) ? source.items : []) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const highlight = normalizeHighlight(item);
      if (highlight && !highlights.some((entry) => entry.text === highlight.text)) {
        highlights.push(highlight);
      }
      pushDetail(details, item.notes);
    } else {
      const highlight = normalizeHighlight(item);
      if (highlight) highlights.push(highlight);
    }
  }
  pushDetail(details, source.notes);

  const keyMetric =
    asText(source.keyMetric).trim() ||
    (facts[0] && (facts[0].value || facts[0].label)) ||
    "";

  return {
    id,
    heading: asText(source.heading || source.name).trim() || defaults.heading,
    shortName: asText(source.shortName).trim() || defaults.shortName,
    direction: asText(source.direction).trim(),
    tone: normalizeTone(source.tone),
    keyMetric,
    rh: asText(source.rh || source.source).trim(),
    icon: asText(source.icon).trim(),
    facts,
    highlights,
    details,
    table: normalizeTable(source.table),
  };
}

function normalizeReviewItem(item) {
  if (item == null) return null;
  if (typeof item === "string" || typeof item === "number") {
    const text = asText(item).trim();
    if (isEmptyMarker(text)) return null;
    return { unit: "綜合", gap: text, fix: "" };
  }
  if (typeof item !== "object") return null;
  const unit = asText(item.unit ?? item.name).trim();
  const gapRaw = asText(item.gap ?? item.finding ?? item.issue).trim();
  const fixRaw = asText(item.fix ?? item.adjustment ?? item.method).trim();
  const gap = isEmptyMarker(gapRaw) ? "" : gapRaw;
  const fix = isEmptyMarker(fixRaw) ? "" : fixRaw;
  if (!gap && !fix) return null;
  return { unit: unit || "綜合", gap, fix };
}

export function normalizeReview(value) {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    const item = normalizeReviewItem(value);
    return item ? [item] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeReviewItem(item)).filter(Boolean);
}

function sessionLabelFor(session, given) {
  const label = asText(given).trim();
  if (label) return label;
  if (session === "morning") return "晨間彙整";
  if (session === "evening") return "晚間彙整";
  return "彙整";
}

export function normalizeBrief(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  const date = asText(source.date).trim();
  const session = asText(source.session).trim();
  const id = asText(source.id).trim() || [date || "brief", session || "morning", String(index)].join("-");
  const domains = (Array.isArray(source.domains) ? source.domains : []).map((domain, domainIndex) =>
    normalizeDomain(domain, domainIndex),
  );
  return {
    id,
    date,
    weekday: asText(source.weekday).trim(),
    session,
    sessionLabel: sessionLabelFor(session, source.sessionLabel),
    summaryLead: asText(source.summaryLead).trim(),
    summary: asText(source.summary).trim(),
    summaryTone: normalizeTone(source.summaryTone),
    rhNote: asText(source.rhNote).trim(),
    domains,
    dailyReview: normalizeReview(source.dailyReview),
  };
}

export function normalizePayload(data) {
  const envelope = Array.isArray(data) ? { briefs: data } : data && typeof data === "object" ? data : {};
  const list = Array.isArray(envelope.briefs) ? envelope.briefs : [];
  return {
    updatedAt: asText(envelope.updatedAt).trim(),
    defaultId: asText(envelope.defaultId).trim(),
    briefs: list.map((brief, index) => normalizeBrief(brief, index)),
  };
}

export function chooseInitialId(payload, requestedId) {
  const briefs = (payload && payload.briefs) || [];
  if (requestedId && briefs.some((brief) => brief.id === requestedId)) return requestedId;
  if (payload && payload.defaultId && briefs.some((brief) => brief.id === payload.defaultId)) {
    return payload.defaultId;
  }
  const evening = briefs.find((brief) => brief.session === "evening");
  return (evening || briefs[0] || {}).id || "";
}
