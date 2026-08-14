import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export function useOfficialCases({ token, datasetId, year, month, district, disease, caseClassification, limit = 5000 } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const url = useMemo(() => {
    if (!datasetId) return null;
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", String(Math.min(Math.max(Number(limit) || 50, 1), 50)));
    if (year != null && year !== "All") params.set("year", String(year));
    if (month != null && month !== "All") params.set("month", String(month));
    if (district) params.set("district", district);
    if (disease) params.set("disease", disease);
    if (caseClassification && caseClassification !== "All")
      params.set("caseClassification", caseClassification);
    const qs = params.toString();
    return `${API_BASE}/api/cases/${datasetId}${qs ? `?${qs}` : ""}`;
  }, [datasetId, year, month, district, disease, caseClassification, limit]);

  useEffect(() => {
    if (!token || !url) {
      setItems([]);
      setLoading(false);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const requestPage = async (pageUrl) => {
          const res = await fetch(pageUrl, {
            headers: { Authorization: token ? `Bearer ${token}` : "" },
            signal: controller.signal,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.message || "Failed to load official cases.");
          }
          return data;
        };

        const first = await requestPage(url);
        let allItems = Array.isArray(first?.items) ? first.items : [];
        const totalPages = first?.pagination?.totalPages || 1;
        for (let page = 2; page <= totalPages; page += 1) {
          const nextUrl = new URL(url);
          nextUrl.searchParams.set("page", String(page));
          const next = await requestPage(nextUrl.toString());
          allItems = allItems.concat(
            Array.isArray(next?.items) ? next.items : [],
          );
        }
        if (!isMounted) return;
        setItems(allItems);
      } catch (e) {
        if (!isMounted || e?.name === "AbortError") return;
        setItems([]);
        setErrorMsg(e?.message || "Failed to load official cases.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [token, url]);

  return { items, loading, errorMsg };
}

