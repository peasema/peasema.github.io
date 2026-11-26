import { contains, normalizeQuery } from "./format.js";

export function summaryMatches(brief, query) {
  if (!normalizeQuery(query)) return true;
  return [brief.summary, brief.summaryLead, brief.rhNote].some((value) => contains(value, query));
}

export function reviewMatches(item, query) {
  if (!normalizeQuery(query)) return true;
  return [item.unit, item.gap, item.fix].some((value) => contains(value, query));
}

export function domainMatches(domain, query) {
  if (!normalizeQuery(query)) return true;
  const bag = [
    domain.heading,
    domain.shortName,
    domain.direction,
    domain.keyMetric,
    domain.rh,
    domain.icon,
  ];
  for (const fact of domain.facts) bag.push(fact.label, fact.value);
  for (const highlight of domain.highlights) bag.push(highlight.text);
  for (const detail of domain.details) bag.push(detail);
  if (domain.table) {
    bag.push(...domain.table.columns);
    for (const row of domain.table.rows) bag.push(...row);
  }
  return bag.some((value) => contains(value, query));
}

export function briefMatchCount(brief, query) {
  if (!normalizeQuery(query) || !brief) return 0;
  let count = 0;
  if (contains(brief.summary, query) || contains(brief.summaryLead, query) || contains(brief.rhNote, query)) {
    count += 1;
  }
  for (const domain of brief.domains) {
    if (domainMatches(domain, query)) count += 1;
  }
  for (const item of brief.dailyReview) {
    if (reviewMatches(item, query)) count += 1;
  }
  return count;
}

export function visibleRows(table, query) {
  if (!table) return [];
  if (!normalizeQuery(query)) return table.rows;
  if (table.columns.some((column) => contains(column, query))) return table.rows;
  return table.rows.filter((row) => row.some((cell) => contains(cell, query)));
}
