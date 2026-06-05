/* =============================================================================
 * scripts/background.js  →  window.initBackground(canvasEl)
 * -----------------------------------------------------------------------------
 * Warm poolside / summer-vacation scene drawn on #bg-canvas with pure 2D canvas
 * (no libraries, no external images). Classic global function — no module syntax
 * — so it works over file://. Poolsuite.net-inspired Classic-Mac warmth.
 *
 * Scene layers (back → front):
 *   1. Vertical poolside sky gradient (coral-peach → warm cream → soft aqua pool)
 *   2. A soft, hazy sun: pale warm-white/gold disc with a gentle radial halo,
 *      placed upper-center (NO synthwave banding, NO blinds)
 *   3. A few slow-drifting soft cloud blobs (very subtle, low alpha)
 *   4. A faint shimmering band at the bottom (the pool surface)
 *   5. Cheap warm film-grain / noise overlay (regenerated occasionally)
 *
 * Perf safeguards:
 *   - DPR-aware sizing + debounced resize
 *   - rAF loop throttled to ~30fps
 *   - prefers-reduced-motion → ONE static frame, no loop (re-checked on change)
 *   - Pauses on document.hidden / visibilitychange, resumes on focus
 *   - null / context guards throughout
 * ===========================================================================*/

window.initBackground = function initBackground(canvasEl) {
  // Guard against a missing canvas — fail quietly, never throw.
  if (!canvasEl || !canvasEl.getContext) return;

  var ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  // ---- Palette (warm classic-Mac / poolsuite — synced with CSS tokens) -------
  var COL = {
    skyTop:  '#ffb89a', // warm coral-peach (top)
    skyMid:  '#f7e6c8', // cream (mid)
    pool:    '#bfe3df', // soft aqua (low horizon / pool)
    poolDeep:'#a6d6d0', // slightly deeper aqua for the water band
    sunCore: '#fff6e0', // pale warm-white sun core
    sunGold: '#ffe6a8', // soft gold halo
    cloud:   '#fff6e8'  // warm off-white clouds
  };

  // ---- Animation / perf tuning -----------------------------------------------
  var TARGET_FPS = 30;                 // throttle the rAF loop (battery-friendly)
  var FRAME_MS = 1000 / TARGET_FPS;
  var GRAIN_EVERY_MS = 140;            // regenerate the grain tile only occasionally

  // ---- State -----------------------------------------------------------------
  var W = 0, H = 0;          // CSS pixel dimensions
  var DPR = 1;               // device pixel ratio (clamped)
  var poolY = 0;             // y where the pool/water band begins (CSS px)
  var rafId = null;          // current rAF handle (null = not looping)
  var running = false;       // loop active flag
  var lastFrame = 0;         // timestamp of last rendered frame
  var lastGrain = 0;         // timestamp of last grain regen
  var t = 0;                 // accumulated time (ms) for gentle motion
  var clouds = [];           // cached drifting cloud blobs
  var grainCanvas = null;    // offscreen grain tile
  var grainCtx = null;
  var GRAIN_SIZE = 128;      // grain tile size (tiled across screen, cheap)

  var reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ===========================================================================
  // Sizing — DPR-aware. Backing store is scaled by DPR; we draw in CSS pixels.
  // ===========================================================================
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2); // clamp DPR for perf

    canvasEl.width = Math.round(W * DPR);
    canvasEl.height = Math.round(H * DPR);
    canvasEl.style.width = W + 'px';
    canvasEl.style.height = H + 'px';

    // Reset transform so 1 unit == 1 CSS pixel.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Pool band occupies the lower ~22% of the screen.
    poolY = Math.round(H * 0.78);

    buildClouds();
    buildGrain();
  }

  // ===========================================================================
  // Clouds — a few soft blobs that drift slowly across the warm sky.
  // ===========================================================================
  function buildClouds() {
    clouds = [];
    var count = Math.min(5, Math.max(3, Math.round(W / 480)));
    for (var i = 0; i < count; i++) {
      clouds.push({
        x: Math.random() * W,
        y: H * (0.12 + Math.random() * 0.36),
        r: 60 + Math.random() * 90,           // blob radius
        speed: 4 + Math.random() * 7,         // px/sec drift
        alpha: 0.06 + Math.random() * 0.06    // very subtle
      });
    }
  }

  // ===========================================================================
  // Grain tile — a small offscreen noise canvas, tiled across the whole frame.
  // ===========================================================================
  function buildGrain() {
    if (!grainCanvas) {
      grainCanvas = document.createElement('canvas');
      grainCtx = grainCanvas.getContext('2d');
    }
    grainCanvas.width = GRAIN_SIZE;
    grainCanvas.height = GRAIN_SIZE;
    regenGrain();
  }

  function regenGrain() {
    if (!grainCtx) return;
    var img = grainCtx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      // Warm-tinted monochrome noise (slightly amber so it reads warm).
      var v = (Math.random() * 255) | 0;
      d[i] = v;
      d[i + 1] = (v * 0.93) | 0;
      d[i + 2] = (v * 0.82) | 0;
      // Low alpha so the grain stays subtle on a light surface.
      d[i + 3] = (Math.random() * 14) | 0;
    }
    grainCtx.putImageData(img, 0, 0);
  }

  // ===========================================================================
  // Draw: SKY — vertical poolside gradient (coral-peach → cream → aqua pool).
  // ===========================================================================
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, COL.skyTop);
    g.addColorStop(0.52, COL.skyMid);
    g.addColorStop(0.80, COL.pool);
    g.addColorStop(1.00, COL.poolDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ===========================================================================
  // Draw: SUN — a soft, hazy disc with a gentle radial halo, upper-center.
  // ===========================================================================
  function drawSun() {
    var cx = W * 0.5;
    var cy = H * 0.30;
    var sunR = Math.max(46, Math.min(W, H) * 0.085);

    ctx.save();

    // Wide, gentle halo.
    var halo = ctx.createRadialGradient(cx, cy, sunR * 0.4, cx, cy, sunR * 4.2);
    halo.addColorStop(0.00, 'rgba(255, 240, 200, 0.55)');
    halo.addColorStop(0.30, 'rgba(255, 230, 168, 0.28)');
    halo.addColorStop(1.00, 'rgba(255, 230, 168, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - sunR * 4.5, cy - sunR * 4.5, sunR * 9, sunR * 9);

    // Soft hazy core (no hard edge).
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR);
    core.addColorStop(0.00, COL.sunCore);
    core.addColorStop(0.55, COL.sunGold);
    core.addColorStop(1.00, 'rgba(255, 230, 168, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ===========================================================================
  // Draw: CLOUDS — soft low-alpha blobs drifting across the sky.
  // ===========================================================================
  function drawClouds() {
    ctx.save();
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      grad.addColorStop(0, 'rgba(255, 246, 232, ' + c.alpha + ')');
      grad.addColorStop(1, 'rgba(255, 246, 232, 0)');
      ctx.fillStyle = grad;
      // Squash vertically a touch so blobs read as soft clouds.
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ===========================================================================
  // Draw: POOL — a faint shimmering band at the bottom (the water surface).
  // ===========================================================================
  function drawPool() {
    ctx.save();
    var bandH = H - poolY;
    // A couple of slow horizontal shimmer lines with gentle sine offset.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.4;
    var lines = 5;
    for (var i = 0; i < lines; i++) {
      var baseY = poolY + (bandH * (i + 0.5) / lines);
      var phase = (t * 0.0006) + i * 1.3;
      ctx.globalAlpha = 0.10 + 0.06 * (0.5 + 0.5 * Math.sin(phase));
      ctx.beginPath();
      var amp = 2.5 + i * 0.6;
      for (var x = 0; x <= W; x += 14) {
        var y = baseY + Math.sin(x * 0.02 + phase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ===========================================================================
  // Draw: GRAIN — tile the cached warm noise canvas across the whole frame.
  // ===========================================================================
  function drawGrain() {
    if (!grainCanvas) return;
    var pat = ctx.createPattern(grainCanvas, 'repeat');
    if (!pat) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ===========================================================================
  // Full frame render.
  // ===========================================================================
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawSun();
    drawClouds();
    drawPool();
    drawGrain();
  }

  // ===========================================================================
  // rAF loop — throttled to TARGET_FPS, advances time + cloud drift + grain.
  // ===========================================================================
  function loop(now) {
    if (!running) return;
    rafId = window.requestAnimationFrame(loop);

    var elapsed = now - lastFrame;
    if (elapsed < FRAME_MS) return; // throttle: skip until next frame slot
    lastFrame = now - (elapsed % FRAME_MS);

    t += elapsed;

    // Drift clouds slowly; wrap around the screen edges.
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.x += (c.speed * elapsed) / 1000;
      if (c.x - c.r > W) c.x = -c.r;
    }

    // Regenerate the cheap grain tile only every GRAIN_EVERY_MS.
    if (now - lastGrain >= GRAIN_EVERY_MS) {
      regenGrain();
      lastGrain = now;
    }

    render();
  }

  // ===========================================================================
  // Loop lifecycle control.
  // ===========================================================================
  function start() {
    if (running) return;
    if (reducedMotionMQ.matches) return; // never loop under reduced motion
    running = true;
    lastFrame = performance.now();
    lastGrain = lastFrame;
    rafId = window.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Render exactly one static frame (used for reduced-motion + initial paint).
  function renderStatic() {
    render();
  }

  // ===========================================================================
  // Event wiring.
  // ===========================================================================

  // Debounced resize so we recompute size/pool without thrashing.
  var resizeTimer = null;
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      // Repaint immediately so static (reduced-motion) frames stay correct.
      if (!running) renderStatic();
    }, 150);
  }
  window.addEventListener('resize', onResize);

  // Pause when the tab is hidden, resume on return — saves battery/CPU.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stop();
    } else if (!reducedMotionMQ.matches) {
      start();
    }
  });

  // Re-check reduced-motion preference on change.
  function onMotionChange() {
    if (reducedMotionMQ.matches) {
      stop();
      renderStatic();           // settle on one static frame
    } else if (!document.hidden) {
      start();
    }
  }
  if (reducedMotionMQ.addEventListener) {
    reducedMotionMQ.addEventListener('change', onMotionChange);
  } else if (reducedMotionMQ.addListener) {
    reducedMotionMQ.addListener(onMotionChange); // older Safari
  }

  // ===========================================================================
  // Boot.
  // ===========================================================================
  resize();
  renderStatic();               // always paint at least one frame
  if (!reducedMotionMQ.matches) {
    start();                    // start the animation unless reduced motion
  }
};
