import { el } from "./dom.js";
import {
  formatDateCompact,
  formatDateLong,
  formatDateSelect,
  formatUpdated,
  groupByDate,
  normalizeQuery,
  pickBriefForDate,
  sessionRank,
  shortSession,
} from "./format.js";
import { briefMatchCount } from "./match.js";
import { chooseInitialId, normalizePayload } from "./normalize.js";
import { renderBrief, renderFatal } from "./render.js";

const THEME_KEY = "brief-theme";

const state = {
  payload: null,
  id: "",
  query: "",
  forceOpen: null,
  spy: null,
};

function $(id) {
  return document.getElementById(id);
}

function currentBrief() {
  if (!state.payload) return null;
  return state.payload.briefs.find((brief) => brief.id === state.id) || null;
}

function applyTheme(theme, persist) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  const meta = $("themeColor");
  if (meta) meta.setAttribute("content", next === "dark" ? "#12110e" : "#f4f1ea");
  const button = $("themeToggle");
  if (button) {
    const goingDark = next !== "dark";
    button.textContent = goingDark ? "深色" : "淺色";
    button.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    button.setAttribute("aria-label", goingDark ? "切換成深色" : "切換成淺色");
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode */
    }
  }
}

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function bindTheme() {
  applyTheme(document.documentElement.getAttribute("data-theme") || "light", false);
  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next, true);
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (savedTheme() === "light" || savedTheme() === "dark") return;
    applyTheme(media.matches ? "dark" : "light", false);
  };
  if (typeof media.addEventListener === "function") media.addEventListener("change", onChange);
}

function readingSection() {
  const line = $("topbar").offsetHeight + 8;
  const nodes = [...document.querySelectorAll("#summary, #app section.domain, #review")];
  let best = null;
  let bestDist = Infinity;
  for (const node of nodes) {
    if (!node.getClientRects().length) continue;
    const dist = Math.abs(node.getBoundingClientRect().top - line);
    if (dist < bestDist) {
      bestDist = dist;
      best = node;
    }
  }
  return best;
}

function syncStickyOffset() {
  const header = $("topbar");
  if (!header) return;
  document.documentElement.style.setProperty("--sticky-offset", `${header.offsetHeight + 12}px`);
}

