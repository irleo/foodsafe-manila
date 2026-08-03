import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, DEFAULT_THRESHOLDS } from "./helpers.js";

export const options = {
  stages: [
    { duration: "15s", target: 10 },
    { duration: "30s", target: 10 },
    { duration: "15s", target: 0 },
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
  const response = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "GET /api/health" },
  });
  check(response, { "health returns 200": (res) => res.status === 200 });
  sleep(1);
}
