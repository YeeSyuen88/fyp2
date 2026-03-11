(function () {
  function t(key) {
    if (typeof window.getTranslation === "function" && typeof window.getLang === "function") {
      var val = window.getTranslation(window.getLang(), key);
      return val != null ? val : key;
    }
    return key;
  }

  const stateSelect = document.getElementById("state");
  const districtSelect = document.getElementById("district");
  const propertyTypeSelect = document.getElementById("property_type");
  const form = document.getElementById("estimator-form");
  const errorDiv = document.getElementById("error");
  const btnSubmit = document.getElementById("btn-submit");
  const btnReset = document.getElementById("btn-reset");
  const btnCopy = document.getElementById("btn-copy");
  const resultLoading = document.getElementById("result-loading");
  const resultContent = document.getElementById("result-content");

  let options = { states: [], property_types: [], districts_by_state: {} };
  let lastResult = null;

  function showError(msg) {
    errorDiv.textContent = msg || "";
    errorDiv.style.display = msg ? "block" : "none";
  }

  function formatPrice(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1e6) return "RM " + (n / 1e6).toFixed(2) + " M";
    if (n >= 1e3) return "RM " + (n / 1e3).toFixed(0) + " K";
    return "RM " + Math.round(n);
  }

  function formatRange(minVal, maxVal) {
    if (minVal != null && maxVal != null) return minVal + " – " + maxVal;
    if (minVal != null) return "≥ " + minVal;
    if (maxVal != null) return "≤ " + maxVal;
    return "—";
  }

  function setResultPlaceholders() {
    document.getElementById("out-predicted").textContent = "—";
    document.getElementById("out-floor-range").textContent = "—";
    document.getElementById("out-rooms-range").textContent = "—";
    document.getElementById("out-flood").textContent = "—";
    lastResult = null;
    if (btnCopy) {
      btnCopy.style.display = "none";
      btnCopy.textContent = t("estimator.copyAllDetails");
      btnCopy.classList.remove("copied");
    }
  }

  function resetForm() {
    stateSelect.value = "";
    districtSelect.innerHTML = "<option value=\"\">" + t("estimator.any") + "</option>";
    propertyTypeSelect.value = "";
    showError("");
    setResultPlaceholders();
  }

  function buildCopyText() {
    if (!lastResult) return "";
    var d = lastResult.data;
    var fr = d.floor_area_range_sqft || {};
    var rr = d.rooms_range || {};
    var priceStr = formatPrice(d.predicted_price_1month);
    var floorStr = formatRange(fr.min, fr.max);
    var roomsStr = formatRange(rr.min, rr.max);
    var floodStr = d.flood_risk != null ? String(d.flood_risk) : t("estimator.dataPending");
    return [
      "EstateView — Estimated Value",
      "",
      "Criteria:",
      "  " + t("estimator.state") + ": " + lastResult.state,
      "  " + t("estimator.district") + ": " + (lastResult.district || t("estimator.any")),
      "  " + t("estimator.propertyType") + ": " + lastResult.property_type,
      "",
      t("estimator.predictedPrice") + ": " + priceStr,
      t("estimator.floorAreaRange") + ": " + floorStr,
      t("estimator.numberOfRoomsRange") + ": " + roomsStr,
      t("estimator.floodRisk") + ": " + floodStr,
    ].join("\n");
  }

  async function loadOptions() {
    try {
      const res = await fetch("/api/estimator/options");
      if (!res.ok) throw new Error("Options not available. Run scripts/build_area_summary.py first.");
      options = await res.json();
      stateSelect.innerHTML = "<option value=\"\">" + t("estimator.selectState") + "</option>";
      (options.states || []).forEach(function (s) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        stateSelect.appendChild(opt);
      });
      propertyTypeSelect.innerHTML = "<option value=\"\">" + t("estimator.selectType") + "</option>";
      (options.property_types || []).forEach(function (p) {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        propertyTypeSelect.appendChild(opt);
      });
      districtSelect.innerHTML = "<option value=\"\">" + t("estimator.any") + "</option>";
      return true;
    } catch (e) {
      showError(e.message);
      return false;
    }
  }

  if (btnReset) btnReset.addEventListener("click", resetForm);

  if (btnCopy) {
    btnCopy.addEventListener("click", function () {
      var text = buildCopyText();
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        btnCopy.textContent = t("estimator.copied");
        btnCopy.classList.add("copied");
        setTimeout(function () {
          btnCopy.textContent = t("estimator.copyAllDetails");
          btnCopy.classList.remove("copied");
        }, 2000);
      }).catch(function () {
        btnCopy.textContent = t("estimator.copyFailed");
        setTimeout(function () { btnCopy.textContent = t("estimator.copyAllDetails"); }, 2000);
      });
    });
  }

  stateSelect.addEventListener("change", function () {
    const state = stateSelect.value;
    districtSelect.innerHTML = "<option value=\"\">" + t("estimator.any") + "</option>";
    const list = (options.districts_by_state || {})[state];
    if (list && list.length) {
      list.forEach(function (d) {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        districtSelect.appendChild(opt);
      });
    }
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");
    const state = stateSelect.value.trim();
    const district = districtSelect.value.trim();
    const property_type = propertyTypeSelect.value.trim();
    if (!state || !property_type) {
      showError(t("estimator.pleaseSelectStateAndType"));
      return;
    }
    btnSubmit.disabled = true;
    btnSubmit.textContent = t("estimator.loading");
    if (resultLoading) resultLoading.style.display = "block";
    if (resultContent) resultContent.style.display = "none";
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: state,
          district: district,
          property_type: property_type,
        }),
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showError(data.error || t("estimator.requestFailed"));
        if (resultLoading) resultLoading.style.display = "none";
        if (resultContent) resultContent.style.display = "block";
        return;
      }
      lastResult = { state: state, district: district, property_type: property_type, data: data };
      document.getElementById("out-predicted").textContent = formatPrice(data.predicted_price_1month);
      var fr = data.floor_area_range_sqft || {};
      document.getElementById("out-floor-range").textContent = formatRange(fr.min, fr.max);
      var rr = data.rooms_range || {};
      document.getElementById("out-rooms-range").textContent = formatRange(rr.min, rr.max);
      document.getElementById("out-flood").textContent = data.flood_risk != null ? String(data.flood_risk) : t("estimator.dataPending");
      if (btnCopy) btnCopy.style.display = "block";
    } catch (err) {
      showError(err.message || "Network error.");
      if (resultLoading) resultLoading.style.display = "none";
      if (resultContent) resultContent.style.display = "block";
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = t("estimator.showResult");
      if (resultLoading) resultLoading.style.display = "none";
      if (resultContent) resultContent.style.display = "block";
    }
  });

  document.addEventListener("languagechange", function () {
    var so = stateSelect.options[0];
    if (so) so.textContent = t("estimator.selectState");
    var do0 = districtSelect.options[0];
    if (do0) do0.textContent = t("estimator.any");
    var po = propertyTypeSelect.options[0];
    if (po) po.textContent = t("estimator.selectType");
    if (btnSubmit) btnSubmit.textContent = t("estimator.showResult");
    if (btnCopy && lastResult) btnCopy.textContent = t("estimator.copyAllDetails");
    if (resultLoading) resultLoading.textContent = t("estimator.loading");
  });

  loadOptions();
})();
