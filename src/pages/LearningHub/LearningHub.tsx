import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError } from "../../services/api";
import type { Course, Certificate } from "../../types";
import { Clock, BookOpen, GraduationCap, Award, Lightbulb, CheckCircle, Lock, Printer, X, Sparkles, CirclePlay, Calendar } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { RouteLoader } from "../../components/common/RouteLoader";
import { EmptyState } from "../../components/ui/EmptyState";
import { VideoModal } from "../../components/ui/VideoModal";
import { LogoMarquee } from "../../components/LogoMarquee/LogoMarquee";
import { partnersByGroup } from "../../data/partners";
import { sessionRecordings } from "../../data/sessionRecordings";
import type { SessionRecording } from "../../data/sessionRecordings";
import "./LearningHub.css";

/**
 * عناوين الدروس المكتوبة يدوياً. عدد الدروس الحقيقي بيجي من
 * `course.lessonsCount`، فأي درس بعد العناوين دي بياخد عنوان وحدة عام.
 * TODO(backend): محتاجين GET /api/courses/<id>/lessons يرجّع الدروس الحقيقية.
 */
const LESSON_TITLES: { ar: string; en: string }[] = [
  { ar: "الوعي بالمناخ وأهمية الحلول الرقمية", en: "Introduction to Climate Digitization & Web Tools" },
  { ar: "حساب البصمة الكربونية للمؤسسات والشركات", en: "Carbon Footprint Calculations" },
  { ar: "الاستراتيجية الوطنية للاستدامة والتطبيق العملي", en: "UAE & Regional Green Action Strategy" }
];

function lessonTitleFor(lessonIndex: number, isAr: boolean): string {
  const known = LESSON_TITLES[lessonIndex - 1];
  if (known) return isAr ? known.ar : known.en;
  return isAr ? `الوحدة التدريبية رقم ${lessonIndex}` : `Training Module ${lessonIndex}`;
}

/** عدد الدروس الفعلي للمساق — من الـ API، مع سقف وحد أدنى عشان الرندر ما يتفجّرش. */
function lessonTotalOf(course: Course): number {
  const raw = typeof course.lessonsCount === "number" && Number.isFinite(course.lessonsCount)
    ? Math.round(course.lessonsCount)
    : 0;
  return Math.min(100, Math.max(1, raw));
}

/** صيغة العدد العربية الصحيحة — "1 دروس" غير سليمة لغويًا. */
function lessonsCountLabel(count: number, isAr: boolean): string {
  if (!isAr) return `${count} ${count === 1 ? "Lesson" : "Lessons"}`;
  if (count === 1) return "درس واحد";
  if (count === 2) return "درسان";
  if (count <= 10) return `${count} دروس`;
  return `${count} درساً`;
}

