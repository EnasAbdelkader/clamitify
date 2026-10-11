import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useAuthStore } from "../../store/useAuthStore";
import { Lock, Mail, User, AlertCircle, WifiOff, Loader2, Leaf, CheckCircle } from "lucide-react";
import "./Auth.css";

// نفس قاعدة التحقق المستخدمة في نموذج "اتصل بنا": حرف + @ + حرف + نقطة + حرفين على الأقل.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MemberRegister: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const { registerMember, loginMember } = useAuthStore();

  const [name, setName] = useState("");
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

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password) {
      setError(isAr ? "برجاء ملء جميع الحقول المطلوبة." : "Please fill in all required fields.");
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

    if (password.length < 6) {
      setError(isAr ? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل." : "Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    // ── إنشاء الحساب ──
    // فشل الشبكة هنا يعني الحساب لسه اتعملش — بنعرض رسالة الاتصال ونوقف.
    try {
      const regResult = await registerMember({ name: trimmedName, email: trimmedEmail, password });
      if (!regResult.ok) {
        setIsServerProblem(Boolean(regResult.isServerProblem));
        setError(
          regResult.error ||
            (isAr
              ? "تعذّر إنشاء الحساب. حاول مرة أخرى."
              : "Could not create account. Please try again.")
        );
        setLoading(false);
        return;
      }
    } catch {
      setIsServerProblem(true);
      setError(
        isAr
          ? "تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى."
          : "Could not reach the server. Check your connection and try again."
      );
      setLoading(false);
      return;
    }

    // ── الدخول التلقائي بعد نجاح التسجيل ──
    // الحساب اتعمل فعلاً هنا؛ لو الدخول التلقائي فشل لأي سبب، بنحوّي المستخدم
    // لصفحة الدخول مع إشعار واضح بدل ما يلاقي فورم فاضي من غير أي تفسير.
    const loginNotice = isAr
      ? "تم إنشاء حسابك بنجاح! برجاء تسجيل الدخول للمتابعة."
      : "Your account was created successfully! Please sign in to continue.";
    try {
      const loginResult = await loginMember(trimmedEmail, password);
      if (loginResult.ok) {
        navigate("/dashboard");
      } else {
        navigate("/login", { state: { notice: loginNotice } });
      }
    } catch {
      navigate("/login", { state: { notice: loginNotice } });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-header">
          <span className="auth-brand-badge">
            <Leaf size={14} aria-hidden="true" />
            <span>Join Climatify</span>
          </span>
          <h1>{isAr ? "إنشاء حساب جديد" : "Create Your Account"}</h1>
          <p>
            {isAr
              ? "انضم إلى مجتمعنا وابدأ في قياس أثرك المناخي"
              : "Join our community and start tracking your climate impact"}
          </p>
        </div>

        <div aria-live="assertive">
          {error && (
            <div className="auth-error-alert" role="alert">
              {isServerProblem ? <WifiOff size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
              <span>{error}</span>
            </div>
          )}
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="member-reg-name">{isAr ? "الاسم بالكامل" : "Full Name"}</label>
            <div className="auth-input-wrapper">
              <User size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="member-reg-name"
                type="text"
                className="form-control"
                placeholder={isAr ? "أحمد المحمود" : "Ahmad Al-Mahmoud"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="member-reg-email">{isAr ? "البريد الإلكتروني" : "Email Address"}</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="member-reg-email"
                type="email"
                className="form-control"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="member-reg-password">{isAr ? "كلمة المرور" : "Password"}</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" aria-hidden="true" />
              <input
                id="member-reg-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
                minLength={6}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" aria-hidden="true" />
                <span>{isAr ? "جاري إنشاء الحساب..." : "Creating Account..."}</span>
              </>
            ) : (
              <>
                <CheckCircle size={18} aria-hidden="true" />
                <span>{isAr ? "إنشاء الحساب" : "Create Account"}</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <span>{isAr ? "لديك حساب بالفعل؟" : "Already have an account?"}</span>
          <Link to="/login" className="auth-switch-link">
            {isAr ? "تسجيل الدخول" : "Sign In"}
          </Link>
        </div>
      </div>
    </div>
  );
};
