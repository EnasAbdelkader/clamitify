import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { apiService, ApiError } from "../../services/api";
import type { Program, Initiative, BlogPost } from "../../types";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Milestone,
  Compass,
  Heart,
  Users,
  Activity,
  Target,
  Play,
  Pause,
} from "lucide-react";
import { motion } from "framer-motion";
import { ProgramCards } from "../../components/ProgramCards/ProgramCards";
import { BorderGlow } from "../../components/BorderGlow/BorderGlow";
import { Aurora } from "../../components/Aurora/Aurora";
import { RouteLoader } from "../../components/common/RouteLoader";
import { EmptyState } from "../../components/ui/EmptyState";
import { LogoMarquee } from "../../components/LogoMarquee/LogoMarquee";
import { partners } from "../../data/partners";
import "./Home.css";

const sectionRevealVariants = {
  hidden: { opacity: 0, y: 35 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }
  }
};

// TODO(perf): `public/Climatify-Campign-.mp4` is ~57 MB of un-optimised H.264 served
// straight from the origin. Before launch it MUST be re-encoded (720p H.264 + a
// WebM/AV1 <source> sibling) and moved behind a CDN, and this poster self-hosted
// instead of hot-linking Unsplash. See `needsFollowUp` in the audit report.
const HERO_POSTER =
  "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1600&q=70";

/** `navigator.connection` is not in lib.dom yet; only `saveData` is needed here. */
type SaveDataConnection = { saveData?: boolean };

/** The hero clip is decoration — never start it when the visitor opted out of motion or data. */
function heroAutoplayAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return false;
  const conn = (navigator as Navigator & { connection?: SaveDataConnection }).connection;
  return conn?.saveData !== true;
}

