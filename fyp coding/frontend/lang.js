(function () {
  "use strict";

  var STORAGE_KEY = "estateview_lang";

  var LANG = {
    en: {
      nav: {
        map: "Map",
        filter: "Filter Property",
        estimation: "Get Estimation",
        community: "Public Community",
        feedback: "Private Feedback"
      },
      map: {
        sidebarTitle: "Smart Property Intelligence",
        viewBy: "View by",
        state: "State",
        district: "District",
        loading: "Loading…",
        fetching: "Fetching area data…",
        allStates: "All states",
        allDistricts: "All districts",
        clickMapForDetail: "click map for detail",
        viewAllAreas: "View all areas",
        currentAvgPrice: "Current avg price",
        predicted1Month: "Predicted 1 month",
        floodRisk: "Flood risk",
        priceTrend: "Price trend",
        stateLabel: "State",
        districtLabel: "District",
        noPriceData: "No price data for this area.",
        noHistoryData: "No history data",
        chartUnavailable: "Chart unavailable",
        couldNotLoadData: "Could not load data",
        couldNotLoadHint: "Start the backend: python backend/app.py then refresh this page.",
        stateNames: { Johor: "Johor", Kedah: "Kedah", Kelantan: "Kelantan", "Kuala Lumpur": "Kuala Lumpur", Labuan: "Labuan", Melaka: "Melaka", "Negeri Sembilan": "Negeri Sembilan", Pahang: "Pahang", Penang: "Penang", Perak: "Perak", Perlis: "Perlis", Putrajaya: "Putrajaya", Sabah: "Sabah", Sarawak: "Sarawak", Selangor: "Selangor", Terengganu: "Terengganu" }
      },
      filter: {
        findProperties: "Find Properties",
        filterByPriceType: "Filter by price & type",
        priceRange: "Price Range",
        propertyType: "Property Type",
        showMore: "Show More",
        showLess: "Show Less",
        applyFilters: "Apply Filters"
      },
      estimator: {
        tagline: "Intelligent Real Estate Price Prediction System",
        propertyDetails: "Property Details",
        formDesc: "Select state, district (optional) and property type.",
        state: "State",
        selectState: "-- Select state --",
        district: "District",
        optional: "(optional)",
        any: "-- Any --",
        propertyType: "Property Type",
        selectType: "-- Select type --",
        showResult: "Show Result",
        clear: "Clear",
        estimatedValue: "Estimated Value",
        loading: "Loading…",
        predictedPrice: "Predicted price (1 month)",
        predictedHelp: "Average predicted price for the next month in this area and property type.",
        avgPrice: "Average price (recent)",
        trend: "Trend (1 month)",
        copyAllDetails: "Copy all details",
        copied: "Copied!",
        copyFailed: "Copy failed",
        floorAreaRange: "Floor area range (sq ft)",
        numberOfRoomsRange: "Number of rooms range",
        floodRisk: "Flood risk",
        pleaseSelectStateAndType: "Please select state and property type.",
        requestFailed: "Request failed.",
        dataPending: "Data pending"
      },
      feedback: {
        tagline: "Advanced predictive model focusing on real estate valuation",
        provideFeedback: "Provide Your Feedback",
        formDesc: "Share your private rating and detailed comments about this app. Feedback is sent to our admin account for internal use only.",
        rateApp: "How would you rate this app?",
        noRating: "No rating",
        starsHint: "Select a rating from 1 (poor) to 5 (excellent)",
        quickSelect: "Quick select",
        quickSelectHint: "Tick what applies — You can choose more than one.",
        userFriendly: "User friendly",
        accurateResult: "Accurate result",
        easyToUse: "Easy to use",
        goodDesign: "Good design",
        fastResponse: "Fast response",
        clearInfo: "Clear information",
        helpfulFeatures: "Helpful features",
        detailedComment: "Your Detailed Comment",
        commentPlaceholder: "Share your detailed feedback about this website. What did you like/dislike? What could be improved?",
        minChars: "Minimum 10 characters required",
        charsCount: "0 characters",
        character: " character",
        characters: " characters",
        privateFeedback: "Private Feedback",
        privateDesc: "Your rating and comment are private and will not be shared publicly. They are sent directly to our admin account for internal use only.",
        cancel: "Cancel",
        submitFeedback: "📤 Submit Feedback",
        whyMatters: "Why Your Feedback Matters",
        whyMattersDesc: "Your private feedback helps developers improve their apps and provides valuable insights for other users considering these tools.",
        yourPrivacy: "Your Privacy",
        yourPrivacyDesc: "All feedback is kept private and confidential. Your identity and comments are never shared without your consent."
      },
      comments: {
        communityFeed: "Community Feed",
        tagline: "Connect with your neighbors",
        newPost: "+ New Post",
        searchPlaceholder: "Search posts...",
        allStates: "All states",
        all: "All",
        general: "General",
        maintenance: "Maintenance",
        events: "Events",
        safety: "Safety",
        suggestions: "Suggestions",
        loadMore: "Load more",
        loadingPosts: "Loading posts…",
        noPostsYet: "No posts yet. Be the first to share!",
        noMatchFilters: "No posts match your filters. Try changing your search or filters.",
        clearFilters: "Clear filters",
        comments: "Comments",
        writeComment: "Write a comment...",
        postComment: "Post Comment",
        adminLoginHint: "Enter your admin username and password to manage posts and comments.",
        username: "Username",
        password: "Password",
        rememberMe: "Remember me",
        login: "LOGIN",
        createPost: "Create New Post",
        title: "Title",
        whatsOnMind: "What's on your mind?",
        yourName: "Your name",
        yourNameOptional: "Your name (optional)",
        state: "State",
        selectState: "— Select state —",
        district: "District",
        districtOptional: "— Any —",
        category: "Category",
        content: "Content",
        shareThoughts: "Share your thoughts, experiences, or feedback...",
        post: "Post",
        cancel: "Cancel",
        adminLogin: "Admin Login"
      }
    },
    ms: {
      nav: {
        map: "Peta",
        filter: "Tapis Harta",
        estimation: "Dapatkan Anggaran",
        community: "Komuniti Awam",
        feedback: "Maklum Balas Peribadi"
      },
      map: {
        sidebarTitle: "Kecerdasan Harta Pintar",
        viewBy: "Lihat mengikut",
        state: "Negeri",
        district: "Daerah",
        loading: "Memuatkan…",
        fetching: "Mengambil data kawasan…",
        allStates: "Semua negeri",
        allDistricts: "Semua daerah",
        clickMapForDetail: "klik peta untuk butiran",
        viewAllAreas: "Lihat semua kawasan",
        currentAvgPrice: "Purata harga semasa",
        predicted1Month: "Diramal 1 bulan",
        floodRisk: "Risiko banjir",
        priceTrend: "Trend harga",
        stateLabel: "Negeri",
        districtLabel: "Daerah",
        noPriceData: "Tiada data harga untuk kawasan ini.",
        noHistoryData: "Tiada data sejarah",
        chartUnavailable: "Carta tidak tersedia",
        couldNotLoadData: "Tidak dapat memuatkan data",
        couldNotLoadHint: "Mulakan backend: python backend/app.py kemudian muat semula halaman ini.",
        stateNames: { Johor: "Johor", Kedah: "Kedah", Kelantan: "Kelantan", "Kuala Lumpur": "Kuala Lumpur", Labuan: "Labuan", Melaka: "Melaka", "Negeri Sembilan": "Negeri Sembilan", Pahang: "Pahang", Penang: "Pulau Pinang", Perak: "Perak", Perlis: "Perlis", Putrajaya: "Putrajaya", Sabah: "Sabah", Sarawak: "Sarawak", Selangor: "Selangor", Terengganu: "Terengganu" }
      },
      filter: {
        findProperties: "Cari Harta",
        filterByPriceType: "Tapis mengikut harga & jenis",
        priceRange: "Julat Harga",
        propertyType: "Jenis Harta",
        showMore: "Tunjukkan Lagi",
        showLess: "Tunjukkan Kurang",
        applyFilters: "Guna Penapis"
      },
      estimator: {
        tagline: "Sistem Ramalan Harga Harta Pintar",
        propertyDetails: "Butiran Harta",
        formDesc: "Pilih negeri, daerah (pilihan) dan jenis harta.",
        state: "Negeri",
        selectState: "-- Pilih negeri --",
        district: "Daerah",
        optional: "(pilihan)",
        any: "-- Apa-apa --",
        propertyType: "Jenis Harta",
        selectType: "-- Pilih jenis --",
        showResult: "Tunjukkan Keputusan",
        clear: "Kosongkan",
        estimatedValue: "Anggaran Nilai",
        loading: "Memuatkan…",
        predictedPrice: "Harga diramal (1 bulan)",
        predictedHelp: "Purata harga diramal untuk bulan berikutnya di kawasan dan jenis harta ini.",
        avgPrice: "Purata harga (terkini)",
        trend: "Trend (1 bulan)",
        copyAllDetails: "Salin semua butiran",
        copied: "Disalin!",
        copyFailed: "Gagal menyalin",
        floorAreaRange: "Julat luas lantai (kaki persegi)",
        numberOfRoomsRange: "Julat bilangan bilik",
        floodRisk: "Risiko banjir",
        pleaseSelectStateAndType: "Sila pilih negeri dan jenis harta.",
        requestFailed: "Permintaan gagal.",
        dataPending: "Data belum tersedia"
      },
      feedback: {
        tagline: "Model ramalan tumpuan penilaian harta tanah",
        provideFeedback: "Berikan Maklum Balas Anda",
        formDesc: "Kongsi penilaian peribadi dan komen terperinci tentang aplikasi ini. Maklum balas dihantar ke akaun admin untuk kegunaan dalaman sahaja.",
        rateApp: "Bagaimana anda menilai aplikasi ini?",
        noRating: "Tiada penilaian",
        oneStar: "1 bintang",
        stars: " bintang",
        sending: "Menghantar…",
        charsCount: "0 aksara",
        character: " aksara",
        characters: " aksara",
        starsHint: "Pilih penilaian dari 1 (lemah) hingga 5 (cemerlang)",
        quickSelect: "Pilihan pantas",
        quickSelectHint: "Tandakan yang berkenaan — Anda boleh pilih lebih daripada satu.",
        userFriendly: "Mesra pengguna",
        accurateResult: "Keputusan tepat",
        easyToUse: "Mudah digunakan",
        goodDesign: "Reka bentuk baik",
        fastResponse: "Tindak balas pantas",
        clearInfo: "Maklumat jelas",
        helpfulFeatures: "Ciri berguna",
        detailedComment: "Komen Terperinci Anda",
        commentPlaceholder: "Kongsi maklum balas terperinci tentang laman web ini. Apa yang anda suka/tidak suka? Apa yang boleh diperbaiki?",
        minChars: "Minimum 10 aksara diperlukan",
        privateFeedback: "Maklum Balas Peribadi",
        privateDesc: "Penilaian dan komen anda adalah peribadi dan tidak akan dikongsi secara awam. Ia dihantar terus ke akaun admin untuk kegunaan dalaman sahaja.",
        cancel: "Batal",
        submitFeedback: "📤 Hantar Maklum Balas",
        whyMatters: "Mengapa Maklum Balas Anda Penting",
        whyMattersDesc: "Maklum balas peribadi anda membantu pemaju menambah baik aplikasi dan memberi pandangan berharga untuk pengguna lain.",
        yourPrivacy: "Privasi Anda",
        yourPrivacyDesc: "Semua maklum balas dirahsiakan. Identiti dan komen anda tidak akan dikongsi tanpa persetujuan anda."
      },
      comments: {
        communityFeed: "Suapan Komuniti",
        tagline: "Berhubung dengan jiran anda",
        newPost: "+ Catatan Baru",
        searchPlaceholder: "Cari catatan...",
        allStates: "Semua negeri",
        all: "Semua",
        general: "Umum",
        maintenance: "Penyelenggaraan",
        events: "Acara",
        safety: "Keselamatan",
        suggestions: "Cadangan",
        loadMore: "Muat lagi",
        loadingPosts: "Memuatkan catatan…",
        noPostsYet: "Tiada catatan lagi. Jadilah yang pertama berkongsi!",
        noMatchFilters: "Tiada catatan sepadan dengan penapis. Cuba ubah carian atau penapis.",
        clearFilters: "Kosongkan penapis",
        comments: "Komen",
        writeComment: "Tulis komen...",
        postComment: "Hantar Komen",
        adminLoginHint: "Masukkan nama pengguna dan kata laluan admin untuk mengurus catatan dan komen.",
        username: "Nama pengguna",
        password: "Kata laluan",
        rememberMe: "Ingat saya",
        login: "LOG MASUK",
        createPost: "Cipta Catatan Baru",
        title: "Tajuk",
        whatsOnMind: "Apa yang anda fikirkan?",
        yourName: "Nama anda",
        yourNameOptional: "Nama anda (pilihan)",
        state: "Negeri",
        selectState: "— Pilih negeri —",
        district: "Daerah",
        districtOptional: "— Apa-apa —",
        category: "Kategori",
        content: "Kandungan",
        shareThoughts: "Kongsi pemikiran, pengalaman atau maklum balas anda...",
        post: "Hantar",
        cancel: "Batal",
        adminLogin: "Log Masuk Admin"
      }
    },
    zh: {
      nav: {
        map: "地圖",
        filter: "篩選房產",
        estimation: "獲取估價",
        community: "公共社區",
        feedback: "私密反饋"
      },
      map: {
        sidebarTitle: "智能房產資訊",
        viewBy: "查看方式",
        state: "州屬",
        district: "地區",
        loading: "載入中…",
        fetching: "正在取得地區資料…",
        allStates: "全部州屬",
        allDistricts: "全部地區",
        clickMapForDetail: "點擊地圖查看詳情",
        viewAllAreas: "查看全部地區",
        currentAvgPrice: "目前均價",
        predicted1Month: "預測（1 個月）",
        floodRisk: "淹水風險",
        priceTrend: "價格趨勢",
        stateLabel: "州屬",
        districtLabel: "地區",
        noPriceData: "此地區尚無價格資料。",
        noHistoryData: "無歷史資料",
        chartUnavailable: "圖表無法顯示",
        couldNotLoadData: "無法載入資料",
        couldNotLoadHint: "請先啟動後端：python backend/app.py 然後重新整理此頁。",
        stateNames: { Johor: "柔佛", Kedah: "吉打", Kelantan: "吉蘭丹", "Kuala Lumpur": "吉隆坡", Labuan: "納閩", Melaka: "馬六甲", "Negeri Sembilan": "森美蘭", Pahang: "彭亨", Penang: "檳城", Perak: "霹靂", Perlis: "玻璃市", Putrajaya: "布城", Sabah: "沙巴", Sarawak: "砂拉越", Selangor: "雪蘭莪", Terengganu: "登嘉樓" }
      },
      filter: {
        findProperties: "尋找房產",
        filterByPriceType: "按價格與類型篩選",
        priceRange: "價格範圍",
        propertyType: "房產類型",
        showMore: "顯示更多",
        showLess: "顯示較少",
        applyFilters: "套用篩選"
      },
      estimator: {
        tagline: "智能房產價格預測系統",
        propertyDetails: "房產詳情",
        formDesc: "選擇州屬、地區（可選）及房產類型。",
        state: "州屬",
        selectState: "—— 選擇州屬 ——",
        district: "地區",
        optional: "（可選）",
        any: "—— 不限 ——",
        propertyType: "房產類型",
        selectType: "—— 選擇類型 ——",
        showResult: "顯示結果",
        clear: "清除",
        estimatedValue: "估價",
        loading: "載入中…",
        predictedPrice: "預測價格（1 個月）",
        predictedHelp: "此地區與房產類型下個月的平均預測價格。",
        avgPrice: "近期均價",
        trend: "趨勢（1 個月）",
        copyAllDetails: "複製全部詳情",
        copied: "已複製！",
        copyFailed: "複製失敗",
        floorAreaRange: "樓面面積範圍（平方呎）",
        numberOfRoomsRange: "房間數量範圍",
        floodRisk: "淹水風險",
        pleaseSelectStateAndType: "請選擇州屬與房產類型。",
        requestFailed: "請求失敗。",
        dataPending: "資料待定"
      },
      feedback: {
        tagline: "專注於房產估值的進階預測模型",
        provideFeedback: "提交反饋",
        formDesc: "分享您對本應用程式的私密評分與詳細意見，反饋僅會送交管理員供內部使用。",
        rateApp: "您如何評價本應用程式？",
        noRating: "尚未評分",
        oneStar: "1 顆星",
        stars: " 顆星",
        sending: "送出中…",
        charsCount: "0 字元",
        character: " 字元",
        characters: " 字元",
        starsHint: "請選擇 1（差）至 5（優）的評分",
        quickSelect: "快速選擇",
        quickSelectHint: "勾選適用項目 — 可多選。",
        userFriendly: "介面友善",
        accurateResult: "結果準確",
        easyToUse: "易於使用",
        goodDesign: "設計良好",
        fastResponse: "回應迅速",
        clearInfo: "資訊清楚",
        helpfulFeatures: "功能實用",
        detailedComment: "詳細意見",
        commentPlaceholder: "分享您對本網站的詳細反饋：喜歡/不喜歡什麼？可如何改進？",
        minChars: "至少需 10 個字元",
        charsCount: "0 字元",
        privateFeedback: "私密反饋",
        privateDesc: "您的評分與意見為私密，不會公開。僅會送交管理員供內部使用。",
        cancel: "取消",
        submitFeedback: "📤 提交反饋",
        whyMatters: "您的反饋為何重要",
        whyMattersDesc: "您的私密反饋可協助開發者改進應用程式，並為其他使用者提供參考。",
        yourPrivacy: "您的隱私",
        yourPrivacyDesc: "所有反饋均保密。未經同意絕不分享您的身分或意見。"
      },
      comments: {
        communityFeed: "社區動態",
        tagline: "與鄰里保持連結",
        newPost: "+ 發文",
        searchPlaceholder: "搜尋貼文...",
        allStates: "全部州屬",
        all: "全部",
        general: "一般",
        maintenance: "維修",
        events: "活動",
        safety: "安全",
        suggestions: "建議",
        loadMore: "載入更多",
        loadingPosts: "載入貼文中…",
        noPostsYet: "尚無貼文。來發第一篇吧！",
        noMatchFilters: "沒有符合條件的貼文，請調整搜尋或篩選。",
        clearFilters: "清除篩選",
        comments: "留言",
        writeComment: "寫下留言...",
        postComment: "發佈留言",
        adminLoginHint: "輸入管理員帳號與密碼以管理貼文與留言。",
        username: "使用者名稱",
        password: "密碼",
        rememberMe: "記住我",
        login: "登入",
        createPost: "建立貼文",
        title: "標題",
        whatsOnMind: "在想什麼？",
        yourName: "您的名稱",
        yourNameOptional: "您的名稱（選填）",
        state: "州屬",
        selectState: "— 選擇州屬 —",
        district: "地區",
        districtOptional: "— 不限 —",
        category: "分類",
        content: "內容",
        shareThoughts: "分享想法、經驗或反饋...",
        post: "發佈",
        cancel: "取消",
        adminLogin: "管理員登入"
      }
    }
  };

  function getLang() {
    try {
      var code = localStorage.getItem(STORAGE_KEY);
      return (code && LANG[code]) ? code : "en";
    } catch (e) {
      return "en";
    }
  }

  function setLang(code) {
    if (!LANG[code]) return;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {}
    applyLang();
    updateLangDropdown();
    try {
      document.dispatchEvent(new CustomEvent("languagechange"));
    } catch (e) {}
  }

  function getTranslation(lang, key) {
    var parts = key.split(".");
    var obj = LANG[lang];
    for (var i = 0; i < parts.length && obj; i++) obj = obj[parts[i]];
    return obj;
  }

  function applyLang() {
    var lang = getLang();
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = getTranslation(lang, key);
      if (val != null) el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      var val = getTranslation(lang, key);
      if (val != null) el.placeholder = val;
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      var val = getTranslation(lang, key);
      if (val != null) el.title = val;
    });
  }

  function updateLangDropdown() {
    var code = getLang();
    document.querySelectorAll(".lang-opt").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-lang") === code);
    });
  }

  function initLangSwitcher() {
    var btn = document.getElementById("lang-btn");
    var dropdown = document.getElementById("lang-dropdown");
    if (!btn || !dropdown) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });

    dropdown.querySelectorAll(".lang-opt").forEach(function (el) {
      el.addEventListener("click", function () {
        setLang(el.getAttribute("data-lang"));
        dropdown.classList.remove("open");
      });
    });

    document.addEventListener("click", function () {
      dropdown.classList.remove("open");
    });

    updateLangDropdown();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyLang();
      initLangSwitcher();
    });
  } else {
    applyLang();
    initLangSwitcher();
  }

  window.getLang = getLang;
  window.getTranslation = getTranslation;
})();
