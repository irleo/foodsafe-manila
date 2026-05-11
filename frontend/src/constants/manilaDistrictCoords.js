export const manilaDistrictCoords = {
  // Official-case heatmap centroids for Manila council districts (1–6).
  district_1:    { lat: 14.6105, lng: 120.9725 },
  district_2:    { lat: 14.6030, lng: 120.9815 },
  district_3:    { lat: 14.6105, lng: 120.9950 },
  district_4:    { lat: 14.5865, lng: 120.9815 },
  district_5:    { lat: 14.5745, lng: 120.9990 },
  district_6:    { lat: 14.5785, lng: 121.0100 },

  binondo:      { lat: 14.6013, lng: 120.9754 },
  quiapo:       { lat: 14.5986, lng: 120.9836 },
  sampaloc:     { lat: 14.6092, lng: 120.9890 },
  san_miguel:   { lat: 14.6019, lng: 120.9883 },
  santa_cruz:   { lat: 14.6042, lng: 120.9810 },
  tondo:        { lat: 14.6177, lng: 120.9670 },
  ermita:       { lat: 14.5826, lng: 120.9846 },
  intramuros:   { lat: 14.5896, lng: 120.9747 },
  malate:       { lat: 14.5700, lng: 120.9850 },
  paco:         { lat: 14.5794, lng: 120.9967 },
  pandacan:     { lat: 14.5906, lng: 121.0061 },
  port_area:    { lat: 14.5903, lng: 120.9639 },
  san_andres:   { lat: 14.5669, lng: 120.9976 },
  santa_ana:    { lat: 14.5760, lng: 121.0050 },
};

export function normalizeDistrictKey(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/district\s*(\d+)/i);
  if (m?.[1]) return `district_${m[1]}`;
  return raw
    .toLowerCase()
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, "_");
}