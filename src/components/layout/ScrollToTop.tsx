import { useEffect, useRef } from "react";
import { useLocation, useNavigationType, NavigationType } from "react-router-dom";
import { scrollToTopNow } from "./scrollController";

/**
 * الآلية **الوحيدة** لإعادة التمرير لأعلى عند التنقل.
 *
 * كان هناك ثلاث آليات متزامنة (هنا + نداءان في Layout)، وكانت تعمل أيضاً على
 * الرجوع/التقدّم فتُدمّر استعادة موضع التمرير التي يوفّرها المتصفح مجاناً.
 * الآن: نتخطى POP (رجوع/تقدّم) ونتخطى أول تحميل حتى لا نلغي استعادة
 * المتصفح أو الانتقال إلى #hash.
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // الرجوع/التقدّم: نترك المتصفح يستعيد الموضع السابق.
    if (navigationType === NavigationType.Pop) return;

    scrollToTopNow();
  }, [pathname, navigationType]);

  return null;
};