const localizeError = (err: unknown, language: string): string => {
  if (err instanceof ApiError) return err.localizedMessage(language);
  return language === "ar" ? "حدث خطأ غير متوقع أثناء تحميل المساقات." : "An unexpected error occurred while loading the courses.";
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const LearningHub: React.FC = () => {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

    const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  // تتبع فتح الدروس ونسبة إكمال المساق
  const [completedLessonIds, setCompletedLessonIds] = useState<Record<string, number[]>>({});
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);

  // تسجيل الجلسة المفتوح حالياً في Popup الفيديو
  const [activeRecording, setActiveRecording] = useState<SessionRecording | null>(null);
  const closeRecording = useCallback(() => setActiveRecording(null), []);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const { registeredCourses, updateCourseProgress, profile } = useAuthStore();

  const activeCourse = courses.find((c) => c.id === activeCourseId);
  const activeUserCourse = registeredCourses.find((c) => c.id === activeCourseId);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.getCourses();
        if (controller.signal.aborted) return;
        setCourses(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setCourses([]);
        setError(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [reloadKey]);

  // Fetch certificate when course reaches 100%
  useEffect(() => {
    if (!activeCourse || !activeUserCourse || activeUserCourse.progress < 100) return;
    let cancelled = false;
    const fetchCert = async () => {
      setCertificateLoading(true);
      try {
        const existing = await apiService.getCertificate(activeCourse.id);
        if (!cancelled) setCertificate(existing);
      } catch (err) {
        // Only try to issue certificate on 404 (not found).
        // 401/403 = auth/authorization problem, 5xx/network = backend error.
        // Do NOT auto-issue on arbitrary server failures.
        const isNotFound = err instanceof ApiError && err.status === 404;
        if (isNotFound) {
          try {
            const issued = await apiService.issueCertificate(activeCourse.id);
            if (!cancelled) setCertificate(issued);
          } catch (issueErr) {
            console.warn("Failed to issue certificate:", issueErr);
          }
        } else {
          console.warn("Certificate fetch failed (non-404):", err);
        }
      } finally {
        if (!cancelled) setCertificateLoading(false);
      }
    };
    fetchCert();
    return () => { cancelled = true; };
  }, [activeCourse, activeUserCourse, activeUserCourse?.progress]);

  const closeCertificate = useCallback(() => {
    setShowCertificate(false);
    setCertificate(null);
  }, []);
  // ── سلوك الحوار: Escape، حصر الفوكس، إرجاع الفوكس، قفل تمرير الصفحة ──
  useEffect(() => {
    if (!showCertificate) return;

    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = (): HTMLElement[] => {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    };

    // الفوكس يبدأ جوه الحوار، مش فاضل على الزر اللي فتحه
    const initial = focusables()[0] ?? dialogRef.current;
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCertificate();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const active = document.activeElement;
      const inside = dialogRef.current?.contains(active) ?? false;

      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      lastFocusedRef.current?.focus();
    };
  }, [showCertificate, closeCertificate]);

  /**
   * الدروس المكتملة للمساق. `completedLessonIds` حالة محلية بتضيع مع الـ reload،
   * فلو مفيش سجل محلي بنستنتج العدد من نسبة التقدّم المحفوظة في الـ store —
   * كده الطالب ما يلاقيش نفسه راجع للدرس الأول بعد ما كان في النص.
   */
  const getCompleted = useCallback(
    (course: Course): number[] => {
      const local = completedLessonIds[course.id];
      if (local) return local;

      const total = lessonTotalOf(course);
      if (total <= 0) return [];
      // بنستنتج العدد من نسبة التقدّم المحفوظة في الـ store — كده الطالب
      // ما يلاقيش نفسه راجع للدرس الأول بعد ما كان في النص.
      // المساق غير المسجّل (أو المسجّل بنسبة 0%) يبدأ بصفر دروس مكتملة.
      const stored = registeredCourses.find((c) => c.id === course.id)?.progress;
      const done = typeof stored === "number" && Number.isFinite(stored)
        ? Math.min(total, Math.max(0, Math.round((stored / 100) * total)))
        : 0;
      return Array.from({ length: done }, (_, index) => index + 1);
    },
    [completedLessonIds, registeredCourses]
  );

  // إكمال درس وزيادة النسبة في الـ Auth Store
  const handleCompleteLesson = (course: Course, lessonIndex: number) => {
    const total = lessonTotalOf(course);
    const currentCompleted = getCompleted(course);
    if (currentCompleted.includes(lessonIndex)) return;

    const updated = [...currentCompleted, lessonIndex];
    setCompletedLessonIds({ ...completedLessonIds, [course.id]: updated });

    // النسبة بتتحسب على عدد دروس المساق الحقيقي — مساق بـ 12 درس
    // ما ينفعش يخلص من ضغطتين. و100% بتيجي بس لما كل الدروس تخلص.
    const done = Math.min(updated.length, total);
    const newProgress = done >= total ? 100 : Math.min(99, Math.round((done / total) * 100));
    updateCourseProgress(course.id, course.titleAr, course.titleEn, newProgress);

    if (done >= total) {
      setShowCertificate(true);
    }
  };

  const header = (
    <section className="hub-header text-center">
      <span className="eyebrow">{t("learningHub")}</span>
      <h1 className="section-title">
        {isAr ? "أكاديمية كلايمتيفاي للتعليم البيئي" : "Climatify Academy for Climate Action"}
      </h1>
      <p className="section-lead mx-auto">
        {isAr
          ? "تعلم مجاناً واحصل على شهادات معتمدة في الرقمنة البيئية والمناخية لخدمة مجتمعك."
          : "Learn for free and obtain certified credentials in climate digitization to serve your local community."}
      </p>
    </section>
  );

  const activeLessonTotal = activeCourse ? lessonTotalOf(activeCourse) : 0;
  const activeCompleted = activeCourse ? getCompleted(activeCourse) : [];
  const activeDoneCount = Math.min(activeCompleted.length, activeLessonTotal);
  const certificateEarned =
    activeUserCourse?.progress === 100 || (activeLessonTotal > 0 && activeDoneCount >= activeLessonTotal);

  return (
    <div className="learning-hub-page-container container">
      {/* 1. Header */}
      {header}

      {/* 2. Main Layout — تحميل ← خطأ ← فاضي ← المحتوى */}
      <section className="hub-content-section section">
        {loading && <RouteLoader label={isAr ? "جارٍ تحميل المساقات…" : "Loading courses…"} />}

        {!loading && error !== null && (
          <EmptyState
            type="error"
            titleEn="We couldn't load the courses"
            titleAr="تعذّر تحميل المساقات"
            descriptionEn={localizeError(error, "en")}
            descriptionAr={localizeError(error, "ar")}
            actionEn="Try again"
            actionAr="إعادة المحاولة"
            onAction={() => setReloadKey((key) => key + 1)}
          />
        )}

        {!loading && error === null && courses.length === 0 && (
          <EmptyState
            type="empty"
            titleEn="No courses published yet"
            titleAr="لا توجد مساقات متاحة بعد"
            descriptionEn="The academy catalogue is being prepared. Check back soon."
            descriptionAr="كتالوج الأكاديمية تحت التحضير. تابعنا قريباً."
            actionEn="Refresh"
            actionAr="تحديث"
            onAction={() => setReloadKey((key) => key + 1)}
          />
        )}

        {!loading && error === null && courses.length > 0 && (
          activeCourse ? (
            <div className="active-course-study-panel card">
              <button type="button" className="btn btn-ghost back-to-list-btn" onClick={() => setActiveCourseId(null)}>
                {isAr ? "← العودة لقائمة المساقات" : "← Back to Courses"}
              </button>

              <div className="active-course-header-grid">
                <div className="active-course-thumbnail-wrapper">
                  <img src={activeCourse.image} alt="" className="active-course-img" />
                </div>
                <div className="active-course-main-details">
                  <span className="course-category-tag">{isAr ? activeCourse.categoryAr : activeCourse.categoryEn}</span>
                  <h2>{isAr ? activeCourse.titleAr : activeCourse.titleEn}</h2>
                  <p className="instructor-row">
                    <GraduationCap size={16} aria-hidden="true" />
                    <span>{isAr ? `المحاضر: ${activeCourse.instructorAr}` : `Instructor: ${activeCourse.instructorEn}`}</span>
                  </p>

                  <div className="course-stats-badges-row">
                    <span>
                      <Clock size={14} aria-hidden="true" />
                      {isAr ? activeCourse.durationAr : activeCourse.durationEn}
                    </span>
                    <span>
                      <BookOpen size={14} aria-hidden="true" />
                      {lessonsCountLabel(activeLessonTotal, isAr)}
                    </span>
                    {activeUserCourse && (
                      <span className="progress-badge">
                        {isAr ? `نسبة الإنجاز: ${activeUserCourse.progress}%` : `Progress: ${activeUserCourse.progress}%`}
                      </span>
                    )}
                  </div>

                  <p className="full-description">
                    {isAr ? activeCourse.descriptionAr : activeCourse.descriptionEn}
                  </p>

                  {/* دروس المساق المتاحة وتتبع الإنجاز */}
                  <div className="lessons-simulator-list-box">
                    <h4 className="lessons-box-title">
                      <Lightbulb size={18} aria-hidden="true" />
                      {isAr ? "منهج المساق والدروس التفاعلية:" : "Course Syllabus Lessons:"}
                    </h4>

                    <p className="lessons-progress-summary">
                      {isAr
                        ? `أكملت ${activeDoneCount} من ${activeLessonTotal} درساً`
                        : `${activeDoneCount} of ${activeLessonTotal} lessons completed`}
                    </p>

                    {Array.from({ length: activeLessonTotal }, (_, index) => index + 1).map((lessonIndex) => {
                      const isDone = activeCompleted.includes(lessonIndex);
                      const isUnlocked = lessonIndex === 1 || activeCompleted.includes(lessonIndex - 1);
                      const isLast = lessonIndex === activeLessonTotal;

                      return (
                        <div
                          key={lessonIndex}
                          className={`lesson-item-simulated${!isDone && !isUnlocked ? " lock-state" : ""}`}
                        >
                          <span>{lessonIndex}. {lessonTitleFor(lessonIndex, isAr)}</span>

                          {isDone ? (
                            <span className="lesson-status-completed">
                              <CheckCircle size={14} aria-hidden="true" /> {isAr ? "مكتمل" : "Completed"}
                            </span>
                          ) : isUnlocked ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleCompleteLesson(activeCourse, lessonIndex)}
                            >
                              {isLast
                                ? (isAr ? "إكمال الدرس والحصول على الشهادة" : "Complete & Get Certificate")
                                : (isAr ? `إكمال الدرس ${lessonIndex}` : `Complete Lesson ${lessonIndex}`)}
                            </button>
                          ) : (
                            <span className="lock-label">
                              <Lock size={14} aria-hidden="true" />{" "}
                              {isAr ? `مغلق (أكمل الدرس ${lessonIndex - 1} أولاً)` : `Locked (finish lesson ${lessonIndex - 1})`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* زر استعراض الشهادة إذا كان الكورس مكتمل */}
                  {certificateEarned && (
                    <button
                      type="button"
                      className="btn btn-primary view-certificate-btn"
                      onClick={() => setShowCertificate(true)}
                    >
                      <Award size={18} aria-hidden="true" />
                      <span>{isAr ? "عرض وتحميل الشهادة الرقمية المعتمدة" : "View & Download Certificate"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="courses-grid-list-layout">
              {courses.map((course) => {
                const userCourse = registeredCourses.find((c) => c.id === course.id);
                const total = lessonTotalOf(course);
                return (
                  <div key={course.id} className="course-card-item card">
                    <div className="course-card-img-banner">
                      <img
                        src={course.image}
                        alt=""
                        className="course-cover-banner"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                      <span className="course-badge-category">
                        {isAr ? course.categoryAr : course.categoryEn}
                      </span>
                    </div>

                    <div className="course-card-body-details">
                      <h3>{isAr ? course.titleAr : course.titleEn}</h3>
                      <p className="excerpt">
                        {isAr ? course.descriptionAr.slice(0, 100) + "..." : course.descriptionEn.slice(0, 100) + "..."}
                      </p>

                      <div className="course-meta-data-badges">
                        <span>
                          <Clock size={14} aria-hidden="true" />
                          {isAr ? course.durationAr : course.durationEn}
                        </span>
                        <span>
                          <BookOpen size={14} aria-hidden="true" />
                          {lessonsCountLabel(total, isAr)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveCourseId(course.id);
                          if (!userCourse) {
                            // التسجيل بيضيف المساق بنسبة 0% من غير نقاط — الدرس الأول
                            // متاح فوراً، والمكافآت بتتصرف لما الدروس تكتمل فعلاً.
                            updateCourseProgress(course.id, course.titleAr, course.titleEn, 0);
                          }
                        }}
                        className="btn btn-primary start-course-btn"
                      >
                        <Award size={16} aria-hidden="true" />
                        <span>
                          {userCourse
                            ? (isAr ? `متابعة الدراسة (${userCourse.progress}%)` : `Continue (${userCourse.progress}%)`)
                            : (isAr ? "ابدأ هذا الكورس" : "Start Course")}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>

      {/* 3. Learning Content Partners — شركاء محتوى التعلم */}
      <section className="hub-partners-section" aria-labelledby="hub-partners-title">
        <h2 id="hub-partners-title" className="hub-partners-title">
          {isAr ? "شركاء محتوى التعلم" : "Learning Content Partners"}
        </h2>
        <LogoMarquee
          partners={partnersByGroup("learning")}
          labelAr="لوجوهات شركاء محتوى التعلم"
          labelEn="Learning content partner logos"
        />
      </section>

      {/* 4. Session Recordings — تسجيلات جلسات برنامج SHIFT */}
      {sessionRecordings.length > 0 && (
        <section className="hub-recordings-section section" aria-labelledby="hub-recordings-title">
          <div className="text-center hub-recordings-header">
            <span className="eyebrow">{isAr ? "تسجيلات الجلسات" : "Session Recordings"}</span>
            <h2 id="hub-recordings-title" className="section-title">
              {isAr ? "شاهد جلسات برنامج SHIFT المسجّلة" : "Watch the recorded SHIFT program sessions"}
            </h2>
          </div>

          <ul className="hub-recordings-grid">
            {sessionRecordings.map((recording) => {
              const title = isAr ? recording.titleAr : recording.titleEn;
              return (
                <li key={recording.id} className="hub-recording-card card">
                  <span className="hub-recording-icon" aria-hidden="true">
                    <CirclePlay size={28} />
                  </span>
                  <div className="hub-recording-body">
                    <h3>{title}</h3>
                    <p className="hub-recording-date">
                      <Calendar size={14} aria-hidden="true" />
                      <span>{recording.date}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm hub-recording-btn"
                    onClick={() => setActiveRecording(recording)}
                    aria-label={isAr ? `شاهد الفيديو: ${title}` : `Watch video: ${title}`}
                  >
                    <CirclePlay size={16} aria-hidden="true" />
                    <span>{isAr ? "شاهد الفيديو" : "Watch Video"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {activeRecording && (
        <VideoModal
          title={isAr ? activeRecording.titleAr : activeRecording.titleEn}
          source={{
            kind: "iframe",
            src: `https://drive.google.com/file/d/${activeRecording.driveFileId}/preview`,
          }}
          onClose={closeRecording}
        />
      )}

      {/* 5. Certificate Modal */}
      {showCertificate && certificate && (
        <div className="modal-overlay" onClick={closeCertificate}>
          <div
            className="modal-content certificate-modal card"
            onClick={(e) => e.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-dialog-title"
            tabIndex={-1}
          >
            <div className="modal-header">
              <h3 id="certificate-dialog-title" className="modal-title">
                <Sparkles size={20} aria-hidden="true" />
                {isAr ? "الشهادة الرقمية المعتمدة" : "Official Digital Certificate"}
              </h3>
              <button
                type="button"
                className="btn-close"
                onClick={closeCertificate}
                aria-label={isAr ? "إغلاق الشهادة" : "Close certificate"}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="certificate-paper-body text-center">
              <Award size={48} className="certificate-seal" aria-hidden="true" />
              <h2 className="certificate-heading">
                {isAr ? "شهادة إتمام مساق بيئي" : "Certificate of Environmental Achievement"}
              </h2>
              <p className="certificate-preamble">
                {isAr ? "تشهد منصة كلايمتيفاي بأن:" : "Climatify Digital Platform certifies that:"}
              </p>
              <h3 className="certificate-recipient">
                {profile?.name || (isAr ? "المستفيد البيئي المميز" : "Valued Environmental Scholar")}
              </h3>
              <p className="certificate-statement">
                {isAr
                  ? `قد أكمل بنجاح المساق التدريبي المعنون: "${activeCourse?.titleAr}"`
                  : `Has successfully completed the climate academy course: "${activeCourse?.titleEn}"`}
              </p>
              <div className="certificate-meta-row">
                <div>
                  <strong>{isAr ? "تاريخ الإصدار:" : "Issue Date:"}</strong>
                  <p>{new Date(certificate.issuedAt).toLocaleDateString(isAr ? "ar-AE" : "en-GB")}</p>
                </div>
                <div>
                  <strong>{isAr ? "معرّف الشهادة الرقمية:" : "Credential ID:"}</strong>
                  <p>{certificate.certificateId}</p>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
                <Printer size={16} aria-hidden="true" />
                <span>{isAr ? "طباعة الشهادة" : "Print Certificate"}</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={closeCertificate}>
                <CheckCircle size={16} aria-hidden="true" />
                <span>{isAr ? "إغلاق" : "Close"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Certificate Loading */}
      {showCertificate && certificateLoading && (
        <div className="modal-overlay">
          <div className="modal-content certificate-modal card" role="dialog" aria-modal="true">
            <div className="certificate-paper-body text-center">
              <div className="loading-spinner" aria-label={isAr ? "جاري تحميل الشهادة..." : "Loading certificate..."} />
              <p>{isAr ? "جاري تحميل الشهادة..." : "Loading certificate..."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
