import { useMemo } from "react";

/**
 * تاريخ بصيغة YYYY-MM-DD بالتوقيت المحلي.
 *
 * `new Date().toISOString().split("T")[0]` كان بيرجّع تاريخ UTC — يعني في
 * الإمارات (UTC+4) أي حاجة بتتنشر قبل الساعة 4 عصراً كانت بتتسجّل بتاريخ
 * إمبارح. وكمان الـ split بيرجّع `string | undefined` تحت noUncheckedIndexedAccess.
 */
export function toLocalDateInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * بيقرا قيمة design token من :root.
 *
 * AnalyticsChart بيحط اللون في SVG presentation attributes (stroke, stop-color)
 * والـ attributes دي ما بتفهمش `var(--green)` — فلازم نحوّل التوكن لقيمة فعلية
 * بدل ما نكتب الـ hex في الكود.
 */
export function readToken(name: string, fallback: string): string {
  if (typeof document === "undefined" || typeof window === "undefined") return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** ألوان الرسوم البيانية جاية من --green/--blue بدل hex مكرر في كل صفحة. */
export function useChartColors(): { primary: string; secondary: string } {
  return useMemo(
    () => ({
      primary: readToken("--green", "#00C091"),
      secondary: readToken("--blue", "#009AF8")
    }),
    []
  );
}

/**
 * Excel و Google Sheets بيفسّروا أي خلية بتبدأ بـ `=` `+` `-` `@` (أو tab/CR)
 * كمعادلة. النص ده جاي من فورم "اتصل بنا" المفتوح للعامة، يعني أي زائر يقدر
 * يزرع معادلة تتنفّذ على جهاز الأدمن أول ما يفتح الملف.
 */
const CSV_FORMULA_START = /^[=+\-@\t\r]/;

/** بيرجّع الحقل متهرّب بالكامل ومحاط بعلامتي تنصيص — صالح لأي نص فيه فاصلة أو سطر جديد. */
export function toCsvField(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = CSV_FORMULA_START.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** بيبني ملف CSV كامل (مع BOM عشان العربي يظهر صح في Excel). */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(toCsvField).join(","),
    ...rows.map((row) => row.map(toCsvField).join(","))
  ];
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * بينزّل نص كملف عن طريق Blob URL.
 * الطريقة القديمة (`encodeURI("data:text/csv," + csv)`) كانت بتقطع الملف عند أول
 * `#` لأن المتصفح بيعتبر اللي بعده fragment.
 */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
