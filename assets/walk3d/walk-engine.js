/* walk-engine.js — reusable scroll-driven 3D "walk-through" background.
 *
 * The page's HTML stays the content. This module only paints a fixed canvas
 * behind it and moves a camera between "stations" that are pinned to real
 * DOM elements: when station i's element sits in the middle of the viewport,
 * the camera rests at station i's pose. Between stations it eases forward.
 *
 * Used by ojedaworks.com first; built to be reused by aoaudit.com and
 * myownhit.com with a different scene module.
 *
 *   startWalk({
 *     canvas,                       // fixed <canvas aria-hidden="true">
 *     stations: [{ el, cam:[x,y,z], look:[x,y,z] }, ...],   // DOM order
 *     build: (THREE, ctx) => ({ update(dt, t, state) -> bool needsRender }),
 *     onReady, onFail
 *   })
 *
 * The page decides beforehand whether to run at all (reduced motion,
 * save-data, no WebGL, very weak device): if this never runs, the page is
 * exactly the plain HTML page.
 */

export async function startWalk(opts) {
  const { canvas, stations, build, onReady = () => {}, onFail = () => {} } = opts;
  try {
    const THREE = await import('three');

    const small = matchMedia('(max-width: 760px)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const tier = small || coarse ? 'low' : 'high';

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: tier === 'high', alpha: false,
        powerPreference: tier === 'high' ? 'high-performance' : 'low-power'
      });
    } catch (e) { onFail(e); return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier === 'high' ? 1.75 : 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(tier === 'high' ? 50 : 62, 1, 0.1, 260);
    scene.add(cam);

    const ctx = { scene, cam, renderer, tier, stations };
    const world = await build(THREE, ctx);

    // ---- scroll -> station parameter s (0 .. n-1) ----
    const n = stations.length;
    let anchors = new Array(n).fill(0);
    // phones: the object sits in the top part of the screen, so park the
    // text a little below the middle
    const anchorAt = small ? (opts.anchorAtSmall ?? 0.62) : 0.5;
    function measure() {
      const vh = innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const r = stations[i].el.getBoundingClientRect();
        const top = r.top + scrollY;
        // rest when the element's first screenful is centred (long sections
        // like the FAQ rest while their top part is being read)
        const h = Math.min(r.height, vh * 0.9);
        let y = top + h / 2 - vh * anchorAt;
        if (i === 0) y = 0;
        if (i === n - 1) y = Math.min(y, max);
        y = Math.max(prev, Math.min(max, y));
        anchors[i] = y; prev = y;
      }
      anchors[n - 1] = Math.max(anchors[n - 1], Math.min(max, anchors[n - 1]));
    }
    const ease = f => {            // dwell at both ends of each leg
      const d = 0.14;
      const x = Math.min(1, Math.max(0, (f - d) / (1 - 2 * d)));
      return x * x * x * (x * (x * 6 - 15) + 10);
    };
    function sFromScroll() {
      const y = scrollY;
      if (y <= anchors[0]) return 0;
      for (let i = 0; i < n - 1; i++) {
        const a = anchors[i], b = anchors[i + 1];
        if (y < b) return b - a < 1 ? i + 1 : i + ease((y - a) / (b - a));
      }
      return n - 1;
    }

    const P = stations.map(s => new THREE.Vector3(...s.cam));
    const L = stations.map(s => new THREE.Vector3(...s.look));
    const tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
    const curPos = P[0].clone(), curLook = L[0].clone();
    function poseAt(s) {
      const i = Math.min(n - 2, Math.floor(s)), f = s - i;
      tgtPos.lerpVectors(P[i], P[i + 1], f);
      tgtLook.lerpVectors(L[i], L[i + 1], f);
    }

    // ---- per-station "lit" levels: ramp up on approach, stay on after ----
    const lit = new Float32Array(n);
    const state = { s: 0, lit, tier, near: new Float32Array(n) };

    // ---- sizing (ignore mobile URL-bar height wobble) ----
    let lastW = 0, lastH = 0;
    function size(force) {
      const w = innerWidth, h = innerHeight;
      if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      // wide screens: text sits on the left, so frame the subject right of
      // centre by rendering the left part of a wider virtual frame
      const shift = w >= 980 ? (opts.shift ?? 0.3) : 0;
      // narrow screens: text panels sit mid-screen, so lift the subject into
      // the top part of the view instead
      const lift = w < 761 ? (opts.lift ?? 0.44) : 0;
      const fw = w * (1 + shift), fh = h * (1 + lift);
      cam.aspect = fw / fh;
      if (shift || lift) cam.setViewOffset(fw, fh, 0, h * lift, w, h); else cam.clearViewOffset();
      cam.updateProjectionMatrix();
      measure();
      dirty = true;
    }

    let mx = 0, my = 0, pmx = 0, pmy = 0;
    if (tier === 'high') addEventListener('pointermove', e => {
      mx = (e.clientX / innerWidth - 0.5); my = (e.clientY / innerHeight - 0.5);
    }, { passive: true });

    let dirty = true;
    addEventListener('resize', () => size(false), { passive: true });
    addEventListener('load', () => { measure(); dirty = true; });
    if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); dirty = true; }).observe(document.body);
    size(true);

    // ---- frame loop: render only when something moved ----
    const clock = new THREE.Clock();
    let frames = 0, renders = 0, ready = false;
    const stats = { frames: 0, renders: 0, ms: [] };
    window.__walk = { state, stats, measure, anchors: () => anchors.slice() };

    function frame() {
      const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
      const t0 = performance.now();
      state.s = sFromScroll();
      poseAt(state.s);
      const k = 1 - Math.exp(-dt * (tier === 'high' ? 5 : 7));
      const dp = curPos.distanceToSquared(tgtPos) + curLook.distanceToSquared(tgtLook);
      curPos.lerp(tgtPos, k); curLook.lerp(tgtLook, k);
      pmx += (mx - pmx) * k; pmy += (my - pmy) * k;
      cam.position.copy(curPos);
      cam.lookAt(curLook.x + pmx * 1.2, curLook.y - pmy * 0.6, curLook.z);

      let changed = dp > 1e-6 || dirty;
      const sc = state.s;
      for (let i = 0; i < n; i++) {
        const want = Math.min(1, Math.max(0, (sc - (i - 0.7)) / 0.7));
        const v = lit[i] + (want - lit[i]) * Math.min(1, dt * 3);
        if (Math.abs(v - lit[i]) > 1e-4) changed = true;
        lit[i] = Math.abs(want - v) < 1e-3 ? want : v;
        state.near[i] = Math.max(0, 1 - Math.abs(sc - i));
      }
      if (world.update(dt, t, state)) changed = true;
      if (changed) {
        renderer.render(scene, cam); renders++;
        stats.ms.push(performance.now() - t0); if (stats.ms.length > 240) stats.ms.shift();
        if (!ready) { ready = true; onReady({ tier }); }
      }
      dirty = false; frames++;
      stats.frames = frames; stats.renders = renders;
    }
    renderer.setAnimationLoop(frame);
    return { THREE, scene, cam, renderer, state };
  } catch (e) {
    onFail(e);
    return null;
  }
}
