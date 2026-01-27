export const manilaDistrictCoords = {
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

export function toManilaDistrictKey(district) {
  return String(district || "")
    .trim()
    .toLowerCase()
    .replace(/[.\-]/g, " ")
    .replace(/\s+/g, "_");
}