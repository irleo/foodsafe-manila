"""Exercise the actual stdin entry point without importing Prophet or pandas."""
import ast
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


class ForecastOptionsTest(unittest.TestCase):
    def test_zero_backtests_is_not_replaced_by_default(self) -> None:
        source = Path(__file__).parents[1] / "services" / "prophet" / "forecast_monthly.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")
        module = ast.Module(body=[main], type_ignores=[])
        for payload, expected in [({"backtestMonths": 0}, 0), ({}, 19), ({"backtestMonths": 7}, 7)]:
            captured: list[int] = []

            def fake_forecast(series: list, horizon: int, backtests: int) -> dict:
                captured.append(backtests)
                return {"ok": True}

            namespace = {"sys": sys, "json": json, "run_forecast": fake_forecast}
            exec(compile(module, str(source), "exec"), namespace)
            with patch("sys.stdin", io.StringIO(json.dumps(payload))), patch("sys.stdout", io.StringIO()):
                namespace["main"]()
            self.assertEqual(captured, [expected])


if __name__ == "__main__":
    unittest.main()
