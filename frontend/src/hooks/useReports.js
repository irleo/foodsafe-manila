import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export function useReports(token, { fetchAll = false, autoFetch = true } = {}) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [permissions, setPermissions] = useState({ canAccessPatientIdentity: false });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReports = useCallback(
    async ({
      datasetId,
      district,
      onlyCounted,
      from,
      to,
      page = 1,
      limit = fetchAll ? 50 : 20,
    } = {}) => {
      if (!token) {
        setReports([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMsg("");

        const requestPage = async (requestedPage) => {
          const params = new URLSearchParams({
            page: String(requestedPage),
            limit: String(limit),
          });
          if (datasetId) params.set("datasetId", datasetId);
          if (district) params.set("district", district);
          if (typeof onlyCounted === "boolean") {
            params.set("onlyCounted", String(onlyCounted));
          }
          if (from) params.set("from", from);
          if (to) params.set("to", to);

          const res = await fetch(`${API_BASE}/api/reports?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.message || "Failed to load reports.");
          }
          return data;
        };

        const first = await requestPage(page);
        let items = Array.isArray(first?.items) ? first.items : [];
        if (fetchAll && page === 1) {
          const totalPages = first?.pagination?.totalPages || 1;
          for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
            const next = await requestPage(nextPage);
            items = items.concat(Array.isArray(next?.items) ? next.items : []);
          }
        }
        setReports(items);
        setPagination(first?.pagination || null);
        setPermissions(first?.permissions || { canAccessPatientIdentity: false });
      } catch (err) {
        setErrorMsg(err?.message || "Failed to load reports.");
        setReports([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchAll, token],
  );

  useEffect(() => {
    if (!token || !autoFetch) {
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
  }, [autoFetch, token, fetchReports]);

  return { reports, pagination, permissions, loading, errorMsg, fetchReports };
}
