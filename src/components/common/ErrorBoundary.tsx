import React from "react";
import "./ErrorBoundary.css";

interface Props {
  children: React.ReactNode;
  /** Rendered instead of the default card when provided. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-phase throws so a single bad component cannot blank the whole app.
 *
 * The language context is deliberately NOT consumed here: this boundary must keep
 * working even when the provider itself is what failed, so both languages are shown.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  /**
   * فشل تحميل chunk بتاع lazy route بيضل عالق: React.lazy بيكاشي الوعد المرفوض
   * للأبد، فأي "إعادة محاولة" داخلية بترجع تكرّش على نفس الخطأ. الحل الوحيد
   * الفعّال هو إعادة تحميل الصفحة تجيب نسخة جديدة من الـmanifest.
   */
  static isChunkLoadFailure(error: Error): boolean {
    return /Failed to fetch dynamically imported module|error loading dynamically imported module|Loading CSS chunk .* failed|Loading chunk \d+ failed/i.test(
      `${error.name}: ${error.message}`
    );
  }

  reset = () => this.setState({ error: null });

  /** يفصل بين خطأ عرض قابل للاستعادة وإخفاق شبكة في تحميل الكود نفسه. */
  handleRetry = () => {
    const { error } = this.state;
    if (error && ErrorBoundary.isChunkLoadFailure(error)) {
      window.location.reload();
      return;
    }
    this.reset();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <span className="error-boundary-icon" aria-hidden="true">⚠️</span>
          <h1 className="error-boundary-title">حدث خطأ غير متوقع</h1>
          <p className="error-boundary-title-en">Something went wrong</p>
          <p className="error-boundary-text">
            {ErrorBoundary.isChunkLoadFailure(error) && (
              <>
                يبدو أن نسخة الصفحة الموجودة عندك قديمة أو انقطع الاتصال أثناء تحميل جزء من الكود.
                <br />
                <span dir="ltr">
                  A part of the app failed to load, possibly due to a new release or a network hiccup.
                </span>
                <br />
              </>
            )}
            حصلت مشكلة أثناء عرض هذا الجزء من الصفحة. جرّب تعيد المحاولة أو ترجع للصفحة الرئيسية.
            <br />
            <span dir="ltr">
              An error occurred while rendering this page. Try again or return home.
            </span>
          </p>

          {import.meta.env.DEV && (
            <pre className="error-boundary-details" dir="ltr">
              {error.message}
            </pre>
          )}

          <div className="error-boundary-actions">
            <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
              إعادة المحاولة / Try again
            </button>
            <a className="btn btn-ghost" href="/">
              الصفحة الرئيسية / Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
