import { el, prefersReducedMotion } from "./dom.js";
import {
  contains,
  directionLabel,
  flagKind,
  formatDateLong,
  normalizeQuery,
  sectionId,
  splitChanges,
} from "./format.js";
import { TEAM_LINKS } from "./links.js";
import { domainMatches, reviewMatches, summaryMatches, visibleRows } from "./match.js";

function appendHighlighted(parent, text, query) {
  const raw = String(text ?? "");
  const needle = normalizeQuery(query).toLowerCase();
  if (!raw) return;
  if (!needle) {
    parent.append(document.createTextNode(raw));
    return;
  }
  const lower = raw.toLowerCase();
  let index = 0;
  while (index < raw.length) {
    const at = lower.indexOf(needle, index);
    if (at < 0) {
      parent.append(document.createTextNode(raw.slice(index)));
      return;
    }
    if (at > index) parent.append(document.createTextNode(raw.slice(index, at)));
    const mark = document.createElement("mark");
    mark.textContent = raw.slice(at, at + needle.length);
    parent.append(mark);
    index = at + needle.length;
  }
}

function appendAnnotated(parent, text, query) {
  for (const token of splitChanges(text)) {
    if (!token.text) continue;
    if (!token.kind) {
      appendHighlighted(parent, token.text, query);
      continue;
    }
    const span = document.createElement("span");
    span.className = token.kind === "up" ? "chg-up" : "chg-down";
    appendHighlighted(span, token.text, query);
    parent.append(span);
  }
}

function badge(tone, label, domainId) {
  if (!label) return null;
  if (domainId === "social") {
    const span = el("span", { className: "badge badge-social", text: label });
    span.dataset.level = label;
    return span;
  }
  return el("span", { className: `badge tone-${tone || "mid"}`, text: label });
}

function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

function columnRole(header) {
  const name = String(header || "");
  if (/漲跌|升跌|變動|幅度/.test(name)) return "change";
  if (/標註|旗標|備註|狀態/.test(name)) return "flag";
  return "text";
}

function paintCell(cell, text, role, query) {
  const raw = String(text ?? "");
  if (role === "change") {
    const kind = /^[+＋]/.test(raw.trim()) ? "up" : /^[-−－]/.test(raw.trim()) && /\d/.test(raw) ? "down" : "";
    if (kind) cell.classList.add(kind === "up" ? "chg-up" : "chg-down");
  } else if (role === "flag") {
    const kind = flagKind(raw);
    if (kind === "up") cell.classList.add("chg-up");
    else if (kind === "down") cell.classList.add("chg-down");
    else if (kind === "mid") cell.classList.add("chg-mid");
  }
  appendAnnotated(cell, raw, query);
}

