"""Regression checks use synthetic counts and stub fits, never real Prophet jobs."""
from __future__ import annotations

import ast
from pathlib import Path
from typing import Any
import unittest

import pandas as pd


class ForecastAlignmentTest(unittest.TestCase):
    def run_series(self, gap: bool, wrong_date: bool = False) -> dict[str, Any]:
        source = Path(__file__).parents[1] / "services/prophet/forecast_monthly.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)
                     and node.name in {"run_forecast", "_to_ds"}]

        def fake_fit(frame: pd.DataFrame, periods: int) -> pd.DataFrame:
            offset = 2 if wrong_date else 1
            start = frame["ds"].max() + pd.offsets.MonthBegin(offset)
            return pd.DataFrame({"ds": pd.date_range(start, periods=periods, freq="MS"),
                                 "yhat": [5.25] * periods,
                                 "yhat_lower": [2] * periods,
                                 "yhat_upper": [9] * periods})

        namespace: dict[str, Any] = {"pd": pd, "MIN_TRAINING_MONTHS": 24,
                                     "_fit_predict": fake_fit}
        exec(compile(ast.Module(body=functions, type_ignores=[]), str(source), "exec"), namespace)
        dates = list(pd.date_range("2022-01-01", periods=26, freq="MS"))
        if gap:
            dates[24:] = list(pd.date_range("2024-03-01", periods=2, freq="MS"))
        series = [{"year": date.year, "month": date.month, "y": 5} for date in dates]
        return namespace["run_forecast"](series, 1, 19)

    def test_continuous_series_scores_both_targets(self) -> None:
        result = self.run_series(False)
        self.assertEqual([(row["year"], row["month"]) for row in result["backtest"]],
                         [(2024, 1), (2024, 2)])

    def test_gap_target_is_not_relabelled_and_next_month_is_scored(self) -> None:
        result = self.run_series(True)
        self.assertEqual([(row["year"], row["month"]) for row in result["backtest"]],
                         [(2024, 4)])

    def test_unexpected_prediction_date_fails_closed(self) -> None:
        with self.assertRaisesRegex(ValueError, "backtest_target_date_mismatch"):
            self.run_series(False, wrong_date=True)


if __name__ == "__main__":
    unittest.main()
