// ⌘K command palette: fuzzy search over sections, projects and actions.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Subsequence fuzzy match. Returns { score, idx } or null. Rewards consecutive
// runs and matches at word starts; shorter labels win ties.
function fuzzy(query, text) {
  if (!query) return { score: 0, idx: [] };
  const q = query.toLowerCase(), t = text.toLowerCase();
  const idx = [];
  let score = 0, ti = 0, run = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    const boundary = found === 0 || /[\s\-_/.·]/.test(t[found - 1]);
    run = found === ti ? run + 1 : 0;
    score += 1 + run * 2 + (boundary ? 3 : 0) - Math.min(found - ti, 6) * 0.3;
    idx.push(found);
    ti = found + 1;
  }
  return { score: score - t.length * 0.02, idx };
}

function highlight(text, idx) {
  if (!idx.length) return esc(text);
  const set = new Set(idx);
  let html = "";
  for (let i = 0; i < text.length; i++) html += set.has(i) ? `<mark>${esc(text[i])}</mark>` : esc(text[i]);
  return html;
}

/**
 * @param {HTMLDialogElement} dialog
 * @param {() => Array<{group: string, label: string, keywords?: string, hint?: string, icon?: string, run: () => void}>} getItems
 */
export function initPalette(dialog, getItems) {
  const input = dialog.querySelector("[data-palette-input]");
  const list = dialog.querySelector("[data-palette-list]");
  let results = [];
  let active = 0;
  let lastFocus = null;

  function render() {
    const q = input.value.trim();
    const scored = [];
    for (const item of getItems()) {
      const m = fuzzy(q, item.label);
      const k = item.keywords ? fuzzy(q, item.keywords) : null;
      if (!m && !k) continue;
      const score = Math.max(m ? m.score : -Infinity, k ? k.score - 2 : -Infinity);
      scored.push({ item, score, idx: m ? m.idx : [] });
    }
    if (q) scored.sort((a, b) => b.score - a.score);
    results = scored;
    active = Math.min(active, Math.max(0, results.length - 1));

    if (!results.length) {
      list.innerHTML = `<li class="palette__empty">No matches for “${esc(q)}”</li>`;
      input.removeAttribute("aria-activedescendant");
      return;
    }

    let html = "";
    let group = null;
    results.forEach((r, i) => {
      // group headers only when browsing; ranked results read better flat
      if (!q && r.item.group !== group) {
        group = r.item.group;
        html += `<li class="palette__group" role="presentation">${esc(group)}</li>`;
      }
      html += `<li class="palette__item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === active}">
        <span class="palette__ico" aria-hidden="true">${esc(r.item.icon || "›")}</span>
        <span class="palette__label">${highlight(r.item.label, r.idx)}</span>
        ${r.item.hint ? `<span class="palette__hint">${esc(r.item.hint)}</span>` : ""}
      </li>`;
    });
    list.innerHTML = html;
    input.setAttribute("aria-activedescendant", `pal-${active}`);
  }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    list.querySelectorAll("[aria-selected]").forEach((el) => el.setAttribute("aria-selected", String(+el.dataset.i === active)));
    const el = list.querySelector(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", `pal-${active}`);
  }

  function choose(i) {
    const r = results[i];
    if (!r) return;
    close();
    // let the dialog close (and focus restore) before navigating
    requestAnimationFrame(() => r.item.run());
  }

  function open() {
    if (dialog.open) return;
    lastFocus = document.activeElement;
    input.value = "";
    active = 0;
    render();
    dialog.showModal();
    input.focus();
  }

  function close() {
    if (!dialog.open) return;
    dialog.close();
  }

  dialog.addEventListener("close", () => { lastFocus?.focus?.({ preventScroll: true }); });

  input.addEventListener("input", () => { active = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(active); }
    else if (e.key === "Home" && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && e.ctrlKey) { e.preventDefault(); setActive(results.length - 1); }
  });

  list.addEventListener("pointermove", (e) => {
    const li = e.target.closest("[data-i]");
    if (li && +li.dataset.i !== active) setActive(+li.dataset.i);
  });
  list.addEventListener("click", (e) => {
    const li = e.target.closest("[data-i]");
    if (li) choose(+li.dataset.i);
  });

  // click on the backdrop closes
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      dialog.open ? close() : open();
    } else if (e.key === "/" && !typing && !dialog.open) {
      e.preventDefault();
      open();
    }
  });

  document.querySelectorAll("[data-palette-open]").forEach((b) => b.addEventListener("click", open));

  return { open, close };
}
