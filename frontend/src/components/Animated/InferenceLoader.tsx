import React from "react";
import { Activity } from "lucide-react";

interface InferenceLoaderProps {
  text?: string;
  subtext?: string;
  fullscreen?: boolean;
}

export const InferenceLoader: React.FC<InferenceLoaderProps> = ({
  text = "Loading BharatSim workspace...",
  subtext = "Calibrating device profiles & execution state",
  fullscreen = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 transition-all ${
        fullscreen ? "fixed inset-0 z-50 bg-[#09090b]/85 backdrop-blur-md" : "min-h-[260px] w-full"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        {/* Pulsing radar rings */}
        <div className="absolute h-20 w-20 rounded-full border border-emerald-500/25 animate-ping opacity-40" />
        <div className="absolute h-16 w-16 rounded-full border border-emerald-500/35 animate-pulse" />
        <div className="absolute h-12 w-12 rounded-full bg-emerald-500/10 backdrop-blur-sm" />
        
        {/* Core spinning indicator */}
        <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/50 bg-[#12131a] shadow-[0_0_24px_rgba(16,185,129,0.35)]">
          <Activity size={20} className="text-emerald-400 animate-spin" />
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="font-mono text-xs font-semibold tracking-wider text-emerald-400 uppercase">
          {text}
        </div>
        {subtext && (
          <div className="mt-1.5 text-xs text-slate-400 font-sans max-w-sm">
            {subtext}
          </div>
        )}
      </div>

      {/* Metric telemetry pulse indicator */}
      <div className="mt-4 flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 font-mono text-[10px] text-emerald-300/80">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Telemetry Stream Active</span>
      </div>
    </div>
  );
};

export default InferenceLoader;
