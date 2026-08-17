const STATUS_LABEL_OVERRIDES = {
  validated_confirmed: "Validated / Confirmed",
  confirmed: "Validated / Confirmed",
  not_suspected: "Ruled Out",
};

export function formatStatusLabel(value, fallback = "—") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  const normalizedKey = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  if (STATUS_LABEL_OVERRIDES[normalizedKey]) {
    return STATUS_LABEL_OVERRIDES[normalizedKey];
  }

  return normalizedKey
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
