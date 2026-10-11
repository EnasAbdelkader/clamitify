import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import {
  TrendingUp,
  Users,
  Calendar,
  FileText,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FlaskConical,
  PieChart,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useCMSStore } from "../../store/useCMSStore";
import { AnalyticsChart } from "../../components/ui/AnalyticsChart";
import type { AdminActivity } from "../../types";
import { useChartColors } from "./adminUtils";

type LoadStatus = "loading" | "error" | "ready";

/**
 * الـ endpoint بيرجّع القيم كنصوص معروضة ("1,240" / "87%").
 * بنحاول نطلّع منها رقم للرسم البياني، وبنرجّع null لو مش رقم — أحسن من رسم
 * قيمة مخترعة.
 */
function parseMetric(value: string): number | null {
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export const AdminDashboardHome: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const chartColors = useChartColors();

  const cmsStats = useCMSStore((state) => state.stats);
  const analytics = useCMSStore((state) => state.analytics);
  const loadAdminStats = useCMSStore((state) => state.loadAdminStats);
  const loadAdminAnalytics = useCMSStore((state) => state.loadAdminAnalytics);

  const [status, setStatus] = useState<LoadStatus>("loading");
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
      await Promise.all([loadAdminStats(), loadAdminAnalytics()]);
      if (!mounted.current) return;

      const state = useCMSStore.getState();
      if (state.error && !state.stats && state.analytics.length === 0) {
        setErrorMsg(state.error);
        setStatus("error");
        return;
      }
      setStatus("ready");
    } catch (err) {
      if (!mounted.current) return;
      setErrorMsg(err instanceof Error ? err.message : (isAr ? "تعذّر تحميل بيانات اللوحة." : "Failed to load dashboard data."));
      setStatus("error");
    }
  }, [loadAdminStats, loadAdminAnalytics, isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  // تاريخ اليوم بلغة الواجهة — بيتحسب وقت العرض مش ثابت في الكود.
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [isAr]
  );

  const statsCards = useMemo(
    () => [
      {
        key: "visitors",
        labelEn: "Total Visitors",
        labelAr: "إجمالي الزوار",
        value: cmsStats?.totalVisitors ?? "—",
        icon: <TrendingUp size={20} />,
        color: "green" as const,
      },
      {
        key: "members",
        labelEn: "Active Members",
        labelAr: "الأعضاء النشطين",
        value: cmsStats?.activeMembers ?? "—",
        icon: <Users size={20} />,
        color: "blue" as const,
      },
      {
        key: "events",
        labelEn: "Upcoming Events",
        labelAr: "فعاليات قادمة",
        value: cmsStats?.upcomingEvents ?? "—",
        icon: <Calendar size={20} />,
        color: "amber" as const,
      },
      {
        key: "posts",
        labelEn: "Published Posts",
        labelAr: "مقالات منشورة",
        value: cmsStats?.publishedPosts ?? "—",
        icon: <FileText size={20} />,
        color: "green" as const,
      },
    ],
    [cmsStats]
  );

  const recentActivities: AdminActivity[] = useMemo(() => {
    const list = cmsStats?.recentActivities;
    return Array.isArray(list) ? list : [];
  }, [cmsStats]);

  /**
   * AdminActivity مالهاش id، والـ index مش مفتاح آمن لأن القائمة بتتقلب ترتيبها
   * مع كل تحديث. بنشتق مفتاح من المحتوى نفسه، وبنفرّق المتكرر برقم تسلسلي.
   */
  const activityKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return recentActivities.map((activity) => {
      const base = `${activity.textEn}|${activity.textAr}|${activity.timeEn}`;
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      return occurrence === 1 ? base : `${base}#${occurrence}`;
    });
  }, [recentActivities]);

  /** الدونات بتتغذى من /admin/analytics — بس البنود اللي قيمتها رقم فعلاً. */
  const analyticsChartData = useMemo(
    () =>
      analytics
        .map((item) => {
          const value = parseMetric(item.value);
          return value === null ? null : { labelEn: item.labelEn, labelAr: item.labelAr, value };
        })
        .filter((item): item is { labelEn: string; labelAr: string; value: number } => item !== null && item.value > 0),
    [analytics]
  );

  // TODO(backend): مفيش endpoint لسلسلة زمنية شهرية (زي GET /admin/analytics/traffic).
  // الأرقام دي عيّنة توضيحية ومعلّمة كده صراحة في الواجهة.
  const trafficSampleData = [
    { labelEn: "Jan", labelAr: "يناير", value: 850 },
    { labelEn: "Feb", labelAr: "فبراير", value: 1200 },
    { labelEn: "Mar", labelAr: "مارس", value: 1850 },
    { labelEn: "Apr", labelAr: "أبريل", value: 2400 },
    { labelEn: "May", labelAr: "مايو", value: 3100 },
    { labelEn: "Jun", labelAr: "يونيو", value: 3900 },
    { labelEn: "Jul", labelAr: "يوليو", value: 4520 },
  ];

  const QuickLinkIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <div>
      {/* Welcome Banner */}
      <section className="admin-welcome-banner">
        <div className="admin-welcome-content">
          <span className="admin-welcome-date">{todayLabel}</span>
          <h2 className="admin-page-title">
            <span>{isAr ? "مرحباً بك، مسؤول النظام" : "Welcome back, Admin"}</span>
          </h2>
          <p className="admin-page-subtitle">
            {isAr
              ? "إليك نظرة عامة على أداء المنصة اليوم والإحصائيات التفاعلية"
              : "Here's an overview of your platform today & real-time analytics"}
          </p>
          <div className="admin-welcome-actions">
            <Link to="/admin/content" className="admin-add-btn sm">
              <FileText size={15} />
              <span>{isAr ? "إدارة المحتوى" : "Manage Content"}</span>
            </Link>
            <a href="/" className="admin-btn-cancel sm">
              <span>{isAr ? "عرض الموقع" : "View Website"}</span>
              <QuickLinkIcon size={15} />
            </a>
          </div>
        </div>
        <div className="admin-welcome-decor" aria-hidden="true" />
      </section>

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

      {status === "loading" && (
        <div className="admin-card admin-mb-24">
          <div className="admin-loading-block" role="status">
            <Loader2 size={18} className="admin-spinner" />
            <span>{isAr ? "جاري تحميل بيانات اللوحة..." : "Loading dashboard data..."}</span>
          </div>
        </div>
      )}

      {status === "ready" && (
        <>
          {/* Stats Grid */}
          <div className="admin-stats-grid">
            {statsCards.map((stat) => (
              <div key={stat.key} className="admin-stat-card">
                <div className={`admin-stat-icon ${stat.color}`}>{stat.icon}</div>
                <div className="admin-stat-info">
                  <h4>{isAr ? stat.labelAr : stat.labelEn}</h4>
                  <span className="admin-stat-number">{stat.value}</span>
                </div>
              </div>
            ))}
          </div>

          {!cmsStats && (
            <div className="admin-alert warning" role="status">
              <AlertTriangle size={16} />
              <span>
                {isAr
                  ? "أرقام البطاقات مش متاحة دلوقتي — الخادم ما رجّعش إحصائيات."
                  : "Tile figures are unavailable — the server returned no statistics."}
              </span>
              <span className="admin-alert-actions">
                <button type="button" className="admin-add-btn sm" onClick={() => void load()}>
                  <RefreshCw size={14} />
                  <span>{isAr ? "إعادة المحاولة" : "Retry"}</span>
                </button>
              </span>
            </div>
          )}

          {/* Visual Charts Grid */}
          <div className="admin-charts-grid">
            <div>
              <span className="admin-sample-badge">
                <FlaskConical size={12} />
                {isAr ? "بيانات عيّنة — لسه مش متوصّلة بالخادم" : "Sample data — not yet wired to the server"}
              </span>
              <AnalyticsChart
                type="line"
                titleEn="Monthly Platform Visitors"
                titleAr="نمو زوار المنصة الشهري"
                subtitleEn="Illustrative sample — no monthly traffic endpoint yet"
                subtitleAr="عيّنة توضيحية — مفيش endpoint للزيارات الشهرية لحد دلوقتي"
                data={trafficSampleData}
                unitEn="visitors"
                unitAr="زائر"
                primaryColor={chartColors.primary}
                secondaryColor={chartColors.secondary}
              />
            </div>

            {analyticsChartData.length > 0 ? (
              <AnalyticsChart
                type="donut"
                titleEn="Platform Metrics"
                titleAr="مؤشرات المنصة"
                subtitleEn="Live figures from /admin/analytics"
                subtitleAr="أرقام حيّة من /admin/analytics"
                data={analyticsChartData}
                primaryColor={chartColors.primary}
                secondaryColor={chartColors.secondary}
              />
            ) : (
              <div className="admin-card">
                <div className="admin-empty-state">
                  <div className="icon"><PieChart size={32} /></div>
                  <p>
                    {isAr
                      ? "مفيش مؤشرات رقمية للعرض من /admin/analytics."
                      : "No numeric metrics to chart from /admin/analytics."}
                  </p>
                  <div className="admin-empty-actions">
                    <button type="button" className="admin-add-btn sm" onClick={() => void load()}>
                      <RefreshCw size={14} />
                      <span>{isAr ? "إعادة المحاولة" : "Retry"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity Timeline */}
          <div className="admin-card admin-mt-20">
            <div className="admin-card-header">
              <span className="admin-card-title">
                {isAr ? "النشاط الأخير" : "Recent Activity"}
              </span>
            </div>
            <div className="admin-card-body-padded">
              {recentActivities.length === 0 ? (
                <div className="admin-empty-state compact">
                  <p>{isAr ? "لا توجد نشاطات مؤخراً." : "No recent activity."}</p>
                </div>
              ) : (
                <ul className="admin-timeline">
                  {recentActivities.map((activity, i) => (
                    <li key={activityKeys[i] ?? `${activity.textEn}-${i}`} className="admin-timeline-item">
                      <span className="admin-timeline-dot" aria-hidden="true" />
                      <span className="admin-timeline-text">
                        {isAr ? activity.textAr : activity.textEn}
                      </span>
                      <span className="admin-timeline-time">
                        {isAr ? activity.timeAr : activity.timeEn}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