export const Home: React.FC = () => {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isAr = language === "ar";

  const [programs, setPrograms] = useState<Program[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  // مقروء مرة واحدة عند التركيب: لو المستخدم مقفّل الحركة أو مفعّل توفير البيانات
  // مبنشغلش الفيديو أصلاً (ولا حتى بنعمله preload).
  const [autoplayAllowed] = useState<boolean>(() => heroAutoplayAllowed());
  const [videoPlaying, setVideoPlaying] = useState(false);

  // الفيديو دلوقتي بيتركّب دايماً (مش وراء بوابة loading)، فالـ ref موجود فعلاً هنا.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 1.0;
    if (!autoplayAllowed) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      /* المتصفح رفض التشغيل التلقائي — الزرار تحت بيدي المستخدم التحكم */
    });
  }, [autoplayAllowed]);

  const toggleHeroVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // الباك إند لما يجهز يا صاحبي: الدوال دي كلها هتجيب البيانات الحقيقية من عندك
  // مفيش أي تغيير هتحتاجه هنا لأن الفرونت بيكلم الـ apiService مباشرة
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [progData, initData, postData] = await Promise.all([
          apiService.getPrograms(),
          apiService.getInitiatives(),
          apiService.getBlogPosts(),
        ]);
        if (controller.signal.aborted) return;
        // مبنثقش في شكل الرد: أي حاجة مش array بتتعامل كقائمة فاضية بدل ما تكسر الصفحة.
        setPrograms(Array.isArray(progData) ? progData : []);
        setInitiatives(Array.isArray(initData) ? initData : []);
        setPosts(Array.isArray(postData) ? postData.slice(0, 3) : []); // أول 3 مقالات بس للرئيسية
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error fetching homepage data:", err);
        setLoadError(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchData();
    return () => controller.abort();
  }, [reloadToken]);

  // بنخزّن الـ error object نفسه ونترجمه وقت الرسم، عشان تبديل اللغة
  // ميعملش إعادة تحميل للصفحة كلها.
  const errorMessage = loadError
    ? loadError instanceof ApiError
      ? loadError.localizedMessage(language)
      : isAr
        ? "حدث خطأ غير متوقع."
        : "An unexpected error occurred."
    : null;

  const retry = useCallback(() => setReloadToken((n) => n + 1), []);

  // الرئيسية بتعرض أول حملتين بس — باقي المبادرات (برامج / معسكرات / ورش) في صفحة البرامج.
  const campaigns = initiatives.filter((init) => (init.type ?? "campaign") === "campaign");
  const homeInitiatives = (campaigns.length > 0 ? campaigns : initiatives).slice(0, 2);

  // مصفوفة الأيقونات بناءً على اسم الأيقونة من قاعدة البيانات
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Monitor": return <ShieldCheck size={26} />;
      case "Search": return <Milestone size={26} />;
      case "Megaphone": return <Compass size={26} />;
      case "Users": return <Users size={26} />;
      case "MessageSquare": return <Heart size={26} />;
      default: return <Activity size={26} />;
    }
  };

  /**
   * حالة "لسه بيحمّل" أو "مفيش بيانات" لقسم واحد.
   * الخطأ بيتعرض مرة واحدة بس على مستوى الصفحة (تحت)، مش ٣ مرات،
   * عشان قارئ الشاشة ميسمعش نفس الرسالة تلات مرات.
   */
  const renderSectionState = (emptyTitleAr: string, emptyTitleEn: string, emptyDescAr: string, emptyDescEn: string) => {
    if (loading) {
      return (
        <div className="home-section-loader">
          <RouteLoader label={isAr ? "جارٍ تحميل المحتوى…" : "Loading content…"} />
        </div>
      );
    }
    if (errorMessage) {
      // ملاحظة ثابتة (مش live region) — التفاصيل وزرار إعادة المحاولة فوق مرة واحدة.
      return (
        <p className="home-section-unavailable">
          {isAr
            ? "هذا المحتوى غير متاح حالياً — راجع رسالة الخطأ أعلى الصفحة."
            : "This content is unavailable right now — see the error message at the top of the page."}
        </p>
      );
    }
    return (
      <EmptyState
        type="no-data"
        titleAr={emptyTitleAr}
        titleEn={emptyTitleEn}
        descriptionAr={emptyDescAr}
        descriptionEn={emptyDescEn}
      />
    );
  };

  return (
    <div className="home-page-container">
      {/* 1. Hero Section */}
      <section className="home-hero-section">
        {/* تأثير أورورا العلوي المميز في الدارك مود */}
        {theme === "dark" && (
          <Aurora
            colorStops={["#00d0ff", "#72ecff", "#27ff70"]}
            blend={0.5}
            amplitude={1.0}
            speed={0.5}
          />
        )}

        {/* الفيديو كخلفية تفاعلية جذابة — ديكور بحت، مكتوم دائماً ومخفي عن قارئ الشاشة.
            TODO(a11y): لو اتضاف للفيديو تعليق صوتي أو نص على الشاشة لازم يتضاف معاه
            <track kind="captions"> ونص مكتوب. حالياً مفيش صوت خالص فمش مطلوب. */}
        <video
          ref={videoRef}
          className="home-hero-video"
          autoPlay={autoplayAllowed}
          muted
          loop
          playsInline
          preload={autoplayAllowed ? "metadata" : "none"}
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          poster={HERO_POSTER}
          onPlay={() => setVideoPlaying(true)}
          onPause={() => setVideoPlaying(false)}
        >
          {/* TODO(perf): ضيف <source> بصيغة WebM/AV1 أخف قبل الإطلاق. */}
          <source src="/Climatify-Campign-.mp4" type="video/mp4" />
        </video>
        <div className="home-hero-overlay"></div>

        <button
          type="button"
          className="home-hero-video-toggle"
          onClick={toggleHeroVideo}
          aria-label={
            videoPlaying
              ? isAr ? "إيقاف فيديو الخلفية" : "Pause background video"
              : isAr ? "تشغيل فيديو الخلفية" : "Play background video"
          }
        >
          {videoPlaying ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          <span>{videoPlaying ? (isAr ? "إيقاف" : "Pause") : (isAr ? "تشغيل" : "Play")}</span>
        </button>

        <motion.div
          className="container hero-content-inner"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="home-hero-pill">
            <span className="dot-pulse"></span>
            {t("forBetterFuture")}
          </span>

          <h1 className="hero-main-heading">
            {t("heroTitlePart1")}{" "}
            <span className="text-gradient">{t("heroTitlePart2")}</span>{" "}
            {t("heroTitlePart3")}
          </h1>

          <p className="hero-subtext">{t("heroSub")}</p>

          <div className="hero-actions-container">
            <a href="#mission" className="btn btn-primary">
              <span>{isAr ? "استكشف أهدافنا" : "Explore Goals"}</span>
              {isAr ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </a>
            <Link to="/about" className="btn btn-glass">{t("learnMore")}</Link>
          </div>
        </motion.div>
      </section>

      {/* 1b. تحذير واحد على مستوى الصفحة لو الـ API فشل — بدل ٣ رسايل مكررة */}
      {errorMessage && (
        <div className="container home-data-error">
          <EmptyState
            type="error"
            titleAr="تعذّر تحميل محتوى الصفحة"
            titleEn="Could not load the page content"
            descriptionAr={errorMessage}
            descriptionEn={errorMessage}
            actionAr="إعادة المحاولة"
            actionEn="Try again"
            onAction={retry}
          />
        </div>
      )}

      {/* 1c. Partners Logo Marquee — الشركاء الرئيسيون الأول ثم شركاء محتوى التعلم */}
      <section className="home-partners-strip" aria-labelledby="home-partners-title">
        <div className="container">
          <h2 id="home-partners-title" className="home-partners-title">
            {isAr ? "شركاؤنا" : "Our Partners"}
          </h2>
        </div>
        <LogoMarquee partners={partners} labelAr="لوجوهات شركاء كلايمتيفاي" labelEn="Climatify partner logos" />
      </section>

      {/* 1d. Impact Band — أرقام الأثر المعتمدة من المحتوى الرسمي */}
      <section className="home-impact-band" aria-label={isAr ? "أثرنا بالأرقام" : "Our impact in numbers"}>
        <div className="container home-impact-grid" role="list">
          <div className="home-impact-item" role="listitem">
            <span className="home-impact-value">{t("impactYouthValue")}</span>
            <span className="home-impact-label">{t("impactYouthLabel")}</span>
          </div>
          <div className="home-impact-item" role="listitem">
            <span className="home-impact-value">{t("impactEmpoweredValue")}</span>
            <span className="home-impact-label">{t("impactEmpoweredLabel")}</span>
          </div>
          <div className="home-impact-item" role="listitem">
            <span className="home-impact-value">{t("impactOpportunitiesValue")}</span>
            <span className="home-impact-label">{t("impactOpportunitiesLabel")}</span>
          </div>
        </div>
      </section>

      {/* 2. Mission Section */}
      <motion.section
        className="section home-mission-section"
        id="mission"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={sectionRevealVariants}
      >
        <div className="container mission-grid-layout">
          <div className="mission-text-area">
            <span className="eyebrow">{isAr ? "رسالتنا" : "Our Mission"}</span>
            <h2>{t("missionTitle")}</h2>
            <p>{t("missionText1")}</p>
            <p>{t("missionText2")}</p>
            <Link to="/about" className="btn btn-ghost" style={{ marginTop: "24px" }}>
              <span>{isAr ? "تعرف على الفريق" : "Meet The Team"}</span>
              {isAr ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </Link>
          </div>

          <div className="mission-cards-stack">
            <BorderGlow
              edgeSensitivity={30}
              glowColor="190 90 70"
              backgroundColor="var(--surface-2)"
              borderRadius={20}
              glowRadius={35}
              glowIntensity={1.2}
              coneSpread={25}
              animated={true}
              colors={['#38bdf8', '#818cf8', '#34d399']}
            >
              <div className="vm-card-item">
                <span className="icon-tile-wrapper">{getIcon("Monitor")}</span>
                <div>
                  <h3>{t("vision")}</h3>
                  <p>{t("visionText")}</p>
                </div>
              </div>
            </BorderGlow>

            <BorderGlow
              edgeSensitivity={30}
              glowColor="150 85 65"
              backgroundColor="var(--surface-2)"
              borderRadius={20}
              glowRadius={35}
              glowIntensity={1.2}
              coneSpread={25}
              animated={true}
              colors={['#10b981', '#34d399', '#6ee7b7']}
            >
              <div className="vm-card-item">
                <span className="icon-tile-wrapper">{getIcon("Search")}</span>
                <div>
                  <h3>{t("mission")}</h3>
                  <p>{t("missionText")}</p>
                </div>
              </div>
            </BorderGlow>

            <BorderGlow
              edgeSensitivity={30}
              glowColor="280 85 75"
              backgroundColor="var(--surface-2)"
              borderRadius={20}
              glowRadius={35}
              glowIntensity={1.2}
              coneSpread={25}
              animated={true}
              colors={['#c084fc', '#f472b6', '#fbbf24']}
            >
            <div className="vm-card-item">
              <span className="icon-tile-wrapper">{getIcon("Megaphone")}</span>
              <div>
                <h3>{t("focusAreas")}</h3>
                <p>{t("focusAreasText")}</p>
              </div>
            </div>
            </BorderGlow>
          </div>
        </div>
      </motion.section>

      {/* 3. Programs Section (ProgramCards) */}
      <motion.section
        className="section home-programs-section"
        id="programs"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={sectionRevealVariants}
      >
        <div className="container">
          <div className="home-section-header text-center">
            <span className="eyebrow">{t("programs")}</span>
            <h2 className="section-title">
              {isAr ? "برامج تبني قدرات جيلٍ يقود العمل المناخي." : "Programs that equip a generation leading climate action."}
            </h2>
            <p className="section-lead mx-auto">
              {isAr
                ? "من المنصات الرقمية إلى المعسكرات الميدانية — كل برنامج مصمم ليبني قدرات الشباب ويربط المبادرات المناخية عبر المنطقة."
                : "From digital platforms to field camps — every program is designed to build youth capacity and connect climate initiatives across the region."}
            </p>
          </div>

          <div style={{ marginTop: "48px" }}>
            {programs.length > 0 ? (
              <ProgramCards programs={programs} />
            ) : (
              renderSectionState(
                "لا توجد برامج منشورة حالياً",
                "No programs published yet",
                "سيتم عرض البرامج هنا فور إضافتها من لوحة التحكم.",
                "Programs will appear here as soon as they are published from the CMS."
              )
            )}
          </div>
        </div>
      </motion.section>

      {/* 4. Initiatives Progress Section */}
      <motion.section
        className="section home-initiatives-section bg-gradient-brand-soft"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={sectionRevealVariants}
      >
        <div className="container">
          <div className="home-section-header text-center">
            <span className="eyebrow">{t("initiatives")}</span>
            <h2 className="section-title">
              {isAr ? "ألقِ نظرة على إنجازاتنا" : "Take a look at our achievements"}
            </h2>
          </div>

          {homeInitiatives.length > 0 ? (
            <div className="initiatives-cards-grid">
              {homeInitiatives.map((init) => (
                <div key={init.id} className="initiative-card-item card">
                  <div
                    className={`initiative-image-header ${init.image ? "" : "no-image"}`}
                    style={init.image ? { backgroundImage: `url(${init.image})` } : undefined}
                    aria-hidden="true"
                  >
                    <span className="initiative-category-badge">
                      {isAr ? init.categoryAr : init.categoryEn}
                    </span>
                  </div>
                  <div className="initiative-card-body">
                    <h3>{isAr ? init.titleAr : init.titleEn}</h3>
                    <p className="initiative-desc">
                      {isAr ? init.descriptionAr : init.descriptionEn}
                    </p>

                    {/* شريط التقدم للمبادرات اللي ليها هدف مُعلن بس */}
                    {((isAr ? init.targetAr : init.targetEn) ?? "").trim() !== "" && (
                    <div className="initiative-progress-container">
                      <div className="progress-stats-row">
                        <span>{isAr ? "التقدم الحالي" : "Current Progress"}</span>
                        <span className="progress-percentage-text">{init.progress}%</span>
                      </div>
                      <div
                        className="progress-bar-track"
                        role="progressbar"
                        aria-valuenow={init.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={isAr ? init.titleAr : init.titleEn}
                      >
                        <div className="progress-bar-fill" style={{ width: `${init.progress}%` }}></div>
                      </div>
                      <div className="target-goal-row">
                        <Target size={14} aria-hidden="true" />
                        <strong>{isAr ? "الهدف:" : "Target:"}</strong>{" "}
                        <span>{isAr ? init.targetAr : init.targetEn}</span>
                      </div>
                    </div>
                    )}

                    <Link to="/programs#initiatives" className="initiative-explore-btn">
                      <span>{isAr ? "استكشف المزيد" : "Explore Campaign"}</span>
                      {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            renderSectionState(
              "لا توجد مبادرات منشورة حالياً",
              "No initiatives published yet",
              "سيتم عرض المبادرات وحملاتها هنا فور إضافتها.",
              "Initiatives and their campaign progress will appear here once published."
            )
          )}
        </div>
      </motion.section>

      {/* 5. Latest News Section */}
      <motion.section
        className="section home-news-section"
        id="news"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={sectionRevealVariants}
      >
        <div className="container">
          <div className="home-section-header text-center">
            <span className="eyebrow">{isAr ? "أحدث الأخبار" : "Latest News"}</span>
            <h2 className="section-title">
              {isAr ? "تفقد بعضاً من أخبارنا" : "Check out some of our news"}
            </h2>
          </div>

          {posts.length > 0 ? (
            <div className="news-cards-grid-layout">
              {posts.map((post) => (
                <article key={post.id} className="news-card-item card">
                  <div
                    className="news-thumbnail-banner"
                    style={{ backgroundImage: `url(${post.image})` }}
                    aria-hidden="true"
                  ></div>
                  <div className="news-content-body">
                    <div className="news-meta-row">
                      <span className="news-date-text">{post.date}</span>
                      <span className="news-category-badge">
                        {isAr ? post.categoryAr : post.categoryEn}
                      </span>
                    </div>
                    <h3>{isAr ? post.titleAr : post.titleEn}</h3>
                    <p>{isAr ? post.excerptAr : post.excerptEn}</p>
                    <Link to={`/blog/${post.id}`} className="news-read-more-link">
                      <span>{isAr ? "اقرأ المزيد" : "Read More"}</span>
                      {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            renderSectionState(
              "لا توجد أخبار منشورة حالياً",
              "No news published yet",
              "ستظهر أحدث المقالات والأخبار هنا فور نشرها.",
              "The latest articles will show up here as soon as they are published."
            )
          )}
        </div>
      </motion.section>
    </div>
  );
};
