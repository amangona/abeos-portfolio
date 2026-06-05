# AbeOS — an interactive desktop‑OS portfolio

A retro, sunny, **Classic‑Macintosh‑style desktop** you boot into — draggable windows, a dock, and a chat assistant ("Abe‑bot") that can optionally become a **real AI running entirely in your browser**. Built as a **zero‑dependency, zero‑build static site** (plain HTML/CSS/JS). Originally Abe Mangona's portfolio; designed so anyone can fork it and make it their own.

> Aesthetic: warm cream/sand surfaces, coral/teal/mustard accents, System‑7 pinstripe title bars, pixel display font, and an animated poolside‑sunset background. Inspired by [poolsuite.net](https://poolsuite.net).

## ✨ Features

- 🖥️ **Bootable desktop OS** — boot splash, menu bar, dock, desktop icons, and draggable/zoomable windows that can slide behind the bars and off‑screen like a real OS.
- 💬 **Abe‑bot chat** — a scripted, tap‑to‑answer decision tree by default…
- 🧠 **…that can upgrade to a real LLM** — opt‑in, in‑browser via [MLC WebLLM](https://github.com/mlc-ai/web-llm) (WebGPU). **No API key, no backend, no cost** — the model downloads once and runs 100% on the visitor's device.
- 🚀 **Windows**: Chat · Projects (with App‑Store icons + links) · Work history · Skills · About · Résumé (embedded PDF).
- 📱 **Responsive** (full‑screen windows + tab‑bar dock on mobile), ♿ keyboard + `prefers-reduced-motion` friendly.
- 🧩 **One file to edit** — all content lives in `scripts/data.js`.

## 🏁 Quick start

```bash
# 1. clone
git clone https://github.com/amangona/abeos-portfolio.git
cd abeos-portfolio

# 2. add your content (data.js is gitignored — start from the template)
cp scripts/data.example.js scripts/data.js
#    …then edit scripts/data.js

# 3. (optional) drop your own résumé so the Résumé window works
#    put a file named  resume.pdf  in the project root

# 4. run a local server (any static server works)
python3 -m http.server 8000
#    → open http://localhost:8000
```

> **Why a server?** Plain ES‑free scripts also work by double‑clicking `index.html` (`file://`), but the embedded résumé PDF and the live‑AI mode need `http://localhost` or an `https://` deploy (WebGPU requires a secure context).

## ✏️ Customizing

Everything you'll touch is in **`scripts/data.js`** (`window.ABE_DATA`):

| Field | What it controls |
|------|------------------|
| `identity` / `links` | Name, title, location, blurb, email, LinkedIn, GitHub, résumé path |
| `experience[]` | Roles, highlights, tags. `featured: true` adds a coral highlight + badge |
| `skills[]` | Grouped skill bars (`level` is 0–100) |
| `projects[]` | Cards. Optional `icon` (image path), `appStore`, `github` — buttons appear only when a URL is set |
| `about` | Bio paragraphs + fun facts |
| `chat` | The Abe‑bot flow — a tree of `nodes` with quick‑reply chips (see comments in the file) |

Other tweaks:
- **Résumé** — replace `resume.pdf` in the project root (gitignored by default).
- **Project icons** — drop square images in `assets/icons/` and point `projects[].icon` at them.
- **Favicon** — edit `assets/favicon.svg` (and the PNGs referenced in `index.html`).
- **Live‑AI model** — change the one‑line `MODEL` constant in `scripts/ai.js` (any model from WebLLM's prebuilt list; bigger = smarter but a larger download).
- **Colors / theme** — the palette lives in CSS custom properties at the top of `styles/desktop.css` (`:root`).

## 🧠 The live‑AI chat (optional)

In the chat, tap **"🧠 Ask me anything (live AI)"** → confirm the one‑time **~1 GB** model download → then type free‑form questions. It's grounded in a system prompt built from your `data.js`, so it answers accurately and won't make things up.

- **No key, no server, private** — runs on the visitor's GPU via WebGPU.
- **Requirements** — a recent desktop **Chrome / Edge / Safari** with WebGPU, served over `https://` (or `localhost`). If WebGPU isn't available it gracefully falls back to the scripted flow.
- Swap the model in `scripts/ai.js` (`MODEL`). Smaller (e.g. `Llama-3.2-1B-Instruct-q4f16_1-MLC`) loads faster; bigger answers better.

## 🚀 Deploy

It's a static site — host the folder anywhere.

**Netlify (drag & drop)** — easiest:
1. Make sure `scripts/data.js` and `resume.pdf` exist locally (they're gitignored, not in the repo).
2. Drag the project folder onto **https://app.netlify.com/drop**. Done.

**Netlify / Vercel / Cloudflare Pages from Git** — connect the repo, no build command, publish directory `.`. ⚠️ Because `scripts/data.js` and `resume.pdf` are gitignored, either commit your own (un‑ignore them in your fork) or add them via the host's UI, or just use drag‑and‑drop.

**GitHub Pages** — push, then enable Pages on the branch root. (Same gitignore caveat — add your `data.js`/`resume.pdf`.)

## 🗂️ Project structure

```
index.html              # DOM shell + script/style load order
scripts/
  data.example.js       # ← copy to data.js and edit (your content)
  data.js               # your content (gitignored)
  background.js          # animated poolside-sunset canvas
  wm.js                 # window manager (open/drag/focus/dock/icons)
  chat.js               # scripted chat engine + live-AI wiring
  ai.js                 # optional in-browser LLM (WebLLM / WebGPU)
  main.js               # boot sequence + window rendering + wiring
styles/                 # reset · boot · desktop · windows · chat · responsive
assets/                 # favicon(s), project icons, (your avatar — gitignored)
CONTRACT.md             # internal build/interface notes (data shape, JS APIs, CSS classes)
```

## 🛠️ Tech

No frameworks, no build step, no bundler, no tracking. Classic `<script>` tags (so it also opens via `file://`), Canvas 2D background, CSS `backdrop-filter`, and `import()`‑on‑demand for the optional AI. Fonts: Pixelify Sans, Space Grotesk, DM Mono.

## 📄 License

[MIT](./LICENSE) — fork it, remix it, make it yours.
