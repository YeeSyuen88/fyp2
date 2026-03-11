(function () {
  function t(key) {
    if (typeof window.getTranslation === "function" && typeof window.getLang === "function") {
      var val = window.getTranslation(window.getLang(), key);
      return val != null ? val : key;
    }
    return key;
  }

  const API_BASE = "/api";
  const GEOJSON_URL =
    "https://gist.githubusercontent.com/angch/4bbbaa72ba0a9c95bfda951ca82b748f/raw/malaysia.districts.geojson";
  const MALAYSIA_BOUNDS = L.latLngBounds(L.latLng(0.5, 99), L.latLng(7.5, 120));

  const stateNameMap = {
    "Pulau Pinang": "Penang",
    "W.P. Kuala Lumpur": "Kuala Lumpur",
    "W.P. Labuan": "Labuan",
    "W.P. Putrajaya": "Putrajaya",
    Trengganu: "Terengganu",
  };
  const districtNameMap = {
    Keluang: "Kluang",
    "Kota Bahru": "Kota Bharu",
    "Kota Baru": "Kota Bharu",
    Tanjong: "Tanjung",
    Telok: "Teluk",
    "Pekan Nenas": "Pekan Nanas",
    "Johor Baharu": "Johor Bahru",
    Kulaijaya: "Kulai",
    Ledang: "Tangkak",
    "Kota Setar": "Alor Setar",
    "Pasir Putih": "Pasir Puteh",
    "Kuala Krai": "Kuala Kerai",
    Lipis: "Kuala Lipis",
    "Larut and Matang": "Taiping",
    "Hilir Perak": "Teluk Intan",
    "Hulu Perak": "Gerik",
    "Perak Tengah": "Seri Iskandar",
    Kinta: "Ipoh",
    Kerian: "Parit Buntar",
    "Batang Padang": "Tapah",
    "Barat Daya": "Bayan Lepas",
    "Timur Laut": "George Town",
    "Seberang Perai Selatan": "Nibong Tebal",
    "Seberang Perai Tengah": "Bukit Mertajam",
    "Seberang Perai Utara": "Butterworth",
    Meradong: "Maradong",
  };
  function stateKey(name) {
    return stateNameMap[name] || name;
  }
  function districtKeyForData(geoName) {
    return districtNameMap[geoName] || geoName;
  }

  function formatPrice(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1e6) return "RM " + (n / 1e6).toFixed(2) + " M";
    if (n >= 1e3) return "RM " + (n / 1e3).toFixed(0) + " K";
    return "RM " + Math.round(n);
  }

  const map = L.map("map", { zoomControl: false }).setView([4.2, 109], 6);
  L.control.zoom({ position: "topright" }).addTo(map);
  map.fitBounds(MALAYSIA_BOUNDS, { padding: [24, 24], maxZoom: 8 });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  let centroidMap = {};
  const markersLayer = L.layerGroup().addTo(map);

  function buildCentroidMap(geojson) {
    centroidMap = {};
    geojson.features.forEach(function (feature) {
      const stateName = feature.properties.NAME_1 || "";
      const districtName = feature.properties.NAME_2 || "";
      const key = stateKey(stateName) + "|" + districtKeyForData(districtName);
      try {
        const layer = L.geoJSON(feature);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          centroidMap[key] = bounds.getCenter();
        }
      } catch (e) {}
    });
  }

  function applyFilters() {
    const minPrice = parseFloat(document.getElementById("min-price").value) || 0;
    const maxPrice = parseFloat(document.getElementById("max-price").value) || 50000000;
    const checkboxes = document.querySelectorAll("input[name=property_type]:checked");
    const propertyTypes = Array.from(checkboxes).map(function (el) { return el.value; });
    const typesParam = propertyTypes.length ? propertyTypes.join(",") : "";

    const btn = document.getElementById("btn-apply");
    btn.disabled = true;
    btn.textContent = t("map.loading");

    const url =
      API_BASE + "/filter-results?min_price=" + minPrice +
      "&max_price=" + maxPrice +
      (typesParam ? "&property_type=" + encodeURIComponent(typesParam) : "");

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("Filter failed");
        return r.json();
      })
      .then(function (data) {
        markersLayer.clearLayers();
        const results = data.results || [];
        results.forEach(function (r) {
          const key = r.state + "|" + r.district;
          const latlng = centroidMap[key];
          if (!latlng) return;
          const priceStr = formatPrice(r.avg_price);
          const count = r.count || 0;
          const title = count > 1 ? priceStr + " (avg of " + count + ")" : priceStr;
          const icon = L.divIcon({
            html: '<div class="marker-pin" title="' + escapeHtml(title) + '"><span class="pin-icon">📍</span><span class="pin-price">' + escapeHtml(priceStr) + "</span></div>",
            className: "marker-pin-wrap",
            iconSize: [48, 56],
            iconAnchor: [24, 56],
          });
          L.marker(latlng, { icon: icon }).addTo(markersLayer);
        });
      })
      .catch(function () {
        markersLayer.clearLayers();
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = t("filter.applyFilters");
      });
  }

  document.getElementById("btn-apply").addEventListener("click", applyFilters);

  var SLIDER_MIN = 0;
  var SLIDER_MAX = 5000000;
  var SLIDER_STEP = 50000;
  var MIN_GAP = SLIDER_STEP;
  var rangeMinEl = document.getElementById("range-min");
  var rangeMaxEl = document.getElementById("range-max");
  var minPriceEl = document.getElementById("min-price");
  var maxPriceEl = document.getElementById("max-price");
  var sliderFillEl = document.getElementById("slider-fill");
  var histogramContainer = document.getElementById("price-histogram");

  function clampNoOverlap() {
    var minVal = parseInt(rangeMinEl.value, 10) || SLIDER_MIN;
    var maxVal = parseInt(rangeMaxEl.value, 10) || SLIDER_MAX;
    var draggingMax = document.activeElement === rangeMaxEl;

    rangeMaxEl.setAttribute("min", minVal + MIN_GAP);
    rangeMinEl.setAttribute("max", maxVal - MIN_GAP);

    if (minVal > maxVal - MIN_GAP) {
      if (draggingMax) {
        maxVal = Math.min(SLIDER_MAX, minVal + MIN_GAP);
        maxVal = Math.round(maxVal / SLIDER_STEP) * SLIDER_STEP;
        maxVal = Math.min(SLIDER_MAX, Math.max(minVal + MIN_GAP, maxVal));
        rangeMaxEl.value = maxVal;
      } else {
        minVal = Math.max(SLIDER_MIN, maxVal - MIN_GAP);
        minVal = Math.round(minVal / SLIDER_STEP) * SLIDER_STEP;
        minVal = Math.max(SLIDER_MIN, Math.min(maxVal - MIN_GAP, minVal));
        rangeMinEl.value = minVal;
      }
    } else if (maxVal < minVal + MIN_GAP) {
      if (draggingMax) {
        maxVal = Math.min(SLIDER_MAX, minVal + MIN_GAP);
        maxVal = Math.round(maxVal / SLIDER_STEP) * SLIDER_STEP;
        maxVal = Math.min(SLIDER_MAX, Math.max(minVal + MIN_GAP, maxVal));
        rangeMaxEl.value = maxVal;
      } else {
        minVal = Math.max(SLIDER_MIN, maxVal - MIN_GAP);
        minVal = Math.round(minVal / SLIDER_STEP) * SLIDER_STEP;
        minVal = Math.max(SLIDER_MIN, Math.min(maxVal - MIN_GAP, minVal));
        rangeMinEl.value = minVal;
      }
    }

    minVal = parseInt(rangeMinEl.value, 10) || SLIDER_MIN;
    maxVal = parseInt(rangeMaxEl.value, 10) || SLIDER_MAX;
    return { minVal: minVal, maxVal: maxVal };
  }

  function updateSliderFill() {
    var o = clampNoOverlap();
    var minVal = o.minVal;
    var maxVal = o.maxVal;
    minPriceEl.value = minVal;
    maxPriceEl.value = maxVal;
    var pctMin = (minVal - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN) * 100;
    var pctMax = (maxVal - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN) * 100;
    sliderFillEl.style.left = pctMin + "%";
    sliderFillEl.style.width = (pctMax - pctMin) + "%";
    updateHistogramRange(minVal, maxVal);
  }

  function updateHistogramRange(minVal, maxVal) {
    if (!histogramContainer) return;
    var bars = histogramContainer.querySelectorAll(".histogram-bar[data-min][data-max]");
    bars.forEach(function (bar) {
      var bMin = parseFloat(bar.getAttribute("data-min"), 10);
      var bMax = parseFloat(bar.getAttribute("data-max"), 10);
      var inRange = (bMin < maxVal && bMax > minVal);
      bar.classList.toggle("in-range", inRange);
    });
  }

  function syncInputsFromSliders() {
    minPriceEl.value = rangeMinEl.value;
    maxPriceEl.value = rangeMaxEl.value;
    updateSliderFill();
  }

  function syncSlidersFromInputs() {
    var minVal = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, parseFloat(minPriceEl.value) || 0));
    var maxVal = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, parseFloat(maxPriceEl.value) || SLIDER_MAX));
    if (minVal > maxVal) minVal = maxVal - MIN_GAP;
    if (maxVal - minVal < MIN_GAP) maxVal = minVal + MIN_GAP;
    minVal = Math.round(minVal / SLIDER_STEP) * SLIDER_STEP;
    maxVal = Math.round(maxVal / SLIDER_STEP) * SLIDER_STEP;
    minVal = Math.max(SLIDER_MIN, Math.min(maxVal - MIN_GAP, minVal));
    maxVal = Math.min(SLIDER_MAX, Math.max(minVal + MIN_GAP, maxVal));
    minPriceEl.value = minVal;
    maxPriceEl.value = maxVal;
    rangeMinEl.value = minVal;
    rangeMaxEl.value = maxVal;
    updateSliderFill();
  }

  function buildHistogram() {
    var typesParam = "";
    var checkboxes = document.querySelectorAll("input[name=property_type]:checked");
    if (checkboxes.length) typesParam = Array.from(checkboxes).map(function (el) { return el.value; }).join(",");
    var url = API_BASE + "/price-histogram?price_min=" + SLIDER_MIN + "&price_max=" + SLIDER_MAX + "&num_buckets=50" +
      (typesParam ? "&property_type=" + encodeURIComponent(typesParam) : "");
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : { buckets: [] }; })
      .then(function (data) {
        var buckets = data.buckets || [];
        var maxCount = 0;
        buckets.forEach(function (b) { if (b.count > maxCount) maxCount = b.count; });
        histogramContainer.innerHTML = "";
        buckets.forEach(function (b) {
          var bar = document.createElement("div");
          bar.className = "histogram-bar" + (b.count > 0 ? " has-count" : "");
          bar.setAttribute("data-min", b.min);
          bar.setAttribute("data-max", b.max);
          var pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
          bar.style.height = (b.count > 0 ? Math.max(4, pct) : 0) + "%";
          bar.title = "RM " + (b.min / 1000).toFixed(0) + "K – " + (b.max / 1000).toFixed(0) + "K: " + b.count + " properties";
          histogramContainer.appendChild(bar);
        });
        var minVal = parseInt(rangeMinEl.value, 10);
        var maxVal = parseInt(rangeMaxEl.value, 10);
        updateHistogramRange(minVal, maxVal);
      })
      .catch(function () { histogramContainer.innerHTML = ""; });
  }

  if (rangeMinEl && rangeMaxEl) {
    rangeMinEl.addEventListener("input", syncInputsFromSliders);
    rangeMaxEl.addEventListener("input", syncInputsFromSliders);
    minPriceEl.addEventListener("change", syncSlidersFromInputs);
    maxPriceEl.addEventListener("input", syncSlidersFromInputs);
    updateSliderFill();
  }

  if (histogramContainer) {
    buildHistogram();
    document.getElementById("filter-panel").addEventListener("change", function (e) {
      if (e.target && e.target.getAttribute("name") === "property_type") buildHistogram();
    });
  }

  const INITIAL_PROPERTY_TYPES = 4;

  function renderPropertyTypeLabel(pt) {
    const label = document.createElement("label");
    const id = "pt-" + pt.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    label.innerHTML = '<input type="checkbox" name="property_type" value="' + escapeHtml(pt) + '" id="' + id + '"><span>' + escapeHtml(pt) + "</span>";
    return label;
  }

  fetch(API_BASE + "/estimator/options")
    .then(function (r) {
      if (!r.ok) return { property_types: [] };
      return r.json();
    })
    .then(function (opts) {
      const types = opts.property_types || [];
      const container = document.getElementById("property-types");
      const moreContainer = document.getElementById("property-types-more");
      const btnShowMore = document.getElementById("btn-show-more");
      const first = types.slice(0, INITIAL_PROPERTY_TYPES);
      const rest = types.slice(INITIAL_PROPERTY_TYPES);
      first.forEach(function (pt) {
        container.appendChild(renderPropertyTypeLabel(pt));
      });
      if (rest.length > 0) {
        btnShowMore.style.display = "block";
        btnShowMore.textContent = t("filter.showMore") + " (" + rest.length + ")";
        rest.forEach(function (pt) {
          moreContainer.appendChild(renderPropertyTypeLabel(pt));
        });
        btnShowMore.addEventListener("click", function () {
          const isHidden = moreContainer.classList.contains("hidden");
          if (isHidden) {
            moreContainer.classList.remove("hidden");
            btnShowMore.textContent = t("filter.showLess");
          } else {
            moreContainer.classList.add("hidden");
            btnShowMore.textContent = t("filter.showMore") + " (" + rest.length + ")";
          }
        });
      }
    });

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  fetch(GEOJSON_URL)
    .then(function (r) { return r.json(); })
    .then(function (geojson) {
      buildCentroidMap(geojson);
    });
})();
