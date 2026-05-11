export function normalizeDistrict(input = "") {
  const v = String(input)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  const map = {
    i: "District 1",
    1: "District 1",
    "district 1": "District 1",
    "district i": "District 1",

    ii: "District 2",
    2: "District 2",
    "district 2": "District 2",
    "district ii": "District 2",

    iii: "District 3",
    3: "District 3",
    "district 3": "District 3",
    "district iii": "District 3",

    iv: "District 4",
    4: "District 4",
    "district 4": "District 4",
    "district iv": "District 4",

    v: "District 5",
    5: "District 5",
    "district 5": "District 5",
    "district v": "District 5",

    vi: "District 6",
    6: "District 6",
    "district 6": "District 6",
    "district vi": "District 6",
  };

  return map[v] || null;
}
