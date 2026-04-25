import React, { useState, useEffect } from "react";
import { ProcessingConfig, DepthModel } from "../types";
import {
  setOpenAIApiKey,
  hasOpenAIApiKey,
  clearOpenAIApiKey,
} from "../services/openaiDepthService";
import {
  setHuggingFaceToken,
  hasHuggingFaceToken,
  clearHuggingFaceToken,
} from "../services/gradioDepthService";
import {
  checkServerHealth,
  getServerUrl,
  setServerUrl,
} from "../services/localServerDepthService";

interface ControlsProps {
  config: ProcessingConfig;
  onConfigChange: (newConfig: ProcessingConfig) => void;
  disabled: boolean;
  onRegenerate: () => void;
  hasData: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  config,
  onConfigChange,
  disabled,
  onRegenerate,
  hasData,
}) => {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(hasOpenAIApiKey());

  const [showHfTokenInput, setShowHfTokenInput] = useState(false);
  const [hfTokenInput, setHfTokenInput] = useState("");
  const [hasHfToken, setHasHfToken] = useState(hasHuggingFaceToken());

  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [showServerConfig, setShowServerConfig] = useState(false);

  useEffect(() => {
    setHasApiKey(hasOpenAIApiKey());
    setHasHfToken(hasHuggingFaceToken());
  }, [config.depthModel]);

  // Verificar estado del servidor cuando se selecciona LOCAL_SERVER
  useEffect(() => {
    if (config.depthModel === DepthModel.LOCAL_SERVER) {
      setServerStatus("checking");
      checkServerHealth().then((isOnline) => {
        setServerStatus(isOnline ? "online" : "offline");
      });
    }
  }, [config.depthModel, serverUrl]);

  const handleSaveServerUrl = () => {
    setServerUrl(serverUrl);
    setShowServerConfig(false);
    setServerStatus("checking");
    checkServerHealth().then((isOnline) => {
      setServerStatus(isOnline ? "online" : "offline");
    });
  };

  const handleSaveHfToken = () => {
    if (hfTokenInput.trim()) {
      setHuggingFaceToken(hfTokenInput.trim());
      setHasHfToken(true);
      setShowHfTokenInput(false);
      setHfTokenInput("");
    }
  };

  const handleClearHfToken = () => {
    clearHuggingFaceToken();
    setHasHfToken(false);
    setHfTokenInput("");
  };

  const handleChange = (
    key: keyof ProcessingConfig,
    value: number | DepthModel
  ) => {
    onConfigChange({ ...config, [key]: value });
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setOpenAIApiKey(apiKeyInput.trim());
      setHasApiKey(true);
      setShowApiKeyInput(false);
      setApiKeyInput("");
    }
  };

  const handleClearApiKey = () => {
    clearOpenAIApiKey();
    setHasApiKey(false);
    setApiKeyInput("");
  };

  return (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        Settings
      </h3>

      {/* Model Selection */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          Depth Model
        </h4>

        <div className="grid grid-cols-1 gap-2">
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              config.depthModel === DepthModel.DEPTH_ANYTHING_V2
                ? "bg-indigo-600/20 border-indigo-500 text-white"
                : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name="depthModel"
              value={DepthModel.DEPTH_ANYTHING_V2}
              checked={config.depthModel === DepthModel.DEPTH_ANYTHING_V2}
              onChange={(e) =>
                handleChange("depthModel", e.target.value as DepthModel)
              }
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                config.depthModel === DepthModel.DEPTH_ANYTHING_V2
                  ? "border-indigo-500"
                  : "border-slate-600"
              }`}
            >
              {config.depthModel === DepthModel.DEPTH_ANYTHING_V2 && (
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Depth Anything V2</div>
              <div className="text-xs text-slate-500">
                Local, sin costo, rápido
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
              Gratis
            </span>
          </label>

          {/* Local Server Option */}
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              config.depthModel === DepthModel.LOCAL_SERVER
                ? "bg-indigo-600/20 border-indigo-500 text-white"
                : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name="depthModel"
              value={DepthModel.LOCAL_SERVER}
              checked={config.depthModel === DepthModel.LOCAL_SERVER}
              onChange={(e) =>
                handleChange("depthModel", e.target.value as DepthModel)
              }
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                config.depthModel === DepthModel.LOCAL_SERVER
                  ? "border-indigo-500"
                  : "border-slate-600"
              }`}
            >
              {config.depthModel === DepthModel.LOCAL_SERVER && (
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Local Server</div>
              <div className="text-xs text-slate-500">
                Depth Anything V2 (Python API)
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
              GPU
            </span>
          </label>

          {/* Local Server Configuration */}
          {config.depthModel === DepthModel.LOCAL_SERVER && (
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {serverStatus === "checking" ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      <span className="text-yellow-400">Verificando...</span>
                    </>
                  ) : serverStatus === "online" ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-emerald-400">Servidor conectado</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-red-400">Servidor offline</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowServerConfig(!showServerConfig)}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showServerConfig ? "Cerrar" : "Configurar"}
                </button>
              </div>
              
              {showServerConfig && (
                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <label className="text-xs text-slate-400">URL del servidor:</label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrlState(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                  />
                  <button
                    onClick={handleSaveServerUrl}
                    className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    Guardar y verificar
                  </button>
                </div>
              )}
              
              {serverStatus === "offline" && !showServerConfig && (
                <div className="text-xs text-slate-500 mt-1">
                  Ejecuta: <code className="bg-slate-800 px-1 rounded">python server.py</code>
                </div>
              )}
            </div>
          )}

          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              config.depthModel === DepthModel.HUGGINGFACE
                ? "bg-indigo-600/20 border-indigo-500 text-white"
                : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name="depthModel"
              value={DepthModel.HUGGINGFACE}
              checked={config.depthModel === DepthModel.HUGGINGFACE}
              onChange={(e) =>
                handleChange("depthModel", e.target.value as DepthModel)
              }
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                config.depthModel === DepthModel.HUGGINGFACE
                  ? "border-indigo-500"
                  : "border-slate-600"
              }`}
            >
              {config.depthModel === DepthModel.HUGGINGFACE && (
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Hugging Face</div>
              <div className="text-xs text-slate-500">
                Depth Anything V2 (Cloud)
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
              Gratis
            </span>
          </label>

          {/* Hugging Face Token Configuration */}
          {config.depthModel === DepthModel.HUGGINGFACE && (
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 space-y-2">
              <div className="text-xs text-slate-400 mb-2">
                Token opcional para más cuota (gratis en huggingface.co)
              </div>
              {hasHfToken ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Token configurado
                  </div>
                  <button
                    onClick={handleClearHfToken}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              ) : showHfTokenInput ? (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={hfTokenInput}
                    onChange={(e) => setHfTokenInput(e.target.value)}
                    placeholder="hf_..."
                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveHfToken}
                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setShowHfTokenInput(false);
                        setHfTokenInput("");
                      }}
                      className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowHfTokenInput(true)}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
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
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  Agregar Token (más cuota)
                </button>
              )}
            </div>
          )}

          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              config.depthModel === DepthModel.OPENAI
                ? "bg-indigo-600/20 border-indigo-500 text-white"
                : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name="depthModel"
              value={DepthModel.OPENAI}
              checked={config.depthModel === DepthModel.OPENAI}
              onChange={(e) =>
                handleChange("depthModel", e.target.value as DepthModel)
              }
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                config.depthModel === DepthModel.OPENAI
                  ? "border-indigo-500"
                  : "border-slate-600"
              }`}
            >
              {config.depthModel === DepthModel.OPENAI && (
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">OpenAI</div>
              <div className="text-xs text-slate-500">GPT Image 1.5</div>
            </div>
            <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
              API Key
            </span>
          </label>
        </div>

        {/* OpenAI API Key Configuration */}
        {config.depthModel === DepthModel.OPENAI && (
          <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700 space-y-2">
            {hasApiKey ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-emerald-400">
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  API Key configurada
                </div>
                <button
                  onClick={handleClearApiKey}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            ) : showApiKeyInput ? (
              <div className="space-y-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveApiKey}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setShowApiKeyInput(false);
                      setApiKeyInput("");
                    }}
                    className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
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
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                Configurar API Key
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Point Cloud
        </h4>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">
            Depth Exaggeration ({config.depthScale.toFixed(1)}x)
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={config.depthScale}
            onChange={(e) =>
              handleChange("depthScale", parseFloat(e.target.value))
            }
            disabled={disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">
            Point Size ({config.pointSize.toFixed(2)})
          </label>
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={config.pointSize}
            onChange={(e) =>
              handleChange("pointSize", parseFloat(e.target.value))
            }
            disabled={disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">
            Sample Rate ({config.sampleRate}px)
          </label>
          <div className="text-xs text-slate-500 mb-2">
            Higher = Faster, Lower = More Detail
          </div>
          <select
            value={config.sampleRate}
            onChange={(e) =>
              handleChange("sampleRate", parseInt(e.target.value))
            }
            disabled={disabled}
            className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
          >
            <option value="1">1 (Highest Quality)</option>
            <option value="2">2 (Balanced)</option>
            <option value="4">4 (High Performance)</option>
            <option value="8">8 (Draft)</option>
          </select>
        </div>
      </div>

      {hasData && (
        <div className="pt-4 border-t border-slate-700">
          <button
            onClick={onRegenerate}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Re-process Cloud
          </button>
        </div>
      )}
    </div>
  );
};

export default Controls;
