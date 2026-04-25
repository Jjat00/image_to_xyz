import React, { useState, useCallback, useEffect } from "react";
import { AppState, PointCloudData, ProcessingConfig, DepthModel } from "./types";
import { generateDepthMap } from "./services/depthService";
import { generateDepthMapWithGradio } from "./services/gradioDepthService";
import { generateDepthMapWithOpenAI } from "./services/openaiDepthService";
import { generateDepthMapWithLocalServer } from "./services/localServerDepthService";
import { generatePointsFromImages } from "./utils/pointCloudUtils";
import Scene3D from "./components/Scene3D";
import Controls from "./components/Controls";

function App() {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [rgbImage, setRgbImage] = useState<string | null>(null);
  const [depthImage, setDepthImage] = useState<string | null>(null);
  const [pointData, setPointData] = useState<PointCloudData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [config, setConfig] = useState<ProcessingConfig>({
    sampleRate: 2,
    depthScale: 5,
    pointSize: 0.05,
    depthModel: DepthModel.LOCAL_SERVER,
  });

  // Handle file selection
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file.");
      return;
    }

    setState(AppState.GENERATING_DEPTH);
    setErrorMsg(null);
    setPointData(null);
    setDepthImage(null);

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Raw = e.target?.result as string;
      setRgbImage(base64Raw);

      // Extract base64 data without prefix for API
      const base64Data = base64Raw.split(",")[1];

      try {
        // Step 1: Generate Depth Map using selected model
        let depthBase64: string;
        
        if (config.depthModel === DepthModel.OPENAI) {
          depthBase64 = await generateDepthMapWithOpenAI(base64Data, file.type);
        } else if (config.depthModel === DepthModel.HUGGINGFACE) {
          depthBase64 = await generateDepthMapWithGradio(base64Data, file.type);
        } else if (config.depthModel === DepthModel.LOCAL_SERVER) {
          depthBase64 = await generateDepthMapWithLocalServer(base64Data, file.type);
        } else {
          depthBase64 = await generateDepthMap(base64Data, file.type);
        }
        
        const depthDataUrl = `data:image/png;base64,${depthBase64}`;
        setDepthImage(depthDataUrl);

        // Step 2: Generate Points
        setState(AppState.PROCESSING_POINTS);

        // Short timeout to allow UI to render the depth image state before heavy processing
        setTimeout(async () => {
          await processPoints(base64Raw, depthDataUrl, config);
        }, 100);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(
          err.message ||
            "Failed to generate depth map. Please check your API Key and try again."
        );
        setState(AppState.ERROR);
      }
    };
    reader.readAsDataURL(file);
  };

  // Process points function extracted for reuse
  const processPoints = async (
    rgb: string,
    depth: string,
    currentConfig: ProcessingConfig
  ) => {
    console.log('Processing with sampleRate:', currentConfig.sampleRate, 'depthScale:', currentConfig.depthScale);
    try {
      const data = await generatePointsFromImages(
        rgb,
        depth,
        currentConfig.sampleRate,
        currentConfig.depthScale
      );
      console.log('Generated data with positions length:', data.positions.length);
      setPointData(data);
      setState(AppState.VIEWING);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to process point cloud data.");
      setState(AppState.ERROR);
    }
  };

  // Handle re-generation when config changes (debounced or manual trigger)
  // For this app, we'll use the "Re-process" button in controls to avoid heavy calculations on slider drag
  // Or we can simple effect if we want real-time updates for some params.
  // DepthScale and SampleRate requires regeneration. PointSize is prop only.

  const handleRegenerate = useCallback(() => {
    if (rgbImage && depthImage) {
      setState(AppState.PROCESSING_POINTS);
      processPoints(rgbImage, depthImage, config);
    }
  }, [rgbImage, depthImage, config]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                DepthGen 3D
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                {config.depthModel === DepthModel.OPENAI 
                  ? 'Powered by OpenAI GPT Image 1.5' 
                  : config.depthModel === DepthModel.HUGGINGFACE
                  ? 'Powered by Hugging Face Spaces'
                  : config.depthModel === DepthModel.LOCAL_SERVER
                  ? 'Powered by Depth Anything V2 (Server)'
                  : 'Powered by Depth Anything V2 (Browser)'}
              </p>
            </div>
          </div>

          <label
            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer whitespace-nowrap
                ${
                  state === AppState.GENERATING_DEPTH ||
                  state === AppState.PROCESSING_POINTS
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                }
             `}
          >
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={
                state === AppState.GENERATING_DEPTH ||
                state === AppState.PROCESSING_POINTS
              }
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Upload Image
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-80px)]">
        {/* Left Panel: Inputs & Previews */}
        <div className="lg:col-span-3 flex flex-col gap-6 lg:overflow-y-auto lg:pr-2 custom-scrollbar">
          {/* Status Messages */}
          {errorMsg && (
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg text-red-200 text-sm flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 shrink-0 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Empty State */}
          {!rgbImage && !errorMsg && state === AppState.IDLE && (
            <div className="p-6 border-2 border-dashed border-slate-700 rounded-xl text-center space-y-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">No Image Selected</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Upload a photo to generate a 3D point cloud.
                </p>
              </div>
            </div>
          )}

          {/* RGB Preview */}
          {rgbImage && (
            <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-md group relative">
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-xs font-mono text-white/80 z-10">
                RGB Source
              </div>
              <img
                src={rgbImage}
                alt="Source"
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Depth Preview */}
          {depthImage ? (
            <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-md group relative">
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-xs font-mono text-white/80 z-10">
                Generated Depth Map
              </div>
              <img
                src={depthImage}
                alt="Depth"
                className="w-full h-auto object-cover grayscale"
              />
            </div>
          ) : (
            state === AppState.GENERATING_DEPTH && (
              <div className="aspect-video bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col items-center justify-center gap-3 animate-pulse">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-indigo-300 font-medium">
                  {config.depthModel === DepthModel.OPENAI 
                    ? 'Generating depth map with OpenAI...' 
                    : config.depthModel === DepthModel.HUGGINGFACE
                    ? 'Generating depth map with Hugging Face...'
                    : config.depthModel === DepthModel.LOCAL_SERVER
                    ? 'Generating depth map with Local Server...'
                    : 'Generating depth map with Depth Anything V2...'}
                </p>
              </div>
            )
          )}

          {/* Controls */}
          <Controls
            config={config}
            onConfigChange={setConfig}
            disabled={state !== AppState.VIEWING}
            onRegenerate={handleRegenerate}
            hasData={!!pointData}
          />
        </div>

        {/* Right Panel: 3D Viewer */}
        <div className="lg:col-span-9 h-[500px] lg:h-auto flex flex-col">
          {pointData ? (
            <Scene3D data={pointData} pointSize={config.pointSize} />
          ) : (
            <div className="w-full h-full bg-black/40 rounded-xl border border-slate-800 flex items-center justify-center backdrop-blur-sm">
              {state === AppState.PROCESSING_POINTS ? (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <h3 className="text-xl font-bold text-white">
                    Constructing Point Cloud...
                  </h3>
                  <p className="text-slate-400">Mapping pixels to 3D space</p>
                </div>
              ) : state === AppState.GENERATING_DEPTH ? (
                <div className="text-center space-y-2 opacity-50">
                  <p className="text-lg">Waiting for depth map...</p>
                </div>
              ) : (
                <div className="text-center space-y-4 max-w-md p-6">
                  <h2 className="text-2xl font-bold text-slate-200">
                    3D Point Cloud Visualizer
                  </h2>
                  <p className="text-slate-400 leading-relaxed">
                    Upload an image to start. The system uses{" "}
                    <span className="text-indigo-400 font-medium">
                      {config.depthModel === DepthModel.OPENAI 
                        ? 'OpenAI GPT Image 1.5' 
                        : config.depthModel === DepthModel.HUGGINGFACE
                        ? 'Hugging Face Spaces'
                        : config.depthModel === DepthModel.LOCAL_SERVER
                        ? 'Depth Anything V2 (Server)'
                        : 'Depth Anything V2 (Browser)'}
                    </span>{" "}
                    to infer depth information from a single 2D image and
                    reconstructs it as an interactive 3D particle system.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
