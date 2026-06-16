import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "../../lib/hooks";

export function Modal({
  children,
  title,
  onClose,
  isOpen,
  className = "",
  size = "md",
}) {
  const modalRef = useRef(null);

  // Focus trap
  useFocusTrap(modalRef);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: "w-full max-w-sm",
    md: "w-full max-w-2xl",
    lg: "w-full max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`bg-white rounded-2xl shadow-2xl ${sizes[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 id="modal-title" className="text-xl font-bold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
              type="button"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
