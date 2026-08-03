import http from "k6/http";
import { check, sleep } from "k6";
import {
  BASE_URL,
  DEFAULT_THRESHOLDS,
  authParams,
  requireAccessToken,
} from "./helpers.js";

const token = requireAccessToken();

export const options = {
  stages: [
    { duration: "20s", target: 25 },
    { duration: "40s", target: 50 },
    { duration: "20s", target: 0 },
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
  const response = http.get(
    `${BASE_URL}/api/dashboard`,
    authParams(token, "GET /api/dashboard"),
  );
  check(response, { "dashboard returns 200": (res) => res.status === 200 });
  sleep(5);
}
