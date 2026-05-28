import React, { useState, useCallback, useRef, useEffect } from "react";
import { AppState, PointCloudData, ProcessingConfig, DepthModel } from "./types";
import { generateDepthMapWithGradio } from "./services/gradioDepthService";
import { generateDepthMapWithOpenAI } from "./services/openaiDepthService";
import { generateDepthMapWithLocalServer } from "./services/localServerDepthService";
import { generatePointsFromImages } from "./utils/pointCloudUtils";
import {
  loadPointCloudFromFile,
  isSupportedPointCloudFile,
  SUPPORTED_IMPORT_EXTENSIONS,
} from "./utils/pointCloudImport";
import Scene3D from "./components/Scene3D";
import Controls from "./components/Controls";
import ExportPanel from "./components/ExportPanel";

const PROVIDER_LABEL: Record<DepthModel, string> = {
  [DepthModel.LOCAL_SERVER]: "Depth-Anything-V2 · Local",
  [DepthModel.HUGGINGFACE]: "Depth-Anything-V2 · HuggingFace",
  [DepthModel.OPENAI]: "OpenAI GPT Image",
};

const PROVIDER_SHORT: Record<DepthModel, string> = {
  [DepthModel.LOCAL_SERVER]: "Local",
  [DepthModel.HUGGINGFACE]: "HuggingFace",
  [DepthModel.OPENAI]: "OpenAI",
};

function App() {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [rgbImage, setRgbImage] = useState<string | null>(null);
  const [depthImage, setDepthImage] = useState<string | null>(null);
  const [pointData, setPointData] = useState<PointCloudData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cloudInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<ProcessingConfig>({
    sampleRate: 2,
    depthScale: 5,
    pointSize: 0.05,
    depthModel: DepthModel.LOCAL_SERVER,
  });

  const isProcessing =
    state === AppState.GENERATING_DEPTH || state === AppState.PROCESSING_POINTS;

  const dismissError = useCallback(() => setErrorMsg(null), []);

  const processPoints = useCallback(
    async (rgb: string, depth: string, currentConfig: ProcessingConfig) => {
      try {
        const data = await generatePointsFromImages(
          rgb,
          depth,
          currentConfig.sampleRate,
          currentConfig.depthScale
        );
        setPointData(data);
        setState(AppState.VIEWING);
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to process point cloud data.");
        setState(AppState.ERROR);
      }
    },
    []
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("El archivo debe ser una imagen.");
        return;
      }

      setState(AppState.GENERATING_DEPTH);
      setErrorMsg(null);
      setPointData(null);
      setDepthImage(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Raw = e.target?.result as string;
        setRgbImage(base64Raw);
        const base64Data = base64Raw.split(",")[1];

        try {
          let depthBase64: string;
          if (config.depthModel === DepthModel.OPENAI) {
            depthBase64 = await generateDepthMapWithOpenAI(base64Data, file.type);
          } else if (config.depthModel === DepthModel.HUGGINGFACE) {
            depthBase64 = await generateDepthMapWithGradio(base64Data, file.type);
          } else {
            depthBase64 = await generateDepthMapWithLocalServer(base64Data, file.type);
          }

          const depthDataUrl = `data:image/png;base64,${depthBase64}`;
          setDepthImage(depthDataUrl);

          setState(AppState.PROCESSING_POINTS);
          setTimeout(() => processPoints(base64Raw, depthDataUrl, config), 80);
        } catch (err: any) {
          console.error(err);
          setErrorMsg(err.message || "No se pudo generar el mapa de profundidad.");
          setState(AppState.ERROR);
        }
      };
      reader.readAsDataURL(file);
    },
    [config, processPoints]
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  };

  const handleCloudFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    setRgbImage(null);
    setDepthImage(null);
    setPointData(null);
    setState(AppState.PROCESSING_POINTS);
    try {
      const data = await loadPointCloudFromFile(file);
      setPointData(data);
      setState(AppState.VIEWING);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "No se pudo leer el archivo de nube de puntos.");
      setState(AppState.ERROR);
    }
  }, []);

  const handleCloudInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleCloudFile(file);
    event.target.value = "";
  };

  const handleRegenerate = useCallback(() => {
    if (rgbImage && depthImage) {
      setState(AppState.PROCESSING_POINTS);
      processPoints(rgbImage, depthImage, config);
    }
  }, [rgbImage, depthImage, config, processPoints]);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        setIsDragging(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if ((e as any).relatedTarget === null) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isProcessing) return;
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (isSupportedPointCloudFile(file.name)) handleCloudFile(file);
      else handleFile(file);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFile, handleCloudFile, isProcessing]);

  return (
    <div className="min-h-screen text-zinc-200 flex flex-col font-sans relative">
      {/* HEADER */}
      <header className="sticky top-0 z-40">
        <div className="glass-strong border-b border-white/5">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-sm bg-white text-black flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-gradient">
                  DepthGen 3D
                </h1>
                <p className="text-[10px] sm:text-[11px] font-mono text-zinc-500 -mt-0.5">
                  image → point cloud
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <ProviderPill model={config.depthModel} />

              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="lg:hidden p-2 rounded-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                aria-label="Toggle settings"
              >
                <IconSliders />
              </button>

              <OpenCloudButton disabled={isProcessing} onClick={() => cloudInputRef.current?.click()} />
              <UploadButton disabled={isProcessing} onClick={() => fileInputRef.current?.click()} />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              <input
                ref={cloudInputRef}
                type="file"
                className="hidden"
                accept={SUPPORTED_IMPORT_EXTENSIONS.join(",")}
                onChange={handleCloudInputChange}
                disabled={isProcessing}
              />
            </div>
          </div>
        </div>
      </header>

      {/* DRAG OVERLAY */}
      {isDragging && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-strong rounded-md px-12 py-10 grad-border text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-sm bg-white text-black flex items-center justify-center">
              <IconUpload className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Suelta tu imagen</h2>
            <p className="text-sm text-zinc-400">Se procesará automáticamente</p>
          </div>
        </div>
      )}

      {/* MAIN */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 lg:h-[calc(100vh-72px)]">
        {/* SIDEBAR */}
        <aside
          className={`lg:col-span-3 xl:col-span-3 flex flex-col gap-4 lg:overflow-y-auto custom-scrollbar lg:pr-1 transition-all ${
            sidebarOpen ? "block" : "hidden lg:flex"
          }`}
        >
          {/* Error */}
          {errorMsg && (
            <div className="glass-card rounded-sm p-3.5 border-rose-400/25 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-sm bg-rose-500/15 border border-rose-400/30 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-rose-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-rose-200 mb-0.5">Error</div>
                  <p className="text-xs text-rose-200/80 leading-relaxed break-words">{errorMsg}</p>
                </div>
                <button
                  onClick={dismissError}
                  className="text-rose-300/80 hover:text-white transition-colors"
                  aria-label="Cerrar"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Image previews */}
          {(rgbImage || state === AppState.GENERATING_DEPTH) && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <PreviewTile label="Source" image={rgbImage} />
              <PreviewTile
                label="Depth"
                image={depthImage}
                grayscale
                loading={state === AppState.GENERATING_DEPTH}
              />
            </div>
          )}

          {/* Controls */}
          <div className="glass-card rounded-md p-4 grad-border">
            <Controls
              config={config}
              onConfigChange={setConfig}
              processing={isProcessing}
              hasData={!!pointData}
              onRegenerate={handleRegenerate}
            />
          </div>

          {/* Export */}
          {pointData && <ExportPanel data={pointData} />}

          <Footer />
        </aside>

        {/* VIEWER */}
        <section className="lg:col-span-9 xl:col-span-9 h-[calc(100vh-220px)] lg:h-auto min-h-[400px]">
          <ViewerArea
            state={state}
            pointData={pointData}
            pointSize={config.pointSize}
            providerLabel={PROVIDER_LABEL[config.depthModel]}
            onUploadClick={() => fileInputRef.current?.click()}
            onOpenCloudClick={() => cloudInputRef.current?.click()}
          />
        </section>
      </main>
    </div>
  );
}