function bindProgress() {
  const bar = $("progress");
  const onScroll = () => {
    const root = document.documentElement;
    const max = root.scrollHeight - root.clientHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
    bar.style.transform = `scaleX(${ratio})`;
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function renderUpdated() {
  const node = $("updatedAt");
  const raw = state.payload ? state.payload.updatedAt : "";
  const label = formatUpdated(raw);
  node.textContent = label ? `更新 ${label}` : "";
  if (raw) node.setAttribute("datetime", raw);
  else node.removeAttribute("datetime");
}

function renderDateSelect() {
  const select = $("dateSelect");
  const current = currentBrief();
  const groups = groupByDate(state.payload.briefs);
  select.replaceChildren(
    ...groups.map((group) => {
      const option = document.createElement("option");
      option.value = group.date;
      option.textContent = formatDateSelect(group.date, group.weekday) || "未標日期";
      option.title = formatDateLong(group.date, group.weekday);
      option.selected = Boolean(current && current.date === group.date);
      return option;
    }),
  );
}

function renderSessionSwitch() {
  const host = $("sessionSwitch");
  const current = currentBrief();
  host.replaceChildren();
  if (!current) return;
  const group = groupByDate(state.payload.briefs).find((item) => item.date === current.date);
  const sessions = group ? [...group.briefs].sort((a, b) => sessionRank(a.session) - sessionRank(b.session)) : [];
  for (const brief of sessions) {
    const button = el("button", {
      attrs: {
        type: "button",
        "aria-pressed": brief.id === state.id ? "true" : "false",
        "aria-label": brief.sessionLabel || shortSession(brief),
      },
      text: shortSession(brief),
    });
    button.addEventListener("click", () => selectBrief(brief.id, true));
    host.append(button);
  }
}

function renderArchive() {
  const list = $("archiveList");
  const count = $("archiveOpen");
  const groups = groupByDate(state.payload.briefs);
  count.textContent = groups.length > 1 ? `歷程 ${groups.length}` : "歷程";
  count.setAttribute("aria-label", `開啟歷程，共 ${groups.length} 天`);
  list.replaceChildren();
  if (!groups.length) {
    list.append(el("p", { className: "quiet", text: "尚無歷程" }));
    return;
  }
  for (const group of groups) {
    const block = el("section", { className: "archive-day" });
    block.append(el("h3", { text: formatDateLong(group.date, group.weekday) }));
    const row = el("div", { className: "archive-sessions" });
    const sessions = [...group.briefs].sort((a, b) => sessionRank(a.session) - sessionRank(b.session));
    for (const brief of sessions) {
      const button = el("button", {
        className: "archive-session",
        attrs: {
          type: "button",
          "aria-current": brief.id === state.id ? "true" : "false",
        },
        text: brief.sessionLabel || shortSession(brief),
      });
      button.addEventListener("click", () => {
        selectBrief(brief.id, true);
        $("archiveDialog").close();
      });
      row.append(button);
    }
    block.append(row);
    list.append(block);
  }
}

function renderChrome() {
  renderUpdated();
  renderDateSelect();
  renderSessionSwitch();
  renderArchive();
}

function syncJumps() {
  for (const link of $("jumps").querySelectorAll("a")) {
    const id = link.getAttribute("data-target");
    link.classList.toggle("is-missing", !document.getElementById(id));
  }
}

function syncToggle() {
  const button = $("toggleDetails");
  const details = [...document.querySelectorAll("#app details")];
  button.disabled = details.length === 0;
  const open = state.forceOpen === true;
  button.textContent = open ? "收合" : "展開";
  button.setAttribute("aria-label", open ? "全部收合細節" : "全部展開細節");
  button.setAttribute("aria-expanded", open ? "true" : "false");
}

function bindScrollSpy() {
  if (state.spy) state.spy.disconnect();
  const links = [...$("jumps").querySelectorAll("a")];
  const sections = links.map((link) => document.getElementById(link.getAttribute("data-target"))).filter(Boolean);
  const mark = (id) => {
    for (const link of links) {
      const on = link.getAttribute("data-target") === id;
      link.classList.toggle("is-active", on);
      if (on) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  };
  if (!sections.length) {
    mark("");
    return;
  }
  const offset = $("topbar").offsetHeight + 16;
  state.spy = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible.length) return;
      mark(visible[0].target.id);
    },
    { rootMargin: `-${offset}px 0px -55% 0px`, threshold: [0.05, 0.2, 0.5] },
  );
  for (const section of sections) state.spy.observe(section);
}

function renderSearchStatus() {
  const status = $("searchStatus");
  const query = normalizeQuery(state.query);
  status.replaceChildren();
  if (!query || !state.payload) {
    status.hidden = true;
    return;
  }
  const current = currentBrief();
  const count = briefMatchCount(current, query);
  status.hidden = false;
  status.append(
    el("span", {
      text: count ? `本報 ${count} 個段落符合「${query}」` : `本報沒有符合「${query}」的內容`,
    }),
  );
  const others = state.payload.briefs.filter((brief) => brief.id !== state.id && briefMatchCount(brief, query) > 0);
  if (!others.length) return;
  status.append(el("span", { className: "search-also", text: "其他時段：" }));
  for (const brief of others) {
    const button = el("button", {
      className: "text-button",
      attrs: { type: "button" },
      text: `${formatDateCompact(brief.date, "")} ${shortSession(brief)}（${briefMatchCount(brief, query)}）`,
    });
    button.addEventListener("click", () => selectBrief(brief.id, true));
    status.append(button);
  }
}

