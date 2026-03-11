(function () {
  "use strict";

  var feedList = document.getElementById("feed-list");
  var feedLoading = document.getElementById("feed-loading");
  var feedEmpty = document.getElementById("feed-empty");
  var searchInput = document.getElementById("search-input");
  var categoryChips = document.getElementById("category-chips");
  var modalOverlay = document.getElementById("modal-overlay");
  var modalClose = document.getElementById("modal-close");
  var modalCancel = document.getElementById("modal-cancel");
  var btnNewPost = document.getElementById("btn-new-post");
  var newPostForm = document.getElementById("new-post-form");

  var currentCategory = "All";
  var currentState = "";
  var searchTimeout = null;
  var areaOptions = { states: [], districts_by_state: {} };
  var isAdmin = false;
  var filterStateBtn = document.getElementById("filter-by-state-btn");
  var filterStateDropdown = document.getElementById("filter-state-dropdown");
  var loadMoreWrap = document.getElementById("load-more-wrap");
  var btnLoadMore = document.getElementById("btn-load-more");
  var POSTS_LIMIT = 10;
  var feedOffset = 0;
  var feedHasMore = false;

  function getFingerprint() {
    var key = "estateview_fp";
    try {
      var fp = localStorage.getItem(key);
      if (fp) return fp;
      fp = "fp_" + Math.random().toString(36).slice(2) + "_" + Date.now();
      localStorage.setItem(key, fp);
      return fp;
    } catch (e) {
      return "fp_anon_" + Date.now();
    }
  }

  function showLoading() {
    feedLoading.style.display = "block";
    feedList.style.display = "none";
    if (loadMoreWrap) loadMoreWrap.style.display = "none";
    feedEmpty.style.display = "none";
  }

  function hasActiveFilters() {
    var q = (searchInput && searchInput.value) ? searchInput.value.trim() : "";
    return q !== "" || (currentCategory !== "All") || (currentState !== "");
  }

  function t(key) {
    if (typeof window.getTranslation === "function" && typeof window.getLang === "function") {
      var val = window.getTranslation(window.getLang(), key);
      return val != null ? val : key;
    }
    return key;
  }

  function updateEmptyStateText() {
    if (!feedEmpty || feedEmpty.style.display !== "block") return;
    if (hasActiveFilters()) {
      feedEmpty.innerHTML = "<p>" + t("comments.noMatchFilters") + "</p>" +
        "<button type=\"button\" class=\"btn-clear-filters\" id=\"btn-clear-filters\">" + t("comments.clearFilters") + "</button>";
    } else {
      feedEmpty.innerHTML = t("comments.noPostsYet");
    }
  }

  document.addEventListener("languagechange", function () {
    if (feedLoading && feedLoading.getAttribute("data-i18n")) {
      feedLoading.textContent = t("comments.loadingPosts");
    }
    if (btnLoadMore) btnLoadMore.textContent = t("comments.loadMore");
    updateEmptyStateText();
  });

  function showFeed(posts, append, total, hasMore) {
    feedLoading.style.display = "none";
    if (!posts || posts.length === 0) {
      if (!append) {
        feedList.style.display = "none";
        feedList.innerHTML = "";
        if (loadMoreWrap) loadMoreWrap.style.display = "none";
        feedEmpty.style.display = "block";
        if (hasActiveFilters()) {
          feedEmpty.innerHTML = "<p>" + t("comments.noMatchFilters") + "</p>" +
            "<button type=\"button\" class=\"btn-clear-filters\" id=\"btn-clear-filters\">" + t("comments.clearFilters") + "</button>";
        } else {
          feedEmpty.innerHTML = t("comments.noPostsYet");
        }
      }
      return;
    }
    feedEmpty.style.display = "none";
    feedList.style.display = "flex";
    if (!append) feedList.innerHTML = "";
    posts.forEach(function (post) {
      feedList.appendChild(renderPost(post));
    });
    feedHasMore = !!hasMore;
    if (loadMoreWrap) loadMoreWrap.style.display = feedHasMore ? "block" : "none";
  }

  function clearFilters() {
    if (searchInput) searchInput.value = "";
    currentCategory = "All";
    currentState = "";
    if (categoryChips) {
      categoryChips.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("active", (c.getAttribute("data-category") || "All") === "All");
      });
    }
    if (filterStateBtn) filterStateBtn.classList.remove("active");
    if (filterStateDropdown) {
      filterStateDropdown.querySelectorAll(".filter-opt").forEach(function (o) {
        o.classList.toggle("active", (o.getAttribute("data-state") || "").trim() === "");
      });
    }
    fillFilterStateDropdown();
    loadPosts();
  }

  function initial(name) {
    if (!name || !name.trim()) return "?";
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().charAt(0).toUpperCase();
  }

  function categoryClass(cat) {
    if (!cat) return "general";
    return (cat.toLowerCase());
  }

  function renderPost(post) {
    var card = document.createElement("article");
    card.className = "post-card";
    card.setAttribute("data-post-id", String(post.id));
    var likes = post.likes != null ? post.likes : 0;
    var commentCount = post.comment_count != null ? post.comment_count : 0;
    var liked = post.liked ? " action-btn liked" : " action-btn";
    var catTag = "<span class=\"post-category-tag " + categoryClass(post.category) + "\">" + (post.category || "General") + "</span>";
    card.innerHTML =
      "<div class=\"post-meta\">" +
        "<div class=\"post-avatar\" aria-hidden=\"true\">" + initial(post.author_name) + "</div>" +
        "<div class=\"post-meta-text\">" +
          "<span class=\"name\">" + escapeHtml(post.author_name || "Anonymous") + "</span>" +
          "<span class=\"role\">RESIDENT</span>" +
          "<span class=\"date\">" + formatDateTime(post.created_at) + "</span>" +
          "<div class=\"post-area\">" + escapeHtml(post.area || "—") + "</div>" +
        "</div>" +
      "</div>" +
      catTag +
      "<h3>" + escapeHtml(post.title || "") + "</h3>" +
      "<div class=\"post-content\">" + escapeHtml(post.content || "") + "</div>" +
      "<div class=\"post-actions\">" +
        "<button type=\"button\" class=\"action-btn" + liked + "\" data-action=\"like\" data-post-id=\"" + escapeHtml(String(post.id)) + "\" aria-label=\"Like\">♥ <span class=\"like-count\">" + likes + "</span></button>" +
        "<button type=\"button\" class=\"action-btn\" data-action=\"comment\" data-post-id=\"" + escapeHtml(String(post.id)) + "\" aria-label=\"Comments\">💬 <span class=\"comment-count\">" + commentCount + "</span></button>" +
        "<button type=\"button\" class=\"action-btn\" data-action=\"share\" data-post-id=\"" + escapeHtml(String(post.id)) + "\" aria-label=\"Share\">Share</button>" +
        (isAdmin ? "<button type=\"button\" class=\"btn-delete-post\" data-action=\"delete-post\" data-post-id=\"" + escapeHtml(String(post.id)) + "\" aria-label=\"Delete post\">Delete</button>" : "") +
      "</div>";
    return card;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatDate(s) {
    if (!s) return "—";
    try {
      var d = new Date(s);
      if (isNaN(d.getTime())) return s;
      var m = d.getMonth() + 1;
      var day = d.getDate();
      var y = d.getFullYear();
      return m + "/" + day + "/" + y;
    } catch (e) {
      return s;
    }
  }

  function formatDateTime(s) {
    if (!s) return "—";
    try {
      var utcStr = String(s).trim().replace(" ", "T");
      if (!/Z|[+-]\d{2}:?\d{2}$/.test(utcStr)) utcStr += "Z";
      var d = new Date(utcStr);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).replace(/\//g, "/");
    } catch (e) {
      return s;
    }
  }

  function loadPosts(append) {
    if (!append) feedOffset = 0;
    if (!append) showLoading();
    else if (btnLoadMore) { btnLoadMore.disabled = true; btnLoadMore.textContent = t("comments.loadingPosts"); }
    var params = new URLSearchParams();
    params.set("limit", String(POSTS_LIMIT));
    params.set("offset", String(feedOffset));
    if (currentCategory && currentCategory !== "All") params.set("category", currentCategory);
    if (currentState) params.set("state", currentState);
    var q = (searchInput && searchInput.value) ? searchInput.value.trim() : "";
    if (q) params.set("search", q);
    var fp = getFingerprint();
    if (fp) params.set("fingerprint", fp);
    var url = "/api/public-posts" + (params.toString() ? "?" + params.toString() : "");
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var posts = data.posts || [];
        var total = data.total != null ? data.total : 0;
        var hasMore = !!data.has_more;
        if (append && feedList) {
          feedOffset += posts.length;
          posts.forEach(function (post) { feedList.appendChild(renderPost(post)); });
          feedHasMore = hasMore;
          if (loadMoreWrap) loadMoreWrap.style.display = hasMore ? "block" : "none";
          if (btnLoadMore) { btnLoadMore.disabled = false; btnLoadMore.textContent = t("comments.loadMore"); }
        } else if (!append) {
          feedOffset = posts.length;
          showFeed(posts, false, total, hasMore);
        } else if (btnLoadMore) {
          btnLoadMore.disabled = false;
          btnLoadMore.textContent = t("comments.loadMore");
        }
      })
      .catch(function () {
        if (append && btnLoadMore) { btnLoadMore.disabled = false; btnLoadMore.textContent = t("comments.loadMore"); }
        else showFeed([], false);
      });
  }

  function showToast(message) {
    var container = document.getElementById("toast-container");
    if (!container) return;
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2500);
  }

  function loadAreaOptions() {
    return fetch("/api/estimator/options")
      .then(function (res) {
        if (!res.ok) throw new Error("options not available");
        return res.json();
      })
      .then(function (data) {
        areaOptions.states = data.states || [];
        areaOptions.districts_by_state = data.districts_by_state || {};
        return true;
      })
      .catch(function () {
        return fetch("/api/states")
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (states) {
            areaOptions.states = states || [];
            areaOptions.districts_by_state = {};
            return true;
          })
          .catch(function () {
            areaOptions.states = [];
            areaOptions.districts_by_state = {};
            return false;
          });
      });
  }

  function fillStateSelect() {
    var sel = document.getElementById("post-state");
    if (!sel) return;
    sel.innerHTML = "<option value=\"\">— Select state —</option>";
    (areaOptions.states || []).forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  }

  function fillDistrictSelect(state) {
    var sel = document.getElementById("post-district");
    if (!sel) return;
    sel.innerHTML = "<option value=\"\">— Any —</option>";
    var list = (areaOptions.districts_by_state || {})[state];
    if (list && list.length) {
      list.forEach(function (d) {
        var opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        sel.appendChild(opt);
      });
      return;
    }
    if (!state) return;
    fetch("/api/districts?state=" + encodeURIComponent(state))
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (keys) {
        if (!sel.parentNode) return;
        sel.innerHTML = "<option value=\"\">— Any —</option>";
        keys.forEach(function (key) {
          var districtName = key.indexOf("|") >= 0 ? key.split("|").slice(1).join("|") : key;
          var opt = document.createElement("option");
          opt.value = districtName;
          opt.textContent = districtName;
          sel.appendChild(opt);
        });
      })
      .catch(function () {});
  }

  function openModal() {
    if (modalOverlay) modalOverlay.classList.add("open");
    if (newPostForm) newPostForm.reset();
    fillStateSelect();
    fillDistrictSelect("");
    var stateSel = document.getElementById("post-state");
    if (stateSel && !stateSel.dataset.bound) {
      stateSel.dataset.bound = "1";
      stateSel.addEventListener("change", function () {
        fillDistrictSelect(stateSel.value || "");
      });
    }
  }

  function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove("open");
  }

  if (categoryChips) {
    categoryChips.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      categoryChips.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      currentCategory = chip.getAttribute("data-category") || "All";
      loadPosts();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function () { loadPosts(); }, 300);
    });
  }

  if (btnLoadMore) {
    btnLoadMore.addEventListener("click", function () { loadPosts(true); });
  }

  var feedContainer = document.getElementById("feed-container");
  if (feedContainer) {
    feedContainer.addEventListener("click", function (e) {
      if (e.target.id === "btn-clear-filters" || e.target.classList.contains("btn-clear-filters")) {
        clearFilters();
      }
    });
  }

  function fillFilterStateDropdown() {
    if (!filterStateDropdown) return;
    var first = filterStateDropdown.querySelector(".filter-opt[data-state=\"\"]");
    filterStateDropdown.innerHTML = "";
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-opt" + (currentState ? "" : " active");
    allBtn.setAttribute("data-state", "");
    allBtn.setAttribute("data-i18n", "comments.allStates");
    allBtn.textContent = t("comments.allStates");
    filterStateDropdown.appendChild(allBtn);
    (areaOptions.states || []).forEach(function (s) {
      var opt = document.createElement("button");
      opt.type = "button";
      opt.className = "filter-opt" + (currentState === s ? " active" : "");
      opt.setAttribute("data-state", s);
      opt.textContent = s;
      filterStateDropdown.appendChild(opt);
    });
  }

  if (filterStateBtn && filterStateDropdown) {
    filterStateBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      filterStateDropdown.classList.toggle("open");
    });
    filterStateDropdown.addEventListener("click", function (e) {
      var opt = e.target.closest(".filter-opt");
      if (!opt) return;
      currentState = (opt.getAttribute("data-state") || "").trim();
      filterStateBtn.classList.toggle("active", !!currentState);
      filterStateDropdown.querySelectorAll(".filter-opt").forEach(function (o) {
        o.classList.toggle("active", (o.getAttribute("data-state") || "").trim() === currentState);
      });
      filterStateDropdown.classList.remove("open");
      loadPosts();
    });
    document.addEventListener("click", function () {
      filterStateDropdown.classList.remove("open");
    });
  }

  function renderCommentsList(commentsList, comments, postId) {
    if (!commentsList) return;
    commentsList.innerHTML = "";
    if (!comments || comments.length === 0) {
      commentsList.innerHTML = "<p class=\"feed-empty\">No comments yet.</p>";
      return;
    }
    comments.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML =
        "<div class=\"comment-meta\"><span class=\"author\">" + escapeHtml(c.author_name || "Anonymous") + "</span> · " + formatDateTime(c.created_at) + "</div>" +
        "<div class=\"comment-content\">" + escapeHtml(c.content || "") + "</div>" +
        (isAdmin ? "<button type=\"button\" class=\"btn-delete-comment\" data-post-id=\"" + escapeHtml(String(postId)) + "\" data-comment-id=\"" + escapeHtml(String(c.id)) + "\">Delete</button>" : "");
      commentsList.appendChild(div);
    });
    if (isAdmin) {
      commentsList.querySelectorAll(".btn-delete-comment").forEach(function (b) {
        b.addEventListener("click", function () {
          var pid = b.getAttribute("data-post-id");
          var cid = b.getAttribute("data-comment-id");
          if (!confirm("Delete this comment?")) return;
          fetch("/api/public-posts/" + pid + "/comments/" + cid, { method: "DELETE", credentials: "include" })
            .then(function (res) {
              if (res.ok) {
                fetch("/api/public-posts/" + pid + "/comments").then(function (r) { return r.json(); }).then(function (data) {
                  renderCommentsList(document.getElementById("comments-list"), data.comments || [], pid);
                  updatePostCommentCount(pid, (data.comments || []).length);
                });
              }
            });
        });
      });
    }
  }

  function openCommentsModal(postId) {
    var commentPostId = document.getElementById("comment-post-id");
    var commentsList = document.getElementById("comments-list");
    var commentsModal = document.getElementById("comments-modal");
    var commentContent = document.getElementById("comment-content");
    if (commentPostId) commentPostId.value = String(postId);
    if (commentsModal) commentsModal.classList.add("open");
    if (commentContent) commentContent.value = "";
    if (commentsList) commentsList.innerHTML = "<p class=\"feed-loading\">" + t("comments.loadingPosts") + "</p>";
    fetch("/api/public-posts/" + postId + "/comments")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        renderCommentsList(commentsList, data.comments || [], postId);
      })
      .catch(function () {
        if (commentsList) commentsList.innerHTML = "<p class=\"feed-empty\">Could not load comments.</p>";
      });
  }

  function closeCommentsModal() {
    var commentsModal = document.getElementById("comments-modal");
    if (commentsModal) commentsModal.classList.remove("open");
  }

  function updatePostCommentCount(postId, count) {
    var card = feedList && feedList.querySelector(".post-card[data-post-id=\"" + postId + "\"]");
    if (!card) return;
    var span = card.querySelector(".comment-count");
    if (span) span.textContent = count;
  }

  function updateAdminUI() {
    var wrap = document.getElementById("admin-logout-wrap");
    var loginBtn = document.getElementById("btn-admin-login");
    if (wrap) wrap.style.display = isAdmin ? "inline" : "none";
    if (loginBtn) loginBtn.style.display = isAdmin ? "none" : "inline-block";
  }

  if (feedList) {
    feedList.addEventListener("click", function (e) {
      var btn = e.target.closest(".action-btn") || e.target.closest(".btn-delete-post");
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      var postId = btn.getAttribute("data-post-id");
      if (!postId) return;
      if (action === "delete-post") {
        if (!isAdmin || !confirm("Delete this post? This cannot be undone.")) return;
        fetch("/api/public-posts/" + postId, { method: "DELETE", credentials: "include" })
          .then(function (res) {
            if (res.ok) loadPosts();
            else return res.json().then(function (d) { alert(d.error || "Failed to delete"); });
          })
          .catch(function () { alert("Failed to delete post."); });
        return;
      }
      if (action === "like") {
        fetch("/api/public-posts/" + postId + "/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_fingerprint: getFingerprint() })
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            btn.querySelector(".like-count").textContent = data.likes;
            if (data.liked) btn.classList.add("liked"); else btn.classList.remove("liked");
            showToast(data.liked ? "Liked" : "Unliked");
          })
          .catch(function () {});
      } else if (action === "comment") {
        openCommentsModal(postId);
      } else if (action === "share") {
        var url = window.location.origin + window.location.pathname + "#post-" + postId;
        if (typeof navigator.share === "function") {
          navigator.share({ title: "EstateView Post", url: url }).catch(function () {
            navigator.clipboard.writeText(url).then(function () { /* copied */ });
          });
        } else {
          navigator.clipboard.writeText(url).then(function () { /* copied */ });
        }
      }
    });
  }

  var commentsModalEl = document.getElementById("comments-modal");
  var commentsModalClose = document.getElementById("comments-modal-close");
  if (commentsModalClose) commentsModalClose.addEventListener("click", closeCommentsModal);
  if (commentsModalEl) {
    commentsModalEl.addEventListener("click", function (e) {
      if (e.target === commentsModalEl) closeCommentsModal();
    });
  }

  var addCommentForm = document.getElementById("add-comment-form");
  if (addCommentForm) {
    addCommentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var postId = document.getElementById("comment-post-id") && document.getElementById("comment-post-id").value;
      var content = document.getElementById("comment-content") && document.getElementById("comment-content").value;
      if (!postId || !content || !content.trim()) return;
      fetch("/api/public-posts/" + postId + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author_name: "", content: content.trim() })
      })
        .then(function (res) { return res.json(); })
        .then(function () {
          showToast("Comment added");
          var commentContentEl = document.getElementById("comment-content");
          if (commentContentEl) commentContentEl.value = "";
          fetch("/api/public-posts/" + postId + "/comments")
            .then(function (r) { return r.json(); })
            .then(function (data) {
              var comments = data.comments || [];
              var commentsList = document.getElementById("comments-list");
              renderCommentsList(commentsList, comments, postId);
              updatePostCommentCount(postId, comments.length);
            });
        })
        .catch(function () {});
    });
  }

  if (btnNewPost) btnNewPost.addEventListener("click", openModal);
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalCancel) modalCancel.addEventListener("click", closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", function (e) {
      if (e.target === modalOverlay) closeModal();
    });
  }

  var adminLoginModal = document.getElementById("admin-login-modal");
  var adminLoginForm = document.getElementById("admin-login-form");
  var adminLoginError = document.getElementById("admin-login-error");
  if (document.getElementById("btn-admin-login")) {
    document.getElementById("btn-admin-login").addEventListener("click", function () {
      if (adminLoginModal) adminLoginModal.classList.add("open");
      if (adminLoginError) { adminLoginError.style.display = "none"; adminLoginError.textContent = ""; }
      try {
        var saved = localStorage.getItem("estateview_admin_username");
        var userEl = document.getElementById("admin-username");
        var rememberEl = document.getElementById("admin-remember");
        if (saved && userEl) { userEl.value = saved; if (rememberEl) rememberEl.checked = true; }
        else if (rememberEl) rememberEl.checked = false;
      } catch (e) {}
    });
  }
  if (document.getElementById("admin-login-close")) {
    document.getElementById("admin-login-close").addEventListener("click", function () {
      if (adminLoginModal) adminLoginModal.classList.remove("open");
    });
  }
  if (document.getElementById("admin-login-cancel")) {
    document.getElementById("admin-login-cancel").addEventListener("click", function () {
      if (adminLoginModal) adminLoginModal.classList.remove("open");
    });
  }
  if (adminLoginModal) {
    adminLoginModal.addEventListener("click", function (e) {
      if (e.target === adminLoginModal) adminLoginModal.classList.remove("open");
    });
  }
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var username = ((document.getElementById("admin-username") && document.getElementById("admin-username").value) || "").trim();
      var password = ((document.getElementById("admin-password") && document.getElementById("admin-password").value) || "").trim();
      if (adminLoginError) { adminLoginError.style.display = "none"; adminLoginError.textContent = ""; }
      fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username, password: password })
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = {};
            try { data = text ? JSON.parse(text) : {}; } catch (e) {}
            return { ok: res.ok, data: data, status: res.status };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            isAdmin = true;
            updateAdminUI();
            if (adminLoginModal) adminLoginModal.classList.remove("open");
            var rememberEl = document.getElementById("admin-remember");
            try {
              if (rememberEl && rememberEl.checked && username) localStorage.setItem("estateview_admin_username", username);
              else localStorage.removeItem("estateview_admin_username");
            } catch (e) {}
            adminLoginForm.reset();
            loadPosts();
          } else {
            if (adminLoginError) {
              adminLoginError.textContent = result.data.error || "Login failed.";
              adminLoginError.style.display = "block";
            }
          }
        })
        .catch(function (err) {
          if (adminLoginError) {
            adminLoginError.textContent = "Cannot reach server. Start the backend (python app.py) and open this page from http://localhost:5000/";
            adminLoginError.style.display = "block";
          }
        });
    });
  }
  var pwdToggle = document.getElementById("admin-password-toggle");
  var pwdInput = document.getElementById("admin-password");
  if (pwdToggle && pwdInput) {
    pwdToggle.addEventListener("click", function () {
      var isPassword = pwdInput.type === "password";
      pwdInput.type = isPassword ? "text" : "password";
      var eye = pwdToggle.querySelector(".icon-eye");
      var eyeOff = pwdToggle.querySelector(".icon-eye-off");
      if (eye && eyeOff) {
        eye.style.display = isPassword ? "none" : "block";
        eyeOff.style.display = isPassword ? "block" : "none";
      }
      pwdToggle.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
      pwdToggle.setAttribute("title", isPassword ? "Hide password" : "Show password");
    });
  }
  if (document.getElementById("btn-admin-logout")) {
    document.getElementById("btn-admin-logout").addEventListener("click", function () {
      fetch("/api/admin/logout", { method: "POST", credentials: "include" })
        .then(function () {
          isAdmin = false;
          updateAdminUI();
          loadPosts();
        });
    });
  }

  fetch("/api/admin/me", { credentials: "include" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      isAdmin = data.admin === true;
      updateAdminUI();
    })
    .catch(function () {});

  var postFormCategories = document.getElementById("post-form-categories");
  if (postFormCategories) {
    postFormCategories.addEventListener("click", function (e) {
      var chip = e.target.closest(".post-form-chip");
      if (!chip) return;
      postFormCategories.querySelectorAll(".post-form-chip").forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      var categoryInput = document.getElementById("post-category");
      if (categoryInput) categoryInput.value = chip.getAttribute("data-category") || "General";
    });
  }

  if (newPostForm) {
    newPostForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = (document.getElementById("post-title") && document.getElementById("post-title").value) || "";
      var author = (document.getElementById("post-author") && document.getElementById("post-author").value) || "";
      var stateVal = (document.getElementById("post-state") && document.getElementById("post-state").value) || "";
      var districtVal = (document.getElementById("post-district") && document.getElementById("post-district").value) || "";
      var area = stateVal ? (districtVal ? stateVal + ", " + districtVal : stateVal) : "";
      var category = (document.getElementById("post-category") && document.getElementById("post-category").value) || "General";
      var content = (document.getElementById("post-content") && document.getElementById("post-content").value) || "";
      if (!title.trim()) return;
      fetch("/api/public-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: author.trim() || "Anonymous",
          area: area.trim() || "General",
          category: category,
          title: title.trim(),
          content: content.trim()
        })
      })
        .then(function (res) { return res.json(); })
        .then(function () {
          closeModal();
          showToast("Posted!");
          loadPosts();
        })
        .catch(function () {});
    });
  }

  loadAreaOptions().then(function () {
    fillStateSelect();
    fillDistrictSelect("");
    fillFilterStateDropdown();
  });
  loadPosts();
})();