export default App;

/* -------- viewer area -------- */

const ViewerArea: React.FC<{
  state: AppState;
  pointData: PointCloudData | null;
  pointSize: number;
  providerLabel: string;
  onUploadClick: () => void;
  onOpenCloudClick: () => void;
}> = ({ state, pointData, pointSize, providerLabel, onUploadClick, onOpenCloudClick }) => {
  if (pointData) {
    return (
      <div className="w-full h-full animate-fade-in">
        <Scene3D data={pointData} pointSize={pointSize} />
      </div>
    );
  }

  return (
    <div className="w-full h-full glass rounded-md flex items-center justify-center p-6 grad-border relative overflow-hidden">
      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        }}
      />

      {state === AppState.GENERATING_DEPTH || state === AppState.PROCESSING_POINTS ? (
        <ProcessingState state={state} providerLabel={providerLabel} />
      ) : (
        <EmptyState
          providerLabel={providerLabel}
          onUploadClick={onUploadClick}
          onOpenCloudClick={onOpenCloudClick}
        />
      )}
    </div>
  );
};

const EmptyState: React.FC<{
  providerLabel: string;
  onUploadClick: () => void;
  onOpenCloudClick: () => void;
}> = ({ providerLabel, onUploadClick, onOpenCloudClick }) => (
  <div className="text-center space-y-6 max-w-lg z-10 animate-scale-in">
    <div className="relative w-20 h-20 mx-auto">
      <div className="absolute inset-0 rounded-md bg-white/5 blur-xl animate-pulse-soft" />
      <div className="relative w-full h-full rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center backdrop-blur-sm">
        <svg viewBox="0 0 24 24" className="w-9 h-9 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    </div>

    <div className="space-y-2">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
        Convierte una imagen en{" "}
        <span className="text-gradient">nube de puntos 3D</span>
      </h2>
      <p className="text-sm text-zinc-400 leading-relaxed">
        Sube una foto y la app inferirá su profundidad para reconstruirla como un sistema de
        partículas navegable en tiempo real.
      </p>
    </div>

    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
      <button
        onClick={onUploadClick}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-sm font-semibold text-sm bg-white text-black hover:bg-zinc-200 transition-colors"
      >
        <IconUpload className="w-4 h-4" />
        Subir imagen
        <span className="text-[10px] font-mono text-black/60 hidden sm:inline ml-1">
          o arrástrala
        </span>
      </button>

      <button
        onClick={onOpenCloudClick}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm font-medium text-sm bg-white/[0.04] border border-white/10 text-zinc-200 hover:bg-white/[0.08] hover:border-white/20 transition-colors"
      >
        <IconCube className="w-4 h-4" />
        Cargar nube
        <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline ml-1">
          .ply .xyz .pcd .csv
        </span>
      </button>
    </div>

    <div className="flex items-center justify-center gap-2 pt-2 text-[11px] font-mono text-zinc-500">
      <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
      Usando {providerLabel}
    </div>
  </div>
);

