import { initPalette } from "./palette.js";
import { initTerminal } from "./terminal.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/* ------------------------------------------------------------------ icons */
const ICONS = {
  sandbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z"/><path d="M4 7.4 12 12l8-4.6M12 12v9.2" opacity=".55"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  actions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2.5 5.5 13.5h6l-1 8 8-11h-6z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5 19.5 5.5v6c0 4.6-3.2 8.4-7.5 10-4.3-1.6-7.5-5.4-7.5-10v-6z"/><path d="m8.8 12 2.2 2.2 4.4-4.6" stroke-linecap="round"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 4.5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/></svg>`,
  flask: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-10V3"/><path d="M7.5 15h9" opacity=".55"/></svg>`,
  network: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M11 7 6 16M13 7l5 9M7.2 18h9.6" opacity=".6"/></svg>`,
};
const GITHUB = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>`;
const COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 5.5v-.5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h.5"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

const STATUS = {
  active: "var(--ok)",
  published: "var(--cyan)",
  beta: "var(--amber)",
  alpha: "var(--amber)",
  research: "var(--violet)",
  planned: "var(--muted)",
  archived: "var(--faint)",
};

/* ------------------------------------------------------------------ toast */
let toastTimer;
function toast(msg) {
  const t = $("[data-toast]");
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 2200);
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
    if (btn) {
      btn.classList.add("is-done");
      btn.innerHTML = CHECK;
      setTimeout(() => { btn.classList.remove("is-done"); btn.innerHTML = COPY; }, 1600);
    }
  } catch {
    toast("Couldn't access the clipboard");
  }
}

/* ------------------------------------------------------------------ nav */
function initNav() {
  const nav = $("[data-nav]");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 10);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const links = new Map($$(".nav__links a").map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) links.forEach((a, id) => a.classList.toggle("is-active", id === e.target.id));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });

  $$("[data-mod-key]").forEach((k) => { k.textContent = isMac ? "⌘K" : "Ctrl K"; });
}

/* ------------------------------------------------------------------ reveal */
function initReveal() {
  const els = $$(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach((e, i) => { e.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(e); });
}

/* ------------------------------------------------------------------ hero */
let hero = null;
let motionOff = reducedMotion;

async function initHeroSection() {
  const canvas = $("[data-hero-canvas]");
  const hitsEl = $("[data-hud-hits]");
  const hud = $(".hud");
  const hint = $("[data-hero-hint]");
  let flashTimer;
  try {
    const { initHero } = await import("./hero.js");
    hero = initHero(canvas, {
      reducedMotion,
      onHit(total) {
        hitsEl.textContent = total.toLocaleString();
        hud.classList.add("is-flash");
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => hud.classList.remove("is-flash"), 180);
      },
      onInteract() { hint.classList.add("is-used"); },
    });
    $("[data-hud-agents]").textContent = hero.agents.toLocaleString();
  } catch (err) {
    console.warn("Containment field disabled:", err);
    canvas.remove();
    hud.remove();
    hint.remove();
  }
}

function breachFromAnywhere() {
  if (!hero) return;
  if (scrollY > innerHeight * 0.5) {
    scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    setTimeout(() => hero.breach(), reducedMotion ? 50 : 700);
  } else hero.breach();
}

function setMotion(off) {
  motionOff = off;
  document.documentElement.classList.toggle("motion-off", off);
  hero?.setPaused(off);
  $$("[data-motion-toggle]").forEach((b) => { b.textContent = off ? "Resume motion" : "Pause motion"; });
}

/* ------------------------------------------------------------------ projects */
function iconFor(p) {
  if (p.icon && ICONS[p.icon]) return ICONS[p.icon];
  const initials = p.name.split(/[\s\-_]+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return esc(initials);
}

function cardHTML(p) {
  const status = (p.status || "").toLowerCase();
  const hl = (p.highlights || []).map((h) => `<li>${esc(h)}</li>`).join("");
  const tags = (p.tags || []).map((t) => `<button type="button" class="tag" data-tag="${esc(t)}" aria-label="Filter by ${esc(t)}">#${esc(t)}</button>`).join("");
  return `
    <article class="card reveal" id="project-${esc(p.id)}" data-id="${esc(p.id)}" style="--accent:${esc(p.accent || "var(--cyan)")};view-transition-name:card-${esc(p.id).replace(/[^a-z0-9-]/gi, "")}">
      <div class="card__top">
        <span class="card__icon" aria-hidden="true">${iconFor(p)}</span>
        ${status ? `<span class="status" style="--s:${STATUS[status] || "var(--muted)"}">${esc(status)}</span>` : ""}
      </div>
      <div>
        <h3 class="card__title">${esc(p.name)}</h3>
        ${p.repo ? `<div class="card__repo">${esc(p.repo)}</div>` : ""}
      </div>
      <p class="card__tagline">${esc(p.tagline)}</p>
      <p class="card__desc">${esc(p.description)}</p>
      ${hl ? `<ul class="card__hl">${hl}</ul>` : ""}
      ${p.snippet ? `<div class="snippet"><code class="snippet__code">${esc(p.snippet)}</code><button type="button" class="copy-btn" data-copy="${esc(p.snippet)}" aria-label="Copy command">${COPY}</button></div>` : ""}
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      <div class="card__links">
        <a class="card__link card__link--docs" href="${esc(p.docs)}">Documentation <span aria-hidden="true">→</span></a>
        ${p.source ? `<a class="card__link card__link--src" href="${esc(p.source)}">${GITHUB} Source</a>` : ""}
      </div>
    </article>`;
}

