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
    <div className={"inference-loader " + (fullscreen ? "fullscreen" : "")} role="status" aria-live="polite">
      <div className="inference-rings">
        <span className="ring ring-outer" />
        <span className="ring ring-mid" />
        <span className="ring ring-core" />
        <span className="inference-core">
          <Activity size={20} className="spin" />
        </span>
      </div>
      <div className="inference-text">
        <b>{text}</b>
        {subtext && <small>{subtext}</small>}
      </div>
    </div>
  );
};

export default InferenceLoader;
