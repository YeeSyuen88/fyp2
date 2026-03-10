"""
Build area + property type summary from merged_high_quality_dataset.
Output: output/area_property_summary.json
  - options: states, property_types, districts_by_state (for dropdowns)
  - by_state_property: state -> property_type -> floor_area_sqft_min/max (percentile-based), bedrooms_min/max (non-negative)
  - by_state_district_property: state -> district -> property_type -> same
Floor area: use 10th–90th percentile and cap max at 10000 so range is logical (e.g. 100–3000).
Rooms: only non-negative values; never show negative number.
"""
import os
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_CSV = os.path.join(BASE_DIR, "merged_high_quality_dataset.csv")
OUT_PATH = os.path.join(BASE_DIR, "output", "area_property_summary.json")

# Floor area: reasonable range around typical values; cap so no property type exceeds 10000 sqft
FLOOR_AREA_PERCENTILE_LOW = 10
FLOOR_AREA_PERCENTILE_HIGH = 90
FLOOR_AREA_MIN_FLOOR = 100
FLOOR_AREA_MAX_CAP = 10000

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)


def _floor_area_range(series):
    """Sensible min/max from percentiles, capped."""
    clean = series.dropna()
    if len(clean) == 0:
        return None, None
    low = np.percentile(clean, FLOOR_AREA_PERCENTILE_LOW)
    high = np.percentile(clean, FLOOR_AREA_PERCENTILE_HIGH)
    low = max(FLOOR_AREA_MIN_FLOOR, int(round(low)))
    high = min(FLOOR_AREA_MAX_CAP, int(round(high)))
    if low > high:
        low = high
    return low, high


def _rooms_range(series):
    """Min/max bedrooms; only non-negative, never return negative."""
    clean = series.dropna()
    clean = clean[clean >= 0]
    if len(clean) == 0:
        return None, None
    return int(clean.min()), int(clean.max())


def main():
    print("Loading merged_high_quality_dataset.csv...")
    df = pd.read_csv(RAW_CSV, na_values=["NULL", "null", ""])
    df = df.dropna(subset=["state"])
    pt_col = "property_type" if "property_type" in df.columns else "property_type_group"
    df["property_type"] = df[pt_col].fillna("Other").astype(str).str.strip()
    df["floor_area_sqft"] = pd.to_numeric(df["floor_area_sqft"], errors="coerce")
    df["bedrooms"] = pd.to_numeric(df["bedrooms"], errors="coerce")
    df = df[df["floor_area_sqft"] > 0]
    if "district_text" not in df.columns:
        df["district_text"] = ""
    df["district_text"] = df["district_text"].fillna("").astype(str).str.strip()

    options = {
        "states": sorted(df["state"].astype(str).unique().tolist()),
        "property_types": sorted(df["property_type"].unique().tolist()),
        "districts_by_state": {},
    }
    for state in options["states"]:
        d = df[df["state"] == state]["district_text"]
        dists = sorted(d[d != ""].unique().tolist())
        options["districts_by_state"][state] = dists

    # By state + property_type (all districts): percentile-based floor area, non-negative rooms
    by_state_property = {}
    for state in options["states"]:
        by_state_property[state] = {}
        sub = df[df["state"] == state]
        for pt in options["property_types"]:
            s = sub[sub["property_type"] == pt]
            if len(s) == 0:
                continue
            fa_min, fa_max = _floor_area_range(s["floor_area_sqft"])
            rm_min, rm_max = _rooms_range(s["bedrooms"])
            by_state_property[state][pt] = {
                "floor_area_sqft_min": fa_min,
                "floor_area_sqft_max": fa_max,
                "bedrooms_min": rm_min,
                "bedrooms_max": rm_max,
            }

    # By state + district + property_type
    by_state_district_property = {}
    for state in options["states"]:
        by_state_district_property[state] = {}
        for district in options["districts_by_state"].get(state, []):
            by_state_district_property[state][district] = {}
            sub = df[(df["state"] == state) & (df["district_text"] == district)]
            for pt in options["property_types"]:
                s = sub[sub["property_type"] == pt]
                if len(s) == 0:
                    continue
                fa_min, fa_max = _floor_area_range(s["floor_area_sqft"])
                rm_min, rm_max = _rooms_range(s["bedrooms"])
                by_state_district_property[state][district][pt] = {
                    "floor_area_sqft_min": fa_min,
                    "floor_area_sqft_max": fa_max,
                    "bedrooms_min": rm_min,
                    "bedrooms_max": rm_max,
                }

    out = {
        "options": options,
        "by_state_property": by_state_property,
        "by_state_district_property": by_state_district_property,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Saved {OUT_PATH}")


if __name__ == "__main__":
    main()
