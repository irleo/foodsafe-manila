import { useEffect, useMemo, useState } from "react";
import { fetchDistrictHeatmap } from "../api/heatmap";

/**
 * Fetch centroid-weighted district heatmap points from OfficialCase.
 *
 * API response shape:
 * [
 *   { barangayNo: 1, district: "District 1", cases: 55 },
 *   ...
 * ]
 */
export function useHeatmapPoints({
  token,
  datasetId,
  selectedDisease = "All",
  selectedYear = "All",
  selectedMonth = "All",
  selectedCaseClassification = "All",
} = {}) {
  const [points, setPoints] = useState([]);
  const [districtStats, setDistrictStats] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const query = useMemo(() => {
    if (!datasetId) return null;
    return {
      datasetId,
      year: selectedYear,
      month: selectedMonth,
      disease: selectedDisease,
      caseClassification: selectedCaseClassification,
    };
  }, [
    datasetId,
    selectedYear,
    selectedMonth,
    selectedDisease,
    selectedCaseClassification,
  ]);

  useEffect(() => {
    if (!token || !query) {
      setLoading(false);
      setPoints([]);
      setDistrictStats([]);
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const data = await fetchDistrictHeatmap(token, query);

        if (!isMounted) return;
        setPoints(Array.isArray(data?.points) ? data.points : []);
        setDistrictStats(
          Array.isArray(data?.districtStats) ? data.districtStats : [],
        );
        setFilterOptions(data?.filterOptions || {});
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg(err?.message || "Failed to load heatmap data.");
        setPoints([]);
        setDistrictStats([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token, query]);

  return { points, districtStats, filterOptions, loading, errorMsg };
}
