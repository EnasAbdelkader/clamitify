import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  Award, Building2, School, GraduationCap, Download, CheckCircle2, Send,
  ShieldCheck, Heart, FileText, Users
} from "lucide-react";
import { apiService, ApiError, sanitizeUrl } from "../../services/api";
import type { PartnershipSubmitDto, WorkshopRequestDto } from "../../types";
import { PartnerMark } from "../../components/LogoMarquee/LogoMarquee";
import { partnersByGroup } from "../../data/partners";
import "../../components/LogoMarquee/LogoMarquee.css";
import "./Portals.css";

/**
 * ──────────────────────────────────────────────────────────────
 *  صفحة الشركاء — Partners Page (كانت "البوابات" — المسار /partners)
 *  فوق: لوجوهات الشركاء. تحت: تقديم طلب شراكة (أعمال / مدارس وجامعات)
 * ──────────────────────────────────────────────────────────────
 *
 *  نقاط الاتصال بالسيرفر (كلها متنفّذة بالفعل عن طريق apiService،
 *  والمسارات النهائية معرّفة في src/services/api.ts):
 *    • POST /api/partnerships       → PartnershipSubmitDto
 *    • POST /api/workshops          → WorkshopRequestDto
 *    • GET  /api/curricula/download → { url: string }
 *
 *  أي فشل بيرجع ApiError، والواجهة لازم تعرضه للمستخدم — مفيش
 *  شاشة نجاح من غير رد ناجح فعلي من السيرفر.
 * ──────────────────────────────────────────────────────────────
 */

type SubmitStatus = "idle" | "loading" | "success" | "error";

/** رسالة خطأ جاهزة للعرض مهما كان نوع الخطأ الراجع. */
const toErrorMessage = (err: unknown, language: string): string =>
  err instanceof ApiError
    ? err.localizedMessage(language)
    : language === "ar"
      ? "حدث خطأ غير متوقع."
      : "An unexpected error occurred.";

