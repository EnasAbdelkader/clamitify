import type Lenis from "lenis";

/**
 * سجل صغير يربط <ScrollToTop/> (المُركّب في App.tsx خارج الـ Layout) بنسخة
 * Lenis التي يُنشئها الـ Layout.
 *
 * السبب: كان إعادة التمرير لأعلى يحدث ثلاث مرات في كل تنقل — مرة في
 * ScrollToTop عبر window.scrollTo، ومرتين في Layout عبر lenis.scrollTo
 * و window.scrollTo. وبما أن Lenis يقود موضع التمرير بنفسه، فإن نداء
 * window.scrollTo المباشر يجعله يفقد التزامن. الآن هناك آلية واحدة فقط:
 * ScrollToTop يسأل هذا السجل ويستخدم Lenis إن كان نشطاً، وإلا window.scrollTo.
 */
let lenisInstance: Lenis | null = null;

export const registerScrollController = (instance: Lenis | null): void => {
  lenisInstance = instance;
};

/**
 * إيقاف/استئناف التمرير الناعم أثناء فتح نافذة حوارية.
 * `body { overflow: hidden }` وحده لا يكفي لأن Lenis يقود موضع التمرير بنفسه.
 */
export const setScrollLocked = (locked: boolean): void => {
  if (!lenisInstance) return;
  if (locked) lenisInstance.stop();
  else lenisInstance.start();
};

/** إعادة التمرير لأعلى الصفحة فوراً، عبر Lenis إن كان يقود التمرير. */
export const scrollToTopNow = (): void => {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { immediate: true, force: true });
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
};
