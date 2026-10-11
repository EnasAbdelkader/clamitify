import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError, sanitizeUrl } from "../../services/api";
import type { Opportunity, CareerNode } from "../../types";
import { EmptyState } from "../../components/ui/EmptyState";
import { WhatsAppJoinPopup, isUsableWhatsAppUrl } from "./WhatsAppJoinPopup";
import { WHATSAPP_OPPORTUNITIES_URL } from "../../data/links";
import { Briefcase, MapPin, Calendar, FileText, CheckCircle2, ChevronRight, GraduationCap, DollarSign, Award, MessageCircle } from "lucide-react";
import "./Opportunities.css";

/** رسالة خطأ جاهزة للعرض مهما كان نوع الخطأ الراجع من الـ API. */
const toErrorMessage = (err: unknown, language: string): string =>
  err instanceof ApiError
    ? err.localizedMessage(language)
    : language === "ar"
      ? "حدث خطأ غير متوقع."
      : "An unexpected error occurred.";

/**
 * ترجمة مستوى الطلب على المهنة.
 * الأنواع في TypeScript بتتمسح وقت التشغيل، فالسيرفر ممكن يبعت أي نص —
 * عشان كده في default آمن بدل ما نطبع الـ enum الإنجليزي للمستخدم العربي.
 */
const DEMAND_LABELS: Record<string, { ar: string; en: string }> = {
  high: { ar: "مطلوب", en: "High Demand" },
  medium: { ar: "متوسط الطلب", en: "Medium Demand" },
  urgent: { ar: "مطلوب بشدة", en: "Urgent Demand" },
};

const demandKey = (demand: unknown): string =>
  typeof demand === "string" ? demand.trim().toLowerCase() : "";

const demandLabel = (demand: unknown, language: string): string => {
  const entry = DEMAND_LABELS[demandKey(demand)];
  if (!entry) return language === "ar" ? "الطلب غير محدد" : "Demand N/A";
  return language === "ar" ? entry.ar : entry.en;
};

const demandClass = (demand: unknown): string => {
  const key = demandKey(demand);
  return key in DEMAND_LABELS ? key : "unknown";
};

/**
 * كل فلتر بيدوّر على كلمات مفتاحية في النوع الإنجليزي والعربي مع بعض،
 * عشان الفلترة تشتغل في اللغتين مهما كانت اللغة المختارة في الواجهة.
 */
const TYPE_FILTER_TOKENS: Record<string, string[]> = {
  Job: ["job", "full-time", "وظيفة", "وظائف", "توظيف"],
  Internship: ["internship", "intern", "تدريب"],
  Volunteering: ["volunteer", "volunteering", "تطوع"],
};

