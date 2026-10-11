import React from "react";
import { Link } from "react-router-dom";
import { Inbox, SearchX, ServerCrash, FolderOpen, ShieldAlert } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./EmptyState.css";

export type EmptyStateType = "empty" | "no-results" | "error" | "no-data" | "unauthorized";

interface EmptyStateProps {
  type?: EmptyStateType;
  titleEn: string;
  titleAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  /** نص الزر بالإنجليزية — يُعرض فقط مع onAction أو to */
  actionEn?: string;
  /** نص الزر بالعربية — يُعرض فقط مع onAction أو to */
  actionAr?: string;
  /** يحوّل الأكشن لزر عادي */
  onAction?: () => void;
  /** يحوّل الأكشن لرابط داخلي (react-router) */
  to?: string;
  /** يصغّر الحشو للاستخدام داخل الكروت الضيقة */
  compact?: boolean;
  /** كلاس إضافي للحاوية */
  className?: string;
}

const iconMap: Record<EmptyStateType, React.ComponentType<{ size?: number }>> = {
  empty: FolderOpen,
  "no-results": SearchX,
  error: ServerCrash,
  "no-data": Inbox,
  unauthorized: ShieldAlert,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = "empty",
  titleEn,
  titleAr,
  descriptionEn,
  descriptionAr,
  actionEn,
  actionAr,
  onAction,
  to,
  compact = false,
  className,
}) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const Icon = iconMap[type] ?? FolderOpen;

  const title = (isAr ? titleAr : titleEn) || titleEn || titleAr;
  const description = isAr ? descriptionAr ?? descriptionEn : descriptionEn ?? descriptionAr;
  const actionLabel = isAr ? actionAr ?? actionEn : actionEn ?? actionAr;
  const hasAction = Boolean(actionLabel) && (Boolean(onAction) || Boolean(to));

  return (
    <div
      className={`empty-state-v2${compact ? " compact" : ""}${className ? ` ${className}` : ""}`}
      data-state-type={type}
      role="status"
      aria-live="polite"
    >
      <div className="empty-state-icon-wrap" aria-hidden="true">
        <Icon size={28} />
      </div>
      <h4 className="empty-state-title">{title}</h4>
      {description && <p className="empty-state-desc">{description}</p>}

      {hasAction && to && (
        <Link className="empty-state-action" to={to} onClick={onAction}>
          {actionLabel}
        </Link>
      )}
      {hasAction && !to && (
        <button type="button" className="empty-state-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};
