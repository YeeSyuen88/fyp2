(function () {
  const stateSelect = document.getElementById("state");
  const districtSelect = document.getElementById("district");
  const propertyTypeSelect = document.getElementById("property_type");
  const form = document.getElementById("estimator-form");
  const resultDiv = document.getElementById("result");
  const errorDiv = document.getElementById("error");
  const btnSubmit = document.getElementById("btn-submit");

  let options = { states: [], property_types: [], districts_by_state: {} };

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

  async function loadOptions() {
    try {
      const res = await fetch("/api/estimator/options");
      if (!res.ok) throw new Error("Options not available. Run scripts/build_area_summary.py first.");
      options = await res.json();
      stateSelect.innerHTML = "<option value=\"\">-- Select state --</option>";
      (options.states || []).forEach(function (s) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        stateSelect.appendChild(opt);
      });
      propertyTypeSelect.innerHTML = "<option value=\"\">-- Select type --</option>";
      (options.property_types || []).forEach(function (p) {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        propertyTypeSelect.appendChild(opt);
      });
      districtSelect.innerHTML = "<option value=\"\">-- Any --</option>";
      return true;
    } catch (e) {
      showError(e.message);
      return false;
    }
  }

  stateSelect.addEventListener("change", function () {
    const state = stateSelect.value;
    districtSelect.innerHTML = "<option value=\"\">-- Any --</option>";
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
    resultDiv.classList.remove("visible");
    const state = stateSelect.value.trim();
    const district = districtSelect.value.trim();
    const property_type = propertyTypeSelect.value.trim();
    if (!state || !property_type) {
      showError("Please select state and property type.");
      return;
    }
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Loading...";
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
        showError(data.error || "Request failed.");
        return;
      }
      document.getElementById("out-predicted").textContent = formatPrice(data.predicted_price_1month);
      var fr = data.floor_area_range_sqft || {};
      document.getElementById("out-floor-range").textContent = formatRange(fr.min, fr.max);
      var rr = data.rooms_range || {};
      document.getElementById("out-rooms-range").textContent = formatRange(rr.min, rr.max);
      document.getElementById("out-flood").textContent = data.flood_risk != null ? String(data.flood_risk) : "Data pending";
      resultDiv.classList.add("visible");
    } catch (err) {
      showError(err.message || "Network error.");
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Show Result";
    }
  });

  loadOptions();
})();
