import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { apiService, ApiError } from "../../services/api";
import "./AIChatAssistant.css";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  /** رسالة فشل — تُعرض بشكل مختلف وتُعلن كـ alert */
  isError?: boolean;
}

const PANEL_ID = "ai-assistant-panel";

const welcomeText = (language: string): string =>
  language === "ar"
    ? "أهلاً بك! أنا مساعد كلايمتيفاي الذكي للمناخ. كيف يمكنني مساعدتك اليوم في تقليل بصمتك الكربونية أو استكشاف مبادراتنا؟"
    : "Welcome! I'm Climatify's AI Climate Assistant. How can I help you today with carbon footprint reduction or exploring our initiatives?";

const makeWelcome = (language: string): Message => ({
  id: "welcome",
  sender: "ai",
  text: welcomeText(language),
  timestamp: new Date(),
});

let messageSeq = 0;
const nextId = (): string => `msg-${Date.now()}-${++messageSeq}`;

export const AIChatAssistant: React.FC = () => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  /** أحدث طلب فقط هو المسموح بالكتابة في المحادثة — الردود المتأخرة تُهمل. */
  const requestIdRef = useRef(0);

  /**
   * الرسالة الترحيبية تُنشأ عند أول فتح فقط، لا في كل تحميل صفحة.
   * وطالما هي الرسالة الوحيدة فإنها تتبع اللغة الحالية (قبل كان النص يتجمّد
   * على لغة أول تحميل بعد تبديل اللغة).
   */
  useEffect(() => {
    if (!isOpen) return;
    setMessages((prev) => {
      const first = prev[0];
      if (prev.length === 0) return [makeWelcome(language)];
      if (prev.length === 1 && first && first.id === "welcome") return [makeWelcome(language)];
      return prev;
    });
  }, [isOpen, language]);

  // التمرير التلقائي داخل المحادثة فقط — scrollIntoView كان يحرّك الصفحة كلها.
  useEffect(() => {
    if (!isOpen) return;
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [isOpen, messages, isSending]);

  // Escape لإغلاق النافذة
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // إدارة التركيز: إلى حقل الكتابة عند الفتح، وعودته إلى الزر العائم عند الإغلاق.
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
    return;
  }, [isOpen]);

  // أي طلب معلّق يُبطل عند إلغاء التركيب حتى لا تُكتب حالة بعد الإزالة.
  useEffect(() => () => { requestIdRef.current += 1; }, []);

  const handleSend = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      // بدون هذا الحرس كانت أزرار الاقتراحات السريعة تُطلق طلبات متزامنة
      // تعود بترتيب عشوائي فتتداخل الردود.
      if (!text || isSending) return;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setMessages((prev) => [
        ...prev,
        { id: nextId(), sender: "user", text, timestamp: new Date() },
      ]);
      setInputValue("");
      setIsSending(true);

      const isStale = () => requestIdRef.current !== requestId;

      try {
        const response = await apiService.sendAIChatMessage(text, language);
        if (isStale()) return;

        const reply = typeof response?.reply === "string" ? response.reply.trim() : "";
        if (!reply) {
          // لا نعرض فقاعة فارغة: هذا فشل ويجب أن يقوله للمستخدم.
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              sender: "ai",
              text:
                language === "ar"
                  ? "لم يصل رد من المساعد. حاول إعادة صياغة سؤالك أو المحاولة بعد لحظات."
                  : "The assistant returned an empty reply. Try rephrasing your question or try again shortly.",
              timestamp: new Date(),
              isError: true,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          { id: nextId(), sender: "ai", text: reply, timestamp: new Date() },
        ]);
      } catch (err) {
        if (isStale()) return;
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            sender: "ai",
            text:
              err instanceof ApiError
                ? err.localizedMessage(language)
                : language === "ar"
                  ? "حدث خطأ غير متوقع أثناء إرسال رسالتك. حاول مرة أخرى."
                  : "An unexpected error occurred while sending your message. Please try again.",
            timestamp: new Date(),
            isError: true,
          },
        ]);
      } finally {
        if (!isStale()) setIsSending(false);
      }
    },
    [isSending, language]
  );

  const quickPrompts = useMemo(
    () =>
      language === "ar"
        ? ["كيف أحسب بصمتي الكربونية؟", "كيف أتطوع في زراعة الأشجار؟", "ما هي فرص الشباب المتاحة؟"]
        : ["How to calculate my carbon?", "How to volunteer for planting?", "What youth opportunities exist?"],
    [language]
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter يُرسل، Shift+Enter يُنزل سطراً جديداً.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend(inputValue);
    }
  };

  const panelTitle = language === "ar" ? "المساعد المناخي الذكي" : "AI Climate Assistant";
  const triggerLabel = isOpen
    ? language === "ar" ? "إغلاق المساعد الذكي" : "Close AI assistant"
    : language === "ar" ? "فتح المساعد الذكي" : "Open AI assistant";

  return (
    <div className={`ai-assistant-wrapper ${language === "ar" ? "rtl-assistant" : ""}`}>
      {/* الزر العائم للدردشة */}
      <button
        type="button"
        className={`ai-floating-trigger-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        ref={triggerRef}
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
      >
        {isOpen ? <X size={22} /> : <MessageSquare size={22} />}
        <span className="ai-badge-pulse" aria-hidden="true"></span>
      </button>

      {/* نافذة الدردشة المنبثقة */}
      {isOpen && (
        <div
          className="ai-chat-window-card glass animate-slide-up"
          id={PANEL_ID}
          role="dialog"
          aria-label={panelTitle}
        >
          <div className="ai-chat-header">
            <div className="ai-title-group">
              <span className="sparkle-icon-tile" aria-hidden="true"><Sparkles size={16} /></span>
              <div>
                <h3>{panelTitle}</h3>
                <span className="ai-online-status">● {language === "ar" ? "نشط الآن" : "Online"}</span>
              </div>
            </div>
            <button
              type="button"
              className="ai-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label={language === "ar" ? "إغلاق المحادثة" : "Close chat"}
            >
              <X size={18} />
            </button>
          </div>

          {/* data-lenis-prevent وإلا التقط Lenis عجلة الماوس ولم يعد النص يُمرَّر */}
          <div
            className="ai-chat-body"
            ref={bodyRef}
            data-lenis-prevent
            role="log"
            aria-live="polite"
            aria-label={language === "ar" ? "سجل المحادثة" : "Conversation transcript"}
          >
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble-container ${msg.sender}`}>
                <div
                  className={`bubble-msg ${msg.isError ? "bubble-error" : ""}`}
                  role={msg.isError ? "alert" : undefined}
                >
                  {msg.text}
                </div>
                <span className="bubble-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {isSending && (
              <div className="chat-bubble-container ai">
                <div className="bubble-msg typing-indicator">
                  <span></span><span></span><span></span>
                  <span className="sr-only">
                    {language === "ar" ? "المساعد يكتب…" : "The assistant is typing…"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* اقتراحات الأسئلة السريعة */}
          <div className="ai-chat-quick-replies">
            {quickPrompts.map((prompt) => (
              <button
                type="button"
                key={prompt}
                className="quick-reply-btn"
                onClick={() => void handleSend(prompt)}
                disabled={isSending}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="ai-chat-input-footer"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend(inputValue);
            }}
          >
            <label className="sr-only" htmlFor="ai-chat-input">
              {language === "ar" ? "اكتب رسالتك للمساعد" : "Type your message to the assistant"}
            </label>
            <textarea
              id="ai-chat-input"
              ref={inputRef}
              rows={1}
              placeholder={language === "ar" ? "اكتب سؤالك المناخي هنا..." : "Type your climate question..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isSending}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={isSending || !inputValue.trim()}
              aria-label={language === "ar" ? "إرسال" : "Send"}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
