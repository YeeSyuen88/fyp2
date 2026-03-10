# How to Make Predicted Price More Accurate

## 1. Understand the evaluation metrics

After running `python scripts/train_lstm.py`, check the console and `output/accuracy_metrics.json`:

| Metric | Meaning | What to aim for |
|--------|--------|------------------|
| **RMSE** | Root Mean Squared Error (in RM). Large errors penalised more. | Lower = better. Compare with your price scale (e.g. RM 500K → RMSE &lt; 100K is reasonable). |
| **MAE** | Mean Absolute Error (in RM). Average error per prediction. | Lower = better. Easier to interpret than RMSE. |
| **MAPE** | Mean Absolute Percentage Error (%). | &lt; 10% is good; &lt; 20% often acceptable for property. |
| **Baseline (last value)** | Naive forecast: “next price = last known price”. | Your model should have **lower** MAE/MAPE than baseline; otherwise the model is not adding value. |

If the model does not beat the baseline, try more data, more features, or a different model (see below).

---

## 2. Use more and better data

- **Longer history**: Right now you have ~31 days. With 6–12 months of daily (or weekly) data, the model can learn real trends and seasonality.
- **Quality**: Remove obvious outliers (e.g. typos in price), and treat missing days (e.g. forward-fill or aggregate by week).
- **Aggregation**: If daily data is noisy, aggregate to **weekly** or **monthly** average per area and predict the next week/month. This often stabilises the model.

---

## 3. Improve the model

- **Temporal split**: The script now uses a **time-based** test set (last 20% of each area’s timeline). Do **not** use a random split for time series.
- **Hyperparameters**: In `scripts/train_lstm.py` you can try:
  - `LOOKBACK = 14` (use 2 weeks of history)
  - `MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=500)`
- **Real LSTM**: If you can install TensorFlow (e.g. after enabling Windows long paths), use a proper LSTM/GRU for sequence modelling; it often does better on time series than a simple MLP on flattened windows.
- **Ensemble**: Train multiple models (e.g. different random seeds or lookbacks) and average their predictions.

---

## 4. Sanity checks

- **Range**: Predicted price should be in a plausible range (e.g. not negative, not 10× the current price unless the area is very volatile).
- **Trend**: If the trend graph shows a clear direction, the 1‑month prediction should be roughly in line with that direction.
- **Compare areas**: Similar areas (e.g. neighbouring districts) should not have wildly different prediction behaviour unless the data supports it.

---

## 5. Document for your report

- Report **RMSE, MAE, MAPE** and state that the model is compared to a **naive baseline** (last value).
- Mention that accuracy is limited by **short history** (31 days) and that **longer data** would improve reliability.
- If you add more data or change the model, re-run the script and update `output/accuracy_metrics.json` and your report numbers.
