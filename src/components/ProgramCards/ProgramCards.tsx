import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { BorderGlow } from "../BorderGlow/BorderGlow";
import {
  FlaskConical,
  Megaphone,
  Users,
  Leaf,
  Monitor,
  MessageSquare,
  Activity,
  TreePine,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { Program } from "../../types";
import "./ProgramCards.css";

/**
 * ProgramCards — شبكة كروت برامج بتصميم نظيف وموحّد.
 *
 * التصميم: كرت بسيط بحواف --radius-lg، أيقونة في tile صغير بـ gradient brand،
 * رقم تسلسلي كـ eyebrow، عنوان + وصف + Learn More link.
 * في وضع الدارك مود: يتم استخدام مكون BorderGlow لإعفاء الكروت بتأثيرات توهج تفاعلية.
 * في وضع اللايت مود: يتم إظهار الكروت بأسلوب النهار الأصلي النظيف.
 */
type ProgramCardsProps = {
  programs: Program[];
  className?: string;
};

/**
 * ============================================================
 * PROGRAM_ICON_MAP — المصدر الوحيد لتحويل `Program.icon` لأيقونة.
 * ============================================================
 * يا مطور الباك إند: القيم المقبولة في حقل `icon` هي مفاتيح الخريطة دي فقط:
 *
 *   "Monitor"          → شاشة (التحول الرقمي)
 *   "Search"           → دورق تجارب (البحوث والدراسات)  ← ملحوظة: بنعرض FlaskConical
 *   "Megaphone"        → مكبر صوت (التوعية والحملات)
 *   "Users"            → مجموعة أشخاص (تنمية المجتمع)
 *   "MessageSquare"    → محادثة (الاستشارات)
 *   "Leaf"             → ورقة شجر (البيئة)
 *   "TreePine"         → شجرة (التشجير والمبادرات)
 *   "Activity"         → نبض/نشاط (عام)
 *
 * وكمان مدعوم للتوافق مع الداتا القديمة استخدام `Program.id` كمفتاح:
 *   research | outreach | development | consultation |
 *   digital-transformation | community-development
 *
 * أي اسم مش موجود في القايمة دي بيرجع FALLBACK_PROGRAM_ICON (علامة استفهام)
 * عشان الخطأ يبان في الواجهة بدل ما يعدّي بصمت بأيقونة تبدو صحيحة.
 */
export const PROGRAM_ICON_MAP: Readonly<Record<string, LucideIcon>> = {
  // أسماء الأيقونات كما ترجع من الباك إند
  Monitor: Monitor,
  Search: FlaskConical,
  Megaphone: Megaphone,
  Users: Users,
  MessageSquare: MessageSquare,
  Leaf: Leaf,
  TreePine: TreePine,
  Activity: Activity,
  // مفاتيح بديلة على أساس معرّف البرنامج
  research: FlaskConical,
  outreach: Megaphone,
  development: Users,
  consultation: Leaf,
  "digital-transformation": Monitor,
  "community-development": Users,
};

/** قائمة الأسماء المقبولة — مفيدة للتوثيق أو للتحقق في أدوات الإدارة. */
export const PROGRAM_ICON_NAMES: readonly string[] = Object.keys(PROGRAM_ICON_MAP);

/** أيقونة ظاهرة بوضوح للقيم غير المعروفة. */
export const FALLBACK_PROGRAM_ICON: LucideIcon = HelpCircle;

/** المُحلّل الوحيد: اسم الأيقونة أولاً، ثم معرّف البرنامج، ثم البديل الظاهر. */
export function resolveProgramIcon(iconName?: string, programId?: string): LucideIcon {
  const byName = iconName ? PROGRAM_ICON_MAP[iconName] : undefined;
  if (byName) return byName;
  const byId = programId ? PROGRAM_ICON_MAP[programId] : undefined;
  if (byId) return byId;
  return FALLBACK_PROGRAM_ICON;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/** نسخة بدون حركة لمن فعّل prefers-reduced-motion */
const staticCardVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
};

type Palette = { glowColor: string; colors: string[] };

const COLOR_PALETTES: Palette[] = [
  { glowColor: "190 90 70", colors: ['#38bdf8', '#818cf8', '#34d399'] }, // Digital Transformation
  { glowColor: "150 85 65", colors: ['#10b981', '#34d399', '#6ee7b7'] }, // Research & Studies
  { glowColor: "38 92 65",  colors: ['#f59e0b', '#fbbf24', '#fcd34d'] }, // Community Outreach
  { glowColor: "280 85 75", colors: ['#c084fc', '#f472b6', '#38bdf8'] }, // Community Development
  { glowColor: "160 85 60", colors: ['#059669', '#10b981', '#34d399'] }, // Environmental Consultation
];

/** بديل حقيقي لو الفهرسة رجعت undefined (noUncheckedIndexedAccess) */
const DEFAULT_PALETTE: Palette = { glowColor: "160 85 60", colors: ['#00C091', '#009AF8', '#34d399'] };

export const ProgramCards: React.FC<ProgramCardsProps> = ({
  programs,
  className = "",
}) => {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const isAr = language === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  if (!programs || programs.length === 0) return null;

  const isDark = theme === "dark";
  const itemVariants = shouldReduceMotion ? staticCardVariants : cardVariants;

  return (
    <motion.div
      className={`pc-grid ${className}`.trim()}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={containerVariants}
    >
      {programs.map((program, idx) => {
        const Icon = resolveProgramIcon(program.icon, program.id);
        const num = String(idx + 1).padStart(2, "0");
        const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length] ?? DEFAULT_PALETTE;

        const cardInner = (
          <div className="pc-body">
            <span className="pc-watermark-num" aria-hidden="true">{num}</span>
            <div className="pc-head">
              <span className="pc-icon-tile">
                <Icon size={22} strokeWidth={2} />
              </span>
              <span className="pc-num-badge" aria-hidden="true">{num}</span>
            </div>

            <h3 className="pc-title">
              {isAr ? program.titleAr : program.titleEn}
            </h3>

            <p className="pc-desc">
              {isAr ? program.descriptionAr : program.descriptionEn}
            </p>

            <Link to={`/programs#${program.id}`} className="pc-link">
              <span>{t("learnMore")}</span>
              <Arrow size={16} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>
        );

        return (
          <motion.div
            key={program.id}
            id={program.id}
            variants={itemVariants}
            style={{ height: "100%", width: "100%" }}
          >
            {isDark ? (
              <BorderGlow
                edgeSensitivity={30}
                glowColor={palette.glowColor}
                backgroundColor="var(--surface-2)"
                borderRadius={20}
                glowRadius={35}
                glowIntensity={1.2}
                coneSpread={25}
                animated={false}
                colors={palette.colors}
                className="pc-card pc-card-glow"
              >
                {cardInner}
              </BorderGlow>
            ) : (
              <div className="pc-card" style={{ height: "100%", width: "100%" }}>
                {/* شريط علوي رفيع يظهر عند hover في وضع النهار */}
                <span className="pc-top-bar" aria-hidden="true" />
                {cardInner}
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default ProgramCards;
