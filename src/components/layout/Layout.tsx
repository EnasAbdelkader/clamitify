import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { AIChatAssistant } from "./AIChatAssistant";
import { MobileBottomNav } from "./MobileBottomNav";
import { QuickCommandPalette } from "../ui/QuickCommandPalette";
import { RouteLoader } from "../common/RouteLoader";
import { useLanguage } from "../../context/LanguageContext";
import { registerScrollController } from "./scrollController";
import { motion, AnimatePresence } from "framer-motion";
import Lenis from "lenis";
import "./Layout.css";
import "../../styles/global.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const prefersReducedMotion = (): boolean => {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCED_MOTION_QUERY).matches
      : false;
  } catch {
    return false;
  }
};

/**
 * يُجمّد محتوى المسار الحالي عند أول رسم.
 *
 * <Outlet/> يعرض دائماً محتوى المسار **الحالي**، فحين تُغلّفه AnimatePresence
 * بوضع mode="wait" كانت الشجرة الخارجة تُعاد رسمها بمحتوى المسار الجديد أثناء
 * حركة الخروج (تظهر الصفحة الجديدة مرتين للحظة). بتغيير الـ key لكل مسار
 * تُنشأ نسخة جديدة تُجمّد المحتوى الجديد، وتُبقي النسخة الخارجة محتواها القديم.
 */
const FrozenOutlet: React.FC = () => {
  const outlet = useOutlet();
  const [frozen] = useState(() => outlet);
  return <>{frozen}</>;
};

export const Layout: React.FC = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const isHome = location.pathname === "/";
  const lenisRef = useRef<Lenis | null>(null);
  const [reduceMotion, setReduceMotion] = useState<boolean>(prefersReducedMotion);

  // نتابع تفضيل تقليل الحركة أثناء التشغيل، لا عند التركيب فقط.
  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(REDUCED_MOTION_QUERY);
    } catch {
      return;
    }
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // التمرير الناعم حركة غير أساسية: من يطلب تقليل الحركة لا يحصل عليها،
    // ويستعيد تمرير المتصفح الأصلي بالكامل (بما فيه سرعته الطبيعية).
    if (reduceMotion) {
      registerScrollController(null);
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });

    lenisRef.current = lenis;
    // ScrollToTop في App.tsx يستخدم هذه النسخة، فلا يبقى إلا نداء واحد لكل تنقل.
    registerScrollController(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      registerScrollController(null);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduceMotion]);

  const skipLinkLabel = language === "ar" ? "تخطَّ إلى المحتوى الرئيسي" : "Skip to main content";

  // حركة انتقال الصفحات تُلغى تماماً عند تفضيل تقليل الحركة.
  const pageMotion = useMemo(
    () =>
      reduceMotion
        ? {
            initial: { opacity: 1 },
            animate: { opacity: 1 },
            exit: { opacity: 1 },
            transition: { duration: 0 },
          }
        : {
            initial: { opacity: 0, y: 15 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -15 },
            transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const },
          },
    [reduceMotion]
  );

  return (
    <div className="app-layout">
      {/* أول عنصر قابل للتركيز في الصفحة: يسمح لمستخدم الكيبورد بتخطي الهيدر */}
      <a className="skip-link" href="#main-content">
        {skipLinkLabel}
      </a>

      {/* خلفية الأمواج والفقاعات المتحركة المأخوذة من نظام التصميم */}
      <div className="wave-bg" aria-hidden="true"></div>

      <Header isHome={isHome} />

      <main className="main-content-flow" id="main-content" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} {...pageMotion} style={{ width: "100%" }}>
            {/*
              حدّ Suspense داخلي: بدونه كان أي تنقل إلى مسار lazy يُفعّل الحدّ
              الموجود في App.tsx فوق الـ Layout، فتُهدم تأثيرات الـ Layout
              (ومعها نسخة Lenis) وتُعاد إنشاؤها في كل تنقل.
            */}
            <Suspense fallback={<RouteLoader />}>
              <FrozenOutlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
      <AIChatAssistant />
      <MobileBottomNav />
      <QuickCommandPalette />
    </div>
  );
};
