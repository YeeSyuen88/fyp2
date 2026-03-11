(function () {
  "use strict";

  var WELCOME = "Hi! I'm the EstateView assistant. Ask me anything about the map, property filter, price estimation, or community.";

  function createWrap() {
    if (document.getElementById("chatbot-wrap")) return;
    var wrap = document.createElement("div");
    wrap.id = "chatbot-wrap";
    wrap.innerHTML =
      '<button type="button" id="chatbot-btn" aria-label="Open chat" title="Chat">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
      '</button>' +
      '<div id="chatbot-panel">' +
        '<div id="chatbot-header">' +
          '<span>Chat</span>' +
          '<button type="button" id="chatbot-minimize" aria-label="Minimize" title="Minimize">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>' +
          '</button>' +
        '</div>' +
        '<div id="chatbot-messages"></div>' +
        '<div id="chatbot-input-wrap">' +
          '<input type="text" id="chatbot-input" placeholder="Type your question..." autocomplete="off" />' +
          '<button type="button" id="chatbot-send">Send</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  function addMessage(text, type) {
    var container = document.getElementById("chatbot-messages");
    if (!container) return;
    var msg = document.createElement("div");
    msg.className = "msg " + (type || "bot");
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function sendToBackend(message, callback) {
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.reply != null) callback(data.reply);
        else callback("Sorry, I couldn't get a response. Please try again.");
      })
      .catch(function () {
        callback("Sorry, something went wrong. Please try again.");
      });
  }

  function sendMessage() {
    var input = document.getElementById("chatbot-input");
    var sendBtn = document.getElementById("chatbot-send");
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    if (sendBtn) sendBtn.disabled = true;
    addMessage(text, "user");
    sendToBackend(text, function (reply) {
      addMessage(reply, "bot");
      if (sendBtn) sendBtn.disabled = false;
    });
  }

  function init() {
    createWrap();
    var wrap = document.getElementById("chatbot-wrap");
    var panel = document.getElementById("chatbot-panel");
    var input = document.getElementById("chatbot-input");
    var sendBtn = document.getElementById("chatbot-send");

    addMessage(WELCOME, "welcome");

    if (wrap && panel) {
      wrap.addEventListener("click", function (e) {
        if (e.target.id === "chatbot-minimize" || (e.target.closest && e.target.closest("#chatbot-minimize"))) {
          e.stopPropagation();
          panel.classList.remove("open");
          return;
        }
        if (e.target.id === "chatbot-btn" || (e.target.closest && e.target.closest("#chatbot-btn"))) {
          e.stopPropagation();
          panel.classList.toggle("open");
          if (panel.classList.contains("open") && input) input.focus();
        }
      });
    }

    document.addEventListener("click", function (e) {
      var onButton = e.target.id === "chatbot-btn" || (e.target.closest && e.target.closest("#chatbot-btn"));
      var onAskChatbotBtn = e.target.closest && e.target.closest(".btn-ask-chatbot");
      if (panel && panel.classList.contains("open") && !panel.contains(e.target) && !onButton && !onAskChatbotBtn) {
        panel.classList.remove("open");
      }
    });

    if (sendBtn) sendBtn.addEventListener("click", sendMessage);
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    window.ensureChatbotReady = function () {
      createWrap();
    };

    window.askChatbot = function (question) {
      if (!question) return;
      createWrap();
      var p = document.getElementById("chatbot-panel");
      var inp = document.getElementById("chatbot-input");
      if (!p) return;
      p.classList.add("open");
      var scrollMessages = function () {
        var container = document.getElementById("chatbot-messages");
        if (container) container.scrollTop = container.scrollHeight;
      };
      addMessage(question, "user");
      scrollMessages();
      if (inp) {
        inp.focus();
      }
      sendToBackend(question, function (reply) {
        addMessage(reply, "bot");
        scrollMessages();
      });
    };

    document.addEventListener("estateview-ask-chatbot", function (e) {
      var q = e.detail && e.detail.question;
      if (q && window.askChatbot) window.askChatbot(q);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
