import React from "react";

export interface BadgeProps {
  variant?: "neutral" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  size = "md",
  dot = false,
  children,
  className = "",
}) => {
  const variantStyles = {
    neutral: {
      background: "var(--bg-surface-elevated, #121A2B)",
      color: "var(--text-secondary, #A1AAC0)",
      borderColor: "var(--border-subtle, #1A2540)",
      dotColor: "var(--text-muted, #727F98)",
    },
    accent: {
      background: "rgba(118, 103, 248, 0.1)",
      color: "#9A8BFF",
      borderColor: "rgba(118, 103, 248, 0.3)",
      dotColor: "#7667F8",
    },
    success: {
      background: "rgba(54, 201, 149, 0.1)",
      color: "#36C995",
      borderColor: "rgba(54, 201, 149, 0.3)",
      dotColor: "#36C995",
    },
    warning: {
      background: "rgba(244, 184, 92, 0.1)",
      color: "#F4B85C",
      borderColor: "rgba(244, 184, 92, 0.3)",
      dotColor: "#F4B85C",
    },
    danger: {
      background: "rgba(241, 109, 120, 0.1)",
      color: "#F16D78",
      borderColor: "rgba(241, 109, 120, 0.3)",
      dotColor: "#F16D78",
    },
  }[variant];

  const sizeStyle = size === "sm" ? { padding: "2px 6px", fontSize: "0.68rem" } : { padding: "3px 8px", fontSize: "0.75rem" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${className}`}
      style={{
        background: variantStyles.background,
        color: variantStyles.color,
        borderColor: variantStyles.borderColor,
        lineHeight: 1.2,
        letterSpacing: "0.02em",
        ...sizeStyle,
      }}
    >
      {dot && (
        <span
          className="rounded-full shrink-0"
          style={{
            width: size === "sm" ? 5 : 6,
            height: size === "sm" ? 5 : 6,
            background: variantStyles.dotColor,
          }}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
