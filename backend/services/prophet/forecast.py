"""
Prophet yearly forecast for case counts.
Reads JSON from stdin: { "series": [ { "year": int, "y": float }, ... ] }
Writes JSON to stdout: { "ok": true, "compareRows": [...], "nextForecast": {...}, "metrics": { mape, rmse } }
"""

from __future__ import annotations

import json
import logging
import sys
import traceback

import numpy as np

logging.getLogger("cmdstanpy").setLevel(logging.ERROR)
logging.getLogger("prophet").setLevel(logging.ERROR)
import pandas as pd

try:
    from prophet import Prophet
except ImportError as e:
    print(
        json.dumps(
            {
                "ok": False,
                "error": "prophet_import_failed",
                "detail": str(e),
            }
        ),
        flush=True,
    )
    sys.exit(1)


def _to_ds(year: int) -> pd.Timestamp:
    return pd.Timestamp(f"{int(year)}-01-01")


def _fit_predict_one(train_rows: list[dict], target_year: int) -> tuple[float, float, float]:
    """Train on years strictly before target_year; predict target_year."""
    ds = _to_ds(target_year)
    train = [r for r in train_rows if int(r["year"]) < target_year]
    if len(train) < 2:
        last = float(train[-1]["y"]) if train else 0.0
        return last, last, last

    train_df = pd.DataFrame(
        {
            "ds": [_to_ds(int(r["year"])) for r in train],
            "y": [float(r["y"]) for r in train],
        }
    )

    m = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="additive",
    )
    m.fit(train_df)
    future = pd.DataFrame({"ds": [ds]})
    fcst = m.predict(future)
    return (
        float(fcst["yhat"].iloc[0]),
        float(fcst["yhat_lower"].iloc[0]),
        float(fcst["yhat_upper"].iloc[0]),
    )


def _next_horizon(full_rows: list[dict]) -> tuple[int, float, float, float]:
    """Train on all years; forecast the next calendar year after the max year."""
    if not full_rows:
        raise ValueError("empty_series")

    years = sorted(int(r["year"]) for r in full_rows)
    max_y = years[-1]
    target_year = max_y + 1

    if len(full_rows) < 2:
        last = float(full_rows[-1]["y"])
        return target_year, last, last, last

    train_df = pd.DataFrame(
        {
            "ds": [_to_ds(int(r["year"])) for r in full_rows],
            "y": [float(r["y"]) for r in full_rows],
        }
    )
    m = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="additive",
    )
    m.fit(train_df)
    future = pd.DataFrame({"ds": [_to_ds(target_year)]})
    fcst = m.predict(future)
    return (
        target_year,
        float(fcst["yhat"].iloc[0]),
        float(fcst["yhat_lower"].iloc[0]),
        float(fcst["yhat_upper"].iloc[0]),
    )


def _mape_rmse(actual: np.ndarray, pred: np.ndarray) -> tuple[float | None, float]:
    err = pred - actual
    rmse = float(np.sqrt(np.mean(err**2)))
    mask = actual > 0
    if not np.any(mask):
        return None, rmse
    mape = float(np.mean(np.abs((actual[mask] - pred[mask]) / actual[mask])) * 100.0)
    return mape, rmse


def run_forecast(series: list) -> dict:
    rows = []
    for r in series or []:
        y = int(r.get("year"))
        v = float(r.get("y", 0))
        rows.append({"year": y, "y": v})
    rows.sort(key=lambda x: x["year"])

    if len(rows) < 2:
        raise ValueError("need_at_least_two_years")

    compare_rows = []
    metric_actual = []
    metric_pred = []
    for r in rows:
        year = int(r["year"])
        actual = float(r["y"])
        train_n = len([x for x in rows if int(x["year"]) < year])
        if train_n == 0:
            a = round(actual)
            row = {
                "year": year,
                "actual": a,
                "predicted": a,
                "lower": a,
                "upper": a,
                "backtestable": False,
            }
            compare_rows.append(row)
            continue

        pred, lo, hi = _fit_predict_one(rows, year)
        row = {
            "year": year,
            "actual": round(actual),
            "predicted": max(0.0, round(pred)),
            "lower": max(0.0, round(lo)),
            "upper": max(0.0, round(hi)),
            "backtestable": train_n >= 2,
        }
        compare_rows.append(row)
        if train_n >= 2:
            metric_actual.append(actual)
            metric_pred.append(max(0.0, pred))

    actual_arr = np.array(metric_actual, dtype=float)
    pred_arr = np.array(metric_pred, dtype=float)
    if len(metric_actual):
        mape, rmse = _mape_rmse(actual_arr, pred_arr)
    else:
        mape, rmse = None, 0.0

    ty, ny, nlo, nhi = _next_horizon(rows)

    return {
        "ok": True,
        "compareRows": compare_rows,
        "nextForecast": {
            "targetYear": ty,
            "predicted": max(0, round(ny)),
            "lower": max(0, round(nlo)),
            "upper": max(0, round(nhi)),
            "basisYear": int(rows[-1]["year"]),
        },
        "metrics": {
            "mape": None if mape is None else round(mape, 2),
            "rmse": round(rmse, 2),
        },
    }


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        series = payload.get("series") or []
        out = run_forecast(series)
        print(json.dumps(out), flush=True)
    except Exception as e:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(e),
                    "trace": traceback.format_exc(),
                }
            ),
            flush=True,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
