import { useCallback, useEffect, useState } from "react";
import { fetchDatasets, uploadDataset, downloadDatasetFile } from "../api/datasets";

export function useDatasets(token, status = "validated") {
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const fetchRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const data = await fetchDatasets({ token, status });
      setRecent(data);
    } finally {
      setLoadingRecent(false);
    }
  }, [token, status]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const upload = useCallback(
    async (payload) => {
      return uploadDataset({ ...payload, token });
    },
    [token]
  );

  const download = useCallback(
    async (datasetId) => {
      return downloadDatasetFile({ datasetId, token });
    },
    [token]
  );

  return { recent, loadingRecent, fetchRecent, upload, download };
}
