import React, { useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import {
  Home, Info, LayoutGrid, Calendar, BookOpen, Briefcase, Handshake, Mail,
  Newspaper, Gamepad2, LayoutDashboard
} from "lucide-react";
import "./MobileBottomNav.css";

export const MobileBottomNav: React.FC = () => {
  const { t, language } = useLanguage();
  const location = useLocation();

  const navItems = useMemo(
    () => [
      { path: "/", label: t("home"), icon: <Home size={18} /> },
      { path: "/about", label: t("about"), icon: <Info size={18} /> },
      { path: "/programs", label: t("programs"), icon: <LayoutGrid size={18} /> },
      { path: "/events", label: t("events"), icon: <Calendar size={18} /> },
      { path: "/learning-hub", label: t("learningHub"), icon: <BookOpen size={18} /> },
      // مسارات حقيقية كانت بلا أي رابط يوصل إليها في الشِل
      { path: "/media", label: t("media"), icon: <Newspaper size={18} /> },
      { path: "/games", label: t("gamesHub"), icon: <Gamepad2 size={18} /> },
      { path: "/opportunities", label: t("opportunities"), icon: <Briefcase size={18} /> },
      { path: "/partners", label: t("partners"), icon: <Handshake size={18} /> },
      { path: "/dashboard", label: t("dashboard"), icon: <LayoutDashboard size={18} /> },
      { path: "/contact", label: t("contact"), icon: <Mail size={18} /> },
    ],
    [t]
  );

  const isActivePath = useCallback(
    (path: string) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname]
  );

  return (
    <nav
      className="mobile-bottom-nav-bar glass"
      aria-label={language === "ar" ? "شريط التنقل السفلي" : "Mobile bottom navigation"}
    >
      <div className="mobile-bottom-nav-scroll">
        {navItems.map((item) => {
          const active = isActivePath(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-bottom-tab ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-tab-icon" aria-hidden="true">{item.icon}</span>
              <span className="mobile-tab-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
