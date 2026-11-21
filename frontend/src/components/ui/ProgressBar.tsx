import React from "react";

export interface ProgressBarProps {
  value: number; // 0 to 100
  color?: "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = "accent",
  size = "md",
  label,
  showPercent = false,
  className = "",
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const height = {
    sm: 4,
    md: 8,
    lg: 12,
  }[size];

  const colorStyle = {
    accent: "linear-gradient(90deg, #7667F8, #9A8BFF)",
    success: "linear-gradient(90deg, #36C995, #6EE7B7)",
    warning: "linear-gradient(90deg, #F4B85C, #FCD34D)",
    danger: "linear-gradient(90deg, #F16D78, #F87171)",
  }[color];

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
          {label && (
            <span style={{ color: "var(--text-muted, #727F98)" }}>{label}</span>
          )}
          {showPercent && (
            <span style={{ color: "var(--text-secondary, #A1AAC0)" }}>
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height,
          background: "var(--bg-surface-elevated, #121A2B)",
          border: "1px solid var(--border-subtle, #1A2540)",
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${clampedValue}%`,
            background: colorStyle,
          }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
