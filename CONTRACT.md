# AbeOS — Build Contract (shared interface)

This is a **zero-build static site**: plain HTML + CSS + vanilla JS, classic `<script>` tags (NOT ES modules) so it works over `file://` too. No frameworks, no npm. Fonts already loaded in `index.html`: `Space Grotesk` (UI), `VT323` (retro/mono display), `DM Mono` (code/labels).

Everything attaches to globals — no imports/exports. Build strictly to the names below so the pieces compose.

---

## Aesthetic (poolsuite-inspired vaporwave / sunset)
- Palette: deep indigo→magenta→peach sunset, neon cyan + hot-pink accents, warm amber "sun gold" (`#ffd36e`). Dark UI chrome with subtle glass.
- Vibe: retro-futuristic 80s computer OS. Grain, scanlines, soft neon glow. Tasteful, not gaudy. Readable.
- Suggested CSS custom properties (define in `:root`, Designer may refine):
  `--bg-0:#1a1030; --bg-1:#2a1a4a; --ink:#f5ecff; --muted:#b9a9d6;
   --cyan:#46e6e0; --pink:#ff5fa2; --gold:#ffd36e; --peach:#ff9e7d;
   --glass:rgba(40,24,72,.66); --line:rgba(255,255,255,.14); --radius:14px;`

---

## JS globals & APIs

### `scripts/data.js` → `window.ABE_DATA` (Strategist owns)
Single source of truth. Shape:
```js
window.ABE_DATA = {
  identity: { name, title, location, blurb, avatar:"assets/avatar.png" },
  links: { email, linkedin, github, resume:"resume.pdf" },
  experience: [ // newest first
    { company, role, team, dates, location, summary,
      highlights:[ "…" ], tags:[ "…" ], growth:true|false /* highlight growth/GTM roles */ }
  ],
  skills: [ { group:"Build", items:[ {name:"Python", level:85} ] }, … ],
  projects: [ { emoji, name, blurb, tags:[…], href? } ],
  ninetyDays: {
    intro:"…",
    flow:[ "Audit self-serve funnel", "Find drop-off", "Ship first AI workflow", "Measure", "Feedback loop" ],
    phases:[ { window:"Days 0–30", title:"…", items:[ "…" ] } ]
  },
  about: { bio:[ "para", … ], funFacts:[ "…" ] },
  chat: { /* see Chat flow schema below */ }
}
```

### `scripts/background.js` → `window.initBackground(canvasEl)` (Graphics owns)
- Draws the animated retro scene onto `#bg-canvas`: sunset gradient, low-poly/banded sun, scrolling neon perspective grid horizon, film grain. Self-handles resize (DPR-aware) and `prefers-reduced-motion` (render one static frame, no rAF loop). No external assets.

### `scripts/wm.js` → `window.WM` (Engineer owns)
Minimal window manager. Window **chrome only** — body content is rendered by a `render(bodyEl)` callback supplied at registration (main.js supplies these).
```js
WM.mount({ windowsEl:#windows, dockEl:#dock, iconsEl:#desktop-icons });
WM.register({
  id, title /* e.g. "💬 Chat with Abe-bot" */, icon /* emoji */,
  x,y,w,h /* initial px; WM clamps to viewport & centers on mobile */,
  openOnBoot:false,
  render(bodyEl) /* called ONCE on first open; fill bodyEl */
});
WM.open(id); WM.close(id); WM.minimize(id); WM.focus(id); WM.toggle(id); WM.isOpen(id);
```
Behavior: each window is `<section class="win" data-win=ID>` containing `.win__bar` (with `.win__lights` close/min/zoom buttons + `.win__title`) and `.win__body`. Dragging by `.win__bar` (pointer events; clamp on-screen). Click/focus raises z-index (`.win--active`). Builds a dock button per window (shows running dot when open) and a desktop icon per window (double-click or Enter opens). Esc closes the active window. On mobile (`matchMedia('(max-width:760px)')`) windows render full-screen and dragging is disabled.

