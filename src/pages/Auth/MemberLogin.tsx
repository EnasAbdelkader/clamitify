import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useAuthStore } from "../../store/useAuthStore";
import { Lock, Mail, AlertCircle, WifiOff, Loader2, Leaf, CheckCircle } from "lucide-react";
import "./Auth.css";

// نفس قاعدة التحقق المستخدمة في نموذج "اتصل بنا": حرف + @ + حرف + نقطة + حرفين على الأقل.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** إشارة تُمرَّر من صفحة التسجيل لما الحساب يُنشأ بس فشل الدخول التلقائي. */
interface RegisterRedirectState {
  notice?: string;
}

export const MemberLogin: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const location = useLocation();
  const { loginMember } = useAuthStore();

  // إشعار "تم إنشاء الحساب" القادم من /register — نصه جاهز بلغة المستخدم وقت الإنشاء.
  const registerNotice =
    (location.state as RegisterRedirectState | null)?.notice ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isServerProblem, setIsServerProblem] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setIsServerProblem(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(isAr ? "برجاء ملء جميع الحقول." : "Please fill in all fields.");
      return;
    }

    if (!EMAIL_RE.test(trimmedEmail)) {
      setError(
        isAr
          ? "برجاء إدخال بريد إلكتروني صحيح (مثال: name@example.com)."
          : "Please enter a valid email address (e.g. name@example.com)."
      );
      return;
    }

    setLoading(true);
    try {
      const result = await loginMember(trimmedEmail, password);
      if (result.ok) {
        navigate("/dashboard");
      } else {
        setIsServerProblem(Boolean(result.isServerProblem));
        setError(
          result.error ||
            (isAr
              ? "تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى."
              : "Could not reach the server. Check your connection and try again.")
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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <span className="auth-brand-badge">
            <Leaf size={14} aria-hidden="true" />
            <span>Climatify Member</span>
          </span>
          <h1>{isAr ? "تسجيل الدخول" : "Welcome Back"}</h1>
          <p>
            {isAr
              ? "سجّل دخولك لمتابعة نقاطك ومساقاتك البيئية"
              : "Sign in to access your climate impact & courses"}
          </p>
        </div>

        <div aria-live="assertive">
          {registerNotice && (
            <div className="auth-success-alert" role="status">
              <CheckCircle size={18} aria-hidden="true" />
              <span>{registerNotice}</span>
            </div>
          )}
          {error && (
            <div className="auth-error-alert" role="alert">
              {isServerProblem ? <WifiOff size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
              <span>{error}</span>
            </div>
          )}
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="member-login-email">{isAr ? "البريد الإلكتروني" : "Email Address"}</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="member-login-email"
                type="email"
                className="form-control"
                placeholder={isAr ? "name@example.com" : "name@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="member-login-password">{isAr ? "كلمة المرور" : "Password"}</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="member-login-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" aria-hidden="true" />
                <span>{isAr ? "جاري تسجيل الدخول..." : "Signing in..."}</span>
              </>
            ) : (
              <span>{isAr ? "تسجيل الدخول" : "Sign In"}</span>
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <span>{isAr ? "ليس لديك حساب؟" : "Don't have an account?"}</span>
          <Link to="/register" className="auth-switch-link">
            {isAr ? "إنشاء حساب جديد" : "Create Account"}
          </Link>
        </div>
      </div>
    </div>
  );
};
