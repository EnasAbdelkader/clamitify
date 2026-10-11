import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuthStore } from "../../store/useAuthStore";
import { useCMSStore } from "../../store/useCMSStore";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Bell,
  X,
  Users,
  TrendingUp,
  Ticket,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FlaskConical,
  Sun,
  Moon,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { AdminLogin } from "./AdminLogin";
import type { AdminLoginResult } from "./AdminLogin";
import { AdminDashboardHome } from "./AdminDashboardHome";
import { AdminContent } from "./AdminContent";
import { AdminMessages } from "./AdminMessages";
import { AdminSettings } from "./AdminSettings";
import { AnalyticsChart } from "../../components/ui/AnalyticsChart";
import { RouteLoader } from "../../components/common/RouteLoader";
import { useChartColors } from "./adminUtils";
import "./admin.css";

type AdminTab = "dashboard" | "content" | "messages" | "analytics" | "settings";

/** ألوان أيقونات بطاقات الإحصائيات بالتناوب. */
const STAT_TONES = ["green", "blue", "amber", "green"] as const;

export const AdminLayout: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const isAr = language === "ar";
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, loginAdmin, logoutAdmin, initializeAuth } = useAuthStore();
  const loadMessages = useCMSStore((state) => state.loadMessages);
  const unreadCount = useCMSStore((state) => state.messages.filter((m) => !m.isRead).length);

  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    setAuthReady(true);
    return unsubscribe;
  }, [initializeAuth]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void loadMessages();
  }, [authReady, isAuthenticated, loadMessages]);

  const getTabFromPath = (path: string): AdminTab => {
    const segment = path.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
    if (segment === "content" || segment === "messages" || segment === "analytics" || segment === "settings") {
      return segment;
    }
    return "dashboard";
  };

  const activeTab = getTabFromPath(location.pathname);

  const handleTabChange = (tab: AdminTab) => {
    setSidebarOpen(false);
    if (tab === "dashboard") {
      navigate("/admin");
    } else {
      navigate(`/admin/${tab}`);
    }
  };

  const handleLogin = (email: string, password: string): Promise<AdminLoginResult> =>
    loginAdmin(email, password);

  const handleLogout = () => {
    logoutAdmin();
    navigate("/admin");
  };

  const navItems: {
    id: AdminTab;
    labelEn: string;
    labelAr: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: "dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم", icon: <LayoutDashboard size={18} /> },
    { id: "content", labelEn: "Content", labelAr: "إدارة المحتوى", icon: <FileText size={18} /> },
    { id: "messages", labelEn: "Messages", labelAr: "الرسائل", icon: <MessageSquare size={18} />, badge: unreadCount },
    { id: "analytics", labelEn: "Analytics", labelAr: "التحليلات", icon: <BarChart3 size={18} /> },
    { id: "settings", labelEn: "Settings", labelAr: "الإعدادات", icon: <Settings size={18} /> },
  ];

  const pageTitle = (() => {
    const item = navItems.find((n) => n.id === activeTab);
    return isAr ? (item?.labelAr ?? "") : (item?.labelEn ?? "");
  })();

  // عنوان التبويب في المتصفح يعكس الصفحة الحالية بدل عنوان الموقع العام.
  useEffect(() => {
    document.title = `${pageTitle} · Climatify Admin`;
  }, [pageTitle]);

  if (!authReady) {
    return <RouteLoader />;
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="admin-layout">
      {/* Mobile Overlay */}
      <div
        className={`admin-sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}
        aria-label={isAr ? "تنقل لوحة التحكم" : "Admin navigation"}
      >
        <div className="admin-sidebar-brand">
          <img src="/logo-white.png" alt="Climatify" />
          <span className="admin-sidebar-brand-text">
            Climatify
            <span className="admin-sidebar-badge">CMS</span>
          </span>
          <button
            type="button"
            className="admin-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label={isAr ? "إغلاق القائمة الجانبية" : "Close sidebar"}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          <span className="admin-nav-section-label">
            {isAr ? "القائمة الرئيسية" : "Main Menu"}
          </span>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-btn ${activeTab === item.id ? "active" : ""}`}
              onClick={() => handleTabChange(item.id)}
              aria-current={activeTab === item.id ? "page" : undefined}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span>{isAr ? item.labelAr : item.labelEn}</span>
              {(item.badge ?? 0) > 0 ? (
                <span className="admin-nav-badge">
                  {item.badge}
                  <span className="sr-only">
                    {isAr ? " رسالة غير مقروءة" : " unread messages"}
                  </span>
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-avatar">
              <ShieldCheck size={18} />
            </div>
            <div className="admin-sidebar-user-info">
              <div className="admin-sidebar-user-name">
                {isAr ? "مسؤول النظام" : "System Admin"}
              </div>
              <div className="admin-sidebar-user-role">admin@climatify.org</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="admin-main-area">
        {/* Top Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label={isAr ? "فتح القائمة الجانبية" : "Open sidebar"}
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar"
            >
              <Menu size={19} />
            </button>
            <div className="admin-topbar-heading">
              <h1 className="admin-topbar-title">{pageTitle}</h1>
              <span className="admin-topbar-crumb">Climatify CMS</span>
            </div>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-lang-toggle" role="group" aria-label={isAr ? "تغيير اللغة" : "Switch language"}>
              <button
                type="button"
                className={`admin-lang-option ${isAr ? "active" : ""}`}
                onClick={() => setLanguage("ar")}
                aria-pressed={isAr}
              >
                ع
              </button>
              <button
                type="button"
                className={`admin-lang-option ${!isAr ? "active" : ""}`}
                onClick={() => setLanguage("en")}
                aria-pressed={!isAr}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              className="admin-topbar-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? (isAr ? "الوضع الفاتح" : "Light Mode") : (isAr ? "الوضع الداكن" : "Dark Mode")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <a className="admin-topbar-btn admin-topbar-site" href="/" title={isAr ? "عرض الموقع" : "View website"}>
              <ExternalLink size={17} />
              <span className="sr-only">{isAr ? "عرض الموقع" : "View website"}</span>
            </a>

            <button
              type="button"
              className="admin-topbar-btn admin-topbar-bell"
              onClick={() => handleTabChange("messages")}
              aria-label={
                isAr
                  ? `الإشعارات — ${unreadCount} رسالة غير مقروءة`
                  : `Notifications — ${unreadCount} unread messages`
              }
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="admin-topbar-badge" aria-hidden="true">
                  {unreadCount > 9 ? "+9" : unreadCount}
                </span>
              )}
            </button>

            <button type="button" className="admin-logout-btn" onClick={handleLogout}>
              <LogOut size={16} />
              <span>{isAr ? "خروج" : "Logout"}</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-content">
          {activeTab === "dashboard" && <AdminDashboardHome />}
          {activeTab === "content" && <AdminContent />}
          {activeTab === "messages" && <AdminMessages />}
          {activeTab === "analytics" && <AdminAnalyticsPage />}
          {activeTab === "settings" && <AdminSettings />}
        </main>
      </div>
    </div>
  );
};

/* Analytics Page — connected to GET /api/admin/analytics through the CMS store */
const AdminAnalyticsPage: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { analytics, loadAdminAnalytics } = useCMSStore();
  const chartColors = useChartColors();

  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      await loadAdminAnalytics();
      if (!mounted.current) return;
      const { error, analytics: loaded } = useCMSStore.getState();
      if (error && loaded.length === 0) {
        setErrorMsg(error);
        setStatus("error");
        return;
      }
      setStatus("ready");
    } catch (err) {
      if (!mounted.current) return;
      setErrorMsg(err instanceof Error ? err.message : "Failed to load analytics");
      setStatus("error");
    }
  }, [loadAdminAnalytics]);

  useEffect(() => {
    void load();
  }, [load]);

  const getAnalyticIcon = (iconName: string, index: number) => {
    if (iconName === "BarChart3") return <BarChart3 size={20} />;
    if (iconName === "Users") return <Users size={20} />;
    if (iconName === "TrendingUp") return <TrendingUp size={20} />;
    if (iconName === "Ticket") return <Ticket size={20} />;

    const mod = index % 4;
    if (mod === 0) return <BarChart3 size={20} />;
    if (mod === 1) return <Users size={20} />;
    if (mod === 2) return <TrendingUp size={20} />;
    return <Ticket size={20} />;
  };

  // TODO(backend): مفيش endpoint للتوزيع الأسبوعي لحد دلوقتي.
  // الأرقام دي عيّنة توضيحية ومعلّمة كده في الواجهة عشان محدش يقراها كبيانات حقيقية.
  const weeklyVisitsSample = [
    { labelEn: "Mon", labelAr: "الإثنين", value: 180 },
    { labelEn: "Tue", labelAr: "الثلاثاء", value: 240 },
    { labelEn: "Wed", labelAr: "الأربعاء", value: 310 },
    { labelEn: "Thu", labelAr: "الخميس", value: 450 },
    { labelEn: "Fri", labelAr: "الجمعة", value: 290 },
    { labelEn: "Sat", labelAr: "السبت", value: 380 },
    { labelEn: "Sun", labelAr: "الأحد", value: 520 },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">
          <span>{isAr ? "تحليلات المنصة" : "Platform Analytics"}</span>
        </h2>
        <p className="admin-page-subtitle">
          {isAr ? "نظرة عامة على أداء المنصة والإحصائيات البيئية" : "Overview of platform performance & metrics"}
        </p>
      </div>

      {status === "loading" && (
        <div className="admin-card">
          <div className="admin-loading-block" role="status">
            <Loader2 size={18} className="admin-spinner" />
            <span>{isAr ? "جاري تحميل التحليلات..." : "Loading analytics..."}</span>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="admin-alert error" role="alert">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
          <span className="admin-alert-actions">
            <button type="button" className="admin-add-btn sm" onClick={() => void load()}>
              <RefreshCw size={14} />
              <span>{isAr ? "إعادة المحاولة" : "Retry"}</span>
            </button>
          </span>
        </div>
      )}

      {status === "ready" && analytics.length === 0 && (
        <div className="admin-card">
          <div className="admin-empty-state">
            <div className="icon"><BarChart3 size={32} /></div>
            <p>{isAr ? "لا توجد بيانات تحليلية بعد." : "No analytics data yet."}</p>
          </div>
        </div>
      )}

      {status === "ready" && analytics.length > 0 && (
        <div className="admin-stats-grid">
          {analytics.map((stat, i) => (
            <div key={`${stat.labelEn}-${i}`} className="admin-stat-card">
              <div className={`admin-stat-icon ${STAT_TONES[i % STAT_TONES.length] ?? "green"}`}>
                {getAnalyticIcon(stat.icon, i)}
              </div>
              <div className="admin-stat-info">
                <h4>{isAr ? stat.labelAr : stat.labelEn}</h4>
                <span className="admin-stat-number">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-mt-20">
        <span className="admin-sample-badge">
          <FlaskConical size={12} />
          {isAr ? "بيانات عيّنة — لسه مش متوصّلة بالخادم" : "Sample data — not yet wired to the server"}
        </span>
        <AnalyticsChart
          type="bar"
          titleEn="Weekly Traffic Distribution"
          titleAr="توزيع الزيارات الأسبوعية"
          subtitleEn="Illustrative sample — no endpoint behind this chart yet"
          subtitleAr="عيّنة توضيحية — مفيش endpoint وراها لحد دلوقتي"
          data={weeklyVisitsSample}
          unitEn="visits"
          unitAr="زيارة"
          primaryColor={chartColors.primary}
          secondaryColor={chartColors.secondary}
        />
      </div>
    </div>
  );
};
