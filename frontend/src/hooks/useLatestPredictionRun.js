import { useEffect, useState } from "react";
import { fetchLatestPredictions } from "../api/predictions";
import { getErrorMessage } from "../utils/errors";

const FORECAST_STATUS_POLL_MS = 3_000;

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
    let pollTimer = null;
    let isInitialRequest = true;

    const loadLatestPrediction = async () => {
      try {
        if (isInitialRequest) {
          setLoading(true);
          setErrorMsg("");
        }
        // This is the same canonical latest saved run loaded by PredictionsPage.
        const response = await fetchLatestPredictions(token);
        if (!isMounted) return;
        setPredictionRun(response?.hasPrediction ? response : null);
        if (response?.hasPrediction === false) {
          if (response?.refreshJob?.status === "running") {
            setErrorMsg("A forecast for the latest dataset is being generated.");
          } else if (response?.refreshJob?.status === "failed") {
            setErrorMsg(response.refreshJob.errorMessage || "Forecast generation failed.");
          } else {
            setErrorMsg(response.message || "No saved forecast is available.");
          }
        } else {
          setErrorMsg("");
        }

        if (response?.refreshJob?.status === "running") {
          pollTimer = window.setTimeout(
            loadLatestPrediction,
            FORECAST_STATUS_POLL_MS,
          );
        }
      } catch (error) {
        if (!isMounted) return;
        setPredictionRun(null);
        setErrorMsg(getErrorMessage(error, "Prediction data is currently unavailable."));
      } finally {
        if (isMounted && isInitialRequest) setLoading(false);
        isInitialRequest = false;
      }
    };

    void loadLatestPrediction();

    return () => {
      isMounted = false;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [token]);

  return { predictionRun, loading, errorMsg };
}
