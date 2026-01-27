import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Fetch centroid-weighted district heatmap points from OfficialCase.
 *
 * API response shape:
 * [
 *   { district: "Tondo", lat: 14.62, lng: 120.97, weight: 55 },
 *   ...
 * ]
 */
export function useHeatmapPoints({
  token,
  datasetId,
  mapType = "District",      // "District" | "Disease"
  selectedDistrict = "All",
  selectedDisease = "All",
  selectedYear = "All",
} = {}) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const url = useMemo(() => {
    if (!datasetId) return null;

    const params = new URLSearchParams();
    params.set("datasetId", datasetId);

    if (mapType === "District" && selectedDistrict !== "All") {
      params.set("district", selectedDistrict);
    }

    if (mapType === "Disease" && selectedDisease !== "All") {
      params.set("disease", selectedDisease);
    }

    if (selectedYear !== "All") {
      params.set("year", String(selectedYear));
    }

    return `${API_BASE}/api/heatmap/districts?${params.toString()}`;
  }, [
    datasetId,
    mapType,
    selectedDistrict,
    selectedDisease,
    selectedYear,
  ]);

  useEffect(() => {
    if (!token || !url) {
      setLoading(false);
      setPoints([]);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || "Failed to load heatmap data.");
        }

        const data = await res.json();
        if (!isMounted) return;
        setPoints(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!isMounted || err?.name === "AbortError") return;
        setErrorMsg(err?.message || "Failed to load heatmap data.");
        setPoints([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [token, url]);

  return { points, loading, errorMsg };
}
