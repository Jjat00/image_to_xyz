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
  onConfigChange: (next: ProcessingConfig) => void;
  processing: boolean;
  hasData: boolean;
  onRegenerate: () => void;
}

type ServerStatus = "checking" | "online" | "offline";

const PROVIDERS: Array<{
  value: DepthModel;
  label: string;
  blurb: string;
  badge: string;
}> = [
  {
    value: DepthModel.LOCAL_SERVER,
    label: "Local Server",
    blurb: "Depth-Anything-V2 vía FastAPI local",
    badge: "Recomendado",
  },
  {
    value: DepthModel.HUGGINGFACE,
    label: "Hugging Face",
    blurb: "Spaces · cloud, gratis con token",
    badge: "Cloud",
  },
  {
    value: DepthModel.OPENAI,
    label: "OpenAI",
    blurb: "GPT Image · API key requerida",
    badge: "API Key",
  },
];

const Controls: React.FC<ControlsProps> = ({
  config,
  onConfigChange,
  processing,
  hasData,
  onRegenerate,
}) => {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(hasOpenAIApiKey());

  const [showHfTokenInput, setShowHfTokenInput] = useState(false);
  const [hfTokenInput, setHfTokenInput] = useState("");
  const [hasHfToken, setHasHfToken] = useState(hasHuggingFaceToken());

  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");
  const [showServerConfig, setShowServerConfig] = useState(false);

  useEffect(() => {
    setHasApiKey(hasOpenAIApiKey());
    setHasHfToken(hasHuggingFaceToken());
  }, [config.depthModel]);

  useEffect(() => {
    if (config.depthModel !== DepthModel.LOCAL_SERVER) return;
    let cancelled = false;
    setServerStatus("checking");
    checkServerHealth().then((online) => {
      if (!cancelled) setServerStatus(online ? "online" : "offline");
    });
    return () => {
      cancelled = true;
    };
  }, [config.depthModel, serverUrl]);

  const update = <K extends keyof ProcessingConfig>(
    key: K,
    value: ProcessingConfig[K]
  ) => onConfigChange({ ...config, [key]: value });

  const handleSaveServerUrl = () => {
    setServerUrl(serverUrl);
    setShowServerConfig(false);
    setServerStatus("checking");
    checkServerHealth().then((online) =>
      setServerStatus(online ? "online" : "offline")
    );
  };

  const handleSaveHfToken = () => {
    if (!hfTokenInput.trim()) return;
    setHuggingFaceToken(hfTokenInput.trim());
    setHasHfToken(true);
    setShowHfTokenInput(false);
    setHfTokenInput("");
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    setOpenAIApiKey(apiKeyInput.trim());
    setHasApiKey(true);
    setShowApiKeyInput(false);
    setApiKeyInput("");
  };

  const renderProviderCard = (p: typeof PROVIDERS[number]) => {
    const selected = config.depthModel === p.value;
    return (
      <label
        key={p.value}
        className={`relative flex items-start gap-3 rounded-sm p-3 cursor-pointer transition-colors group ${
          processing ? "opacity-60 cursor-not-allowed" : ""
        } ${
          selected
            ? "bg-white/[0.07] border border-white/25"
            : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10"
        }`}
      >
        <input
          type="radio"
          name="depthModel"
          value={p.value}
          checked={selected}
          disabled={processing}
          onChange={(e) => update("depthModel", e.target.value as DepthModel)}
          className="sr-only"
        />
        <div
          className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${
            selected ? "border-white" : "border-white/25 group-hover:border-white/40"
          }`}
        >
          {selected && <div className="w-1.5 h-1.5 bg-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className={`text-sm font-semibold ${selected ? "text-white" : "text-zinc-200"}`}>
              {p.label}
            </div>
            <span className="text-[10px] tracking-wider uppercase font-mono px-1.5 py-0.5 rounded-sm border bg-white/5 text-white/60 border-white/10">
              {p.badge}
            </span>
          </div>
          <div className="text-xs text-zinc-400">{p.blurb}</div>
        </div>
      </label>
    );
  };

  return (
    <div className="space-y-5">
      {/* Provider section */}
      <section className="space-y-2.5">
        <SectionTitle icon={IconCpu} label="Depth Model" />

        <div className="flex flex-col gap-2">
          {PROVIDERS.map(renderProviderCard)}
        </div>

        {/* Provider-specific config panels */}
        {config.depthModel === DepthModel.LOCAL_SERVER && (
          <div className="rounded-sm p-3 space-y-2 bg-white/[0.02] border border-white/8 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <StatusPill status={serverStatus} />
              <button
                type="button"
                onClick={() => setShowServerConfig((v) => !v)}
                className="text-[11px] font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-sm hover:bg-white/5"
              >
                {showServerConfig ? "Cerrar" : "Configurar URL"}
              </button>
            </div>
            {showServerConfig && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrlState(e.target.value)}
                  placeholder="/depth-api o http://host:8000"
                  className="w-full bg-black/30 border border-white/10 text-zinc-200 text-sm rounded-sm focus:ring-1 focus:ring-white/40 focus:border-white/30 block p-2 font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="w-full py-1.5 px-3 rounded-sm text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors"
                >
                  Guardar y verificar
                </button>
              </div>
            )}
            {serverStatus === "offline" && !showServerConfig && (
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                Levanta el backend con{" "}
                <code className="font-mono text-white bg-white/5 px-1.5 py-0.5 rounded-sm">
                  python server.py
                </code>{" "}
                en <code className="font-mono text-white">backend/</code>.
              </div>
            )}
          </div>
        )}

        {config.depthModel === DepthModel.HUGGINGFACE && (
          <div className="rounded-sm p-3 space-y-2 bg-white/[0.02] border border-white/8 animate-fade-in">
            <p className="text-[11px] text-zinc-400">
              Token opcional para más cuota{" "}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="text-white hover:text-zinc-300 underline-offset-2 hover:underline"
              >
                (huggingface.co/settings/tokens)
              </a>
            </p>
            {hasHfToken ? (
              <CredentialPill
                label="Token configurado"
                onClear={() => {
                  clearHuggingFaceToken();
                  setHasHfToken(false);
                }}
              />
            ) : showHfTokenInput ? (
              <CredentialInput
                placeholder="hf_..."
                value={hfTokenInput}
                onChange={setHfTokenInput}
                onSave={handleSaveHfToken}
                onCancel={() => {
                  setShowHfTokenInput(false);
                  setHfTokenInput("");
                }}
              />
            ) : (
              <SetupButton onClick={() => setShowHfTokenInput(true)}>
                Agregar token (más cuota)
              </SetupButton>
            )}
          </div>
        )}

        {config.depthModel === DepthModel.OPENAI && (
          <div className="rounded-sm p-3 space-y-2 bg-white/[0.02] border border-white/8 animate-fade-in">
            <p className="text-[11px] text-zinc-400">
              Necesitas una API key de OpenAI con acceso a Images.
            </p>
            {hasApiKey ? (
              <CredentialPill
                label="API key configurada"
                onClear={() => {
                  clearOpenAIApiKey();
                  setHasApiKey(false);
                }}
              />
            ) : showApiKeyInput ? (
              <CredentialInput
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={setApiKeyInput}
                onSave={handleSaveApiKey}
                onCancel={() => {
                  setShowApiKeyInput(false);
                  setApiKeyInput("");
                }}
              />
            ) : (
              <SetupButton onClick={() => setShowApiKeyInput(true)}>
                Configurar API key
              </SetupButton>
            )}
          </div>
        )}
      </section>

      {/* Point cloud sliders */}
      <section className="space-y-4 pt-4 border-t border-white/5">
        <SectionTitle icon={IconDots} label="Point Cloud" />

        <Slider
          label="Depth Exaggeration"
          value={config.depthScale}
          display={`${config.depthScale.toFixed(1)}×`}
          min={1}
          max={20}
          step={0.5}
          disabled={processing}
          onChange={(v) => update("depthScale", v)}
        />

        <Slider
          label="Point Size"
          value={config.pointSize}
          display={config.pointSize.toFixed(2)}
          min={0.01}
          max={0.5}
          step={0.01}
          disabled={processing}
          onChange={(v) => update("pointSize", v)}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-zinc-300">Sample Rate</label>
            <span className="text-[11px] font-mono text-white tabular-nums">{config.sampleRate}px</span>
          </div>
          <p className="text-[11px] text-zinc-500 mb-2">Higher = faster · Lower = more detail</p>
          <select
            value={config.sampleRate}
            onChange={(e) => update("sampleRate", parseInt(e.target.value, 10))}
            disabled={processing}
            className="w-full bg-black/30 border border-white/10 text-zinc-200 text-sm rounded-sm focus:ring-1 focus:ring-white/40 focus:border-white/30 p-2.5 outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="1">1 — Highest quality</option>
            <option value="2">2 — Balanced</option>
            <option value="4">4 — High performance</option>
            <option value="8">8 — Draft</option>
          </select>
        </div>
      </section>

      {hasData && (
        <button
          onClick={onRegenerate}
          disabled={processing}
          className="w-full py-2.5 px-4 rounded-sm font-semibold text-sm flex items-center justify-center gap-2 transition-colors bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconRefresh />
          Re-procesar nube
        </button>
      )}
    </div>
  );
};

export default Controls;

/* -------- internal subcomponents -------- */

const SectionTitle: React.FC<{ icon: React.FC; label: string }> = ({ icon: Icon, label }) => (
  <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
    <span className="w-5 h-5 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-white">
      <Icon />
    </span>
    {label}
  </h3>
);

const StatusPill: React.FC<{ status: ServerStatus }> = ({ status }) => {
  const map = {
    checking: { dot: "bg-zinc-400 animate-pulse", text: "text-zinc-300", label: "Verificando…" },
    online: { dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]", text: "text-emerald-300", label: "Servidor en línea" },
    offline: { dot: "bg-rose-400", text: "text-rose-300", label: "Servidor offline" },
  }[status];
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${map.dot}`} />
      <span className={map.text}>{map.label}</span>
    </div>
  );
};

