"""
Train a price estimator model: state, district, property_type, floor_area_sqft -> price.
Uses the same dataset as the map (merged_high_quality_dataset.csv).
Output: models/estimator_price.joblib (model + encoders + options for API).
"""
import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_CSV = os.path.join(BASE_DIR, "merged_high_quality_dataset.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# Target and features
TARGET = "price"
FEATURE_COLS = ["state", "district_text", "property_type", "floor_area_sqft"]
RIDGE_ALPHA = 10.0
TEST_SIZE = 0.15
RANDOM_STATE = 42


def main():
    print("Loading merged_high_quality_dataset.csv...")
    df = pd.read_csv(RAW_CSV, na_values=["NULL", "null", ""])
    df = df.dropna(subset=["state", "district_text", "price", "floor_area_sqft"])
    # Use property_type; fallback to property_type_group if missing
    if "property_type" not in df.columns or df["property_type"].isna().all():
        df["property_type"] = df.get("property_type_group", "Other")
    df["property_type"] = df["property_type"].fillna("Other").astype(str).str.strip()
    df = df[df["price"] > 0]
    df["floor_area_sqft"] = pd.to_numeric(df["floor_area_sqft"], errors="coerce")
    df = df.dropna(subset=["floor_area_sqft"])
    df = df[df["floor_area_sqft"] > 0]
    # Clip extreme prices for stability (optional)
    price_q99 = df["price"].quantile(0.99)
    df = df[df["price"] <= price_q99]
    print(f"Rows for training: {len(df)}")

    # Encode categoricals (fit on full set so API can use same encoders)
    encoders = {}
    X = df[FEATURE_COLS].copy()
    y_raw = df[TARGET].values
    y = np.log1p(y_raw)  # log(1+price) for better scale, predict then expm1

    for col in ["state", "district_text", "property_type"]:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        encoders[col] = le

    # Train/test split (stratify by state for balance)
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=df["state"]
        )
    except ValueError:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
        )
    model = Ridge(alpha=RIDGE_ALPHA, random_state=RANDOM_STATE)
    model.fit(X_train, y_train)
    y_pred_log = model.predict(X_test)
    y_pred = np.expm1(y_pred_log)
    y_test_use = np.expm1(y_test)
    mae = mean_absolute_error(y_test_use, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test_use, y_pred))
    mape = np.mean(np.abs((y_test_use - y_pred) / np.maximum(y_test_use, 1))) * 100
    print(f"Estimator — MAE: {mae:.0f}, RMSE: {rmse:.0f}, MAPE: {mape:.1f}%")

    # Save model + encoders + option lists for API dropdowns
    options = {
        "states": sorted(df["state"].astype(str).unique().tolist()),
        "property_types": sorted(df["property_type"].unique().tolist()),
    }
    # Districts per state for dropdown
    dist_by_state = df.groupby("state")["district_text"].apply(lambda x: sorted(x.astype(str).unique().tolist())).to_dict()
    options["districts_by_state"] = {str(k): v for k, v in dist_by_state.items()}

    artifact = {
        "model": model,
        "encoders": encoders,
        "feature_cols": FEATURE_COLS,
        "options": options,
        "use_log_target": True,
        "metrics": {"mae": float(mae), "rmse": float(rmse), "mape_pct": float(mape)},
    }
    out_path = os.path.join(MODELS_DIR, "estimator_price.joblib")
    joblib.dump(artifact, out_path)
    print(f"Saved {out_path}")
    print("Done.")


if __name__ == "__main__":
    main()
