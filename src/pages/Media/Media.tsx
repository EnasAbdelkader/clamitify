import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError } from "../../services/api";
import { RouteLoader } from "../../components/common/RouteLoader";
import { EmptyState } from "../../components/ui/EmptyState";
import type { BlogPost } from "../../types";
import { Calendar, User, ArrowRight, ArrowLeft, Download } from "lucide-react";
import "./Media.css";

// TODO(cms): the annual-report link is hardcoded to a single 2023 PDF on the
// WordPress site. There is no apiService method for reports yet.
const ANNUAL_REPORT_URL =
  "https://climatify-youth.com/wp-content/uploads/2024/01/ClimatifyProgressReport2023.pdf";

/**
 * الرسالة بتتولّد وقت العرض من الخطأ المحفوظ نفسه، مش وقت الـ catch —
 * كده تبديل اللغة بيترجم رسالة الخطأ من غير ما نعيد طلب الشبكة كله.
 */
const localizeError = (err: unknown, language: string): string => {
  if (err instanceof ApiError) return err.localizedMessage(language);
  return language === "ar" ? "حدث خطأ غير متوقع أثناء تحميل المقالات." : "An unexpected error occurred while loading the articles.";
};

export const Media: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  /** زيادته بتعيد تشغيل الـ fetch — زر "إعادة المحاولة" */
  const [reloadKey, setReloadKey] = useState(0);

  // عنوان الصفحة في التاب + استرجاع العنوان القديم عند الخروج
  useEffect(() => {
    const previous = document.title;
    document.title = isAr ? "المركز الإعلامي | Climatify" : "Media Center | Climatify";
    return () => {
      document.title = previous;
    };
  }, [isAr]);

  // يا مطور الباك: هتحمل كل الأخبار والمدونات دي من جدول الـ blog_posts في الـ DB
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiService.getBlogPosts();
        if (controller.signal.aborted) return;
        // الشكل اللي جاي من السيرفر مش مضمون — أي حاجة غير مصفوفة تبقى قائمة فاضية
        setPosts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPosts([]);
        setError(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [reloadKey]);

  const header = (
    <section className="media-header text-center">
      <span className="eyebrow">{isAr ? "المركز الإعلامي" : "Media Center"}</span>
      <h1 className="section-title">
        {isAr ? "أخبار كلايمتيفاي ومدونتنا" : "Climatify News & Blog Articles"}
      </h1>
      <p className="section-lead mx-auto">
        {isAr
          ? "تابع أحدث مشاركاتنا، فعالياتنا، وتقاريرنا السنوية لدعم التنمية المستدامة."
          : "Follow our latest contributions, events, and progress reports supporting sustainable development."}
      </p>
    </section>
  );

  return (
    <div className="media-page-container container">
      {/* 1. Header */}
      {header}

      {/* 2. Annual Report — التقرير السنوي (اتنقل هنا من صفحة "من نحن") */}
      <section className="media-report-section" aria-labelledby="media-report-title">
        <div className="media-report-text">
          <span className="eyebrow">{isAr ? "التقرير السنوي" : "Annual Report"}</span>
          <h2 id="media-report-title">
            {isAr ? "التقرير السنوي لتقدم كلايمتيفاي" : "Climatify Annual Progress Report"}
          </h2>
          <p>
            {isAr
              ? "شفافيتنا هي سر قوتنا. حمّل تقريرنا السنوي لمشاهدة المبادرات والإنجازات والأثر الذي حققناه بالأرقام."
              : "Our transparency is our strength. Download our annual report to see our initiatives, milestones and impact in numbers."}
          </p>
        </div>
        <a
          href={ANNUAL_REPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary media-report-btn"
        >
          <Download size={18} aria-hidden="true" />
          <span>{isAr ? "تحميل تقرير تقدم 2023" : "Download 2023 Progress Report"}</span>
          <span className="sr-only">
            {isAr ? "(PDF — يفتح في نافذة جديدة)" : "(PDF — opens in a new tab)"}
          </span>
        </a>
      </section>

      {/* 3. Blog Posts Grid List — تحميل ← خطأ ← فاضي ← القائمة */}
      <section className="media-posts section">
        {loading && <RouteLoader label={isAr ? "جارٍ تحميل المقالات…" : "Loading articles…"} />}

        {!loading && error !== null && (
          <EmptyState
            type="error"
            titleEn="We couldn't load the articles"
            titleAr="تعذّر تحميل المقالات"
            descriptionEn={localizeError(error, "en")}
            descriptionAr={localizeError(error, "ar")}
            actionEn="Try again"
            actionAr="إعادة المحاولة"
            onAction={() => setReloadKey((key) => key + 1)}
          />
        )}

        {!loading && error === null && posts.length === 0 && (
          <EmptyState
            type="empty"
            titleEn="No articles published yet"
            titleAr="لا توجد مقالات منشورة بعد"
            descriptionEn="New stories and reports will appear here as soon as they are published."
            descriptionAr="ستظهر الأخبار والتقارير الجديدة هنا فور نشرها."
            actionEn="Refresh"
            actionAr="تحديث"
            onAction={() => setReloadKey((key) => key + 1)}
          />
        )}

        {!loading && error === null && posts.length > 0 && (
          <div className="posts-layout-grid">
            {posts.map((post) => (
              <article key={post.id} className="post-large-card card">
                <div className="post-img-cover-area">
                  <img
                    src={post.image}
                    alt={isAr ? post.titleAr : post.titleEn}
                    className="post-cover-img"
                    loading="lazy"
                    onError={(e) => {
                      // حماية بمرة واحدة: لو الصورة الاحتياطية نفسها فشلت، ما نبنيش حلقة طلبات لا نهائية
                      if (e.currentTarget.dataset.fallbackApplied === "true") return;
                      e.currentTarget.dataset.fallbackApplied = "true";
                      e.currentTarget.src = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80";
                    }}
                  />
                  <span className="post-category-tag-badge">
                    {isAr ? post.categoryAr : post.categoryEn}
                  </span>
                </div>

                <div className="post-text-content-area">
                  <div className="post-meta-details-row">
                    <span>
                      <Calendar size={14} aria-hidden="true" />
                      {post.date}
                    </span>
                    <span>
                      <User size={14} aria-hidden="true" />
                      {isAr ? post.authorAr : post.authorEn}
                    </span>
                  </div>

                  <h3>{isAr ? post.titleAr : post.titleEn}</h3>
                  <p className="excerpt">{isAr ? post.excerptAr : post.excerptEn}</p>

                  <Link to={`/blog/${post.id}`} className="btn btn-ghost read-post-action-btn">
                    <span>{isAr ? "عرض تفاصيل المقال" : "Read Full Article"}</span>
                    {isAr ? <ArrowLeft size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
