import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { Award, BookOpen, Calendar, Settings, User, Trophy, TreeDeciduous, CheckCircle, Info, AlertCircle, LogOut } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { USE_MOCK_API } from "../../services/api";
import { AnalyticsChart } from "../../components/ui/AnalyticsChart";
import { EmptyState } from "../../components/ui/EmptyState";
import { RouteLoader } from "../../components/common/RouteLoader";
import "./Dashboard.css";

/**
 * لوحة العضو تعتمد على جلسة عضو صالحة (isMemberAuthenticated).
 * في حالة عدم وجود جلسة، يتم التوجيه إلى صفحة تسجيل الدخول / إنشاء حساب.
 * في وضع الـ mock تكون البيانات توضيحية بغرض العرض التجريبي.
 */
function hasMemberSession(): boolean {
  if (USE_MOCK_API) return true;
  try {
    return Boolean(window.localStorage.getItem("user_token"));
  } catch {
    // التخزين متقفل — يبقى مفيش جلسة نقدر نتأكد منها
    return false;
  }
}

/** خلية CSV آمنة: بتلف النص في quotes وبتمنع تفسير Excel للصيغ. */
function csvCell(value: string | number): string {
  const raw = String(value ?? "");
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

const MAX_NAME = 120;
const MAX_CITY = 80;
const MAX_BIO = 500;

export const Dashboard: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [activeTab, setActiveTab] = useState<"overview" | "courses" | "events" | "profile">("overview");
  const [selectedYear, setSelectedYear] = useState<string>("2026");

  const {
    isMemberAuthenticated,
    profile,
    stats,
    recentActivities,
    registeredCourses,
    registeredEvents,
    loading,
    error,
    loadUserProfile,
    updateUserProfile,
    cancelEventRegistration,
    logoutMember
  } = useAuthStore();

  const sessionPresent = USE_MOCK_API || isMemberAuthenticated || hasMemberSession();

  // Local state for editing form inputs
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editBio, setEditBio] = useState("");
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  /** id الفعالية اللي مستنية تأكيد الإلغاء — تأكيد من خطوتين بدل إلغاء فوري */
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [eventsNotice, setEventsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionPresent) return;
    loadUserProfile();
  }, [sessionPresent, loadUserProfile]);

  // Sync inputs with profile data when loaded
  useEffect(() => {
    if (profile) {
      setEditName(profile.name);
      setEditCity(profile.city);
      setEditBio(profile.bio);
    }
  }, [profile]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileStatus === "loading") return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      const message = isAr ? "الاسم مطلوب." : "Your name is required.";
      setNameError(message);
      setProfileStatus("error");
      setProfileMessage(isAr ? "برجاء مراجعة الحقول المعلّمة." : "Please review the highlighted fields.");
      document.getElementById("profile-name")?.focus();
      return;
    }

    setNameError(null);
    setProfileStatus("loading");
    setProfileMessage(null);

    // الـ store بيرجّع boolean حالياً، بس بنتعامل بحذر مع { ok } كمان
    const result: unknown = await updateUserProfile({
      name: trimmedName,
      city: editCity.trim(),
      bio: editBio.trim()
    });
    const ok =
      typeof result === "boolean"
        ? result
        : Boolean(result && typeof result === "object" && (result as { ok?: unknown }).ok);

    if (ok) {
      setProfileStatus("success");
      setProfileMessage(isAr ? "تم حفظ التغييرات بنجاح!" : "Changes saved successfully!");
      return;
    }

    // رسالة الخطأ الجاهزة بتتحفظ في الـ store وقت الفشل
    const storeError = useAuthStore.getState().error;
    setProfileStatus("error");
    setProfileMessage(storeError || (isAr ? "تعذّر حفظ التغييرات. حاول مرة أخرى." : "Could not save your changes. Please try again."));
  };

  // تصدير التقرير البيئي بصيغة CSV
  const exportCSVReport = () => {
    if (!profile || !stats) return;
    const csvRows: (string | number)[][] = [
      ["Metric", "Value"],
      ["User Name", profile.name],
      ["Email", profile.email],
      ["Eco Points", stats.ecoPoints],
      ["Virtual Trees", stats.virtualTrees],
      ["Badges", stats.earnedBadges],
      ["Year Filter", selectedYear],
      ["Report Date", new Date().toISOString()]
    ];

    // ﻿ = BOM، عشان Excel يقرا الأسماء العربية صح
    const csvContent = "﻿" + csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Climatify_Impact_Report_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── 0. مفيش جلسة عضو ─────────────────────────────────────────
  if (!sessionPresent) {
    return (
      <div className="dashboard-gate container">
        <EmptyState
          type="unauthorized"
          titleEn="Sign in to see your dashboard"
          titleAr="سجّل دخولك لعرض لوحتك الشخصية"
          descriptionEn="This page shows your eco points, courses and event tickets. Sign in or create a member account to track your progress."
          descriptionAr="الصفحة دي بتعرض نقاطك ومساقاتك وتذاكرك البيئية. سجّل دخولك أو أنشئ حساباً لمتابعة تقدّمك."
          actionEn="Sign In"
          actionAr="تسجيل الدخول"
          to="/login"
        />
        <div style={{ textAlign: "center", marginTop: "16px", display: "flex", justifyContent: "center", gap: "12px" }}>
          <Link to="/register" className="btn btn-ghost">
            {isAr ? "إنشاء حساب جديد" : "Create Account"}
          </Link>
        </div>
      </div>
    );
  }

  // ── 1. تحميل ─────────────────────────────────────────────────
  if (loading && !profile) {
    return <RouteLoader label={isAr ? "جارٍ تحميل لوحتك…" : "Loading your dashboard…"} />;
  }

  // ── 2. فشل التحميل ───────────────────────────────────────────
  if (!profile || !stats) {
    return (
      <div className="dashboard-gate container">
        <EmptyState
          type={error ? "error" : "no-data"}
          titleEn={error ? "We couldn't load your dashboard" : "Your dashboard is empty"}
          titleAr={error ? "تعذّر تحميل لوحتك الشخصية" : "لوحتك الشخصية فاضية"}
          descriptionEn={error ?? "No profile data came back from the server."}
          descriptionAr={error ?? "السيرفر مرجّعش بيانات للملف الشخصي."}
          actionEn="Try again"
          actionAr="إعادة المحاولة"
          onAction={() => {
            void loadUserProfile();
          }}
        />
      </div>
    );
  }

  // بيانات التحليلات بناءً على السنة المختارة
  // TODO(backend): مفيش endpoint لحساب الأثر المناخي الشخصي —
  // القيم دي ثابتة في الكود ومعروضة كـ "بيانات توضيحية" في الواجهة.
  // المطلوب: GET /api/user/impact?year=<yyyy> يرجّع [{ labelAr, labelEn, value }].
  const getYearlyData = () => {
    if (selectedYear === "2024") {
      return [
        { labelEn: "Q1 2024", labelAr: "الربع الأول 2024", value: 3.1 },
        { labelEn: "Q2 2024", labelAr: "الربع الثاني 2024", value: 3.8 },
        { labelEn: "Q3 2024", labelAr: "الربع الثالث 2024", value: 4.5 },
        { labelEn: "Q4 2024", labelAr: "الربع الرابع 2024", value: 5.0 },
      ];
    }
    if (selectedYear === "2025") {
      return [
        { labelEn: "Q1 2025", labelAr: "الربع الأول 2025", value: 5.2 },
        { labelEn: "Q2 2025", labelAr: "الربع الثاني 2025", value: 5.9 },
        { labelEn: "Q3 2025", labelAr: "الربع الثالث 2025", value: 6.4 },
        { labelEn: "Q4 2025", labelAr: "الربع الرابع 2025", value: 7.1 },
      ];
    }
    return [
      { labelEn: "Month 1", labelAr: "الشهر 1", value: 6.2 },
      { labelEn: "Month 2", labelAr: "الشهر 2", value: 5.8 },
      { labelEn: "Month 3", labelAr: "الشهر 3", value: 5.1 },
      { labelEn: "Month 4", labelAr: "الشهر 4", value: 4.8 },
    ];
  };

  return (
    <div className="dashboard-container container">
      {/* Sidebar navigation */}
      <aside className="dashboard-sidebar card">
        <div className="user-profile-summary">
          <div className="avatar-large" aria-hidden="true"><User size={24} /></div>
          <h3>{profile.name}</h3>
          <p>{profile.email}</p>
        </div>

        <nav className="dashboard-nav-menu" aria-label={isAr ? "أقسام اللوحة" : "Dashboard sections"}>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            aria-current={activeTab === "overview" ? "page" : undefined}
            className={`dash-nav-btn ${activeTab === "overview" ? "active" : ""}`}
          >
            <Award size={18} aria-hidden="true" />
            <span>{isAr ? "نظرة عامة" : "Overview"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("courses")}
            aria-current={activeTab === "courses" ? "page" : undefined}
            className={`dash-nav-btn ${activeTab === "courses" ? "active" : ""}`}
          >
            <BookOpen size={18} aria-hidden="true" />
            <span>{isAr ? "مساقاتي التعليمية" : "My Courses"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("events")}
            aria-current={activeTab === "events" ? "page" : undefined}
            className={`dash-nav-btn ${activeTab === "events" ? "active" : ""}`}
          >
            <Calendar size={18} aria-hidden="true" />
            <span>{isAr ? "فعالياتي" : "My Events"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            aria-current={activeTab === "profile" ? "page" : undefined}
            className={`dash-nav-btn ${activeTab === "profile" ? "active" : ""}`}
          >
            <Settings size={18} aria-hidden="true" />
            <span>{isAr ? "الملف الشخصي" : "Edit Profile"}</span>
          </button>
          <button
            type="button"
            onClick={() => logoutMember()}
            className="dash-nav-btn dash-logout-btn"
            style={{ marginTop: "12px", color: "var(--danger)" }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{isAr ? "تسجيل الخروج" : "Sign Out"}</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main-content">
        {activeTab === "overview" && (
          <div className="dash-overview-tab">
            <div className="dash-overview-topbar">
              <div>
                <h2>{isAr ? "مرحباً بك يا climatifier!" : "Welcome back, Climatifier!"}</h2>
                <p className="lead">
                  {isAr
                    ? "إليك ملخص نشاطك البيئي ورقمنة جهودك المناخية."
                    : "Here is a summary of your environmental activities."}
                </p>
              </div>

              {/* أدوات التقرير والتصفية */}
              <div className="dash-report-tools">
                <label className="sr-only" htmlFor="dash-year-filter">
                  {isAr ? "اختر السنة" : "Select year"}
                </label>
                <select
                  id="dash-year-filter"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="form-control dash-year-select"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>

                <button type="button" className="btn btn-primary btn-sm" onClick={exportCSVReport}>
                  {isAr ? "تصدير التقرير (CSV)" : "Export Report (CSV)"}
                </button>
              </div>
            </div>

            {/* بطاقات الإحصائيات الفردية للأعضاء */}
            <div className="user-stats-cards-grid">
              <div className="stats-metric-card card">
                <span className="metric-icon" aria-hidden="true"><Trophy size={20} /></span>
                <div>
                  <h4>{isAr ? "النقاط البيئية" : "Eco Points"}</h4>
                  <p className="num">{stats.ecoPoints}</p>
                </div>
              </div>

              <div className="stats-metric-card card">
                <span className="metric-icon" aria-hidden="true"><TreeDeciduous size={20} /></span>
                <div>
                  <h4>{isAr ? "الأشجار الافتراضية" : "Virtual Trees"}</h4>
                  <p className="num">{stats.virtualTrees}</p>
                </div>
              </div>

              <div className="stats-metric-card card">
                <span className="metric-icon" aria-hidden="true"><Award size={20} /></span>
                <div>
                  <h4>{isAr ? "الشارات المحرزة" : "Earned Badges"}</h4>
                  <p className="num">{stats.earnedBadges}</p>
                </div>
              </div>
            </div>

            {/* Visual Charts Grid for User Progress */}
            <div className="dash-chart-block">
              {/* الرسم ده بيانات نموذجية — مش أرقام حقيقية للعضو */}
              <p className="dash-sample-data-note" role="note">
                <Info size={14} aria-hidden="true" />
                <span>
                  {isAr
                    ? "بيانات توضيحية: لسه مفيش قياس فعلي لأثرك المناخي الشخصي، فالرسم ده نموذج للعرض فقط."
                    : "Sample data: your personal climate impact isn't measured yet, so this chart is illustrative only."}
                </span>
              </p>

              <AnalyticsChart
                type="line"
                titleEn={`Carbon Emission Reduction Trend (${selectedYear})`}
                titleAr={`معدل خفض الانبعاثات الكربونية (${selectedYear})`}
                subtitleEn="Sample data — illustrative climate impact trajectory"
                subtitleAr="بيانات توضيحية — نموذج لتطور الأثر المناخي"
                data={getYearlyData()}
                unitEn="Tons"
                unitAr="طن"
                primaryColor="#00C091"
                secondaryColor="#009AF8"
              />
            </div>

            {/* الأنشطة الأخيرة */}
            <div className="recent-activities-box card dash-block-spaced">
              <h3>{isAr ? "الأنشطة الأخيرة" : "Recent Activity"}</h3>
              {recentActivities.length === 0 ? (
                <EmptyState
                  compact
                  type="no-data"
                  titleEn="No recent activity"
                  titleAr="لا توجد نشاطات مؤخراً"
                  descriptionEn="Complete a lesson or join an event and it will show up here."
                  descriptionAr="أكمل درساً أو سجّل في فعالية ليظهر نشاطك هنا."
                />
              ) : (
                <ul className="activities-list">
                  {recentActivities.map((act) => (
                    <li key={act.id}>
                      <span className="activity-icon" aria-hidden="true"><CheckCircle size={16} /></span>
                      <div>
                        <strong>{isAr ? act.titleAr : act.titleEn}</strong>
                        <p>{isAr ? act.detailAr : act.detailEn}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "courses" && (
          <div className="dash-courses-tab">
            <h2>{isAr ? "مساقاتي التعليمية النشطة" : "My Active Courses"}</h2>
            <div className="dash-courses-list card dash-block-spaced">
              {registeredCourses.length === 0 ? (
                <EmptyState
                  compact
                  type="empty"
                  titleEn="You're not enrolled in any course yet"
                  titleAr="غير مسجّل في أي مساق حالياً"
                  descriptionEn="Pick a free course from the academy and your progress will appear here."
                  descriptionAr="اختر مساقاً تدريبياً من الأكاديمية لمتابعة تقدّمك هنا."
                  actionEn="Browse the academy"
                  actionAr="استعرض الأكاديمية"
                  to="/learning-hub"
                />
              ) : (
                registeredCourses.map((c) => (
                  <div className="dash-course-row" key={c.id}>
                    <div>
                      <h4>{isAr ? c.titleAr : c.titleEn}</h4>
                      <p className="progress-lbl">{isAr ? `التقدم الحالي: ${c.progress}%` : `Current Progress: ${c.progress}%`}</p>
                    </div>
                    <div
                      className="dash-progress-fill-bar"
                      role="progressbar"
                      aria-valuenow={c.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={isAr ? c.titleAr : c.titleEn}
                    >
                      <div className="fill" style={{ width: `${c.progress}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div className="dash-events-tab">
            <h2>{isAr ? "فعالياتي المسجلة" : "My Registered Events"}</h2>

            {/* شرح صريح لحدود الإلغاء الحالية — مفيش endpoint لسه */}
            <p className="dash-local-only-note">
              <Info size={14} aria-hidden="true" />
              <span>
                {isAr
                  ? "يُحفظ الإلغاء على هذا الجهاز حالياً. لتأكيد الإلغاء نهائياً، يرجى مراسلتنا على info@climatify-youth.com."
                  : "Cancellations are recorded on this device only for now. To confirm a cancellation, email info@climatify-youth.com."}
              </span>
            </p>

            <p className="dash-events-notice" role="status" aria-live="polite">
              {eventsNotice}
            </p>

            <div className="dash-events-list card">
              {registeredEvents.length === 0 ? (
                <EmptyState
                  compact
                  type="empty"
                  titleEn="No registered events"
                  titleAr="لا توجد فعاليات مسجلة"
                  descriptionEn="Your tickets will be listed here once you register for an event."
                  descriptionAr="عند تسجيلك في أي فعالية، ستظهر تذكرتك وتفاصيلها هنا."
                  actionEn="Browse events"
                  actionAr="استعرض الفعاليات"
                  to="/events"
                />
              ) : (
                registeredEvents.map((e) => (
                  <div className="dash-event-row" key={e.id}>
                    <div>
                      <h4>{isAr ? e.titleAr : e.titleEn}</h4>
                      <p className="date-lbl">
                        <Calendar size={14} aria-hidden="true" />
                        <span>{e.date}</span>
                      </p>
                    </div>
                    <div className="dash-event-actions">
                      <span className="ticket-badge">
                        {isAr
                          ? (e.status === "Confirmed" ? "تذكرة مؤكدة" : e.status)
                          : `${e.status} Ticket`}
                      </span>

                      {confirmCancelId === e.id ? (
                        <span className="cancel-confirm-row">
                          <span className="cancel-confirm-q">
                            {isAr ? "متأكد من الإلغاء؟" : "Cancel this ticket?"}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm dash-danger-btn"
                            onClick={() => {
                              cancelEventRegistration(e.id);
                              setConfirmCancelId(null);
                              setEventsNotice(
                                isAr
                                  ? `تم إلغاء تسجيلك في «${e.titleAr}» على هذا الجهاز.`
                                  : `Your registration for "${e.titleEn}" was cancelled on this device.`
                              );
                            }}
                          >
                            {isAr ? "نعم، ألغِ" : "Yes, cancel"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setConfirmCancelId(null)}
                          >
                            {isAr ? "تراجع" : "Keep it"}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm dash-danger-btn"
                          onClick={() => {
                            setEventsNotice(null);
                            setConfirmCancelId(e.id);
                          }}
                        >
                          {isAr ? "إلغاء التسجيل" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="dash-profile-tab card">
            <h2>{isAr ? "تعديل بيانات الملف الشخصي" : "Edit Profile Details"}</h2>
            <form className="profile-edit-form dash-block-spaced" onSubmit={handleProfileSubmit} noValidate>
              {profileStatus === "error" && profileMessage && (
                <p className="dash-form-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{profileMessage}</span>
                </p>
              )}
              {profileStatus === "success" && profileMessage && (
                <p className="dash-form-success" role="status" aria-live="polite">
                  <CheckCircle size={16} aria-hidden="true" />
                  <span>{profileMessage}</span>
                </p>
              )}

              <div className="form-group">
                <label htmlFor="profile-name">{isAr ? "الاسم بالكامل" : "Full Name"}</label>
                <input
                  type="text"
                  id="profile-name"
                  name="name"
                  autoComplete="name"
                  maxLength={MAX_NAME}
                  required
                  disabled={profileStatus === "loading"}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "profile-name-error" : undefined}
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  className="form-control"
                />
                {nameError && (
                  <span className="dash-field-error" id="profile-name-error">{nameError}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="profile-email">{isAr ? "البريد الإلكتروني" : "Email Address"}</label>
                <input
                  type="email"
                  id="profile-email"
                  name="email"
                  autoComplete="email"
                  value={profile.email}
                  readOnly
                  disabled
                  aria-describedby="profile-email-hint"
                  className="form-control"
                />
                <span className="dash-field-hint" id="profile-email-hint">
                  {isAr ? "البريد الإلكتروني لا يمكن تعديله من هنا." : "Your email can't be changed from here."}
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="profile-city">{isAr ? "المدينة" : "City"}</label>
                <input
                  type="text"
                  id="profile-city"
                  name="city"
                  autoComplete="address-level2"
                  maxLength={MAX_CITY}
                  disabled={profileStatus === "loading"}
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile-bio">{isAr ? "نبذة تعريفية" : "Bio"}</label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  maxLength={MAX_BIO}
                  rows={4}
                  disabled={profileStatus === "loading"}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="form-control"
                />
                <span className="dash-field-hint">
                  {isAr ? `${editBio.length} / ${MAX_BIO} حرف` : `${editBio.length} / ${MAX_BIO} characters`}
                </span>
              </div>

              <button type="submit" className="btn btn-primary" disabled={profileStatus === "loading"}>
                {profileStatus === "loading"
                  ? (isAr ? "جارٍ الحفظ…" : "Saving…")
                  : (isAr ? "حفظ التغييرات" : "Save Changes")}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
