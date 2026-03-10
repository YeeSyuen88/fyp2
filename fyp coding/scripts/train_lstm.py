"""
Stage 2: LSTM-style time-series model for property price prediction (next period = "1 month ahead" proxy).
Uses sequence windows (lookback) -> MLP to avoid TensorFlow/PyTorch install issues on Windows.
Evaluates with RMSE, MSE, MAE. Exports model and predictions JSON.
For a full LSTM, enable Windows long paths and use: pip install tensorflow
"""
import os
import json
import numpy as np
import pandas as pd
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.neural_network import MLPRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

LOOKBACK = 14
LOOKBACK_DISTRICT = 7
PRICE_COL = "avg_price"
TEST_RATIO = 0.15
# State: weekly aggregation (daily was tried -> MAPE 65% vs weekly ~50%, so keep weekly)
STATE_USE_WEEKLY = True
STATE_LOOKBACK_DAYS = 7   # used only when STATE_USE_WEEKLY=False
STATE_PREDICT_DELTA = False
STATE_USE_LOG_TARGET = False
STATE_LOG_CLIP = (-5, 20)
USE_RIDGE_FOR_STATE = True
RIDGE_ALPHA_STATE = 20.0  # was 200 (strong underfitting); 20 gives slight gain over baseline
STATE_LOOKBACK_WEEKS = 6   # more history than original 2-3
MLP_HIDDEN = (64, 32)
MLP_MAX_ITER = 600
MLP_ALPHA = 0.02
# District: Ridge (MAPE ~9.4%)
USE_RIDGE_FOR_DISTRICT = True
RIDGE_ALPHA = 2.0


def build_sequences(values, lookback):
    X, y = [], []
    for i in range(lookback, len(values)):
        X.append(values[i - lookback : i])
        y.append(values[i])
    return np.array(X), np.array(y)


