/* scene-ojedaworks.js — the ojedaworks.com walk-through, "one object per stop".
 *
 * A calm, near-empty dark stage (soft gradient sky, glossy floor, fog).
 * Each stop shows ONE object that is the thing that section talks about,
 * lit by a key light that travels with the camera, turning slowly. Objects
 * sit in a line down the stage; the camera glides from one to the next and
 * each object scales in on arrival and out on departure, so only one is
 * ever on screen.
 *
 * No words are drawn into the scene. All words live in the HTML.
 */

// 14 stops, DOM order (must match data-station order in the page).
// cam/look are filled in by build() per device tier.
export const POSES = Array.from({ length: 14 }, () => ({ cam: [0, 0, 0], look: [0, 0, 0] }));

const GAP = 14;            // distance between objects along the stage
const Y = 1.45;            // object centre height

export async function buildOjedaWorks(THREE, ctx) {
  const { scene, cam, tier, stations } = ctx;
  const hi = tier === 'high';

  // ---------- poses: camera in front of each object ----------
  // door stops (11, 12, 13) share one object and walk closer each time
  const dist = [5.6, 5.6, 6.4, 5.8, 5.8, 5.6, 5.6, 5.4, 6.2, 6.0, 5.8, 9.2, 7.4, 5.6];
  const zOf = i => -Math.min(i, 11) * GAP;
  // phones: further back = smaller object, so it fits the strip above the text
  stations.forEach((st, i) => {
    const k = hi ? 1.1 : (i >= 11 ? 2.2 : i === 0 ? 1.95 : 1.6);
    const z = zOf(i), d = dist[i] * k;
    // phone hero: aim a little high so the phone clears the site header
    const lookY = (i >= 11 ? 2.0 : Y) + (!hi && i === 0 ? 0.35 : 0);
    // the two wide three-tile objects sit next to the widest text panels: nudge them right on desktop
    const lx = hi && (i === 8 || i === 9) ? -0.9 : 0;
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

  // Every object has two beats, played once each time the visitor arrives:
  // BEFORE (what the owner is missing) -> AFTER (what they get). gain 0 -> 1.
  const swap = (w, h, before, after, z) => {          // crossfade two pictures
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: before, toneMapped: false }));
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: after, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
    a.position.z = z; b.position.z = z + 0.002; g.add(a, b);
    g.userData.set = k => { b.material.opacity = k; b.visible = k > 0.003; };
    return g;
  };
  const clamp01 = x => Math.min(1, Math.max(0, x));
  const sstep = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

  // ---------- 0 hero: the search — you're missing -> you're at the top ----------
  {
    const g = new THREE.Group();
    g.add(slab(1.12, 2.24, 0.16, 0.1, 0x161922, 0.35, 0.7));
    const W = 256, H = 540;
    const screen = (draw) => tex(W, H, (c, w, h) => {
      c.fillStyle = '#0e1322'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2a3045'; rr(c, w / 2 - 34, 14, 68, 10, 5);
      c.fillStyle = '#ece9f6'; rr(c, 18, 66, w - 36, 48, 24);
      c.strokeStyle = '#5b21e0'; c.lineWidth = 5;
      c.beginPath(); c.arc(46, 88, 10, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(53, 95); c.lineTo(62, 104); c.stroke();
      c.fillStyle = '#9aa0b6'; rr(c, 74, 84, 108, 9, 4);
      draw(c, w, h);
    });
    const row = (c, y, i) => {
      c.fillStyle = '#1b2133'; rr(c, 18, y, 220, 76, 12);
      c.fillStyle = '#343c55'; rr(c, 32, y + 16, 118 - i * 10, 12, 6);
      c.fillStyle = '#262d42'; rr(c, 32, y + 40, 170 - i * 8, 10, 5);
    };
    const before = screen(c => { for (let i = 0; i < 4; i++) row(c, 146 + i * 92, i); });   // none of them you
    const after = screen(c => {
      // your business, first: lit card, your colour, a call button
      c.fillStyle = '#f2eee4'; rr(c, 14, 140, 228, 120, 14);
      c.fillStyle = '#5b21e0'; rr(c, 14, 140, 10, 120, 5);
      c.fillStyle = '#db3a00'; c.beginPath(); c.arc(56, 182, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0f1420'; rr(c, 86, 168, 120, 13, 6);
      c.fillStyle = '#9aa0b6'; rr(c, 86, 190, 90, 9, 4);
      c.fillStyle = '#ffd400'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(92 + k * 15, 214, 5, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#db3a00'; rr(c, 150, 222, 80, 26, 13);
      for (let i = 0; i < 3; i++) row(c, 282 + i * 88, i + 1);
    });
    const sw = swap(1.0, 2.1, before, after, 0.071); g.add(sw);
    add([0], g, { update: (o, t, dt, st, k) => sw.userData.set(k) });
  }

  // ---------- 1 car promo: a car that sits -> the video they stop on ----------
  {
    const g = new THREE.Group();
    g.add(slab(1.26, 2.24, 0.1, 0.06, 0x111318, 0.4, 0.4));
    const car = (c, body, lit) => {
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(22, 330); c.lineTo(22, 292); c.lineTo(70, 284); c.lineTo(104, 236);
      c.lineTo(170, 234); c.lineTo(182, 284); c.lineTo(280, 286); c.lineTo(280, 330); c.closePath(); c.fill();
      c.fillStyle = '#1a1c22'; c.beginPath(); c.moveTo(112, 244); c.lineTo(164, 243); c.lineTo(172, 280); c.lineTo(88, 282); c.closePath(); c.fill();
      c.fillStyle = '#0a0a0c'; for (const x of [76, 228]) { c.beginPath(); c.arc(x, 332, 25, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = lit ? '#7a6a55' : '#2a2a2e'; for (const x of [76, 228]) { c.beginPath(); c.arc(x, 332, 11, 0, Math.PI * 2); c.fill(); }
      if (lit) { c.fillStyle = '#ffcf8a'; rr(c, 118, 226, 44, 6, 3); c.fillStyle = 'rgba(255,207,138,.9)'; rr(c, 266, 296, 14, 8, 3); }
    };
    const before = tex(300, 540, (c, w, h) => {                 // parked in the dark, nobody looks
      c.fillStyle = '#08080a'; c.fillRect(0, 0, w, h); car(c, '#3a3631', false);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(w / 2, 150, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#08080a'; c.beginPath(); c.moveTo(w / 2 - 9, 134); c.lineTo(w / 2 + 15, 150); c.lineTo(w / 2 - 9, 166); c.fill();
      c.fillStyle = 'rgba(255,255,255,.15)'; rr(c, 24, h - 34, w - 48, 6, 3);
    });
    const after = tex(300, 540, (c, w, h) => {                  // lit, moving, the one they stop on
      const gr = c.createRadialGradient(w / 2, h * 0.58, 10, w / 2, h * 0.58, w * 0.95);
      gr.addColorStop(0, '#3a3024'); gr.addColorStop(1, '#050506'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,210,150,.10)'; c.beginPath(); c.ellipse(w / 2, 352, 140, 18, 0, 0, Math.PI * 2); c.fill();
      car(c, '#c9a87c', true);
      c.fillStyle = 'rgba(255,255,255,.22)'; rr(c, 24, h - 34, w - 48, 6, 3);
    });
    const sw = swap(1.18, 2.12, before, after, 0.056); g.add(sw);
    const TW = 1.18 * (252 / 300), x0 = -TW / 2, ty = -2.12 / 2 + 2.12 * (31 / 540);
    const prog = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.022), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
    prog.position.set(x0, ty, 0.06); g.add(prog);
    add([1], g, { pool: 0x8a6a3c, update: (o, t, dt, st, k) => {
      sw.userData.set(k);
      const f = 0.03 + ((t * 0.07) % 0.97) * k; prog.scale.x = TW * f; prog.position.x = x0 + TW * f / 2; prog.material.opacity = k;
    } });
  }

  // ---------- 2 what we do: your storefront — dark, nobody stops -> lit, someone at the door ----------
  {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, 1.3), new THREE.MeshStandardMaterial({ color: 0x2a2433, roughness: 0.8 })));
    const winM = new THREE.MeshBasicMaterial({ color: 0x141a28, toneMapped: false });
    const doorM = new THREE.MeshBasicMaterial({ color: 0x10141f, toneMapped: false });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.05), winM); win.position.set(-0.35, -0.3, 0.651); g.add(win);
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.25), doorM); dr.position.set(0.8, -0.52, 0.651); g.add(dr);
    const mull = new THREE.MeshStandardMaterial({ color: 0x1b1622 });
    for (const x of [-0.84, -0.35, 0.14]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.05, 0.03), mull); b.position.set(x, -0.3, 0.66); g.add(b); }
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.34), new THREE.MeshBasicMaterial({ color: 0x20180e })); band.position.set(0, 0.72, 0.652); g.add(band);
    const awnM = new THREE.MeshStandardMaterial({ color: 0x3a2a66, emissive: 0x5b21e0, emissiveIntensity: 0 });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.5), awnM); awn.position.set(-0.35, 0.36, 0.86); awn.rotation.x = 0.32; g.add(awn);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 1.4), new THREE.MeshStandardMaterial({ color: 0x1c1824 })); roof.position.y = 1.19; g.add(roof);
    // a customer: a simple figure walking up to the door
    const person = new THREE.Group();
    const pm = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 4, 10), pm); body.position.y = 0.34;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), pm); head.position.y = 0.76;
    person.add(body, head); person.position.set(1.7, -1.15, 1.05); g.add(person);
    const W0 = new THREE.Color(0x141a28), W1 = new THREE.Color(0xffc98a), D0 = new THREE.Color(0x10141f), D1 = new THREE.Color(0xffe2b8), B1 = new THREE.Color(0x3b2a14);
    add([2], g, { y: 1.16, pool: 0xffb060, sway: 0.4, update: (o, t, dt, st, k) => {
      const lit = sstep(k * 1.6), walk = sstep((k - 0.35) / 0.65);
      winM.color.copy(W0).lerp(W1, lit); doorM.color.copy(D0).lerp(D1, lit);
      band.material.color.setHex(0x20180e).lerp(B1, lit); awnM.emissiveIntensity = 0.5 * lit;
      person.visible = walk > 0.01; person.position.x = 1.7 - 0.8 * walk; person.scale.setScalar(0.4 + 0.6 * walk);
      o.pool.material.color.setHex(0x6a5aa0).lerp(new THREE.Color(0xffb060), lit);
    } });
  }

  // ---------- 3 video: a frozen blank frame -> a video that plays ----------
  {
    const g = new THREE.Group();
    g.add(slab(3.1, 1.86, 0.1, 0.08, 0x111318, 0.4, 0.5));
    const before = tex(640, 360, (c, w, h) => {
      c.fillStyle = '#1a1c22'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2 - 10, 40, 0.3, Math.PI * 1.8); c.stroke();  // stuck loading
      c.fillStyle = 'rgba(255,255,255,.12)'; rr(c, 30, h - 30, w - 60, 6, 3);
    });
    const after = tex(640, 360, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3b1ab0'); gr.addColorStop(1, '#0f1420');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(w / 2, h / 2 - 10, 48, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3b1ab0'; c.beginPath(); c.moveTo(w / 2 - 14, h / 2 - 36); c.lineTo(w / 2 + 24, h / 2 - 10); c.lineTo(w / 2 - 14, h / 2 + 16); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; rr(c, 30, h - 30, w - 60, 6, 3);
    });
    const sw = swap(2.96, 1.66, before, after, 0.066); g.add(sw);
    // progress fill grows left -> right from the track's left end
    const TW = 2.96 * (580 / 640), x0 = -TW / 2, ty = -1.66 / 2 + 1.66 * (27 / 360);
    const prog = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.028), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
    prog.position.set(x0, ty, 0.07); g.add(prog);
    add([3], g, { update: (o, t, dt, st, k) => {
      sw.userData.set(k);
      const f = 0.02 + ((t * 0.06) % 0.98) * k; prog.scale.x = TW * f; prog.position.x = x0 + TW * f / 2; prog.material.opacity = k;
    } });
  }

  // ---------- 4 web: a broken, empty page -> a clear page with a big call button ----------
  {
    const g = new THREE.Group();
    g.add(slab(2.9, 2.1, 0.1, 0.06, 0xe9e6f2, 0.5, 0.05));
    const chrome = c => {
      c.fillStyle = '#e1ddef'; c.fillRect(0, 0, 560, 34);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(20 + i * 20, 17, 6, 0, Math.PI * 2); c.fill(); });
      c.fillStyle = '#fff'; rr(c, 90, 8, 300, 18, 9);
    };
    const before = tex(560, 400, (c, w, h) => {
      c.fillStyle = '#eceaf0'; c.fillRect(0, 0, w, h); chrome(c);
      c.strokeStyle = '#c4c0cf'; c.lineWidth = 4; c.setLineDash([10, 8]);
      c.strokeRect(30, 64, 240, 150); c.strokeRect(300, 64, 230, 70); c.strokeRect(300, 150, 230, 64);   // empty, broken boxes
      c.beginPath(); c.moveTo(30, 64); c.lineTo(270, 214); c.moveTo(270, 64); c.lineTo(30, 214); c.stroke();
      c.setLineDash([]); c.fillStyle = '#d6d2df'; rr(c, 30, 250, 500, 12, 6); rr(c, 30, 274, 380, 12, 6); rr(c, 30, 298, 440, 12, 6);
    });
    const after = tex(560, 400, (c, w, h) => {
      c.fillStyle = '#f4f2fb'; c.fillRect(0, 0, w, h); chrome(c);
      c.fillStyle = '#0f1420'; rr(c, 30, 66, 300, 30, 6); rr(c, 30, 106, 220, 30, 6);
      c.fillStyle = '#9aa0b6'; rr(c, 30, 156, 340, 10, 5); rr(c, 30, 176, 280, 10, 5);
      c.fillStyle = '#db3a00'; rr(c, 30, 212, 250, 64, 32);                       // the big call button
      c.fillStyle = '#fff'; c.beginPath(); c.arc(70, 244, 13, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd0bd'; rr(c, 96, 238, 150, 12, 6);
      for (let i = 0; i < 3; i++) { c.fillStyle = '#e6e1f5'; rr(c, 30 + i * 170, 300, 152, 80, 10); c.fillStyle = '#b9a5f5'; rr(c, 46 + i * 170, 316, 70, 10, 5); }
    });
    const sw = swap(2.8, 2.0, before, after, 0.056); g.add(sw);
    add([4], g, { update: (o, t, dt, st, k) => sw.userData.set(k) });
  }

  // ---------- 5 content: a question nobody answered -> the answer, with your name on it ----------
  {
    const g = new THREE.Group();
    const q = slab(1.3, 0.62, 0.3, 0.12, 0xffd400, 0.5, 0.05); q.position.set(-0.75, 0.78, 0.15); g.add(q);
    const qTail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 3), q.material);
    qTail.rotation.z = Math.PI * 0.85; qTail.position.set(-1.05, 0.44, 0.15); g.add(qTail);
    const dots = face(0.9, 0.2, tex(180, 40, c => { c.fillStyle = '#0f1420'; [30, 90, 150].forEach(x => { c.beginPath(); c.arc(x, 20, 12, 0, Math.PI * 2); c.fill(); }); }), 0.245);
    dots.material.transparent = true; dots.position.set(-0.75, 0.78, 0.245); g.add(dots);
    const ans = new THREE.Group();
    const a = slab(2.3, 1.3, 0.28, 0.12, 0xf2eee4, 0.55, 0.05); ans.add(a);
    const aTail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 3), a.material); aTail.rotation.z = -Math.PI * 0.85; aTail.position.set(0.8, -0.71, 0); ans.add(aTail);
    const lines = face(1.9, 0.95, tex(380, 190, c => {
      c.fillStyle = '#5b21e0'; rr(c, 20, 16, 150, 30, 15);                       // your name, as a chip
      c.fillStyle = '#0f1420'; [[300, 66], [320, 104], [200, 142]].forEach(([w, y]) => rr(c, 20, y, w, 18, 9));
    }), 0.09);
    lines.material.transparent = true; ans.add(lines);
    ans.position.set(0.3, -0.35, 0); g.add(ans);
    add([5], g, { pool: 0x8a7a30, update: (o, t, dt, st, k) => {
      const v = sstep(k); ans.visible = v > 0.01; ans.scale.setScalar(0.3 + 0.7 * v); ans.position.y = -0.35 - (1 - v) * 0.3;
      dots.position.y = 0.78 + (1 - v) * Math.sin(t * 3) * 0.02;            // the "…" waits until answered
    } });
  }

  // ---------- 6 advertising: an ad aimed at nobody -> it hits the target ----------
  {
    const g = new THREE.Group();
    g.add(slab(2.2, 2.2, 0.2, 0.1, 0x0f1420, 0.5, 0.2));
    const target = cols => tex(400, 400, (c, w) => {
      c.fillStyle = '#0f1420'; c.fillRect(0, 0, w, w);
      [150, 112, 76, 40, 16].forEach((r, i) => { c.fillStyle = cols[i]; c.beginPath(); c.arc(w / 2, w / 2, r, 0, Math.PI * 2); c.fill(); });
    });
    const sw = swap(2.0, 2.0, target(['#2a2e3a', '#0f1420', '#2a2e3a', '#0f1420', '#3a3e4a']),
      target(['#db3a00', '#0f1420', '#db3a00', '#0f1420', '#ffd400']), 0.076);
    g.add(sw);
    const am = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.4 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 10), am);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 12), am);
    const arrow = new THREE.Group(); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.75;
    tip.rotation.x = -Math.PI / 2; tip.position.z = -0.05; arrow.add(shaft, tip); g.add(arrow);
    const A0 = { x: 1.6, y: 1.3, z: 0.9, rx: -0.5, ry: 1.4 }, A1 = { x: 0.02, y: 0.02, z: 0.12, rx: -0.35, ry: 0.45 };
    add([6], g, { pool: 0xa0381a, update: (o, t, dt, st, k) => {
      const f = sstep((k - 0.15) / 0.6), hit = sstep((k - 0.7) / 0.3);
      arrow.position.set(A0.x + (A1.x - A0.x) * f, A0.y + (A1.y - A0.y) * f, A0.z + (A1.z - A0.z) * f);
      arrow.rotation.set(A0.rx + (A1.rx - A0.rx) * f, A0.ry + (A1.ry - A0.ry) * f, 0);
      sw.userData.set(hit);
    } });
  }

  // ---------- 7 custom songs: silence (a flat line) -> a record turning, sound moving ----------
  {
    const g = new THREE.Group();
    const rec = tex(512, 512, (c, w) => {
      c.fillStyle = '#0b0b0e'; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
      for (let r = 80; r < w / 2 - 6; r += 6) { c.beginPath(); c.arc(w / 2, w / 2, r, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = '#ff2e88'; c.beginPath(); c.arc(w / 2, w / 2, 68, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f2eee4'; c.fillRect(w / 2 + 16, w / 2 - 6, 34, 12);
      c.fillStyle = '#0b0b0e'; c.beginPath(); c.arc(w / 2, w / 2, 7, 0, Math.PI * 2); c.fill();
    });
    const top = new THREE.MeshStandardMaterial({ map: rec, roughness: 0.3, metalness: 0.3 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.3 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.03, hi ? 64 : 32), [edge, top, top]);
    disc.rotation.x = Math.PI / 2 - 0.12; disc.position.y = 0.25; g.add(disc);
    const bars = [], bm = new THREE.MeshBasicMaterial({ color: 0xff2e88, toneMapped: false });
    for (let i = 0; i < 13; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.04), bm);
      b.position.set((i - 6) * 0.13, -1.05, 0.2); g.add(b); bars.push(b);
    }
    add([7], g, { pool: 0xff2e88, sway: 0.18, update: (o, t, dt, st, k) => {
      disc.rotation.y -= dt * 1.1 * k;
      bars.forEach((b, i) => { const h = 0.02 + k * (0.12 + 0.3 * Math.abs(Math.sin(t * 2.2 + i * 0.7)) * Math.cos((i - 6) * 0.2)); b.scale.y = h; });
    } });
  }

  // ---------- 8 how it works: three gray tiles -> lit in order ----------
  {
    const g = new THREE.Group();
    const tiles = [];
    for (let j = 0; j < 3; j++) {
      const s = slab(0.9, 0.9, 0.14, 0.12, 0x2a2d38, 0.45, 0.2);
      s.material.emissive = new THREE.Color(0);
      s.position.set((j - 1) * 1.1, 0, 0);
      const dots = face(0.6, 0.2, tex(150, 50, c => {        // 1, 2, 3 dots — numbered without text
        c.fillStyle = '#0f1420';
        for (let d = 0; d <= j; d++) { c.beginPath(); c.arc(75 + (d - j / 2) * 34, 25, 11, 0, Math.PI * 2); c.fill(); }
      }), 0.088);
      dots.material.transparent = true; s.add(dots);
      g.add(s); tiles.push(s);
    }
    const G = new THREE.Color(0x2a2d38), L = new THREE.Color(0xffc27a);
    add([8], g, { sway: 0.22, update: (o, t, dt, st, k) => {
      tiles.forEach((s, j) => {
        const v = sstep(k * 3.2 - j * 1.0);
        s.material.color.copy(G).lerp(L, v); s.material.emissive.setRGB(0.45 * v, 0.25 * v, 0.05 * v);
        s.position.z = 0.15 * v;
      });
    } });
  }

  // ---------- 9 free tools: three blank tiles -> three working tools ----------
  {
    const g = new THREE.Group();
    const icons = [
      c => { c.fillStyle = '#5b21e0'; [60, 100, 140].forEach((hh, i) => rr(c, 50 + i * 54, 200 - hh, 36, hh, 6)); },
      c => { c.strokeStyle = '#0f1420'; c.lineWidth = 8; c.strokeRect(46, 52, 164, 150); c.fillStyle = '#0f1420'; c.fillRect(46, 52, 164, 26); c.fillStyle = '#db3a00'; rr(c, 64, 150, 70, 26, 13); },
      c => {
        c.fillStyle = '#0f1420';
        const q = (x, y) => { c.fillRect(x, y, 52, 52); c.fillStyle = '#f2eee4'; c.fillRect(x + 9, y + 9, 34, 34); c.fillStyle = '#0f1420'; c.fillRect(x + 17, y + 17, 18, 18); };
        q(42, 42); q(162, 42); q(42, 162);
        let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (r() < 0.5) c.fillRect(112 + i * 18, 112 + j * 18, 14, 14);
      }
    ];
    const blank = tex(256, 256, (c, w) => { c.fillStyle = '#3a3d48'; c.fillRect(0, 0, w, w); c.fillStyle = '#4a4d58'; rr(c, 60, 110, 136, 18, 9); });
    const sws = icons.map((draw, j) => {
      const s = slab(1.0, 1.0, 0.18, 0.1, 0xf2eee4, 0.55, 0.05);
      const sw = swap(0.9, 0.9, blank, tex(256, 256, (c, w) => { c.fillStyle = '#f2eee4'; c.fillRect(0, 0, w, w); draw(c); }), 0.076);
      s.add(sw); s.position.set((j - 1) * 1.2, 0, Math.abs(j - 1) * -0.25); s.rotation.y = (1 - j) * 0.22;
      g.add(s); return sw;
    });
    add([9], g, { sway: 0.2, update: (o, t, dt, st, k) => sws.forEach((sw, j) => sw.userData.set(sstep(k * 2.6 - j * 0.8))) });
  }

  // ---------- 10 the audit: a blank checklist -> items checked off (no scores, no promises) ----------
  {
    const g = new THREE.Group();
    g.add(slab(1.8, 2.4, 0.1, 0.05, 0xf2eee4, 0.6, 0.02));
    const ROWS = [110, 176, 242, 308, 374];
    g.add(face(1.7, 2.3, tex(340, 460, (c, w, h) => {
      c.fillStyle = '#f2eee4'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#0f1420'; rr(c, 26, 28, 190, 22, 6);
      c.fillStyle = '#9aa0b6'; rr(c, 26, 62, 260, 10, 5);
      ROWS.forEach((y, i) => {
        c.strokeStyle = '#0f1420'; c.lineWidth = 5; c.beginPath(); c.roundRect(28, y + 2, 30, 30, 7); c.stroke();
        c.fillStyle = '#0f1420'; rr(c, 76, y + 6, 200 - i * 18, 10, 5);
        c.fillStyle = '#9aa0b6'; rr(c, 76, y + 22, 150, 8, 4);
      });
    }), 0.051));
    const checkTex = tex(64, 64, c => {
      c.fillStyle = '#5b21e0'; rr(c, 2, 2, 60, 60, 14);
      c.strokeStyle = '#fff'; c.lineWidth = 8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(16, 33); c.lineTo(28, 45); c.lineTo(48, 20); c.stroke();
    });
    const checks = ROWS.map(y => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: checkTex, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
      m.position.set(-1.7 / 2 + 1.7 * (43 / 340), 2.3 / 2 - 2.3 * ((y + 17) / 460), 0.054); g.add(m); return m;
    });
    add([10], g, { update: (o, t, dt, st, k) => checks.forEach((m, i) => {
      const v = sstep(k * 6 - i * 1.0); m.material.opacity = v; m.scale.setScalar(0.6 + 0.4 * v); m.visible = v > 0.003;
    }) });
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
    add([11, 12, 13], g, { y: 2.1, pool: 0xffb060, sway: 0.12, update: (ob, t, dt, st) => {
      // the door's own two beats happen at the last stop only
      hold = st.near[13] > 0.85 ? hold + dt : Math.max(0, hold - dt * 2);
      const open = sstep((hold - 0.6) / 1.4);
      door.rotation.y = -open * 1.15;
      doorLight.intensity = 30 * open;
      ob.pool.material.color.setHex(0xffb060).multiplyScalar(0.4 + 0.8 * open);
    } });
  }

  // ---------- per frame ----------
  const ease = x => 1 - Math.pow(1 - x, 3);
  return {
    update(dt, t, st) {
      let moving = false;
      for (const o of objects) {
        const near = Math.max(...o.stops.map(i => st.near[i]));
        const want = Math.min(1, Math.max(0, (near - 0.45) / 0.4));   // never two at once
        o.vis += (want - o.vis) * Math.min(1, dt * 5);
        if (Math.abs(want - o.vis) < 1e-3) o.vis = want;
        // before -> after: starts ~0.5s after the object has fully arrived, takes ~1.6s;
        // resets once it has left, so it plays again on the next visit
        o.hold = o.vis > 0.97 ? (o.hold || 0) + dt : (o.vis < 0.05 ? 0 : (o.hold || 0));
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
      // key light rides just above-right of the camera; rim sits behind the object
      key.position.set(cam.position.x + 2.2, cam.position.y + 2.4, cam.position.z - 1.5);
      const zi = Math.round(-cam.position.z / GAP) * -GAP;
      rim.position.set(-1.8, 3.2, Math.max(-11 * GAP, Math.min(0, zi)) - 2.2);
      return moving;
    }
  };
}
