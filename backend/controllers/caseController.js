import mongoose from "mongoose";
import { paginationMeta, parsePagination } from "../utils/pagination.js";
import { getAnalyticalCasePage } from "../services/analyticalCaseService.js";

export const listCasesByDataset = async (req, res) => {
  try {
    const { datasetId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(datasetId)) {
      return res.status(400).json({ message: "Invalid datasetId" });
    }

    const { page, limit, skip } = parsePagination(req.query, { maxLimit: 5000 });
    const filters = { datasetId };
    if (req.query.year !== undefined && req.query.year !== "") {
      const y = Number(req.query.year);
      if (!Number.isFinite(y))
        return res.status(400).json({ message: "Invalid year" });
      filters.year = y;
    }

    if (req.query.month !== undefined && req.query.month !== "") {
      const m = Number(req.query.month);
      if (!Number.isFinite(m) || m < 1 || m > 12)
        return res.status(400).json({ message: "Invalid month" });
      filters.month = m;
    }

    if (req.query.barangayNo !== undefined && req.query.barangayNo !== "") {
      const b = Number(req.query.barangayNo);
      if (!Number.isFinite(b)) {
        return res.status(400).json({ message: "Invalid barangayNo" });
      }
      filters.barangayNo = b;
    }

    if (req.query.district) filters.district = String(req.query.district).trim();

    if (req.query.disease) filters.disease = String(req.query.disease).trim();

    const allowedStatuses = new Set([
      "reported",
      "suspected",
      "probable",
      "confirmed",
      "not_validated",
    ]);
    const selectedStatuses = String(
      req.query.caseClassification || "confirmed",
    )
      .split(",")
      .map((status) => status.trim().toLowerCase())
      .filter(Boolean);
    if (
      selectedStatuses.length === 0 ||
      selectedStatuses.some((status) => !allowedStatuses.has(status))
    ) {
      return res.status(400).json({ message: "Invalid caseClassification" });
    }
    const { items, total } = await getAnalyticalCasePage({
      ...filters,
      statuses: [...new Set(selectedStatuses)],
      skip,
      limit,
    });

    return res.json({
      datasetId,
      total,
      limit,
      skip,
      page,
      pagination: paginationMeta({ page, limit, total }),
      items,
      caseDefinition: {
        selectedStatuses: [...new Set(selectedStatuses)],
        includes: [
          "official_upload",
          ...(selectedStatuses.some((status) => status !== "confirmed")
            ? ["surveillance_report"]
            : []),
          ...(selectedStatuses.includes("confirmed")
            ? ["confirmed_surveillance_report"]
            : []),
        ],
        unionStrategy: "query_time_no_copy",
      },
    });
  } catch (err) {
    return res.status(err?.status || 500).json({ message: err?.message || "Server error" });
  }
};
