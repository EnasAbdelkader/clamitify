import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Home, ArrowLeft, ArrowRight, Compass } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import "./NotFound.css";

/**
 * Real 404 page.
 *
 * Previously the `*` route rendered <Home/>, so every mistyped URL answered with
 * the homepage — search engines indexed duplicate content and users never learned
 * the address was wrong.
 */
export const NotFound: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  useEffect(() => {
    const previous = document.title;
    document.title = isAr ? "الصفحة غير موجودة | Climatify" : "Page Not Found | Climatify";
    return () => {
      document.title = previous;
    };
  }, [isAr]);

  const suggestions = [
    { to: "/programs", ar: "البرامج", en: "Programs" },
    { to: "/events", ar: "الفعاليات", en: "Events" },
    { to: "/learning-hub", ar: "التعلم", en: "Academy" },
    { to: "/opportunities", ar: "الفرص", en: "Careers" },
    { to: "/contact", ar: "اتصل بنا", en: "Contact" },
  ];

  return (
    <div className="notfound-page container">
      <div className="notfound-inner">
        <span className="notfound-code" aria-hidden="true">404</span>

        <h1 className="notfound-title">
          {isAr ? "الصفحة اللي بتدوّر عليها مش موجودة" : "We couldn't find that page"}
        </h1>

        <p className="notfound-text">
          {isAr
            ? "يمكن يكون الرابط اتغيّر أو فيه حرف ناقص. جرّب تبدأ من الرئيسية أو من أحد الأقسام تحت."
            : "The link may have changed or contains a typo. Start from the homepage or jump to a section below."}
        </p>

        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary">
            <Home size={16} aria-hidden="true" />
            <span>{isAr ? "الصفحة الرئيسية" : "Back to Home"}</span>
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => window.history.back()}>
            {isAr ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
            <span>{isAr ? "الرجوع للخلف" : "Go Back"}</span>
          </button>
        </div>

        <nav className="notfound-suggestions" aria-label={isAr ? "أقسام مقترحة" : "Suggested sections"}>
          <span className="notfound-suggestions-label">
            <Compass size={14} aria-hidden="true" />
            {isAr ? "أقسام قد تهمّك" : "You might be looking for"}
          </span>
          <ul>
            {suggestions.map((s) => (
              <li key={s.to}>
                <Link to={s.to}>{isAr ? s.ar : s.en}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
};
