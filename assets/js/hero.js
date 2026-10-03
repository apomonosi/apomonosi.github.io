// Containment field: a few thousand "agents" drift through a flow field inside
// a translucent Voronoi-cell membrane. The cursor attracts them; clicking
// pushes them all outward. Every impact on the membrane is drawn as a flash
// and a ripple. Plain WebGL 1, no libraries.

const MAX_HITS = 12;
const CAM_DIST = 3.4;
const FOCAL = 2.6;            // 1 / tan(fov / 2)
const SHELL = 0.97;           // particle boundary radius (membrane is 1.0)

const QUAD_VS = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const SHELL_FS = `
precision highp float;
uniform vec2  u_res;
uniform vec2  u_center;
uniform float u_scale;
uniform float u_time;
uniform float u_breach;
uniform mat3  u_rotT;          // view -> object
uniform vec4  u_hits[${MAX_HITS}];  // xyz = object-space normal, w = birth time (<0 unused)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}

// x = distance to nearest cell point, y = F2 - F1 (small near cell edges)
vec2 voronoi(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 r = b + hash3(p + b) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  d1 = sqrt(d1); d2 = sqrt(d2);
  return vec2(d1, d2 - d1);
}

float impacts(vec3 n) {
  float e = 0.0;
  for (int i = 0; i < ${MAX_HITS}; i++) {
    vec4 h = u_hits[i];
    if (h.w < 0.0) continue;
    float age = u_time - h.w;
    if (age > 2.6 || age < 0.0) continue;
    float ang = acos(clamp(dot(n, h.xyz), -1.0, 1.0));
    float flash = exp(-ang * ang * 60.0) * exp(-age * 4.0);
    float ring  = exp(-pow((ang - age * 0.9) * 16.0, 2.0)) * exp(-age * 1.8);
    e += flash * 2.2 + ring * 1.3;
  }
  return e;
}

vec3 membrane(vec3 n, vec3 rd, float facing) {
  vec2 v = voronoi(n * 4.2 + vec3(0.0, u_time * 0.03, 0.0));
  float edge = 1.0 - smoothstep(0.0, 0.07, v.y);
  float node = smoothstep(0.12, 0.0, v.x) * 0.6;
  float fres = pow(1.0 - abs(dot(n, rd)), 2.5);
  float scan = exp(-pow((n.y - sin(u_time * 0.4) * 0.9) * 9.0, 2.0));
  float e = impacts(n);

  vec3 cyan = vec3(0.30, 0.91, 1.00);
  vec3 vio  = vec3(0.61, 0.48, 1.00);
  vec3 hot  = vec3(1.00, 0.42, 0.62);

  vec3 col = mix(cyan, vio, 0.5 + 0.5 * n.y) * (edge * (0.07 + 0.55 * fres + 0.35 * scan) + node * 0.12 + fres * 0.22);
  col += mix(hot, vec3(1.0), clamp(e - 0.8, 0.0, 1.0) * 0.5) * e * (0.25 + edge * 0.9);
  col += hot * u_breach * (0.25 + edge * 0.8) * (0.3 + fres);
  return col * facing;
}

void main() {
  vec2 q = (gl_FragCoord.xy - u_center) / (u_scale * ${FOCAL.toFixed(3)});
  vec3 rdV = normalize(vec3(q, -1.0));
  vec3 roV = vec3(0.0, 0.0, ${CAM_DIST.toFixed(3)});

  // background: deep space with a faint halo and sparse twinkling dust
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col = mix(vec3(0.016, 0.022, 0.045), vec3(0.008, 0.010, 0.022), uv.y);
  float b = dot(roV, rdV);
  float closest = sqrt(max(dot(roV, roV) - b * b, 0.0));
  col += vec3(0.20, 0.45, 0.95) * exp(-max(closest - 1.0, 0.0) * 3.2) * 0.10;
  col += vec3(0.55, 0.40, 1.00) * exp(-max(closest - 1.0, 0.0) * 9.0) * 0.06 * (1.0 + u_breach * 3.0);
  vec2 cell = floor(gl_FragCoord.xy / 3.0);
  float s = hash(cell);
  if (s > 0.9965) col += vec3(0.6, 0.75, 1.0) * (0.25 + 0.25 * sin(u_time * 2.0 + s * 300.0));

  // membrane: front and back intersections of the unit sphere
  vec3 ro = u_rotT * roV;
  vec3 rd = u_rotT * rdV;
  float bb = dot(ro, rd);
  float c = dot(ro, ro) - 1.0;
  float h = bb * bb - c;
  if (h > 0.0) {
    h = sqrt(h);
    vec3 nBack  = normalize(ro + rd * (-bb + h));
    vec3 nFront = normalize(ro + rd * (-bb - h));
    col += membrane(nBack, rd, 0.3);
    col += membrane(nFront, rd, 1.0);
    col += vec3(0.25, 0.55, 1.0) * (2.0 * h) * 0.015;   // faint volume fill
  }

  col = 1.0 - exp(-col * 1.4);                           // soft tonemap
  gl_FragColor = vec4(col, 1.0);
}
`;