const ProcessingState: React.FC<{ state: AppState; providerLabel: string }> = ({
  state,
  providerLabel,
}) => {
  const isDepth = state === AppState.GENERATING_DEPTH;
  return (
    <div className="text-center space-y-5 z-10 animate-fade-in">
      <div className="relative w-16 h-16 mx-auto">
        <div className="absolute inset-0 rounded-full bg-white/10 blur-md animate-pulse-soft" />
        <div className="relative w-full h-full rounded-full border-2 border-white/10 border-t-white animate-spin" />
      </div>
      <div>
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-400 mb-1">
          {isDepth ? "Step 1 of 2" : "Step 2 of 2"}
        </div>
        <h3 className="text-xl font-bold text-white mb-1">
          {isDepth ? "Estimando profundidad" : "Construyendo nube"}
        </h3>
        <p className="text-sm text-zinc-400">
          {isDepth ? `Vía ${providerLabel}` : "Mapeando píxeles a 3D"}
        </p>
      </div>
    </div>
  );
};

/* -------- preview tiles -------- */

const PreviewTile: React.FC<{
  label: string;
  image: string | null;
  grayscale?: boolean;
  loading?: boolean;
}> = ({ label, image, grayscale, loading }) => (
  <div className="relative aspect-square rounded-sm overflow-hidden glass-card group">
    <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur text-[10px] font-mono uppercase tracking-wider text-white/80">
      {label}
    </div>
    {image ? (
      <img
        src={image}
        alt={label}
        className={`w-full h-full object-cover ${grayscale ? "grayscale" : ""}`}
      />
    ) : loading ? (
      <div className="w-full h-full bg-white/[0.02] shimmer-bg" />
    ) : (
      <div className="w-full h-full bg-white/[0.02] flex items-center justify-center text-zinc-600">
        <IconImage />
      </div>
    )}
  </div>
);

/* -------- header pieces -------- */

const ProviderPill: React.FC<{ model: DepthModel }> = ({ model }) => (
  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-sm border border-white/10 bg-white/5 text-[11px] font-mono uppercase tracking-wider text-white/80">
    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
    {PROVIDER_SHORT[model]}
  </div>
);

const UploadButton: React.FC<{ disabled: boolean; onClick: () => void }> = ({
  disabled,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-sm text-sm font-semibold transition-colors ${
      disabled
        ? "bg-white/5 text-zinc-500 cursor-not-allowed"
        : "bg-white text-black hover:bg-zinc-200"
    }`}
  >
    <IconUpload className="w-4 h-4" />
    <span className="hidden sm:inline">Upload</span>
  </button>
);

const OpenCloudButton: React.FC<{ disabled: boolean; onClick: () => void }> = ({
  disabled,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title="Cargar una nube de puntos (.ply, .xyz, .pcd, .csv)"
    className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-sm text-sm font-medium transition-colors border ${
      disabled
        ? "bg-white/5 text-zinc-500 border-white/5 cursor-not-allowed"
        : "bg-white/[0.04] text-zinc-200 border-white/10 hover:bg-white/[0.08] hover:border-white/20"
    }`}
  >
    <IconCube className="w-4 h-4" />
    <span className="hidden sm:inline">Abrir nube</span>
  </button>
);

const Footer: React.FC = () => (
  <div className="text-[10px] text-zinc-500 font-mono px-2 pt-2">
    <span className="text-zinc-400">DepthGen 3D</span> · v0.1 · React Three Fiber
  </div>
);

/* -------- icons -------- */

const IconUpload: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconCube: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconImage: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const IconSliders: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);
