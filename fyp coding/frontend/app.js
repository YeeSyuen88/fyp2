(function () {
  const API_BASE = "/api";
  const DISTRICTS_GEOJSON =
    "https://gist.githubusercontent.com/angch/4bbbaa72ba0a9c95bfda951ca82b748f/raw/malaysia.districts.geojson";

  const map = L.map("map").setView([4.2, 101.98], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const infoEl = document.getElementById("info");
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

  // Map GeoJSON district name (map) -> our dataset district name. Add more here if you find mismatches.
  const districtNameMap = {
    Keluang: "Kluang",
    "Kota Bahru": "Kota Bharu",
    "Kota Baru": "Kota Bharu",
    Tanjong: "Tanjung",
    Telok: "Teluk",
    "Pekan Nenas": "Pekan Nanas",
    // Johor: GeoJSON vs dataset spelling / name variants
    "Johor Baharu": "Johor Bahru",
    Kulaijaya: "Kulai",
    Ledang: "Tangkak",
    // Kedah
    "Kota Setar": "Alor Setar",
    // Kelantan
    "Pasir Putih": "Pasir Puteh",
    "Kuala Krai": "Kuala Kerai",
    // Pahang
    Lipis: "Kuala Lipis",
    // Perak: GeoJSON uses district names, dataset uses towns
    "Larut and Matang": "Taiping",
    "Hilir Perak": "Teluk Intan",
    "Hulu Perak": "Gerik",
    "Perak Tengah": "Seri Iskandar",
    Kinta: "Ipoh",
    Kerian: "Parit Buntar",
    "Batang Padang": "Tapah",
    // Penang (Pulau Pinang): GeoJSON districts -> dataset area names
    "Barat Daya": "Bayan Lepas",
    "Timur Laut": "George Town",
    "Seberang Perai Selatan": "Nibong Tebal",
    "Seberang Perai Tengah": "Bukit Mertajam",
    "Seberang Perai Utara": "Butterworth",
    // Sarawak
    Meradong: "Maradong",
  };
  function districtKeyForData(geoName) {
    return districtNameMap[geoName] || geoName;
  }

  let predictions = { state: {}, district: {} };
  let stateLayer = null;
  let districtLayer = null;
  let currentView = "state";

  function formatPrice(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1e6) return "RM " + (n / 1e6).toFixed(2) + " M";
    if (n >= 1e3) return "RM " + (n / 1e3).toFixed(0) + " K";
    return "RM " + Math.round(n);
  }

  let priceChartInstance = null;

  function showInfo(html, priceHistoryParams) {
    infoEl.innerHTML = html;
    infoEl.classList.add("visible");
    if (priceChartInstance) {
      priceChartInstance.destroy();
      priceChartInstance = null;
    }
    if (priceHistoryParams && priceHistoryParams.state) {
      var wrap = document.createElement("div");
      wrap.className = "chart-wrap";
      wrap.innerHTML = "<canvas id=\"priceChart\"></canvas>";
      infoEl.appendChild(wrap);
      loadPriceChart(priceHistoryParams.state, priceHistoryParams.district || null);
    }
  }

  function loadPriceChart(stateKey, districtKey) {
    var url = API_BASE + "/price-history?state=" + encodeURIComponent(stateKey);
    if (districtKey) url += "&district=" + encodeURIComponent(districtKey);
    fetch(url)
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        var canvas = document.getElementById("priceChart");
        if (!canvas || !data || !data.dates || !data.prices || data.prices.length === 0) {
          if (canvas && canvas.parentNode) canvas.parentNode.innerHTML = "<p style='font-size:12px;color:#666'>No history data</p>";
          return;
        }
        if (priceChartInstance) priceChartInstance.destroy();
        var labels = data.dates.map(function (d) {
          return d.length >= 10 ? d.slice(0, 10) : d;
        });
        priceChartInstance = new Chart(canvas, {
          type: "line",
          data: {
            labels: labels,
            datasets: [{
              label: "Avg price (RM)",
              data: data.prices,
              borderColor: "rgb(0, 120, 80)",
              backgroundColor: "rgba(0, 120, 80, 0.1)",
              fill: true,
              tension: 0.2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.raw;
                    if (v >= 1e6) return "RM " + (v / 1e6).toFixed(2) + " M";
                    if (v >= 1e3) return "RM " + (v / 1e3).toFixed(0) + " K";
                    return "RM " + Math.round(v);
                  },
                },
              },
            },
            scales: {
              y: {
                beginAtZero: false,
                ticks: {
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
        var wrap = document.getElementById("priceChart");
        if (wrap && wrap.parentNode) wrap.parentNode.innerHTML = "<p style='font-size:12px;color:#666'>Chart unavailable</p>";
      });
  }

  function hideInfo() {
    infoEl.classList.remove("visible");
    if (priceChartInstance) {
      priceChartInstance.destroy();
      priceChartInstance = null;
    }
  }

  function styleByState(feature) {
    const name = feature.properties.NAME_1 || "";
    const idx = [...new Set(stateNames)].sort().indexOf(name);
    const hue = (idx * 47) % 360;
    return {
      fillColor: "hsl(" + hue + ", 70%, 85%)",
      weight: 1,
      color: "#333",
      fillOpacity: 0.7,
    };
  }

  function styleByDistrict(feature) {
    return {
      fillColor: "#aad",
      weight: 0.8,
      color: "#558",
      fillOpacity: 0.6,
    };
  }

  function onStateClick(e) {
    const name = e.target.feature.properties.NAME_1;
    const key = stateKey(name);
    const data = predictions.state[key];
    if (!data) {
      showInfo("<h3>" + name + "</h3><p>No price data for this state.</p>");
      return;
    }
    showInfo(
      "<h3>" + name + " (State)</h3>" +
      "<p><span class='price'>Current avg price: " + formatPrice(data.current_price) + "</span></p>" +
      "<p><span class='price'>Predicted 1 month: " + formatPrice(data.predicted_price_1month) + "</span></p>" +
      "<p class='flood'>Flood risk: " + (data.flood_risk || "Data pending") + "</p>" +
      "<p style='font-size:12px;color:#666;margin-top:4px'>Price trend:</p>",
      { state: key }
    );
  }

  function onDistrictClick(e) {
    L.DomEvent.stopPropagation(e);
    const stateName = e.target.feature.properties.NAME_1;
    const districtName = e.target.feature.properties.NAME_2;
    const stateKeyNorm = stateKey(stateName);
    const dataDistrictName = districtKeyForData(districtName);
    let key = stateKeyNorm + "|" + dataDistrictName;
    let data = predictions.district[key];
    if (!data) data = predictions.district[stateKeyNorm + "|" + districtName];
    if (!data) data = predictions.district[stateName + "|" + districtName];
    if (!data) data = predictions.district[stateName + "|" + dataDistrictName];
    // Perlis etc.: state has no districts, GeoJSON shows "Perlis, Perlis" -> use state-level data
    if (!data && (stateKeyNorm === dataDistrictName || stateName === districtName)) {
      data = predictions.state[stateKeyNorm];
    }
    if (!data) {
      showInfo(
        "<h3>" + districtName + ", " + stateName + "</h3><p>No price data for this district.</p>"
      );
      return;
    }
    showInfo(
      "<h3>" + districtName + ", " + stateName + "</h3>" +
      "<p><span class='price'>Current avg price: " + formatPrice(data.current_price) + "</span></p>" +
      "<p><span class='price'>Predicted 1 month: " + formatPrice(data.predicted_price_1month) + "</span></p>" +
      "<p class='flood'>Flood risk: " + (data.flood_risk || "Data pending") + "</p>" +
      "<p style='font-size:12px;color:#666;margin-top:4px'>Price trend:</p>",
      { state: stateKeyNorm, district: dataDistrictName }
    );
  }

  let stateNames = [];

  function buildStateLayer(geojson) {
    if (stateLayer) map.removeLayer(stateLayer);
    stateNames = geojson.features.map((f) => f.properties.NAME_1);
    stateLayer = L.geoJSON(geojson, {
      style: styleByState,
      onEachFeature: function (feature, layer) {
        layer.on("click", onStateClick);
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
      },
    });
    return districtLayer;
  }

  function applyView() {
    currentView = layerSelect.value;
    if (!window._geoJson) return;
    if (currentView === "state") {
      if (districtLayer && map.hasLayer(districtLayer)) map.removeLayer(districtLayer);
      if (stateLayer && !map.hasLayer(stateLayer)) map.addLayer(stateLayer);
    } else {
      if (stateLayer && map.hasLayer(stateLayer)) map.removeLayer(stateLayer);
      if (districtLayer && !map.hasLayer(districtLayer)) map.addLayer(districtLayer);
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
    })
    .catch(function (err) {
      console.error(err);
      showInfo(
        "<h3>Error</h3><p>Could not load data. Start the backend: <code>python backend/app.py</code> then open <a href='/'>this page</a>.</p>"
      );
    });
})();
