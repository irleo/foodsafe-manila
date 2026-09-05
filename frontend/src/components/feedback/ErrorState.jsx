export default function ErrorState({
  title = "Something went wrong",
  message = "This information is temporarily unavailable.",
  reference,
  onRetry,
  retryLabel = "Try again",
}) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900"
      role="alert"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {reference && (
        <p className="mt-2 text-xs text-red-700">Reference: {reference}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
