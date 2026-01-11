import React from 'react';
import { ProcessingConfig } from '../types';

interface ControlsProps {
  config: ProcessingConfig;
  onConfigChange: (newConfig: ProcessingConfig) => void;
  disabled: boolean;
  onRegenerate: () => void;
  hasData: boolean;
}

const Controls: React.FC<ControlsProps> = ({ config, onConfigChange, disabled, onRegenerate, hasData }) => {
  
  const handleChange = (key: keyof ProcessingConfig, value: number) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Point Cloud Settings
      </h3>

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
            onChange={(e) => handleChange('depthScale', parseFloat(e.target.value))}
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
            onChange={(e) => handleChange('pointSize', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        <div>
           <label className="block text-sm font-medium text-slate-400 mb-1">
            Sample Rate ({config.sampleRate}px)
          </label>
          <div className="text-xs text-slate-500 mb-2">Higher = Faster, Lower = More Detail</div>
          <select 
             value={config.sampleRate}
             onChange={(e) => handleChange('sampleRate', parseInt(e.target.value))}
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-process Cloud
             </button>
          </div>
      )}
    </div>
  );
};

export default Controls;
