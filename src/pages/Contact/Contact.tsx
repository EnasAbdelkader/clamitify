import React, { useMemo, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError } from "../../services/api";
import type { ContactSubmitDto, MeetingBookingDto } from "../../types";
import { Mail, MapPin, CheckCircle, Sprout, AlertCircle } from "lucide-react";
import "./Contact.css";

type FormStatus = "idle" | "loading" | "success" | "error";

type ContactField = keyof ContactSubmitDto;
type MeetingField = keyof MeetingBookingDto;

/** ترتيب الحقول = ترتيب العرض، عشان نودّي الفوكس على أول حقل غلط. */
const CONTACT_FIELDS: ContactField[] = ["firstName", "lastName", "email", "subject", "message"];
const MEETING_FIELDS: MeetingField[] = ["name", "email", "date", "time", "notes"];

const EMPTY_CONTACT: ContactSubmitDto = { firstName: "", lastName: "", email: "", subject: "", message: "" };
const EMPTY_MEETING: MeetingBookingDto = { name: "", email: "", date: "", time: "", notes: "" };

/** حدود الطول — نفس الأرقام لازم تتطبّق على أعمدة الـ DB في الباك إند. */
const MAX = {
  firstName: 60,
  lastName: 60,
  name: 120,
  email: 120,
  subject: 140,
  message: 2000,
  notes: 1000
} as const;

