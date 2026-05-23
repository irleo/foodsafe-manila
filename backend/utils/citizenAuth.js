import jwt from "jsonwebtoken";

export function normalizePhone(phone) {
  return String(phone || "").replaceAll(" ", "").trim();
}

export function sanitizeCitizenUser(user) {
  const obj = typeof user?.toObject === "function" ? user.toObject() : user;
  const id = String(obj._id);
  return {
    _id: id,
    id,
    username: obj.username,
    phone_number: obj.phone_number,
    email: obj.email || "",
    role: "citizen",
    accountType: "citizen",
  };
}

export function signCitizenTokens(userId) {
  const payload = {
    id: String(userId),
    role: "citizen",
    accountType: "citizen",
  };

  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
}
