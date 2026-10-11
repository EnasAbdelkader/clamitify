import React from "react";
import {
  Calendar, FileText, LayoutGrid, Target, GraduationCap, Briefcase, Users,
  Image as ImageIcon,
} from "lucide-react";
import { useCMSStore } from "../../../store/useCMSStore";
import { sanitizeUrl } from "../../../services/api";
import { resolveProgramIcon } from "../../../components/ProgramCards/ProgramCards";
import { toLocalDateInput } from "../adminUtils";
import type {
  Event, BlogPost, Program, Initiative, Course, Opportunity, TeamMember,
} from "../../../types";
import type {
  ColumnDef, FieldDef, FilterDef, FormRecord, SectionDef,
} from "./types";

// ============================================================
// سجل أقسام المحتوى — كل قسم يعرّف بياناته وحقوله وحدود تحققه
// في مكان واحد. إضافة قسم جديد = إضافة كائن واحد هنا.
// ============================================================

/** نفس الأسماء الرسمية في PROGRAM_ICON_MAP (ProgramCards.tsx) — مصدر واحد للأيقونات. */
export const PROGRAM_ICONS = [
  "Monitor",
  "Search",
  "Megaphone",
  "Users",
  "MessageSquare",
  "Leaf",
  "TreePine",
  "Activity",
] as const;

const OPPORTUNITY_TYPES = [
  { value: "Volunteering", labelEn: "Volunteering", labelAr: "تطوع" },
  { value: "Job", labelEn: "Job", labelAr: "وظيفة" },
  { value: "Internship", labelEn: "Internship", labelAr: "تدريب عملي" },
] as const;

const INITIATIVE_STATUSES = [
  { value: "active", labelEn: "Active", labelAr: "نشطة" },
  { value: "completed", labelEn: "Completed", labelAr: "مكتملة" },
  { value: "upcoming", labelEn: "Upcoming", labelAr: "قادمة" },
] as const;

/** قراءة نصية آمنة من نموذج الإدخال الخام. */
const str = (form: FormRecord, key: string): string => {
  const value = form[key];
  return typeof value === "string" ? value : value === undefined ? "" : String(value);
};