// التحقق البسيط من الإيميل: حرف+ @ حرف+ . حرفين على الأقل.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** تاريخ اليوم بتوقيت الجهاز بصيغة YYYY-MM-DD — نفس الصيغة اللي input[type=date] بيفهمها. */
function todayISODate(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const Contact: React.FC = () => {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  const required = isAr ? "هذا الحقل مطلوب." : "This field is required.";
  const badEmail = isAr ? "برجاء إدخال بريد إلكتروني صحيح." : "Please enter a valid email address.";
  const fixFields = isAr ? "برجاء مراجعة الحقول المعلّمة بالأسفل." : "Please review the highlighted fields below.";
  const unexpected = isAr ? "حدث خطأ غير متوقع. حاول مرة أخرى." : "An unexpected error occurred. Please try again.";

  const minDate = useMemo(() => todayISODate(), []);

  // مراجع الحقول — بنستخدمها بس لتوجيه الفوكس على أول خطأ
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const bindField = (key: string) => (el: HTMLElement | null) => {
    fieldRefs.current[key] = el;
  };
  const focusField = (key: string) => {
    fieldRefs.current[key]?.focus();
  };

  // ── فورم الاتصال العادي ─────────────────────────────────────
  const [contactData, setContactData] = useState<ContactSubmitDto>(EMPTY_CONTACT);
  const [contactStatus, setContactStatus] = useState<FormStatus>("idle");
  const [contactMessage, setContactMessage] = useState<string | null>(null);
  const [contactErrors, setContactErrors] = useState<Partial<Record<ContactField, string>>>({});

  // ── فورم حجز المواعيد ───────────────────────────────────────
  const [meetingData, setMeetingData] = useState<MeetingBookingDto>(EMPTY_MEETING);
  const [meetingStatus, setMeetingStatus] = useState<FormStatus>("idle");
  const [meetingMessage, setMeetingMessage] = useState<string | null>(null);
  const [meetingErrors, setMeetingErrors] = useState<Partial<Record<MeetingField, string>>>({});

  const validateContact = (data: ContactSubmitDto): Partial<Record<ContactField, string>> => {
    const errors: Partial<Record<ContactField, string>> = {};
    if (!data.firstName.trim()) errors.firstName = required;
    if (!data.lastName.trim()) errors.lastName = required;
    if (!data.email.trim()) errors.email = required;
    else if (!EMAIL_RE.test(data.email.trim())) errors.email = badEmail;
    if (!data.subject.trim()) errors.subject = required;
    if (!data.message.trim()) errors.message = required;
    else if (data.message.trim().length < 10) {
      errors.message = isAr ? "اكتب 10 أحرف على الأقل حتى نفهم استفسارك." : "Please write at least 10 characters.";
    }
    return errors;
  };

  const validateMeeting = (data: MeetingBookingDto): Partial<Record<MeetingField, string>> => {
    const errors: Partial<Record<MeetingField, string>> = {};
    if (!data.name.trim()) errors.name = required;
    if (!data.email.trim()) errors.email = required;
    else if (!EMAIL_RE.test(data.email.trim())) errors.email = badEmail;

    if (!data.date) errors.date = required;
    else if (data.date < minDate) {
      // المقارنة النصية آمنة مع YYYY-MM-DD، وبتتم على تقويم الجهاز نفسه
      errors.date = isAr ? "لا يمكن حجز موعد في تاريخ مضى. اختر تاريخ اليوم أو بعده." : "You can't book a date in the past. Pick today or later.";
    }

    if (!data.time) errors.time = required;
    return errors;
  };

  // يا مطور الباك: هتاخد الداتا دي وتبعتها للسيرفر Flask بتاعك وتسجلها في قاعدة البيانات
  // الحقول هنا مطابقة حرفياً لـ ContactSubmitDto في src/types/index.ts
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactStatus === "loading") return;

    const errors = validateContact(contactData);
    setContactErrors(errors);
    const firstInvalid = CONTACT_FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      setContactStatus("error");
      setContactMessage(fixFields);
      focusField(`contact-${firstInvalid}`);
      return;
    }

    setContactStatus("loading");
    setContactMessage(null);

    try {
      await apiService.submitContact({
        firstName: contactData.firstName.trim(),
        lastName: contactData.lastName.trim(),
        email: contactData.email.trim(),
        subject: contactData.subject.trim(),
        message: contactData.message.trim()
      });
      setContactStatus("success");
      setContactMessage(null);
      setContactData(EMPTY_CONTACT);
      setContactErrors({});
    } catch (err) {
      // مهم: أي فشل لازم يخرجنا من "loading" وإلا الفورم بيتعلّق للأبد
      setContactStatus("error");
      setContactMessage(err instanceof ApiError ? err.localizedMessage(language) : unexpected);
    }
  };

  // يا مطور الباك: هنا حجز المواعيد، هتعمل Endpoint لحفظ الحجوزات وربطها بـ Google Calendar أو حفظها في الـ DB
  //
  // ⚠️ افتراض التوقيت (TIMEZONE ASSUMPTION):
  // `date` و `time` بيتبعتوا زي ما المستخدم كتبهم بالظبط — يعني ساعة الحائط
  // المحلية بتاعة جهازه، من غير أي إزاحة ولا حرف Z ولا معرّف منطقة زمنية،
  // لأن MeetingBookingDto مفيهوش حقل timezone.
  // السيرفر حالياً لازم يفترض منطقة زمنية واحدة (Asia/Dubai — مقر الفريق).
  // زائر من منطقة تانية هيحجز ساعة مختلفة عن اللي قصدها.
  // منطقة الجهاز الحقيقية للمراجعة وقت التطوير فقط:
  // Intl.DateTimeFormat().resolvedOptions().timeZone
  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingStatus === "loading") return;

    const errors = validateMeeting(meetingData);
    setMeetingErrors(errors);
    const firstInvalid = MEETING_FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      setMeetingStatus("error");
      setMeetingMessage(fixFields);
      focusField(`meeting-${firstInvalid}`);
      return;
    }

    setMeetingStatus("loading");
    setMeetingMessage(null);

    try {
      await apiService.bookMeeting({
        name: meetingData.name.trim(),
        email: meetingData.email.trim(),
        date: meetingData.date,
        time: meetingData.time,
        notes: meetingData.notes.trim()
      });
      setMeetingStatus("success");
      setMeetingMessage(null);
      setMeetingData(EMPTY_MEETING);
      setMeetingErrors({});
    } catch (err) {
      setMeetingStatus("error");
      setMeetingMessage(err instanceof ApiError ? err.localizedMessage(language) : unexpected);
    }
  };

  /** id رسالة الخطأ اللي بيربطها aria-describedby بالحقل */
  const errId = (fieldId: string) => `${fieldId}-error`;

  return (
    <div className="contact-page-container container">
      {/* 1. Header */}
      <section className="contact-header text-center">
        <span className="eyebrow">{t("contact")}</span>
        <h1 className="section-title">
          {isAr ? "تواصل معنا واحجز موعداً" : "Contact Us & Book a Meeting"}
        </h1>
        <p className="section-lead mx-auto">
          {isAr
            ? "نحن هنا لمساعدتك والإجابة على أي استفسارات، اختر الطريقة الأنسب للتواصل معنا."
            : "We are here to help and answer any questions. Choose the best way to reach us."}
        </p>
      </section>

      {/* 2. Grid containing Forms & Contact Info */}
      <div className="contact-content-grid-layout section">

        {/* معلومات الاتصال والتفاصيل */}
        <div className="contact-info-panel-box">
          <div className="info-card">
            <h3>{isAr ? "معلومات التواصل" : "Contact Information"}</h3>
            <p className="sub">
              {isAr ? "يسعدنا دائماً سماع رأيك أو استفسارك." : "We'd love to hear from you."}
            </p>

            <div className="info-details-list">
              <div className="info-detail-item">
                <Mail className="detail-icon" aria-hidden="true" />
                <div>
                  <strong>{isAr ? "البريد الإلكتروني" : "Email"}</strong>
                  <p>info@climatify-youth.com</p>
                </div>
              </div>

              <div className="info-detail-item">
                <MapPin className="detail-icon" aria-hidden="true" />
                <div>
                  <strong>{isAr ? "الموقع الجغرافي" : "Location"}</strong>
                  <p>Dubai, United Arab Emirates</p>
                </div>
              </div>
            </div>

            <div className="google-forms-movement-card">
              <h4 className="google-forms-title">
                <Sprout size={18} aria-hidden="true" />
                <span>{isAr ? "انضم إلى مجتمعنا عبر نموذج جوجل" : "Join our network via Google"}</span>
              </h4>
              <p>
                {isAr
                  ? "سجّل اهتمامك وكن جزءاً من شبكة شباب كلايمتيفاي العالمية."
                  : "Register your interest and join the global Climatify youth network."}
              </p>
              <a
                href="https://forms.gle/s5JHeddW9WSgsbVu9"
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm google-forms-link"
              >
                {isAr ? "افتح استمارة جوجل" : "Open Google Form"}
              </a>
            </div>
          </div>
        </div>

        {/* نموذج التواصل العادي */}
        <div className="contact-form-wrapper card">
          <h3>{isAr ? "أرسل لنا رسالة" : "Send Us a Message"}</h3>

          {contactStatus === "success" ? (
            <div className="form-success-message" role="status" aria-live="polite">
              <CheckCircle size={36} aria-hidden="true" />
              <p>
                {isAr
                  ? "شكراً لتواصلك معنا! تم إرسال رسالتك بنجاح وسيتواصل معك فريقنا في أقرب وقت."
                  : "Thank you! Your message has been sent successfully. We will get back to you soon."}
              </p>
              <button type="button" onClick={() => setContactStatus("idle")} className="btn btn-ghost btn-sm">
                {isAr ? "إرسال رسالة أخرى" : "Send another message"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="contact-form-element" noValidate>
              {/* رسالة الفشل — يقراها قارئ الشاشة فوراً */}
              {contactStatus === "error" && contactMessage && (
                <p className="form-error-banner" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{contactMessage}</span>
                </p>
              )}

              <div className="form-row-two-columns">
                <div className="form-group">
                  <label htmlFor="first-name">{isAr ? "الاسم الأول" : "First Name"}</label>
                  <input
                    type="text"
                    id="first-name"
                    name="firstName"
                    autoComplete="given-name"
                    maxLength={MAX.firstName}
                    required
                    ref={bindField("contact-firstName")}
                    aria-invalid={Boolean(contactErrors.firstName)}
                    aria-describedby={contactErrors.firstName ? errId("first-name") : undefined}
                    value={contactData.firstName}
                    onChange={(e) => setContactData({ ...contactData, firstName: e.target.value })}
                    className="form-control"
                    placeholder={isAr ? "مثال: أحمد" : "e.g. John"}
                  />
                  {contactErrors.firstName && (
                    <span className="field-error-text" id={errId("first-name")}>{contactErrors.firstName}</span>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="last-name">{isAr ? "الاسم الأخير" : "Last Name"}</label>
                  <input
                    type="text"
                    id="last-name"
                    name="lastName"
                    autoComplete="family-name"
                    maxLength={MAX.lastName}
                    required
                    ref={bindField("contact-lastName")}
                    aria-invalid={Boolean(contactErrors.lastName)}
                    aria-describedby={contactErrors.lastName ? errId("last-name") : undefined}
                    value={contactData.lastName}
                    onChange={(e) => setContactData({ ...contactData, lastName: e.target.value })}
                    className="form-control"
                    placeholder={isAr ? "مثال: حسان" : "e.g. Doe"}
                  />
                  {contactErrors.lastName && (
                    <span className="field-error-text" id={errId("last-name")}>{contactErrors.lastName}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">{isAr ? "البريد الإلكتروني" : "Email"}</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={MAX.email}
                  required
                  ref={bindField("contact-email")}
                  aria-invalid={Boolean(contactErrors.email)}
                  aria-describedby={contactErrors.email ? errId("email") : undefined}
                  value={contactData.email}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                  className="form-control"
                  placeholder="name@example.com"
                />
                {contactErrors.email && (
                  <span className="field-error-text" id={errId("email")}>{contactErrors.email}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="subject">{isAr ? "الموضوع" : "Subject"}</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  maxLength={MAX.subject}
                  required
                  ref={bindField("contact-subject")}
                  aria-invalid={Boolean(contactErrors.subject)}
                  aria-describedby={contactErrors.subject ? errId("subject") : undefined}
                  value={contactData.subject}
                  onChange={(e) => setContactData({ ...contactData, subject: e.target.value })}
                  className="form-control"
                  placeholder={isAr ? "ما موضوع رسالتك؟" : "What is this about?"}
                />
                {contactErrors.subject && (
                  <span className="field-error-text" id={errId("subject")}>{contactErrors.subject}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="message">{isAr ? "الرسالة" : "Your Message"}</label>
                <textarea
                  id="message"
                  name="message"
                  maxLength={MAX.message}
                  required
                  rows={5}
                  ref={bindField("contact-message")}
                  aria-invalid={Boolean(contactErrors.message)}
                  aria-describedby={contactErrors.message ? errId("message") : undefined}
                  value={contactData.message}
                  onChange={(e) => setContactData({ ...contactData, message: e.target.value })}
                  className="form-control"
                  placeholder={isAr ? "اكتب تفاصيل استفسارك هنا..." : "Type your message detail here..."}
                ></textarea>
                {contactErrors.message && (
                  <span className="field-error-text" id={errId("message")}>{contactErrors.message}</span>
                )}
              </div>

              <button type="submit" disabled={contactStatus === "loading"} className="btn btn-primary submit-btn-form">
                {contactStatus === "loading"
                  ? (isAr ? "جارٍ الإرسال…" : "Sending…")
                  : (isAr ? "إرسال الرسالة" : "Send Message")}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 3. Meeting Booking Section */}
      <section className="meeting-booking-section section bg-gradient-brand-soft">
        <div className="booking-layout-grid">
          <div className="booking-info-text">
            <span className="eyebrow">{isAr ? "حجز الاجتماعات" : "Schedule a Meeting"}</span>
            <h2>{isAr ? "احجز جلسة استشارية معنا" : "Book a Consultation Session"}</h2>
            <p>
              {isAr
                ? "إذا كنت تمثل مؤسسة، جامعة، أو ترغب في بناء شراكة بيئية رقمية معنا، يمكنك حجز موعد مباشر لمناقشة التفاصيل."
                : "If you represent an institution, university, or want to build a digital climate partnership, schedule a direct slot to discuss details."}
            </p>
          </div>

          <div className="booking-form-card card">
            {meetingStatus === "success" ? (
              <div className="booking-success-message text-center" role="status" aria-live="polite">
                <CheckCircle size={44} className="success-icon" aria-hidden="true" />
                <h3>{isAr ? "تم جدولة اجتماعك!" : "Meeting Scheduled!"}</h3>
                <p>
                  {isAr
                    ? "تم حجز موعدك بنجاح، وستصلك رسالة تفاصيل عبر البريد الإلكتروني لتأكيد الربط بـ Google Meet."
                    : "Your slot has been booked successfully. A confirmation email with Google Meet details has been sent."}
                </p>
                <button type="button" onClick={() => setMeetingStatus("idle")} className="btn btn-primary">
                  {isAr ? "حجز موعد آخر" : "Book Another Slot"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleMeetingSubmit} className="booking-form-element" noValidate>
                {meetingStatus === "error" && meetingMessage && (
                  <p className="form-error-banner" role="alert">
                    <AlertCircle size={16} aria-hidden="true" />
                    <span>{meetingMessage}</span>
                  </p>
                )}

                <div className="form-group">
                  <label htmlFor="booking-name">{isAr ? "الاسم بالكامل" : "Your Name"}</label>
                  <input
                    type="text"
                    id="booking-name"
                    name="name"
                    autoComplete="name"
                    maxLength={MAX.name}
                    required
                    ref={bindField("meeting-name")}
                    aria-invalid={Boolean(meetingErrors.name)}
                    aria-describedby={meetingErrors.name ? errId("booking-name") : undefined}
                    value={meetingData.name}
                    onChange={(e) => setMeetingData({ ...meetingData, name: e.target.value })}
                    className="form-control"
                    placeholder={isAr ? "ادخل اسمك الكامل" : "Enter full name"}
                  />
                  {meetingErrors.name && (
                    <span className="field-error-text" id={errId("booking-name")}>{meetingErrors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="booking-email">{isAr ? "البريد الإلكتروني" : "Email Address"}</label>
                  <input
                    type="email"
                    id="booking-email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={MAX.email}
                    required
                    ref={bindField("meeting-email")}
                    aria-invalid={Boolean(meetingErrors.email)}
                    aria-describedby={meetingErrors.email ? errId("booking-email") : undefined}
                    value={meetingData.email}
                    onChange={(e) => setMeetingData({ ...meetingData, email: e.target.value })}
                    className="form-control"
                    placeholder="email@example.com"
                  />
                  {meetingErrors.email && (
                    <span className="field-error-text" id={errId("booking-email")}>{meetingErrors.email}</span>
                  )}
                </div>

                <div className="form-row-two-columns">
                  <div className="form-group">
                    <label htmlFor="booking-date">{isAr ? "التاريخ" : "Select Date"}</label>
                    <input
                      type="date"
                      id="booking-date"
                      name="date"
                      required
                      min={minDate}
                      ref={bindField("meeting-date")}
                      aria-invalid={Boolean(meetingErrors.date)}
                      aria-describedby={meetingErrors.date ? errId("booking-date") : undefined}
                      value={meetingData.date}
                      onChange={(e) => setMeetingData({ ...meetingData, date: e.target.value })}
                      className="form-control"
                    />
                    {meetingErrors.date && (
                      <span className="field-error-text" id={errId("booking-date")}>{meetingErrors.date}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="booking-time">{isAr ? "الوقت" : "Select Time"}</label>
                    <input
                      type="time"
                      id="booking-time"
                      name="time"
                      required
                      ref={bindField("meeting-time")}
                      aria-invalid={Boolean(meetingErrors.time)}
                      aria-describedby={meetingErrors.time ? errId("booking-time") : undefined}
                      value={meetingData.time}
                      onChange={(e) => setMeetingData({ ...meetingData, time: e.target.value })}
                      className="form-control"
                    />
                    {meetingErrors.time && (
                      <span className="field-error-text" id={errId("booking-time")}>{meetingErrors.time}</span>
                    )}
                  </div>
                </div>

                {/* التوقيت اللي بيتعرض للزائر = ساعة جهازه المحلية. الافتراض موثّق فوق. */}
                <p className="booking-timezone-hint">
                  {isAr
                    ? "المواعيد بتوقيت الإمارات (GST / UTC+4). لو كنت في منطقة زمنية مختلفة اذكرها في الملاحظات."
                    : "Slots are in UAE time (GST / UTC+4). If you are in another timezone, mention it in the notes."}
                </p>

                <div className="form-group">
                  <label htmlFor="booking-notes">{isAr ? "ملاحظات إضافية" : "Discussion Topics"}</label>
                  <textarea
                    id="booking-notes"
                    name="notes"
                    maxLength={MAX.notes}
                    rows={3}
                    ref={bindField("meeting-notes")}
                    value={meetingData.notes}
                    onChange={(e) => setMeetingData({ ...meetingData, notes: e.target.value })}
                    className="form-control"
                    placeholder={isAr ? "عن ماذا تريد التحدث في الاجتماع؟" : "What would you like to discuss?"}
                  ></textarea>
                </div>

                <button type="submit" disabled={meetingStatus === "loading"} className="btn btn-primary booking-submit-btn">
                  {meetingStatus === "loading"
                    ? (isAr ? "جارٍ الحجز…" : "Booking…")
                    : (isAr ? "تأكيد حجز الاجتماع" : "Confirm Slot Booking")}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
