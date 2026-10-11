import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import {
  Lock,
  Mail,
  AlertTriangle,
  WifiOff,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Globe,
  CalendarDays,
  MessagesSquare,
} from "lucide-react";
import "./admin.css";

/**
 * نتيجة محاولة الدخول.
 */
export interface AdminLoginResult {
  ok: boolean;
  error?: string;
  isServerProblem?: boolean;
}

interface AdminLoginProps {
  onLogin: (email: string, password: string) => Promise<AdminLoginResult>;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isServerProblem, setIsServerProblem] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setIsServerProblem(false);

    if (!email.trim() || !password) {
      setError(isAr ? "من فضلك املأ جميع الحقول." : "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const result = await onLogin(email.trim(), password);
      if (!result.ok) {
        setIsServerProblem(Boolean(result.isServerProblem));
        setError(
          result.error ||
            (result.isServerProblem
              ? isAr
                ? "تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى."
                : "Could not reach the server. Check your connection and try again."
              : isAr
                ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
                : "Invalid email or password.")
        );
      }
    } catch {
      setIsServerProblem(true);
      setError(
        isAr
          ? "تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى."
          : "Could not reach the server. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /** نقاط لوحة الهوية — بتوصف قدرات اللوحة الفعلية مش كلام تسويقي عام. */
  const panelPoints = [
    { icon: <Globe size={17} />, textEn: "Bilingual content publishing — Arabic & English", textAr: "نشر محتوى ثنائي اللغة — عربي وإنجليزي" },
    { icon: <CalendarDays size={17} />, textEn: "Events, initiatives, courses & articles in one hub", textAr: "فعاليات ومبادرات ودورات ومقالات في مكان واحد" },
    { icon: <MessagesSquare size={17} />, textEn: "Visitor inquiries delivered straight to your inbox", textAr: "استفسارات الزوار توصلك مباشرة إلى صندوقك" },
  ];

  return (
    <div className="admin-login-page">
      {/* Brand Panel */}
      <aside className="admin-login-panel">
        <div className="admin-login-panel-inner">
          <img className="admin-login-panel-logo" src="/logo-white.png" alt="Climatify" />

          <div className="admin-login-panel-copy">
            <span className="admin-login-badge light">
              <ShieldCheck size={14} />
              {isAr ? "البوابة الإدارية" : "Executive Admin Portal"}
            </span>
            <h2 className="admin-login-panel-title">
              {isAr ? (
                <>
                  العمل المناخي،
                  <br />
                  <span>مُرقمن من خلف الكواليس.</span>
                </>
              ) : (
                <>
                  Climate action,
                  <br />
                  <span>orchestrated behind the scenes.</span>
                </>
              )}
            </h2>
            <p className="admin-login-panel-lead">
              {isAr
                ? "مركز التحكم الذي يشغّل منصة كلايمتيفاي — من المحتوى والفعاليات إلى رسائل المجتمع."
                : "The control center powering Climatify — from content and events to community messages."}
            </p>
          </div>

          <ul className="admin-login-panel-points">
            {panelPoints.map((point) => (
              <li key={point.textEn}>
                <span className="admin-login-point-icon">{point.icon}</span>
                <span>{isAr ? point.textAr : point.textEn}</span>
              </li>
            ))}
          </ul>

          <p className="admin-login-panel-footer">
            {isAr ? "جسر الحدود والثقافات والأجيال عبر حلول المناخ." : "Bridging borders, cultures, and generations through climate solutions."}
          </p>
        </div>
      </aside>

      {/* Form Side */}
      <main className="admin-login-formside">
        <div className="admin-login-card">
          <img className="admin-login-mobile-logo" src="/logo-dark.png" alt="Climatify" />

          <div className="admin-login-head">
            <span className="admin-login-badge">
              <ShieldCheck size={14} />
              {isAr ? "البوابة الإدارية" : "Executive Admin Portal"}
            </span>
            <h1 className="admin-login-title">{isAr ? "مركز التحكم" : "Control Center"}</h1>
            <p className="admin-login-subtitle">
              {isAr
                ? "سجّل الدخول لإدارة محتوى المنصة وبارامترات التشغيل"
                : "Sign in to manage platform content & parameters"}
            </p>
          </div>

          <div aria-live="assertive">
            {error && (
              <div className="admin-login-error" role="alert">
                <span className="admin-login-error-inner">
                  {isServerProblem ? <WifiOff size={16} /> : <AlertTriangle size={16} />}
                  <span>{error}</span>
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="admin-email">
                <Mail size={14} className="admin-login-label-icon" />
                {isAr ? "البريد الإلكتروني" : "Email Address"}
              </label>
              <input
                id="admin-email"
                type="email"
                className="admin-form-input"
                placeholder="admin@climatify.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                aria-invalid={error && !isServerProblem ? true : undefined}
                required
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="admin-password">
                <Lock size={14} className="admin-login-label-icon" />
                {isAr ? "كلمة المرور" : "Password"}
              </label>
              <div className="admin-password-wrap">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  className="admin-form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  aria-invalid={error && !isServerProblem ? true : undefined}
                  required
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? (isAr ? "إخفاء كلمة المرور" : "Hide password") : (isAr ? "إظهار كلمة المرور" : "Show password")}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="admin-login-btn" disabled={loading}>
              {loading ? (
                <span className="admin-login-btn-loading">
                  <Loader2 size={18} className="admin-spinner" />
                  {isAr ? "جارِ التحقق من البيانات..." : "Authenticating..."}
                </span>
              ) : (
                isAr ? "دخول إلى مركز التحكم" : "Sign In to Control Center"
              )}
            </button>
          </form>

          <Link to="/" className="admin-back-link">
            {isAr ? "→ العودة إلى الموقع" : "← Back to Website"}
          </Link>
        </div>
      </main>
    </div>
  );
};
