import React from "react";
import { FolderX } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = "",
}) => {
  return (
    <div
      className={`dashboard-empty-state flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed ${className}`}
      style={{
        borderColor: "var(--border-subtle, #1A2540)",
        background: "rgba(13, 18, 32, 0.3)",
      }}
    >
      <div
        className="mb-3.5"
        style={{ color: "var(--text-muted, #727F98)", opacity: 0.7 }}
      >
        {icon || <FolderX size={36} />}
      </div>
      <b
        className="text-base font-semibold mb-1"
        style={{ color: "var(--text-secondary, #A1AAC0)" }}
      >
        {title}
      </b>
      {description && (
        <p
          className="text-sm max-w-sm mb-4"
          style={{ color: "var(--text-muted, #727F98)", lineHeight: 1.5 }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
