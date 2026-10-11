import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import {
  Globe,
  ChevronDown,
  Info,
  Mail,
  Calendar,
  BookOpen,
  Briefcase,
  Users,
  Globe2,
} from "lucide-react";
import "./QuickAccessMenu.css";

/**
 * قائمة وصول سريع للهيدر. كل الروابط دي موجودة فعلاً كـ routes في App.tsx.
 * ملاحظة: الكومبوننت ده لسه مش متركّب في أي layout — راجع needsFollowUp.
 */
export const QuickAccessMenu: React.FC = () => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const isAr = language === "ar";

  // اقفل القائمة مع تغيير الصفحة
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // اقفل عند الضغط برّه أو بزرار Escape (مع رجوع الفوكس للزرار)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const quickLinks = [
    { to: "/about", labelEn: "About", labelAr: "من نحن", icon: <Info size={16} /> },
    { to: "/events", labelEn: "Events", labelAr: "فعاليات", icon: <Calendar size={16} /> },
    { to: "/learning-hub", labelEn: "Learning", labelAr: "تعلّم", icon: <BookOpen size={16} /> },
    { to: "/opportunities", labelEn: "Careers", labelAr: "فرص", icon: <Briefcase size={16} /> },
    { to: "/partners", labelEn: "Partners", labelAr: "الشركاء", icon: <Globe2 size={16} /> },
    { to: "/contact", labelEn: "Contact", labelAr: "تواصل", icon: <Mail size={16} /> },
    { to: "/dashboard", labelEn: "Dashboard", labelAr: "لوحتي", icon: <Users size={16} /> },
  ];

  return (
    <div className="quick-access-container" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="quick-access-btn glass"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isAr ? "قائمة الوصول السريع" : "Quick access menu"}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Globe size={16} aria-hidden="true" />
        <span>{isAr ? "وصول سريع" : "Quick"}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? "rotate" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <nav
          className="quick-access-dropdown glass"
          aria-label={isAr ? "التنقل السريع" : "Quick navigation"}
        >
          <div className="quick-access-group">
            <span className="group-label">{isAr ? "التنقل السريع" : "Quick Navigation"}</span>
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="quick-access-item"
                onClick={() => setIsOpen(false)}
              >
                <span aria-hidden="true" className="quick-access-item-icon">
                  {link.icon}
                </span>
                <span>{isAr ? link.labelAr : link.labelEn}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};
