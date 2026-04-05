import { useRef, useState } from "react";

export default function FileDropzone({
  title,
  description,
  accept,
  selectedFile,
  onFileSelected,
  buttonLabel = "Choose file",
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file) => {
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        handleFile(event.dataTransfer.files?.[0]);
      }}
      className={`rounded-[28px] border-2 border-dashed p-6 transition duration-200 ${
        dragActive ? "border-sea bg-teal-50" : "border-slate-200 bg-white/70"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
          {selectedFile ? (
            <p className="mt-3 text-sm font-medium text-slate-700">
              Selected: <span className="text-sea">{selectedFile.name}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-2xl bg-slateblue px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
