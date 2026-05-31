import { ArrowUpTrayIcon, DocumentIcon } from "@heroicons/react/24/outline";

export default function UploadDropzone({
  dragActive,
  setDragActive,
  file,
  fileInputRef,
  pickFile,
  onFileSelected,
  onDrop,
  onRemoveFile,
}) {
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
      }}
      onDrop={onDrop}
      className={[
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
        dragActive ? "border-blue-400 bg-blue-50/40" : "border-gray-300",
      ].join(" ")}
    >
      <ArrowUpTrayIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />

      {!file ? (
        <>
          <p className="mb-2">Drag and drop your file here</p>
          <p className="text-sm text-gray-500 mb-4">or</p>
          <button
            type="button"
            onClick={pickFile}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
          >
            Browse Files
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => onFileSelected(e.target.files?.[0])}
          />

          <p className="text-xs text-gray-500 mt-4">
            Supported formats: CSV, Excel (.xlsx, .xls)
          </p>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center gap-3 text-left">
            <DocumentIcon className="w-6 h-6 text-gray-600" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            className="text-sm px-3 py-1 rounded-lg border border-gray-300 hover:bg-white"
            onClick={onRemoveFile}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
