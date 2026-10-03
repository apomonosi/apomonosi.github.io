// A small simulated shell. It replays an agentctl session taken from the
// agentctl docs, then accepts commands. Nothing here touches a real system.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (s, n) => String(s).padEnd(n);

const PREVIEW_CREATE = (name, image = "images:ubuntu/24.04") => [
  `incus init ${image} ${name} --vm -c security.secureboot=false -p default -c limits.cpu=2 -c limits.memory=4GiB`,
  `incus config device override ${name} root size=20GiB`,
  `incus network acl create agentctl-${name}`,
  `incus network acl rule add agentctl-${name} egress action=reject destination=10.0.0.0/8`,
  `incus network acl rule add agentctl-${name} egress action=reject destination=172.16.0.0/12`,
  `incus network acl rule add agentctl-${name} egress action=reject destination=192.168.0.0/16`,
  `incus network acl rule add agentctl-${name} egress action=reject destination=169.254.0.0/16`,
  `incus config device override ${name} eth0 security.acls=agentctl-${name}`,
];

export function initTerminal(root, { projects = [], actions = {} } = {}) {
  const out = root.querySelector("[data-term-out]");
  const input = root.querySelector("[data-term-input]");
  const screen = root.querySelector("[data-term-screen]");
  const replayBtn = root.querySelector("[data-term-replay]");

  const sandboxes = new Map();
  const history = [];
  let hIdx = 0;
  let playing = false;
  let playToken = 0;

  const scroll = () => { screen.scrollTop = screen.scrollHeight; };
  const line = (html = "", cls = "") => {
    const d = document.createElement("div");
    if (cls) d.className = cls;
    d.innerHTML = html;
    out.appendChild(d);
    scroll();
    return d;
  };
  const echo = (cmd) => line(`<span class="t-p">❯</span>${esc(cmd)}`, "t-cmd");

  // ---------------------------------------------------------------- commands
  const commands = {
    help() {
      return [
        `<span class="t-head">Available commands</span>`,
        `  <span class="t-cyan">projects</span>            list showcased projects`,
        `  <span class="t-cyan">open</span> <span class="t-dim">&lt;project&gt;</span>      open a project's documentation`,
        `  <span class="t-cyan">agentctl</span> <span class="t-dim">…</span>          create / start / list / exec / delete sandboxes (simulated)`,
        `  <span class="t-cyan">agentctl --preview</span> <span class="t-dim">…</span> show the backend commands without running them`,
        `  <span class="t-cyan">breach</span>              stage an escape attempt on the containment field`,
        `  <span class="t-cyan">principles</span>          what we build by`,
        `  <span class="t-cyan">about</span> · <span class="t-cyan">whoami</span> · <span class="t-cyan">history</span> · <span class="t-cyan">clear</span>`,
        `<span class="t-dim">Tab completes, ↑/↓ walks history. Try: agentctl create demo --profile=default</span>`,
      ];
    },
    about() {
      return [
        `<span class="t-head">apomonosi</span> <span class="t-dim">(ἀπομόνωση, Greek for isolation)</span>`,
        `Open tools and research for safe, responsible AI-driven development.`,
        `This page was written by an AI coding agent. Type <span class="t-cyan">projects</span> to see the work.`,
      ];
    },
    whoami: () => [`guest <span class="t-dim">(uid=1000, no sudo, no LAN. You're in a sandbox too.)</span>`],
    principles: () => [
      `<span class="t-vio">01</span> isolate by default    <span class="t-dim">host escape and lateral movement are both threats</span>`,
      `<span class="t-vio">02</span> show your work       <span class="t-dim">preview every command, version every prompt</span>`,
      `<span class="t-vio">03</span> right-size the model <span class="t-dim">small and local where it's good enough</span>`,
      `<span class="t-vio">04</span> evidence over hype   <span class="t-dim">incidents and standards, not promises</span>`,
    ],
    projects() {
      if (!projects.length) return [`<span class="t-dim">no projects loaded</span>`];
      const w = Math.max(...projects.map((p) => p.id.length)) + 2;
      return [
        `<span class="t-dim">${pad("ID", w)}STATUS      TAGLINE</span>`,
        ...projects.map((p) => `<span class="t-cyan">${pad(esc(p.id), w)}</span>${pad(esc(p.status || "—"), 12)}${esc(p.tagline)}`),
        `<span class="t-dim">open &lt;id&gt; to read the docs</span>`,
      ];
    },
    ls: (args) => commands.projects(args),
    open(args) {
      const id = args[0];
      const p = projects.find((x) => x.id === id || x.name.toLowerCase() === (id || "").toLowerCase());
      if (!p) return [`<span class="t-err">open: unknown project '${esc(id || "")}'</span> <span class="t-dim">(try: projects)</span>`];
      window.open(p.docs, "_blank", "noopener");
      return [`<span class="t-ok">→</span> opening <a href="${esc(p.docs)}" target="_blank" rel="noopener">${esc(p.docs)}</a>`];
    },
    docs: (args) => commands.open(args),
    breach() {
      actions.breach?.();
      return [
        `<span class="t-warn">⚠ escape attempt staged</span>: every agent pushed against the wall.`,
        `<span class="t-ok">✓ contained.</span> <span class="t-dim">(watch the membrane at the top of the page)</span>`,
      ];
    },
    history: () => history.map((h, i) => `<span class="t-dim">${String(i + 1).padStart(4)}</span>  ${esc(h)}`),
    date: () => [esc(new Date().toString())],
    echo: (args) => [esc(args.join(" "))],
    pwd: () => ["/home/guest"],
    clear() { out.innerHTML = ""; return []; },
    sudo: () => [`<span class="t-err">sudo: guest is not in the sudoers file.</span> <span class="t-dim">This incident will be reported. (Least privilege, working as intended.)</span>`],
    rm(args) {
      if (args.includes("-rf") || args.includes("-fr")) {
        return [`<span class="t-err">rm: refusing to operate on '/'</span>`, `<span class="t-dim">Destructive action blocked. This is why agents get a sandbox and not your laptop.</span>`];
      }
      return [`<span class="t-dim">rm: nothing to remove in a read-only demo</span>`];
    },
    exit: () => [`<span class="t-dim">There is no exit. Only isolation.</span>`],
    curl(args) {
      const url = args.find((a) => /^https?:\/\//.test(a)) || "";
      if (/\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(url)) {
        return [`<span class="t-dim">(you're on the host, not in a sandbox; try: agentctl exec demo -- curl ${esc(url)})</span>`];
      }
      return [`<span class="t-dim">curl: this browser terminal has no network. Try it inside a sandbox: agentctl exec demo -- curl …</span>`];
    },
    "ai-actions": () => [
      `<span class="t-dim">ai-actions isn't installed in this browser sandbox.</span>`,
      `See <a href="https://apomonosi.github.io/ai-microservices/" target="_blank" rel="noopener">apomonosi.github.io/ai-microservices</a>`,
    ],
    agentctl: (args) => agentctl(args),
  };

  function agentctl(args) {
    let preview = false;
    args = args.filter((a) => {
      if (a === "--preview" || a === "--dry-run") { preview = true; return false; }
      return true;
    });
    const [sub, ...rest] = args;
    const name = rest.find((a) => !a.startsWith("-"));
    const flag = (k) => rest.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
    const need = () => {
      if (!name) return [`<span class="t-err">agentctl ${esc(sub)}: missing sandbox name</span>`];
      if (!sandboxes.has(name)) return [`<span class="t-err">Error: instance "${esc(name)}" not found</span>`];
      return null;
    };

    switch (sub) {
      case undefined:
      case "help":
      case "--help":
        return [
          `agentctl: hardened, ephemeral sandboxes for AI agents <span class="t-dim">(simulated)</span>`,
          ``,
          `Usage: agentctl [--preview] &lt;command&gt; [flags]`,
          ``,
          `  create &lt;name&gt; --image=… --profile=…   create a sandbox (stopped)`,
          `  start  &lt;name&gt;                         boot it`,
          `  shell  &lt;name&gt;                         interactive shell inside`,
          `  exec   &lt;name&gt; -- &lt;cmd&gt;                one-shot command inside`,
          `  stop   &lt;name&gt; · delete &lt;name&gt; · list`,
          ``,
          `<span class="t-dim">Docs: </span><a href="https://apomonosi.github.io/sandboxing/" target="_blank" rel="noopener">apomonosi.github.io/sandboxing</a>`,
        ];
      case "create": {
        if (!name) return [`<span class="t-err">agentctl create: missing sandbox name</span>`];
        const image = flag("image") || "images:ubuntu/24.04";
        const profile = flag("profile") || "default";
        if (preview) return [...PREVIEW_CREATE(name, image).map((l) => `<span class="t-vio">${esc(l)}</span>`), `<span class="t-dim"># nothing ran; these are the exact incus commands</span>`];
        if (sandboxes.has(name)) return [`<span class="t-err">Error: instance "${esc(name)}" already exists</span>`];
        sandboxes.set(name, { status: "stopped", image, profile });
        return [
          `Name:      ${esc(name)}`, `Provider:  incus`, `Status:    stopped`, `Image:`, `Profiles:  ${esc(profile)}`, `IPs:`,
        ];
      }
      case "start": {
        const e = need(); if (e) return e;
        if (preview) return [`<span class="t-vio">incus start ${esc(name)}</span>`];
        const s = sandboxes.get(name);
        s.status = "running";
        s.ip = `10.42.0.${10 + sandboxes.size * 7}`;
        return [];
      }
      case "stop": {
        const e = need(); if (e) return e;
        if (preview) return [`<span class="t-vio">incus stop ${esc(name)}</span>`];
        sandboxes.get(name).status = "stopped";
        return [];
      }
      case "delete": {
        const e = need(); if (e) return e;
        if (preview) return [`<span class="t-vio">incus delete ${esc(name)}</span>`, `<span class="t-vio">incus network acl delete agentctl-${esc(name)}</span>`];
        sandboxes.delete(name);
        return [];
      }
      case "list":
      case "ls": {
        if (!sandboxes.size) return [`<span class="t-dim">no sandboxes; try: agentctl create demo --profile=default</span>`];
        return [
          `<span class="t-dim">${pad("NAME", 14)}${pad("STATUS", 10)}${pad("PROFILE", 10)}IP</span>`,
          ...[...sandboxes].map(([n, s]) => `${pad(esc(n), 14)}${s.status === "running" ? `<span class="t-ok">${pad("running", 10)}</span>` : pad("stopped", 10)}${pad(esc(s.profile), 10)}${s.status === "running" ? s.ip : ""}`),
        ];
      }
      case "shell":
      case "exec": {
        const e = need(); if (e) return e;
        const s = sandboxes.get(name);
        if (s.status !== "running") return [`<span class="t-err">Error: instance "${esc(name)}" is not running</span>`];
        if (sub === "shell") return [`<span class="t-dim">(a real shell would open inside ${esc(name)} here; try: agentctl exec ${esc(name)} -- curl http://192.168.1.20/)</span>`];
        const dash = rest.indexOf("--");
        const inner = dash >= 0 ? rest.slice(dash + 1) : [];
        if (!inner.length) return [`<span class="t-err">agentctl exec: missing command after --</span>`];
        if (preview) return [`<span class="t-vio">incus exec ${esc(name)} -- ${esc(inner.join(" "))}</span>`];
        return execInside(inner);
      }
      case "config":
        return [`<span class="t-dim">provider=incus</span>`];
      default:
        return [`<span class="t-err">agentctl: unknown command "${esc(sub)}"</span> <span class="t-dim">(agentctl help)</span>`];
    }
  }

  function execInside(argv) {
    const [cmd, ...a] = argv;
    if (cmd === "curl") {
      const url = a.find((x) => /^https?:\/\//.test(x)) || "";
      if (/\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(url)) {
        return [`curl: (28) Connection timed out`, `<span class="t-dim"># the LAN is unreachable from inside the sandbox: lateral movement blocked</span>`];
      }
      return [`curl: (7) Failed to connect`, `<span class="t-dim"># default-deny egress; this host isn't on the profile's allowlist</span>`];
    }
    if (cmd === "whoami") return ["root"];
    if (cmd === "uname") return ["Linux 6.8.0-generic x86_64 GNU/Linux"];
    if (cmd === "rm") return [`<span class="t-dim"># go ahead: it's ephemeral. agentctl delete and it never happened.</span>`];
    return [`<span class="t-dim">(simulated) ran '${esc(argv.join(" "))}' inside the sandbox</span>`];
  }

  // Simple quote-aware tokenizer.
  function tokenize(s) {
    const t = [];
    s.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, (_, a, b, c) => { t.push(a ?? b ?? c); });
    return t;
  }

  function run(raw) {
    const cmdline = raw.trim();
    echo(cmdline);
    if (!cmdline) return;
    history.push(cmdline);
    hIdx = history.length;
    // support "a | b" by only running the first stage, honestly
    const [first] = cmdline.split("|");
    const [cmd, ...args] = tokenize(first);
    const fn = commands[cmd];
    const res = fn ? fn(args) : [`<span class="t-err">${esc(cmd)}: command not found</span> <span class="t-dim">(type help)</span>`];
    res.forEach((l) => line(l));
  }

  // ---------------------------------------------------------------- input
  const completions = () => [
    ...Object.keys(commands),
    "agentctl create", "agentctl start", "agentctl list", "agentctl exec", "agentctl delete", "agentctl --preview create",
    ...projects.map((p) => `open ${p.id}`),
    ...[...sandboxes.keys()].flatMap((n) => [`agentctl start ${n}`, `agentctl exec ${n} -- `, `agentctl delete ${n}`]),
  ];

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (playing) skip();
      const v = input.value;
      input.value = "";
      run(v);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hIdx > 0) input.value = history[--hIdx];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hIdx < history.length - 1) input.value = history[++hIdx];
      else { hIdx = history.length; input.value = ""; }
    } else if (e.key === "Tab") {
      const v = input.value;
      if (!v) return;
      e.preventDefault();
      const m = completions().filter((c) => c.startsWith(v) && c !== v);
      if (m.length === 1) input.value = m[0] + (m[0].endsWith(" ") ? "" : " ");
      else if (m.length > 1) {
        // extend to the longest common prefix, show options
        let pre = m[0];
        for (const c of m) while (!c.startsWith(pre)) pre = pre.slice(0, -1);
        if (pre.length > v.length) input.value = pre;
        else { echo(v); line(`<span class="t-dim">${m.map(esc).join("   ")}</span>`); }
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      out.innerHTML = "";
    } else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      echo(input.value + "^C");
      input.value = "";
      if (playing) skip();
    }
  });

  input.addEventListener("input", () => { if (playing) skip(); });

  screen.addEventListener("click", () => {
    if (window.getSelection()?.toString()) return;
    if (playing) skip();
    input.focus({ preventScroll: true });
  });

  const setPlaying = (v) => { playing = v; root.classList.toggle("is-playing", v); };

  // ---------------------------------------------------------------- replay
  const SCRIPT = [
    { c: "agentctl --preview create demo --image=images:ubuntu/24.04 --profile=default" },
    { c: "agentctl create demo --image=images:ubuntu/24.04 --profile=default" },
    { c: "agentctl start demo" },
    { c: "agentctl exec demo -- curl -s --connect-timeout 3 http://192.168.1.20/", wait: 1400 },
    { c: "agentctl list" },
  ];

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function intro() {
    line(`<span class="t-dim">apomonosi shell (simulated) · outputs follow the agentctl docs</span>`);
    line(`<span class="t-dim">────────────────────────────────────────────────────────────</span>`);
  }

  function outro() {
    line("");
    line(`<span class="t-ok">✓</span> Your turn. Type <span class="t-cyan">help</span>, or <span class="t-cyan">projects</span>, or <span class="t-cyan">breach</span>.`);
  }

  function skip() {
    if (!playing) return;
    playToken++;
    setPlaying(false);
    out.innerHTML = "";
    sandboxes.clear();
    intro();
    for (const s of SCRIPT) runSilently(s.c);
    outro();
  }

  function runSilently(c) {
    echo(c);
    const [cmd, ...args] = tokenize(c);
    commands[cmd](args).forEach((l) => line(l));
  }

  async function play() {
    const token = ++playToken;
    setPlaying(true);
    out.innerHTML = "";
    sandboxes.clear();
    intro();
    if (reduced) { skip(); return; }
    await sleep(500);
    for (const step of SCRIPT) {
      if (token !== playToken) return;
      const row = line(`<span class="t-p">❯</span><span data-typed></span><span class="t-caret"></span>`, "t-cmd");
      const typed = row.querySelector("[data-typed]");
      for (const ch of step.c) {
        if (token !== playToken) return;
        typed.textContent += ch;
        await sleep(ch === " " ? 40 : 14 + Math.random() * 30);
      }
      await sleep(280);
      if (token !== playToken) return;
      row.querySelector(".t-caret").remove();
      if (step.wait) {
        const w = line(`<span class="t-dim">…</span>`);
        await sleep(step.wait);
        if (token !== playToken) return;
        w.remove();
      }
      const [cmd, ...args] = tokenize(step.c);
      for (const l of commands[cmd](args)) {
        if (token !== playToken) return;
        line(l);
        await sleep(55);
      }
      await sleep(700);
    }
    if (token !== playToken) return;
    setPlaying(false);
    outro();
  }

  replayBtn?.addEventListener("click", () => { play(); });

  // start the replay the first time the terminal scrolls into view
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { io.disconnect(); play(); }
  }, { threshold: 0.35 });
  io.observe(root);

  return {
    replay: play,
    focus() { input.focus({ preventScroll: true }); },
  };
}
