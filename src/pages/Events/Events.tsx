import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError } from "../../services/api";
import { EmptyState } from "../../components/ui/EmptyState";
import type { Event } from "../../types";
import {
  MapPin,
  Users,
  Ticket,
  CheckCircle2,
  Search,
  X,
  CalendarDays,
  Sparkles,
  GraduationCap,
  Code2,
  Trophy,
  Calendar,
  AlertCircle,
  RefreshCw,
  Mail,
} from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import "./Events.css";

// ============================================================
// Category helpers — maps category names to icons and CSS classes
// ============================================================

type IconType = typeof MapPin;

const getCategoryIcon = (categoryEn: string): IconType => {
  const cat = categoryEn.toLowerCase();
  if (cat.includes("hackathon") || cat.includes("competition") || cat.includes("award")) return Trophy;
  if (cat.includes("workshop") || cat.includes("education") || cat.includes("outreach")) return GraduationCap;
  if (cat.includes("digital") || cat.includes("tech")) return Code2;
  return CalendarDays;
};

const getCategoryClass = (categoryEn: string): string => {
  const cat = categoryEn.toLowerCase();
  if (cat.includes("hackathon") || cat.includes("competition") || cat.includes("award")) return "cat-hackathon";
  if (cat.includes("workshop") || cat.includes("education") || cat.includes("outreach")) return "cat-outreach";
  if (cat.includes("digital") || cat.includes("tech")) return "cat-digital";
  return "cat-default";
};

// ============================================================
// Date helpers
//
// تواريخ الفعاليات بتيجي "YYYY-MM-DD". new Date("2026-04-25") بيفسّرها
// منتصف ليل UTC، فلما نقارنها بوقت محلي في UTC+4 الفعالية بتاعة النهاردة
// بتبقى "منتهية" من الساعة 4 الفجر. عشان كده بنبني التاريخ محلياً بنفسنا،
// وبنقارن بمنتصف ليل النهاردة المحلي عشان فعالية النهاردة تفضل قادمة.
// ============================================================

