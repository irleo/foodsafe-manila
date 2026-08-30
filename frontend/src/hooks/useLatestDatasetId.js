import { useEffect, useMemo, useState } from "react";
import { fetchDatasets } from "../api/datasets";

/**
 * Picks the newest validated dataset as the default scope for analytics/heatmap/predictions.
 */
export function useLatestDatasetId(token) {
  const [datasetId, setDatasetId] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setDatasetId(null);
      setDataset(null);
      setLoading(false);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const { items } = await fetchDatasets({
          token,
          status: "validated",
          providerType: "cesu",
          page: 1,
          limit: 1,
        });
        if (!isMounted) return;
        setDatasetId(items?.[0]?._id || null);
        setDataset(items?.[0] || null);
      } catch (e) {
        if (!isMounted) return;
        setDatasetId(null);
        setDataset(null);
        setErrorMsg(e?.message || "Failed to load datasets");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [token]);

  return useMemo(
    () => ({ datasetId, dataset, loading, errorMsg }),
    [datasetId, dataset, loading, errorMsg],
  );
}

