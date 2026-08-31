import jwt from "jsonwebtoken";

export function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;

  throw new Error("Invalid Philippine mobile number");
}

export function sanitizeMobileUser(mobileUser) {
  const obj =
    typeof mobileUser?.toObject === "function"
      ? mobileUser.toObject()
      : mobileUser;
  const id = String(obj._id);
  return {
    _id: id,
    id,
    username: obj.username,
    phoneNumber: obj.phoneNumber,
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
