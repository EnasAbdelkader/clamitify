import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Plus, Edit2, Trash2, X, Loader2, AlertTriangle, RefreshCw, Search,
  Layers, CheckCircle2, Globe,
} from "lucide-react";
import { useLanguage } from "../../../context/LanguageContext";
import { useCMSStore } from "../../../store/useCMSStore";
import { resolveProgramIcon } from "../../../components/ProgramCards/ProgramCards";
import { ConfirmDialog } from "../ConfirmDialog";
import { PROGRAM_ICONS } from "./sections";
import type { FieldDef, FormRecord, SectionDef } from "./types";

/**
 * مساحة عمل قسم واحد من أقسام المحتوى: جدول + بحث + فلتر + محرر.
 * المكوّن عام على (TItem, TPayload) ويُبنى لكل قسم بنوعيه الصريحين في
 * AdminContent — فالحقول والأعمدة كلها مكتوبة بلا أي cast.
 *
 * المحرر يستبدل تبويبات general/ar/en القديمة بلوحتي لغة متجاورتين، حتى
 * يقدر المحرّر يشوف النسختين مع بعض بدل القفز بين التبويبات.
 */
export function ContentWorkspace<TItem extends { id: string }, TPayload>({
  section,
}: {
  section: SectionDef<TItem, TPayload>;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormRecord>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const modalTitleId = useId();

  const items = useCMSStore((state) => section.selectItems(state));
  const loading = useCMSStore((state) => state.loading);
  const failedResources = useCMSStore((state) => state.failedResources);
  const loadCMSContent = useCMSStore((state) => state.loadCMSContent);

  useEffect(() => {
    void loadCMSContent();
  }, [loadCMSContent]);

  // المرجع الذي فُتح به المحرر — أي انحراف عنه يعني تغييرات غير محفوظة.
  const [baseline, setBaseline] = useState<string | null>(null);
  const isDirty = baseline !== null && JSON.stringify(form) !== baseline;

  const closeEditor = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
    setBaseline(null);
  }, []);

  /** كل منافذ إغلاق المحرر تمر من هنا: المتغيّرات غير المحفوظة تطلب تأكيداً. */
  const requestClose = useCallback(() => {
    if (isSubmitting) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    closeEditor();
  }, [isDirty, isSubmitting, closeEditor]);

  // Escape يقفل المحرر عبر نفس الحارس — لكن ليس أثناء الحفظ.
  useEffect(() => {
    if (!showForm || isSubmitting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showForm, isSubmitting, requestClose]);

  const handleOpenAdd = () => {
    setRowError(null);
    setEditingId(null);
    setFormError(null);
    const fresh = section.emptyForm();
    setForm(fresh);
    setBaseline(JSON.stringify(fresh));
    setShowForm(true);
  };

  const handleOpenEdit = (item: TItem) => {
    setRowError(null);
    setEditingId(item.id);
    setFormError(null);
    const existing = section.formOf(item);
    setForm(existing);
    setBaseline(JSON.stringify(existing));
    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const validationError = section.validate(form, isAr);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = section.toPayload(form);
      const res = editingId
        ? await section.update(editingId, payload)
        : await section.create(payload);

      if (res.ok) {
        closeEditor();
      } else {
        setFormError(res.error ?? (isAr ? "تعذّر الحفظ." : "Save failed."));
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : (isAr ? "حدث خطأ غير متوقع." : "Unexpected error."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const performDelete = async (id: string) => {
    setPendingDeleteId(null);
    setDeletingId(id);
    setRowError(null);
    try {
      const res = await section.remove(id);
      if (!res.ok) setRowError(res.error ?? (isAr ? "تعذّر الحذف." : "Failed to delete item."));
    } catch (err) {
      setRowError(err instanceof Error ? err.message : (isAr ? "خطأ في الحذف." : "Error deleting item."));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filter = section.filter;
    return items.filter((item) => {
      const matchesQuery = !q || section.searchText(item, isAr).toLowerCase().includes(q);
      const matchesFilter =
        !filter || filterCategory === "all" || filter.value(item) === filterCategory;
      return matchesQuery && matchesFilter;
    });
  }, [items, searchQuery, filterCategory, section, isAr]);

  const pendingDeleteName = useMemo(() => {
    if (pendingDeleteId === null) return null;
    const target = items.find((item) => item.id === pendingDeleteId);
    return target ? section.displayName(target, isAr) : null;
  }, [pendingDeleteId, items, section, isAr]);

  const generalFields = section.fields.filter((f) => f.lang === null);
  const arabicFields = section.fields.filter((f) => f.lang === "ar");
  const englishFields = section.fields.filter((f) => f.lang === "en");

  const renderField = (field: FieldDef) => {
    const inputId = `cms-${section.id}-${field.name}`;
    const rawValue = form[field.name];
    const raw = typeof rawValue === "string" ? rawValue : rawValue === undefined ? "" : String(rawValue);
    const setValue = (next: string) => setForm((prev) => ({ ...prev, [field.name]: next }));

    let control: React.ReactNode;
    switch (field.kind) {
      case "textarea":
        control = (
          <textarea
            id={inputId}
            className="admin-form-input"
            value={raw}
            onChange={(e) => setValue(e.target.value)}
            required={field.required}
            disabled={isSubmitting}
          />
        );
        break;

      case "url":
        control = (
          <input
            id={inputId}
            type="url"
            className="admin-form-input"
            placeholder={isAr ? field.placeholderAr : field.placeholderEn}
            value={raw}
            onChange={(e) => setValue(e.target.value)}
            disabled={isSubmitting}
          />
        );
        break;

      case "number":
        control = (
          <input
            id={inputId}
            type="number"
            className="admin-form-input"
            min={field.min}
            max={field.max}
            value={raw}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              const clamped = Number.isFinite(parsed)
                ? String(Math.min(field.max ?? 1000000, Math.max(field.min ?? 0, Math.round(parsed))))
                : String(field.numberFallback ?? 0);
              setValue(e.target.value === "" ? "" : clamped);
            }}
            disabled={isSubmitting}
          />
        );
        break;

      case "date":
        control = (
          <input
            id={inputId}
            type="date"
            className="admin-form-input"
            value={raw}
            onChange={(e) => setValue(e.target.value)}
            required={field.required}
            disabled={isSubmitting}
          />
        );
        break;

      case "select":
        control = (
          <select
            id={inputId}
            className="admin-form-input"
            value={raw}
            onChange={(e) => setValue(e.target.value)}
            disabled={isSubmitting}
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {isAr ? option.labelAr : option.labelEn}
              </option>
            ))}
          </select>
        );
        break;

      case "icon":
        control = (
          <div className="admin-icon-picker" role="radiogroup" aria-label={isAr ? "اختيار أيقونة البرنامج" : "Program icon selection"}>
            {PROGRAM_ICONS.map((name) => {
              const Icon = resolveProgramIcon(name);
              const selected = raw === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`admin-icon-picker-item ${selected ? "active" : ""}`}
                  onClick={() => setValue(name)}
                  disabled={isSubmitting}
                  title={name}
                >
                  <Icon size={20} />
                  <span>{name}</span>
                  {selected && <CheckCircle2 size={12} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        );
        break;

      default:
        control = (
          <input
            id={inputId}
            type="text"
            className="admin-form-input"
            placeholder={isAr ? field.placeholderAr : field.placeholderEn}
            value={raw}
            onChange={(e) => setValue(e.target.value)}
            required={field.required}
            disabled={isSubmitting}
          />
        );
    }

    return (
      <div
        key={field.name}
        className={`admin-form-group${field.span === 2 ? " admin-form-group-wide" : ""}`}
      >
        <label className="admin-form-label" htmlFor={inputId}>
          {isAr ? field.labelAr : field.labelEn}
          {field.required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {control}
        {(isAr ? field.hintAr : field.hintEn) ? (
          <p className="admin-form-hint">{isAr ? field.hintAr : field.hintEn}</p>
        ) : null}
      </div>
    );
  };

  const previewUrl =
    section.previewField && typeof form[section.previewField] === "string"
      ? (form[section.previewField] as string)
      : "";

  const filter = section.filter;

  return (
    <div>
      {rowError && (
        <div className="admin-alert error" role="alert">
          <AlertTriangle size={16} />
          <span>{rowError}</span>
        </div>
      )}

      {failedResources.length > 0 && (
        <div className="admin-alert warning" role="alert">
          <AlertTriangle size={16} />
          <span>
            {isAr
              ? `بعض البيانات لم تُحمل من السيرفر: ${failedResources.join("، ")}`
              : `Some content resources could not be loaded: ${failedResources.join(", ")}`}
          </span>
          <span className="admin-alert-actions">
            <button type="button" className="admin-add-btn sm" onClick={() => void loadCMSContent()}>
              <RefreshCw size={14} />
              <span>{isAr ? "إعادة التحميل" : "Retry"}</span>
            </button>
          </span>
        </div>
      )}

      {/* Search & Action Toolbar */}
      <div className="admin-cms-toolbar">
        <div className="admin-cms-toolbar-left">
          <div className="admin-cms-search-box">
            <Search size={16} className="admin-cms-search-icon" />
            <input
              type="search"
              className="admin-cms-search-input"
              placeholder={
                isAr
                  ? `بحث في ${isAr ? section.labelAr : section.labelEn}...`
                  : `Search ${section.labelEn}...`
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={isAr ? `بحث في ${section.labelAr}` : `Search ${section.labelEn}`}
            />
          </div>

          {filter && (
            <select
              className="admin-cms-filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label={isAr ? filter.labelAr : filter.labelEn}
            >
              <option value="all">{isAr ? "الكل" : "All"}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {isAr ? option.labelAr : option.labelEn}
                </option>
              ))}
            </select>
          )}
        </div>

        <button type="button" className="admin-add-btn" onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>{isAr ? `إضافة إلى ${section.labelAr}` : `Add to ${section.labelEn}`}</span>
        </button>
      </div>

      {/* Content Table Card */}
      <div className="admin-card admin-table-card">
        {loading ? (
          <div className="admin-loading-block">
            <Loader2 size={22} className="admin-spinner" />
            <span>{isAr ? "جاري تحميل البيانات..." : "Loading content items..."}</span>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {section.columns.map((column) => (
                    <th key={column.labelEn} className={column.className}>
                      {isAr ? column.labelAr : column.labelEn}
                    </th>
                  ))}
                  <th className="admin-col-actions">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    {section.columns.map((column) => (
                      <td
                        key={column.labelEn}
                        data-label={isAr ? column.labelAr : column.labelEn}
                        className={column.className}
                      >
                        {column.render(item, isAr)}
                      </td>
                    ))}
                    <td data-label={isAr ? "إجراءات" : "Actions"}>
                      <div className="admin-table-actions">
                        <button
                          className="admin-action-btn edit"
                          onClick={() => handleOpenEdit(item)}
                          title={isAr ? "تعديل" : "Edit"}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="admin-action-btn delete"
                          onClick={() => {
                            setRowError(null);
                            setPendingDeleteId(item.id);
                          }}
                          disabled={deletingId === item.id}
                          title={isAr ? "حذف" : "Delete"}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={section.columns.length + 1} className="admin-table-empty-cell">
                      <div className="admin-empty-state compact">
                        <div className="icon"><Layers size={32} /></div>
                        <p>
                          {isAr
                            ? "لا توجد عناصر مضافة بعد أو تطابق البحث."
                            : "No content items match your search or filter."}
                        </p>
                        {searchQuery && (
                          <div className="admin-empty-actions">
                            <button
                              type="button"
                              className="admin-btn-cancel sm"
                              onClick={() => setSearchQuery("")}
                            >
                              {isAr ? "إلغاء البحث" : "Clear Search"}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal — لوحتا لغة متجاورتان بدل التبويبات */}
      {showForm && (
        <div className="admin-cms-modal-overlay" onClick={requestClose}>
          <div
            className="admin-cms-modal wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-cms-modal-header">
              <div className="admin-cms-modal-heading">
                <span className={`admin-cms-modal-glyph ${editingId ? "" : "create"}`} aria-hidden="true">
                  {editingId ? <Edit2 size={17} /> : <Plus size={17} />}
                </span>
                <div>
                  <div className="admin-cms-modal-title" id={modalTitleId}>
                    {editingId
                      ? (isAr ? `تعديل ${section.labelAr}` : `Edit ${section.labelEn}`)
                      : (isAr ? `إضافة إلى ${section.labelAr}` : `Add to ${section.labelEn}`)}
                  </div>
                  <p className="admin-cms-modal-subtitle">
                    {isAr
                      ? "عدّل النسختين العربية والإنجليزية جنبًا إلى جنب ثم احفظ."
                      : "Edit the Arabic and English versions side by side, then save."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="admin-action-btn neutral"
                onClick={requestClose}
                disabled={isSubmitting}
                aria-label={isAr ? "إغلاق النافذة" : "Close dialog"}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="admin-cms-modal-body">
                {formError && (
                  <div className="admin-alert error" role="alert">
                    <AlertTriangle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {generalFields.length > 0 && (
                  <div className="admin-cms-general-grid">
                    {generalFields.map(renderField)}
                  </div>
                )}

                <div className="admin-cms-lang-panels">
                  <div className="admin-cms-lang-panel" dir="rtl">
                    <div className="admin-cms-lang-panel-head">
                      <Globe size={14} aria-hidden="true" />
                      <span>العربية</span>
                    </div>
                    {arabicFields.map(renderField)}
                  </div>
                  <div className="admin-cms-lang-panel" dir="ltr">
                    <div className="admin-cms-lang-panel-head">
                      <Globe size={14} aria-hidden="true" />
                      <span>English</span>
                    </div>
                    {englishFields.map(renderField)}
                  </div>
                </div>

                {section.previewField && previewUrl && (
                  <div className="admin-cms-image-preview-box">
                    <img
                      src={previewUrl}
                      alt={isAr ? "معاينة الصورة" : "Image preview"}
                      onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </div>

              <div className="admin-cms-modal-footer">
                <button type="button" className="admin-btn-cancel" onClick={requestClose} disabled={isSubmitting}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button type="submit" className="admin-btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="admin-btn-inner">
                      <Loader2 size={16} className="admin-spinner" />
                      {isAr ? "جاري الحفظ..." : "Saving..."}
                    </span>
                  ) : (
                    <span className="admin-btn-inner">
                      <CheckCircle2 size={16} />
                      {editingId ? (isAr ? "تحديث المحتوى" : "Update Content") : (isAr ? "حفظ ونشر" : "Publish Item")}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={isAr ? "تأكيد الحذف" : "Confirm Deletion"}
        message={
          pendingDeleteName
            ? (isAr
                ? `هل أنت متأكد من حذف «${pendingDeleteName}»؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete “${pendingDeleteName}”? This action cannot be undone.`)
            : (isAr ? "هل أنت متأكد من حذف هذا العنصر؟" : "Are you sure you want to delete this item?")
        }
        confirmLabel={isAr ? "حذف نهائي" : "Delete Permanently"}
        cancelLabel={isAr ? "إلغاء" : "Cancel"}
        busy={deletingId !== null}
        onConfirm={() => {
          if (pendingDeleteId !== null) void performDelete(pendingDeleteId);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* Discard Unsaved Changes */}
      <ConfirmDialog
        open={confirmDiscard}
        title={isAr ? "تغييرات غير محفوظة" : "Unsaved changes"}
        message={
          isAr
            ? "عندك تعديلات لم تُحفظ بعد. هل تريد الخروج بدون حفظ؟"
            : "You have unsaved changes. Leave without saving?"
        }
        confirmLabel={isAr ? "خروج بدون حفظ" : "Discard changes"}
        cancelLabel={isAr ? "متابعة التحرير" : "Keep editing"}
        onConfirm={() => {
          setConfirmDiscard(false);
          closeEditor();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
