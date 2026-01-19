export function normalizeDistrict(input = "") {
  const v = String(input)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (v === "sta ana") return "santa_ana";
  if (v === "sta cruz") return "santa_cruz";
  if (v === "santa mesa") return "sampaloc"; // intentional mapping

  return v.replace(/\s/g, "_"); 
}
