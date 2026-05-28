import React, { useState } from "react";
import { PointCloudData } from "../types";
import {
  EXPORT_FORMATS,
  ExportFormat,
  downloadPointCloud,
} from "../utils/pointCloudExport";

interface ExportPanelProps {
  data: PointCloudData;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ data }) => {
  const [justExported, setJustExported] = useState<ExportFormat | null>(null);

  const handleExport = (format: ExportFormat) => {
    downloadPointCloud(data, format);
    setJustExported(format);
    window.setTimeout(() => setJustExported((f) => (f === format ? null : f)), 1500);
  };

  return (
    <div className="glass-card rounded-md p-4 grad-border animate-fade-in">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 mb-3">
        <span className="w-5 h-5 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-white">
          <IconDownload />
        </span>
        Exportar nube
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {EXPORT_FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => handleExport(f.id)}
            title={f.blurb}
            className="flex flex-col items-start gap-0.5 rounded-sm p-2.5 bg-white/[0.02] border border-white/8 hover:bg-white/[0.06] hover:border-white/20 transition-colors text-left group"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
              {justExported === f.id ? <IconCheck /> : <IconFile />}
              .{f.ext}
            </span>
            <span className="text-[10px] text-zinc-500 leading-tight">{f.blurb}</span>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
        Todos los formatos incluyen color (RGB) por punto.
      </p>
    </div>
  );
};

export default ExportPanel;

const IconDownload = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
