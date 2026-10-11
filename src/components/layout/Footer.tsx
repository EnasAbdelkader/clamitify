import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { Send, CheckCircle, Mail, MapPin, AlertCircle } from "lucide-react";
import { apiService, ApiError } from "../../services/api";
import "./Footer.css";

type SubmitStatus = "idle" | "loading" | "success" | "error";

export const Footer: React.FC = () => {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  /**
   * الـ API صار يرمي ApiError عند أي فشل، فالنسخة القديمة (console.error فقط)
   * كانت تُنتج نموذجاً لا يستجيب إطلاقاً: يضغط المستخدم "اشترك" ولا يحدث شيء.
   */
  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return; // منع الإرسال المزدوج

    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("error");
      setErrorMsg(language === "ar" ? "برجاء إدخال بريد إلكتروني." : "Please enter an email address.");
      return;
    }

    setStatus("loading");
    setErrorMsg(null);

    try {
      const response = await apiService.subscribeNewsletter(trimmed);

      // الخادم قد يجيب 200 مع success:false — لا نعدّها نجاحاً.
      if (response && response.success === false) {
        setStatus("error");
        setErrorMsg(
          response.message ||
            (language === "ar" ? "تعذّر إتمام الاشتراك. حاول مرة أخرى." : "Could not complete the subscription. Please try again.")
        );
        return;
      }

      setStatus("success");
      setEmail("");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setStatus("idle"), 6000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof ApiError
          ? err.localizedMessage(language)
          : language === "ar"
            ? "حدث خطأ غير متوقع. حاول مرة أخرى."
            : "An unexpected error occurred. Please try again."
      );
    }
  };

  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { path: "/about", label: t("about") },
    { path: "/programs", label: t("programs") },
    { path: "/events", label: t("events") },
    { path: "/learning-hub", label: t("learningHub") },
    { path: "/contact", label: t("contact") },
  ];

  const serviceLinks = [
    { labelEn: "Digital Transformation", labelAr: "التحول الرقمي" },
    { labelEn: "Environmental Consultation", labelAr: "الاستشارات البيئية" },
    { labelEn: "Community Outreach", labelAr: "التوعية الجماهيرية" },
    { labelEn: "Research & Studies", labelAr: "الأبحاث والدراسات" },
    { labelEn: "Community Development", labelAr: "تطوير المجتمع" },
  ];

  return (
    <footer className="site-footer">
      {/* Newsletter Section */}
      <div className="container">
        <div className="newsletter-band" id="newsletter">
          <div className="glow a" aria-hidden="true"></div>
          <div className="glow b" aria-hidden="true"></div>
          <div className="newsletter-inner">
            <h2>{t("newsletterTitle")}</h2>
            <p>{t("newsletterSub")}</p>
            
            {status === "success" ? (
              <div className="newsletter-success-alert" role="status">
                <CheckCircle size={18} aria-hidden="true" />
                <span>
                  {language === "ar"
                    ? "شكراً لاشتراكك معنا! سنبقيك على اطلاع دائم بآخر المستجدات."
                    : "Thank you for subscribing! We'll keep you updated."}
                </span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="news-form" noValidate>
                <label className="sr-only" htmlFor="newsletter-email">
                  {language === "ar" ? "البريد الإلكتروني للنشرة الإخبارية" : "Newsletter email address"}
                </label>
                <input
                  id="newsletter-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  required
                  disabled={status === "loading"}
                  aria-invalid={status === "error" ? true : undefined}
                  aria-describedby={status === "error" ? "newsletter-error" : undefined}
                  className="news-input"
                />
                <button type="submit" className="news-submit-btn" disabled={status === "loading"}>
                  <span>
                    {status === "loading"
                      ? language === "ar" ? "جارٍ الإرسال…" : "Sending…"
                      : t("subscribe")}
                  </span>
                  {status === "loading" ? (
                    <span className="news-submit-spinner" aria-hidden="true" />
                  ) : (
                    <Send size={15} aria-hidden="true" style={{ transform: language === "ar" ? "rotate(180deg)" : "none" }} />
                  )}
                </button>
              </form>
            )}

            {status === "error" && errorMsg && (
              <div className="newsletter-error-alert" role="alert" id="newsletter-error">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className="form-note">
              {language === "ar" ? "نحن نحترم خصوصيتك ولن نرسل أي رسائل غير مرغوب فيها." : "We respect your privacy. No spam ever."}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Content */}
      <div className="container footer-content-wrapper">
        <div className="footer-grid-layout">
          {/* Brand Column */}
          <div className="footer-brand-col">
            <Link to="/" className="footer-logo-link" aria-label="Climatify Home">
              <img 
                src={theme === "light" ? "/logo-white.png" : "/logo-white.png"} 
                alt="Climatify Logo" 
                className="footer-logo-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                  if (sibling) sibling.style.display = "block";
                }}
              />
              <span className="footer-logo-fallback" style={{ display: "none" }}>Climatify</span>
            </Link>
            <p className="footer-tagline">{t("footerTagline")}</p>
            
            {/* Social Icons (using inline SVG for absolute robustness) */}
            <div className="footer-socials">
              <a href="https://instagram.com/climatify" target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="https://www.linkedin.com/company/climatify-youth" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
              </a>
              <a href="https://www.youtube.com/@ClimatifyPlatform" target="_blank" rel="noreferrer" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links-col">
            <h4>{language === "ar" ? "روابط سريعة" : "Quick Links"}</h4>
            <nav className="footer-links-list" aria-label="Quick Links">
              {quickLinks.map((link) => (
                <Link key={link.path} to={link.path}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Services */}
          <div className="footer-links-col">
            <h4>{language === "ar" ? "خدماتنا" : "Our Services"}</h4>
            <div className="footer-links-list">
              {serviceLinks.map((svc, i) => (
                <span key={i}>{language === "ar" ? svc.labelAr : svc.labelEn}</span>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="footer-links-col">
            <h4>{language === "ar" ? "تواصل معنا" : "Contact Us"}</h4>
            <div className="footer-links-list footer-contact-info">
              <a href="mailto:info@climatify-youth.com">
                <Mail size={16} className="contact-icon" />
                info@climatify-youth.com
              </a>
              <span>
                <MapPin size={16} className="contact-icon" />
                {language === "ar" ? "دبي، الإمارات العربية المتحدة" : "Dubai, United Arab Emirates"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-bar">
          {/* السنة تُحسب وقت العرض — كانت مثبّتة على 2026 داخل ملف الترجمة */}
          <p>{`© ${currentYear} ${t("copyright")}`}</p>
          <div className="footer-policies">
            <span>{language === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}</span>
            <span className="footer-divider-dot">·</span>
            <span>{language === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
