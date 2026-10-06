import jwt from "jsonwebtoken";

/** @param {unknown} error @returns {boolean} */
export function isDuplicateCitizenPhone(error) {
  const value = /** @type {{code?: number, keyPattern?: Record<string, unknown>, keyValue?: Record<string, unknown>, message?: string}} */ (error);
  return value?.code === 11000 && (value.keyPattern?.phoneNumber === 1
    || Object.hasOwn(value.keyValue || {}, "phoneNumber")
    || value.message?.includes("mobileUsersPhoneNumberUnique") === true);
}

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
    emailVerified: obj.emailVerified === true,
    emailVerifiedAt: obj.emailVerifiedAt || null,
    role: "citizen",
    accountType: "citizen",
    policyAcceptance: obj.policyAcceptance || null,
  };
}

export function signCitizenTokens(userId, tokenVersion = 0) {
  const payload = {
    id: String(userId),
    role: "citizen",
    accountType: "citizen",
    tokenVersion,
  };

  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
}
