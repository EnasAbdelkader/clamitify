import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./VideoModal.css";

export type VideoSource =
  | { kind: "iframe"; src: string }
  | { kind: "file"; src: string };

/**
 * بيحوّل رابط فيديو عادي لمصدر ينفع يتعرض جوه الـ Popup:
 *  - Google Drive  → /preview
 *  - YouTube       → /embed
 *  - ملف mp4/webm  → <video>
 * أي رابط تاني بيرجع null (المستدعي بيفتحه في تبويب جديد بدل الـ Popup).
 */
export function resolveVideoSource(url: string | undefined | null): VideoSource | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;

  // ملف محلي من public/ أو رابط مباشر لملف فيديو
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(raw) && (raw.startsWith("/") || /^https:\/\//i.test(raw))) {
    return { kind: "file", src: raw };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "drive.google.com") {
    const id = /\/file\/d\/([\w-]+)/.exec(parsed.pathname)?.[1] ?? parsed.searchParams.get("id");
    return id ? { kind: "iframe", src: `https://drive.google.com/file/d/${id}/preview` } : null;
  }

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      parsed.searchParams.get("v") ?? /\/(?:embed|shorts)\/([\w-]+)/.exec(parsed.pathname)?.[1] ?? null;
    return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }

  return null;
}

interface VideoModalProps {
  title: string;
  source: VideoSource;
  onClose: () => void;
}

/** Popup فيديو: Escape للإغلاق، قفل تمرير الصفحة، وإرجاع الفوكس للزر اللي فتحه. */
export const VideoModal: React.FC<VideoModalProps> = ({ title, source, onClose }) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="video-modal-overlay" onClick={onClose} data-lenis-prevent>
      <div
        className="video-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="video-modal-header">
          <h3 className="video-modal-title">{title}</h3>
          <button
            type="button"
            ref={closeBtnRef}
            className="video-modal-close"
            onClick={onClose}
            aria-label={isAr ? "إغلاق الفيديو" : "Close video"}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="video-modal-frame">
          {source.kind === "iframe" ? (
            <iframe
              src={source.src}
              title={title}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video src={source.src} controls autoPlay playsInline />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
