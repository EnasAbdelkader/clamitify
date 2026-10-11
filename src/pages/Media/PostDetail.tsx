import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError } from "../../services/api";
import { RouteLoader } from "../../components/common/RouteLoader";
import { EmptyState } from "../../components/ui/EmptyState";
import type { BlogPost } from "../../types";
import { Calendar, User, ArrowLeft, ArrowRight, Share2, Bookmark } from "lucide-react";
import "./PostDetail.css";

/** المقالات المحفوظة بتتخزن محلياً — مفيش endpoint للمفضّلة لحد دلوقتي. */
const BOOKMARKS_KEY = "climatify-bookmarked-posts";

function readBookmarks(): string[] {
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    // التخزين متقفل (تصفح خاص) أو الداتا بايظة — بنكمل من غير مفضّلة
    return [];
  }
}

function writeBookmarks(ids: string[]): void {
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(ids));
  } catch {
    // مش سبب كافي نكسر الصفحة
  }
}

const localizeError = (err: unknown, language: string): string => {
  if (err instanceof ApiError) return err.localizedMessage(language);
  return language === "ar" ? "حدث خطأ غير متوقع أثناء تحميل المقال." : "An unexpected error occurred while loading the article.";
};

export const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  /** 404 من السيرفر (أو مقال مش موجود في المصدر) — حالة مختلفة عن الفشل التقني */
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [bookmarked, setBookmarked] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<number | null>(null);

  // ── تحميل المقال ──────────────────────────────────────────────
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const data = await apiService.getBlogPostById(id);
        if (controller.signal.aborted) return;
        if (!data || typeof data !== "object") {
          // السيرفر رد 200 بجسم فاضي — بالنسبة للقارئ ده "مش موجود"
          setPost(null);
          setNotFound(true);
          return;
        }
        setPost(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPost(null);
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [id, reloadKey]);

  // ── عنوان التاب ───────────────────────────────────────────────
  useEffect(() => {
    const previous = document.title;
    const heading = post
      ? isAr
        ? post.titleAr
        : post.titleEn
      : isAr
        ? "المقال غير موجود"
        : "Article not found";
    document.title = `${heading} | Climatify`;
    return () => {
      document.title = previous;
    };
  }, [post, isAr]);

  // ── حالة الحفظ المحلية ────────────────────────────────────────
  useEffect(() => {
    setBookmarked(id ? readBookmarks().includes(id) : false);
  }, [id]);

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    },
    []
  );

  const announce = useCallback((message: string) => {
    setFeedback(message);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  const handleShare = useCallback(async () => {
    if (!post) return;
    const url = window.location.href;
    const title = isAr ? post.titleAr : post.titleEn;
    const text = isAr ? post.excerptAr : post.excerptEn;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return; // شيت المشاركة نفسه هو التأكيد
      } catch (err) {
        // المستخدم قفل الشيت — ده مش خطأ ومحتاجش رسالة
        if (err instanceof DOMException && err.name === "AbortError") return;
        // أي فشل تاني: بنكمل على النسخ
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      announce(isAr ? "تم نسخ رابط المقال إلى الحافظة." : "Article link copied to your clipboard.");
    } catch {
      announce(
        isAr
          ? "تعذّر نسخ الرابط تلقائياً — انسخه من شريط العنوان بالأعلى."
          : "Couldn't copy the link automatically — copy it from the address bar."
      );
    }
  }, [post, isAr, announce]);

  const handleBookmark = useCallback(() => {
    if (!id) return;
    const current = readBookmarks();
    const isSaved = current.includes(id);
    const next = isSaved ? current.filter((item) => item !== id) : [...current, id];
    writeBookmarks(next);
    setBookmarked(!isSaved);
    announce(
      isSaved
        ? isAr
          ? "تمت إزالة المقال من قائمة القراءة."
          : "Removed from your reading list."
        : isAr
          ? "تم حفظ المقال في قائمة القراءة على هذا الجهاز."
          : "Saved to your reading list on this device."
    );
  }, [id, isAr, announce]);

  // ── 1. تحميل ──────────────────────────────────────────────────
  if (loading) {
    return <RouteLoader label={isAr ? "جارٍ تحميل المقال…" : "Loading article…"} />;
  }

  // ── 2. فشل تقني (شبكة / 5xx) ─────────────────────────────────
  if (error !== null) {
    return (
      <div className="post-detail-wrapper">
        <div className="post-detail-container post-detail-state">
          <EmptyState
            type="error"
            titleEn="We couldn't load this article"
            titleAr="تعذّر تحميل هذا المقال"
            descriptionEn={localizeError(error, "en")}
            descriptionAr={localizeError(error, "ar")}
            actionEn="Try again"
            actionAr="إعادة المحاولة"
            onAction={() => setReloadKey((key) => key + 1)}
          />
          <div className="post-detail-state-actions">
            <Link to="/media" className="btn btn-ghost">
              {isAr ? "العودة للمركز الإعلامي" : "Back to Media Center"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. المقال غير موجود (404) ────────────────────────────────
  if (notFound || !post) {
    return (
      <div className="post-detail-wrapper">
        <div className="post-detail-container post-detail-state">
          <EmptyState
            type="no-results"
            titleEn="Sorry, this article doesn't exist"
            titleAr="عذراً، المقال غير موجود!"
            descriptionEn="The link may have changed, or the article was removed from the media centre."
            descriptionAr="يمكن الرابط اتغيّر، أو المقال اتشال من المركز الإعلامي."
            actionEn="Back to Media Center"
            actionAr="العودة للمركز الإعلامي"
            to="/media"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="post-detail-wrapper">
      <div className="post-detail-container">
        {/* Back Link & Navigation */}
        <div className="post-back-row">
          <Link to="/media" className="post-back-link">
            {isAr ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
            <span>{isAr ? "العودة للمركز الإعلامي" : "Back to Media Center"}</span>
          </Link>
        </div>

        {/* Article Header (Editorial, direct on base background) */}
        <header className="post-header">
          <span className="post-category">
            {isAr ? post.categoryAr : post.categoryEn}
          </span>
          <h1 className="post-title">
            {isAr ? post.titleAr : post.titleEn}
          </h1>

          <div className="post-meta">
            <span className="meta-item">
              <User size={14} aria-hidden="true" />
              <span>{isAr ? post.authorAr : post.authorEn}</span>
            </span>
            <span className="meta-divider" aria-hidden="true">•</span>
            <span className="meta-item">
              <Calendar size={14} aria-hidden="true" />
              <span>{post.date}</span>
            </span>
          </div>
        </header>

        {/* Hero Image Banner */}
        <div className="post-hero-image">
          <img
            src={post.image}
            alt={isAr ? post.titleAr : post.titleEn}
            className="post-img"
            onError={(e) => {
              // حماية بمرة واحدة: لو الصورة الاحتياطية نفسها فشلت، ما نبنيش حلقة طلبات لا نهائية
              if (e.currentTarget.dataset.fallbackApplied === "true") return;
              e.currentTarget.dataset.fallbackApplied = "true";
              e.currentTarget.src = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80";
            }}
          />
        </div>

        {/* Article Content Layout */}
        <div className="post-content-layout">
          {/* Share/Actions Sidebar */}
          <aside className="post-share-sidebar">
            <div className="sticky-sidebar-inner">
              <button
                type="button"
                className="share-circle-btn"
                onClick={handleShare}
                aria-label={isAr ? "مشاركة المقال" : "Share this article"}
              >
                <Share2 size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`share-circle-btn${bookmarked ? " is-active" : ""}`}
                onClick={handleBookmark}
                aria-pressed={bookmarked}
                aria-label={
                  bookmarked
                    ? isAr
                      ? "إزالة المقال من قائمة القراءة"
                      : "Remove from reading list"
                    : isAr
                      ? "حفظ المقال في قائمة القراءة"
                      : "Save to reading list"
                }
              >
                <Bookmark size={16} aria-hidden="true" />
              </button>
            </div>
          </aside>

          {/* Main Body Text (Clean editorial reading layout) */}
          <article className="post-body-text">
            {/* تأكيد المشاركة/الحفظ — منطقة حيّة يقراها قارئ الشاشة */}
            <p className="post-action-feedback" role="status" aria-live="polite">
              {feedback}
            </p>

            <p className="post-excerpt">
              {isAr ? post.excerptAr : post.excerptEn}
            </p>
            <div className="post-content-separator" />
            {/*
              النص بيتعرض كنص عادي (React بيهرب أي HTML) و`white-space: pre-line`
              في الـ CSS بيحافظ على أسطر الفقرات. ممنوع إدخال HTML غير مطهر هنا.
            */}
            <div className="post-main-content">
              {isAr ? post.contentAr : post.contentEn}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};
