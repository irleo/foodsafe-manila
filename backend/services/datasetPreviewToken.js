import { createHash } from "crypto";
import jwt from "jsonwebtoken";

/** Bind confirmation to the exact bytes, metadata, and authenticated uploader.
 * @param {Buffer} buffer @param {Record<string, unknown>} metadata @param {unknown} userId
 */
export function previewFingerprint(buffer, metadata, userId) {
  return createHash("sha256").update(buffer).update(JSON.stringify([
    String(userId), metadata.name, "weekly",
    metadata.coverageStart, metadata.coverageEnd, metadata.coverageVerified,
  ])).digest("hex");
}
/** @param {string} fingerprint @returns {string} */
export function issuePreviewToken(fingerprint) {
  return jwt.sign({ purpose: "dataset_preview", fingerprint }, process.env.ACCESS_TOKEN_SECRET, { algorithm: "HS256", expiresIn: "15m" });
}
/** @param {unknown} token @param {string} fingerprint @returns {boolean} */
export function verifyPreviewToken(token, fingerprint) {
  try {
    if (typeof token !== "string") return false;
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, { algorithms: ["HS256"] });
    return typeof payload !== "string" && payload.purpose === "dataset_preview" && payload.fingerprint === fingerprint;
  } catch (error) {
    // Invalid and expired confirmations are expected client errors.
    return false;
  }
}