const LAB_CARD = `
  <article class="card card--lab reveal" data-lab style="--accent:var(--violet);view-transition-name:card-lab">
    <span class="lab-orb" aria-hidden="true"></span>
    <h3>More in the lab</h3>
    <p>New experiments land here as they mature. Follow along on GitHub.</p>
    <div class="card__links"><a class="card__link card__link--src" href="https://github.com/apomonosi">${GITHUB} github.com/apomonosi</a></div>
  </article>`;

function renderProjects(projects) {
  const grid = $("[data-projects]");
  grid.innerHTML = projects.map(cardHTML).join("") + LAB_CARD;

  renderFilters(projects);
  $("[data-filters]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (b) applyFilter(b.dataset.filter, projects);
  });
  grid.addEventListener("click", (e) => {
    const tag = e.target.closest("[data-tag]");
    if (tag) applyFilter(`tag:${tag.dataset.tag}`, projects);
    const cp = e.target.closest("[data-copy]");
    if (cp) copy(cp.dataset.copy, cp);
  });

  if (finePointer && !reducedMotion) {
    grid.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty("--mx", `${x}px`);
      card.style.setProperty("--my", `${y}px`);
      if (!motionOff) {
        const rx = ((y / r.height) - 0.5) * -4;
        const ry = ((x / r.width) - 0.5) * 5;
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
      }
    });
    grid.addEventListener("pointerout", (e) => {
      const card = e.target.closest(".card");
      if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
    });
  }
}

// Filter chips come from each project's `category`; clicking a #tag on a card
// adds a temporary tag chip. Filter keys: "all", "cat:<name>", "tag:<name>".
function renderFilters(projects) {
  const counts = new Map();
  projects.forEach((p) => { if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1); });
  const chip = (key, label, n) =>
    `<button type="button" class="chip" data-filter="${esc(key)}" aria-pressed="${key === currentFilter}">${label} ${n != null ? `<span class="chip__n">${n}</span>` : ""}</button>`;
  let html = chip("all", "all", projects.length);
  for (const [c, n] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) html += chip(`cat:${c}`, esc(c), n);
  if (currentFilter.startsWith("tag:")) {
    const t = currentFilter.slice(4);
    html += chip(currentFilter, `#${esc(t)} <span class="chip__x" aria-hidden="true">×</span>`, projects.filter((p) => (p.tags || []).includes(t)).length);
  }
  $("[data-filters]").innerHTML = html;
}

