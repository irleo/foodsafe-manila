"""
Prophet monthly forecast for case counts.

stdin JSON:
{
  "series": [ { "year": 2025, "month": 1, "y": 12 }, ... ],
  "horizonMonths": 3
}

stdout JSON:
{
  "ok": true,
  "backtest": [
    { "year": 2025, "month": 4, "actualCases": 8, "predictedCases": 7, "lowerBound": 4, "upperBound": 10 },
    ...
  ],
  "forecast": [
    { "year": 2026, "month": 5, "predictedCases": 10, "lowerBound": 7, "upperBound": 14, "isPrimaryTarget": true },
    ...
  ]
}
"""

from __future__ import annotations

import json
import logging
import sys
import traceback

import pandas as pd

logging.basicConfig(level=logging.ERROR)
logging.getLogger("cmdstanpy").setLevel(logging.ERROR)
logging.getLogger("cmdstanpy").propagate = False
logging.getLogger("prophet").setLevel(logging.ERROR)
logging.getLogger("prophet").propagate = False

try:
    from prophet import Prophet
except ImportError as e:
    print(
        json.dumps({"ok": False, "error": "prophet_import_failed", "detail": str(e)}),
        flush=True,
    )
    sys.exit(1)


def _to_ds(year: int, month: int) -> pd.Timestamp:
    return pd.Timestamp(f"{int(year)}-{int(month):02d}-01")


def _make_model() -> Prophet:
    # Monthly buckets can have public-health seasonality, but not daily/weekly cycles.
    return Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="additive",
    )


def _fit_predict(train_df: pd.DataFrame, periods: int) -> pd.DataFrame:
    model = _make_model()
    model.fit(train_df)
    future = model.make_future_dataframe(periods=int(periods), freq="MS", include_history=False)
    return model.predict(future)


def run_forecast(series: list, horizon_months: int) -> dict:
    rows = []
    for r in series or []:
        y = int(r.get("year"))
        m = int(r.get("month"))
        v = float(r.get("y", 0))
        rows.append({"year": y, "month": m, "y": v})
    rows.sort(key=lambda x: (x["year"], x["month"]))

    if len(rows) < 3:
        raise ValueError("need_at_least_three_months")
    if horizon_months < 1 or horizon_months > 36:
        raise ValueError("invalid_horizonMonths")

    train_df = pd.DataFrame(
        {
            "ds": [_to_ds(int(r["year"]), int(r["month"])) for r in rows],
            "y": [float(r["y"]) for r in rows],
        }
    )

    backtest = []
    backtest_start = max(3, len(rows) - 12)
    for i in range(backtest_start, len(rows)):
        rolling_train_df = pd.DataFrame(
            {
                "ds": [_to_ds(int(r["year"]), int(r["month"])) for r in rows[:i]],
                "y": [float(r["y"]) for r in rows[:i]],
            }
        )
        one_step = _fit_predict(rolling_train_df, 1)
        target = rows[i]
        backtest.append(
            {
                "year": int(target["year"]),
                "month": int(target["month"]),
                "actualCases": max(0, int(round(float(target["y"])))),
                "predictedCases": max(0, int(round(float(one_step["yhat"].iloc[0])))),
                "lowerBound": max(0, int(round(float(one_step["yhat_lower"].iloc[0])))),
                "upperBound": max(0, int(round(float(one_step["yhat_upper"].iloc[0])))),
            }
        )

    fcst = _fit_predict(train_df, horizon_months)

    out = []
    for i in range(len(fcst)):
        ds = pd.Timestamp(fcst["ds"].iloc[i])
        out.append(
            {
                "year": int(ds.year),
                "month": int(ds.month),
                "predictedCases": max(0, int(round(float(fcst["yhat"].iloc[i])))),
                "lowerBound": max(0, int(round(float(fcst["yhat_lower"].iloc[i])))),
                "upperBound": max(0, int(round(float(fcst["yhat_upper"].iloc[i])))),
                "isPrimaryTarget": i == 0,
            }
        )

    return {"ok": True, "backtest": backtest, "forecast": out}


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        series = payload.get("series") or []
        horizon = int(payload.get("horizonMonths") or 1)
        out = run_forecast(series, horizon)
        print(json.dumps(out), flush=True)
    except Exception as e:
        print(
            json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()}),
            flush=True,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()

