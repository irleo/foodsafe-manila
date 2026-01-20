import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export function useReports(token) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return
    }

    let isMounted = true;

    (async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        setErrorMsg("");

        const res = await fetch(`${API_BASE}/api/reports`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || "Failed to load reports.");
        }

        const data = await res.json();
        if (!isMounted) return;
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg(err?.message || "Failed to load reports.");
        setReports([]);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return { reports, loading, errorMsg };
}
