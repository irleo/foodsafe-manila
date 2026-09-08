export function isTokenVersionCurrent(tokenVersion, storedTokenVersion) {
  return Number.isInteger(tokenVersion)
    && tokenVersion === (storedTokenVersion || 0);
}
