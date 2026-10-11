import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuthStore } from "../../store/useAuthStore";
import { setScrollLocked } from "./scrollController";
import {
  Menu, X, Sun, Moon, Globe, Leaf, Home, Info, LayoutGrid, Calendar,
  BookOpen, Briefcase, Mail, Newspaper, Gamepad2, LayoutDashboard, User, Handshake
} from "lucide-react";
import "./Header.css";

interface HeaderProps {
  isHome?: boolean;
}

const MOBILE_PANEL_ID = "mobile-nav-panel";

/** ما يمكن التركيز عليه داخل الدرج — لحصر التركيز (focus trap). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Header: React.FC<HeaderProps> = ({ isHome = false }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isMemberAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  // فشل تحميل صورة الشعار — بيتصفّر لما المصدر يتغير مع الثيم، عشان فشل
  // شبكة عابر ما يخفيش الشعار للأبد بعد تبديل المظهر.
  const [logoFailed, setLogoFailed] = useState(false);
  const location = useLocation();

  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    setLogoFailed(false);
  }, [theme]);

  /**
   * سلوك النافذة الحوارية للدرج: حصر التركيز، Escape للإغلاق، قفل تمرير
   * الصفحة، وإعادة التركيز إلى الزر الذي فتح الدرج عند الإغلاق.
   */
  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // نُثبّت المرجع الآن لأنه غير متاح بأمان داخل دالة التنظيف
    const hamburger = hamburgerRef.current;

    // قفل التمرير: body لخلفية الصفحة، و Lenis لأنه يقود التمرير بنفسه.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setScrollLocked(true);

    // ننتظر إطاراً واحداً حتى يصبح الدرج مرئياً فعلاً قبل نقل التركيز.
    const focusFrame = requestAnimationFrame(() => closeBtnRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }

      const active = document.activeElement;
      const insidePanel = active instanceof Node && panel.contains(active);

      if (event.shiftKey) {
        if (!insidePanel || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!insidePanel || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      setScrollLocked(false);
      // إعادة التركيز لمصدره حتى لا يعود مستخدم الكيبورد إلى أول الصفحة.
      const target = previouslyFocused && document.contains(previouslyFocused)
        ? previouslyFocused
        : hamburger;
      target?.focus?.();
    };
  }, [isOpen]);

  // إغلاق الدرج عند أي تنقل (بما فيه الرجوع/التقدّم في المتصفح).
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navItems = useMemo(
    () => [
      { path: "/", label: t("home"), icon: <Home size={14} /> },
      { path: "/about", label: t("about"), icon: <Info size={14} /> },
      { path: "/programs", label: t("programs"), icon: <LayoutGrid size={14} /> },
      { path: "/events", label: t("events"), icon: <Calendar size={14} /> },
      { path: "/learning-hub", label: t("learningHub"), icon: <BookOpen size={14} /> },
      // كانت هذه المسارات موجودة فعلياً في الراوتر بلا أي رابط يوصل إليها.
      { path: "/media", label: t("media"), icon: <Newspaper size={14} /> },
      { path: "/games", label: t("gamesHub"), icon: <Gamepad2 size={14} /> },
      { path: "/opportunities", label: t("opportunities"), icon: <Briefcase size={14} /> },
      { path: "/partners", label: t("partners"), icon: <Handshake size={14} /> },
      { path: "/contact", label: t("contact"), icon: <Mail size={14} /> },
    ],
    [t]
  );

  /** المسار نشط أيضاً على صفحاته الفرعية (‎/media ← /blog/:id‎ يظل مستقلاً). */
  const isActivePath = useCallback(
    (path: string) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname]
  );

  const handleLangToggle = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const themeToggleLabel =
    theme === "light"
      ? language === "ar" ? "تشغيل المظهر الداكن" : "Switch to dark mode"
      : language === "ar" ? "تشغيل المظهر الفاتح" : "Switch to light mode";

  const langToggleLabel = language === "ar" ? "Switch to English" : "التبديل إلى العربية";

  const dashboardLabel = t("dashboard");

  const mobileNavPortal = (
    <div
      className={`mobile-nav-overlay ${isOpen ? "open" : ""}`}
      onClick={closeMenu}
      data-lenis-prevent
    >
      <div
        className="mobile-nav-panel"
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
        id={MOBILE_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-label={language === "ar" ? "قائمة التنقل" : "Navigation menu"}
      >
        <div className="mobile-panel-header">
          <span className="mobile-brand-title">Climatify</span>
          <button
            type="button"
            onClick={closeMenu}
            ref={closeBtnRef}
            aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"}
          >
            <X size={22} />
          </button>
        </div>
        {/* data-lenis-prevent وإلا التقط Lenis عجلة الماوس ولم تعد القائمة تُمرَّر */}
        <nav
          className="mobile-nav-links"
          aria-label={language === "ar" ? "التنقل الرئيسي" : "Main Navigation"}
          data-lenis-prevent
        >
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-item ${isActivePath(item.path) ? "active" : ""}`}
              aria-current={isActivePath(item.path) ? "page" : undefined}
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/dashboard"
            className={`mobile-nav-item ${isActivePath("/dashboard") ? "active" : ""}`}
            aria-current={isActivePath("/dashboard") ? "page" : undefined}
            onClick={closeMenu}
          >
            {dashboardLabel}
          </Link>
          <Link to="/contact" className="btn btn-primary mobile-join-btn" onClick={closeMenu}>
            {t("joinMovement")}
          </Link>
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <header className={`site-header glass ${isScrolled ? "scrolled" : ""} ${!isHome ? "not-home" : ""}`}>
        <div className="container header-container">
          <Link to="/" className="logo-area" aria-label="Climatify — Home">
            {logoFailed ? (
              <div className="logo-placeholder">
                <Leaf size={20} className="logo-icon-svg" />
                <span>Climatify</span>
              </div>
            ) : (
              <img
                src={theme === "light" ? "/logo-dark.png" : "/logo-white.png"}
                alt="Climatify"
                className="header-logo"
                onError={() => setLogoFailed(true)}
              />
            )}
          </Link>

          {/* قائمة التنقل للشاشات الكبيرة */}
          <nav className="desktop-nav" aria-label={language === "ar" ? "التنقل الرئيسي" : "Main Navigation"}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item-link ${isActivePath(item.path) ? "active" : ""}`}
                aria-current={isActivePath(item.path) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* أدوات التحكم (اللغة، المظهر، لوحة التحكم، زر الحركة) */}
          <div className="header-actions-group">
            {/* تبديل المظهر */}
            <button
              type="button"
              onClick={toggleTheme}
              className="action-icon-btn"
              title={themeToggleLabel}
              aria-label={themeToggleLabel}
              aria-pressed={theme === "dark"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* تبديل اللغة */}
            <button
              type="button"
              onClick={handleLangToggle}
              className="action-icon-btn lang-btn"
              title={langToggleLabel}
              aria-label={langToggleLabel}
            >
              <Globe size={18} />
              <span className="lang-text-badge" aria-hidden="true">
                {language === "ar" ? "EN" : "AR"}
              </span>
            </button>

            {/* لوحة التحكم أو تسجيل الدخول */}
            <Link
              to={isMemberAuthenticated ? "/dashboard" : "/login"}
              className={`action-icon-btn dashboard-action-btn ${isActivePath(isMemberAuthenticated ? "/dashboard" : "/login") ? "active" : ""}`}
              title={isMemberAuthenticated ? dashboardLabel : (language === "ar" ? "تسجيل الدخول" : "Sign In")}
              aria-label={isMemberAuthenticated ? dashboardLabel : (language === "ar" ? "تسجيل الدخول" : "Sign In")}
              aria-current={isActivePath(isMemberAuthenticated ? "/dashboard" : "/login") ? "page" : undefined}
            >
              {isMemberAuthenticated ? <LayoutDashboard size={18} /> : <User size={18} />}
            </Link>

            <Link to="/contact" className="btn btn-primary join-action-btn">
              {t("joinMovement")}
            </Link>

            {/* زر الموبايل */}
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="mobile-menu-hamburger-btn"
              ref={hamburgerRef}
              aria-label={
                isOpen
                  ? language === "ar" ? "إغلاق القائمة" : "Close menu"
                  : language === "ar" ? "فتح القائمة" : "Open menu"
              }
              aria-expanded={isOpen}
              aria-controls={MOBILE_PANEL_ID}
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* بورتال القائمة الجانبية للموبايل خارج الهيدر لضمان الظهور والـ positioning السليم */}
      {typeof document !== "undefined" && createPortal(mobileNavPortal, document.body)}
    </>
  );
};
