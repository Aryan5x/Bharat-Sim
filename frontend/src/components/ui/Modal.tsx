import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number | string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 640,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 flex items-center justify-center p-4 z-50 animate-fade-in"
      style={{
        background: "rgba(8, 11, 20, 0.75)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="modal-dialog w-full rounded-2xl border overflow-hidden shadow-2xl animate-scale-up"
        style={{
          maxWidth,
          background: "var(--bg-surface-elevated, #121A2B)",
          borderColor: "var(--border-subtle, #1A2540)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle) && (
          <div
            className="modal-header flex items-center justify-between p-5 border-b"
            style={{ borderColor: "var(--border-subtle, #1A2540)" }}
          >
            <div>
              {subtitle && (
                <span
                  className="block text-xs font-semibold tracking-wider uppercase mb-1"
                  style={{ color: "var(--accent-primary, #7667F8)" }}
                >
                  {subtitle}
                </span>
              )}
              {title && (
                <h3
                  className="text-lg font-bold"
                  style={{ color: "var(--text-primary, #F5F6FC)" }}
                >
                  {title}
                </h3>
              )}
            </div>
            <button
              type="button"
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface transition-colors cursor-pointer"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal-body p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
