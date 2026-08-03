import http from "k6/http";
import { check, sleep } from "k6";
import {
  BASE_URL,
  DEFAULT_THRESHOLDS,
  authParams,
  requireAccessToken,
} from "./helpers.js";

const token = requireAccessToken();
const barangayNo = Number.parseInt(__ENV.BARANGAY_NO || "1", 10);

export const options = {
  stages: [
    { duration: "30s", target: 25 },
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
  const response = http.get(
    `${BASE_URL}/api/risk/nearby?barangayNo=${barangayNo}&months=6`,
    authParams(token, "GET /api/risk/nearby"),
  );
  check(response, {
    "nearby risk returns 200": (res) => res.status === 200,
    "nearby risk is JSON": (res) =>
      String(res.headers["Content-Type"] || "").includes("application/json"),
  });

  // Mirrors the current mobile risk-monitor interval.
  sleep(45);
}
