import React, { useId, useMemo, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { EmptyState } from "./EmptyState";
import "./AnalyticsChart.css";

interface DataPoint {
  labelEn: string;
  labelAr: string;
  value: number;
  secondaryValue?: number;
}

interface AnalyticsChartProps {
  type: "line" | "bar" | "donut";
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  /** الـ API ممكن يرجّع null أو ريسبونس مغلّف — الكومبوننت بيتعامل مع ده وقت التشغيل */
  data: DataPoint[] | null | undefined;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  unitEn?: string;
  unitAr?: string;
}

interface Series {
  labelEn: string;
  labelAr: string;
  value: number;
  secondaryValue?: number;
}

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

/**
 * الباك إند بيبعت أرقام جاهزة للعرض زي "1,240" أو "87%" أو حتى أرقام عربية.
 * بنحوّلها لرقم حقيقي، وبنرجّع null لو مفيش رقم صالح (بدل NaN اللي بيكسر الرسم).
 */
const parseNumeric = (raw: unknown): number | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  const normalized = raw
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/[,\s ٬]/g, "")
    .replace(/[^\d.+-]/g, "");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

/** بيقبل مصفوفة، أو ريسبونس مغلّف { data: [...] }، أو أي حاجة تانية بيرجّع [] */
const unwrapRows = (input: unknown): unknown[] => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    const envelope = input as Record<string, unknown>;
    for (const key of ["data", "items", "results"]) {
      const candidate = envelope[key];
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
};

