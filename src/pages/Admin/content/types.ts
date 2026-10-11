import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { StoreActionResult } from "../../../types";
import type {
  Event, BlogPost, Program, Initiative, Course, Opportunity, TeamMember
} from "../../../types";

/**
 * نموذج إدخال الحقول في محرر المحتوى — حالة واجهة خام (strings/numbers) قبل
 * التحقق. الفصل بين هذا وبين الـ payload المُرسل للسيرفر يفرض أن كل قسم
 * يعرّف نقطة تحقق واحدة (toPayload) بدل ثقة صامتة في مدخلات المستخدم.
 */
export type FormRecord = Record<string, string | number | undefined>;

export type FieldKind = "text" | "textarea" | "url" | "number" | "date" | "select" | "icon";

/** null = حقل عام (تاريخ، حالة، صورة...) يُعرض أعلى لوحتي اللغة. */
export type FieldLang = "ar" | "en" | null;

export interface FieldOption {
  value: string;
  labelEn: string;
  labelAr: string;
}

export interface FieldDef {
  name: string;
  labelEn: string;
  labelAr: string;
  kind: FieldKind;
  lang: FieldLang;
  required?: boolean;
  /** 2 = يمتد بعرض اللوحة/الشبكة كاملة (نصوص طويلة). */
  span?: 1 | 2;
  placeholderEn?: string;
  placeholderAr?: string;
  hintEn?: string;
  hintAr?: string;
  options?: readonly FieldOption[];
  min?: number;
  max?: number;
  /** قيمة تُعتمد لو أدخل المستخدم نصاً غير رقمي في حقل رقمي. */
  numberFallback?: number;
}

export interface ColumnDef<TItem> {
  labelEn: string;
  labelAr: string;
  /** كلاس عرض خاص (أعمدة الصور/التواريخ/الإجراءات في admin.css). */
  className?: string;
  render: (item: TItem, isAr: boolean) => ReactNode;
}

export interface FilterDef<TItem> {
  labelEn: string;
  labelAr: string;
  options: readonly FieldOption[];
  value: (item: TItem) => string;
}

/** حالة المحتوى من المخزن — subset مقصود يقرأ منه كل تعريف قسم. */
export interface CMSContentState {
  events: Event[];
  posts: BlogPost[];
  programs: Program[];
  initiatives: Initiative[];
  courses: Course[];
  opportunities: Opportunity[];
  team: TeamMember[];
}

/**
 * عقد قسم المحتوى: جدول + بحث + فلتر + محرر، كل شيء تصريحي.
 * ContentWorkspace مكون عام يُبنى لكل قسم بنوعيه الصريحين (TItem, TPayload)،
 * فلا حاجة لأي cast ولا payload غير مكتوب.
 */
export interface SectionDef<TItem extends { id: string }, TPayload> {
  id: string;
  labelEn: string;
  labelAr: string;
  icon: LucideIcon;
  /** الاسم المعروض في حوار تأكيد الحذف. */
  displayName: (item: TItem, isAr: boolean) => string;
  /** نص البحث المُجمّع — البحث في اللغة المعروضة. */
  searchText: (item: TItem, isAr: boolean) => string;
  filter?: FilterDef<TItem>;

  selectItems: (state: CMSContentState) => TItem[];
  create: (payload: TPayload) => Promise<StoreActionResult>;
  update: (id: string, payload: Partial<TPayload>) => Promise<StoreActionResult>;
  remove: (id: string) => Promise<StoreActionResult>;

  emptyForm: () => FormRecord;
  formOf: (item: TItem) => FormRecord;
  /** فحص سريع قبل الإرسال — يُرجع رسالة جاهزة للعرض أو null. */
  validate: (form: FormRecord, isAr: boolean) => string | null;
  /** الحدود الفاصلة: FormRecord الخام → payload مكتوب ونظيف يُرسل للسيرفر. */
  toPayload: (form: FormRecord) => TPayload;
  fields: readonly FieldDef[];
  /** حقل الصورة (إن وجد) لعرض معاينة حية داخل المحرر. */
  previewField?: string;
  columns: readonly ColumnDef<TItem>[];
}
