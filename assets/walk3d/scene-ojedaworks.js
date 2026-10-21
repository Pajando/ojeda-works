/* scene-ojedaworks.js — the ojedaworks.com walk-through: "build the crawlers".
 *
 * How Google and AI crawlers read a business website. A calm dark stage; at
 * each stop one simple web page floats in, and a violet scan line (the
 * crawler) sweeps it. First the miss: what it can't read flashes muted red and
 * stays as a dashed empty outline. Then the gain: the gaps fill in, the
 * crawler passes again and every block gets a green tick. The founder and
 * final stops are the door with the gold OW sign, which opens at the end.
 *
 * No words, numbers, logos or brand names are drawn into the scene. All words
 * live in the HTML. (Previous concept kept in scene-ojedaworks-objects.js.)
 */

// 14 stops, DOM order (must match data-station order in the page).
// cam/look are filled in by build() per device tier.
export const POSES = Array.from({ length: 14 }, () => ({ cam: [0, 0, 0], look: [0, 0, 0] }));

const GAP = 14;            // distance between objects along the stage
const Y = 2.0;             // object centre height (tall pages must clear the floor)            // object centre height

export async function buildOjedaWorks(THREE, ctx) {
  const { scene, cam, tier, stations } = ctx;
  const hi = tier === 'high';

  // ---------- poses: camera in front of each object ----------
  // Stops are keyed by their data-station NAME, not position, so the EN and ES pages can
  // order sections differently. The door group (door, faq, open) are always the last three;
  // they share one object and the camera walks closer at each.
  const NAMES = stations.map(st => st.el.dataset.station);
  const at = name => { const i = NAMES.indexOf(name); if (i < 0) throw new Error('missing stop ' + name); return i; };
  const DOOR = ['door', 'faq', 'open'];
  const doorRank = name => DOOR.map(at).sort((a, b) => a - b).indexOf(at(name));
  const DIST = { street: 6.6, car: 6.2, found: 6.4, video: 6.0, web: 6.4, content: 6.4, ads: 8.2, songs: 5.4, steps: 6.2, tools: 5.6, audit: 5.6 };
  // optional laptop intro (index-laptop-preview): stops 'intro' + 'fill' come before 'street'
  const INTRO = ['intro', 'fill'].filter(n => NAMES.includes(n));
  const walkRank = i => i - INTRO.length;
  const zOf = i => -Math.min(Math.max(0, walkRank(i)), NAMES.length - INTRO.length - 3) * GAP;
  const LZ = GAP;                                      // the laptop sits one gap before the first page
  // laptop screen geometry (see buildLaptop): centre + facing direction after the lid tilt
  const LID_TILT = -0.26, SCREEN_C = new THREE.Vector3(0, 1.093, LZ - 1.281), SCREEN_N = new THREE.Vector3(0, 0.257, 0.966);
  // phones, first stop: the page must clear the site header, whose height differs by language
  // (the Spanish nav wraps to an extra line). ~65px per scene unit at this distance; 95px = EN header.
  const hdr = document.querySelector('header.site')?.offsetHeight || 95;
  const heroLift = 0.35 + Math.max(0, hdr - 95) / 65;
  stations.forEach((st, i) => {
    const n = NAMES[i], isDoor = DOOR.includes(n);
    if (n === 'intro') {                                   // the laptop on the stage, a little turned
      // desktop: laptop ~75% of the width; phones: ~95%
      st.cam = hi ? [0, 1.62, LZ + 2.05] : [0, 2.15, LZ + 5.0]; st.look = hi ? [0, 1.0, LZ - 0.6] : [0, 1.22, LZ - 0.6]; return;
    }
    if (n === 'fill') {                                    // square to the screen, close enough that it covers the view
      const c = SCREEN_C.clone().addScaledVector(SCREEN_N, hi ? 1.5 : 2.3);
      st.cam = c.toArray(); st.look = SCREEN_C.toArray(); return;
    }
    // phones: further back = smaller object, so it fits the strip above the text
    const k = hi ? 1.1 : (isDoor ? 2.2 : n === 'street' ? 2.25 : 1.75);
    const d = (isDoor ? [9.2, 7.4, 5.6][doorRank(n)] : DIST[n]) * k;
    const z = zOf(i);
    // phone hero: aim a little high so the page clears the site header
    const lookY = (isDoor ? 2.0 : Y) + (!hi && n === 'street' ? heroLift : 0);
    // offsets keep the right-hand tick column on screen and the content clear of the text panel
    const lx = !hi ? (n === 'street' ? 1.0 : n === 'ads' ? 0.5 : 0.45)
      : n === 'ads' ? 1.4 : (n === 'steps' || n === 'tools') ? -0.9 : n === 'audit' ? -0.5 : 0;
    st.cam = [lx, lookY + 0.25, z + d];
    st.look = [lx, lookY, z];
  });

  // ---------- stage ----------
  const sky = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 512;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#06080f'); gr.addColorStop(0.45, '#0c0f1e');
    gr.addColorStop(0.62, '#16143a'); gr.addColorStop(1, '#0a0c16');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  scene.background = sky;
  scene.fog = new THREE.Fog(0x100f26, 14, 34);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 260),
    new THREE.MeshStandardMaterial({ color: 0x0c0e19, roughness: 0.32, metalness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -80); scene.add(floor);

  scene.add(new THREE.HemisphereLight(0x8d97c9, 0x0a0a12, hi ? 0.9 : 1.1));
  const key = new THREE.PointLight(0xfff3e4, hi ? 60 : 50, 18, 1.4);   // follows the camera
  const rim = new THREE.PointLight(0x7b5cff, hi ? 45 : 35, 14, 1.4);   // violet from behind
  scene.add(key, rim);

  // ---------- helpers ----------
  const tex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = hi ? 4 : 1; return t;
  };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  const roundedShape = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  const slab = (w, h, r, depth, color, rough = 0.45, metal = 0.2) => {
    const geo = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth, bevelEnabled: true,
      bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: hi ? 10 : 5 });
    geo.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  };
  const face = (w, h, map, z) => {          // self-lit picture on the front of a slab
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, toneMapped: false }));
    m.position.z = z; return m;
  };
  const poolTex = tex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });

  const objects = [];   // { group, z, stops:[i..], pool, spin }
  const add = (stops, group, opts = {}) => {
    const holder = new THREE.Group();
    const z = zOf(stops[0]);
    holder.position.set(0, opts.y ?? Y, z);
    holder.add(group); holder.visible = false; scene.add(holder);
    const pm = new THREE.MeshBasicMaterial({ map: poolTex, color: opts.pool ?? 0x5b3fd0,
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), pm);
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.01, z); scene.add(pool);
    const o = { holder, group, z, stops, pool, sway: opts.sway ?? 0.32, vis: 0, update: opts.update };
    objects.push(o); return o;
  };

  const clamp01 = x => Math.min(1, Math.max(0, x));
  const sstep = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

  // ======================================================================
  // "How Google and AI crawlers read a business website."
  // Every stop is a simple page on the stage. A violet scan line (the
  // crawler) sweeps it. MISS: what it can't read flashes muted red and stays
  // as a dashed empty outline. GAIN: the gaps fill in, the crawler passes
  // again and every block gets a green tick. No words, numbers or logos.
  // ======================================================================
  const RED = 0xb85656, GREEN = 0x3fae7a, VIOLET_BEAM = 0x8a6bff;
  const PAGE = '#f2eee4', INKC = '#0f1420', GREY = '#9aa0b6', LIGHT = '#d9d4e6';
  const PX = 180;                                   // canvas pixels per scene unit
  const TS = hi ? 0.85 : 1.02;                      // tick size (Alejandro: 'make the checkmarks bigger')

  const drawers = {
    header: (c, w, h) => { c.fillStyle = INKC; rr(c, 0, 0, w, h, 10); c.fillStyle = '#e9e6f2'; for (let i = 0; i < 3; i++) rr(c, w - 40 - i * 46, h / 2 - 5, 30, 10, 5); },
    name: (c, w, h) => { c.fillStyle = INKC; rr(c, 0, 4, w * 0.8, h * 0.5, 8); c.fillStyle = GREY; rr(c, 0, h * 0.68, w * 0.55, h * 0.18, 6); },
    lines: (c, w, h) => { c.fillStyle = GREY; const n = Math.max(2, Math.round(h / 24)); for (let i = 0; i < n; i++) rr(c, 0, 6 + i * (h - 8) / n, w * (i === n - 1 ? 0.6 : 0.95), Math.min(12, (h - 8) / n * 0.5), 6); },
    image: (c, w, h) => { c.fillStyle = '#c9cfdc'; rr(c, 0, 0, w, h, 12); c.fillStyle = '#9aa4b8'; c.beginPath(); c.moveTo(w * 0.1, h * 0.85); c.lineTo(w * 0.4, h * 0.4); c.lineTo(w * 0.6, h * 0.65); c.lineTo(w * 0.72, h * 0.5); c.lineTo(w * 0.92, h * 0.85); c.fill(); c.beginPath(); c.arc(w * 0.75, h * 0.25, h * 0.1, 0, Math.PI * 2); c.fill(); },
    hours: (c, w, h) => { c.strokeStyle = INKC; c.lineWidth = 6; const r = h * 0.3; c.beginPath(); c.arc(r + 8, h / 2, r, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(r + 8, h / 2); c.lineTo(r + 8, h / 2 - r * 0.6); c.moveTo(r + 8, h / 2); c.lineTo(r + 8 + r * 0.5, h / 2); c.stroke(); c.fillStyle = GREY; for (let i = 0; i < 3; i++) rr(c, r * 2 + 30, h * 0.22 + i * h * 0.22, w - r * 2 - 40, 10, 5); },
    address: (c, w, h) => { const r = h * 0.2, cx = r + 10; c.fillStyle = INKC; c.beginPath(); c.arc(cx, h * 0.38, r, Math.PI, 0); c.lineTo(cx, h * 0.85); c.closePath(); c.fill(); c.fillStyle = PAGE; c.beginPath(); c.arc(cx, h * 0.38, r * 0.4, 0, Math.PI * 2); c.fill(); c.fillStyle = GREY; for (let i = 0; i < 2; i++) rr(c, r * 2 + 30, h * 0.3 + i * h * 0.28, w - r * 2 - 40, 10, 5); },
    menu: (c, w, h) => { const n = 4; for (let i = 0; i < n; i++) { const y = 8 + i * (h - 8) / n; c.fillStyle = INKC; rr(c, 0, y, 18, 18, 4); c.fillStyle = GREY; rr(c, 30, y + 4, w * 0.6, 10, 5); c.fillStyle = LIGHT; rr(c, w - 70, y + 4, 60, 10, 5); } },
    reviews: (c, w, h) => { c.fillStyle = INKC; for (let i = 0; i < 5; i++) { const cx = 16 + i * 34, cy = h * 0.4, R = 13; c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? R * 0.45 : R; c.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } c.fill(); } c.fillStyle = GREY; rr(c, 0, h * 0.75, w * 0.7, 9, 4); },
    call: (c, w, h) => { c.fillStyle = INKC; rr(c, 0, 0, w, h, h / 2); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(h / 2 + 4, h / 2, h * 0.18, 0.6, Math.PI * 1.4); c.stroke(); c.fillStyle = '#e9e6f2'; rr(c, h, h / 2 - 6, w - h * 1.4, 12, 6); },
    video: (c, w, h) => { c.fillStyle = INKC; rr(c, 0, 0, w, h, 12); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w / 2 - h * 0.12, h / 2 - h * 0.17); c.lineTo(w / 2 + h * 0.16, h / 2); c.lineTo(w / 2 - h * 0.12, h / 2 + h * 0.17); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; rr(c, 16, h - 18, w - 32, 6, 3); },
    car: (c, w, h) => { c.fillStyle = '#121418'; rr(c, 0, 0, w, h, 12); c.fillStyle = '#b8b2a6'; const y = h * 0.62, s = w / 300;
      c.beginPath(); c.moveTo(22 * s, y + 40 * s); c.lineTo(22 * s, y); c.lineTo(70 * s, y - 8 * s); c.lineTo(104 * s, y - 56 * s); c.lineTo(170 * s, y - 58 * s); c.lineTo(182 * s, y - 8 * s); c.lineTo(280 * s, y - 6 * s); c.lineTo(280 * s, y + 40 * s); c.closePath(); c.fill();
      c.fillStyle = '#050506'; for (const x of [76, 228]) { c.beginPath(); c.arc(x * s, y + 42 * s, 24 * s, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w / 2 - 12, h * 0.25 - 16); c.lineTo(w / 2 + 16, h * 0.25); c.lineTo(w / 2 - 12, h * 0.25 + 16); c.fill(); },
    caption: (c, w, h) => { c.fillStyle = INKC; rr(c, 0, 0, w, h, 8); c.fillStyle = '#e9e6f2'; rr(c, 14, h / 2 - 5, w * 0.6, 10, 5); rr(c, w * 0.66, h / 2 - 5, w * 0.24, 10, 5); },
    transcript: (c, w, h) => { c.fillStyle = '#e6e1f0'; rr(c, 0, 0, w, h, 10); c.fillStyle = INKC; const n = 3; for (let i = 0; i < n; i++) { rr(c, 14, 12 + i * (h - 16) / n, 30, 10, 5); c.fillStyle = GREY; rr(c, 54, 12 + i * (h - 16) / n, w * (0.7 - i * 0.12), 10, 5); c.fillStyle = INKC; } },
    question: (c, w, h) => { c.strokeStyle = INKC; c.lineWidth = 6; c.beginPath(); c.roundRect(4, 4, w - 8, h - 22, 18); c.stroke(); c.beginPath(); c.moveTo(30, h - 18); c.lineTo(22, h - 2); c.lineTo(50, h - 18); c.stroke(); c.fillStyle = INKC; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(w / 2 - 30 + i * 30, (h - 18) / 2, 8, 0, Math.PI * 2); c.fill(); } },
    answer: (c, w, h) => { c.fillStyle = '#e6e1f0'; rr(c, 0, 0, w, h - 16, 18); c.beginPath(); c.moveTo(w - 50, h - 16); c.lineTo(w - 26, h); c.lineTo(w - 26, h - 16); c.fill(); c.fillStyle = INKC; rr(c, 18, 16, w * 0.35, 14, 7); c.fillStyle = GREY; for (let i = 0; i < 2; i++) rr(c, 18, 44 + i * 24, w * (0.8 - i * 0.2), 10, 5); },
    tile: (c, w, h) => { c.fillStyle = '#e6e1f0'; rr(c, 0, 0, w, h, 12); c.fillStyle = INKC; rr(c, 14, 14, w * 0.3, h * 0.3, 6); c.fillStyle = GREY; rr(c, 14, h * 0.6, w * 0.7, 9, 4); rr(c, 14, h * 0.78, w * 0.5, 9, 4); },
    ad: (c, w, h) => { c.fillStyle = INKC; rr(c, 0, 0, w, h, 12); c.fillStyle = '#e9e6f2'; rr(c, 14, 14, w * 0.5, 12, 6); rr(c, 14, 36, w * 0.35, 10, 5); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w * 0.62, h * 0.7); c.lineTo(w - 18, h * 0.7); c.lineTo(w - 34, h * 0.56); c.moveTo(w - 18, h * 0.7); c.lineTo(w - 34, h * 0.84); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke(); },
    toolBars: (c, w, h) => { c.fillStyle = '#e6e1f0'; rr(c, 0, 0, w, h, 14); c.fillStyle = INKC; [0.35, 0.55, 0.75].forEach((f, i) => rr(c, w * 0.2 + i * w * 0.22, h * (0.88 - f), w * 0.14, h * f - h * 0.12, 5)); },
    toolBrowser: (c, w, h) => { c.fillStyle = '#e6e1f0'; rr(c, 0, 0, w, h, 14); c.strokeStyle = INKC; c.lineWidth = 7; c.strokeRect(w * 0.16, h * 0.2, w * 0.68, h * 0.6); c.fillStyle = INKC; c.fillRect(w * 0.16, h * 0.2, w * 0.68, h * 0.12); c.fillStyle = GREY; rr(c, w * 0.24, h * 0.5, w * 0.4, 10, 5); },
    toolQR: (c, w, h) => { c.fillStyle = '#e6e1f0'; rr(c, 0, 0, w, h, 14); c.fillStyle = INKC; const u = w / 10; const q = (x, y) => { c.fillRect(x, y, 2.4 * u, 2.4 * u); c.fillStyle = '#e6e1f0'; c.fillRect(x + 0.45 * u, y + 0.45 * u, 1.5 * u, 1.5 * u); c.fillStyle = INKC; c.fillRect(x + 0.8 * u, y + 0.8 * u, 0.8 * u, 0.8 * u); }; q(1.5 * u, 1.5 * u); q(6.1 * u, 1.5 * u); q(1.5 * u, 6.1 * u); let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (r() < 0.5) c.fillRect((4.6 + i * 0.9) * u, (4.6 + j * 0.9) * u, 0.75 * u, 0.75 * u); },
    cell: (c, w, h) => { c.strokeStyle = '#b8b2c8'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) * 0.36, 0, Math.PI * 2); c.stroke(); },
    blank: (c, w, h) => { c.fillStyle = '#e6e1f0'; rr(c, 0, 0, w, h, 12); },
  };
  const texCache = new Map();
  const blockTex = (kind, w, h) => {
    const key = kind + w.toFixed(2) + 'x' + h.toFixed(2);
    if (!texCache.has(key)) texCache.set(key, tex(Math.max(16, Math.round(w * PX)), Math.max(16, Math.round(h * PX)), (c, cw, ch) => drawers[kind](c, cw, ch)));
    return texCache.get(key);
  };
  const dashTex = (w, h) => tex(Math.max(16, Math.round(w * PX)), Math.max(16, Math.round(h * PX)), (c, cw, ch) => {
    c.strokeStyle = '#c86a6a'; c.lineWidth = 5; c.setLineDash([16, 11]);
    c.beginPath(); c.roundRect(4, 4, cw - 8, ch - 8, 12); c.stroke();
  });
  const tickTex = tex(96, 96, c => {   // bright green, white check
    c.fillStyle = '#22c55e'; c.beginPath(); c.arc(48, 48, 44, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 12; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(27, 50); c.lineTo(42, 64); c.lineTo(69, 34); c.stroke();
  });
  const beamTex = tex(8, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const basic = (opts) => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false, ...opts });

  /* makePage(spec)
     spec.W, spec.H        page size (0 = no paper behind, e.g. the audit grid)
     spec.blocks: [{kind, x, y, w, h, miss, unread, tickPass, broken:[dx,dy,rot], tickAt}]
       miss    – not there on pass 1: red flash, then a dashed empty outline; fills in later
       unread  – there, but the crawler can't read it: red flash + outline, cleared later
     spec.passes: [{start, dur, role:'flag'|'tick'}]  (seconds after arrival)
     spec.fill: {start, dur}                           when the gaps fill in
     spec.extra(group, tau, api) optional per-stop extra animation */
  function makePage(spec) {
    const g = new THREE.Group();
    const { W, H } = spec;
    if (W) {
      const paper = slab(W, H, 0.12, 0.05, 0xf2eee4, 0.7, 0.02); g.add(paper);
    }
    const Z = 0.05;
    const passes = spec.passes || [{ start: 0.3, dur: 1.3, role: 'flag' }, { start: 2.7, dur: 1.3, role: 'tick' }];
    const fill = spec.fill || { start: 1.9, dur: 0.6 };
    const lastTick = passes.map((p, i) => p.role === 'tick' ? i : -1).filter(i => i >= 0).pop();
    const top = (spec.scanTop ?? H / 2) + 0.12, bot = (spec.scanBot ?? -H / 2) - 0.12;
    const beamW = (spec.beamW ?? W) + 0.5;
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(beamW, 0.22), basic({ map: beamTex, color: VIOLET_BEAM, blending: THREE.AdditiveBlending, opacity: 0 }));
    const beamCore = new THREE.Mesh(new THREE.PlaneGeometry(beamW, 0.012), basic({ color: 0xc8b8ff, opacity: 0 }));
    beam.position.z = Z + 0.06; beamCore.position.z = Z + 0.065; g.add(beam, beamCore);

    const B = spec.blocks.map(b => {
      const grp = new THREE.Group(); grp.position.set(b.x, b.y, Z); g.add(grp);
      const fillM = basic({ map: blockTex(b.kind, b.w, b.h), opacity: b.miss ? 0 : 1 });
      const fillP = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), fillM); grp.add(fillP);
      const red = new THREE.Mesh(new THREE.PlaneGeometry(b.w + 0.04, b.h + 0.04), basic({ color: RED, opacity: 0 })); red.position.z = 0.004; grp.add(red);
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(b.w + 0.06, b.h + 0.06), basic({ map: dashTex(b.w + 0.06, b.h + 0.06), opacity: 0 })); dash.position.z = 0.006; grp.add(dash);
      // audit cells carry their own tick in the middle; every other block is ticked per row (below)
      let tick = null;
      if (b.tickAt === 'center') {
        const ts = Math.min(b.w, b.h) * 0.95;
        tick = new THREE.Mesh(new THREE.PlaneGeometry(ts, ts), basic({ map: tickTex, opacity: 0 }));
        tick.position.set(0, 0, 0.01); grp.add(tick);
      }
      return { b, grp, fillM, red, dash, tick, tp: b.tickPass ?? lastTick };
    });
    // Row ticks: one big tick per row of blocks, in a column just past the page's right edge
    // (overlapping the edge), so they never crowd the blocks, never cover the call button,
    // and never overlap each other (second column / nudged down when rows are close).
    const rowTicks = [];
    {
      const items = B.filter(o => !o.b.tickAt && !o.b.noTick).sort((a, c) => c.b.y - a.b.y);
      const rows = [];
      for (const o of items) {
        const r = rows.find(r => Math.abs(r.y - o.b.y) < 0.3 && r.tp === o.tp);
        if (r) { r.m.push(o); r.y = r.m.reduce((a, q) => a + q.b.y, 0) / r.m.length; } else rows.push({ y: o.b.y, tp: o.tp, m: [o] });
      }
      const pageRight = W ? W / 2 : Math.max(...items.map(o => o.b.x + o.b.w / 2));
      const callRight = Math.max(-99, ...items.filter(o => o.b.kind === 'call').map(o => o.b.x + o.b.w / 2));
      const x1 = Math.max(pageRight + TS * 0.35, callRight + TS / 2 + 0.04), x2 = x1 + TS * 1.02;
      const placed = [];
      const free = (x, y) => placed.every(p => Math.hypot(p.x - x, p.y - y) >= TS * 1.04);
      for (const r of rows) {
        let y = r.y, spot = null;
        for (let n = 0; n < 80 && !spot; n++, y -= 0.05) {
          if (free(x1, y)) spot = [x1, y]; else if (free(x2, y)) spot = [x2, y];
        }
        if (!spot) spot = [x1, r.y];
        placed.push({ x: spot[0], y: spot[1] });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(TS, TS), basic({ map: tickTex, opacity: 0 }));
        m.position.set(spot[0], spot[1], Z + 0.08); g.add(m);
        rowTicks.push({ m, y: r.y, tp: r.tp });
      }
    }
    const popTick = (m, tl) => {                                        // pop: 0 -> 1.15 -> 1
      const pop = tl < 0.65 ? 1.15 * sstep(tl / 0.65) : 1.15 - 0.15 * sstep((tl - 0.65) / 0.35);
      m.material.opacity = clamp01(tl * 3); m.visible = tl > 0.002; m.scale.setScalar(Math.max(0.001, pop));
    };
    // time at which a pass crosses height y
    const crossT = (p, y) => p.start + p.dur * clamp01((top - y) / (top - bot));
    return {
      group: g,
      update(tau, t) {
        // beam
        let on = 0, by = top;
        for (const p of passes) {
          const f = (tau - p.start) / p.dur;
          if (f >= -0.05 && f <= 1.05) { on = Math.max(on, sstep(Math.min(f + 0.05, 1.05 - f) * 8)); by = top + (bot - top) * clamp01(f); }
        }
        beam.position.y = beamCore.position.y = by;
        beam.material.opacity = 0.55 * on; beamCore.material.opacity = 0.9 * on;
        beam.visible = beamCore.visible = on > 0.01;
        const fk = sstep((tau - fill.start) / fill.dur);
        for (const o of B) {
          const { b } = o;
          const flagP = passes.find(p => p.role === 'flag');
          const tf = flagP ? crossT(flagP, b.y) : Infinity;
          const flagged = (b.miss || b.unread) ? sstep((tau - tf) / 0.15) : 0;
          // red flash peaks right after the beam passes, settles to a faint tint, clears on fill
          const flash = flagged * (0.18 + 0.5 * Math.exp(-Math.max(0, tau - tf) * 3)) * (1 - fk);
          o.red.material.opacity = flash; o.red.visible = flash > 0.005;
          o.dash.material.opacity = flagged * (1 - fk); o.dash.visible = o.dash.material.opacity > 0.005;
          if (b.miss) o.fillM.opacity = fk;
          if (b.broken) {
            const [dx, dy, rot] = b.broken, k = 1 - fk;
            o.grp.position.set(b.x + dx * k, b.y + dy * k, Z); o.grp.rotation.z = rot * k;
          }
          if (o.tick) {
            const tp = passes[o.tp], tt = tp ? crossT(tp, b.y) : Infinity;
            popTick(o.tick, clamp01((tau - tt) / 0.3));
          }
        }
        for (const r of rowTicks) {
          const tp = passes[r.tp], tt = tp ? crossT(tp, r.y) : Infinity;
          popTick(r.m, clamp01((tau - tt) / 0.3));
        }
        if (spec.extra) spec.extra(g, tau, t);
      }
    };
  }
  const pageStop = (stops, spec, opts = {}) => {
    const p = makePage(spec);
    add(stops, p.group, { sway: 0.1, ...opts, update: (o, t, dt, st) => p.update(o.hold || 0, t) });
    return p;
  };

  // ---------- 0 hero: the whole page, read badly, then read well; the business lifts out ----------
  {
    const card = new THREE.Group();
    const cardSlab = slab(1.7, 0.78, 0.12, 0.06, 0xf2eee4, 0.6, 0.02); card.add(cardSlab);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.94), basic({ color: GREEN, opacity: 0 })); glow.position.z = -0.04; card.add(glow);
    const cn = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.2), basic({ map: blockTex('name', 1.0, 0.2) })); cn.position.set(-0.25, 0.2, 0.06); card.add(cn);
    const cr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.2), basic({ map: blockTex('reviews', 0.9, 0.2) })); cr.position.set(-0.3, -0.16, 0.06); card.add(cr);
    const cc = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), basic({ map: blockTex('call', 0.5, 0.2) })); cc.position.set(0.5, -0.16, 0.06); card.add(cc);
    // same size as the page ticks once the card has scaled to 1.1 and come 1.2 units closer
    const ct = new THREE.Mesh(new THREE.PlaneGeometry(TS / 1.1 * 0.85, TS / 1.1 * 0.85), basic({ map: tickTex })); ct.position.set(-0.2, 0.39 + TS * 0.3, 0.08); card.add(ct);
    card.visible = false;
    pageStop([at('street')], {
      W: 2.4, H: 3.2,
      // whole read in ~2.4s after arrival: red pass, fill, green pass; then the card lifts
      passes: [{ start: 0.15, dur: 0.9, role: 'flag' }, { start: 1.5, dur: 0.9, role: 'tick' }],
      fill: { start: 1.1, dur: 0.4 },
      blocks: [
        { kind: 'header', x: 0, y: 1.38, w: 2.2, h: 0.2 },
        { kind: 'name', x: -0.35, y: 1.03, w: 1.5, h: 0.28 },
        { kind: 'image', x: -0.45, y: 0.42, w: 1.3, h: 0.78, unread: true },
        { kind: 'caption', x: -0.45, y: -0.08, w: 1.3, h: 0.14, miss: true },
        { kind: 'hours', x: 0.72, y: 0.62, w: 0.72, h: 0.38, miss: true },
        { kind: 'address', x: 0.72, y: 0.12, w: 0.72, h: 0.38, miss: true },
        { kind: 'menu', x: 0, y: -0.58, w: 2.2, h: 0.66, miss: true },
        { kind: 'reviews', x: -0.5, y: -1.2, w: 1.2, h: 0.3 },
        { kind: 'call', x: 0.62, y: -1.2, w: 0.8, h: 0.3 },
      ],
      extra: (g, tau) => {
        if (!card.parent) g.add(card);
        const k = sstep((tau - 2.5) / 0.7);
        card.visible = k > 0.01;
        card.position.set(-0.45 * k, -0.25 * k, 0.1 + 1.1 * k);
        card.scale.setScalar(0.6 + 0.5 * k);
        glow.material.opacity = 0.35 * k;
      }
    });
  }

  // ---------- 1 car promo: a car video the crawler can't read -> captioned, read ----------
  pageStop([at('car')], { W: 1.7, H: 2.9, blocks: [
    { kind: 'header', x: 0, y: 1.28, w: 1.5, h: 0.16 },
    { kind: 'car', x: 0, y: 0.25, w: 1.5, h: 1.8, unread: true },
    { kind: 'caption', x: 0, y: -0.85, w: 1.5, h: 0.16, miss: true },
    { kind: 'call', x: 0, y: -1.18, w: 1.0, h: 0.26 },
  ] });

  // ---------- 2 what you get: four things a business needs; two are missing -> all there ----------
  pageStop([at('found')], { W: 2.4, H: 3.0, blocks: [
    { kind: 'header', x: 0, y: 1.28, w: 2.2, h: 0.2 },
    { kind: 'name', x: -0.4, y: 0.92, w: 1.4, h: 0.26 },
    { kind: 'video', x: -0.56, y: 0.28, w: 1.0, h: 0.66 },
    { kind: 'image', x: 0.56, y: 0.28, w: 1.0, h: 0.66, miss: true },
    { kind: 'answer', x: -0.56, y: -0.52, w: 1.0, h: 0.66, miss: true },
    { kind: 'ad', x: 0.56, y: -0.52, w: 1.0, h: 0.66 },
    { kind: 'call', x: 0, y: -1.12, w: 1.0, h: 0.26 },
  ] }, { pool: 0x6a5aa0 });

  // ---------- 3 video: a video the crawler can't read -> with a transcript it can ----------
  pageStop([at('video')], { W: 2.8, H: 2.6, blocks: [
    { kind: 'header', x: 0, y: 1.1, w: 2.6, h: 0.18 },
    { kind: 'video', x: 0, y: 0.35, w: 2.4, h: 1.2, unread: true },
    { kind: 'transcript', x: 0, y: -0.6, w: 2.4, h: 0.5, miss: true },
    { kind: 'call', x: 0.75, y: -1.06, w: 0.9, h: 0.22 },
  ] });

  // ---------- 4 web: a jumbled layout -> clear structure ----------
  pageStop([at('web')], { W: 2.6, H: 3.0, blocks: [
    { kind: 'header', x: 0, y: 1.28, w: 2.4, h: 0.2, broken: [0.1, -0.05, 0.03] },
    { kind: 'name', x: -0.45, y: 0.9, w: 1.5, h: 0.28, broken: [0.5, -0.3, -0.12] },
    { kind: 'lines', x: -0.45, y: 0.45, w: 1.5, h: 0.4, broken: [0.35, 0.25, 0.1], unread: true },
    { kind: 'image', x: 0.75, y: 0.62, w: 0.9, h: 0.75, broken: [-0.6, -0.5, 0.18], unread: true },
    { kind: 'tile', x: -0.8, y: -0.35, w: 0.72, h: 0.7, broken: [0.25, -0.45, -0.2] },
    { kind: 'tile', x: 0, y: -0.35, w: 0.72, h: 0.7, miss: true },
    { kind: 'tile', x: 0.8, y: -0.35, w: 0.72, h: 0.7, broken: [-0.2, 0.3, 0.15] },
    { kind: 'call', x: 0, y: -1.1, w: 1.1, h: 0.28, miss: true },
  ] });

  // ---------- 5 content: questions nobody answered -> answered ----------
  pageStop([at('content')], { W: 2.4, H: 3.0, blocks: [
    { kind: 'header', x: 0, y: 1.28, w: 2.2, h: 0.2 },
    { kind: 'question', x: -0.45, y: 0.82, w: 1.3, h: 0.5 },
    { kind: 'answer', x: 0.3, y: 0.22, w: 1.6, h: 0.62, miss: true },
    { kind: 'question', x: -0.45, y: -0.42, w: 1.3, h: 0.5 },
    { kind: 'answer', x: 0.3, y: -1.02, w: 1.6, h: 0.62, miss: true },
  ] }, { pool: 0x6a5aa0 });

  // ---------- 6 advertising: an ad pointing at a page with no call button -> it lands on the button ----------
  {
    const arrow = new THREE.Group();
    const shaftM = basic({ color: VIOLET_BEAM, opacity: 0 });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.03), shaftM); arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.07, 3), shaftM); arrow.add(head);
    const A = hi ? new THREE.Vector2(2.85, 0.4) : new THREE.Vector2(-0.3, 1.68), Bp = new THREE.Vector2(0.95, -1.0);
    pageStop([at('ads')], { W: 2.2, H: 3.0, scanTop: 1.5, scanBot: -1.5, beamW: 2.2, blocks: [
      { kind: 'ad', x: hi ? 3.3 : -0.5, y: hi ? 0.75 : 2.05, w: 1.0, h: 0.66, noTick: true },
      { kind: 'header', x: 0, y: 1.28, w: 2.0, h: 0.2 },
      { kind: 'name', x: -0.3, y: 0.9, w: 1.3, h: 0.26 },
      { kind: 'lines', x: 0, y: 0.25, w: 2.0, h: 0.6 },
      { kind: 'reviews', x: -0.4, y: -0.45, w: 1.1, h: 0.28 },
      { kind: 'call', x: 0.35, y: -1.1, w: 1.0, h: 0.3, miss: true },
    ], extra: (g, tau) => {
      if (!arrow.parent) { g.add(arrow); arrow.position.z = 0.12; }
      const k = sstep((tau - 2.3) / 0.6);
      const len = A.distanceTo(Bp) * k, ang = Math.atan2(Bp.y - A.y, Bp.x - A.x);
      shaft.scale.x = Math.max(0.001, len - 0.1); shaft.position.set(A.x + Math.cos(ang) * (len - 0.1) / 2, A.y + Math.sin(ang) * (len - 0.1) / 2, 0);
      head.position.set(A.x + Math.cos(ang) * (len - 0.05), A.y + Math.sin(ang) * (len - 0.05), 0); head.rotation.z = ang;
      shaftM.opacity = k * 0.9; arrow.visible = k > 0.01;
    } }, { pool: 0x6a5aa0 });
  }

  // ---------- 8 how it works: the crawler passes three times, one row lights per pass ----------
  pageStop([at('steps')], { W: 2.4, H: 2.8,
    passes: [{ start: 0.3, dur: 1.1, role: 'tick' }, { start: 1.6, dur: 1.1, role: 'tick' }, { start: 2.9, dur: 1.1, role: 'tick' }],
    blocks: [0, 1, 2].flatMap(r => [
      { kind: 'tile', x: -0.6, y: 0.85 - r * 0.85, w: 1.0, h: 0.62, tickPass: r },
      { kind: 'lines', x: 0.55, y: 0.85 - r * 0.85, w: 0.95, h: 0.42, tickPass: r },
    ]) }, { pool: 0x6a5aa0 });

  // ---------- 9 free tools: three blank tiles -> three tools the crawler lights ----------
  pageStop([at('tools')], { W: 0, H: 1.2, beamW: 3.6, scanTop: 0.5, scanBot: -0.5, blocks: [
    { kind: 'toolBars', x: -1.15, y: 0, w: 1.0, h: 1.0, miss: true },
    { kind: 'toolBrowser', x: 0, y: 0, w: 1.0, h: 1.0, miss: true },
    { kind: 'toolQR', x: 1.15, y: 0, w: 1.0, h: 1.0, miss: true },
  ] }, { pool: 0x6a5aa0 });

  // ---------- 10 the audit: 21 small checks; the problems show red, then every one ticks ----------
  {
    const bad = new Set([2, 6, 9, 13, 15, 19]);
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
      const i = r * 7 + c;
      cells.push({ kind: 'cell', x: (c - 3) * 0.34, y: 0.36 - r * 0.36, w: 0.3, h: 0.3, tickAt: 'center', unread: bad.has(i) });
    }
    pageStop([at('audit')], { W: 2.7, H: 1.6, blocks: [
      { kind: 'header', x: 0, y: 0.68, w: 2.5, h: 0.12 },
      ...cells.map(c => ({ ...c, y: c.y - 0.05 })),
    ] });
  }

  // ---------- 7 custom songs line: kept minimal and calm — a record turning slowly ----------
  {
    const g = new THREE.Group();
    const rec = tex(512, 512, (c, w) => {
      c.fillStyle = '#0b0b0e'; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
      for (let r = 80; r < w / 2 - 6; r += 6) { c.beginPath(); c.arc(w / 2, w / 2, r, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = '#5b21e0'; c.beginPath(); c.arc(w / 2, w / 2, 68, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f2eee4'; c.fillRect(w / 2 + 16, w / 2 - 6, 34, 12);
      c.fillStyle = '#0b0b0e'; c.beginPath(); c.arc(w / 2, w / 2, 7, 0, Math.PI * 2); c.fill();
    });
    const top = new THREE.MeshStandardMaterial({ map: rec, roughness: 0.3, metalness: 0.3 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.3 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.03, hi ? 64 : 32), [edge, top, top]);
    disc.rotation.x = Math.PI / 2 - 0.12; disc.position.y = 0; disc.scale.setScalar(0.8); g.add(disc);
    const bars = [], bm = new THREE.MeshBasicMaterial({ color: 0xff2e88, toneMapped: false });
    add([at('songs')], g, { pool: 0x6a5aa0, sway: 0.18, update: (o, t, dt, st, k) => {
      disc.rotation.y -= dt * 0.6;
      
    } });
  }

  // ---------- 11–13: the door with the gold OW sign — closed -> open with warm light ----------
  {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x1e1b28, roughness: 0.85 })));
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
    inside.position.set(0, -0.9, 0.205); g.add(inside);
    const frameM = new THREE.MeshStandardMaterial({ color: 0x0d0f16 });
    for (const [x, w, hh, y] of [[-0.72, 0.12, 2.56, -0.86], [0.72, 0.12, 2.56, -0.86], [0, 1.56, 0.12, 0.38]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.12), frameM); b.position.set(x, y, 0.24); g.add(b);
    }
    const door = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.07), new THREE.MeshStandardMaterial({ color: 0x2b1f3f, roughness: 0.6 }));
    leaf.position.set(0.65, 0, 0); door.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd9b37a, metalness: 0.8, roughness: 0.3 }));
    knob.position.set(1.16, -0.05, 0.06); door.add(knob);
    door.position.set(-0.65, -0.9, 0.24); g.add(door);

    // gold-glass OW — the only metallic element (same O/W build as the current hero)
    let gold;
    if (hi) {
      gold = new THREE.MeshPhysicalMaterial({ color: 0xffd596, metalness: 1, roughness: 0.14, clearcoat: 1,
        clearcoatRoughness: 0.05, emissive: 0x4a2a00, emissiveIntensity: 0.5 });
      try {
        const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
        const pm = new THREE.PMREMGenerator(ctx.renderer);
        gold.envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture; gold.envMapIntensity = 1.5; pm.dispose();
      } catch (e) { gold.emissiveIntensity = 1.1; }
    } else {
      gold = new THREE.MeshStandardMaterial({ color: 0xffd596, metalness: 0.4, roughness: 0.35, emissive: 0xb07a2a, emissiveIntensity: 0.8 });
    }
    const sign = new THREE.Group();
    const o = new THREE.Shape(); o.absarc(0, 0, 1.72, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, 1.14, 0, Math.PI * 2, true); o.holes.push(hole);
    const oGeo = new THREE.ExtrudeGeometry(o, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.08,
      bevelSize: 0.08, bevelSegments: hi ? 3 : 1, curveSegments: hi ? 64 : 28 });
    oGeo.translate(0, 0, -0.225);
    const oM = new THREE.Mesh(oGeo, gold); oM.position.x = -1.75; sign.add(oM);
    const barG = new THREE.BoxGeometry(0.5, 2.9, 0.5);
    for (const xc of [0.8, 2.04]) for (const s of [1, -1]) {
      const b = new THREE.Mesh(barG, gold); b.rotation.z = s * 0.36; b.position.set(xc - s * 0.47, 0, 0); sign.add(b);
    }
    if (hi) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(7.4, 4.4, 0.35), new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transparent: true, opacity: 0.14, roughness: 0.05, clearcoat: 1, depthWrite: false }));
      glass.position.set(0.1, 0, -0.5); sign.add(glass);
    }
    sign.scale.setScalar(0.2); sign.position.set(0.05, 1.25, 0.45); g.add(sign);

    const doorLight = new THREE.PointLight(0xffc27a, 0, 9, 1.4); doorLight.position.set(0, -0.9, 1.6); g.add(doorLight);
    let hold = 0;
    add(DOOR.map(at), g, { y: 2.1, pool: 0xffb060, sway: 0.12, update: (ob, t, dt, st) => {
      // the door's own two beats happen at the last stop only
      hold = st.near[at('open')] > 0.85 ? hold + dt : Math.max(0, hold - dt * 2);
      const open = sstep((hold - 0.6) / 1.4);
      door.rotation.y = -open * 1.15;
      doorLight.intensity = 30 * open;
      ob.pool.material.color.setHex(0xffb060).multiplyScalar(0.4 + 0.8 * open);
    } });
  }

  // ---------- optional intro: a laptop showing a local search where "your" business is missing ----------
  // The camera pushes in until the screen covers the view, the result card appears at the top
  // with a green check, then the laptop dissolves and the walk continues at the hero page.
  let laptop = null;
  if (INTRO.length) {
    const lg = new THREE.Group();
    const alu = new THREE.MeshStandardMaterial({ color: 0x5a5f69, metalness: 0.35, roughness: 0.38, transparent: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d34, metalness: 0.2, roughness: 0.5, transparent: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.1, 2.1), alu); base.position.set(0, 0.05, 0); lg.add(base);
    const keysTex = tex(512, 256, (c, w, h) => {
      c.fillStyle = '#121419'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1d2027';
      for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) rr(c, 12 + k * 35.5, 12 + r * 34, 30, 28, 4);
      rr(c, 130, 12 + 5 * 34, 250, 28, 4);
    });
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.0), new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.7, transparent: true }));
    keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.102, -0.3); lg.add(keys);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), dark); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.102, 0.62); lg.add(pad);
    const pivot = new THREE.Group(); pivot.position.set(0, 0.1, -1.05); pivot.rotation.x = LID_TILT; lg.add(pivot);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.0, 0.06), alu); lid.position.set(0, 1.0, 0); pivot.add(lid);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(3.04, 1.94), new THREE.MeshBasicMaterial({ color: 0x050608, transparent: true })); bezel.position.set(0, 1.0, 0.031); pivot.add(bezel);
    // the screen: a local search, readable at first frame. MISSING: your slot is empty.
    // GAIN: your business fills the slot with a Call button. Generic names only, no logos.
    // words on the screen follow the page language (index.html = en, es.html = es; Spanish uses tú)
    const ES = (document.documentElement.lang || '').startsWith('es');
    const T = ES ? {
      queries: [['tacos cerca de mí', 'Taquería'], ['plomero cerca de mí', 'Plomería'], ['salón de belleza abierto ahora', 'Salón de belleza'], ['carros usados Napa', 'Carros usados']],
      biz: 'Negocio', missing: 'Tu negocio no aparece aquí.', you: 'Tu Negocio', open: '· Abierto ahora', call: 'Llamar',
      gain: 'Esto es lo que recibes: los clientes te encuentran y te llaman.',
    } : {
      queries: [['best tacos near me', 'Taquería'], ['plumber near me', 'Plumber'], ['hair salon open now', 'Hair salon'], ['tacos near me', 'Taquería'], ['used cars Napa', 'Used car dealer']],
      biz: 'Business', missing: "Your business isn't here.", you: 'Your Business', open: '· Open now', call: 'Call',
      gain: 'This is what you get: customers find you, and call.',
    };
    const [query, cat] = T.queries[Math.floor(Math.random() * T.queries.length)];
    await Promise.all(['600 40px "IBM Plex Sans"', '400 40px "IBM Plex Sans"', '700 40px "Bricolage Grotesque"']
      .map(f => document.fonts.load(f).catch(() => {})));
    const W = 2048, H = 1280;
    const colW = hi ? W * 0.62 : W * 0.9, x0 = (W - colW) / 2, u = colW / 1000;    // u: layout unit
    const FS = hi ? 1 : 1.15;                                                      // bigger type on phones
    const F = (wt, px, fam = 'IBM Plex Sans') => `${wt} ${Math.round(px * u * FS)}px "${fam}", system-ui, sans-serif`;
    const page = (found) => tex(W, H, (c) => {
      c.fillStyle = '#f4f2fb'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#e1ddef'; c.fillRect(0, 0, W, 44);
      ['#c9c4d8', '#c9c4d8', '#c9c4d8'].forEach((f, i) => { c.fillStyle = f; c.beginPath(); c.arc(26 + i * 24, 22, 8, 0, Math.PI * 2); c.fill(); });
      // search bar with the typed query
      const sy = 80 * u + 40, sh = 96 * u;
      c.fillStyle = '#ffffff'; rr(c, x0, sy, colW, sh, sh / 2);
      c.strokeStyle = '#5b21e0'; c.lineWidth = 7 * u; c.beginPath(); c.arc(x0 + 52 * u, sy + sh / 2, 17 * u, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(x0 + 64 * u, sy + sh / 2 + 12 * u); c.lineTo(x0 + 78 * u, sy + sh / 2 + 26 * u); c.stroke();
      c.fillStyle = '#0f1420'; c.font = F(500, 44); c.textBaseline = 'middle'; c.fillText(query, x0 + 100 * u, sy + sh / 2 + 2);
      let y = sy + sh + 40 * u;
      const rowH = 150 * u;
      const result = (name, meta) => {
        c.fillStyle = '#ffffff'; rr(c, x0, y, colW, rowH, 18 * u);
        c.fillStyle = '#c3c8d6'; c.beginPath(); c.arc(x0 + 64 * u, y + rowH / 2, 34 * u, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2a3045'; c.font = F(600, 44); c.fillText(name, x0 + 124 * u, y + rowH * 0.36);
        c.fillStyle = '#6b7286'; c.font = F(400, 36); c.fillText(meta, x0 + 124 * u, y + rowH * 0.68);
        y += rowH + 22 * u;
      };
      if (!found) {
        c.strokeStyle = '#c86a6a'; c.lineWidth = 6 * u; c.setLineDash([22 * u, 14 * u]);
        c.beginPath(); c.roundRect(x0, y, colW, rowH, 18 * u); c.stroke(); c.setLineDash([]);
        c.fillStyle = '#b85656'; c.font = F(600, 44); c.textAlign = 'center'; c.fillText(T.missing, x0 + colW / 2, y + rowH / 2 + 2); c.textAlign = 'left';
        y += rowH + 22 * u;
      } else {
        const ch = rowH + 20 * u;
        c.fillStyle = '#ffffff'; rr(c, x0 - 10 * u, y - 10 * u, colW + 20 * u, ch, 20 * u);
        c.fillStyle = '#5b21e0'; rr(c, x0 - 10 * u, y - 10 * u, 14 * u, ch, 7 * u);
        c.fillStyle = '#0f1420'; c.beginPath(); c.arc(x0 + 70 * u, y + rowH / 2, 38 * u, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#0f1420'; c.font = F(700, 50, 'Bricolage Grotesque'); c.fillText(T.you, x0 + 132 * u, y + rowH * 0.34);
        c.fillStyle = '#c99400'; c.font = F(400, 36); c.fillText('★★★★★', x0 + 132 * u, y + rowH * 0.7);
        c.fillStyle = '#1f8f4e'; c.font = F(600, 36); c.fillText(T.open, x0 + 132 * u + c.measureText('★★★★★ ').width + 8 * u, y + rowH * 0.7);
        const bw = (ES ? 220 : 190) * u, bh = 78 * u, bx = x0 + colW - bw - 30 * u, by = y + rowH / 2 - bh / 2;
        c.fillStyle = '#db3a00'; rr(c, bx, by, bw, bh, bh / 2);
        c.fillStyle = '#ffffff'; c.font = F(600, 40); c.textAlign = 'center'; c.font = F(600, ES ? 34 : 40); c.fillText(T.call, bx + bw / 2, by + bh / 2 + 2); c.textAlign = 'left';
        c.fillStyle = '#22c55e'; c.beginPath(); c.arc(x0 + colW + 4 * u, y - 4 * u, 40 * u, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 11 * u; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x0 + colW - 14 * u, y - 2 * u); c.lineTo(x0 + colW - 1 * u, y + 11 * u); c.lineTo(x0 + colW + 22 * u, y - 18 * u); c.stroke();
        y += ch + 22 * u;
      }
      result(`${T.biz} A`, `${cat} · 4.1 ★ · 2.3 mi`);
      result(`${T.biz} B`, `${cat} · 4.4 ★ · 0.9 mi`);
      if (found) {
        c.fillStyle = '#3f1499'; c.font = F(700, 44, 'Bricolage Grotesque'); c.textAlign = 'center';
        c.font = F(700, ES ? 38 : 44, 'Bricolage Grotesque'); c.fillText(T.gain, W / 2, Math.min(H - 60 * u, y + 50 * u)); c.textAlign = 'left';
      } else result(`${T.biz} C`, `${cat} · 3.9 ★ · 3.1 mi`);
    });
    const scrA = new THREE.MeshBasicMaterial({ map: page(false), toneMapped: false, transparent: true });
    const scrB = new THREE.MeshBasicMaterial({ map: page(true), toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
    for (const m of [scrA, scrB]) { m.map.anisotropy = hi ? 8 : 4; m.map.generateMipmaps = true; }
    const sa = new THREE.Mesh(new THREE.PlaneGeometry(2.86, 1.79), scrA); sa.position.set(0, 1.02, 0.032); pivot.add(sa);
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(2.86, 1.79), scrB); sb.position.set(0, 1.02, 0.034); pivot.add(sb);
    lg.position.set(0, 0, LZ);
    scene.add(lg);
    // a soft reflection: the same laptop mirrored under a slightly see-through floor
    const mirror = lg.clone(); mirror.scale.y = -1; mirror.position.y = -0.002; scene.add(mirror);
    floor.material.transparent = true; floor.material.opacity = 0.84;
    const pm = new THREE.MeshBasicMaterial({ map: poolTex, color: 0x6a5aa0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const lpool = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), pm); lpool.rotation.x = -Math.PI / 2; lpool.position.set(0, 0.01, LZ + 0.6); scene.add(lpool);
    const mats = [alu, dark, keys.material, bezel.material, scrA, scrB];
    const iIntro = at('intro'), iFill = INTRO.includes('fill') ? at('fill') : iIntro + 1;
    laptop = {
      update(t, st) {
        const s = st.s - iIntro, span = iFill - iIntro;           // 0 at intro, `span` at fill, span+1 at the hero page
        const turn = sstep(s / (0.6 * span));
        lg.rotation.y = mirror.rotation.y = (hi ? 0.16 : 0) * (1 - turn);
        const found = sstep((s - 0.3 * span) / (0.18 * span));      // quick swap, no ghosting
        scrB.opacity = found; sb.visible = found > 0.003;
        const fade = sstep((s - span - 0.04) / 0.09);             // through the glass: gone before the text blurs
        const vis = 1 - fade;
        lg.visible = mirror.visible = vis > 0.003;
        for (const m of mats) { if (m === scrB || m === scrA) continue; m.opacity = vis; m.depthWrite = vis > 0.98; }
        // the 'missing' page goes away as the 'found' page arrives, so it can't ghost through while fading
        scrA.opacity = vis * (1 - found); sa.visible = scrA.opacity > 0.003;
        scrB.opacity *= vis;
        lpool.material.opacity = 0.35 * vis;
        // hold the hero panel while the screen is still on view, reveal once it has cleared.
        // Outside this window the variable is 1 (e.g. at the top of the page, where crawlers render).
        const hv = (s < span - 0.02 || s > span + 0.6) ? 1 : sstep((s - span - 0.14) / 0.14);
        if (hv !== laptop._hv) { laptop._hv = hv; document.documentElement.style.setProperty('--lp-hero', hv.toFixed(3)); }
        return lg.visible;
      },
      viewFactor(sv) { return sstep(sv - iFill); }                // centred during the intro, normal framing at the hero
    };
  }

  // ---------- per frame ----------
  const ease = x => 1 - Math.pow(1 - x, 3);
  return {
    viewFactor: laptop ? laptop.viewFactor : undefined,
    update(dt, t, st) {
      let moving = false;
      for (const o of objects) {
        const near = Math.max(...o.stops.map(i => st.near[i]));
        const want = Math.min(1, Math.max(0, (near - 0.45) / 0.4));   // never two at once
        o.vis += (want - o.vis) * Math.min(1, dt * 5);
        if (Math.abs(want - o.vis) < 1e-3) o.vis = want;
        // before -> after: starts ~0.5s after the object has fully arrived, takes ~1.6s;
        // resets once it has left, so it plays again on the next visit
        o.hold = o.vis > 0.8 ? (o.hold || 0) + dt : (o.vis < 0.05 ? 0 : (o.hold || 0));
        const k = sstep((o.hold - 0.5) / 1.6);
        const v = ease(o.vis);
        o.holder.visible = v > 0.002;
        o.pool.material.opacity = 0.3 * v;
        if (!o.holder.visible) continue;
        o.holder.scale.setScalar(0.6 + 0.4 * v);
        o.group.position.y = (1 - v) * -0.35 + Math.sin(t * 0.6) * 0.03;
        o.group.rotation.y = Math.sin(t * 0.28) * o.sway;
        if (o.update) o.update(o, t, dt, st, k);
        moving = true;
      }
      if (laptop && laptop.update(t, st)) moving = true;
      // key light rides just above-right of the camera; rim sits behind the object
      key.position.set(cam.position.x + 2.2, cam.position.y + 2.4, cam.position.z - 1.5);
      const zi = Math.round(-cam.position.z / GAP) * -GAP;
      rim.position.set(-1.8, 3.2, Math.max(-11 * GAP, Math.min(0, zi)) - 2.2);
      return moving;
    }
  };
}