const matchesTypeFilter = (opp: Opportunity, filter: string): boolean => {
  if (filter === "all") return true;
  const tokens = TYPE_FILTER_TOKENS[filter];
  if (!tokens) return true;
  const en = typeof opp.typeEn === "string" ? opp.typeEn : "";
  const ar = typeof opp.typeAr === "string" ? opp.typeAr : "";
  const haystack = `${en} ${ar}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
};

const InlineLoader: React.FC<{ label: string }> = ({ label }) => (
  <div className="opps-status-block" role="status" aria-live="polite">
    <span className="opps-spinner" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);

/** مفتاح الجلسة: الـ Popup بيظهر تلقائي مرة واحدة بس لكل زيارة. */
const WHATSAPP_POPUP_SEEN_KEY = "climatify-whatsapp-popup-seen";

/** حالة الفورم الابتدائية — بنستخدمها عند الفتح والغلق عشان بيانات متقدم سابق ما تفضل عالقة. */
const EMPTY_APPLY_FORM = { name: "", email: "", portfolio: "", coverLetter: "" };

export const Opportunities: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [careers, setCareers] = useState<CareerNode[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<CareerNode | null>(null);
  const [loading, setLoading] = useState(true);
  // بنخزّن الخطأ نفسه مش نصه، عشان الرسالة تتترجم فوراً لو المستخدم غيّر اللغة
  // من غير ما نضطر نعيد طلب البيانات من السيرفر.
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // التحكم في نافذة التقديم للوظيفة
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [applyStatus, setApplyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyForm, setApplyForm] = useState(EMPTY_APPLY_FORM);
  const [filterType, setFilterType] = useState<string>("all");

  // ── Popup "انضم عبر واتساب للحصول على الفرص" ──
  const whatsAppEnabled = isUsableWhatsAppUrl(WHATSAPP_OPPORTUNITIES_URL);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const closeWhatsApp = useCallback(() => setShowWhatsApp(false), []);

  // بيظهر تلقائي بعد ثانية من فتح الصفحة، ومرة واحدة لكل جلسة عشان ما يضايقش الزائر.
  useEffect(() => {
    if (!whatsAppEnabled) return;
    try {
      if (sessionStorage.getItem(WHATSAPP_POPUP_SEEN_KEY) === "1") return;
    } catch {
      /* التخزين محجوب — نكمل ونعرضه */
    }
    const timer = setTimeout(() => {
      setShowWhatsApp(true);
      try {
        sessionStorage.setItem(WHATSAPP_POPUP_SEEN_KEY, "1");
      } catch {
        /* التخزين محجوب — هيظهر تاني في الزيارة الجاية بس */
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [whatsAppEnabled]);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const triggerBtnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchOpps = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [oppsData, careersData] = await Promise.all([
          apiService.getOpportunities(),
          apiService.getCareerPathways()
        ]);
        if (controller.signal.aborted) return;
        const safeOpps = Array.isArray(oppsData) ? oppsData : [];
        const safeCareers = Array.isArray(careersData) ? careersData : [];
        setOpportunities(safeOpps);
        setCareers(safeCareers);
        // safeCareers[0] نوعه CareerNode | undefined تحت noUncheckedIndexedAccess
        const firstCareer = safeCareers[0];
        setSelectedCareer(firstCareer ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(err);
        setOpportunities([]);
        setCareers([]);
        setSelectedCareer(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchOpps();
    return () => controller.abort();
  }, [reloadKey]);

  const retryLoad = useCallback(() => setReloadKey((key) => key + 1), []);

  const filteredOpportunities = useMemo(
    () => opportunities.filter((opp) => matchesTypeFilter(opp, filterType)),
    [opportunities, filterType]
  );

  // ── نافذة التقديم: فتح / غلق ──
  const closeModal = useCallback(() => {
    setSelectedOpp(null);
    setApplyStatus("idle");
    setApplyError(null);
    // مسح بيانات المتقدم عند الغلق — الغلق اليدوي كان بيسيب اسم/إيميل/
    // رابط السيرة عالقين في الفورم للنافذة الجاية (ومستخدم تاني على نفس الجهاز).
    setApplyForm(EMPTY_APPLY_FORM);
  }, []);

  // ممنوع الغلق أثناء الإرسال عشان المستخدم ما يفقدش الفورم في نص الطلب
  const requestClose = useCallback(() => {
    if (applyStatus === "loading") return;
    closeModal();
  }, [applyStatus, closeModal]);

  const openModal = useCallback((opp: Opportunity) => {
    // نحفظ الزرار اللي فتح النافذة عشان نرجّع الفوكس له بعد الغلق
    triggerBtnRef.current = document.activeElement as HTMLElement | null;
    setSelectedOpp(opp);
    setApplyStatus("idle");
    setApplyError(null);
  }, []);

  // Escape + قفل تمرير الصفحة + حصر الفوكس داخل النافذة + إرجاعه بعد الغلق
  useEffect(() => {
    if (!selectedOpp) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    const focusTimer = setTimeout(() => firstFieldRef.current?.focus(), 80);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      clearTimeout(focusTimer);
      triggerBtnRef.current?.focus();
    };
  }, [selectedOpp, requestClose]);

  // بعد النجاح: نفضي الفورم ونقفل النافذة — والمؤقّت بيتلغي لو الكومبوننت اتشال
  useEffect(() => {
    if (applyStatus !== "success") return;
    const timer = setTimeout(() => {
      // closeModal بيمسح الفورم كمان
      closeModal();
    }, 2500);
    return () => clearTimeout(timer);
  }, [applyStatus, closeModal]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp || applyStatus === "loading") return;

    const portfolio = sanitizeUrl(applyForm.portfolio);
    if (portfolio === "#invalid-url") {
      setApplyStatus("error");
      setApplyError(
        isAr
          ? "رابط السيرة الذاتية غير صالح. استخدم رابطاً عادياً يبدأ بـ http:// أو https://"
          : "That link is not valid. Please use a standard link starting with http:// or https://"
      );
      return;
    }

    setApplyStatus("loading");
    setApplyError(null);
    try {
      await apiService.applyToOpportunity({
        opportunityId: selectedOpp.id,
        name: applyForm.name,
        email: applyForm.email,
        portfolio,
        coverLetter: applyForm.coverLetter
      });
      setApplyStatus("success");
    } catch (err) {
      setApplyStatus("error");
      setApplyError(toErrorMessage(err, language));
    }
  };

  const loadErrorMessage = loadError ? toErrorMessage(loadError, language) : null;
  const submitting = applyStatus === "loading";

  return (
    <div className={`opportunities-page-container ${isAr ? "rtl" : ""}`}>

      {/* 1. Header Hero */}
      <section className="opps-hero-section text-center">
        <div className="container">
          <span className="eyebrow">
            {isAr ? "مسارات المستقبل الأخضر" : "Green Future Pathways"}
          </span>
          <h1 className="section-title">
            {isAr ? "بوابتك للعمل والتأثير المناخي" : "Your Gateway to Climate Action & Careers"}
          </h1>
          <p className="section-lead">
            {isAr
              ? "اكتشف فرص التدريب والتطوع والوظائف الخضراء، واستكشف مسارك المهني البيئي عبر خريطتنا التفاعلية."
              : "Discover internships, volunteering roles, and green careers. Map your environmental path with our interactive tools."}
          </p>
          {whatsAppEnabled && (
            <button
              type="button"
              className="btn btn-primary opps-whatsapp-btn"
              onClick={() => setShowWhatsApp(true)}
            >
              <MessageCircle size={18} aria-hidden="true" />
              <span>{isAr ? "انضم عبر واتساب للحصول على الفرص" : "Join on WhatsApp to get opportunities"}</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Interactive Green Career Map */}
      <section className="career-map-section section bg-gradient-brand-soft">
        <div className="container">
          <div className="section-header-alignment">
            <div>
              <span className="eyebrow">{isAr ? "أداة تفاعلية" : "Interactive Tool"}</span>
              <h2 className="section-title">
                {isAr ? "خريطة المهن الخضراء التفاعلية" : "Interactive Green Career Map"}
              </h2>
            </div>
            <p className="section-lead-inline">
              {isAr
                ? "اضغط على أي مهنة لاستكشاف مهاراتها المطلوبة، متوسط الراتب والمسار الدراسي المقترح للوصول إليها."
                : "Click on any career path to explore essential skills, average salaries, and suggested study routes."}
            </p>
          </div>

          {loading ? (
            <InlineLoader label={isAr ? "جارٍ تحميل خريطة المهن…" : "Loading career map…"} />
          ) : loadErrorMessage ? (
            <EmptyState
              type="error"
              titleEn="Could not load the career map"
              titleAr="تعذّر تحميل خريطة المهن"
              descriptionEn={loadErrorMessage}
              descriptionAr={loadErrorMessage}
              actionEn="Try again"
              actionAr="إعادة المحاولة"
              onAction={retryLoad}
            />
          ) : careers.length === 0 ? (
            <EmptyState
              type="no-data"
              titleEn="No career paths published yet"
              titleAr="لا توجد مسارات مهنية منشورة بعد"
              descriptionEn="We are still building this map. Check back soon."
              descriptionAr="ما زلنا نبني هذه الخريطة. تابعنا قريباً."
            />
          ) : (
            <div className="career-map-interactive-grid">
              {/* أزرار اختيار الوظائف كأنها نودز في خريطة */}
              <div className="career-nodes-container">
                {careers.map((career) => (
                  <button
                    key={career.id}
                    type="button"
                    className={`career-node-btn ${selectedCareer?.id === career.id ? "active" : ""}`}
                    onClick={() => setSelectedCareer(career)}
                    aria-pressed={selectedCareer?.id === career.id}
                  >
                    <div className="node-icon-wrapper">
                      <GraduationCap size={20} />
                    </div>
                    <div className="node-text">
                      <h4>{isAr ? career.titleAr : career.titleEn}</h4>
                      <span className={`demand-badge ${demandClass(career.demand)}`}>
                        {demandLabel(career.demand, language)}
                      </span>
                    </div>
                    <ChevronRight size={18} className="node-chevron" />
                  </button>
                ))}
              </div>

              {/* تفاصيل المهارات والراتب للمهنة المحددة */}
              {selectedCareer && (
                <div className="career-details-display-card card glass">
                  <div className="career-card-header">
                    <h3>{isAr ? selectedCareer.titleAr : selectedCareer.titleEn}</h3>
                    <span className="badge-green">{isAr ? "مهنة المستقبل" : "Future Career"}</span>
                  </div>

                  <div className="career-card-body">
                    <div className="info-row">
                      <DollarSign size={20} className="icon-green" />
                      <div>
                        <strong>{isAr ? "متوسط الدخل المقدر:" : "Average Estimated Salary:"}</strong>
                        <p>{(isAr ? selectedCareer.salaryAr : selectedCareer.salaryEn) || "—"}</p>
                      </div>
                    </div>

                    <div className="info-row">
                      <Award size={20} className="icon-green" />
                      <div>
                        <strong>{isAr ? "المهارات البيئية والتقنية المطلوبة:" : "Required Green & Tech Skills:"}</strong>
                        <div className="skills-pill-group">
                          {(() => {
                            // السيرفر ممكن يبعت الكارت من غير مصفوفة المهارات — من غير الحارس ده الصفحة كلها بتقع
                            const rawSkills = isAr ? selectedCareer.skillsAr : selectedCareer.skillsEn;
                            const skills = Array.isArray(rawSkills) ? rawSkills : [];
                            if (skills.length === 0) {
                              return (
                                <span className="skill-pill skill-pill-muted">
                                  {isAr ? "لم تُحدَّد المهارات بعد" : "Skills not listed yet"}
                                </span>
                              );
                            }
                            return skills.map((skill, i) => (
                              <span key={`${i}-${skill}`} className="skill-pill">{skill}</span>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="info-row">
                      <FileText size={20} className="icon-green" />
                      <div>
                        <strong>{isAr ? "المسار التعليمي المقترح:" : "Suggested Study Pathway:"}</strong>
                        <p>{(isAr ? selectedCareer.pathAr : selectedCareer.pathEn) || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. Opportunities Hub */}
      <section className="opportunities-hub-section section">
        <div className="container">
          <div className="text-center opps-hub-header">
            <span className="eyebrow">{isAr ? "فرص حالية" : "Current Openings"}</span>
            <h2 className="section-title">
              {isAr ? "بوابة التطوع والتدريب والوظائف" : "Internships, Jobs & Volunteer Hub"}
            </h2>
          </div>

          {/* أزرار الفلترة الحية حسب نوع الفرصة */}
          <div className="opps-filter-pills-row" role="group" aria-label={isAr ? "تصفية الفرص حسب النوع" : "Filter opportunities by type"}>
            <button
              type="button"
              className={`btn btn-sm ${filterType === "all" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterType("all")}
              aria-pressed={filterType === "all"}
            >
              {isAr ? "جميع الفرص" : "All Opportunities"}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterType === "Job" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterType("Job")}
              aria-pressed={filterType === "Job"}
            >
              {isAr ? "وظائف" : "Jobs"}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterType === "Internship" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterType("Internship")}
              aria-pressed={filterType === "Internship"}
            >
              {isAr ? "تدريب عملي" : "Internships"}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterType === "Volunteering" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterType("Volunteering")}
              aria-pressed={filterType === "Volunteering"}
            >
              {isAr ? "تطوع بيئي" : "Volunteering"}
            </button>
          </div>

          {loading ? (
            <InlineLoader label={isAr ? "جارٍ تحميل الفرص…" : "Loading opportunities…"} />
          ) : loadErrorMessage ? (
            <EmptyState
              type="error"
              titleEn="Could not load opportunities"
              titleAr="تعذّر تحميل الفرص"
              descriptionEn={loadErrorMessage}
              descriptionAr={loadErrorMessage}
              actionEn="Try again"
              actionAr="إعادة المحاولة"
              onAction={retryLoad}
            />
          ) : opportunities.length === 0 ? (
            <EmptyState
              type="no-data"
              titleEn="No opportunities are open right now"
              titleAr="لا توجد فرص متاحة حالياً"
              descriptionEn="New internships, jobs and volunteering roles are added regularly."
              descriptionAr="بننشر فرص تدريب وتطوع ووظائف جديدة بشكل مستمر، تابعنا قريباً."
            />
          ) : filteredOpportunities.length === 0 ? (
            <EmptyState
              type="no-results"
              titleEn="No opportunities in this category"
              titleAr="لا توجد فرص في هذا التصنيف"
              descriptionEn="Nothing matches this filter yet. Browse all the open opportunities instead."
              descriptionAr="لا توجد فرص مطابقة لهذا الفلتر حالياً. تصفّح كل الفرص المتاحة."
              actionEn="Show all opportunities"
              actionAr="عرض جميع الفرص"
              onAction={() => setFilterType("all")}
            />
          ) : (
            <div className="opps-cards-grid">
              {filteredOpportunities.map((opp) => (
                <div key={opp.id} className="opp-card-item card">
                  <div className="opp-card-header-row">
                    <div className="type-badge-container">
                      <Briefcase size={16} />
                      <span className="opp-type">
                        {isAr ? opp.typeAr : opp.typeEn}
                      </span>
                    </div>
                    <span className="opp-location">
                      <MapPin size={14} />
                      {isAr ? opp.locationAr : opp.locationEn}
                    </span>
                  </div>

                  <h3>{isAr ? opp.titleAr : opp.titleEn}</h3>
                  <p className="opp-desc">{isAr ? opp.descriptionAr : opp.descriptionEn}</p>

                  {opp.postedDate && (
                    <div className="opp-details-meta">
                      <span>
                        <Calendar size={14} />
                        {isAr ? `تاريخ النشر: ${opp.postedDate}` : `Posted: ${opp.postedDate}`}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-full-width"
                    onClick={() => openModal(opp)}
                  >
                    {isAr ? "تقديم طلب سريع" : "Apply Now"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. WhatsApp Join Popup — ما بيظهرش فوق نافذة التقديم */}
      {whatsAppEnabled && showWhatsApp && !selectedOpp && (
        <WhatsAppJoinPopup url={WHATSAPP_OPPORTUNITIES_URL.trim()} onClose={closeWhatsApp} />
      )}

      {/* 5. Apply Modal */}
      {selectedOpp && (
        <div className="opps-modal-overlay" onClick={requestClose}>
          <div
            ref={modalRef}
            className="opps-modal-card card glass animate-scale-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="opps-apply-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-row">
              <h3 id="opps-apply-title">
                {isAr ? "تقديم طلب لـ: " : "Apply for: "}
                {isAr ? selectedOpp.titleAr : selectedOpp.titleEn}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={requestClose}
                disabled={submitting}
                aria-label={isAr ? "إغلاق نافذة التقديم" : "Close application dialog"}
              >
                ✕
              </button>
            </div>

            {applyStatus === "success" ? (
              <div className="modal-success-state text-center" role="status" aria-live="polite">
                <CheckCircle2 size={60} className="success-icon" />
                <h4>{isAr ? "تم إرسال طلبك بنجاح!" : "Application Submitted!"}</h4>
                <p>
                  {isAr
                    ? "نشكرك على اهتمامك بمستقبل المناخ. سنقوم بمراجعة طلبك والتواصل معك قريباً."
                    : "Thanks for your climate dedication. We will review your application and contact you soon."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="modal-form-body">
                {applyError && (
                  <p className="opps-form-alert" role="alert">{applyError}</p>
                )}

                <div className="form-group">
                  <label htmlFor="apply-name">{isAr ? "الاسم الكامل" : "Full Name"}</label>
                  <input
                    id="apply-name"
                    name="name"
                    ref={firstFieldRef}
                    type="text"
                    required
                    autoComplete="name"
                    value={applyForm.name}
                    onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                    placeholder={isAr ? "مثال: أحمد الرميثي" : "e.g. John Doe"}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="apply-email">{isAr ? "البريد الإلكتروني" : "Email Address"}</label>
                  <input
                    id="apply-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={applyForm.email}
                    onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                    placeholder="name@domain.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="apply-portfolio">{isAr ? "رابط السيرة الذاتية / بورتفوليو" : "CV or Portfolio Link"}</label>
                  <input
                    id="apply-portfolio"
                    name="portfolio"
                    type="url"
                    required
                    autoComplete="url"
                    value={applyForm.portfolio}
                    onChange={(e) => setApplyForm({ ...applyForm, portfolio: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="apply-cover-letter">
                    {isAr ? "رسالة الدافع (لماذا تريد الانضمام إلينا؟)" : "Motivation Message"}
                  </label>
                  <textarea
                    id="apply-cover-letter"
                    name="coverLetter"
                    rows={4}
                    value={applyForm.coverLetter}
                    onChange={(e) => setApplyForm({ ...applyForm, coverLetter: e.target.value })}
                    placeholder={isAr ? "اكتب هنا..." : "Tell us about your passion..."}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-full-width" disabled={submitting}>
                  {submitting
                    ? (isAr ? "جارٍ الإرسال…" : "Submitting…")
                    : (isAr ? "تأكيد وإرسال الطلب" : "Submit Application")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
