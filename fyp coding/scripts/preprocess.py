"""
Stage 1: Preprocess property dataset and aggregate by state and district x date.
Output: state_daily.csv, district_daily.csv for LSTM time series.
"""
import os
import pandas as pd
import numpy as np

# Paths: merged_high_quality_dataset.csv as the latest dataset
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_CSV = os.path.join(BASE_DIR, "merged_high_quality_dataset.csv")
OUT_CLEAN = os.path.join(DATA_DIR, "cleaned.csv")
OUT_STATE_DAILY = os.path.join(DATA_DIR, "state_daily.csv")
OUT_DISTRICT_DAILY = os.path.join(DATA_DIR, "district_daily.csv")

os.makedirs(DATA_DIR, exist_ok=True)


def main():
    print("Loading raw CSV...")
    df = pd.read_csv(RAW_CSV, na_values=["NULL", "null", ""])

    # 1. Drop irrelevant columns (source is optional, drop if present for consistent pipeline)
    drop_cols = ["agent_name", "full_address", "geo_query", "source"]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")

    # 2. area_text: fill NaN with district_text
    if "area_text" in df.columns and "district_text" in df.columns:
        df["area_text"] = df["area_text"].fillna(df["district_text"])

    # 3. Ensure numeric types
    numeric_cols = ["price", "bedrooms", "bathrooms", "floor_area_sqft", "land_area_sqft", "price_per_sqft_rm"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # 4. listing_date to datetime
    df["listing_date"] = pd.to_datetime(df["listing_date"], errors="coerce")

    # Drop rows with missing critical fields for aggregation
    df = df.dropna(subset=["listing_date", "price", "state"])
    df = df[df["price"] > 0]

    # Optional: fill numeric NaNs with median for rows we keep (for later use)
    for col in ["bedrooms", "bathrooms", "floor_area_sqft", "land_area_sqft"]:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())

    print(f"Cleaned rows: {len(df)}")
    df.to_csv(OUT_CLEAN, index=False)
    print(f"Saved {OUT_CLEAN}")

    # 5. Aggregate by state x date -> daily average price
    df["date"] = df["listing_date"].dt.date
    state_daily = df.groupby(["state", "date"], as_index=False).agg(
        avg_price=("price", "mean"),
        median_price=("price", "median"),
        count=("price", "count"),
    )
    state_daily.to_csv(OUT_STATE_DAILY, index=False)
    print(f"Saved {OUT_STATE_DAILY} (state x date)")

    # 6. Aggregate by state + district_text x date
    district_df = df.dropna(subset=["district_text"])
    district_daily = district_df.groupby(["state", "district_text", "date"], as_index=False).agg(
        avg_price=("price", "mean"),
        median_price=("price", "median"),
        count=("price", "count"),
    )
    district_daily.to_csv(OUT_DISTRICT_DAILY, index=False)
    print(f"Saved {OUT_DISTRICT_DAILY} (state x district x date)")

    print("Preprocessing done.")


if __name__ == "__main__":
    main()
