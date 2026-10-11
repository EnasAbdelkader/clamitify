import React, { useEffect, useId, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** أثناء تنفيذ الحذف: الزر المؤكد يعرض سبينر وكل منافذ الإغلاق مقفولة. */
  busy?: boolean;
}

/**
 * مربع تأكيد موحّد للوحة الأدمن بديل عن window.confirm —
 * نفس هوية المودال الاخرى (admin-cms-modal-overlay) مع دعم كيبورد كامل.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}) => {
  const titleId = useId();
  const messageId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="admin-cms-modal-overlay admin-confirm-overlay"
      onClick={busy ? undefined : onCancel}
      data-testid="admin-confirm-overlay"
    >
      <div
        className="admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-confirm-icon">
          <AlertTriangle size={24} />
        </div>
        <h3 className="admin-confirm-title" id={titleId}>
          {title}
        </h3>
        <p className="admin-confirm-message" id={messageId}>
          {message}
        </p>
        <div className="admin-confirm-actions">
          <button
            type="button"
            className="admin-btn-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="admin-btn-danger"
            onClick={onConfirm}
            disabled={busy}
            ref={confirmRef}
          >
            {busy && <Loader2 size={16} className="admin-spinner" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