export const Portals: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [activePortal, setActivePortal] = useState<"partner" | "education">("partner");

  // ── فورم الشركاء ──
  const [partnerForm, setPartnerForm] = useState<PartnershipSubmitDto>({
    orgName: "",
    orgType: "corporate",
    contactPerson: "",
    email: "",
    proposal: ""
  });
  const [partnerStatus, setPartnerStatus] = useState<SubmitStatus>("idle");
  const [partnerError, setPartnerError] = useState<string | null>(null);

  // ── فورم المدارس والجامعات ──
  // studentCount نصّ في WorkshopRequestDto، وقيمة الـ input رقمية كنص — متطابقين
  const [eduForm, setEduForm] = useState<WorkshopRequestDto>({
    institutionName: "",
    city: "",
    studentCount: "",
    workshopType: "climate-basics",
    email: ""
  });
  const [eduStatus, setEduStatus] = useState<SubmitStatus>("idle");
  const [eduError, setEduError] = useState<string | null>(null);

  // ── حالة تحميل المناهج ──
  const [downloadStatus, setDownloadStatus] = useState<SubmitStatus>("idle");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // كل المؤقتات في مكان واحد عشان تتلغي لو المستخدم ساب الصفحة
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, []);

  /** POST /api/partnerships — شاشة النجاح بتظهر بس لما السيرفر يقبل فعلاً. */
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (partnerStatus === "loading") return;
    setPartnerStatus("loading");
    setPartnerError(null);
    try {
      await apiService.submitPartnership(partnerForm);
      setPartnerStatus("success");
      schedule(() => {
        setPartnerStatus("idle");
        setPartnerForm({ orgName: "", orgType: "corporate", contactPerson: "", email: "", proposal: "" });
      }, 3000);
    } catch (err) {
      setPartnerStatus("error");
      setPartnerError(toErrorMessage(err, language));
    }
  };

  /** POST /api/workshops */
  const handleEduSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (eduStatus === "loading") return;
    setEduStatus("loading");
    setEduError(null);
    try {
      await apiService.submitWorkshopRequest(eduForm);
      setEduStatus("success");
      schedule(() => {
        setEduStatus("idle");
        setEduForm({ institutionName: "", city: "", studentCount: "", workshopType: "climate-basics", email: "" });
      }, 3000);
    } catch (err) {
      setEduStatus("error");
      setEduError(toErrorMessage(err, language));
    }
  };

  /**
   * GET /api/curricula/download — بيرجع { url } وإحنا بنفتحه للتحميل فعلياً.
   * الرابط بيعدي على sanitizeUrl عشان رد مضروب من السيرفر ما يقدرش يحقن javascript:
   *
   * للروابط على نفس الأصل بنعمل HEAD الأول: ملف مش موجود بيكون بيرجع 200 HTML
   * (fallback الـSPA) فبدل ما نعلن "تم التحميل" وينزل ملف مضروب، بنعرض خطأ واضح.
   * الروابط الخارجية منفحش فيها — CORS ممكن يمنع الـHEAD وده معناهش إن الملف بايبوظ.
   */
  const handleDownload = async () => {
    if (downloadStatus === "loading") return;
    setDownloadStatus("loading");
    setDownloadError(null);
    try {
      const result = await apiService.getCurriculaDownloadUrl();
      const rawUrl = result && typeof result.url === "string" ? result.url : "";
      const safeUrl = sanitizeUrl(rawUrl);
      if (!safeUrl || safeUrl === "#invalid-url") {
        throw new ApiError("Invalid download URL returned by the server", 500, "/curricula/download", result);
      }

      let resolvedUrlOrigin: string | null = null;
      try {
        resolvedUrlOrigin = new URL(safeUrl, window.location.href).origin;
      } catch {
        throw new ApiError(`Unparseable download URL: ${safeUrl}`, 500, "/curricula/download", result);
      }
      if (resolvedUrlOrigin === window.location.origin) {
        const head = await fetch(safeUrl, { method: "HEAD" });
        if (!head.ok) {
          throw new ApiError("Curriculum file is not available", head.status, "/curricula/download");
        }
        const contentType = head.headers.get("content-type") ?? "";
        // text/html هنا معناه غالباً إن الـSPA fallback رد بدل الملف المفقود
        if (/^text\/html/i.test(contentType)) {
          throw new ApiError("Curriculum file is missing on the server", 404, "/curricula/download");
        }
      }

      const link = document.createElement("a");
      link.href = safeUrl;
      link.download = "";
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setDownloadStatus("success");
      schedule(() => setDownloadStatus("idle"), 2500);
    } catch (err) {
      setDownloadStatus("error");
      setDownloadError(toErrorMessage(err, language));
    }
  };

  const downloading = downloadStatus === "loading";

  return (
    <div className="portals-page">
      {/* ── Hero ── */}
      <section className="portals-hero">
        <div className="container">
          <span className="eyebrow">
            {language === "ar" ? "شراكات من أجل المناخ" : "Partnerships for Climate"}
          </span>
          <h1 className="section-title">
            {language === "ar" ? (
              <><span className="text-gradient">شركاؤنا</span> في العمل المناخي</>
            ) : (
              <>Our <span className="text-gradient">Partners</span> in Climate Action</>
            )}
          </h1>
          <p className="section-lead mx-auto">
            {language === "ar"
              ? "نعمل مع جهات حكومية ومنظمات دولية وجامعات لتوحيد الجهود وبناء مستقبل أكثر استدامة."
              : "We work with government entities, international organizations and universities to unite efforts for a more sustainable future."}
          </p>
        </div>
      </section>

      {/* ── شركاؤنا: اللوجوهات ── */}
      <section className="partners-showcase-section section" aria-labelledby="partners-main-title">
        <div className="container">
          <h2 id="partners-main-title" className="partners-group-title">
            {isAr ? "شركاؤنا" : "Our Partners"}
          </h2>
          <ul className="partners-logo-grid">
            {partnersByGroup("partner").map((partner) => (
              <li key={partner.id} className={`partner-logo-tile ${partner.logo ? "has-logo" : ""}`}>
                <PartnerMark partner={partner} isAr={isAr} />
              </li>
            ))}
          </ul>

          <h2 className="partners-group-title partners-group-title-spaced">
            {isAr ? "شركاء محتوى التعلم" : "Learning Content Partners"}
          </h2>
          <ul className="partners-logo-grid">
            {partnersByGroup("learning").map((partner) => (
              <li key={partner.id} className={`partner-logo-tile ${partner.logo ? "has-logo" : ""}`}>
                <PartnerMark partner={partner} isAr={isAr} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── تقديم طلب شراكة ── */}
      <section className="portal-content-section section" id="partnership-request">
        <div className="container">
          <div className="partnership-request-header text-center">
            <span className="eyebrow">{isAr ? "كن شريكاً" : "Become a Partner"}</span>
            <h2 className="section-title">{isAr ? "تقديم طلب شراكة" : "Submit a Partnership Request"}</h2>

            {/* نوع الشراكة */}
            <div className="portals-tabs">
              <button
                type="button"
                className={`portal-tab ${activePortal === "partner" ? "active" : ""}`}
                onClick={() => setActivePortal("partner")}
                aria-pressed={activePortal === "partner"}
              >
                <Building2 size={18} />
                <span>{language === "ar" ? "شراكات الأعمال" : "Corporate"}</span>
              </button>
              <button
                type="button"
                className={`portal-tab ${activePortal === "education" ? "active" : ""}`}
                onClick={() => setActivePortal("education")}
                aria-pressed={activePortal === "education"}
              >
                <School size={18} />
                <span>{language === "ar" ? "مدارس وجامعات" : "Education"}</span>
              </button>
            </div>
          </div>

          <div className="portal-grid" key={activePortal}>
            {/* العمود الأيسر: معلومات + فوائد + تحميل */}
            <div className="portal-info-side portal-fade-in">
              <span className="eyebrow">
                {activePortal === "partner"
                  ? (language === "ar" ? "شراكات الأعمال" : "Corporate Partnerships")
                  : (language === "ar" ? "التعليم المناخي" : "Climate Education")}
              </span>
              <h2 className="portal-info-title">
                {activePortal === "partner"
                  ? (language === "ar" ? "تحول رقمي أخضر" : "Green Digital Transition")
                  : (language === "ar" ? "توعية جيل الغد" : "Next Climate Leaders")}
              </h2>
              <p className="portal-info-desc">
                {activePortal === "partner"
                  ? (language === "ar"
                    ? "شراكات استراتيجية لتعزيز الوعي المناخي وبناء حلول رقمية مستدامة."
                    : "Strategic collaborations to accelerate climate awareness and scalable solutions.")
                  : (language === "ar"
                    ? "مناهج متكاملة وورش تفاعلية لبناء الوعي المناخي بين الطلاب."
                    : "Comprehensive curricula and interactive workshops for students.")}
              </p>

              {/* الفوائد */}
              <div className="portal-benefits">
                {activePortal === "partner" ? (
                  <>
                    <div className="benefit-item">
                      <ShieldCheck size={20} className="benefit-icon" />
                      <span>{language === "ar" ? "تقارير بصمة كربونية وأثر بيئي." : "Carbon footprint & impact reports."}</span>
                    </div>
                    <div className="benefit-item">
                      <Heart size={20} className="benefit-icon" />
                      <span>{language === "ar" ? "إشراك الموظفين في حملات مستدامة." : "Employee engagement in sustainability."}</span>
                    </div>
                    <div className="benefit-item">
                      <Award size={20} className="benefit-icon" />
                      <span>{language === "ar" ? "شهادات استدامة معتمدة ESG." : "Accredited ESG credits."}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="benefit-item">
                      <FileText size={20} className="benefit-icon" />
                      <span>{language === "ar" ? "مناهج مجانية حول الاستدامة." : "Free sustainability curricula."}</span>
                    </div>
                    <div className="benefit-item">
                      <Users size={20} className="benefit-icon" />
                      <span>{language === "ar" ? "ورش تفاعلية بقيادة خبراء." : "Interactive expert-led workshops."}</span>
                    </div>
                    <div className="benefit-item">
                      <GraduationCap size={20} className="benefit-icon" />
                      <span>{language === "ar" ? "شهادات إتمام معتمدة للطلاب." : "Accredited student certificates."}</span>
                    </div>
                  </>
                )}
              </div>

              {/* تحميل المناهج — بس في بوابة التعليم */}
              {activePortal === "education" && (
                <div className="portal-download-box">
                  <div className="download-box-header">
                    <Download size={22} />
                    <h4>{language === "ar" ? "مناهج التوعية المناخية" : "Climate Curricula"}</h4>
                  </div>
                  <p>
                    {language === "ar"
                      ? "أنشطة صيفية ومواد مبسطة حول الاستدامة."
                      : "Summer activities and simplified sustainability materials."}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-full-width download-btn"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download size={16} />
                    <span>
                      {downloading
                        ? (isAr ? "جاري التحميل..." : "Downloading...")
                        : downloadStatus === "success"
                          ? (isAr ? "تم التحميل ✓" : "Downloaded ✓")
                          : (isAr ? "تحميل الحقيبة (PDF)" : "Download Kit (PDF)")}
                    </span>
                  </button>

                  {downloadStatus === "success" && (
                    <p className="portal-download-note" role="status" aria-live="polite">
                      {isAr
                        ? "لو ما بدأش التحميل تلقائياً، راجع إعدادات المتصفح الخاصة بالنوافذ المنبثقة."
                        : "If the download did not start, check your browser's pop-up settings."}
                    </p>
                  )}

                  {downloadStatus === "error" && downloadError && (
                    <p className="portal-alert portal-alert-on-gradient" role="alert">
                      {downloadError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* العمود الأيمن: النموذج */}
            <div className="portal-form-side portal-fade-in">
              <div className="portal-form-wrapper card glass">
                {activePortal === "partner" ? (
                  partnerStatus === "success" ? (
                    <div className="form-success-state text-center" role="status" aria-live="polite">
                      <CheckCircle2 size={48} className="success-icon" />
                      <h3>{language === "ar" ? "تم استلام المقترح!" : "Proposal Submitted!"}</h3>
                      <p>{language === "ar" ? "هيتواصل معاك فريقنا قريباً." : "Our team will contact you soon."}</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePartnerSubmit} className="portal-form">
                      <div className="portal-form-header">
                        <h3>{language === "ar" ? "طلب شراكة" : "Partnership Request"}</h3>
                      </div>

                      {partnerStatus === "error" && partnerError && (
                        <p className="portal-alert" role="alert">{partnerError}</p>
                      )}

                      <div className="form-group">
                        <label htmlFor="partner-orgName">{language === "ar" ? "اسم المؤسسة" : "Organization Name"}</label>
                        <input
                          id="partner-orgName"
                          name="orgName"
                          type="text"
                          required
                          autoComplete="organization"
                          className="form-control"
                          value={partnerForm.orgName}
                          onChange={(e) => setPartnerForm({ ...partnerForm, orgName: e.target.value })}
                          placeholder={language === "ar" ? "مؤسسة الإمارات للبيئة" : "EcoCorp Global"}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="partner-orgType">{language === "ar" ? "نوع المؤسسة" : "Organization Type"}</label>
                        <select
                          id="partner-orgType"
                          name="orgType"
                          className="form-control"
                          value={partnerForm.orgType}
                          onChange={(e) => setPartnerForm({ ...partnerForm, orgType: e.target.value })}
                        >
                          <option value="corporate">{language === "ar" ? "شركة خاصة" : "Corporate"}</option>
                          <option value="government">{language === "ar" ? "جهة حكومية" : "Government"}</option>
                          <option value="ngo">{language === "ar" ? "منظمة غير ربحية" : "NGO"}</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="partner-contactPerson">{language === "ar" ? "شخص التواصل" : "Contact Person"}</label>
                        <input
                          id="partner-contactPerson"
                          name="contactPerson"
                          type="text"
                          required
                          autoComplete="name"
                          className="form-control"
                          value={partnerForm.contactPerson}
                          onChange={(e) => setPartnerForm({ ...partnerForm, contactPerson: e.target.value })}
                          placeholder={language === "ar" ? "مريم العلي" : "Sarah Smith"}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="partner-email">{language === "ar" ? "البريد الإلكتروني" : "Email"}</label>
                        <input
                          id="partner-email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          className="form-control"
                          value={partnerForm.email}
                          onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                          placeholder="partnerships@domain.com"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="partner-proposal">{language === "ar" ? "تفاصيل الشراكة" : "Partnership Scope"}</label>
                        <textarea
                          id="partner-proposal"
                          name="proposal"
                          rows={3}
                          required
                          className="form-control"
                          value={partnerForm.proposal}
                          onChange={(e) => setPartnerForm({ ...partnerForm, proposal: e.target.value })}
                          placeholder={language === "ar" ? "كيف تحب تتعاون معانا؟" : "How would you like to collaborate?"}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-full-width"
                        disabled={partnerStatus === "loading"}
                      >
                        <Send size={16} />
                        <span>
                          {partnerStatus === "loading"
                            ? (isAr ? "جارٍ الإرسال…" : "Submitting…")
                            : (isAr ? "تقديم الطلب" : "Submit")}
                        </span>
                      </button>
                    </form>
                  )
                ) : (
                  eduStatus === "success" ? (
                    <div className="form-success-state text-center" role="status" aria-live="polite">
                      <CheckCircle2 size={48} className="success-icon" />
                      <h3>{language === "ar" ? "تم تسجيل الطلب!" : "Workshop Requested!"}</h3>
                      <p>{language === "ar" ? "منسق المدارس هيتواصل معاكم قريباً." : "Our coordinator will contact you soon."}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleEduSubmit} className="portal-form">
                      <div className="portal-form-header">
                        <h3>{language === "ar" ? "طلب ورشة عمل" : "Workshop Request"}</h3>
                      </div>

                      {eduStatus === "error" && eduError && (
                        <p className="portal-alert" role="alert">{eduError}</p>
                      )}

                      <div className="form-group">
                        <label htmlFor="edu-institutionName">{language === "ar" ? "اسم المؤسسة" : "Institution Name"}</label>
                        <input
                          id="edu-institutionName"
                          name="institutionName"
                          type="text"
                          required
                          autoComplete="organization"
                          className="form-control"
                          value={eduForm.institutionName}
                          onChange={(e) => setEduForm({ ...eduForm, institutionName: e.target.value })}
                          placeholder={language === "ar" ? "مدرسة دبي الوطنية" : "Dubai University"}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="edu-city">{language === "ar" ? "المدينة" : "City"}</label>
                        <input
                          id="edu-city"
                          name="city"
                          type="text"
                          required
                          autoComplete="address-level2"
                          className="form-control"
                          value={eduForm.city}
                          onChange={(e) => setEduForm({ ...eduForm, city: e.target.value })}
                          placeholder={language === "ar" ? "دبي" : "Dubai"}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="edu-studentCount">{language === "ar" ? "عدد الطلاب" : "Student Count"}</label>
                        <input
                          id="edu-studentCount"
                          name="studentCount"
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          required
                          className="form-control"
                          value={eduForm.studentCount}
                          onChange={(e) => setEduForm({ ...eduForm, studentCount: e.target.value })}
                          placeholder="50"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="edu-workshopType">{language === "ar" ? "نوع الورشة" : "Workshop Type"}</label>
                        <select
                          id="edu-workshopType"
                          name="workshopType"
                          className="form-control"
                          value={eduForm.workshopType}
                          onChange={(e) => setEduForm({ ...eduForm, workshopType: e.target.value })}
                        >
                          <option value="climate-basics">{language === "ar" ? "مبادئ المناخ" : "Climate Basics"}</option>
                          <option value="carbon-calculator">{language === "ar" ? "بصمة الكربون" : "Carbon Footprint"}</option>
                          <option value="ghaf-planting">{language === "ar" ? "زراعة الغاف" : "Ghaf Planting"}</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="edu-email">{language === "ar" ? "بريد المنسق" : "Coordinator Email"}</label>
                        <input
                          id="edu-email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          className="form-control"
                          value={eduForm.email}
                          onChange={(e) => setEduForm({ ...eduForm, email: e.target.value })}
                          placeholder="coordinator@school.edu"
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-full-width"
                        disabled={eduStatus === "loading"}
                      >
                        <GraduationCap size={16} />
                        <span>
                          {eduStatus === "loading"
                            ? (isAr ? "جارٍ الإرسال…" : "Submitting…")
                            : (isAr ? "طلب الورشة" : "Book Workshop")}
                        </span>
                      </button>
                    </form>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
