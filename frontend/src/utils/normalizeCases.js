export function normalizeToCaseRows(rows) {
  // Accepts either old report-like objects or official-case objects
  return rows.map((r) => {
    // Official case format
    if (r.disease && r.year != null && r.cases != null) {
      return {
        city: r.city ?? "Manila",
        district: r.district,
        disease: r.disease,
        year: Number(r.year),
        cases: Number(r.cases),
      };
    }

    // fallback: report-like shape (your current mockReports)
    const year = new Date(r.reportedAt).getFullYear();
    return {
      city: "Manila",
      district: r.location?.district ?? "Unknown",
      disease: r.illness ?? "Unknown",
      year,
      cases: 1, // no caseCount in your mockReports; keep 1
    };
  });
}
