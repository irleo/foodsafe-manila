import { useEffect, useState } from "react";
import { fetchLatestPredictions } from "../api/predictions";

export function useLatestPredictionRun(token) {
  const [predictionRun, setPredictionRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setPredictionRun(null);
      setLoading(false);
      setErrorMsg("");
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        // This is the same canonical latest saved run loaded by PredictionsPage.
        const response = await fetchLatestPredictions(token);
        if (!isMounted) return;
        setPredictionRun(response?.hasPrediction ? response : null);
        if (response?.hasPrediction === false) {
          setErrorMsg(response.message || "No saved forecast is available.");
        }
      } catch (error) {
        if (!isMounted) return;
        setPredictionRun(null);
        setErrorMsg(error?.message || "Failed to load the saved forecast.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return { predictionRun, loading, errorMsg };
}