function renderCurrent(scroll) {
  const app = $("app");
  const brief = currentBrief();
  if (brief) {
    const label = [brief.date, brief.sessionLabel].filter(Boolean).join(" ");
    document.title = label ? `${label}｜每日資訊早晚報` : "每日資訊早晚報";
  } else {
    document.title = "每日資訊早晚報";
  }
  renderBrief(app, brief, { query: state.query, forceOpen: state.forceOpen });
  renderSearchStatus();
  syncJumps();
  syncToggle();
  bindScrollSpy();
  if (scroll) window.scrollTo(0, 0);
}

function selectBrief(id, scroll) {
  if (!state.payload.briefs.some((brief) => brief.id === id)) return;
  state.id = id;
  state.forceOpen = null;
  const url = new URL(location.href);
  url.searchParams.set("id", id);
  url.hash = "";
  history.replaceState(null, "", url);
  renderChrome();
  renderCurrent(Boolean(scroll));
}

function showLoadError(error) {
  renderFatal($("app"), error && error.message ? error.message : "無法讀取 data/briefs.json。");
}

async function loadBriefs() {
  const response = await fetch(`data/briefs.json?t=${Date.now()}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`無法載入資料（${response.status}）`);
  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error("briefs.json 不是有效的 JSON");
  }
  state.payload = normalizePayload(json);
  if (!state.payload.briefs.length) throw new Error("briefs.json 裡面沒有彙整。");
  const requested = new URLSearchParams(location.search).get("id");
  state.id = chooseInitialId(state.payload, requested);
  renderChrome();
  renderCurrent(false);
  const url = new URL(location.href);
  if (state.id && url.searchParams.get("id") !== state.id) {
    url.searchParams.set("id", state.id);
    history.replaceState(null, "", url);
  }
  const hash = location.hash.replace(/^#/, "");
  if (hash && document.getElementById(hash)) {
    document.getElementById(hash).scrollIntoView();
  }
}

function bindChrome() {
  $("dateSelect").addEventListener("change", () => {
    const current = currentBrief();
    const next = pickBriefForDate(state.payload.briefs, $("dateSelect").value, current && current.session);
    if (next) selectBrief(next.id, true);
  });
  $("archiveOpen").addEventListener("click", () => {
    renderArchive();
    $("archiveDialog").showModal();
  });
  $("archiveClose").addEventListener("click", () => $("archiveDialog").close());
  $("archiveDialog").addEventListener("click", (event) => {
    if (event.target === $("archiveDialog")) $("archiveDialog").close();
  });
  let timer = 0;
  $("searchInput").addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      state.query = $("searchInput").value;
      state.forceOpen = null;
      renderCurrent(false);
    }, 90);
  });
  $("toggleDetails").addEventListener("click", () => {
    const marker = readingSection();
    const before = marker ? marker.getBoundingClientRect().top : 0;
    state.forceOpen = state.forceOpen !== true;
    for (const node of document.querySelectorAll("#app details")) node.open = state.forceOpen === true;
    if (marker) {
      const delta = marker.getBoundingClientRect().top - before;
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollBy(0, delta);
      root.style.scrollBehavior = previous;
    }
    syncToggle();
  });
  $("jumps").addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const id = link.getAttribute("data-target");
    if (document.getElementById(id)) return;
    event.preventDefault();
    state.query = "";
    $("searchInput").value = "";
    state.forceOpen = null;
    renderCurrent(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    }
  });
  const header = $("topbar");
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      syncStickyOffset();
      bindScrollSpy();
    });
    observer.observe(header);
  } else {
    window.addEventListener("resize", () => {
      syncStickyOffset();
      bindScrollSpy();
    });
  }
  syncStickyOffset();
}

function boot() {
  bindTheme();
  bindProgress();
  bindChrome();
  // Jump targets are domain ids, kept in markup so the nav exists before data loads.
  for (const link of $("jumps").querySelectorAll("a")) {
    const id = (link.getAttribute("href") || "").replace(/^#/, "");
    if (id.startsWith("domain-") || id === "review") link.setAttribute("data-target", id);
  }
  loadBriefs().catch(showLoadError);
}

if (typeof document !== "undefined") boot();
