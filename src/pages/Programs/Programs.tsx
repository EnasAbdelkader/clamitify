import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError, sanitizeUrl } from "../../services/api";
import type { Program, Initiative, InitiativeType } from "../../types";
import {
  Monitor,
  Search,
  Megaphone,
  Users,
  MessageSquare,
  Activity,
  Leaf,
  TreePine,
  X,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Target,
  Tent,
  Wrench,
  ExternalLink,
} from "lucide-react";
import "./Programs.css";

/** Placeholder used when a CMS image 404s. Applied once so a failing fallback cannot loop. */
const IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80";

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.dataset.fallbackApplied === "true") return;
  img.dataset.fallbackApplied = "true";
  img.src = IMAGE_FALLBACK;
};

// ============================================================
// Icon mapping — بيربط اسم الـ icon اللي بيرجع من الباك إند بالـ component المناسب
// يا مطور الباك: لو حابب تضيف icon جديد، ضيفه هنا وفي الـ switch تحت ده.
// ============================================================

type IconType = typeof Monitor;

/* نفس خريطة PROGRAM_ICON_MAP في ProgramCards.tsx — مصدر واحد للأيقونات
   عشان الكرت في الصفحة الرئيسية وكرت هنا يعرضان نفس الأيقونة لنفس البرنامج. */
const getProgramIcon = (iconName: string): IconType => {
  switch (iconName) {
    case "Monitor": return Monitor;
    case "Search": return Search;
    case "Megaphone": return Megaphone;
    case "Users": return Users;
    case "MessageSquare": return MessageSquare;
    case "Leaf": return Leaf;
    case "TreePine": return TreePine;
    default: return Activity;
  }
};

// ============================================================
// Initiative tabs — المبادرات مقسّمة على 4 أنواع
// ============================================================

const INITIATIVE_TABS: { type: InitiativeType; ar: string; en: string; Icon: IconType }[] = [
  { type: "campaign", ar: "الحملات", en: "Campaigns", Icon: Megaphone },
  { type: "program", ar: "برامج", en: "Programs", Icon: Users },
  { type: "camp", ar: "معسكرات", en: "Camps", Icon: Tent },
  { type: "workshop", ar: "ورش عمل", en: "Workshops", Icon: Wrench },
];

/** مبادرة من غير `type` (بيانات قديمة من الـ API) بتتحسب حملة. */
const initiativeTypeOf = (initiative: Initiative): InitiativeType => initiative.type ?? "campaign";

// ============================================================
// Main Programs Component
// ============================================================