const CredentialPill: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <div className="flex items-center justify-between p-2 rounded-sm bg-white/[0.04] border border-white/10">
    <div className="flex items-center gap-2 text-xs text-zinc-200">
      <IconCheck />
      {label}
    </div>
    <button
      onClick={onClear}
      className="text-[11px] font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-sm hover:bg-white/5"
    >
      Eliminar
    </button>
  </div>
);

const CredentialInput: React.FC<{
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ value, onChange, placeholder, onSave, onCancel }) => (
  <div className="space-y-2">
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-black/30 border border-white/10 text-zinc-200 text-sm rounded-sm focus:ring-1 focus:ring-white/40 focus:border-white/30 p-2 font-mono outline-none"
    />
    <div className="flex gap-2">
      <button
        onClick={onSave}
        className="flex-1 py-1.5 px-3 rounded-sm text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors"
      >
        Guardar
      </button>
      <button
        onClick={onCancel}
        className="py-1.5 px-3 rounded-sm text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
      >
        Cancelar
      </button>
    </div>
  </div>
);

const SetupButton: React.FC<React.PropsWithChildren<{ onClick: () => void }>> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full py-2 px-3 rounded-sm text-sm font-medium bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 text-zinc-200 transition-colors flex items-center justify-center gap-2"
  >
    <IconKey />
    {children}
  </button>
);

const Slider: React.FC<{
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
}> = ({ label, value, display, min, max, step, disabled, onChange }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-xs font-medium text-zinc-300">{label}</label>
      <span className="text-[11px] font-mono text-white tabular-nums">{display}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

/* -------- inline icons -------- */

const IconCpu = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
  </svg>
);

const IconDots = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
    <circle cx="6" cy="6" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" />
    <circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" />
    <circle cx="6" cy="18" r="1.5" /><circle cx="12" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const IconKey = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="15" r="4" />
    <path d="M10.85 12.15L19 4M18 5l3 3M15 8l3 3" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);
