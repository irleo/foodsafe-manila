import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export function useReports(token) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReports = useCallback(
    async ({
      datasetId,
      district,
      onlyCounted,
      from,
      to,
      limit,
    } = {}) => {
      if (!token) {
        setReports([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");

        const params = new URLSearchParams();
        if (datasetId) params.set("datasetId", datasetId);
        if (district) params.set("district", district);
        if (typeof onlyCounted === "boolean") {
          params.set("onlyCounted", String(onlyCounted));
        }
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (limit) params.set("limit", String(limit));

        const qs = params.toString();
        const url = `${API_BASE}/api/reports${qs ? `?${qs}` : ""}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || "Failed to load reports.");
        }

        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        setErrorMsg(err?.message || "Failed to load reports.");
        setReports([]);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    (async () => {
      if (!isMounted) return;
      await fetchReports();
    })();

    return () => {
      isMounted = false;
    };
  }, [token, fetchReports]);

  return { reports, loading, errorMsg, fetchReports };
}
