const STATUS_LABEL_OVERRIDES = {
  admin: "System Administrator",
  cesu: "Data Manager",
  surveillance_team: "Surveillance Officer",
  validated_confirmed: "Confirmed",
  confirmed: "Confirmed",
  not_validated: "Not Confirmed",
  case_not_validated: "Case Not Confirmed",
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
