(function () {
  function t(key) {
    if (typeof window.getTranslation === "function" && typeof window.getLang === "function") {
      var val = window.getTranslation(window.getLang(), key);
      return val != null ? val : key;
    }
    return key;
  }
  function stateDisplayName(key) {
    var sn = typeof window.getTranslation === "function" && window.getLang ? window.getTranslation(window.getLang(), "map.stateNames") : null;
    if (sn && typeof sn === "object" && sn[key]) return sn[key];
    return key;
  }

  const API_BASE = "/api";
  const DISTRICTS_GEOJSON =
    "https://gist.githubusercontent.com/angch/4bbbaa72ba0a9c95bfda951ca82b748f/raw/malaysia.districts.geojson";

  const map = L.map("map", { zoomControl: false }).setView([4.2, 109], 6);
  L.control.zoom({ position: "topleft" }).addTo(map);

  // Bounds to show whole Malaysia (Peninsular + Sabah & Sarawak)
  const MALAYSIA_BOUNDS = L.latLngBounds(L.latLng(0.5, 99), L.latLng(7.5, 120));
  map.fitBounds(MALAYSIA_BOUNDS, { padding: [32, 32], maxZoom: 8 });

  // Light basemap — easier to see (previous design)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const panelPlaceholder = document.getElementById("panel-placeholder");
  const allAreasListEl = document.getElementById("all-areas-list");
  const areaDataEl = document.getElementById("area-data");
  const layerSelect = document.getElementById("layer");

  const stateNameMap = {
    "Pulau Pinang": "Penang",
    "W.P. Kuala Lumpur": "Kuala Lumpur",
    "W.P. Labuan": "Labuan",
    "W.P. Putrajaya": "Putrajaya",
    Trengganu: "Terengganu",
  };
  function stateKey(name) {
    return stateNameMap[name] || name;
  }

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
  function districtKeyForData(geoName) {
    return districtNameMap[geoName] || geoName;
  }

  let predictions = { state: {}, district: {} };
  let stateLayer = null;
  let districtLayer = null;
  let currentView = "state";
  let stateNames = [];
  let selectedStateLayers = [];
  let selectedDistrictLayer = null;
  let lastAreaData = null;

  const DEFAULT_VIEW = { bounds: MALAYSIA_BOUNDS };
  const SELECTED_STYLE = {
    weight: 2.5,
    color: "#2563eb",
    fillColor: "#93c5fd",
    fillOpacity: 0.55,
  };

  function formatPrice(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1e6) return "RM " + (n / 1e6).toFixed(2) + " M";
    if (n >= 1e3) return "RM " + (n / 1e3).toFixed(0) + " K";
    return "RM " + Math.round(n);
  }

  let priceChartInstance = null;

  function showAreaData(title, subTitle, data, priceHistoryParams, areaKey, isState) {
    lastAreaData = { title: title, subTitle: subTitle, data: data, priceHistoryParams: priceHistoryParams, key: areaKey != null ? areaKey : (lastAreaData && lastAreaData.key), isState: isState === true };
    panelPlaceholder.style.display = "none";
    allAreasListEl.style.display = "none";
    areaDataEl.style.display = "flex";
    areaDataEl.classList.add("compact");

    const current = data.current_price;
    const predicted = data.predicted_price_1month;
    const flood = data.flood_risk || t("estimator.dataPending");

    areaDataEl.innerHTML =
      '<div class="area-data-header">' +
        "<div><h2>" + escapeHtml(title) + "</h2><span class=\"sub\">" + escapeHtml(subTitle) + "</span></div>" +
        '<a href="#" class="back-to-all">' + t("map.viewAllAreas") + "</a>" +
      "</div>" +
      '<div class="stat-card">' +
        '<span class="label">' + t("map.currentAvgPrice") + "</span>" +
        '<div class="value highlight">' + formatPrice(current) + "</div>" +
      "</div>" +
      '<div class="stat-card">' +
        '<span class="label">' + t("map.predicted1Month") + "</span>" +
        '<div class="value success">' + formatPrice(predicted) + "</div>" +
      "</div>" +
      '<div class="stat-card">' +
        '<span class="label">' + t("map.floodRisk") + "</span>" +
        '<div class="value warning">' + escapeHtml(flood) + "</div>" +
      "</div>" +
      '<div class="chart-section">' +
        '<div class="label">' + t("map.priceTrend") + "</div>" +
        '<div class="chart-wrap"><canvas id="priceChart"></canvas></div>' +
      "</div>";

    areaDataEl.querySelector(".back-to-all").addEventListener("click", function (e) {
      e.preventDefault();
      showAllAreasView();
    });

    if (priceHistoryParams && priceHistoryParams.state) {
      loadPriceChart(priceHistoryParams.state, priceHistoryParams.district || null);
    } else {
      const wrap = areaDataEl.querySelector(".chart-wrap");
      if (wrap) wrap.innerHTML = "<p style='font-size:11px;color:var(--text-muted);margin:0'>" + t("map.noHistoryData") + "</p>";
    }
  }

  function renderAllAreasList() {
    const list = currentView === "state"
      ? Object.keys(predictions.state).sort()
      : Object.keys(predictions.district).sort();
    const titleKey = currentView === "state" ? "map.allStates" : "map.allDistricts";
    const title = t(titleKey);
    const clickHint = t("map.clickMapForDetail");
    let html = '<div class="list-title">' + escapeHtml(title) + " — " + escapeHtml(clickHint) + "</div>";
    list.forEach(function (key) {
      const data = currentView === "state" ? predictions.state[key] : predictions.district[key];
      if (!data) return;
      const rawName = currentView === "district" ? key.replace("|", ", ") : key;
      const name = currentView === "state" ? stateDisplayName(key) : rawName;
      html +=
        '<div class="area-row" data-key="' + escapeHtml(key) + '" role="button" tabindex="0">' +
          '<span class="name">' + escapeHtml(name) + "</span>" +
          '<div class="prices">' +
            '<span class="current">' + formatPrice(data.current_price) + "</span>" +
          "</div>" +
        "</div>";
    });
    allAreasListEl.innerHTML = html;
    allAreasListEl.querySelectorAll(".area-row").forEach(function (row) {
      row.addEventListener("click", function () {
        selectAreaFromSidebar(row.getAttribute("data-key"));
      });
    });
  }

  function findStateLayersByKey(key) {
    if (!stateLayer) return [];
    return stateLayer.getLayers().filter(function (l) {
      return stateKey(l.feature.properties.NAME_1) === key;
    });
  }

  function findDistrictLayerByKey(key) {
    if (!districtLayer) return null;
    const parts = key.split("|");
    const stateKeyVal = parts[0];
    const districtKeyVal = parts[1];
    return districtLayer.getLayers().find(function (l) {
      const s = stateKey(l.feature.properties.NAME_1);
      const d = districtKeyForData(l.feature.properties.NAME_2);
      return s === stateKeyVal && (d === districtKeyVal || l.feature.properties.NAME_2 === districtKeyVal);
    }) || null;
  }

  function selectAreaFromSidebar(key) {
    if (currentView === "state") {
      const layers = findStateLayersByKey(key);
      const data = predictions.state[key];
      if (!layers.length || !data) return;
      selectedStateLayers.forEach(function (l) {
        if (stateLayer) stateLayer.resetStyle(l);
      });
      selectedStateLayers = [];
      if (selectedDistrictLayer && districtLayer) {
        districtLayer.resetStyle(selectedDistrictLayer);
        selectedDistrictLayer = null;
      }
      selectedStateLayers = layers;
      layers.forEach(function (l) {
        l.setStyle(SELECTED_STYLE);
        l.bringToFront();
      });
      if (layers.length === 1) {
        zoomToLayer(layers[0], 8);
      } else {
        const group = L.featureGroup(layers);
        map.fitBounds(group.getBounds(), { maxZoom: 8, padding: [24, 24] });
      }
      showAreaData(key, "State", data, { state: key });
    } else {
      const layer = findDistrictLayerByKey(key);
      const data = predictions.district[key];
      if (!layer || !data) return;
      if (selectedDistrictLayer && districtLayer) districtLayer.resetStyle(selectedDistrictLayer);
      selectedStateLayers.forEach(function (l) {
        if (stateLayer) stateLayer.resetStyle(l);
      });
      selectedStateLayers = [];
      selectedDistrictLayer = layer;
      layer.setStyle(SELECTED_STYLE);
      layer.bringToFront();
      zoomToLayer(layer, 8);
      const title = key.replace("|", ", ");
      const stateKeyVal = key.split("|")[0];
      const districtKeyVal = key.split("|")[1];
      showAreaData(title, t("map.districtLabel"), data, { state: stateKeyVal, district: districtKeyVal }, key, false);
    }
  }

  function showAllAreasView() {
    areaDataEl.style.display = "none";
    if (priceChartInstance) {
      priceChartInstance.destroy();
      priceChartInstance = null;
    }
    renderAllAreasList();
    allAreasListEl.style.display = "block";
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function loadPriceChart(stateKeyVal, districtKey) {
    let url = API_BASE + "/price-history?state=" + encodeURIComponent(stateKeyVal);
    if (districtKey) url += "&district=" + encodeURIComponent(districtKey);
    fetch(url)
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        const canvas = document.getElementById("priceChart");
        if (!canvas || !data || !data.dates || !data.prices || data.prices.length === 0) {
          const wrap = document.querySelector(".chart-wrap");
          if (wrap) wrap.innerHTML = "<p style='font-size:12px;color:var(--text-muted);margin:0'>" + t("map.noHistoryData") + "</p>";
          return;
        }
        if (priceChartInstance) priceChartInstance.destroy();
        const labels = data.dates.map(function (d) {
          return d.length >= 10 ? d.slice(0, 10) : d;
        });
        const gridColor = "rgba(110, 118, 129, 0.25)";
        const textColor = "#8b949e";
        priceChartInstance = new Chart(canvas, {
          type: "line",
          data: {
            labels: labels,
            datasets: [{
              label: "Avg price (RM)",
              data: data.prices,
              borderColor: "#58a6ff",
              backgroundColor: "rgba(56, 139, 253, 0.15)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointHoverBackgroundColor: "#58a6ff",
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "#161b22",
                titleColor: "#e6edf3",
                bodyColor: "#8b949e",
                borderColor: "#30363d",
                borderWidth: 1,
                callbacks: {
                  label: function (ctx) {
                    const v = ctx.raw;
                    if (v >= 1e6) return "RM " + (v / 1e6).toFixed(2) + " M";
                    if (v >= 1e3) return "RM " + (v / 1e3).toFixed(0) + " K";
                    return "RM " + Math.round(v);
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: textColor, maxTicksLimit: 8, font: { size: 10 } },
              },
              y: {
                beginAtZero: false,
                grid: { color: gridColor },
                ticks: {
                  color: textColor,
                  font: { size: 10 },
                  callback: function (v) {
                    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
                    if (v >= 1e3) return (v / 1e3) + "K";
                    return v;
                  },
                },
              },
            },
          },
        });
      })
      .catch(function () {
        const wrap = document.querySelector(".chart-wrap");
        if (wrap) wrap.innerHTML = "<p style='font-size:12px;color:var(--text-muted);margin:0'>Chart unavailable</p>";
      });
  }

  function showPlaceholder() {
    panelPlaceholder.style.display = "block";
    areaDataEl.style.display = "none";
    if (priceChartInstance) {
      priceChartInstance.destroy();
      priceChartInstance = null;
    }
  }

  function showNoData(title, subTitle) {
    var askLabel = typeof t === "function" ? t("map.askChatbot") : "Ask chatbot";
    panelPlaceholder.style.display = "none";
    areaDataEl.style.display = "block";
    areaDataEl.innerHTML =
      '<div class="area-data-header">' +
        "<h2>" + escapeHtml(title) + "</h2>" +
        "<span class=\"sub\">" + escapeHtml(subTitle) + "</span>" +
      "</div>" +
      '<div class="panel-placeholder" style="padding:24px 0">' +
        "<p>" + (typeof t === "function" ? t("map.noPriceData") : "Sorry, no price data for this area.") + "</p>" +
        '<p style="margin-top:12px"><button type="button" class="btn-ask-chatbot" data-area="' + escapeHtml(title) + '">' + escapeHtml(askLabel) + "</button></p>" +
      "</div>";
    var btn = areaDataEl.querySelector(".btn-ask-chatbot");
    if (btn) {
      btn.addEventListener("click", function () {
        var area = btn.getAttribute("data-area") || "";
        var q = "What is the Current avg price, Predicted 1 month and Flood risk data for the " + (area ? area + "?" : "?");
        if (typeof window.ensureChatbotReady === "function") window.ensureChatbotReady();
        if (typeof window.askChatbot === "function") {
          window.askChatbot(q);
        } else {
          document.dispatchEvent(new CustomEvent("estateview-ask-chatbot", { detail: { question: q } }));
        }
      });
    }
  }

  const STATE_OUTLINE = "hsl(210, 45%, 55%)";

  // Light map: soft fills; Sabah = orange, Sarawak = teal; outline same blue as others
  function styleByState(feature) {
    const name = feature.properties.NAME_1 || "";
    if (name === "Sabah") {
      return {
        fillColor: "hsl(28, 65%, 90%)",
        weight: 1.5,
        color: STATE_OUTLINE,
        fillOpacity: 0.8,
      };
    }
    if (name === "Sarawak") {
      return {
        fillColor: "hsl(185, 45%, 85%)",
        weight: 1.5,
        color: STATE_OUTLINE,
        fillOpacity: 0.8,
      };
    }
    const idx = [...new Set(stateNames)].sort().indexOf(name);
    const hue = (idx * 47) % 360;
    return {
      fillColor: "hsl(" + hue + ", 55%, 88%)",
      weight: 1.5,
      color: STATE_OUTLINE,
      fillOpacity: 0.75,
    };
  }

  function styleByDistrict(feature) {
    return {
      fillColor: "#c8d4e6",
      weight: 1,
      color: "#5a7aa0",
      fillOpacity: 0.65,
    };
  }

  function highlightFeature(e) {
    const layer = e.target;
    if (currentView === "state" && selectedStateLayers.indexOf(layer) !== -1) return;
    if (currentView === "district" && layer === selectedDistrictLayer) return;
    layer.setStyle({
      weight: 2.5,
      color: "#2563eb",
      fillColor: "#93c5fd",
      fillOpacity: 0.5,
    });
    layer.bringToFront();
  }

  function resetHighlight(e) {
    if (currentView === "state" && selectedStateLayers.indexOf(e.target) !== -1) return;
    if (currentView === "district" && e.target === selectedDistrictLayer) return;
    if (currentView === "state") {
      stateLayer.resetStyle(e.target);
    } else {
      districtLayer.resetStyle(e.target);
    }
  }

  function clearSelection() {
    selectedStateLayers.forEach(function (l) {
      if (stateLayer) stateLayer.resetStyle(l);
    });
    selectedStateLayers = [];
    if (selectedDistrictLayer && districtLayer) {
      districtLayer.resetStyle(selectedDistrictLayer);
      selectedDistrictLayer = null;
    }
    map.fitBounds(DEFAULT_VIEW.bounds, { padding: [20, 20], maxZoom: 8, animate: true });
    showAllAreasView();
  }

  function zoomToLayer(layer, maxZoom) {
    const bounds = layer.getBounds();
    map.fitBounds(bounds, { maxZoom: maxZoom != null ? maxZoom : 8, padding: [24, 24] });
  }

  function onStateClick(e) {
    const layer = e.target;
    const name = layer.feature.properties.NAME_1;
    const key = stateKey(name);
    const data = predictions.state[key];

    if (selectedStateLayers.indexOf(layer) !== -1) {
      clearSelection();
      return;
    }

    if (!data) {
      showNoData(name, "State");
      return;
    }

    selectedStateLayers.forEach(function (l) {
      if (stateLayer) stateLayer.resetStyle(l);
    });
    selectedStateLayers = [];
    selectedDistrictLayer = null;
    if (selectedDistrictLayer && districtLayer) districtLayer.resetStyle(selectedDistrictLayer);

    var layersForState = findStateLayersByKey(key);
    selectedStateLayers = layersForState;
    layersForState.forEach(function (l) {
      l.setStyle(SELECTED_STYLE);
      l.bringToFront();
    });
    if (layersForState.length === 1) {
      zoomToLayer(layersForState[0], 8);
    } else {
      var group = L.featureGroup(layersForState);
      map.fitBounds(group.getBounds(), { maxZoom: 8, padding: [24, 24] });
    }
    showAreaData(stateDisplayName(key), t("map.stateLabel"), data, { state: key }, key, true);
  }

  function onDistrictClick(e) {
    L.DomEvent.stopPropagation(e);
    const layer = e.target;
    const stateName = layer.feature.properties.NAME_1;
    const districtName = layer.feature.properties.NAME_2;
    const stateKeyNorm = stateKey(stateName);
    const dataDistrictName = districtKeyForData(districtName);
    let key = stateKeyNorm + "|" + dataDistrictName;
    let data = predictions.district[key];
    if (!data) data = predictions.district[stateKeyNorm + "|" + districtName];
    if (!data) data = predictions.district[stateName + "|" + districtName];
    if (!data) data = predictions.district[stateName + "|" + dataDistrictName];
    if (!data && (stateKeyNorm === dataDistrictName || stateName === districtName)) {
      data = predictions.state[stateKeyNorm];
    }

    if (layer === selectedDistrictLayer) {
      clearSelection();
      return;
    }

    if (!data) {
      showNoData(districtName + ", " + stateName, t("map.districtLabel"));
      return;
    }

    if (selectedDistrictLayer && districtLayer) districtLayer.resetStyle(selectedDistrictLayer);
    selectedStateLayers.forEach(function (l) {
      if (stateLayer) stateLayer.resetStyle(l);
    });
    selectedStateLayers = [];
    selectedDistrictLayer = layer;

    layer.setStyle(SELECTED_STYLE);
    layer.bringToFront();
    const title = districtName + ", " + stateName;
    showAreaData(title, t("map.districtLabel"), data, { state: stateKeyNorm, district: dataDistrictName }, stateKeyNorm + "|" + dataDistrictName, false);
  }

  function buildStateLayer(geojson) {
    if (stateLayer) map.removeLayer(stateLayer);
    stateNames = geojson.features.map((f) => f.properties.NAME_1);
    stateLayer = L.geoJSON(geojson, {
      style: styleByState,
      onEachFeature: function (feature, layer) {
        layer.on("click", onStateClick);
        layer.on("mouseover", highlightFeature);
        layer.on("mouseout", resetHighlight);
      },
    });
    return stateLayer;
  }

  function buildDistrictLayer(geojson) {
    if (districtLayer) map.removeLayer(districtLayer);
    districtLayer = L.geoJSON(geojson, {
      style: styleByDistrict,
      onEachFeature: function (feature, layer) {
        layer.on("click", onDistrictClick);
        layer.on("mouseover", highlightFeature);
        layer.on("mouseout", resetHighlight);
      },
    });
    return districtLayer;
  }

  function applyView() {
    currentView = layerSelect.value;
    if (!window._geoJson) return;
    if (selectedStateLayers.length || selectedDistrictLayer) {
      clearSelection();
    }
    if (currentView === "state") {
      if (districtLayer && map.hasLayer(districtLayer)) map.removeLayer(districtLayer);
      if (stateLayer && !map.hasLayer(stateLayer)) map.addLayer(stateLayer);
    } else {
      if (stateLayer && map.hasLayer(stateLayer)) map.removeLayer(stateLayer);
      if (districtLayer && !map.hasLayer(districtLayer)) map.addLayer(districtLayer);
    }
    if (allAreasListEl.style.display !== "none") {
      renderAllAreasList();
    }
  }

  layerSelect.addEventListener("change", applyView);

  Promise.all([
    fetch(API_BASE + "/predictions").then((r) => r.json()),
    fetch(DISTRICTS_GEOJSON).then((r) => r.json()),
  ])
    .then(function ([data, geojson]) {
      predictions = data;
      window._geoJson = geojson;
      buildStateLayer(geojson);
      buildDistrictLayer(geojson);
      applyView();
      panelPlaceholder.style.display = "none";
      renderAllAreasList();
      allAreasListEl.style.display = "block";
    })
    .catch(function (err) {
      console.error(err);
      allAreasListEl.style.display = "none";
      panelPlaceholder.style.display = "block";
      panelPlaceholder.innerHTML =
        '<div class="icon">⚠️</div>' +
        "<h2>" + t("map.couldNotLoadData") + "</h2>" +
        "<p>" + t("map.couldNotLoadHint") + "</p>";
    });

  document.addEventListener("languagechange", function () {
    if (allAreasListEl && allAreasListEl.style.display === "block") {
      renderAllAreasList();
    }
    if (areaDataEl && areaDataEl.style.display === "flex" && lastAreaData && lastAreaData.key != null) {
      var title = lastAreaData.isState ? stateDisplayName(lastAreaData.key) : lastAreaData.key.replace("|", ", ");
      var subTitle = lastAreaData.isState ? t("map.stateLabel") : t("map.districtLabel");
      showAreaData(title, subTitle, lastAreaData.data, lastAreaData.priceHistoryParams, lastAreaData.key, lastAreaData.isState);
    } else if (areaDataEl && areaDataEl.style.display === "flex" && lastAreaData) {
      showAreaData(lastAreaData.title, lastAreaData.subTitle, lastAreaData.data, lastAreaData.priceHistoryParams);
    }
  });
})();
