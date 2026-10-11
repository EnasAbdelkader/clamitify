import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  Save,
  Shield,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCMSStore } from "../../store/useCMSStore";
import { apiService, ApiError } from "../../services/api";

type FormStatus = "idle" | "loading" | "success" | "error";

const MIN_PASSWORD_LENGTH = 8;

export const AdminSettings: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const siteSettings = useCMSStore((state) => state.siteSettings);
  const saveSettings = useCMSStore((state) => state.saveSettings);
  const changePassword = useCMSStore((state) => state.changePassword);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // --- General settings form ---
  const [siteName, setSiteName] = useState(siteSettings.siteName);
  const [contactEmail, setContactEmail] = useState(siteSettings.contactEmail);
  const [enableMaintenance, setEnableMaintenance] = useState(siteSettings.enableMaintenance);

  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<FormStatus>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // --- Password form ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<FormStatus>("idle");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  /**
   * الإعدادات كانت write-only: تحفظ وتختفي أول ريفريش لأن مفيش حد بيقراها.
   * دلوقتي بنحمّلها من GET /api/admin/settings عند فتح الصفحة.
   */
  const loadSettings = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const data = await apiService.getAdminSettings();
      if (!mounted.current) return;
      setSiteName(typeof data?.siteName === "string" ? data.siteName : "");
      setContactEmail(typeof data?.contactEmail === "string" ? data.contactEmail : "");
      setEnableMaintenance(Boolean(data?.enableMaintenance));
      setLoadState("ready");
    } catch (err) {
      if (!mounted.current) return;
      setLoadError(
        err instanceof ApiError
          ? err.localizedMessage(language)
          : isAr
            ? "تعذّر تحميل الإعدادات."
            : "Could not load the settings."
      );
      setLoadState("error");
    }
  }, [language, isAr]);

  useEffect(() => {
    void loadSettings();
    // بنحمّل مرة واحدة عند فتح الصفحة؛ تغيير اللغة ما يستاهلش نداء شبكة تاني
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveStatus === "loading") return;

    setSaveStatus("loading");
    setSaveMessage(null);

    try {
      const result = await saveSettings({ siteName: siteName.trim(), contactEmail: contactEmail.trim(), enableMaintenance });
      if (!mounted.current) return;

      if (result.ok) {
        setSaveStatus("success");
        setSaveMessage(isAr ? "تم حفظ الإعدادات بنجاح." : "Settings saved successfully.");
      } else {
        setSaveStatus("error");
        setSaveMessage(result.error ?? (isAr ? "تعذّر حفظ الإعدادات." : "Could not save the settings."));
      }
    } catch (err) {
      if (!mounted.current) return;
      setSaveStatus("error");
      setSaveMessage(err instanceof Error ? err.message : (isAr ? "تعذّر اتصال الإعدادات بالخادم." : "Failed to communicate with server."));
    }
  };

  /** بيرجّع رسالة الخطأ لو في مشكلة في مدخلات كلمة المرور، وnull لو كله تمام. */
  const validatePassword = (): string | null => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return isAr ? "برجاء ملء جميع حقول كلمة المرور." : "Please fill in all password fields.";
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return isAr
        ? `كلمة المرور الجديدة لازم تكون ${MIN_PASSWORD_LENGTH} حروف على الأقل.`
        : `The new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
    }
    if (newPassword === currentPassword) {
      return isAr
        ? "كلمة المرور الجديدة لازم تكون مختلفة عن الحالية."
        : "The new password must be different from the current one.";
    }
    if (newPassword !== confirmPassword) {
      return isAr ? "كلمتا المرور الجديدتان غير متطابقتين." : "The new passwords do not match.";
    }
    return null;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordStatus === "loading") return;

    const validationError = validatePassword();
    if (validationError) {
      setPasswordStatus("error");
      setPasswordMessage(validationError);
      return;
    }

    setPasswordStatus("loading");
    setPasswordMessage(null);

    try {
      const response = await changePassword({ currentPassword, newPassword });
      if (!mounted.current) return;

      if (response.success) {
        setPasswordStatus("success");
        setPasswordMessage(response.message);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordStatus("error");
        setPasswordMessage(response.message);
      }
    } catch (err) {
      if (!mounted.current) return;
      setPasswordStatus("error");
      setPasswordMessage(err instanceof Error ? err.message : (isAr ? "تعذّر تغيير كلمة المرور." : "Password change failed."));
    }
  };

  const savingSettings = saveStatus === "loading";
  const savingPassword = passwordStatus === "loading";

  return (
    <div>
      <div className="admin-page-header">
        <h2 className="admin-page-title">
          <span>{isAr ? "إعدادات النظام" : "System Settings"}</span>
        </h2>
        <p className="admin-page-subtitle">
          {isAr
            ? "تحديث تكوين المنصة وكلمة مرور المسؤول"
            : "Update platform configurations and admin password"}
        </p>
      </div>

      <div className="admin-settings-stack">
        {/* Site Config */}
        <div className="admin-card">
          <div className="admin-card-header">
            <span className="admin-card-title admin-card-title-icon">
              <span className="admin-icon-chip green"><Settings size={16} /></span>
              {isAr ? "إعدادات عامة" : "General Settings"}
            </span>
          </div>
          <div className="admin-card-body-padded">
            {loadState === "loading" ? (
              <div className="admin-loading-block" role="status">
                <Loader2 size={18} className="admin-spinner" />
                <span>{isAr ? "جاري تحميل الإعدادات..." : "Loading settings..."}</span>
              </div>
            ) : (
              <>
                {loadState === "error" && (
                  <div className="admin-alert error" role="alert">
                    <AlertTriangle size={16} />
                    <span>
                      {loadError}
                      {" "}
                      {isAr
                        ? "الحقول تحت بتعرض آخر قيم معروفة، والحفظ ممكن يستبدل الإعدادات الحقيقية."
                        : "The fields below show the last known values; saving may overwrite the real settings."}
                    </span>
                    <span className="admin-alert-actions">
                      <button type="button" className="admin-add-btn sm" onClick={() => void loadSettings()}>
                        <RefreshCw size={14} />
                        <span>{isAr ? "إعادة المحاولة" : "Retry"}</span>
                      </button>
                    </span>
                  </div>
                )}

                <form onSubmit={handleSaveSettings}>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label className="admin-form-label" htmlFor="settings-site-name">
                        {isAr ? "اسم المنصة" : "Platform Name"}
                      </label>
                      <input
                        id="settings-site-name"
                        type="text"
                        className="admin-form-input"
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        disabled={savingSettings}
                        required
                      />
                    </div>
                    <div className="admin-form-group">
                      <label className="admin-form-label" htmlFor="settings-contact-email">
                        {isAr ? "البريد الإلكتروني للتواصل" : "Contact Email"}
                      </label>
                      <input
                        id="settings-contact-email"
                        type="email"
                        className="admin-form-input"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        disabled={savingSettings}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {/* TODO(backend): وضع الصيانة لسه علم على السيرفر بس — مفيش حاجة في
                      الفرونت بتقرا enableMaintenance، فالموقع مش هيتحوّل لصفحة صيانة
                      من هنا. اللابل مكتوب بصراحة كده بدل ما يوعد بحاجة مش بتحصل. */}
                  <div className="admin-form-group">
                    <span className="admin-form-label">
                      {isAr ? "وضع الصيانة" : "Maintenance Mode"}
                    </span>
                    <label className="admin-switch" htmlFor="settings-maintenance">
                      <input
                        id="settings-maintenance"
                        type="checkbox"
                        checked={enableMaintenance}
                        onChange={(e) => setEnableMaintenance(e.target.checked)}
                        disabled={savingSettings}
                        aria-describedby="settings-maintenance-hint"
                      />
                      <span className="admin-switch-track" aria-hidden="true">
                        <span className="admin-switch-thumb" />
                      </span>
                      <span className="admin-switch-text">
                        {enableMaintenance
                          ? (isAr ? "مُفعّل — علم للخادم فقط" : "Enabled — backend flag only")
                          : (isAr ? "غير مُفعّل" : "Disabled")}
                      </span>
                    </label>
                    <p id="settings-maintenance-hint" className="admin-form-hint">
                      {isAr
                        ? "بيتحفظ مع الإعدادات ويتبعت للخادم، لكن الموقع الحالي مش بيقرا العلم ده — الزوار مش هيشوفوا صفحة صيانة لحد ما الباك إند يطبّقها."
                        : "This is stored and sent to the server, but the site does not read it yet — visitors will NOT see a maintenance page until the backend enforces it."}
                    </p>
                  </div>

                  <div aria-live="polite" className="admin-mt-16">
                    {saveMessage && (
                      <div
                        className={`admin-alert ${saveStatus === "success" ? "success" : "error"}`}
                        role={saveStatus === "success" ? "status" : "alert"}
                      >
                        {saveStatus === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        <span>{saveMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-form-actions admin-mt-8">
                    <button
                      type="submit"
                      className="admin-btn-submit"
                      disabled={savingSettings}
                    >
                      {savingSettings ? <Loader2 size={16} className="admin-spinner" /> : <Save size={16} />}
                      <span>
                        {savingSettings
                          ? (isAr ? "جاري الحفظ..." : "Saving...")
                          : (isAr ? "حفظ الإعدادات" : "Save Configurations")}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="admin-card">
          <div className="admin-card-header">
            <span className="admin-card-title admin-card-title-icon">
              <span className="admin-icon-chip red"><Shield size={16} /></span>
              {isAr ? "الحماية وتغيير كلمة المرور" : "Security & Password"}
            </span>
          </div>
          <div className="admin-card-body-padded">
            <form onSubmit={handleUpdatePassword}>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="settings-current-password">
                    {isAr ? "كلمة المرور الحالية" : "Current Password"}
                  </label>
                  <input
                    id="settings-current-password"
                    type="password"
                    className="admin-form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={savingPassword}
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="settings-new-password">
                    {isAr ? "كلمة المرور الجديدة" : "New Password"}
                  </label>
                  <input
                    id="settings-new-password"
                    type="password"
                    className="admin-form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    disabled={savingPassword}
                    aria-describedby="settings-password-hint"
                    required
                  />
                  <p id="settings-password-hint" className="admin-form-hint">
                    {isAr
                      ? `${MIN_PASSWORD_LENGTH} حروف على الأقل، ومختلفة عن الحالية.`
                      : `At least ${MIN_PASSWORD_LENGTH} characters, and different from the current one.`}
                  </p>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor="settings-confirm-password">
                    {isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
                  </label>
                  <input
                    id="settings-confirm-password"
                    type="password"
                    className="admin-form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={savingPassword}
                    required
                  />
                </div>
              </div>

              <div aria-live="polite" className="admin-mt-16">
                {passwordMessage && (
                  <div
                    className={`admin-alert ${passwordStatus === "success" ? "success" : "error"}`}
                    role={passwordStatus === "success" ? "status" : "alert"}
                  >
                    {passwordStatus === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{passwordMessage}</span>
                  </div>
                )}
              </div>

              <div className="admin-form-actions admin-mt-8">
                <button
                  type="submit"
                  className="admin-btn-submit danger"
                  disabled={savingPassword}
                >
                  {savingPassword ? <Loader2 size={16} className="admin-spinner" /> : <Shield size={16} />}
                  <span>
                    {savingPassword
                      ? (isAr ? "جاري التحديث..." : "Updating...")
                      : (isAr ? "تحديث كلمة المرور" : "Update Password")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