### `scripts/chat.js` → `window.Chat` (Engineer owns)
```js
Chat.init(containerEl, flow /* = ABE_DATA.chat */, hooks /* {openWindow(id), openLink(href)} */)
```
Renders a Manychat-style scripted chat into `containerEl`. Bot messages appear one-by-one with a typing indicator (`.chat__typing`, ~500–900ms each, respect reduced-motion → near-instant). Quick-reply chips render under the log; tapping one appends a `.chat__msg--user` bubble then advances to the target node. `link` replies call `hooks.openLink`; `action:{openWindow:id}` replies call `hooks.openWindow`. Auto-scroll log to bottom. Never dead-ends — every node offers replies or a "start over".

### `scripts/main.js` (integration — **the human owns this, do NOT create it**)
Boot sequence, registers all windows with WM + supplies `render(bodyEl)` for each (work funnel, skills, ninety-days, résumé, about) from `ABE_DATA`, inits Chat, wires menubar (clock, CRT toggle on `#crt-overlay`, Hire CTA → opens contact), sticky note. Agents must NOT write main.js.

---

## Chat flow schema (`ABE_DATA.chat`) — Strategist owns
```js
chat: {
  start: "root",
  nodes: {
    root: {
      messages:[ "Hey! I'm Abe-bot 👋 …" ],
      replies:[
        { label:"Why Abe for this GTM role?", goto:"why" },
        { label:"Best growth work?",          goto:"growth" },
        { label:"Can he build AI workflows?", goto:"build" },
        { label:"First 90 days at Manychat",  goto:"ninety", action:{openWindow:"ninety"} },
        { label:"📄 Résumé",                   action:{openWindow:"resume"} },
        { label:"Book a call ▸",               goto:"contact" }
      ]
    },
    why: { messages:[…], replies:[ {label:"…",goto:"…"}, {label:"↩ back", goto:"root"} ] },
    contact: { messages:[…], links:[ {label:"✉ Email", href:"mailto:…"}, {label:"in LinkedIn", href:"…"} ], replies:[{label:"↩ back",goto:"root"}] },
    …
  }
}
```
Reply object: `{ label, goto?, action?:{openWindow:id}, link?:href }`. A node may have `messages` (required), `replies` (chips), and/or `links` (anchor buttons via `.chat__links`).

---

## CSS class contract (Designer styles; main.js & chat.js emit these)
Window **body** content classes — Designer must style all of these:
- Work funnel: `.funnel`, `.funnel__stage` (use `.is-growth` modifier for highlighted growth roles), `.funnel__role`, `.funnel__company`, `.funnel__meta`, `.funnel__summary`, `.funnel__highlights` (ul/li), `.tag`
- Skills: `.skills`, `.skills__group`, `.skills__group-title`, `.skill`, `.skill__name`, `.skill__bar`, `.skill__fill` (width set inline by main.js)
- Ninety-days: `.plan`, `.plan__intro`, `.plan__flow`, `.flow__step`, `.flow__arrow`, `.plan__phase`, `.plan__phase-head`, `.plan__phase-items`
- Résumé: `.resume-view`, `.resume-view__frame` (iframe/embed), `.resume-view__actions`
- About: `.about`, `.about__head`, `.about__avatar`, `.about__bio`, `.about__facts`, `.about__links`, `.linkrow`
- Chat (chat.js emits): `.chat`, `.chat__log`, `.chat__msg`, `.chat__msg--bot`, `.chat__msg--user`, `.chat__avatar`, `.chat__typing` (3 animated dots), `.chat__replies`, `.chip`, `.chat__links`
- Shared: `.btn`, `.btn--primary`, `.tag`, `.win`, `.win__bar`, `.win__lights`, `.win__btn` (`--close/--min/--zoom`), `.win__title`, `.win__body`, `.win--active`
Files: `reset.css` (Designer may leave minimal), `desktop.css` (menubar/screen/dock/icons/sticky/background canvas sizing/CRT overlay), `windows.css` (window chrome + all body content classes above except chat), `chat.css` (chat UI), `boot.css` (boot splash), `responsive.css` (≤760px: full-screen windows, dock as bottom tab bar, sticky hidden).

## Accessibility / perf
Respect `prefers-reduced-motion` everywhere (background, chat typing, transitions). Keyboard: Esc closes active window, chips & dock items are real `<button>`s, focus-visible rings. No layout shift. Target 60fps; canvas must throttle to one static frame under reduced-motion.
