import React from "react";

export interface SkeletonProps {
  variant?: "text" | "card" | "circle" | "rect";
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "text",
  width,
  height,
  className = "",
}) => {
  const baseClasses = "skeleton animate-pulse";
  const variantClasses = {
    text: "skeleton-text",
    card: "skeleton-card",
    circle: "rounded-full",
    rect: "rounded-lg",
  }[variant];

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${className}`}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
        background: "var(--bg-surface-elevated, #121A2B)",
      }}
    />
  );
};

export default Skeleton;
