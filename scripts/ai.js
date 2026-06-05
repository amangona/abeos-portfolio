/* ============================================================================
 * ai.js — OPTIONAL in-browser LLM for Abe-bot, via MLC WebLLM (WebGPU).
 * No API key, no backend: the model is downloaded once and runs ENTIRELY in
 * the visitor's browser (nothing leaves their device). Loaded lazily only when
 * a visitor opts in. Classic global; uses dynamic import() for the ESM lib so
 * the rest of the site keeps working without it.
 *
 *   window.AbeAI = {
 *     supported(): boolean,                 // WebGPU available?
 *     load(onProgress): Promise,            // download + init the model
 *     reply(history, onToken): Promise<str>,// stream an answer
 *     ready: boolean, model: string
 *   }
 * ==========================================================================*/
(function () {
  'use strict';

  // Small, capable instruct model (~1.1GB) that fits the "no-key, in-browser"
  // budget. Change this id to swap models (see MLC WebLLM's prebuilt list).
  var MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
  var WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm';

  var engine = null;
  var loading = null;

  function supported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  // Build a grounded system prompt from the real résumé data so the model
  // answers AS Abe-bot and won't invent employers / dates / metrics.
  function buildSystemPrompt() {
    var D = window.ABE_DATA || {};
    var id = D.identity || {}, L = D.links || {};
    var out = [];
    out.push('You are "Abe-bot", a friendly, lightly playful assistant on the personal portfolio site of ' + (id.name || 'Abe Mangona') + '.');
    out.push('Answer visitor questions about Abe concisely — usually 1-3 sentences, warm and a little fun.');
    out.push('IMPORTANT: only use the facts below. Never invent employers, job titles, dates, or metrics. If you do not know something, say so briefly and suggest emailing Abe at ' + (L.email || 'abemangona@gmail.com') + '. Only discuss Abe and his work.');
    out.push('');
    out.push('## Identity');
    out.push((id.name || '') + ' — ' + (id.title || '') + '. Based in ' + (id.location || '') + '.');
    if (D.about && D.about.bio) out.push(D.about.bio.join(' '));
    out.push('');
    out.push('## Experience (newest first)');
    (D.experience || []).forEach(function (e) {
      out.push('- ' + e.role + ' @ ' + e.company + ' (' + [e.team, e.dates, e.location].filter(Boolean).join(', ') + '): ' + (e.summary || '') +
        (e.highlights && e.highlights.length ? ' Highlights: ' + e.highlights.join(' ') : ''));
    });
    out.push('');
    out.push('## Projects');
    (D.projects || []).forEach(function (p) { out.push('- ' + p.name + ': ' + (p.blurb || '') + (p.appStore ? ' (on the App Store)' : '')); });
    out.push('');
    out.push('## Skills');
    (D.skills || []).forEach(function (g) { out.push('- ' + g.group + ': ' + (g.items || []).map(function (i) { return i.name; }).join(', ')); });
    out.push('');
    out.push('## Contact');
    out.push('Email ' + (L.email || '') + ' · LinkedIn ' + (L.linkedin || '') + ' · GitHub ' + (L.github || ''));
    return out.join('\n');
  }

  function load(onProgress) {
    if (engine) return Promise.resolve(engine);
    if (loading) return loading;
    if (!supported()) return Promise.reject(new Error('WebGPU not supported'));

    loading = (async function () {
      var webllm = await import(WEBLLM_URL);
      engine = await webllm.CreateMLCEngine(MODEL, {
        initProgressCallback: function (report) {
          if (onProgress) onProgress(report); // { progress: 0..1, text: '...' }
        }
      });
      return engine;
    })();
    return loading;
  }

  async function reply(history, onToken) {
    if (!engine) throw new Error('AI not loaded');
    var messages = [{ role: 'system', content: buildSystemPrompt() }].concat(history || []);
    var full = '';
    var stream = await engine.chat.completions.create({
      messages: messages,
      stream: true,
      temperature: 0.5,
      max_tokens: 480
    });
    for await (var chunk of stream) {
      var delta = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || '';
      if (delta) { full += delta; if (onToken) onToken(delta); }
    }
    return full.trim();
  }

  window.AbeAI = {
    supported: supported,
    load: load,
    reply: reply,
    model: MODEL,
    get ready() { return !!engine; }
  };
})();
