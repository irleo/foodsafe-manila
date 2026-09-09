function LegendItem({ color, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full" style={{ background: color }} />
      <div>
        <p className="text-sm">{title}</p>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>
    </div>
  );
}

export default function LegendCard({ mode = "actual" }) {
  const isForecast = mode === "forecast";
  const isComparison = mode === "comparison";
  const subtitle = isForecast ? "Predicted district cases" : "Relative to this selection";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="mb-4 font-semibold">Legend</h3>
      <div className="space-y-3">
        <LegendItem color="#bfdbfe" title="Lower concentration" subtitle={subtitle} />
        <LegendItem color="#60a5fa" title="Moderate concentration" subtitle={subtitle} />
        <LegendItem color="#2563eb" title="Higher concentration" subtitle={subtitle} />
        <LegendItem color="#1e3a8a" title="Highest concentration" subtitle={subtitle} />
        {(isForecast || isComparison) && (
          <div className="border-t border-gray-100 pt-3 text-xs leading-5 text-gray-600">
            <span className="mr-2 inline-block w-7 border-t-2 border-dashed border-blue-800 align-middle" />
            {isComparison
              ? "Dashed outline represents forecast concentration; fill represents latest actual concentration."
              : "Dashed boundaries indicate district-level forecast data."}
          </div>
        )}
      </div>
    </div>
  );
}
