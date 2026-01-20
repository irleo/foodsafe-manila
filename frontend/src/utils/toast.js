import { toast } from "sonner";

export const notify = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  info: (msg) => toast(msg),
  loading: (msg) => toast.loading(msg),

  // For async actions (upload, generate predictions, save, etc.)
  promise: (promise, { loading, success, error }) =>
    toast.promise(promise, {
      loading,
      success,
      error,
    }),
};