/** تقييد رقم خام ضمن نطاق؛ يرجع null للإدخال الفارغ (حقل اختياري). */
const clampIntOrNull = (raw: string, min: number, max: number): number | null => {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const initStatusOf = (form: FormRecord): "active" | "completed" | "upcoming" => {
  const value = str(form, "status");
  return value === "completed" || value === "upcoming" ? value : "active";
};

/** رسالة موحدة لحقول العنوان/الاسم المطلوبة باللغتين. */
function requireBothLanguages(
  form: FormRecord,
  base: string,
  isAr: boolean,
  labelAr: string,
  labelEn: string
): string | null {
  if (str(form, `${base}Ar`).trim() && str(form, `${base}En`).trim()) return null;
  return isAr
    ? `برجاء ملء ${labelAr} باللغتين.`
    : `Please fill in the ${labelEn} in both languages.`;
}

const initiativeStatusLabel = (value: string | undefined, isAr: boolean): string => {
  /* status اختيارية — لو مش موجودة المبادرة تُعامل كنشطة حسب annotation في النوع. */
  if (!value) return isAr ? "نشطة" : "Active";
  return INITIATIVE_STATUSES.find((s) => s.value === value)?.[isAr ? "labelAr" : "labelEn"] ?? value;
};

// ============================================================
// Fields — تصريحات حقول المحرر (تُعرض: العامة أعلى، ثم لوحتا AR/EN)
// ============================================================

const eventFields = (): FieldDef[] => [
  { name: "titleAr", labelAr: "عنوان الفعالية (بالعربية)", labelEn: "Event Title (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "titleEn", labelAr: "عنوان الفعالية (بالإنجليزية)", labelEn: "Event Title (English)", kind: "text", lang: "en", required: true },
  { name: "descriptionAr", labelAr: "تفاصيل الفعالية (بالعربية)", labelEn: "Description (Arabic)", kind: "textarea", lang: "ar", required: true, span: 2 },
  { name: "descriptionEn", labelAr: "تفاصيل الفعالية (بالإنجليزية)", labelEn: "Description (English)", kind: "textarea", lang: "en", required: true, span: 2 },
  { name: "date", labelAr: "تاريخ الفعالية", labelEn: "Event Date", kind: "date", lang: null, required: true, hintAr: "تاريخ ISO (YYYY-MM-DD) — الصفحة العامة بترتّب وتعرض به.", hintEn: "ISO date (YYYY-MM-DD) — the public page sorts and renders by it." },
  { name: "categoryAr", labelAr: "الفئة (عربي)", labelEn: "Category (Arabic)", kind: "text", lang: null, required: true, placeholderAr: "مؤتمر بيئي" },
  { name: "categoryEn", labelAr: "الفئة (إنجليزي)", labelEn: "Category (English)", kind: "text", lang: null, required: true, placeholderEn: "Climate Conference" },
  { name: "locationAr", labelAr: "الموقع (عربي)", labelEn: "Location (Arabic)", kind: "text", lang: null, required: true, placeholderAr: "القاهرة، مصر" },
  { name: "locationEn", labelAr: "الموقع (إنجليزي)", labelEn: "Location (English)", kind: "text", lang: null, required: true, placeholderEn: "Cairo, Egypt" },
];

const postFields = (): FieldDef[] => [
  { name: "titleAr", labelAr: "العنوان (بالعربية)", labelEn: "Title (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "titleEn", labelAr: "العنوان (بالإنجليزية)", labelEn: "Title (English)", kind: "text", lang: "en", required: true },
  { name: "excerptAr", labelAr: "الملخص (عربي)", labelEn: "Excerpt (Arabic)", kind: "textarea", lang: "ar", required: true },
  { name: "excerptEn", labelAr: "الملخص (إنجليزي)", labelEn: "Excerpt (English)", kind: "textarea", lang: "en", required: true },
  { name: "contentAr", labelAr: "المحتوى الكامل (عربي)", labelEn: "Full Content (Arabic)", kind: "textarea", lang: "ar", required: true, span: 2 },
  { name: "contentEn", labelAr: "المحتوى الكامل (إنجليزي)", labelEn: "Full Content (English)", kind: "textarea", lang: "en", required: true, span: 2 },
  { name: "authorAr", labelAr: "الكاتب (عربي)", labelEn: "Author (Arabic)", kind: "text", lang: null, required: true },
  { name: "authorEn", labelAr: "الكاتب (إنجليزي)", labelEn: "Author (English)", kind: "text", lang: null, required: true },
  { name: "categoryAr", labelAr: "الفئة (عربي)", labelEn: "Category (Arabic)", kind: "text", lang: null, required: true, placeholderAr: "مثال: بيئة" },
  { name: "categoryEn", labelAr: "الفئة (إنجليزي)", labelEn: "Category (English)", kind: "text", lang: null, required: true, placeholderEn: "e.g. Climate" },
  { name: "image", labelAr: "رابط الصورة", labelEn: "Image URL", kind: "url", lang: null, span: 2, placeholderEn: "https://images.unsplash.com/..." },
];

const programFields = (): FieldDef[] => [
  { name: "titleAr", labelAr: "اسم البرنامج (بالعربية)", labelEn: "Program Name (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "titleEn", labelAr: "اسم البرنامج (بالإنجليزية)", labelEn: "Program Name (English)", kind: "text", lang: "en", required: true },
  { name: "descriptionAr", labelAr: "وصف البرنامج (بالعربية)", labelEn: "Description (Arabic)", kind: "textarea", lang: "ar", required: true, span: 2 },
  { name: "descriptionEn", labelAr: "وصف البرنامج (بالإنجليزية)", labelEn: "Description (English)", kind: "textarea", lang: "en", required: true, span: 2 },
  { name: "longDescriptionAr", labelAr: "الوصف التفصيلي (عربي) — اختياري", labelEn: "Long Description (Arabic) — optional", kind: "textarea", lang: "ar", span: 2 },
  { name: "longDescriptionEn", labelAr: "الوصف التفصيلي (إنجليزي) — اختياري", labelEn: "Long Description (English) — optional", kind: "textarea", lang: "en", span: 2 },
  { name: "icon", labelAr: "أيقونة البرنامج", labelEn: "Program Icon", kind: "icon", lang: null, span: 2, hintAr: "هذه الأيقونة هي اللي بتظهر على كرت البرنامج في الموقع.", hintEn: "This icon is the one shown on the program card on the website." },
];

const initiativeFields = (): FieldDef[] => [
  { name: "titleAr", labelAr: "اسم المبادرة (بالعربية)", labelEn: "Initiative Name (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "titleEn", labelAr: "اسم المبادرة (بالإنجليزية)", labelEn: "Initiative Name (English)", kind: "text", lang: "en", required: true },
  { name: "descriptionAr", labelAr: "وصف المبادرة (بالعربية)", labelEn: "Description (Arabic)", kind: "textarea", lang: "ar", required: true, span: 2 },
  { name: "descriptionEn", labelAr: "وصف المبادرة (بالإنجليزية)", labelEn: "Description (English)", kind: "textarea", lang: "en", required: true, span: 2 },
  { name: "status", labelAr: "حالة المبادرة", labelEn: "Initiative Status", kind: "select", lang: null, options: INITIATIVE_STATUSES },
  { name: "progress", labelAr: "نسبة الإنجاز %", labelEn: "Progress %", kind: "number", lang: null, min: 0, max: 100, numberFallback: 50 },
  { name: "targetAr", labelAr: "هدف المبادرة (عربي)", labelEn: "Target (Arabic)", kind: "text", lang: null, placeholderAr: "مثال: غرس 10,000 شجرة" },
  { name: "targetEn", labelAr: "هدف المبادرة (إنجليزي)", labelEn: "Target (English)", kind: "text", lang: null, placeholderEn: "e.g. Plant 10,000 trees" },
  { name: "participantsCount", labelAr: "عدد المشاركين", labelEn: "Participants Count", kind: "number", lang: null, min: 0, max: 1000000, numberFallback: 0 },
  { name: "startDate", labelAr: "تاريخ البداية", labelEn: "Start Date", kind: "date", lang: null },
  { name: "categoryAr", labelAr: "الفئة (عربي)", labelEn: "Category (Arabic)", kind: "text", lang: null, required: true },
  { name: "categoryEn", labelAr: "الفئة (إنجليزي)", labelEn: "Category (English)", kind: "text", lang: null, required: true },
  { name: "image", labelAr: "رابط الصورة", labelEn: "Image URL", kind: "url", lang: null, span: 2 },
];

const courseFields = (): FieldDef[] => [
  { name: "titleAr", labelAr: "عنوان المساق (بالعربية)", labelEn: "Course Title (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "titleEn", labelAr: "عنوان المساق (بالإنجليزية)", labelEn: "Course Title (English)", kind: "text", lang: "en", required: true },
  { name: "descriptionAr", labelAr: "وصف المساق (بالعربية)", labelEn: "Description (Arabic)", kind: "textarea", lang: "ar", required: true, span: 2 },
  { name: "descriptionEn", labelAr: "وصف المساق (بالإنجليزية)", labelEn: "Description (English)", kind: "textarea", lang: "en", required: true, span: 2 },
  { name: "instructorAr", labelAr: "المحاضر (عربي)", labelEn: "Instructor (Arabic)", kind: "text", lang: null, required: true },
  { name: "instructorEn", labelAr: "المحاضر (إنجليزي)", labelEn: "Instructor (English)", kind: "text", lang: null, required: true },
  { name: "durationAr", labelAr: "المدة (عربي)", labelEn: "Duration (Arabic)", kind: "text", lang: null, required: true },
  { name: "durationEn", labelAr: "المدة (إنجليزي)", labelEn: "Duration (English)", kind: "text", lang: null, required: true },
  { name: "lessonsCount", labelAr: "عدد الدروس", labelEn: "Lessons Count", kind: "number", lang: null, min: 1, max: 100, numberFallback: 10 },
  { name: "categoryAr", labelAr: "الفئة (عربي)", labelEn: "Category (Arabic)", kind: "text", lang: null, required: true },
  { name: "categoryEn", labelAr: "الفئة (إنجليزي)", labelEn: "Category (English)", kind: "text", lang: null, required: true },
  { name: "image", labelAr: "رابط الصورة", labelEn: "Image URL", kind: "url", lang: null, span: 2 },
];

const opportunityFields = (): FieldDef[] => [
  { name: "titleAr", labelAr: "عنوان الفرصة (بالعربية)", labelEn: "Opportunity Title (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "titleEn", labelAr: "عنوان الفرصة (بالإنجليزية)", labelEn: "Opportunity Title (English)", kind: "text", lang: "en", required: true },
  { name: "descriptionAr", labelAr: "التفاصيل والشروط (بالعربية)", labelEn: "Description (Arabic)", kind: "textarea", lang: "ar", required: true, span: 2 },
  { name: "descriptionEn", labelAr: "التفاصيل والشروط (بالإنجليزية)", labelEn: "Description (English)", kind: "textarea", lang: "en", required: true, span: 2 },
  { name: "type", labelAr: "نوع الفرصة", labelEn: "Opportunity Type", kind: "select", lang: null, options: OPPORTUNITY_TYPES },
  { name: "locationAr", labelAr: "الموقع (عربي)", labelEn: "Location (Arabic)", kind: "text", lang: null, required: true },
  { name: "locationEn", labelAr: "الموقع (إنجليزي)", labelEn: "Location (English)", kind: "text", lang: null, required: true },
  { name: "postedDate", labelAr: "تاريخ النشر", labelEn: "Posted Date", kind: "date", lang: null },
];

const teamFields = (): FieldDef[] => [
  { name: "nameAr", labelAr: "الاسم (بالعربية)", labelEn: "Name (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "nameEn", labelAr: "الاسم (بالإنجليزية)", labelEn: "Name (English)", kind: "text", lang: "en", required: true },
  { name: "roleAr", labelAr: "المسمى الوظيفي (بالعربية)", labelEn: "Role (Arabic)", kind: "text", lang: "ar", required: true },
  { name: "roleEn", labelAr: "المسمى الوظيفي (بالإنجليزية)", labelEn: "Role (English)", kind: "text", lang: "en", required: true },
  { name: "image", labelAr: "رابط الصورة الشخصية", labelEn: "Avatar Image URL", kind: "url", lang: null, span: 2 },
];

// ============================================================
// Columns — أعمدة الجداول
// ============================================================

const mediaCell = (url: string, alt: string, isAvatar: boolean): React.ReactNode => {
  if (url) {
    return <img src={url} alt={alt} className="admin-cms-thumb" loading="lazy" />;
  }
  const icon = isAvatar ? <Users size={18} /> : <ImageIcon size={18} />;
  return (
    <div className={`admin-cms-thumb admin-cms-thumb-placeholder${isAvatar ? " admin-thumb-avatar" : ""}`}>
      {icon}
    </div>
  );
};

const eventColumns: ColumnDef<Event>[] = [
  {
    labelAr: "عنوان الفعالية", labelEn: "Event Title",
    render: (e, isAr) => <span className="admin-table-title">{isAr ? e.titleAr : e.titleEn}</span>,
  },
  {
    labelAr: "الموقع", labelEn: "Location",
    render: (e, isAr) => (isAr ? e.locationAr : e.locationEn) || "—",
  },
  {
    labelAr: "الفئة", labelEn: "Category",
    render: (e, isAr) => <span className="admin-badge green">{isAr ? e.categoryAr : e.categoryEn}</span>,
  },
  {
    labelAr: "التاريخ", labelEn: "Date", className: "admin-col-date",
    render: (e) => e.date || "—",
  },
];

const postColumns: ColumnDef<BlogPost>[] = [
  {
    labelAr: "الصورة", labelEn: "Image", className: "admin-col-image",
    render: (p) => mediaCell(p.image, p.titleEn, false),
  },
  {
    labelAr: "عنوان المقال", labelEn: "Article Title",
    render: (p, isAr) => <span className="admin-table-title">{isAr ? p.titleAr : p.titleEn}</span>,
  },
  {
    labelAr: "الفئة", labelEn: "Category",
    render: (p, isAr) => <span className="admin-badge blue">{isAr ? p.categoryAr : p.categoryEn}</span>,
  },
  { labelAr: "الكاتب", labelEn: "Author", render: (p, isAr) => (isAr ? p.authorAr : p.authorEn) },
  {
    labelAr: "التاريخ", labelEn: "Date", className: "admin-col-date",
    render: (p) => p.date || "—",
  },
];

const programColumns: ColumnDef<Program>[] = [
  {
    labelAr: "الأيقونة", labelEn: "Icon", className: "admin-col-icon",
    render: (pr) => {
      const ProgramIcon = resolveProgramIcon(pr.icon, pr.id);
      return (
        <span className="admin-program-icon-chip" aria-hidden="true">
          <ProgramIcon size={16} />
        </span>
      );
    },
  },
  {
    labelAr: "اسم البرنامج", labelEn: "Program Name",
    render: (pr, isAr) => <span className="admin-table-title">{isAr ? pr.titleAr : pr.titleEn}</span>,
  },
  {
    labelAr: "الوصف", labelEn: "Description", className: "admin-table-desc",
    render: (pr, isAr) => (isAr ? pr.descriptionAr : pr.descriptionEn),
  },
];

const initiativeColumns: ColumnDef<Initiative>[] = [
  {
    labelAr: "الصورة", labelEn: "Image", className: "admin-col-image",
    render: (ini) => mediaCell(ini.image, ini.titleEn, false),
  },
  {
    labelAr: "اسم المبادرة", labelEn: "Initiative Name",
    render: (ini, isAr) => <span className="admin-table-title">{isAr ? ini.titleAr : ini.titleEn}</span>,
  },
  {
    labelAr: "الحالة", labelEn: "Status",
    render: (ini, isAr) => (
      <span className={`admin-badge ${ini.status === "completed" ? "blue" : ini.status === "upcoming" ? "amber" : "green"}`}>
        {initiativeStatusLabel(ini.status, isAr)}
      </span>
    ),
  },
  {
    labelAr: "الإنجاز", labelEn: "Progress",
    render: (ini) => (
      <div className="admin-cms-progress-cell">
        <div className="admin-cms-progress-bar">
          <div className="admin-cms-progress-fill" style={{ width: `${ini.progress}%` }} />
        </div>
        <span className="admin-progress-label">{ini.progress}%</span>
      </div>
    ),
  },
  {
    labelAr: "الفئة", labelEn: "Category",
    render: (ini, isAr) => <span className="admin-badge blue">{isAr ? ini.categoryAr : ini.categoryEn}</span>,
  },
];

const courseColumns: ColumnDef<Course>[] = [
  {
    labelAr: "الصورة", labelEn: "Image", className: "admin-col-image",
    render: (c) => mediaCell(c.image, c.titleEn, false),
  },
  {
    labelAr: "اسم المساق", labelEn: "Course Title",
    render: (c, isAr) => <span className="admin-table-title">{isAr ? c.titleAr : c.titleEn}</span>,
  },
  { labelAr: "المحاضر", labelEn: "Instructor", render: (c, isAr) => (isAr ? c.instructorAr : c.instructorEn) },
  { labelAr: "المدة", labelEn: "Duration", render: (c, isAr) => (isAr ? c.durationAr : c.durationEn) },
  { labelAr: "الدروس", labelEn: "Lessons", render: (c) => c.lessonsCount },
];

const opportunityColumns: ColumnDef<Opportunity>[] = [
  {
    labelAr: "عنوان الفرصة", labelEn: "Opportunity Title",
    render: (o, isAr) => <span className="admin-table-title">{isAr ? o.titleAr : o.titleEn}</span>,
  },
  {
    labelAr: "النوع", labelEn: "Type",
    render: (o, isAr) => <span className="admin-badge blue">{isAr ? o.typeAr : o.typeEn}</span>,
  },
  { labelAr: "الموقع", labelEn: "Location", render: (o, isAr) => (isAr ? o.locationAr : o.locationEn) },
  {
    labelAr: "التاريخ", labelEn: "Date", className: "admin-col-date",
    render: (o) => o.postedDate || "—",
  },
];

const teamColumns: ColumnDef<TeamMember>[] = [
  {
    labelAr: "الصورة", labelEn: "Avatar", className: "admin-col-image",
    render: (tm) => mediaCell(tm.image, tm.nameEn, true),
  },
  {
    labelAr: "الاسم", labelEn: "Name",
    render: (tm, isAr) => <span className="admin-table-title">{isAr ? tm.nameAr : tm.nameEn}</span>,
  },
  { labelAr: "المسمى الوظيفي", labelEn: "Role", render: (tm, isAr) => (isAr ? tm.roleAr : tm.roleEn) },
];

// ============================================================
// Filters
// ============================================================

const initiativeFilter: FilterDef<Initiative> = {
  labelAr: "تصفية بالحالة",
  labelEn: "Filter by status",
  options: INITIATIVE_STATUSES,
  value: (ini) => ini.status ?? "active",
};

const opportunityFilter: FilterDef<Opportunity> = {
  labelAr: "تصفية بالنوع",
  labelEn: "Filter by type",
  options: OPPORTUNITY_TYPES,
  value: (o) => o.typeEn,
};

// ============================================================
// Section definitions
// ============================================================

export const eventSection: SectionDef<Event, Omit<Event, "id" | "registeredCount">> = {
  id: "events",
  labelAr: "الفعاليات",
  labelEn: "Events",
  icon: Calendar,
  displayName: (e, isAr) => (isAr ? e.titleAr : e.titleEn),
  searchText: (e, isAr) => `${isAr ? `${e.titleAr} ${e.locationAr}` : `${e.titleEn} ${e.locationEn}`}`,
  selectItems: (state) => state.events,
  create: (payload) => useCMSStore.getState().createEvent(payload),
  update: (id, payload) => useCMSStore.getState().updateEvent(id, payload),
  remove: (id) => useCMSStore.getState().deleteEvent(id),
  emptyForm: () => ({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    date: toLocalDateInput(), locationEn: "", locationAr: "", categoryEn: "", categoryAr: "",
  }),
  formOf: (e) => ({
    titleEn: e.titleEn, titleAr: e.titleAr,
    descriptionEn: e.descriptionEn, descriptionAr: e.descriptionAr,
    date: e.date, locationEn: e.locationEn, locationAr: e.locationAr,
    categoryEn: e.categoryEn, categoryAr: e.categoryAr,
  }),
  validate: (form, isAr) => requireBothLanguages(form, "title", isAr, "العنوان", "title"),
  toPayload: (form) => ({
    titleEn: str(form, "titleEn").trim(),
    titleAr: str(form, "titleAr").trim(),
    descriptionEn: str(form, "descriptionEn").trim(),
    descriptionAr: str(form, "descriptionAr").trim(),
    date: str(form, "date").trim(),
    locationEn: str(form, "locationEn").trim(),
    locationAr: str(form, "locationAr").trim(),
    categoryEn: str(form, "categoryEn").trim(),
    categoryAr: str(form, "categoryAr").trim(),
  }),
  fields: eventFields(),
  columns: eventColumns,
};

export const postSection: SectionDef<BlogPost, Omit<BlogPost, "id">> = {
  id: "articles",
  labelAr: "المقالات",
  labelEn: "Articles",
  icon: FileText,
  displayName: (p, isAr) => (isAr ? p.titleAr : p.titleEn),
  searchText: (p, isAr) =>
    `${isAr ? `${p.titleAr} ${p.authorAr}` : `${p.titleEn} ${p.authorEn}`} ${p.categoryEn}`,
  selectItems: (state) => state.posts,
  create: (payload) => useCMSStore.getState().createBlogPost(payload),
  update: (id, payload) => useCMSStore.getState().updateBlogPost(id, payload),
  remove: (id) => useCMSStore.getState().deleteBlogPost(id),
  emptyForm: () => ({
    titleEn: "", titleAr: "", excerptEn: "", excerptAr: "",
    contentEn: "", contentAr: "", image: "", date: toLocalDateInput(),
    authorEn: "Climatify Admin", authorAr: "مسؤول كلايمتيفاي",
    categoryEn: "", categoryAr: "",
  }),
  formOf: (p) => ({
    titleEn: p.titleEn, titleAr: p.titleAr,
    excerptEn: p.excerptEn, excerptAr: p.excerptAr,
    contentEn: p.contentEn, contentAr: p.contentAr,
    image: p.image, date: p.date,
    authorEn: p.authorEn, authorAr: p.authorAr,
    categoryEn: p.categoryEn, categoryAr: p.categoryAr,
  }),
  validate: (form, isAr) => requireBothLanguages(form, "title", isAr, "العنوان", "title"),
  toPayload: (form) => ({
    titleEn: str(form, "titleEn").trim(),
    titleAr: str(form, "titleAr").trim(),
    excerptEn: str(form, "excerptEn").trim(),
    excerptAr: str(form, "excerptAr").trim(),
    contentEn: str(form, "contentEn"),
    contentAr: str(form, "contentAr"),
    image: sanitizeUrl(str(form, "image").trim()),
    date: str(form, "date").trim(),
    authorEn: str(form, "authorEn").trim(),
    authorAr: str(form, "authorAr").trim(),
    categoryEn: str(form, "categoryEn").trim(),
    categoryAr: str(form, "categoryAr").trim(),
  }),
  fields: postFields(),
  previewField: "image",
  columns: postColumns,
};

export const programSection: SectionDef<Program, Omit<Program, "id">> = {
  id: "programs",
  labelAr: "البرامج",
  labelEn: "Programs",
  icon: LayoutGrid,
  displayName: (pr, isAr) => (isAr ? pr.titleAr : pr.titleEn),
  searchText: (pr, isAr) => (isAr ? pr.titleAr : pr.titleEn),
  selectItems: (state) => state.programs,
  create: (payload) => useCMSStore.getState().createProgram(payload),
  update: (id, payload) => useCMSStore.getState().updateProgram(id, payload),
  remove: (id) => useCMSStore.getState().deleteProgram(id),
  emptyForm: () => ({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    longDescriptionEn: "", longDescriptionAr: "", icon: "Monitor",
  }),
  formOf: (pr) => ({
    titleEn: pr.titleEn, titleAr: pr.titleAr,
    descriptionEn: pr.descriptionEn, descriptionAr: pr.descriptionAr,
    longDescriptionEn: pr.longDescriptionEn ?? "",
    longDescriptionAr: pr.longDescriptionAr ?? "",
    icon: pr.icon,
  }),
  validate: (form, isAr) => requireBothLanguages(form, "title", isAr, "العنوان", "title"),
  toPayload: (form) => ({
    titleEn: str(form, "titleEn").trim(),
    titleAr: str(form, "titleAr").trim(),
    descriptionEn: str(form, "descriptionEn").trim(),
    descriptionAr: str(form, "descriptionAr").trim(),
    longDescriptionEn: str(form, "longDescriptionEn").trim(),
    longDescriptionAr: str(form, "longDescriptionAr").trim(),
    icon: str(form, "icon") || "Monitor",
  }),
  fields: programFields(),
  columns: programColumns,
};

export const initiativeSection: SectionDef<Initiative, Omit<Initiative, "id">> = {
  id: "initiatives",
  labelAr: "المبادرات",
  labelEn: "Initiatives",
  icon: Target,
  displayName: (ini, isAr) => (isAr ? ini.titleAr : ini.titleEn),
  searchText: (ini, isAr) => (isAr ? ini.titleAr : ini.titleEn),
  filter: initiativeFilter,
  selectItems: (state) => state.initiatives,
  create: (payload) => useCMSStore.getState().createInitiative(payload),
  update: (id, payload) => useCMSStore.getState().updateInitiative(id, payload),
  remove: (id) => useCMSStore.getState().deleteInitiative(id),
  emptyForm: () => ({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    image: "", categoryEn: "", categoryAr: "", progress: 50,
    targetEn: "", targetAr: "", status: "active",
    participantsCount: "", startDate: "",
  }),
  formOf: (ini) => ({
    titleEn: ini.titleEn, titleAr: ini.titleAr,
    descriptionEn: ini.descriptionEn, descriptionAr: ini.descriptionAr,
    image: ini.image, categoryEn: ini.categoryEn, categoryAr: ini.categoryAr,
    progress: ini.progress, targetEn: ini.targetEn, targetAr: ini.targetAr,
    status: ini.status ?? "active",
    participantsCount: ini.participantsCount != null ? String(ini.participantsCount) : "",
    startDate: ini.startDate ?? "",
  }),
  validate: (form, isAr) => requireBothLanguages(form, "title", isAr, "العنوان", "title"),
  toPayload: (form) => ({
    titleEn: str(form, "titleEn").trim(),
    titleAr: str(form, "titleAr").trim(),
    descriptionEn: str(form, "descriptionEn").trim(),
    descriptionAr: str(form, "descriptionAr").trim(),
    image: sanitizeUrl(str(form, "image").trim()),
    categoryEn: str(form, "categoryEn").trim(),
    categoryAr: str(form, "categoryAr").trim(),
    progress: clampIntOrNull(str(form, "progress"), 0, 100) ?? 50,
    targetEn: str(form, "targetEn").trim(),
    targetAr: str(form, "targetAr").trim(),
    status: initStatusOf(form),
    participantsCount: clampIntOrNull(str(form, "participantsCount"), 0, 1000000) ?? undefined,
    startDate: str(form, "startDate").trim() || undefined,
  }),
  fields: initiativeFields(),
  previewField: "image",
  columns: initiativeColumns,
};

export const courseSection: SectionDef<Course, Omit<Course, "id">> = {
  id: "courses",
  labelAr: "المساقات",
  labelEn: "Courses",
  icon: GraduationCap,
  displayName: (c, isAr) => (isAr ? c.titleAr : c.titleEn),
  searchText: (c, isAr) =>
    `${isAr ? `${c.titleAr} ${c.instructorAr}` : `${c.titleEn} ${c.instructorEn}`}`,
  selectItems: (state) => state.courses,
  create: (payload) => useCMSStore.getState().createCourse(payload),
  update: (id, payload) => useCMSStore.getState().updateCourse(id, payload),
  remove: (id) => useCMSStore.getState().deleteCourse(id),
  emptyForm: () => ({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    instructorEn: "", instructorAr: "", durationEn: "", durationAr: "",
    lessonsCount: 10, categoryEn: "", categoryAr: "", image: "",
  }),
  formOf: (c) => ({
    titleEn: c.titleEn, titleAr: c.titleAr,
    descriptionEn: c.descriptionEn, descriptionAr: c.descriptionAr,
    instructorEn: c.instructorEn, instructorAr: c.instructorAr,
    durationEn: c.durationEn, durationAr: c.durationAr,
    lessonsCount: c.lessonsCount, categoryEn: c.categoryEn, categoryAr: c.categoryAr,
    image: c.image,
  }),
  validate: (form, isAr) => requireBothLanguages(form, "title", isAr, "العنوان", "title"),
  toPayload: (form) => ({
    titleEn: str(form, "titleEn").trim(),
    titleAr: str(form, "titleAr").trim(),
    descriptionEn: str(form, "descriptionEn").trim(),
    descriptionAr: str(form, "descriptionAr").trim(),
    instructorEn: str(form, "instructorEn").trim(),
    instructorAr: str(form, "instructorAr").trim(),
    durationEn: str(form, "durationEn").trim(),
    durationAr: str(form, "durationAr").trim(),
    lessonsCount: clampIntOrNull(str(form, "lessonsCount"), 1, 100) ?? 10,
    categoryEn: str(form, "categoryEn").trim(),
    categoryAr: str(form, "categoryAr").trim(),
    image: sanitizeUrl(str(form, "image").trim()),
  }),
  fields: courseFields(),
  previewField: "image",
  columns: courseColumns,
};

export const opportunitySection: SectionDef<Opportunity, Omit<Opportunity, "id">> = {
  id: "opportunities",
  labelAr: "الفرص",
  labelEn: "Opportunities",
  icon: Briefcase,
  displayName: (o, isAr) => (isAr ? o.titleAr : o.titleEn),
  searchText: (o, isAr) => (isAr ? `${o.titleAr} ${o.locationAr}` : `${o.titleEn} ${o.locationEn}`),
  filter: opportunityFilter,
  selectItems: (state) => state.opportunities,
  create: (payload) => useCMSStore.getState().createOpportunity(payload),
  update: (id, payload) => useCMSStore.getState().updateOpportunity(id, payload),
  remove: (id) => useCMSStore.getState().deleteOpportunity(id),
  emptyForm: () => ({
    titleEn: "", titleAr: "", descriptionEn: "", descriptionAr: "",
    typeEn: "Volunteering", typeAr: "تطوع",
    locationEn: "", locationAr: "", postedDate: toLocalDateInput(),
  }),
  formOf: (o) => ({
    titleEn: o.titleEn, titleAr: o.titleAr,
    descriptionEn: o.descriptionEn, descriptionAr: o.descriptionAr,
    type: o.typeEn,
    locationEn: o.locationEn, locationAr: o.locationAr,
    postedDate: o.postedDate,
  }),
  validate: (form, isAr) => requireBothLanguages(form, "title", isAr, "العنوان", "title"),
  toPayload: (form) => {
    const selected = OPPORTUNITY_TYPES.find((t) => t.value === str(form, "type")) ?? OPPORTUNITY_TYPES[0];
    return {
      titleEn: str(form, "titleEn").trim(),
      titleAr: str(form, "titleAr").trim(),
      descriptionEn: str(form, "descriptionEn").trim(),
      descriptionAr: str(form, "descriptionAr").trim(),
      typeEn: selected?.value ?? "Volunteering",
      typeAr: selected?.labelAr ?? "تطوع",
      locationEn: str(form, "locationEn").trim(),
      locationAr: str(form, "locationAr").trim(),
      postedDate: str(form, "postedDate").trim(),
    };
  },
  fields: opportunityFields(),
  columns: opportunityColumns,
};

export const teamSection: SectionDef<TeamMember, Omit<TeamMember, "id">> = {
  id: "team",
  labelAr: "فريق العمل",
  labelEn: "Team",
  icon: Users,
  displayName: (tm, isAr) => (isAr ? tm.nameAr : tm.nameEn),
  searchText: (tm, isAr) =>
    `${isAr ? `${tm.nameAr} ${tm.roleAr}` : `${tm.nameEn} ${tm.roleEn}`}`,
  selectItems: (state) => state.team,
  create: (payload) => useCMSStore.getState().createTeamMember(payload),
  update: (id, payload) => useCMSStore.getState().updateTeamMember(id, payload),
  remove: (id) => useCMSStore.getState().deleteTeamMember(id),
  emptyForm: () => ({ nameEn: "", nameAr: "", roleEn: "", roleAr: "", image: "" }),
  formOf: (tm) => ({
    nameEn: tm.nameEn, nameAr: tm.nameAr,
    roleEn: tm.roleEn, roleAr: tm.roleAr, image: tm.image,
  }),
  validate: (form, isAr) => requireBothLanguages(form, "name", isAr, "الاسم", "name"),
  toPayload: (form) => ({
    nameEn: str(form, "nameEn").trim(),
    nameAr: str(form, "nameAr").trim(),
    roleEn: str(form, "roleEn").trim(),
    roleAr: str(form, "roleAr").trim(),
    image: sanitizeUrl(str(form, "image").trim()),
  }),
  fields: teamFields(),
  previewField: "image",
  columns: teamColumns,
};
