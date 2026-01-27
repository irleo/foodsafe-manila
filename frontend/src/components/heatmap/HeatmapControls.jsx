export default function HeatmapControls({
  title,
  mapType,
  setMapType,
  dropdownValue,
  dropdownOptions,
  onDropdownChange,
}) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
      <h2 className="font-semibold text-lg">{title}</h2>

      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <div className="flex gap-2 border border-gray-300 rounded-lg p-1">
          {["District", "Disease"].map((type) => (
            <button
              key={type}
              onClick={() => setMapType(type)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                mapType === type
                  ? "bg-blue-500 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={dropdownValue}
          onChange={onDropdownChange}
        >
          {dropdownOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
