import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

/** الرابط لازم يكون https — أي حاجة تانية بتتعامل كأنه مش موجود. */
export const isUsableWhatsAppUrl = (url: string): boolean => /^https:\/\/\S+$/i.test(url.trim());

interface WhatsAppJoinPopupProps {
  url: string;
  onClose: () => void;
}

/** Popup "انضم عبر واتساب للحصول على الفرص" — Escape للإغلاق وإرجاع الفوكس بعده. */
export const WhatsAppJoinPopup: React.FC<WhatsAppJoinPopupProps> = ({ url, onClose }) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const joinRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    joinRef.current?.focus();

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
    <div className="opps-modal-overlay" onClick={onClose} data-lenis-prevent>
      <div
        className="whatsapp-popup-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="whatsapp-popup-close"
          onClick={onClose}
          aria-label={isAr ? "إغلاق" : "Close"}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <span className="whatsapp-popup-icon" aria-hidden="true">
          <MessageCircle size={32} />
        </span>
        <h3 id="whatsapp-popup-title">
          {isAr ? "انضم إلينا على واتساب" : "Join us on WhatsApp"}
        </h3>
        <p>
          {isAr
            ? "انضم الآن للحصول على أحدث فرص التدريب والتطوع والوظائف أول بأول."
            : "Join now to get the latest internships, volunteering roles and jobs as soon as they open."}
        </p>

        <a
          ref={joinRef}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-full-width whatsapp-popup-join"
          onClick={onClose}
        >
          <MessageCircle size={18} aria-hidden="true" />
          <span>{isAr ? "انضم عبر واتساب" : "Join on WhatsApp"}</span>
          <span className="sr-only">{isAr ? "(يفتح في نافذة جديدة)" : "(opens in a new tab)"}</span>
        </a>
      </div>
    </div>,
    document.body
  );
};
