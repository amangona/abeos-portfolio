/* ============================================================================
 * chat.js — AbeOS scripted decision-tree chat  →  window.Chat
 * Classic global (no modules).
 *
 * Per CONTRACT.md:
 *   Chat.init(containerEl, flow /* = ABE_DATA.chat *​/, hooks /* {openWindow, openLink} *​/)
 *
 * flow = { start:"root", nodes:{ id: { messages:[…], replies?:[…], links?:[…] } } }
 * reply = { label, goto?, action?:{openWindow:id}, link?:href }
 * ==========================================================================*/
(function () {
  'use strict';

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // DOM helper
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  // ------------------------------------------------------------------------
  // init — wire one chat instance into containerEl
  // ------------------------------------------------------------------------
  function init(containerEl, flow, hooks) {
    if (!containerEl) { console.warn('[Chat] init: missing containerEl'); return; }
    flow = flow || { start: 'root', nodes: {} };
    hooks = hooks || {};
    var openWindow = typeof hooks.openWindow === 'function' ? hooks.openWindow : function () {};
    var openLink = typeof hooks.openLink === 'function'
      ? hooks.openLink
      : function (href) { if (href) window.open(href, '_blank', 'noopener'); };

    var nodes = flow.nodes || {};

    // --- build skeleton ---
    containerEl.innerHTML = '';
    var root = el('div', 'chat');
    var log = el('div', 'chat__log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-atomic', 'false');
    var replies = el('div', 'chat__replies');

    // Free-text composer — hidden until the visitor opts into live AI mode.
    var compose = el('form', 'chat__compose');
    compose.hidden = true;
    var input = el('input', 'chat__input');
    input.type = 'text';
    input.placeholder = 'Ask me anything about Abe…';
    input.setAttribute('aria-label', 'Ask Abe-bot anything');
    input.autocomplete = 'off';
    var send = el('button', 'chat__send', '➤');
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send');
    compose.appendChild(input);
    compose.appendChild(send);

    root.appendChild(log);
    root.appendChild(replies);
    root.appendChild(compose);
    containerEl.appendChild(root);

    // live-AI state
    var aiMode = false;
    var aiHistory = [];   // [{role:'user'|'assistant', content}]

    // --- per-instance state ---
    var typing = false;      // bot currently "typing"? (disables chips)
    var firstBotShown = false;  // first bot bubble gets the avatar

    function scrollToBottom() {
      // Defer to next frame so layout is settled.
      requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; });
    }

    function reduced() { return mqReduce.matches; }

    function typingDelay() {
      if (reduced()) return 0;
      return 500 + Math.floor(Math.random() * 400);  // 500–900ms
    }

    // ---- bubbles ----------------------------------------------------------
    function addBotBubble(text) {
      var msg = el('div', 'chat__msg chat__msg--bot');
      if (!firstBotShown) {
        var av = el('span', 'chat__avatar');
        av.setAttribute('aria-hidden', 'true');
        av.textContent = '🤖';
        msg.appendChild(av);
        firstBotShown = true;
      }
      var bub = el('div', 'chat__bubble', text);
      msg.appendChild(bub);
      log.appendChild(msg);
      scrollToBottom();
      return bub;
    }

    function addUserBubble(text) {
      var msg = el('div', 'chat__msg chat__msg--user');
      var bub = el('div', 'chat__bubble', text);
      msg.appendChild(bub);
      log.appendChild(msg);
      scrollToBottom();
    }

    // typing indicator: 3 bouncing dots
    function showTyping() {
      var t = el('div', 'chat__msg chat__msg--bot chat__typing-row');
      var ind = el('div', 'chat__typing');
      ind.setAttribute('aria-label', 'Abe-bot is typing');
      for (var i = 0; i < 3; i++) {
        var dot = el('span', 'chat__typing-dot');
        dot.setAttribute('aria-hidden', 'true');
        ind.appendChild(dot);
      }
      t.appendChild(ind);
      log.appendChild(t);
      scrollToBottom();
      return t;
    }

    // ---- chips / links ----------------------------------------------------
    function clearReplies() { replies.innerHTML = ''; }

    function setChipsDisabled(disabled) {
      var btns = replies.querySelectorAll('button.chip');
      for (var i = 0; i < btns.length; i++) btns[i].disabled = disabled;
    }

    // Render anchor-style link buttons INSIDE the log (.chat__links).
    function renderLinks(links) {
      if (!links || !links.length) return;
      var wrap = el('div', 'chat__links');
      for (var i = 0; i < links.length; i++) {
        (function (lk) {
          var a = el('a', 'btn chat__link', lk.label || lk.href || 'Open');
          a.href = lk.href || '#';
          a.target = '_blank';
          a.rel = 'noopener';
          wrap.appendChild(a);
        })(links[i]);
      }
      log.appendChild(wrap);
      scrollToBottom();
    }

    // Render reply chips for a node.
    function renderReplies(replyList) {
      clearReplies();
      if (!replyList || !replyList.length) return;
      for (var i = 0; i < replyList.length; i++) {
        (function (rep) {
          var chip = el('button', 'chip', rep.label || '…');
          chip.type = 'button';
          chip.addEventListener('click', function () { onReply(rep); });
          replies.appendChild(chip);
        })(replyList[i]);
      }
    }

    // Inject a "start over" chip so we never dead-end.
    function renderStartOver() {
      clearReplies();
      var chip = el('button', 'chip', '↩ Start over');
      chip.type = 'button';
      chip.addEventListener('click', function () {
        onReply({ label: '↩ Start over', goto: flow.start });
      });
      replies.appendChild(chip);
    }

    // ---- node playback ----------------------------------------------------
    // Render a node's messages one-by-one (each preceded by a typing pause),
    // then its links + replies. Chips stay disabled while "typing".
    function playNode(nodeId) {
      var node = nodes[nodeId];
      if (!node) { console.warn('[Chat] unknown node', nodeId); return; }

      typing = true;
      clearReplies();   // hide stale chips during playback

      var messages = (node.messages && node.messages.length) ? node.messages.slice() : [];

      function next(i) {
        if (i >= messages.length) {
          finishNode(node, nodeId);
          return;
        }
        var ind = showTyping();
        var delay = typingDelay();
        window.setTimeout(function () {
          if (ind && ind.parentNode) ind.parentNode.removeChild(ind);
          addBotBubble(messages[i]);
          next(i + 1);
        }, delay);
      }

      if (messages.length) next(0);
      else finishNode(node, nodeId);   // node with no messages still shows replies
    }

    function finishNode(node, nodeId) {
      renderLinks(node.links);

      typing = false;
      if (node.replies && node.replies.length) {
        renderReplies(node.replies);
      } else {
        // Never dead-end.
        renderStartOver();
      }
      scrollToBottom();
    }

    // Re-show the current node's replies without replaying messages
    // (used when an action has no goto so the user can keep interacting).
    var currentNodeId = null;
    function reshowCurrent() {
      var node = nodes[currentNodeId];
      typing = false;
      if (node && node.replies && node.replies.length) renderReplies(node.replies);
      else renderStartOver();
    }

    // Wrap playNode to track currentNodeId.
    function goTo(nodeId) {
      currentNodeId = nodeId;
      playNode(nodeId);
    }

    // ---- reply handling ---------------------------------------------------
    function onReply(rep) {
      if (typing) return;            // race guard (chips also disabled visually)

      // 1) echo as a user bubble
      addUserBubble(rep.label || '…');
      clearReplies();

      // 1.5) live-AI action — boot the in-browser model
      if (rep.action && rep.action.ai) {
        enterAI();
        return;
      }

      // 2) link reply: open link, keep current chips so user can continue.
      if (rep.link) {
        openLink(rep.link);
        reshowCurrent();
        return;
      }

      // 3) action.openWindow (may ALSO have goto).
      var didAction = false;
      if (rep.action && rep.action.openWindow) {
        try { openWindow(rep.action.openWindow); } catch (e) { console.error('[Chat] openWindow', e); }
        didAction = true;
      }

      // 4) goto advances (works alongside action).
      if (rep.goto) {
        goTo(rep.goto);
        return;
      }

      // 5) action but no goto → re-show current node's replies.
      if (didAction) {
        reshowCurrent();
        return;
      }

      // 6) nothing actionable → don't dead-end.
      reshowCurrent();
    }

    // Disable chips visually whenever typing flips on. We piggyback on the
    // existing flow: chips are only rendered after typing ends, so the main
    // guard is the `typing` flag in onReply. But if a node is mid-playback and
    // somehow chips exist, keep them disabled.
    // (renderReplies is only ever called with typing=false, so this is belt-and-suspenders.)

    // ---- live AI mode (optional, in-browser via WebLLM) -------------------
    // Render arbitrary chips with custom click handlers (for AI prompts).
    function renderCustomChips(items) {
      clearReplies();
      items.forEach(function (it) {
        var chip = el('button', 'chip', it.label);
        chip.type = 'button';
        chip.addEventListener('click', it.onClick);
        replies.appendChild(chip);
      });
    }

    function backToMenuReplies() {
      currentNodeId = flow.start;
      var node = nodes[flow.start];
      if (node && node.replies && node.replies.length) renderReplies(node.replies);
      else renderStartOver();
    }

    function enterAI() {
      if (!window.AbeAI || !AbeAI.supported()) {
        addBotBubble('Heads up — the live AI needs a desktop browser with WebGPU (a recent Chrome, Edge, or Safari). This browser can’t run it, so let’s stick with the quick menu. 🙂');
        backToMenuReplies();
        return;
      }
      addBotBubble('Nice — I can boot a real AI that runs 100% inside your browser. Nothing you type leaves your device. 🔒');
      addBotBubble('It’s a one-time ~1GB model download (cached after that). Want to load it?');
      renderCustomChips([
        { label: '⚡ Load the AI ▸', onClick: startAILoad },
        { label: '↩ keep it quick', onClick: function () { addUserBubble('↩ keep it quick'); goTo(flow.start); } }
      ]);
    }

    function progressBar(pct) {
      var filled = Math.max(0, Math.min(5, Math.round(pct / 20)));
      var bar = '';
      for (var i = 0; i < 5; i++) bar += i < filled ? '▰' : '▱';
      return bar + ' ' + pct + '%';
    }

    function startAILoad() {
      clearReplies();
      typing = true;
      var bub = addBotBubble('Loading the AI… first run can take a minute.  ' + progressBar(0));
      AbeAI.load(function (report) {
        var pct = Math.round((report && report.progress ? report.progress : 0) * 100);
        bub.textContent = 'Loading the AI… first run can take a minute.  ' + progressBar(pct);
        scrollToBottom();
      }).then(function () {
        typing = false;
        aiMode = true;
        aiHistory = [];
        bub.textContent = '✅ AI loaded — running locally in your browser.';
        addBotBubble('Ask me anything about Abe — his work, projects, skills, whatever you’re curious about.');
        compose.hidden = false;
        renderCustomChips([{ label: '↩ back to quick menu', onClick: exitAI }]);
        input.focus();
      }).catch(function (e) {
        typing = false;
        console.error('[Chat] AI load failed', e);
        addBotBubble('Hmm, the AI didn’t load (' + (e && e.message ? e.message : 'unknown error') + '). No worries — the quick menu still works.');
        backToMenuReplies();
      });
    }

    function exitAI() {
      aiMode = false;
      compose.hidden = true;
      addUserBubble('↩ back to quick menu');
      goTo(flow.start);
    }

    // Composer submit → stream a grounded answer from the local model.
    compose.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!aiMode || typing) return;
      var text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      addUserBubble(text);
      aiHistory.push({ role: 'user', content: text });

      typing = true;
      send.disabled = true; input.disabled = true;
      var ind = showTyping();
      var bub = null;

      AbeAI.reply(aiHistory.slice(), function (tok) {
        if (!bub) { if (ind && ind.parentNode) ind.parentNode.removeChild(ind); bub = addBotBubble(''); }
        bub.textContent += tok;
        scrollToBottom();
      }).then(function (full) {
        if (ind && ind.parentNode) ind.parentNode.removeChild(ind);
        if (!bub) bub = addBotBubble(full || '…');
        aiHistory.push({ role: 'assistant', content: full || bub.textContent });
        if (aiHistory.length > 12) aiHistory = aiHistory.slice(-12);   // cap context
        typing = false; send.disabled = false; input.disabled = false; input.focus();
        scrollToBottom();
      }).catch(function (err) {
        if (ind && ind.parentNode) ind.parentNode.removeChild(ind);
        console.error('[Chat] AI reply failed', err);
        addBotBubble('Sorry — I hit an error generating that. Mind trying again?');
        typing = false; send.disabled = false; input.disabled = false;
      });
    });

    // ---- boot the flow ----------------------------------------------------
    goTo(flow.start);
  }

  // expose global
  window.Chat = { init: init };
})();
