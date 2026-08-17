export function legislativeDistrictFromBarangayNo(value) {
  const barangayNo = Number(value);
  if (!Number.isInteger(barangayNo) || barangayNo < 1 || barangayNo > 905) {
    return null;
  }
  if (barangayNo <= 146) return "District 1";
  if (barangayNo <= 267) return "District 2";
  if (barangayNo <= 394) return "District 3";
  if (barangayNo <= 586) return "District 4";
  if (barangayNo <= 648) return "District 6";
  if (barangayNo <= 828) return "District 5";
  return "District 6";
}
