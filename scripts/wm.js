/* ============================================================================
 * wm.js — AbeOS minimal window manager  →  window.WM
 * Classic global (no modules). Builds window chrome only; body content is
 * supplied by a render(bodyEl) callback at registration time (main.js wires).
 *
 * Per CONTRACT.md:
 *   WM.mount({ windowsEl, dockEl, iconsEl })
 *   WM.register({ id, title, icon, x, y, w, h, openOnBoot, render(bodyEl) })
 *   WM.open / close / minimize / focus / toggle / isOpen
 * ==========================================================================*/
(function () {
  'use strict';

  // ---- module-level state ------------------------------------------------
  var els = { windowsEl: null, dockEl: null, iconsEl: null };
  var wins = {};          // id -> record (see register)
  var order = [];         // registration order, for stagger fallback
  var zCounter = 10;      // ever-increasing z-index for stacking
  var activeId = null;    // currently focused window id
  var booted = false;     // whether mount() ran

  // The menubar + dock are floating overlays, so the windows layer spans the
  // whole viewport. Windows may be dragged behind both bars and off any edge
  // (real-OS feel), but we always keep a grabbable sliver on-screen.
  var KEEP = 44;   // px of a window kept on-screen when shoved off an edge
  var TUCK = 12;   // px of the title bar kept visible below the top menubar

  var mqMobile = window.matchMedia('(max-width:760px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function isMobile() { return mqMobile.matches; }

  // The drawable area for windows = the #windows container, which sits BETWEEN
  // the menubar and the dock (so it's shorter than the viewport). Window
  // coordinates (style.left/top) are relative to this container's box, so all
  // clamping must use these dimensions — NOT window.innerWidth/innerHeight,
  // or windows overflow behind the dock and get clipped.
  function box() {
    var c = els.windowsEl;
    if (c && c.clientHeight) return { w: c.clientWidth, h: c.clientHeight };
    return { w: window.innerWidth, h: window.innerHeight };
  }

  // Heights of the floating chrome (so windows OPEN clear of them).
  function menubarH() { var m = document.getElementById('menubar'); return m ? m.offsetHeight : 34; }
  function dockReserve() { var d = els.dockEl; return (d ? d.offsetHeight : 74) + 24; }

  // Drag limits: a window may go off any edge but keep KEEP px on-screen, and
  // may tuck behind the top menubar while keeping TUCK px of its title bar.
  function dragBounds(node) {
    var b = box();
    var w = node.offsetWidth, h = node.offsetHeight;
    var barEl = node.querySelector('.win__bar');
    var barH = barEl ? barEl.offsetHeight : 38;
    return {
      minX: -(w - KEEP), maxX: b.w - KEEP,
      minY: menubarH() - (barH - TUCK), maxY: b.h - KEEP
    };
  }

  // small DOM helper
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function clamp(v, min, max) {
    if (max < min) return min;        // viewport smaller than window
    return Math.max(min, Math.min(max, v));
  }

  // ------------------------------------------------------------------------
  // mount — capture mount points
  // ------------------------------------------------------------------------
  function mount(opts) {
    opts = opts || {};
    els.windowsEl = opts.windowsEl || null;
    els.dockEl    = opts.dockEl || null;
    els.iconsEl   = opts.iconsEl || null;
    booted = true;

    // Build dock + icon chrome for anything registered before mount().
    for (var i = 0; i < order.length; i++) {
      var rec = wins[order[i]];
      if (rec && !rec._chrome) buildChrome(rec);
    }
    // Honor openOnBoot now that we have mount points.
    for (var j = 0; j < order.length; j++) {
      if (wins[order[j]] && wins[order[j]].openOnBoot) open(order[j]);
    }
  }

  // ------------------------------------------------------------------------
  // register — record a window definition; build dock + desktop icon chrome
  // ------------------------------------------------------------------------
  function register(def) {
    def = def || {};
    if (!def.id) { console.warn('[WM] register: missing id'); return; }
    if (wins[def.id]) { console.warn('[WM] register: duplicate id', def.id); return; }

    var rec = {
      id: def.id,
      title: def.title || def.id,
      icon: def.icon || '🪟',
      x: def.x, y: def.y, w: def.w, h: def.h,
      openOnBoot: !!def.openOnBoot,
      render: typeof def.render === 'function' ? def.render : null,
      node: null,        // <section.win> once built
      bodyEl: null,      // .win__body
      dockBtn: null,
      iconBtn: null,
      _chrome: false,    // dock/icon built?
      _built: false,     // window DOM built?
      state: 'closed',   // closed | open | minimized
      maximized: false
    };
    wins[def.id] = rec;
    order.push(def.id);

    if (booted) buildChrome(rec);     // if mounted already, build chrome now
    return rec.id;
  }

  // ------------------------------------------------------------------------
  // buildChrome — dock button + desktop icon for a window
  // ------------------------------------------------------------------------
  function buildChrome(rec) {
    if (rec._chrome) return;

    // --- Dock button: icon + title + running dot ---
    if (els.dockEl) {
      var btn = el('button', 'dock__item');
      btn.type = 'button';
      btn.setAttribute('data-dock', rec.id);
      btn.setAttribute('aria-label', stripEmoji(rec.title));
      btn.title = stripEmoji(rec.title);

      var ico = el('span', 'dock__icon', rec.icon);
      ico.setAttribute('aria-hidden', 'true');
      var lbl = el('span', 'dock__label', stripEmoji(rec.title));
      var dot = el('span', 'dock__dot is-running');   // running indicator
      dot.setAttribute('aria-hidden', 'true');

      btn.appendChild(ico);
      btn.appendChild(lbl);
      btn.appendChild(dot);
      btn.addEventListener('click', function () { toggle(rec.id); });
      els.dockEl.appendChild(btn);
      rec.dockBtn = btn;
    }

    // --- Desktop icon: <li><button> emoji + label ---
    if (els.iconsEl) {
      var li = el('li', 'desktop-icon-li');
      var ib = el('button', 'desktop-icon');
      ib.type = 'button';
      ib.setAttribute('data-icon', rec.id);
      ib.setAttribute('aria-label', stripEmoji(rec.title));

      var emoji = el('span', 'desktop-icon__glyph', rec.icon);
      emoji.setAttribute('aria-hidden', 'true');
      var label = el('span', 'desktop-icon__label', stripEmoji(rec.title));

      ib.appendChild(emoji);
      ib.appendChild(label);

      // Double-click OR Enter/Space opens (single click just focuses icon).
      ib.addEventListener('dblclick', function () { open(rec.id); });
      ib.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          open(rec.id);
        }
      });

      li.appendChild(ib);
      els.iconsEl.appendChild(li);
      rec.iconBtn = ib;
    }

    rec._chrome = true;
    syncDock(rec);
  }

  // Best-effort: drop a leading emoji + space from a title for a11y labels.
  function stripEmoji(s) {
    return String(s == null ? '' : s).replace(/^\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}️]+\s*/u, '').trim() || String(s || '');
  }

  // ------------------------------------------------------------------------
  // buildWindow — create the <section.win> chrome and call render() ONCE
  // ------------------------------------------------------------------------
  function buildWindow(rec) {
    if (rec._built) return;
    if (!els.windowsEl) { console.warn('[WM] no windowsEl mounted'); return; }

    var sec = el('section', 'win');
    sec.setAttribute('data-win', rec.id);
    sec.setAttribute('role', 'dialog');
    sec.setAttribute('aria-label', stripEmoji(rec.title));
    sec.setAttribute('aria-modal', 'false');

    // --- header bar ---
    var bar = el('header', 'win__bar');
    var lights = el('div', 'win__lights');

    var bClose = mkLight('win__btn--close', 'Close', function () { close(rec.id); });
    var bMin   = mkLight('win__btn--min', 'Minimize', function () { minimize(rec.id); });
    var bZoom  = mkLight('win__btn--zoom', 'Zoom', function () { zoom(rec.id); });

    lights.appendChild(bClose);
    lights.appendChild(bMin);
    lights.appendChild(bZoom);

    var title = el('span', 'win__title', stripEmoji(rec.title));

    bar.appendChild(lights);
    bar.appendChild(title);

    // --- body ---
    var body = el('div', 'win__body');

    sec.appendChild(bar);
    sec.appendChild(body);
    els.windowsEl.appendChild(sec);

    rec.node = sec;
    rec.bodyEl = body;
    rec._built = true;

    // Initial geometry (desktop only; mobile is full-screen via CSS).
    applyInitialGeometry(rec);

    // Raise on any click within the window.
    sec.addEventListener('pointerdown', function () { focus(rec.id); });

    // Dragging by the bar.
    enableDrag(rec, bar, lights);

    // Render body content exactly once.
    if (rec.render) {
      try { rec.render(body); }
      catch (err) { console.error('[WM] render failed for', rec.id, err); }
    }
  }

  function mkLight(variant, label, onClick) {
    var b = el('button', 'win__btn ' + variant);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.addEventListener('click', function (e) {
      e.stopPropagation();      // don't trigger focus-raise / drag
      onClick();
    });
    return b;
  }

  // ------------------------------------------------------------------------
  // geometry: stagger if x/y missing, else honor; ignored on mobile.
  // ------------------------------------------------------------------------
  function applyInitialGeometry(rec) {
    if (!rec.node) return;
    if (isMobile()) return;     // CSS handles full-screen layout

    var b = box();
    var vw = b.w, vh = b.h;
    var topSafe = menubarH() + 8;          // first usable row under the menubar
    var botSafe = vh - dockReserve();      // last usable row above the dock
    var w = typeof rec.w === 'number' ? rec.w : 560;
    var h = typeof rec.h === 'number' ? rec.h : 420;

    // Open fully visible: fit inside the safe area (it scrolls internally).
    w = Math.min(w, vw - 16);
    h = Math.min(h, botSafe - topSafe);

    var x, y;
    if (typeof rec.x === 'number' && typeof rec.y === 'number') {
      x = rec.x; y = rec.y;
    } else {
      // center-ish with a per-window stagger
      var idx = order.indexOf(rec.id);
      var step = 28 * (idx < 0 ? 0 : idx);
      x = Math.round((vw - w) / 2) + step - 40;
      y = topSafe + step;
    }

    // Clamp into the safe area so nothing opens clipped behind the chrome.
    x = clamp(x, 8, vw - w - 8);
    y = clamp(y, topSafe, botSafe - h);

    rec.node.style.width  = w + 'px';
    rec.node.style.height = h + 'px';
    rec.node.style.left   = x + 'px';
    rec.node.style.top    = y + 'px';
  }

  // ------------------------------------------------------------------------
  // dragging — pointer events on the bar, clamp on-screen, pointer capture
  // ------------------------------------------------------------------------
  function enableDrag(rec, bar, lights) {
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, pid = null;

    bar.addEventListener('pointerdown', function (e) {
      if (isMobile()) return;                       // full-screen, no drag
      if (rec.maximized) return;                    // don't drag maximized
      // Ignore drags starting on the light buttons.
      if (lights.contains(e.target)) return;
      if (e.button != null && e.button !== 0) return;

      dragging = true;
      pid = e.pointerId;
      sx = e.clientX; sy = e.clientY;
      // offsetLeft/Top are relative to the container (same frame as style.left/top)
      ox = rec.node.offsetLeft; oy = rec.node.offsetTop;
      focus(rec.id);
      try { bar.setPointerCapture(pid); } catch (_) {}
      bar.classList.add('is-dragging');
      e.preventDefault();
    });

    bar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      var db = dragBounds(rec.node);
      var nx = clamp(ox + dx, db.minX, db.maxX);
      var ny = clamp(oy + dy, db.minY, db.maxY);
      rec.node.style.left = nx + 'px';
      rec.node.style.top  = ny + 'px';
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove('is-dragging');
      if (pid != null) { try { bar.releasePointerCapture(pid); } catch (_) {} }
      pid = null;
    }
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
  }

  // ------------------------------------------------------------------------
  // open / close / minimize / focus / toggle / isOpen / zoom
  // ------------------------------------------------------------------------
  function open(id) {
    var rec = wins[id];
    if (!rec) { console.warn('[WM] open: unknown id', id); return; }
    if (!rec._built) buildWindow(rec);
    if (!rec.node) return;

    // If geometry never applied (e.g. registered pre-mount on desktop), ensure it.
    rec.node.hidden = false;
    rec.node.classList.remove('win--minimized');
    rec.state = 'open';
    syncDock(rec);
    focus(id);
  }

  function close(id) {
    var rec = wins[id];
    if (!rec || !rec.node) { if (rec) rec.state = 'closed'; return; }
    rec.node.hidden = true;
    rec.state = 'closed';
    if (activeId === id) activeId = null;
    syncDock(rec);
    // Move focus somewhere sensible.
    if (rec.iconBtn) { try { rec.iconBtn.focus(); } catch (_) {} }
  }

  function minimize(id) {
    var rec = wins[id];
    if (!rec || !rec.node) return;
    rec.node.hidden = true;
    rec.node.classList.add('win--minimized');
    rec.state = 'minimized';
    if (activeId === id) {
      rec.node.classList.remove('win--active');
      activeId = null;
    }
    syncDock(rec);       // keep dock dot — still "running"
    if (rec.dockBtn) { try { rec.dockBtn.focus(); } catch (_) {} }
  }

  function focus(id) {
    var rec = wins[id];
    if (!rec || !rec.node || rec.node.hidden) return;

    // Lower previously active.
    if (activeId && activeId !== id && wins[activeId] && wins[activeId].node) {
      wins[activeId].node.classList.remove('win--active');
    }
    zCounter += 1;
    rec.node.style.zIndex = String(zCounter);
    rec.node.classList.add('win--active');
    activeId = id;
    syncDock(rec);
  }

  function toggle(id) {
    var rec = wins[id];
    if (!rec) return;
    if (rec.state === 'open') {
      // If open but not focused, just raise; if focused, minimize.
      if (activeId === id) minimize(id);
      else focus(id);
    } else {
      // closed or minimized -> open/restore
      open(id);
    }
  }

  function isOpen(id) {
    var rec = wins[id];
    return !!(rec && rec.state === 'open');
  }

  // zoom: toggle a maximized class, clamp to screen (best-effort).
  function zoom(id) {
    var rec = wins[id];
    if (!rec || !rec.node) return;
    if (isMobile()) return;        // already full-screen on mobile

    rec.maximized = !rec.maximized;
    if (rec.maximized) {
      // Remember restore geometry.
      rec._restore = {
        left: rec.node.style.left, top: rec.node.style.top,
        width: rec.node.style.width, height: rec.node.style.height
      };
      var b = box();
      rec.node.classList.add('win--max');
      // Fill the safe area (below the menubar, above the dock).
      rec.node.style.left = '8px';
      rec.node.style.top = (menubarH() + 8) + 'px';
      rec.node.style.width = (b.w - 16) + 'px';
      rec.node.style.height = (b.h - menubarH() - dockReserve()) + 'px';
    } else {
      rec.node.classList.remove('win--max');
      if (rec._restore) {
        rec.node.style.left = rec._restore.left;
        rec.node.style.top = rec._restore.top;
        rec.node.style.width = rec._restore.width;
        rec.node.style.height = rec._restore.height;
      }
    }
    focus(id);
  }

  // ------------------------------------------------------------------------
  // syncDock — reflect open/minimized/active state on the dock button
  // ------------------------------------------------------------------------
  function syncDock(rec) {
    if (!rec || !rec.dockBtn) return;
    var running = rec.state === 'open' || rec.state === 'minimized';
    rec.dockBtn.classList.toggle('is-running', running);
    rec.dockBtn.classList.toggle('is-active', rec.state === 'open' && activeId === rec.id);
    rec.dockBtn.setAttribute('aria-pressed', running ? 'true' : 'false');
  }

  // ------------------------------------------------------------------------
  // global keyboard: Escape closes the active window
  // ------------------------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && activeId) {
      close(activeId);
    }
  });

  // On viewport changes, re-clamp open desktop windows so none drift off-screen.
  window.addEventListener('resize', function () {
    if (isMobile()) return;
    var b = box();
    var safeH = b.h - menubarH() - dockReserve();
    for (var i = 0; i < order.length; i++) {
      var rec = wins[order[i]];
      if (!rec || !rec.node || rec.node.hidden) continue;
      if (rec.maximized) {
        rec.node.style.left = '8px';
        rec.node.style.top = (menubarH() + 8) + 'px';
        rec.node.style.width = (b.w - 16) + 'px';
        rec.node.style.height = safeH + 'px';
        continue;
      }
      // shrink to fit the safe area if the viewport got smaller
      if (rec.node.offsetHeight > safeH) rec.node.style.height = safeH + 'px';
      if (rec.node.offsetWidth > b.w - 16) rec.node.style.width = (b.w - 16) + 'px';
      // keep a grabbable sliver on-screen (windows may stay partly off-edge)
      var db = dragBounds(rec.node);
      var x = clamp(parseInt(rec.node.style.left, 10) || 0, db.minX, db.maxX);
      var y = clamp(parseInt(rec.node.style.top, 10) || 0, db.minY, db.maxY);
      rec.node.style.left = x + 'px';
      rec.node.style.top = y + 'px';
    }
  });

  // ------------------------------------------------------------------------
  // expose global
  // ------------------------------------------------------------------------
  window.WM = {
    mount: mount,
    register: register,
    open: open,
    close: close,
    minimize: minimize,
    focus: focus,
    toggle: toggle,
    isOpen: isOpen
  };
})();