function matches(p, filter) {
  if (filter === "all") return true;
  const [kind, value] = [filter.slice(0, 3), filter.slice(4)];
  return kind === "cat" ? p.category === value : (p.tags || []).includes(value);
}

let currentFilter = "all";

function applyFilter(filter, projects) {
  if (filter === currentFilter) filter = "all";
  currentFilter = filter;
  const update = () => {
    renderFilters(projects);
    $$(".card[data-id]").forEach((c) => {
      c.hidden = !matches(projects.find((x) => x.id === c.dataset.id), filter);
    });
    const lab = $("[data-lab]");
    if (lab) lab.hidden = filter !== "all";
  };
  if (document.startViewTransition && !reducedMotion) {
    // On slow (software-rendered) devices the snapshot can stall; don't make the click wait.
    let done = false;
    const vt = document.startViewTransition(() => { done = true; update(); });
    setTimeout(() => { if (!done) vt.skipTransition(); }, 400);
  } else update();
}

/* ------------------------------------------------------------------ built-with stats */
const SOURCES = [
  "index.html",
  "assets/css/site.css",
  "assets/js/main.js",
  "assets/js/hero.js",
  "assets/js/terminal.js",
  "assets/js/palette.js",
  "data/projects.json",
];

function countUp(el, to, fmt = (n) => Math.round(n).toLocaleString()) {
  if (reducedMotion) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1400;
  const tick = (now) => {
    const k = Math.min((now - t0) / dur, 1);
    el.textContent = fmt(to * (1 - Math.pow(1 - k, 4)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function initStats() {
  const files = await Promise.all(SOURCES.map(async (path) => {
    try {
      const res = await fetch(path, { cache: "force-cache" });
      const text = await res.text();
      return { path, lines: text.split("\n").length, bytes: new Blob([text]).size };
    } catch { return null; }
  }));
  const ok = files.filter(Boolean);
  if (!ok.length) return;
  const lines = ok.reduce((a, f) => a + f.lines, 0);
  const bytes = ok.reduce((a, f) => a + f.bytes, 0);
  const max = Math.max(...ok.map((f) => f.lines));

  $("[data-stat=files]").textContent = `${ok.length} files`;
  $("[data-manifest]").innerHTML = ok.sort((a, b) => b.lines - a.lines).map((f) => `
    <li>
      <a href="https://github.com/apomonosi/apomonosi.github.io/blob/main/${f.path}">${f.path}</a>
      <span class="m-n">${f.lines.toLocaleString()} ln</span>
      <span class="manifest__bar"><i data-w="${(f.lines / max * 100).toFixed(1)}%"></i></span>
    </li>`).join("");

  const statsEl = $("[data-stats]");
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    countUp($("[data-stat=lines]"), lines);
    countUp($("[data-stat=kb]"), bytes / 1024, (n) => n.toFixed(1));
    $$("[data-manifest] i").forEach((i) => { i.style.setProperty("--w", i.dataset.w); });
  }, { threshold: 0.3 });
  io.observe(statsEl);
}

function highlightJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  return esc(json).replace(
    /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(-?\d+(?:\.\d+)?)\b|([{}[\],])/g,
    (m, str, colon, num, pun) => {
      if (str) return colon ? `<span class="j-key">${str}</span><span class="j-pun">${colon}</span>` : `<span class="j-str">${str}</span>`;
      if (num) return `<span class="j-num">${num}</span>`;
      if (pun) return `<span class="j-pun">${pun}</span>`;
      return m;
    },
  );
}

/* ------------------------------------------------------------------ palette */
function paletteItems(projects, terminal) {
  const go = (id) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  };
  const items = [
    { group: "Navigate", label: "Projects", icon: "§", hint: "01", run: go("projects") },
    { group: "Navigate", label: "Terminal", icon: "§", hint: "02", run: go("terminal") },
    { group: "Navigate", label: "Principles", icon: "§", hint: "03", run: go("principles") },
    { group: "Navigate", label: "How it's built", icon: "§", hint: "04", run: go("built") },
    { group: "Navigate", label: "Back to top", icon: "↑", run: go("top") },
  ];
  for (const p of projects) {
    items.push({ group: "Projects", label: `${p.name}: documentation`, keywords: `${p.id} ${p.tagline} ${(p.tags || []).join(" ")}`, icon: "→", hint: "docs", run: () => { location.href = p.docs; } });
    if (p.source) items.push({ group: "Projects", label: `${p.name}: source on GitHub`, keywords: `${p.id} ${p.repo || ""} github code`, icon: "</>", hint: "source", run: () => { location.href = p.source; } });
    items.push({
      group: "Projects", label: `${p.name}: show card`, keywords: p.id, icon: "◇", run: () => {
        if (currentFilter !== "all") applyFilter(currentFilter, projects); // toggles back to all
        const el = document.getElementById(`project-${p.id}`);
        el?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
        el?.animate?.([{ boxShadow: "0 0 0 2px var(--cyan)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1600, delay: 400 });
      },
    });
    if (p.snippet) items.push({ group: "Projects", label: `Copy: ${p.snippet}`, keywords: `${p.id} install copy command`, icon: "$", hint: p.name, run: () => copy(p.snippet) });
  }
  const cats = [...new Set(projects.map((p) => p.category).filter(Boolean))].sort();
  for (const c of cats) items.push({ group: "Filter", label: `Show ${c} projects`, keywords: `category filter ${c}`, icon: "▤", run: () => { currentFilter = "all"; applyFilter(`cat:${c}`, projects); go("projects")(); } });
  const tags = [...new Set(projects.flatMap((p) => p.tags || []))].sort();
  for (const t of tags) items.push({ group: "Filter", label: `Filter projects: #${t}`, keywords: `tag ${t}`, icon: "#", run: () => { currentFilter = "all"; applyFilter(`tag:${t}`, projects); go("projects")(); } });

  items.push(
    { group: "Actions", label: "Stage an escape attempt", keywords: "breach containment field hero", icon: "◎", run: breachFromAnywhere },
    { group: "Actions", label: "Replay terminal demo", keywords: "agentctl shell", icon: ">_", run: () => { go("terminal")(); terminal?.replay(); } },
    { group: "Actions", label: "Focus terminal", keywords: "type shell command", icon: ">_", run: () => { go("terminal")(); setTimeout(() => terminal?.focus(), 500); } },
    { group: "Actions", label: motionOff ? "Resume motion" : "Pause motion", keywords: "animation reduce motion", icon: "⏯", run: () => setMotion(!motionOff) },
    { group: "Actions", label: "Copy page link", keywords: "share url", icon: "⧉", run: () => copy(location.href.split("#")[0]) },
    { group: "Links", label: "apomonosi on GitHub", keywords: "org repositories", icon: "↗", run: () => { location.href = "https://github.com/apomonosi"; } },
    { group: "Links", label: "This site's source", keywords: "github repo apomonosi.github.io", icon: "↗", run: () => { location.href = "https://github.com/apomonosi/apomonosi.github.io"; } },
  );
  return items;
}

/* ------------------------------------------------------------------ boot */
async function loadProjects() {
  try {
    const res = await fetch("data/projects.json");
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return (data.projects || []).filter((p) => p.id && p.name && p.docs);
  } catch (err) {
    console.error("Could not load data/projects.json", err);
    $("[data-projects]").innerHTML = `<p class="section__lede">Couldn't load the project list. Browse <a href="https://github.com/apomonosi">github.com/apomonosi</a> instead.</p>`;
    return [];
  }
}

async function boot() {
  initNav();
  initHeroSection();
  $$("[data-motion-toggle]").forEach((b) => b.addEventListener("click", () => setMotion(!motionOff)));
  if (reducedMotion) setMotion(true);

  const projects = await loadProjects();
  if (projects.length) renderProjects(projects);

  const example = projects[0];
  if (example) $("[data-example-json] code").innerHTML = highlightJSON(example);

  const terminal = initTerminal($("[data-terminal]"), { projects, actions: { breach: breachFromAnywhere } });
  initPalette($("[data-palette]"), () => paletteItems(projects, terminal));

  initReveal();
  initStats();
}

boot();
