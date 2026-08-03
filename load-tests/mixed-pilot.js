import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authParams, requireAccessToken } from "./helpers.js";

const token = requireAccessToken();
const barangayNo = Number.parseInt(__ENV.BARANGAY_NO || "1", 10);

export const options = {
  scenarios: {
    mobileRisk: {
      executor: "ramping-vus",
      exec: "mobileRisk",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "2m", target: 100 },
        { duration: "30s", target: 0 },
      ],
    },
    adminDashboard: {
      executor: "constant-vus",
      exec: "adminDashboard",
      vus: 10,
      duration: "3m",
    },
    notifications: {
      executor: "constant-vus",
      exec: "notifications",
      vus: 10,
      duration: "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    "http_req_duration{name:GET /api/risk/nearby}": ["p(95)<1000"],
  },
};

export function mobileRisk() {
  const response = http.get(
    `${BASE_URL}/api/risk/nearby?barangayNo=${barangayNo}&months=6`,
    authParams(token, "GET /api/risk/nearby"),
  );
  check(response, { "nearby risk succeeds": (res) => res.status === 200 });
  sleep(45);
}

export function adminDashboard() {
  const response = http.get(
    `${BASE_URL}/api/dashboard`,
    authParams(token, "GET /api/dashboard"),
  );
  check(response, { "dashboard succeeds": (res) => res.status === 200 });
  sleep(10);
}

export function notifications() {
  const response = http.get(
    `${BASE_URL}/api/notifications?limit=20`,
    authParams(token, "GET /api/notifications"),
  );
  check(response, { "notifications succeed": (res) => res.status === 200 });
  sleep(60);
}
