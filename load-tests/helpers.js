export const BASE_URL = (__ENV.BASE_URL || "http://localhost:5000").replace(
  /\/$/,
  "",
);

const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(
  BASE_URL,
);

if (!isLocalTarget && __ENV.ALLOW_REMOTE_LOAD_TEST !== "true") {
  throw new Error(
    "Remote load tests are disabled. Set ALLOW_REMOTE_LOAD_TEST=true only after confirming the target and authorization.",
  );
}

export function requireAccessToken() {
  const token = __ENV.ACCESS_TOKEN;
  if (!token) {
    throw new Error("ACCESS_TOKEN is required for protected FoodSafe endpoints.");
  }
  return token;
}

export function authParams(token, name) {
  return {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name },
  };
}

export const DEFAULT_THRESHOLDS = {
  http_req_failed: ["rate<0.01"],
  http_req_duration: ["p(95)<2000"],
};