function renderTable(table, query, label) {
  const wrap = el("div", { className: "table-wrap" });
  const sheet = el("table", { className: "sheet" });
  sheet.append(el("caption", { className: "visually-hidden", text: `${label}表格` }));
  if (table.columns.length) {
    const headRow = document.createElement("tr");
    for (const column of table.columns) {
      const cell = document.createElement("th");
      cell.scope = "col";
      appendHighlighted(cell, column, query);
      headRow.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(headRow);
    sheet.append(thead);
  }
  const tbody = document.createElement("tbody");
  for (const cells of visibleRows(table, query)) {
    const row = document.createElement("tr");
    cells.forEach((value, index) => {
      const cell = document.createElement("td");
      paintCell(cell, value, columnRole(table.columns[index] || ""), query);
      row.append(cell);
    });
    tbody.append(row);
  }
  sheet.append(tbody);
  wrap.append(sheet);
  return wrap;
}

function renderLede(brief, query) {
  const eyebrowParts = [formatDateLong(brief.date, brief.weekday), brief.sessionLabel].filter(Boolean);
  const eyebrow = eyebrowParts.join(" · ");
  if (query && !summaryMatches(brief, query)) {
    return el("p", { className: "edition", attrs: { id: "summary" }, text: eyebrow });
  }
  const article = el("article", {
    className: `lede tone-${brief.summaryTone || "mid"}`,
    attrs: { id: "summary" },
  });
  article.append(el("p", { className: "eyebrow", text: eyebrow }));
  const head = el("div", { className: "lede-head" });
  head.append(el("h2", { text: "總結論" }));
  const leadBadge = badge(brief.summaryTone, brief.summaryLead);
  if (leadBadge) head.append(leadBadge);
  article.append(head);
  const showBody = !query || summaryMatches(brief, query);
  if (showBody && brief.summary) {
    const deck = el("p", { className: "deck" });
    appendAnnotated(deck, brief.summary, query);
    article.append(deck);
  }
  if (showBody && brief.rhNote) {
    const note = el("p", { className: "rh" });
    appendAnnotated(note, brief.rhNote, query);
    article.append(note);
  }
  return article;
}

function renderLegend() {
  const note = el("p", { className: "legend" });
  note.append(document.createTextNode("社群情緒：安定、偏安定、中性、偏分裂、分裂。漲跌數字依台股慣例，"));
  note.append(el("span", { className: "chg-up", text: "紅漲" }));
  note.append(document.createTextNode("、"));
  note.append(el("span", { className: "chg-down", text: "綠跌" }));
  note.append(document.createTextNode("。"));
  return note;
}

function renderCapsules(domains) {
  const row = el("div", { className: "capsules" });
  for (const domain of domains) {
    const id = sectionId(domain.id);
    const label = directionLabel(domain);
    const button = el("button", {
      className: `capsule domain-${domain.id}`,
      attrs: {
        type: "button",
        "aria-label": ["前往", domain.heading || domain.shortName, label, domain.keyMetric].filter(Boolean).join("，"),
      },
    });
    button.addEventListener("click", () => scrollToId(id));
    const top = el("span", { className: "capsule-top" });
    const name = el("span", { className: "capsule-name" });
    if (domain.icon) name.append(document.createTextNode(`${domain.icon} `));
    name.append(document.createTextNode(domain.shortName || domain.heading));
    top.append(name);
    const chip = badge(domain.tone, label, domain.id);
    if (chip) top.append(chip);
    button.append(top);
    if (domain.keyMetric) {
      const metric = el("span", { className: "capsule-metric" });
      appendAnnotated(metric, domain.keyMetric, "");
      button.append(metric);
    }
    row.append(button);
  }
  return row;
}

function renderDomain(domain, query, forceOpen) {
  const section = el("section", {
    className: `domain domain-${domain.id}`,
    attrs: { id: sectionId(domain.id) },
  });
  const head = el("div", { className: "domain-head" });
  const title = el("h2");
  if (domain.icon) title.append(document.createTextNode(`${domain.icon} `));
  title.append(document.createTextNode(domain.heading));
  head.append(title);
  const chip = badge(domain.tone, directionLabel(domain), domain.id);
  if (chip) head.append(chip);
  section.append(head);

  if (domain.keyMetric) {
    const metric = el("p", { className: "metric" });
    appendAnnotated(metric, domain.keyMetric, query);
    section.append(metric);
  }
  if (domain.rh) {
    const note = el("p", { className: "rh" });
    appendAnnotated(note, domain.rh, query);
    section.append(note);
  }

  const facts = domain.facts.filter((fact) => !query || contains(fact.label, query) || contains(fact.value, query));
  if (facts.length) {
    const list = el("dl", { className: "facts" });
    for (const fact of facts) {
      const wrap = el("div", { className: "fact" });
      const term = document.createElement("dt");
      appendHighlighted(term, fact.label || "指標", query);
      const value = document.createElement("dd");
      appendAnnotated(value, fact.value, query);
      wrap.append(term, value);
      list.append(wrap);
    }
    section.append(list);
  }

  const highlights = domain.highlights.filter((item) => !query || contains(item.text, query));
  if (highlights.length) {
    const list = el("ul", { className: "takes" });
    for (const item of highlights) {
      const line = document.createElement("li");
      if (item.tone) {
        line.append(el("span", { className: `mini-dot tone-${item.tone}`, attrs: { "aria-hidden": "true" } }));
      }
      const text = el("span");
      appendAnnotated(text, item.text, query);
      line.append(text);
      list.append(line);
    }
    section.append(list);
  }

  const detailLines = domain.details.filter((item) => !query || contains(item, query));
  const rows = visibleRows(domain.table, query);
  const detailHit =
    Boolean(query) &&
    (domain.details.some((item) => contains(item, query)) ||
      (domain.table &&
        (domain.table.columns.some((column) => contains(column, query)) ||
          domain.table.rows.some((row) => row.some((cell) => contains(cell, query))))));
  const hasExtra = detailLines.length > 0 || rows.length > 0;
  if (hasExtra) {
    const details = document.createElement("details");
    details.open = forceOpen === true || (forceOpen !== false && detailHit);
    const summary = document.createElement("summary");
    const count = detailLines.length || domain.details.length;
    if (domain.table && rows.length) summary.textContent = count ? `細節與表格（${count}）` : "表格";
    else summary.textContent = `細節（${count}）`;
    details.append(summary);
    if (domain.table && rows.length) details.append(renderTable(domain.table, query, domain.shortName || domain.heading));
    if (detailLines.length) {
      const list = el("ul", { className: "detail-list" });
      for (const item of detailLines) {
        const line = document.createElement("li");
        appendAnnotated(line, item, query);
        list.append(line);
      }
      details.append(list);
    }
    section.append(details);
  }
  return section;
}

function renderReview(brief, query) {
  const section = el("section", { className: "review", attrs: { id: "review" } });
  const head = el("header", { className: "section-head" });
  head.append(el("h2", { text: "今日修正與檢討" }));
  section.append(head);

  const matched = brief.dailyReview.filter((item) => !query || reviewMatches(item, query));
  if (!matched.length) {
    section.classList.add("review-empty");
    const message = query ? "檢討區沒有符合的內容。" : "今日無實質修正項目";
    section.append(el("p", { className: "quiet", text: message }));
    return section;
  }

  const list = el("ol", { className: "review-list" });
  for (const item of matched) {
    const card = el("li", { className: "review-card" });
    card.append(el("h3", { text: item.unit || "綜合" }));
    if (item.gap) {
      const row = el("p", { className: "review-row" });
      row.append(el("span", { className: "review-k", text: "現象／落差" }));
      const body = el("span", { className: "review-v" });
      appendAnnotated(body, item.gap, query);
      row.append(body);
      card.append(row);
    }
    if (item.fix) {
      const row = el("p", { className: "review-row" });
      row.append(el("span", { className: "review-k", text: "修正方法" }));
      const body = el("span", { className: "review-v" });
      appendAnnotated(body, item.fix, query);
      row.append(body);
      card.append(row);
    }
    list.append(card);
  }
  section.append(list);
  return section;
}

function renderSources() {
  const section = el("section", { className: "sources", attrs: { id: "sources", "aria-label": "隊員追蹤頁" } });
  section.append(el("h2", { text: "隊員追蹤頁" }));
  const list = el("ul");
  for (const link of TEAM_LINKS) {
    const item = document.createElement("li");
    const anchor = el("a", { text: link.title, attrs: { href: link.href } });
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    item.append(anchor);
    list.append(item);
  }
  section.append(list);
  return section;
}

export function renderBrief(container, brief, options = {}) {
  const query = normalizeQuery(options.query || "");
  const forceOpen = options.forceOpen;
  container.replaceChildren();
  container.classList.remove("loading");
  container.removeAttribute("aria-busy");
  if (!brief) {
    container.append(el("p", { className: "empty", text: "沒有可顯示的彙整。" }));
    return { matched: false };
  }

  const domains = brief.domains.filter((domain) => !query || domainMatches(domain, query));
  const summaryHit = !query || summaryMatches(brief, query);
  const reviewHit = brief.dailyReview.some((item) => !query || reviewMatches(item, query));
  const matched = !query || summaryHit || domains.length > 0 || reviewHit;

  container.append(renderLede(brief, query));
  if (domains.length) container.append(renderCapsules(domains));
  if (!query) container.append(renderLegend());
  if (query && !matched) {
    container.append(el("p", { className: "empty", text: "沒有符合的段落。" }));
  }
  for (const domain of domains) container.append(renderDomain(domain, query, forceOpen));
  container.append(renderReview(brief, query));
  if (!query) container.append(renderSources());
  return { matched };
}

export function renderFatal(container, message) {
  container.classList.remove("loading");
  container.removeAttribute("aria-busy");
  container.replaceChildren();
  const box = el("div", { className: "error", attrs: { role: "alert" } });
  box.append(el("p", { className: "error-title", text: "載入失敗" }));
  box.append(el("p", { text: message || "無法讀取 data/briefs.json。" }));
  container.append(box);
}