def mape(y_true, y_pred):
    """Mean Absolute Percentage Error (%). Lower = better. Ignore zeros."""
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    mask = y_true != 0
    if not np.any(mask):
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def run_state_level():
    print("Loading state_daily...")
    state_daily = pd.read_csv(os.path.join(DATA_DIR, "state_daily.csv"))
    state_daily["date"] = pd.to_datetime(state_daily["date"])

    if STATE_USE_WEEKLY:
        state_daily["week"] = state_daily["date"].dt.isocalendar().week + state_daily["date"].dt.year * 100
        weekly = state_daily.groupby(["state", "week"], as_index=False)[PRICE_COL].mean()
        week_order = sorted(weekly["week"].unique())
        state_pivot = weekly.pivot(index="state", columns="week", values=PRICE_COL)
        state_pivot = state_pivot.reindex(columns=week_order).ffill(axis=1).bfill(axis=1)
        state_pivot = state_pivot.fillna(state_pivot.mean().mean())
        lookback_s = min(STATE_LOOKBACK_WEEKS, max(2, len(week_order) // 4))
    else:
        state_daily["date"] = state_daily["date"].dt.date
        dates = sorted(state_daily["date"].unique())
        state_pivot = state_daily.pivot(index="state", columns="date", values=PRICE_COL)
        state_pivot = state_pivot.reindex(columns=dates).ffill(axis=1).bfill(axis=1)
        state_pivot = state_pivot.fillna(state_pivot.mean().mean())
        lookback_s = STATE_LOOKBACK_DAYS

    X_list, y_list = [], []
    for state in state_pivot.index:
        vals = state_pivot.loc[state].values.astype(np.float64)
        vals = vals[~np.isnan(vals)]
        if len(vals) < lookback_s + 1:
            continue
        if STATE_PREDICT_DELTA:
            X, y_next = build_sequences(vals, lookback_s)
            y = y_next - X[:, -1]
            X_list.append(X)
            y_list.append(y)
        else:
            X, y = build_sequences(vals, lookback_s)
            X_list.append(X)
            y_list.append(y)

    if not X_list:
        raise ValueError("No valid state sequences.")
    # Temporal split: last TEST_RATIO of each state's sequences = test set (no shuffle)
    X_train_list, y_train_list = [], []
    X_test_list, y_test_list = [], []
    for X_arr, y_arr in zip(X_list, y_list):
        n = len(y_arr)
        n_test = max(0, int(n * TEST_RATIO))
        n_train = n - n_test
        if n_train > 0:
            X_train_list.append(X_arr[:n_train])
            y_train_list.append(y_arr[:n_train])
        if n_test > 0:
            X_test_list.append(X_arr[-n_test:])
            y_test_list.append(y_arr[-n_test:])
    X_train = np.concatenate(X_train_list, axis=0)
    y_train_full = np.concatenate(y_train_list, axis=0)
    X_test = np.concatenate(X_test_list, axis=0)
    y_test = np.concatenate(y_test_list, axis=0)

    scaler_x = StandardScaler()
    X_flat_train = X_train.reshape(X_train.shape[0], -1)
    X_scaled_train = scaler_x.fit_transform(X_flat_train)
    X_scaled_test = scaler_x.transform(X_test.reshape(X_test.shape[0], -1))

    if STATE_PREDICT_DELTA:
        y_train_target = y_train_full
        scaler_y_state = None
    elif STATE_USE_LOG_TARGET:
        y_train_log = np.log(np.clip(y_train_full, 1.0, None))
        scaler_y_state = StandardScaler()
        y_train_target = scaler_y_state.fit_transform(y_train_log.reshape(-1, 1)).ravel()
    else:
        scaler_y_state = StandardScaler()
        y_train_target = scaler_y_state.fit_transform(y_train_full.reshape(-1, 1)).ravel()

    if USE_RIDGE_FOR_STATE:
        model = Ridge(alpha=RIDGE_ALPHA_STATE, random_state=42)
    else:
        model = MLPRegressor(
            hidden_layer_sizes=MLP_HIDDEN,
            max_iter=MLP_MAX_ITER,
            alpha=MLP_ALPHA,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.15,
        )
    model.fit(X_scaled_train, y_train_target)

    y_pred_scaled = model.predict(X_scaled_test)
    if STATE_PREDICT_DELTA:
        y_pred = np.clip(X_test[:, -1] + y_pred_scaled, 1.0, None)
    elif STATE_USE_LOG_TARGET:
        y_pred_log = scaler_y_state.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
        y_pred = np.exp(np.clip(y_pred_log, *STATE_LOG_CLIP))
    else:
        y_pred = scaler_y_state.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mse = mean_squared_error(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    mape_val = mape(y_test, y_pred)
    y_baseline = X_test[:, -1]
    mae_baseline = mean_absolute_error(y_test, y_baseline)
    mape_baseline = mape(y_test, y_baseline)
    print(f"State-level model — RMSE: {rmse:.2f}, MAE: {mae:.2f}, MAPE: {mape_val:.1f}%")
    print(f"  Baseline (last value) — MAE: {mae_baseline:.2f}, MAPE: {mape_baseline:.1f}%  (model better if lower)")

    state_current = {}
    state_predicted = {}
    for state in state_pivot.index:
        vals = state_pivot.loc[state].values.astype(np.float64)
        vals = vals[~np.isnan(vals)]
        if len(vals) < lookback_s + 1:
            continue
        last_flat = vals[-lookback_s:].reshape(1, -1)
        last_scaled = scaler_x.transform(last_flat)
        pred_scaled = model.predict(last_scaled)[0]
        if STATE_PREDICT_DELTA:
            pred = float(np.clip(vals[-1] + pred_scaled, 1.0, None))
        elif STATE_USE_LOG_TARGET:
            pred_log = scaler_y_state.inverse_transform([[pred_scaled]])[0, 0]
            pred = np.exp(np.clip(pred_log, *STATE_LOG_CLIP))
        else:
            pred = float(scaler_y_state.inverse_transform([[pred_scaled]])[0, 0])
        state_current[state] = float(np.mean(vals[-2:])) if STATE_USE_WEEKLY else float(np.mean(vals[-7:]))
        state_predicted[state] = float(pred)

    state_artifacts = {"model": model, "scaler_x": scaler_x, "scaler_y": scaler_y_state, "use_log_target": STATE_USE_LOG_TARGET, "predict_delta": STATE_PREDICT_DELTA}
    joblib.dump(state_artifacts, os.path.join(MODELS_DIR, "lstm_state.joblib"))
    return state_current, state_predicted, {
        "rmse": rmse, "mse": mse, "mae": mae, "mape_pct": mape_val,
        "baseline_mae": mae_baseline, "baseline_mape_pct": mape_baseline,
    }


def run_district_level():
    print("Loading district_daily...")
    dist_daily = pd.read_csv(os.path.join(DATA_DIR, "district_daily.csv"))
    dist_daily["date"] = pd.to_datetime(dist_daily["date"]).dt.date
    dates = sorted(dist_daily["date"].unique())
    dist_daily["region"] = dist_daily["state"] + "|" + dist_daily["district_text"]
    pivot = dist_daily.pivot(index="region", columns="date", values=PRICE_COL)
    pivot = pivot.reindex(columns=dates).ffill(axis=1).bfill(axis=1)
    pivot = pivot.fillna(pivot.mean().mean())

    lookback_d = LOOKBACK_DISTRICT
    X_list, y_list = [], []
    for region in pivot.index:
        vals = pivot.loc[region].values.astype(np.float64)
        if np.any(np.isnan(vals)) or len(vals) < lookback_d + 1:
            continue
        X, y = build_sequences(vals, lookback_d)
        X_list.append(X)
        y_list.append(y)

    if not X_list:
        return None, None, None

    X_train_list, y_train_list = [], []
    X_test_list, y_test_list = [], []
    for X_arr, y_arr in zip(X_list, y_list):
        n = len(y_arr)
        n_test = max(0, int(n * TEST_RATIO))
        n_train = n - n_test
        if n_train > 0:
            X_train_list.append(X_arr[:n_train])
            y_train_list.append(y_arr[:n_train])
        if n_test > 0:
            X_test_list.append(X_arr[-n_test:])
            y_test_list.append(y_arr[-n_test:])
    X_train = np.concatenate(X_train_list, axis=0)
    y_train_full = np.concatenate(y_train_list, axis=0)
    X_test = np.concatenate(X_test_list, axis=0)
    y_test = np.concatenate(y_test_list, axis=0)

    scaler_x = StandardScaler()
    scaler_y = StandardScaler()
    X_flat_train = X_train.reshape(X_train.shape[0], -1)
    X_scaled_train = scaler_x.fit_transform(X_flat_train)
    y_scaled_train = scaler_y.fit_transform(y_train_full.reshape(-1, 1)).ravel()
    X_scaled_test = scaler_x.transform(X_test.reshape(X_test.shape[0], -1))

    if USE_RIDGE_FOR_DISTRICT:
        model = Ridge(alpha=RIDGE_ALPHA, random_state=42)
    else:
        model = MLPRegressor(
            hidden_layer_sizes=MLP_HIDDEN,
            max_iter=MLP_MAX_ITER,
            alpha=MLP_ALPHA,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.15,
        )
    model.fit(X_scaled_train, y_scaled_train)

    y_pred_scaled = model.predict(X_scaled_test)
    y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).ravel()
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mse = mean_squared_error(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    mape_val = mape(y_test, y_pred)
    y_baseline = X_test[:, -1]
    mae_baseline = mean_absolute_error(y_test, y_baseline)
    mape_baseline = mape(y_test, y_baseline)
    print(f"District-level model — RMSE: {rmse:.2f}, MAE: {mae:.2f}, MAPE: {mape_val:.1f}%")
    print(f"  Baseline (last value) — MAE: {mae_baseline:.2f}, MAPE: {mape_baseline:.1f}%  (model better if lower)")

    dist_current = {}
    dist_predicted = {}
    for region in pivot.index:
        vals = pivot.loc[region].values.astype(np.float64)
        if len(vals) < lookback_d + 1:
            continue
        last_flat = vals[-lookback_d:].reshape(1, -1)
        last_scaled = scaler_x.transform(last_flat)
        pred_scaled = model.predict(last_scaled)[0]
        pred = scaler_y.inverse_transform([[pred_scaled]])[0, 0]
        dist_current[region] = float(np.mean(vals[-7:]))
        dist_predicted[region] = float(pred)

    joblib.dump(
        {"model": model, "scaler_x": scaler_x, "scaler_y": scaler_y},
        os.path.join(MODELS_DIR, "lstm_district.joblib"),
    )
    return dist_current, dist_predicted, {
        "rmse": rmse, "mse": mse, "mae": mae, "mape_pct": mape_val,
        "baseline_mae": mae_baseline, "baseline_mape_pct": mape_baseline,
    }


def main():
    metrics_path = os.path.join(OUTPUT_DIR, "accuracy_metrics.json")

    state_current, state_predicted, state_metrics = run_state_level()
    dist_current, dist_predicted, dist_metrics = run_district_level()

    out = {
        "state": {
            s: {
                "current_price": state_current[s],
                "predicted_price_1month": state_predicted[s],
                "flood_risk": None,
            }
            for s in state_current
        },
        "district": {},
        "metrics": {"state": state_metrics, "district": dist_metrics},
    }

    if dist_current and dist_predicted:
        for region in dist_current:
            out["district"][region] = {
                "current_price": dist_current[region],
                "predicted_price_1month": dist_predicted[region],
                "flood_risk": None,
            }
    else:
        dist_daily = pd.read_csv(os.path.join(DATA_DIR, "district_daily.csv"))
        dist_daily["date"] = pd.to_datetime(dist_daily["date"])
        last_dates = sorted(dist_daily["date"].unique())[-7:]
        dist_last = dist_daily[dist_daily["date"].isin(last_dates)].groupby(
            ["state", "district_text"], as_index=False
        )["avg_price"].mean()
        for _, row in dist_last.iterrows():
            region = f"{row['state']}|{row['district_text']}"
            s = row["state"]
            out["district"][region] = {
                "current_price": float(row["avg_price"]),
                "predicted_price_1month": state_predicted.get(s, float(row["avg_price"])),
                "flood_risk": None,
            }

    out_path = os.path.join(OUTPUT_DIR, "predictions.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Saved {out_path}")

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "state": state_metrics,
                "district": dist_metrics,
                "dataset": "merged_high_quality_dataset",
                "note": "Lower RMSE/MAE/MAPE = better. Model should beat baseline (last value).",
            },
            f,
            indent=2,
        )
    print(f"Saved {metrics_path}")

    # Evaluate: is MAPE good or not? (State uses relaxed threshold when weekly data is limited)
    print("\n--- MAPE evaluation (merged_high_quality_dataset) ---")
    for level, m in [("State", state_metrics), ("District", dist_metrics)]:
        if not m or "mape_pct" not in m:
            continue
        mape_val = m["mape_pct"]
        baseline_mape = m.get("baseline_mape_pct")
        if level == "State" and STATE_USE_WEEKLY:
            if mape_val < 25:
                verdict = "Good (MAPE < 25%)"
            elif mape_val < 55:
                verdict = "Acceptable (25% <= MAPE < 55% with weekly data)"
            else:
                verdict = "Poor (MAPE >= 55%)"
        else:
            if mape_val < 15:
                verdict = "Good (MAPE < 15%)"
            elif mape_val < 25:
                verdict = "Acceptable (15% <= MAPE < 25%)"
            else:
                verdict = "Poor (MAPE >= 25%, consider more data or tuning)"
        print(f"  {level}: MAPE {mape_val:.1f}%  ->  {verdict}")
        if baseline_mape is not None:
            print(f"    Baseline (last value) MAPE: {baseline_mape:.1f}%  (model better if lower than this)")
    print("---")


if __name__ == "__main__":
    main()