const POINT_VS = `
attribute vec4 a_p;   // xyz position, w heat
uniform mat3  u_rot;
uniform vec2  u_res;
uniform vec2  u_center;
uniform float u_scale;
uniform float u_dpr;
varying float v_heat;
varying float v_depth;
void main() {
  vec3 v = u_rot * a_p.xyz;
  float z = ${CAM_DIST.toFixed(3)} - v.z;
  vec2 px = u_center + ${FOCAL.toFixed(3)} * v.xy / z * u_scale;
  gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (2.8 + a_p.w * 3.5) * u_dpr * (${CAM_DIST.toFixed(3)} / z);
  v_heat = a_p.w;
  v_depth = clamp((z - ${(CAM_DIST - 1).toFixed(3)}) * 0.5, 0.0, 1.0);
}
`;

const POINT_FS = `
precision mediump float;
varying float v_heat;
varying float v_depth;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  vec3 cool = mix(vec3(0.45, 0.92, 1.0), vec3(0.55, 0.45, 1.0), v_depth);
  vec3 col = mix(cool, vec3(1.0, 0.45, 0.68), clamp(v_heat * 1.4, 0.0, 1.0));
  gl_FragColor = vec4(col * a * (0.95 - v_depth * 0.45 + v_heat * 0.9), 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || "program link failed");
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

// Row-major 3x3 rotation: tilt about X, then spin about Y.
function rotation(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Rx(pitch) * Ry(yaw)
  return [
    cy, 0, sy,
    sp * sy, cp, -sp * cy,
    -cp * sy, sp, cp * cy,
  ];
}
const toColumnMajor = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onHit?: (total: number) => void, reducedMotion?: boolean }} opts
 */
export function initHero(canvas, opts = {}) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL unavailable");

  const shell = program(gl, QUAD_VS, SHELL_FS);
  const points = program(gl, POINT_VS, POINT_FS);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const N = small ? 1600 : 3200;
  const P = new Float32Array(N * 4);   // x y z heat (uploaded)
  const V = new Float32Array(N * 3);   // velocities (CPU only)
  for (let i = 0; i < N; i++) {
    // uniform-ish distribution inside the sphere
    let x, y, z;
    do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; }
    while (x * x + y * y + z * z > SHELL * SHELL * 0.9);
    P[i * 4] = x; P[i * 4 + 1] = y; P[i * 4 + 2] = z; P[i * 4 + 3] = 0;
  }
  const pbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
  gl.bufferData(gl.ARRAY_BUFFER, P, gl.DYNAMIC_DRAW);

  const hits = new Float32Array(MAX_HITS * 4).fill(-1);
  let hitIdx = 0, lastHit = -1, totalHits = 0;

  const state = {
    w: 0, h: 0, dpr: 1, cx: 0, cy: 0, scale: 1,
    yaw: 0, pitch: 0.38, tYaw: 0, tPitch: 0.38,
    mouse: null, mouseT: -10, breach: 0,
    running: false, visible: true, paused: !!opts.reducedMotion,
    t0: performance.now(), last: performance.now(), time: 0,
  };

  function resize() {
    const r = canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    state.w = Math.max(1, Math.round(r.width * state.dpr));
    state.h = Math.max(1, Math.round(r.height * state.dpr));
    canvas.width = state.w;
    canvas.height = state.h;
    gl.viewport(0, 0, state.w, state.h);
    const wide = r.width > 900;
    // Sphere sits to the right of the headline on wide screens, above it on narrow ones.
    state.cx = (wide ? 0.70 : 0.5) * state.w;
    state.cy = (wide ? 0.50 : 0.72) * state.h;
    const base = wide ? Math.min(state.w * 0.42, state.h) : Math.min(state.w, state.h * 0.5);
    state.scale = base * 0.5 * (wide ? 0.95 : 0.8);
    if (state.paused) draw();
  }

  // Map a client-space pointer to an object-space point on the view plane z = 0.
  function pointerToObject(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const px = (clientX - r.left) * state.dpr;
    const py = (r.height - (clientY - r.top)) * state.dpr;
    const qx = (px - state.cx) / (state.scale * FOCAL);
    const qy = (py - state.cy) / (state.scale * FOCAL);
    // ray from (0,0,D) along (qx,qy,-1); hits z=0 at t = D
    let x = qx * CAM_DIST, y = qy * CAM_DIST, z = 0;
    const len = Math.hypot(x, y);
    if (len > 0.85) { x *= 0.85 / len; y *= 0.85 / len; }
    const m = rotation(state.yaw, state.pitch); // object -> view; apply transpose
    return [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z];
  }

  function registerHit(nx, ny, nz, force) {
    if (!force && state.time - lastHit < 0.09) return;
    lastHit = state.time;
    hits[hitIdx * 4] = nx; hits[hitIdx * 4 + 1] = ny; hits[hitIdx * 4 + 2] = nz; hits[hitIdx * 4 + 3] = state.time;
    hitIdx = (hitIdx + 1) % MAX_HITS;
    totalHits++;
    opts.onHit?.(totalHits);
  }

  function step(dt) {
    const k = Math.min(dt / 16.667, 3);
    const t = state.time;
    const damp = Math.pow(0.972, k);
    const flow = 0.00005 * k;
    const jitter = 0.0005 * k;
    const home = 0.00012 * k;
    const m = state.mouse;
    const attract = m && t - state.mouseT < 2.5 ? 0.00028 * k : 0;
    let best = 0, bx = 0, by = 0, bz = 0;

    for (let i = 0; i < N; i++) {
      const o = i * 4, v = i * 3;
      let x = P[o], y = P[o + 1], z = P[o + 2];
      let vx = V[v], vy = V[v + 1], vz = V[v + 2];

      // curl of a sinusoidal vector potential: divergence-free, so agents
      // swirl through the whole volume instead of piling up in sinks
      vx += (-2.4 * Math.sin(2.4 * y - t * 0.35) - 2.3 * Math.cos(2.3 * z - t * 0.5)) * flow;
      vy += (-1.7 * Math.sin(1.7 * z - t * 0.4) - 2.0 * Math.cos(2.0 * x + t * 0.45)) * flow;
      vz += (-1.9 * Math.sin(1.9 * x + t * 0.3) - 2.1 * Math.cos(2.1 * y + t * 0.6)) * flow;
      vx += (Math.random() - 0.5) * jitter - x * home;
      vy += (Math.random() - 0.5) * jitter - y * home;
      vz += (Math.random() - 0.5) * jitter - z * home;

      if (attract) {
        const dx = m[0] - x, dy = m[1] - y, dz = m[2] - z;
        const f = attract / (dx * dx + dy * dy + dz * dz + 0.08);
        vx += dx * f - dy * f * 0.6;     // pull + a little swirl
        vy += dy * f + dx * f * 0.6;
        vz += dz * f;
      }

      vx *= damp; vy *= damp; vz *= damp;
      x += vx * k; y += vy * k; z += vz * k;

      let heat = P[o + 3] * Math.pow(0.955, k);
      const r2 = x * x + y * y + z * z;
      if (r2 > SHELL * SHELL) {
        const r = Math.sqrt(r2);
        const nx = x / r, ny = y / r, nz = z / r;
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn > 0) {
          vx -= 1.7 * vn * nx; vy -= 1.7 * vn * ny; vz -= 1.7 * vn * nz;
          heat = Math.min(1, heat + vn * 90);
          if (vn > best) { best = vn; bx = nx; by = ny; bz = nz; }
        }
        x = nx * SHELL; y = ny * SHELL; z = nz * SHELL;
      }
      P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = heat;
      V[v] = vx; V[v + 1] = vy; V[v + 2] = vz;
    }
    if (best > 0.004) registerHit(bx, by, bz, false);
    state.breach *= Math.pow(0.94, k);
  }

  function draw() {
    const rot = rotation(state.yaw, state.pitch);
    gl.disable(gl.BLEND);

    gl.useProgram(shell.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const aq = gl.getAttribLocation(shell.p, "a_pos");
    gl.enableVertexAttribArray(aq);
    gl.vertexAttribPointer(aq, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(shell.u.u_res, state.w, state.h);
    gl.uniform2f(shell.u.u_center, state.cx, state.cy);
    gl.uniform1f(shell.u.u_scale, state.scale);
    gl.uniform1f(shell.u.u_time, state.time);
    gl.uniform1f(shell.u.u_breach, state.breach);
    gl.uniformMatrix3fv(shell.u.u_rotT, false, rot); // row-major read as column-major = transpose
    gl.uniform4fv(shell.u.u_hits, hits);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(aq);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(points.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, P);
    const ap = gl.getAttribLocation(points.p, "a_p");
    gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap, 4, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix3fv(points.u.u_rot, false, toColumnMajor(rot));
    gl.uniform2f(points.u.u_res, state.w, state.h);
    gl.uniform2f(points.u.u_center, state.cx, state.cy);
    gl.uniform1f(points.u.u_scale, state.scale);
    gl.uniform1f(points.u.u_dpr, state.dpr);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(ap);
  }

  function frame(now) {
    if (!state.running) return;
    const dt = Math.min(now - state.last, 50);
    state.last = now;
    state.time += dt / 1000;
    state.tYaw += dt * 0.00009;
    state.yaw += (state.tYaw - state.yaw) * 0.05;
    state.pitch += (state.tPitch - state.pitch) * 0.05;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function sync() {
    const should = state.visible && !state.paused && !document.hidden;
    if (should && !state.running) {
      state.running = true;
      state.last = performance.now();
      requestAnimationFrame(frame);
    } else if (!should) {
      state.running = false;
    }
  }

  // --- input -------------------------------------------------------------
  const onMove = (e) => {
    state.mouse = pointerToObject(e.clientX, e.clientY);
    state.mouseT = state.time;
    const r = canvas.getBoundingClientRect();
    state.tPitch = 0.38 + ((e.clientY - r.top) / r.height - 0.5) * 0.25;
    opts.onInteract?.();
  };
  const onLeave = () => { state.mouseT = -10; state.tPitch = 0.38; };
  const onClick = (e) => { if (e.button === 0) breach(); };
  const host = canvas.parentElement;
  host.addEventListener("pointermove", onMove, { passive: true });
  host.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onClick);

  function breach() {
    // Kick every agent outward; the membrane holds and lights up where they strike.
    for (let i = 0; i < N; i++) {
      const o = i * 4, v = i * 3;
      const x = P[o], y = P[o + 1], z = P[o + 2];
      const r = Math.hypot(x, y, z) || 1;
      const kick = 0.018 + Math.random() * 0.02;
      V[v] += (x / r) * kick; V[v + 1] += (y / r) * kick; V[v + 2] += (z / r) * kick;
    }
    for (let j = 0; j < 8; j++) {
      const i = (Math.random() * N) | 0;
      const x = P[i * 4], y = P[i * 4 + 1], z = P[i * 4 + 2];
      const r = Math.hypot(x, y, z) || 1;
      registerHit(x / r, y / r, z / r, true);
    }
    state.breach = 1;
    opts.onInteract?.();
    if (state.paused) { step(16); draw(); }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  new IntersectionObserver(([en]) => { state.visible = en.isIntersecting; sync(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener("visibilitychange", sync);

  // warm up so the first frame already looks alive
  for (let i = 0; i < 90; i++) { state.time += 1 / 60; step(16.667); }
  draw();
  sync();

  return {
    agents: N,
    breach,
    setPaused(p) { state.paused = p; sync(); if (p) draw(); },
    get paused() { return state.paused; },
  };
}
