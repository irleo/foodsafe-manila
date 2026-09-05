import { toast } from "sonner";
import { getErrorMessage } from "./errors";

export const notify = {
  success: (msg) => toast.success(msg),
  error: (error) => toast.error(getErrorMessage(error)),
  info: (msg) => toast(msg),
  loading: (msg) => toast.loading(msg),

  // For async actions (upload, generate predictions, save, etc.)
  promise: (promise, { loading, success, error }) => {
    toast.promise(promise, {
      loading,
      success,
      error: (reason) => getErrorMessage(
        typeof error === "function" ? error(reason) : error || reason,
      ),
    });
    return promise;
  },
};