export const Programs: React.FC = () => {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  // --- Data state ---
  const [programs, setPrograms] = useState<Program[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // --- Initiatives tab state ---
  const [selectedInitiativeType, setSelectedInitiativeType] = useState<InitiativeType | null>(null);

  // --- Modal state ---
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  // --- Refs ---
  const location = useLocation();
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerBtnRef = useRef<HTMLElement | null>(null);

  // ============================================================
  // تحميل البيانات من الباك إند
  // يا مطور الباك: البيانات دي بتيجي من apiService.getPrograms() و apiService.getInitiatives()
  // اللي بتعمل GET لـ /api/programs و /api/initiatives على التوالي.
  // لو حابب تضيف حقول زي (صورة للبرنامج، قائمة مميزات features[]، إلخ)
  // متاح تعدل الـ type في types/index.ts وتحدّث الـ mock data في services/api.ts.
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    const loadProgramsData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [progData, initData] = await Promise.all([
          apiService.getPrograms(),
          apiService.getInitiatives()
        ]);
        if (controller.signal.aborted) return;
        // مبنثقش في شكل الرد — أي حاجة مش array بتبقى قائمة فاضية.
        setPrograms(Array.isArray(progData) ? progData : []);
        setInitiatives(Array.isArray(initData) ? initData : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error loading programs:", err);
        setLoadError(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadProgramsData();
    return () => controller.abort();
  }, [reloadToken]);

  const retry = useCallback(() => setReloadToken((n) => n + 1), []);

  // الرسالة بتتترجم وقت الرسم مش وقت الجلب، عشان تبديل اللغة ميعيدش التحميل.
  const errorMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.localizedMessage(language)
      : isAr
        ? "حدث خطأ غير متوقع."
        : "An unexpected error occurred."
    : null;

  // التمرير للبرنامج المحدد في الرابط الـ hash anchor
  useEffect(() => {
    if (loading || !location.hash) return;
    const id = location.hash.replace("#", "");
    const element = document.getElementById(id);
    if (!element) return;
    const scrollTimer = setTimeout(() => {
      element.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [loading, location.hash]);

  // ============================================================
  // Modal handlers — نفس الـ accessible pattern بتاع Events
  // ============================================================

  const closeModal = useCallback(() => {
    setSelectedProgram(null);
  }, []);

  const openModal = useCallback((program: Program) => {
    // نحفظ الزرار اللي فتح الـ modal عشان نرجعله الـ focus لما نقفل
    triggerBtnRef.current = document.activeElement as HTMLElement;
    setSelectedProgram(program);
  }, []);

  // Modal: Escape key, body scroll lock, focus management, focus trap
  useEffect(() => {
    if (!selectedProgram) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        return;
      }
      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        // `noUncheckedIndexedAccess`: القراءة بالـ index بترجع T | undefined.
        // الحارس ده مش شكلي — لو الـ modal اتفضى بين الحدثين كنا هنرمي TypeError.
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
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // نعمل focus على زرار الإغلاق بعد ما الـ modal يظهر
    const focusTimer = setTimeout(() => {
      const closeBtn = modalRef.current?.querySelector<HTMLElement>(".programs-modal-close-btn");
      closeBtn?.focus();
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      clearTimeout(focusTimer);
      // نرجع الـ focus للزرار اللي فتح الـ modal
      triggerBtnRef.current?.focus();
    };
  }, [selectedProgram, closeModal]);

  // ============================================================
  // Derived values
  // ============================================================

  // التبويبات اللي ليها مبادرات فعلاً — التبويب الفاضي مبيظهرش
  const initiativeTabs = useMemo(
    () => INITIATIVE_TABS.filter((tab) => initiatives.some((init) => initiativeTypeOf(init) === tab.type)),
    [initiatives]
  );
  const activeInitiativeTab =
    initiativeTabs.find((tab) => tab.type === selectedInitiativeType) ?? initiativeTabs[0] ?? null;
  const visibleInitiatives = useMemo(
    () =>
      activeInitiativeTab
        ? initiatives.filter((init) => initiativeTypeOf(init) === activeInitiativeTab.type)
        : [],
    [initiatives, activeInitiativeTab]
  );

  // الوصف التفصيلي للبرنامج المفتوح — فاضي يعني الـ CMS مكتبش حاجة.
  const longDescription = selectedProgram
    ? ((isAr ? selectedProgram.longDescriptionAr : selectedProgram.longDescriptionEn) ?? "").trim()
    : "";

  // ============================================================
  // Render: Loading skeleton
  // ============================================================

  if (loading) {
    return (
      <div className="programs-page-container">
        <div className="programs-skeleton-hero" />
        <div className="container">
          <div className="programs-skeleton-grid" role="status" aria-live="polite">
            <span className="sr-only">{isAr ? "جارٍ تحميل البرامج…" : "Loading programs…"}</span>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="programs-skeleton-card">
                <div className="p-skeleton-bar p-skeleton-accent" />
                <div className="p-skeleton-bar p-skeleton-icon" />
                <div className="p-skeleton-bar p-skeleton-title" />
                <div className="p-skeleton-bar p-skeleton-text" />
                <div className="p-skeleton-bar p-skeleton-text" />
                <div className="p-skeleton-bar p-skeleton-btn" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Error state
  // ============================================================

  // قبل كده الفرع ده ما كانش بيشتغل أبداً لأن الـ api كانت بتبلع كل الأخطاء.
  // دلوقتي بيشتغل فعلاً، فلازم يعرض سبب الفشل ويدي المستخدم زرار إعادة محاولة.
  if (errorMessage) {
    return (
      <div className="programs-page-container container">
        <div className="programs-error-state" role="alert">
          <div className="programs-error-icon" aria-hidden="true">
            <Activity size={48} />
          </div>
          <h1>{isAr ? "تعذّر تحميل البرامج" : "Failed to load programs"}</h1>
          <p>{errorMessage}</p>
          <button type="button" className="btn btn-primary programs-retry-btn" onClick={retry}>
            <RotateCcw size={16} aria-hidden="true" />
            <span>{isAr ? "إعادة المحاولة" : "Try again"}</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Main page
  // ============================================================

  return (
    <div className="programs-page-container">
      {/* ===== 1. Hero Section ===== */}
      <section className="programs-hero">
        <div className="programs-hero-bg" aria-hidden="true" />
        <div className="container programs-hero-inner">
          <div className="programs-hero-content">
            <span className="programs-hero-eyebrow">
              <Sparkles size={16} />
              {t("programs")}
            </span>
            <h1 className="programs-hero-title">
              {isAr ? "أنشطة وبرامج" : "Activities & Programs"}
            </h1>
            <p className="programs-hero-lead">
              {isAr
                ? "أنشطة وبرامج كلايمتيفاي: من منصات رقمية وزمالات إلى حملات ومعسكرات وورش عمل — مصممة لبناء قدرات الشباب وربط المبادرات المناخية عبر المنطقة."
                : "Climatify's activities and programs: from digital platforms and fellowships to campaigns, camps and workshops — designed to build youth capacity and connect climate initiatives across the region."}
            </p>
          </div>
        </div>
      </section>

      <div className="container programs-main-content">
        {/* ===== 2. Programs Grid ===== */}
        <section className="programs-grid-section">
          <div className="programs-section-header">
            <span className="eyebrow">{t("programs")}</span>
            <h2>
              {isAr
                ? "برامجنا في العمل المناخي وتمكين الشباب"
                : "Our Programs in Climate Action & Youth Empowerment"}
            </h2>
          </div>

          {programs.length > 0 ? (
            <div className="programs-grid">
              {programs.map((program) => {
                const Icon = getProgramIcon(program.icon);
                return (
                  <article
                    key={program.id}
                    id={program.id}
                    className="program-card-v2"
                  >
                    <div className="program-card-accent-bar" aria-hidden="true" />
                    <div className="program-card-body">
                      <div className="program-card-icon">
                        <Icon size={26} />
                      </div>
                      <h3 className="program-card-title">
                        {isAr ? program.titleAr : program.titleEn}
                      </h3>
                      <p className="program-card-desc">
                        {isAr ? program.descriptionAr : program.descriptionEn}
                      </p>
                      <button
                        onClick={() => openModal(program)}
                        className="program-card-btn"
                        aria-label={
                          isAr
                            ? `اعرف المزيد عن ${program.titleAr}`
                            : `Learn more about ${program.titleEn}`
                        }
                      >
                        <span>{isAr ? "اعرف أكثر" : "Learn More"}</span>
                        <ArrowRight size={16} className="program-card-btn-arrow" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* Empty State — لو الباك إند رجع بيانات فاضية */
            <div className="programs-empty-state">
              <div className="programs-empty-icon">
                <Activity size={48} />
              </div>
              <h3>{isAr ? "لا توجد برامج متاحة" : "No programs available"}</h3>
              <p>{isAr ? "سيتم إضافة برامج قريباً." : "Programs will be added soon."}</p>
            </div>
          )}
        </section>

        {/* ===== 3. Initiatives Section ===== */}
        {/* يا مطور الباك: البيانات بتيجي من apiService.getInitiatives() — والحقل `type`
            (campaign | program | camp | workshop) هو اللي بيحدد التبويب. */}
        {activeInitiativeTab && (
          <section className="programs-initiatives-section" id="initiatives">
            <div className="programs-section-header">
              <span className="eyebrow">{t("initiatives")}</span>
              <h2>
                {isAr
                  ? "مبادراتنا: حملات وبرامج ومعسكرات وورش عمل"
                  : "Our Initiatives: Campaigns, Programs, Camps & Workshops"}
              </h2>
            </div>

            <div
              className="initiative-tabs"
              role="group"
              aria-label={isAr ? "تصفية المبادرات حسب النوع" : "Filter initiatives by type"}
            >
              {initiativeTabs.map((tab) => (
                <button
                  key={tab.type}
                  type="button"
                  className={`initiative-tab ${tab.type === activeInitiativeTab.type ? "active" : ""}`}
                  onClick={() => setSelectedInitiativeType(tab.type)}
                  aria-pressed={tab.type === activeInitiativeTab.type}
                >
                  <tab.Icon size={16} aria-hidden="true" />
                  <span>{isAr ? tab.ar : tab.en}</span>
                </button>
              ))}
            </div>

            <div className="initiatives-grid" key={activeInitiativeTab.type}>
              {visibleInitiatives.map((init) => {
                const title = isAr ? init.titleAr : init.titleEn;
                const target = ((isAr ? init.targetAr : init.targetEn) ?? "").trim();
                const linkHref = sanitizeUrl(init.linkUrl ?? "");
                const hasLink = linkHref !== "" && linkHref !== "#invalid-url";
                const linkLabel =
                  (isAr ? init.linkLabelAr : init.linkLabelEn) || (isAr ? "عرض التفاصيل" : "View details");

                return (
                  <article key={init.id} className="initiative-grid-card">
                    {init.qrImage ? (
                      <div className="initiative-grid-img-area initiative-qr-area">
                        <img
                          src={init.qrImage}
                          alt={isAr ? `رمز QR — ${title}` : `QR code — ${title}`}
                          className="initiative-qr-img"
                          width={180}
                          height={180}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : init.image ? (
                      <div className="initiative-grid-img-area">
                        <img
                          src={init.image}
                          alt={title}
                          className="initiative-grid-img"
                          width={640}
                          height={400}
                          loading="lazy"
                          decoding="async"
                          onError={handleImageError}
                        />
                      </div>
                    ) : (
                      <div className="initiative-grid-img-area initiative-icon-area" aria-hidden="true">
                        <activeInitiativeTab.Icon size={44} />
                      </div>
                    )}

                    <div className="initiative-grid-content">
                      <span className="badge-category">
                        {isAr ? init.categoryAr : init.categoryEn}
                      </span>
                      <h3>{title}</h3>
                      <p>{isAr ? init.descriptionAr : init.descriptionEn}</p>

                      {typeof init.participantsCount === "number" && init.participantsCount > 0 && (
                        <div className="initiative-target-box">
                          <Users size={14} aria-hidden="true" />
                          <span>
                            {isAr
                              ? `${init.participantsCount} مشاركاً`
                              : `${init.participantsCount} participants`}
                          </span>
                        </div>
                      )}

                      {/* شريط الإنجاز للمبادرات اللي ليها هدف مُعلن بس */}
                      {target && (
                        <div className="initiative-progress-block">
                          <div className="progress-label-row">
                            <span>{isAr ? "نسبة الإنجاز" : "Progress"}</span>
                            <strong>{init.progress}%</strong>
                          </div>
                          <div className="initiative-progress-track">
                            <div
                              className="initiative-progress-fill"
                              style={{ width: `${init.progress}%` }}
                            />
                          </div>
                          <div className="initiative-target-box">
                            <Target size={14} aria-hidden="true" />
                            <span>{target}</span>
                          </div>
                        </div>
                      )}

                      {hasLink && (
                        <a
                          href={linkHref}
                          className="initiative-link-btn"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>{linkLabel}</span>
                          <ExternalLink size={15} aria-hidden="true" />
                          <span className="sr-only">
                            {isAr ? "(يفتح في نافذة جديدة)" : "(opens in a new tab)"}
                          </span>
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ===== 4. Program Details Modal ===== */}
      {/* يا مطور الباك: لو حابب البرنامج يكون ليه CTA مختلف (زي تسجيل أو تحميل ملف)
// ممكن تضيف field في الـ Program type وتعدل الـ button تحت هنا. */}
      {selectedProgram && (
        <div className="programs-modal-overlay" onClick={closeModal}>
          <div
            ref={modalRef}
            className="programs-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Accent Header */}
            <div className="programs-modal-header">
              <div className="programs-modal-header-content">
                <div className="programs-modal-icon">
                  {(() => {
                    const Icon = getProgramIcon(selectedProgram.icon);
                    return <Icon size={24} />;
                  })()}
                </div>
                <div>
                  <span className="programs-modal-label">
                    {isAr ? "تفاصيل البرنامج" : "Program Details"}
                  </span>
                  <h3 id="program-modal-title" className="programs-modal-title">
                    {isAr ? selectedProgram.titleAr : selectedProgram.titleEn}
                  </h3>
                </div>
              </div>
              <button
                className="programs-modal-close-btn"
                onClick={closeModal}
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="programs-modal-body">
              <p className="programs-modal-summary">
                {isAr ? selectedProgram.descriptionAr : selectedProgram.descriptionEn}
              </p>
              <div className="programs-modal-divider" />
              {/* لو الـ CMS مرجّعش وصف تفصيلي مبنخترعش كلام تسويقي عن برنامج
                  إحنا مش عارفين تفاصيله — بنقول إن التفاصيل لسه مش متاحة. */}
              {longDescription ? (
                <p className="programs-modal-full-desc">{longDescription}</p>
              ) : (
                <p className="programs-modal-no-desc">
                  {isAr
                    ? "لم يُضف وصف تفصيلي لهذا البرنامج بعد. يسعدنا تواصلك معنا لتزويدك بكافة التفاصيل."
                    : "A detailed description for this program has not been published yet. Get in touch and we will send you the full details."}
                </p>
              )}

              <Link
                to="/contact"
                className="btn btn-primary programs-modal-cta"
                onClick={closeModal}
              >
                <MessageSquare size={18} />
                <span>{isAr ? "تواصل معنا" : "Contact Us"}</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
