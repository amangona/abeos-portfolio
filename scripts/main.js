/* ===========================================================================
   AbeOS — main.js  (integration layer)
   Boots the OS, starts the background, registers every window with the WM,
   renders each window body from ABE_DATA, wires the chat + menubar + sticky.
   Depends on globals: ABE_DATA, initBackground, WM, Chat  (loaded before this)
   =========================================================================== */
(function () {
  'use strict';

  var D = window.ABE_DATA || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- tiny helpers ------------------------------------------------ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function tagList(tags) {
    if (!tags || !tags.length) return '';
    return '<div class="tags">' + tags.map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('') + '</div>';
  }
  function openLink(href) {
    if (!href) return;
    if (href.indexOf('mailto:') === 0) { window.location.href = href; return; }
    window.open(href, '_blank', 'noopener');
  }

  /* ---------- window body renderers (emit the CSS-class contract) --------- */
  function renderWork(body) {
    var exp = D.experience || [];
    body.innerHTML =
      '<div class="funnel">' +
      '<p class="funnel__lead">Where I&rsquo;ve worked and what I shipped, newest first. ' +
      'The <b>highlighted</b> roles are the standouts.</p>' +
      exp.map(function (e) {
        return (
          '<div class="funnel__stage' + (e.featured ? ' is-growth' : '') + '">' +
            '<div class="funnel__role">' + esc(e.role) +
              ' <span class="funnel__company">@ ' + esc(e.company) + '</span></div>' +
            '<div class="funnel__meta">' +
              [e.team, e.dates, e.location].filter(Boolean).map(esc).join(' &middot; ') +
            '</div>' +
            (e.summary ? '<div class="funnel__summary">' + esc(e.summary) + '</div>' : '') +
            (e.highlights && e.highlights.length
              ? '<ul class="funnel__highlights">' +
                  e.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') +
                '</ul>'
              : '') +
            tagList(e.tags) +
          '</div>'
        );
      }).join('') +
      '</div>';
  }

  function renderSkills(body) {
    var groups = D.skills || [];
    body.innerHTML =
      '<div class="skills">' +
      groups.map(function (g) {
        return (
          '<div class="skills__group">' +
            '<div class="skills__group-title">' + esc(g.group) + '</div>' +
            (g.items || []).map(function (it) {
              var lvl = Math.max(0, Math.min(100, it.level || 0));
              return (
                '<div class="skill">' +
                  '<div class="skill__name">' + esc(it.name) + '</div>' +
                  '<div class="skill__bar"><div class="skill__fill" data-level="' + lvl + '" style="width:0%"></div></div>' +
                '</div>'
              );
            }).join('') +
          '</div>'
        );
      }).join('') +
      '</div>';

    // animate the bars in (skip the 0->n transition under reduced motion)
    var fills = body.querySelectorAll('.skill__fill');
    function fill() {
      for (var i = 0; i < fills.length; i++) {
        fills[i].style.width = fills[i].getAttribute('data-level') + '%';
      }
    }
    if (reduceMotion) fill();
    else requestAnimationFrame(function () { requestAnimationFrame(fill); });
  }

  function renderProjects(body) {
    var projects = D.projects || [];
    body.innerHTML =
      '<div class="projects">' +
      '<p class="funnel__lead">Things I&rsquo;ve designed, built, and shipped.</p>' +
      projects.map(function (p) {
        var links = '';
        if (p.appStore) {
          links += '<a class="btn btn--primary" href="' + esc(p.appStore) + '" target="_blank" rel="noopener">App Store ↗</a>';
        }
        if (p.github) {
          links += '<a class="btn" href="' + esc(p.github) + '" target="_blank" rel="noopener">⌥ GitHub ↗</a>';
        }
        var thumb = p.icon
          ? '<img class="project__icon" src="' + esc(p.icon) + '" alt="' + esc(p.name) + ' app icon" loading="lazy" />'
          : '<span class="project__emoji" aria-hidden="true">' + esc(p.emoji) + '</span>';
        return (
          '<div class="project">' +
            '<div class="project__head">' +
              thumb +
              '<span class="project__name">' + esc(p.name) + '</span>' +
            '</div>' +
            (p.blurb ? '<div class="project__blurb">' + esc(p.blurb) + '</div>' : '') +
            tagList(p.tags) +
            (links ? '<div class="project__links">' + links + '</div>' : '') +
          '</div>'
        );
      }).join('') +
      '</div>';
  }

  function renderResume(body) {
    var src = (D.links && D.links.resume) || 'resume.pdf';
    body.innerHTML =
      '<div class="resume-view">' +
        '<div class="resume-view__actions">' +
          '<a class="btn btn--primary" href="' + esc(src) + '" download>⬇ Download PDF</a>' +
          '<a class="btn" href="' + esc(src) + '" target="_blank" rel="noopener">Open in new tab ↗</a>' +
        '</div>' +
        '<embed class="resume-view__frame" src="' + esc(src) + '#toolbar=0&navpanes=0" type="application/pdf" />' +
        '<p class="resume-view__fallback">PDF not showing? Use the buttons above.</p>' +
      '</div>';
  }

  function renderAbout(body) {
    var id = D.identity || {}, L = D.links || {}, a = D.about || {};
    var linkBtn = function (label, href) {
      return href ? '<a class="btn linkrow" href="' + esc(href) + '" target="_blank" rel="noopener">' + label + '</a>' : '';
    };
    body.innerHTML =
      '<div class="about">' +
        '<div class="about__head">' +
          '<div class="about__id">' +
            '<h2>' + esc(id.name) + '</h2>' +
            '<div class="about__title">' + esc(id.title) + '</div>' +
            '<div class="about__loc">📍 ' + esc(id.location) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="about__bio">' +
          (a.bio || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '</div>' +
        (a.funFacts && a.funFacts.length
          ? '<div class="about__facts"><b>fun facts</b><ul>' +
              a.funFacts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') +
            '</ul></div>'
          : '') +
        '<div class="about__links">' +
          linkBtn('✉ ' + esc(L.email || ''), L.email ? 'mailto:' + L.email : '') +
          linkBtn('in&nbsp;LinkedIn', L.linkedin) +
          linkBtn('⌥&nbsp;GitHub', L.github) +
          '<a class="btn linkrow" href="' + esc(L.resume || 'resume.pdf') + '" download>📄&nbsp;Résumé</a>' +
        '</div>' +
      '</div>';
  }

  function renderChat(body) {
    body.classList.add('win__body--chat');   // edge-to-edge: no body padding
    var wrap = document.createElement('div');
    wrap.className = 'chat-host';
    body.appendChild(wrap);
    if (window.Chat && D.chat) {
      Chat.init(wrap, D.chat, {
        openWindow: function (id) { WM.open(id); WM.focus(id); },
        openLink: openLink
      });
    } else {
      wrap.textContent = 'Chat unavailable.';
    }
  }

  /* ---------- window registry -------------------------------------------- */
  var WINDOWS = [
    { id: 'chat',     title: '💬 Chat with Abe-bot', icon: '💬', w: 430, h: 580, x: 80,  y: 70,  openOnBoot: false, render: renderChat },
    { id: 'projects', title: '🚀 Projects',          icon: '🚀', w: 540, h: 580, x: 540, y: 96,  render: renderProjects },
    { id: 'work',     title: '📁 Work',              icon: '📁', w: 580, h: 600, x: 300, y: 130, render: renderWork },
    { id: 'skills',   title: '⚡ Skills',            icon: '⚡', w: 470, h: 560, x: 180, y: 150, render: renderSkills },
    { id: 'about',    title: '☼ About Abe',          icon: '☼', w: 500, h: 580, x: 420, y: 90,  render: renderAbout },
    { id: 'resume',   title: '📄 Résumé',           icon: '📄', w: 560, h: 680, x: 240, y: 60,  render: renderResume }
  ];

  function registerWindows() {
    WM.mount({
      windowsEl: $('#windows'),
      dockEl: $('#dock'),
      iconsEl: $('#desktop-icons')
    });
    WINDOWS.forEach(function (w) { WM.register(w); });
  }

  /* ---------- menubar: menus, clock, CRT, hire CTA ----------------------- */
  function wireMenubar() {
    // simple app menus that just open windows
    var menusEl = $('#menubar-menus');
    if (menusEl) {
      var menus = [
        { label: 'Abe', win: 'about' },
        { label: 'Projects', win: 'projects' },
        { label: 'Work', win: 'work' },
        { label: 'Skills', win: 'skills' }
      ];
      menusEl.innerHTML = menus.map(function (m) {
        return '<button class="menubar__menu" type="button" data-win="' + m.win + '">' + m.label + '</button>';
      }).join('');
      menusEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-win]');
        if (b) { WM.open(b.getAttribute('data-win')); WM.focus(b.getAttribute('data-win')); }
      });
    }

    // live clock
    var clock = $('#clock');
    function tick() {
      if (!clock) return;
      var d = new Date();
      var h = d.getHours(), m = d.getMinutes();
      clock.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
    tick(); setInterval(tick, 15000);

    // CRT toggle
    var crt = $('#crt-toggle');
    if (crt) {
      crt.addEventListener('click', function () {
        var off = document.body.classList.toggle('no-crt');
        crt.setAttribute('aria-pressed', String(!off));
      });
    }

    // Hire CTA -> open About (has all the contact links) + chat
    var hire = $('#hire-cta');
    if (hire) hire.addEventListener('click', function () { WM.open('about'); WM.focus('about'); });
  }

  function wireSticky() {
    var note = $('#sticky-note');
    if (!note) return;
    var go = function () { WM.open('chat'); WM.focus('chat'); };
    note.addEventListener('click', go);
    note.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  }

  /* ---------- boot sequence ---------------------------------------------- */
  var BOOT_LINES = [
    '> AbeOS kernel v4.8 …………………………… ok',
    '> mounting /projects /experiments /ai … ok',
    '> loading Abe-bot conversational engine … ok',
    '> calibrating sunset … ☼ ok',
    '> ready. welcome, recruiter.'
  ];

  function startDesktop() {
    var desktop = $('#desktop');
    if (desktop) desktop.hidden = false;
    // open windows flagged openOnBoot, then the chat hero (after the reveal so
    // its typing animation is actually seen).
    WINDOWS.forEach(function (w) { if (w.openOnBoot) WM.open(w.id); });
    setTimeout(function () {
      WM.open('chat'); WM.focus('chat');
    }, reduceMotion ? 0 : 280);
  }

  function runBoot() {
    var boot = $('#boot');
    var bar = $('#boot-bar-fill');
    var logEl = $('#boot-log');
    var skip = $('#boot-skip');
    var done = false;

    function finish() {
      if (done) return; done = true;
      try { sessionStorage.setItem('abeos-booted', '1'); } catch (e) {}
      startDesktop();
      if (boot) {
        boot.style.transition = 'opacity .5s ease';
        boot.style.opacity = '0';
        setTimeout(function () { boot.style.display = 'none'; }, 520);
      }
    }
    if (skip) skip.addEventListener('click', finish);

    // already booted this session, or reduced motion -> short-circuit
    var seen = false;
    try { seen = sessionStorage.getItem('abeos-booted') === '1'; } catch (e) {}
    if (seen) { if (bar) bar.style.width = '100%'; finish(); return; }

    var i = 0, pct = 0;
    var stepMs = reduceMotion ? 90 : 360;
    function step() {
      if (done) return;
      if (logEl && i < BOOT_LINES.length) logEl.textContent += BOOT_LINES[i] + '\n';
      i++;
      pct = Math.min(100, Math.round((i / BOOT_LINES.length) * 100));
      if (bar) bar.style.width = pct + '%';
      if (i <= BOOT_LINES.length) setTimeout(step, stepMs);
      else setTimeout(finish, reduceMotion ? 80 : 450);
    }
    step();
  }

  /* ---------- go --------------------------------------------------------- */
  function init() {
    var canvas = $('#bg-canvas');
    if (canvas && window.initBackground) {
      try { initBackground(canvas); } catch (e) { /* background is non-critical */ }
    }
    if (window.WM) {
      registerWindows();
      wireMenubar();
      wireSticky();
    }
    runBoot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
