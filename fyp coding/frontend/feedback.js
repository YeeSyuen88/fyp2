(function () {
  "use strict";

  function t(key) {
    if (typeof window.getTranslation === "function" && typeof window.getLang === "function") {
      var val = window.getTranslation(window.getLang(), key);
      return val != null ? val : key;
    }
    return key;
  }

  // Formspree form ID — submissions go to the email set in Formspree dashboard for this form (set to yeesyuen647@gmail.com)
  var FORMSPREE_FORM_ID = "xjgaypev";
  var MIN_CHARS = 10;

  var form = document.getElementById("feedback-form");
  var starsWrap = document.getElementById("stars-wrap");
  var stars = starsWrap ? starsWrap.querySelectorAll(".star") : [];
  var ratingText = document.getElementById("rating-text");
  var commentEl = document.getElementById("comment");
  var charCount = document.getElementById("char-count");
  var charHint = document.getElementById("char-hint");
  var btnCancel = document.getElementById("btn-cancel");
  var btnSubmit = document.getElementById("btn-submit");
  var msgEl = document.getElementById("feedback-msg");
  var msgTextEl = document.getElementById("feedback-msg-text");
  var msgIconEl = document.getElementById("feedback-msg-icon");

  var selectedRating = 0;

  function updateStars() {
    stars.forEach(function (star) {
      var val = parseInt(star.getAttribute("data-value"), 10);
      star.classList.toggle("filled", val <= selectedRating);
    });
    if (ratingText) {
      if (selectedRating === 0) ratingText.textContent = t("feedback.noRating");
      else if (selectedRating === 1) ratingText.textContent = t("feedback.oneStar");
      else ratingText.textContent = selectedRating + t("feedback.stars");
    }
  }

  function updateCharCount() {
    var len = commentEl ? commentEl.value.length : 0;
    if (charCount) charCount.textContent = len + (len === 1 ? t("feedback.character") : t("feedback.characters"));
    if (charHint) charHint.classList.toggle("invalid", len > 0 && len < MIN_CHARS);
  }

  function showMessage(text, isError, showSuccessIcon) {
    if (!msgEl) return;
    if (msgTextEl) msgTextEl.textContent = text || "";
    msgEl.className = "feedback-msg" + (isError ? " error" : " success");
    msgEl.style.display = text ? "flex" : "none";
    if (msgIconEl) msgIconEl.style.display = showSuccessIcon ? "inline-flex" : "none";
  }

  if (stars.length) {
    stars.forEach(function (star) {
      star.addEventListener("click", function () {
        selectedRating = parseInt(star.getAttribute("data-value"), 10);
        updateStars();
      });
    });
  }

  if (commentEl) {
    commentEl.addEventListener("input", updateCharCount);
    commentEl.addEventListener("paste", function () { setTimeout(updateCharCount, 0); });
  }
  updateCharCount();

  if (btnCancel) {
    btnCancel.addEventListener("click", function () {
      selectedRating = 0;
      updateStars();
      if (commentEl) commentEl.value = "";
      updateCharCount();
      var quickInputs = form && form.querySelectorAll('input[name="quick"]');
      if (quickInputs) for (var k = 0; k < quickInputs.length; k++) quickInputs[k].checked = false;
      showMessage("");
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      showMessage("", false, false);

      var comment = (commentEl && commentEl.value) ? commentEl.value.trim() : "";
      if (comment.length < MIN_CHARS) {
        if (charHint) charHint.classList.add("invalid");
        if (commentEl) commentEl.focus();
        showMessage("Please enter at least 10 characters in your comment.", true, false);
        return;
      }

      if (!confirm("Are you sure you want to submit your feedback?")) {
        return;
      }

      var quickChecked = form.querySelectorAll('input[name="quick"]:checked');
      var quickLabels = [];
      for (var i = 0; i < quickChecked.length; i++) quickLabels.push(quickChecked[i].value);
      var quickStr = quickLabels.length ? quickLabels.join(", ") : "None";

      var ratingStr = selectedRating === 0 ? "No rating" : selectedRating + " / 5";
      var bodyText = "EstateView Private Feedback\n\nRating: " + ratingStr + "\n\nQuick select: " + quickStr + "\n\nComment:\n" + comment;

      btnSubmit.disabled = true;
      btnSubmit.textContent = t("feedback.sending");

      fetch("https://formspree.io/f/" + FORMSPREE_FORM_ID, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: bodyText,
          rating: ratingStr,
          quick_select: quickStr,
          comment: comment,
          _subject: "EstateView Private Feedback",
        }),
      })
        .then(function (res) {
          if (res.ok) return { ok: true };
          return res.json().then(function (data) { return { ok: false, error: (data && data.error) || "Send failed" }; }).catch(function () { return { ok: false, error: "Send failed" }; });
        })
        .then(function (result) {
          if (result.ok) {
            showMessage("Thank you! Your feedback has been sent.", false, true);
            selectedRating = 0;
            updateStars();
            if (commentEl) commentEl.value = "";
            updateCharCount();
            var quickInputs = form.querySelectorAll('input[name="quick"]');
            for (var j = 0; j < quickInputs.length; j++) quickInputs[j].checked = false;
          } else {
            showMessage(result.error || "Could not send. Please try again.", true, false);
          }
        })
        .catch(function () {
          showMessage("Network error. Please check your connection and try again.", true, false);
        })
        .finally(function () {
          btnSubmit.disabled = false;
          btnSubmit.textContent = t("feedback.submitFeedback");
        });
    });
  }

  document.addEventListener("languagechange", function () {
    updateStars();
    updateCharCount();
  });
})();