const normalize = (input: unknown): Series[] => {
  const rows = unwrapRows(input);
  const out: Series[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const candidate = row as Record<string, unknown>;

    const value = parseNumeric(candidate["value"]);
    if (value === null) continue;

    const secondary = parseNumeric(candidate["secondaryValue"]);
    const labelEnRaw = candidate["labelEn"];
    const labelArRaw = candidate["labelAr"];
    const labelEn = typeof labelEnRaw === "string" ? labelEnRaw : "";
    const labelAr = typeof labelArRaw === "string" ? labelArRaw : "";

    out.push({
      labelEn: labelEn || labelAr,
      labelAr: labelAr || labelEn,
      value,
      ...(secondary !== null ? { secondaryValue: secondary } : {}),
    });
  }

  return out;
};

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  type,
  titleEn,
  titleAr,
  subtitleEn,
  subtitleAr,
  data,
  height = 220,
  primaryColor = "#00C091",
  secondaryColor = "#009AF8",
  unitEn = "",
  unitAr = "",
}) => {
  const { language } = useLanguage();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // useId عشان أكتر من شارت في نفس الصفحة ما يتشاركوش نفس الـ gradient id
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, "");

  const isAr = language === "ar";
  const title = isAr ? titleAr : titleEn;
  const subtitle = isAr ? subtitleAr : subtitleEn;
  const unit = isAr ? unitAr : unitEn;

  const series = useMemo(() => normalize(data), [data]);

  const labelOf = (point: Series) => (isAr ? point.labelAr : point.labelEn);
  const hovered = hoveredIndex !== null ? series[hoveredIndex] : undefined;

  // نطاق القيم — بيتعامل مع الأصفار والقيم السالبة من غير قسمة على صفر
  const { domainMin, span } = useMemo(() => {
    const values: number[] = [];
    for (const point of series) {
      values.push(point.value);
      if (typeof point.secondaryValue === "number") values.push(point.secondaryValue);
    }
    if (values.length === 0) return { domainMin: 0, span: 1 };
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    return { domainMin: min, span: max - min || 1 };
  }, [series]);

  const ratioOf = (value: number) => (value - domainMin) / span;

  const chartHeader = (
    <div className="chart-header">
      <div>
        <h3 className="chart-title">{title}</h3>
        {subtitle && <p className="chart-subtitle">{subtitle}</p>}
      </div>
      {hovered && (
        <div className="chart-tooltip-badge">
          <span>{labelOf(hovered)}: </span>
          <strong>
            {hovered.value.toLocaleString()} {unit}
          </strong>
        </div>
      )}
    </div>
  );

  /** جدول مخفي بصريًا فيه القيم الحقيقية — البديل النصي للرسم */
  const dataTable = (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">{isAr ? "الفئة" : "Label"}</th>
          <th scope="col">{isAr ? "القيمة" : "Value"}</th>
        </tr>
      </thead>
      <tbody>
        {series.map((point, i) => (
          <tr key={`${point.labelEn}-${i}`}>
            <th scope="row">{labelOf(point)}</th>
            <td>
              {point.value.toLocaleString()} {unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const ariaLabel = useMemo(() => {
    if (series.length === 0) return title;

    const kind = isAr
      ? { line: "رسم خطي", bar: "رسم أعمدة", donut: "رسم دائري" }[type]
      : { line: "line chart", bar: "bar chart", donut: "donut chart" }[type];

    let highest = series[0];
    let lowest = series[0];
    for (const point of series) {
      if (!highest || point.value > highest.value) highest = point;
      if (!lowest || point.value < lowest.value) lowest = point;
    }

    const count = series.length;
    if (!highest || !lowest) return `${title} — ${kind}`;

    const highLabel = isAr ? highest.labelAr : highest.labelEn;
    const lowLabel = isAr ? lowest.labelAr : lowest.labelEn;

    if (isAr) {
      return `${title} — ${kind} يحتوي على ${count} قيمة. الأعلى ${highLabel} بقيمة ${highest.value.toLocaleString()} ${unit}، والأدنى ${lowLabel} بقيمة ${lowest.value.toLocaleString()} ${unit}.`;
    }
    return `${title} — ${kind} with ${count} data points. Highest ${highLabel} at ${highest.value.toLocaleString()} ${unit}, lowest ${lowLabel} at ${lowest.value.toLocaleString()} ${unit}.`;
  }, [series, isAr, type, title, unit]);

  // ── لا توجد بيانات صالحة ───────────────────────────────────────────
  if (series.length === 0) {
    return (
      <div className="chart-card">
        {chartHeader}
        <EmptyState
          compact
          type="no-data"
          titleEn="No chart data yet"
          titleAr="لا توجد بيانات لعرضها"
          descriptionEn="There is nothing to plot for this period."
          descriptionAr="لا توجد قيم متاحة لهذه الفترة حتى الآن."
        />
      </div>
    );
  }

  if (type === "line") {
    const padding = 30;
    const chartWidth = 500;
    const chartHeight = Math.max(height - 40, 60);
    const baselineY = chartHeight + 10;
    const usableWidth = chartWidth - padding * 2;

    // في العربية الليبلز بتتقلب يمين→شمال، فلازم الرسم يتقلب معاها
    // عشان كل ليبل يفضل مقابل نقطته الصح.
    const points = series.map((point, index) => {
      const t = series.length === 1 ? 0.5 : index / (series.length - 1);
      const x = isAr ? padding + usableWidth - t * usableWidth : padding + t * usableWidth;
      const y = chartHeight - ratioOf(point.value) * (chartHeight - padding) + 10;
      return { x, y, point };
    });

    const first = points[0];
    const last = points[points.length - 1];

    let pathD = "";
    if (first) {
      pathD = `M ${first.x} ${first.y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        if (!curr || !next) continue;
        const cpX = (curr.x + next.x) / 2;
        pathD += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
      }
    }

    const areaD =
      points.length > 1 && first && last
        ? `${pathD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`
        : "";

    const areaGradientId = `chartArea-${uid}`;
    const lineGradientId = `chartLine-${uid}`;

    return (
      <div className="chart-card">
        {chartHeader}

        <div className="chart-svg-wrapper">
          <svg
            viewBox={`0 0 ${chartWidth} ${height}`}
            className="chart-svg"
            preserveAspectRatio="none"
            role="img"
            aria-label={ariaLabel}
          >
            <defs>
              <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={primaryColor} />
                <stop offset="100%" stopColor={secondaryColor} />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 0.33, 0.66, 1].map((ratio, i) => {
              const y = 10 + ratio * (chartHeight - 10);
              return (
                <line
                  key={i}
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="var(--admin-border, rgba(255,255,255,0.08))"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Area Fill */}
            {areaD && <path d={areaD} fill={`url(#${areaGradientId})`} />}

            {/* Main Path */}
            {points.length > 1 && (
              <path
                d={pathD}
                fill="none"
                stroke={`url(#${lineGradientId})`}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Dots */}
            {points.map((pt, i) => (
              <g
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIndex === i ? "7" : "4.5"}
                  fill="var(--surface, #101A26)"
                  stroke={hoveredIndex === i ? secondaryColor : primaryColor}
                  strokeWidth="3"
                  className="chart-dot"
                />
              </g>
            ))}
          </svg>
        </div>

        <div className="chart-x-axis" aria-hidden="true">
          {series.map((point, i) => (
            <span
              key={i}
              className={`chart-axis-label ${hoveredIndex === i ? "active" : ""}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {labelOf(point)}
            </span>
          ))}
        </div>

        {dataTable}
      </div>
    );
  }

  if (type === "bar") {
    return (
      <div className="chart-card">
        {chartHeader}

        <div
          className="chart-bars-container"
          style={{ height: Math.max(height - 50, 60) }}
          role="img"
          aria-label={ariaLabel}
        >
          {series.map((point, i) => {
            // القيمة صفر (أو سالبة) ما ليهاش عمود — الحد الأدنى 8% القديم
            // كان بيرسم "نشاط" وهمي لفترات مفيهاش أي حاجة.
            const hasValue = point.value > 0;
            const heightPercent = hasValue ? Math.min(100, Math.max(8, ratioOf(point.value) * 100)) : 0;
            const isHovered = hoveredIndex === i;

            return (
              <div
                key={i}
                className="chart-bar-column"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="chart-bar-track">
                  <div
                    className={`chart-bar-fill ${isHovered ? "hovered" : ""}`}
                    style={{
                      height: `${heightPercent}%`,
                      background: `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                    }}
                  >
                    {/* القيمة بيضاء داخل العمود الملوّن — بعمود صفر بتختفي بدل ما تسبح وحدها */}
                    {hasValue && <span className="chart-bar-val">{point.value.toLocaleString()}</span>}
                  </div>
                </div>
                <span className={`chart-axis-label ${isHovered ? "active" : ""}`}>
                  {labelOf(point)}
                </span>
              </div>
            );
          })}
        </div>

        {dataTable}
      </div>
    );
  }

  // ── Donut ──────────────────────────────────────────────────────────
  // القيم السالبة ما ينفعش تترسم كقطاع، فبنتجاهلها في الحساب
  const donutSlices = series.map((point) => ({ ...point, value: Math.max(point.value, 0) }));
  const total = donutSlices.reduce((acc, point) => acc + point.value, 0);
  const colors = [primaryColor, secondaryColor, "#A78BFA", "#FBBF24", "#F472B6"];

  if (total <= 0) {
    return (
      <div className="chart-card">
        {chartHeader}
        <EmptyState
          compact
          type="no-data"
          titleEn="No measurable activity yet"
          titleAr="لا يوجد نشاط قابل للقياس بعد"
          descriptionEn="All recorded values for this breakdown are zero."
          descriptionAr="كل القيم المسجّلة في هذا التوزيع تساوي صفر."
        />
        {dataTable}
      </div>
    );
  }

  let accumulated = 0;

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">{title}</h3>
          {subtitle && <p className="chart-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="chart-donut-wrapper">
        <div className="chart-donut-svg-container">
          <svg viewBox="0 0 100 100" className="chart-donut-svg" role="img" aria-label={ariaLabel}>
            {donutSlices.map((point, i) => {
              const percentage = point.value / total;
              const strokeDasharray = `${percentage * 283} 283`;
              const strokeDashoffset = -accumulated * 283;
              accumulated += percentage;
              const color = colors[i % colors.length] ?? primaryColor;

              return (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r="45"
                  fill="transparent"
                  stroke={color}
                  strokeWidth="10"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="chart-donut-segment"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>
          <div className="chart-donut-center">
            <span className="chart-donut-total">{total.toLocaleString()}</span>
            <span className="chart-donut-total-lbl">{isAr ? "الإجمالي" : "Total"}</span>
          </div>
        </div>

        <div className="chart-donut-legend">
          {donutSlices.map((point, i) => (
            <div
              key={i}
              className={`chart-legend-item ${hoveredIndex === i ? "active" : ""}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="chart-legend-dot"
                style={{ background: colors[i % colors.length] ?? primaryColor }}
              />
              <span className="chart-legend-label">{labelOf(point)}</span>
              <span className="chart-legend-val">{point.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {dataTable}
    </div>
  );
};