const parseEventDate = (value: string | null | undefined): Date | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (match) {
    const [, year, month, day] = match;
    if (!year || !month || !day) return null;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // أي صيغة تانية (ISO كامل مثلاً) — بنسيبها للمحرك، بس بنتأكد إنها صالحة
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

/** منتصف ليل النهاردة بالتوقيت المحلي. */
const startOfToday = (): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

/** التاريخ كرقم للترتيب — اللي مالوش تاريخ صالح بيروح آخر القائمة. */
const eventTime = (value: string): number =>
  parseEventDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;

// ============================================================
// Main Events Component
// ============================================================

export const Events: React.FC = () => {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  // --- Data state ---
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** بيتزوّد مع كل ضغطة "إعادة المحاولة" عشان الـ effect يشتغل تاني. */
  const [reloadToken, setReloadToken] = useState(0);

  // --- Filter state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // --- Modal state ---
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [registrationStatus, setRegistrationStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // --- Refs ---
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const triggerBtnRef = useRef<HTMLElement | null>(null);

  // فعاليات العضو المسجّل بها — عشان نمنع إعادة التسجيل من غير ما يملأ
  // الفورم كله ويتفاجئ برسالة "مسجّل بالفعل" بعد الضغط على تأكيد.
  const registeredEvents = useAuthStore((state) => state.registeredEvents);
  const registeredEventIds = useMemo(
    () => new Set(registeredEvents.map((e) => e.id)),
    [registeredEvents]
  );

  // ============================================================
  // Data loading
  // ============================================================

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await apiService.getEvents();
        if (controller.signal.aborted) return;
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(
          err instanceof ApiError
            ? err.localizedMessage(language)
            : language === "ar"
            ? "حدث خطأ غير متوقع أثناء تحميل الفعاليات."
            : "An unexpected error occurred while loading events."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [language, reloadToken]);

  const retryLoad = useCallback(() => setReloadToken((token) => token + 1), []);

  // ============================================================
  // Derived values
  // ============================================================

  /** منتصف ليل النهاردة — بيتحسب مرة واحدة لكل زيارة للصفحة. */
  const todayTs = useMemo(() => startOfToday().getTime(), []);

  /** فعالية بتاريخ صالح انتهت — تُعرض مؤرشفة بدون تسجيل. */
  const isPastEvent = useCallback(
    (date: string): boolean => {
      const time = eventTime(date);
      return Number.isFinite(time) && time < todayTs;
    },
    [todayTs]
  );

  /**
   * فعالية مفتوحة للتسجيل = تاريخ صالح وغير منتهٍ. الفعاليات بدون تاريخ
   * (محمولات الأرشيف من المحتوى الرسمي) لا تُعتبر قادمة ولا تقبل تسجيلاً.
   */
  const isRegistrableEvent = useCallback(
    (date: string): boolean => {
      const time = eventTime(date);
      return Number.isFinite(time) && time >= todayTs;
    },
    [todayTs]
  );

  // Dynamic categories extracted from actual data (fixes hardcoded filter bug)
  const categories = useMemo(() => {
    const uniqueCats = Array.from(new Set(events.map((e) => e.categoryEn)));
    return ["all", ...uniqueCats];
  }, [events]);

  /**
   * ترتيب ثابت: الفعاليات القادمة الأول (الأقرب فالأبعد)، وبعدين المنتهية
   * (الأحدث الأول)، وبدون تاريخ في النهاية. نسخة جديدة بالـ spread — مش بنعدّل
   * مصفوفة الـ state.
   */
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aPast = isPastEvent(a.date);
      const bPast = isPastEvent(b.date);
      if (aPast !== bPast) return aPast ? 1 : -1;
      const aTime = eventTime(a.date);
      const bTime = eventTime(b.date);
      return aPast ? bTime - aTime : aTime - bTime;
    });
  }, [events, isPastEvent]);

  // Featured event — next upcoming event by date (اليوم نفسه يعتبر قادم).
  // فعالية بدون تاريخ ما تنفعش تكون "القادمة" المميزة.
  const featuredEvent = useMemo(
    () => sortedEvents.find((e) => isRegistrableEvent(e.date)) ?? null,
    [sortedEvents, isRegistrableEvent]
  );

  // Filtered events based on search + category (بيحافظ على ترتيب sortedEvents)
  const filteredEvents = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return sortedEvents.filter((event) => {
      // البحث بيتم في حقول اللغة المعروضة حالياً
      const title = (isAr ? event.titleAr : event.titleEn).toLowerCase();
      const desc = (isAr ? event.descriptionAr : event.descriptionEn).toLowerCase();
      const location = (isAr ? event.locationAr : event.locationEn).toLowerCase();
      const matchesSearch =
        !query || title.includes(query) || desc.includes(query) || location.includes(query);
      const matchesCategory =
        selectedCategory === "all" || event.categoryEn === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [sortedEvents, searchQuery, selectedCategory, isAr]);

  // Category counts for filter pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    events.forEach((e) => {
      counts[e.categoryEn] = (counts[e.categoryEn] ?? 0) + 1;
    });
    return counts;
  }, [events]);

  // Pre-compute icons for featured and modal (avoids inline createElement)
  const FeaturedIcon = featuredEvent
    ? getCategoryIcon(featuredEvent.categoryEn)
    : CalendarDays;
  const ModalIcon = selectedEvent
    ? getCategoryIcon(selectedEvent.categoryEn)
    : CalendarDays;

  // ============================================================
  // Modal handlers
  // ============================================================

  const closeModal = useCallback(() => {
    setSelectedEvent(null);
    setRegistrationStatus("idle");
    setRegistrationError(null);
    setFormData({ name: "", email: "", phone: "" });
  }, []);

  /**
   * الإغلاق بالـ Escape أو الضغط على الخلفية — ممنوع أثناء إرسال التسجيل.
   * الحالة بتتقرا من ref عشان الدالة تفضل ثابتة: لو اتغيرت هويتها كان
   * effect الـ modal هيعيد التشغيل ويرجّع التركيز للزرار والـ modal لسه مفتوح.
   */
  const registrationStatusRef = useRef(registrationStatus);
  registrationStatusRef.current = registrationStatus;

  const requestClose = useCallback(() => {
    if (registrationStatusRef.current === "loading") return;
    closeModal();
  }, [closeModal]);

  const openModal = useCallback((event: Event) => {
    // Capture the button that triggered the modal for focus restoration
    triggerBtnRef.current = document.activeElement as HTMLElement | null;
    setSelectedEvent(event);
    setRegistrationStatus("idle");
    setRegistrationError(null);
  }, []);

  // Modal: Escape key, body scroll lock, focus management, focus trap
  useEffect(() => {
    if (!selectedEvent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
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

    document.addEventListener("keydown", handleKeyDown);

    // Body scroll lock — بنرجّع القيمة الأصلية مش بنمسحها
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first input (أو الديالوج نفسه في حالة التأكيد) بعد ما الـ modal يترسم
    const focusTimer = window.setTimeout(() => {
      const target = firstInputRef.current ?? modalRef.current;
      target?.focus();
    }, 60);

    const trigger = triggerBtnRef.current;

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      // Restore focus to the button that opened the modal
      trigger?.focus();
    };
  }, [selectedEvent, requestClose]);

  /**
   * لما الفورم يتبدّل بشاشة التأكيد بيبقى العنصر اللي كان عليه التركيز اتشال،
   * فبنرجّع التركيز للديالوج نفسه بدل ما يضيع على <body>.
   */
  useEffect(() => {
    if (registrationStatus !== "success") return;
    modalRef.current?.focus();
  }, [registrationStatus]);

  // ============================================================
  // Registration submit
  //
  // الـ store هو اللي بينده على apiService.registerForEvent جوّاه، فبننده
  // عليه هو بس — النداء المزدوج القديم كان بيسجّل اليوزر مرتين على السيرفر.
  // ============================================================

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (registrationStatus === "loading") return; // حماية من الضغط المزدوج

    setRegistrationStatus("loading");
    setRegistrationError(null);

    const target = selectedEvent;
    const fallbackMsg = isAr
      ? "تعذّر إتمام التسجيل. برجاء المحاولة مرة أخرى."
      : "Could not complete your registration. Please try again.";

    try {
      const result = await useAuthStore.getState().registerForEvent(
        {
          id: target.id,
          titleAr: target.titleAr,
          titleEn: target.titleEn,
          date: target.date,
        },
        {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        }
      );

      if (!result.ok) {
        // البيانات بتفضل في الفورم عشان اليوزر يقدر يعيد المحاولة
        setRegistrationStatus("error");
        setRegistrationError(result.error ?? fallbackMsg);
        return;
      }

      setRegistrationStatus("success");
      // العدّاد بيتزوّد بعد تأكيد السيرفر بس
      setEvents((prev) =>
        prev.map((item) =>
          item.id === target.id
            ? { ...item, registeredCount: item.registeredCount + 1 }
            : item
        )
      );
    } catch (err) {
      setRegistrationStatus("error");
      setRegistrationError(
        err instanceof ApiError ? err.localizedMessage(language) : fallbackMsg
      );
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
  };

  // ============================================================
  // Date formatting helpers — كلها بتمرّ على parseEventDate
  // ============================================================

  const formatDay = (date: string): string => {
    const parsed = parseEventDate(date);
    return parsed ? String(parsed.getDate()) : "—";
  };

  const formatMonth = (date: string): string => {
    const parsed = parseEventDate(date);
    if (!parsed) return isAr ? "غير محدد" : "TBA";
    return parsed.toLocaleString(isAr ? "ar-EG" : "en-US", { month: "short" });
  };

  // ============================================================
  // Render: Loading skeleton
  // ============================================================

  if (loading) {
    return (
      <div className="events-page-container">
        <div className="events-skeleton-hero" />
        <div className="container">
          <p className="sr-only" role="status">
            {isAr ? "جاري تحميل الفعاليات…" : "Loading events…"}
          </p>
          <div className="events-skeleton-grid" aria-hidden="true">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="events-skeleton-card">
                <div className="skeleton-bar skeleton-accent" />
                <div className="skeleton-bar skeleton-icon" />
                <div className="skeleton-bar skeleton-title" />
                <div className="skeleton-bar skeleton-text" />
                <div className="skeleton-bar skeleton-text" />
                <div className="skeleton-bar skeleton-btn" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Error state — الرسالة الحقيقية + إعادة المحاولة
  // ============================================================

  if (loadError) {
    return (
      <div className="events-page-container container">
        <div className="events-error-state" role="alert">
          <div className="events-error-icon">
            <CalendarDays size={48} />
          </div>
          <h2>{isAr ? "تعذّر تحميل الفعاليات" : "Failed to load events"}</h2>
          <p>{loadError}</p>
          <button onClick={retryLoad} className="btn btn-primary events-retry-btn">
            <RefreshCw size={16} />
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
    <div className="events-page-container">
      {/* ===== 1. Hero Section ===== */}
      <section className="events-hero">
        <div className="events-hero-bg" aria-hidden="true" />
        <div className="container events-hero-inner">
          <div className="events-hero-content">
            <span className="events-hero-eyebrow">
              <Sparkles size={16} />
              {t("events")}
            </span>
            <h1 className="events-hero-title">
              {isAr ? "أبرز فعالياتنا ومؤتمراتنا" : "Our Events & Conferences"}
            </h1>
            <p className="events-hero-lead">
              {isAr
                ? "من ورش العمل والمعسكرات إلى المؤتمرات الدولية — هذه محطاتنا في رحلة العمل المناخي."
                : "From workshops and camps to international conferences — these are our milestones on the climate-action journey."}
            </p>
          </div>

        </div>
      </section>

      <div className="container events-main-content">
        {/* ===== 2. Featured Event ===== */}
        {featuredEvent && (
          <section className="featured-event-section">
            <div
              className={`featured-event-banner ${getCategoryClass(
                featuredEvent.categoryEn
              )}`}
            >
              <div className="featured-event-accent" aria-hidden="true" />
              <div className="featured-event-body">
                <div className="featured-event-header">
                  <div className="featured-event-icon-wrap">
                    <FeaturedIcon size={28} />
                  </div>
                  <span className="featured-event-label">
                    <CalendarDays size={14} />
                    {isAr ? "الفعالية القادمة" : "Next Upcoming"}
                  </span>
                </div>
                <h2 className="featured-event-title">
                  {isAr ? featuredEvent.titleAr : featuredEvent.titleEn}
                </h2>
                <p className="featured-event-desc">
                  {isAr
                    ? featuredEvent.descriptionAr
                    : featuredEvent.descriptionEn}
                </p>
                <div className="featured-event-meta">
                  <span className="featured-event-meta-item">
                    <Calendar size={16} />
                    {formatDay(featuredEvent.date)} {formatMonth(featuredEvent.date)}
                  </span>
                  {(featuredEvent.locationAr || featuredEvent.locationEn) && (
                    <span className="featured-event-meta-item">
                      <MapPin size={16} />
                      {isAr ? featuredEvent.locationAr : featuredEvent.locationEn || featuredEvent.locationAr}
                    </span>
                  )}
                  {featuredEvent.registeredCount > 0 && (
                    <span className="featured-event-meta-item">
                      <Users size={16} />
                      {featuredEvent.registeredCount}{" "}
                      {isAr ? "مسجل" : "Registered"}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => openModal(featuredEvent)}
                  className="btn btn-primary featured-event-btn"
                  disabled={registeredEventIds.has(featuredEvent.id)}
                >
                  <Ticket size={18} />
                  <span>
                    {registeredEventIds.has(featuredEvent.id)
                      ? isAr
                        ? "مسجّل به بالفعل"
                        : "Already Registered"
                      : isAr
                      ? "سجل حضورك الآن"
                      : "Register Now"}
                  </span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ===== 3. Toolbar (Search + Filters) ===== */}
        {events.length > 0 && (
          <div className="events-toolbar">
            <div className="events-search-wrap">
              <Search size={18} className="events-search-icon" />
              <input
                type="text"
                className="events-search-input"
                placeholder={isAr ? "ابحث عن الفعاليات..." : "Search events..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={isAr ? "بحث عن الفعاليات" : "Search events"}
              />
              {searchQuery && (
                <button
                  className="events-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label={isAr ? "مسح البحث" : "Clear search"}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="events-filter-pills">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`filter-pill ${
                    selectedCategory === cat ? "filter-pill--active" : ""
                  }`}
                  aria-pressed={selectedCategory === cat}
                >
                  <span>
                    {cat === "all"
                      ? isAr
                        ? "الكل"
                        : "All"
                      : isAr
                      ? events.find((e) => e.categoryEn === cat)?.categoryAr ?? cat
                      : cat}
                  </span>
                  <span className="filter-pill-count">
                    {categoryCounts[cat] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== 4. Events Grid ===== */}
        {events.length === 0 ? (
          /* السيرفر رد بنجاح بس مفيش فعاليات منشورة */
          <EmptyState
            type="no-data"
            titleEn="No events published yet"
            titleAr="لا توجد فعاليات منشورة حالياً"
            descriptionEn="New workshops, forums and hackathons are announced here. Check back soon."
            descriptionAr="نعلن هنا دورياً عن أحدث ورش العمل والندوات والفعاليات. ترقبوا المزيد قريباً."
          />
        ) : filteredEvents.length > 0 ? (
          <section className="events-grid-section">
            <div className="events-grid">
              {filteredEvents.map((event) => {
                const Icon = getCategoryIcon(event.categoryEn);
                const past = isPastEvent(event.date);
                const registrable = isRegistrableEvent(event.date);
                return (
                  <article
                    key={event.id}
                    className={`event-card-v2 ${getCategoryClass(
                      event.categoryEn
                    )}${past ? " event-card-v2--past" : ""}`}
                  >
                    <div className="event-card-accent-bar" aria-hidden="true" />
                    <div className="event-card-body">
                      <div className="event-card-top-row">
                        <div className="event-card-icon">
                          <Icon size={22} />
                        </div>
                        <div className="event-date-badge">
                          <span className="event-date-day">
                            {formatDay(event.date)}
                          </span>
                          <span className="event-date-month">
                            {formatMonth(event.date)}
                          </span>
                        </div>
                      </div>

                      <div className="event-card-tag-row">
                        <span className="event-card-cat">
                          {isAr ? event.categoryAr : event.categoryEn}
                        </span>
                        {past && (
                          <span className="event-past-badge">
                            {isAr ? "انتهت" : "Ended"}
                          </span>
                        )}
                      </div>
                      <h3 className="event-card-title">
                        {isAr ? event.titleAr : event.titleEn}
                      </h3>
                      <p className="event-card-desc">
                        {isAr ? event.descriptionAr : event.descriptionEn}
                      </p>

                      <div className="event-card-meta">
                        {event.locationAr || event.locationEn ? (
                          <span className="event-meta-item">
                            <MapPin size={15} />
                            {isAr ? event.locationAr : event.locationEn || event.locationAr}
                          </span>
                        ) : null}
                        {event.registeredCount > 0 && (
                          <span className="event-meta-item">
                            <Users size={15} />
                            {event.registeredCount}{" "}
                            {isAr ? "مسجل" : "Registered"}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => openModal(event)}
                        className="event-card-btn"
                        disabled={!registrable || registeredEventIds.has(event.id)}
                      >
                        <Ticket size={16} />
                        <span>
                          {past
                            ? isAr
                              ? "انتهت الفعالية"
                              : "Event ended"
                            : !registrable
                            ? isAr
                              ? "غير متاحة للتسجيل"
                              : "Registration unavailable"
                            : registeredEventIds.has(event.id)
                            ? isAr
                              ? "مسجّل به بالفعل"
                              : "Already Registered"
                            : isAr
                            ? "سجل الآن"
                            : "Register"}
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          /* البحث/الفلتر مرجعش نتايج */
          <EmptyState
            type="no-results"
            titleEn="No events found"
            titleAr="لا توجد فعاليات مطابقة"
            descriptionEn="Try adjusting your search or filters to find events."
            descriptionAr="جرّب تعديل البحث أو الفلاتر للعثور على فعاليات."
            actionEn="Clear filters"
            actionAr="مسح الفلاتر"
            onAction={clearFilters}
          />
        )}
      </div>

      {/* ===== 5. Registration Modal ===== */}
      {selectedEvent && (
        <div
          className="modal-overlay-v2"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestClose();
          }}
        >
          <div
            ref={modalRef}
            className="modal-card-v2"
            role="dialog"
            aria-modal="true"
            aria-labelledby="events-modal-title"
            tabIndex={-1}
          >
            {/* Modal Accent Header */}
            <div
              className={`modal-accent-header ${getCategoryClass(
                selectedEvent.categoryEn
              )}`}
            >
              <div className="modal-header-content">
                <div className="modal-header-icon">
                  <ModalIcon size={24} />
                </div>
                <div>
                  <span className="modal-header-label">
                    {isAr ? "التسجيل في الفعالية" : "Register for Event"}
                  </span>
                  <h3 id="events-modal-title" className="modal-header-title">
                    {isAr ? selectedEvent.titleAr : selectedEvent.titleEn}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={requestClose}
                disabled={registrationStatus === "loading"}
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body-content">
              {registrationStatus === "success" ? (
                <div className="modal-success-state" role="status">
                  <div className="modal-success-icon">
                    <CheckCircle2 size={48} />
                  </div>
                  <h4>
                    {isAr ? "تم تأكيد تسجيلك بنجاح!" : "Your registration is confirmed!"}
                  </h4>
                  <p>
                    {isAr
                      ? "سجّلنا حضورك في الفعالية، وهيوصلك بريد تأكيد فيه تفاصيل الدخول قبل الموعد."
                      : "Your place is reserved. A confirmation email with entry details will reach you before the event."}
                  </p>

                  {/*
                    TODO(backend): تذكرة حقيقية قابلة للمسح محتاجة كود من السيرفر
                    (مثلاً GET /api/events/:id/ticket يرجّع ticketCode + QR payload).
                    لحد ما ده يتوفر بنعرض ملخص حجز صادق بدل كود ثابت بيتكرر لكل الحضور.
                  */}
                  <div className="registration-summary-card">
                    <span className="registration-summary-label">
                      {isAr ? "ملخص الحجز" : "Booking summary"}
                    </span>
                    <p className="registration-summary-title">
                      {isAr ? selectedEvent.titleAr : selectedEvent.titleEn}
                    </p>
                    <span className="registration-summary-row">
                      <Calendar size={15} />
                      {formatDay(selectedEvent.date)} {formatMonth(selectedEvent.date)}
                    </span>
                    <span className="registration-summary-row">
                      <MapPin size={15} />
                      {isAr ? selectedEvent.locationAr : selectedEvent.locationEn}
                    </span>
                    {formData.email.trim() && (
                      <span className="registration-summary-row">
                        <Mail size={15} />
                        {formData.email.trim()}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary modal-close-action"
                    onClick={closeModal}
                  >
                    {isAr ? "تمام، إغلاق" : "Done"}
                  </button>
                </div>
              ) : (
                <>
                  {/* Event quick info */}
                  <div className="modal-event-info">
                    <span className="modal-info-item">
                      <Calendar size={15} />
                      {formatDay(selectedEvent.date)}{" "}
                      {formatMonth(selectedEvent.date)}
                    </span>
                    <span className="modal-info-item">
                      <MapPin size={15} />
                      {isAr
                        ? selectedEvent.locationAr
                        : selectedEvent.locationEn}
                    </span>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className="modal-form">
                    <div className="form-group">
                      <label htmlFor="user-name">
                        {isAr ? "الاسم الكامل" : "Full Name"}
                      </label>
                      <input
                        ref={firstInputRef}
                        type="text"
                        id="user-name"
                        required
                        autoComplete="name"
                        disabled={registrationStatus === "loading"}
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="modal-form-input"
                        placeholder={
                          isAr ? "ادخل اسمك الكامل" : "Enter your full name"
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="user-email">
                        {isAr ? "البريد الإلكتروني" : "Email Address"}
                      </label>
                      <input
                        type="email"
                        id="user-email"
                        required
                        autoComplete="email"
                        disabled={registrationStatus === "loading"}
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="modal-form-input"
                        placeholder="email@example.com"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="user-phone">
                        {isAr ? "رقم الهاتف" : "Phone Number"}
                      </label>
                      <input
                        type="tel"
                        id="user-phone"
                        required
                        autoComplete="tel"
                        disabled={registrationStatus === "loading"}
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="modal-form-input"
                        placeholder="+971 50 123 4567"
                      />
                    </div>

                    {registrationStatus === "error" && registrationError && (
                      <p className="modal-form-error" role="alert">
                        <AlertCircle size={16} aria-hidden="true" />
                        <span>{registrationError}</span>
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={registrationStatus === "loading"}
                      aria-busy={registrationStatus === "loading"}
                      className="btn btn-primary modal-submit-btn"
                    >
                      {registrationStatus === "loading" ? (
                        <>
                          <span className="spinner-loader-small" aria-hidden="true" />
                          <span>{isAr ? "جاري التسجيل…" : "Registering…"}</span>
                        </>
                      ) : (
                        <>
                          <Ticket size={18} />
                          <span>
                            {registrationStatus === "error"
                              ? isAr
                                ? "إعادة المحاولة"
                                : "Try again"
                              : isAr
                              ? "تأكيد التسجيل"
                              : "Confirm Registration"}
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
