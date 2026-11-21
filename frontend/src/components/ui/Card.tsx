import React, { type HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "accent";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card: React.FC<CardProps> = ({
  variant = "default",
  padding = "md",
  children,
  className = "",
  ...props
}) => {
  const paddingClass = {
    none: "p-0",
    sm: "p-3",
    md: "p-5",
    lg: "p-7",
  }[padding];

  const variantClass = {
    default: "bg-surface border-subtle",
    elevated: "bg-surface-elevated border-subtle shadow-md",
    interactive: "bg-surface border-subtle hover-lift cursor-pointer",
    accent: "bg-surface border-accent shadow-accent",
  }[variant];

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${variantClass} ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
