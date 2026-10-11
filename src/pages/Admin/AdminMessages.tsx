import React, { useState, useEffect, useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  Mail,
  MailOpen,
  Search,
  Trash2,
  X,
  Inbox,
  Download,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Send,
  Clock,
} from "lucide-react";
import { useCMSStore } from "../../store/useCMSStore";
import type { ContactMessage } from "../../types";
import { buildCsv, downloadTextFile, toLocalDateInput } from "./adminUtils";
import { ConfirmDialog } from "./ConfirmDialog";

type FilterStatus = "all" | "unread" | "read";

export const AdminMessages: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const messages = useCMSStore((state) => state.messages);
  const loading = useCMSStore((state) => state.loading);
  const storeError = useCMSStore((state) => state.error);
  const loadMessages = useCMSStore((state) => state.loadMessages);
  const deleteMessage = useCMSStore((state) => state.deleteMessage);
  const setMessageRead = useCMSStore((state) => state.markMessageRead);

  useEffect(() => {
    if (messages.length === 0 && !loading && !storeError) {
      void loadMessages();
    }
    // بنحمّل مرة واحدة عند فتح الصفحة — التحديث اليدوي متاح من زر Refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(() => messages.filter((m) => !m.isRead).length, [messages]);
  const readCount = useMemo(() => messages.filter((m) => m.isRead).length, [messages]);

  const selectedMessage: ContactMessage | null = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  const handleRequestDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionError(null);
    setPendingDeleteId(id);
  };

  const pendingDeleteMessage = useMemo(
    () => (pendingDeleteId !== null ? messages.find((m) => m.id === pendingDeleteId) ?? null : null),
    [pendingDeleteId, messages]
  );

  const handlePerformDelete = async (id: string) => {
    setPendingDeleteId(null);
    setActionError(null);
    setBusyId(id);
    try {
      const result = await deleteMessage(id);
      if (!result.ok) {
        setActionError(result.error ?? (isAr ? "تعذّر حذف الرسالة." : "Could not delete the message."));
        return;
      }
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error deleting message.");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleRead = async (msg: ContactMessage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionError(null);
    setBusyId(msg.id);
    try {
      const result = await setMessageRead(msg.id, !msg.isRead);
      if (!result.ok) {
        setActionError(
          result.error ?? (isAr ? "تعذّر تحديث حالة الرسالة." : "Could not update the message status.")
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : (isAr ? "حدث خطأ أثناء الاتصال بالخادم." : "Server error occurred."));
    } finally {
      setBusyId(null);
    }
  };

  const handleSelectMessage = async (msg: ContactMessage) => {
    setSelectedId(msg.id);
    if (!msg.isRead) {
      setActionError(null);
      try {
        const result = await setMessageRead(msg.id, true);
        if (!result.ok) {
          setActionError(
            result.error ?? (isAr ? "تعذّر تحديد الرسالة كمقروءة." : "Could not mark the message as read.")
          );
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : (isAr ? "حدث خطأ أثناء تحديث حالة الرسالة." : "Message status update error."));
      }
    }
  };

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((msg) => {
      const matchesSearch =
        !q ||
        msg.sender.toLowerCase().includes(q) ||
        msg.email.toLowerCase().includes(q) ||
        msg.subject.toLowerCase().includes(q) ||
        msg.message.toLowerCase().includes(q);

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "unread" && !msg.isRead) ||
        (filterStatus === "read" && msg.isRead);

      return matchesSearch && matchesStatus;
    });
  }, [messages, searchQuery, filterStatus]);

  const handleExportCSV = () => {
    if (messages.length === 0) return;
    const headers = ["ID", "Sender", "Email", "Subject", "Message", "Date", "Status"];
    const rows = messages.map((m) => [
      m.id,
      m.sender,
      m.email,
      m.subject,
      m.message,
      m.date,
      m.isRead ? "Read" : "Unread",
    ]);
    downloadTextFile(
      `climatify_messages_${toLocalDateInput()}.csv`,
      buildCsv(headers, rows),
      "text/csv;charset=utf-8"
    );
  };

  const showListError = Boolean(storeError) && messages.length === 0 && !loading;

  return (
    <div>
      {/* Page Header */}
      <div className="admin-page-header">
        <h2 className="admin-page-title">
          <span>{isAr ? "صندوق الرسائل والاستفسارات" : "Inbox & Messages Hub"}</span>
        </h2>
        <p className="admin-page-subtitle">
          {isAr
            ? "عرض الرسائل والاستفسارات الواردة من زوار المنصة والرد عليها مباشرة"
            : "Manage incoming inquiries, filter messages, and reply directly to users"}
        </p>
      </div>

      <div aria-live="polite">
        {actionError && (
          <div className="admin-alert error" role="alert">
            <AlertTriangle size={16} />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* Inbox Toolbar */}
      <div className="admin-cms-toolbar compact">
        <div className="admin-messages-filter" role="group" aria-label={isAr ? "تصفية الرسائل" : "Filter messages"}>
          <button
            type="button"
            className={`admin-cms-tab-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
            aria-pressed={filterStatus === "all"}
          >
            <Inbox size={15} />
            <span>{isAr ? "الكل" : "All"}</span>
            <span className="admin-cms-tab-count">{messages.length}</span>
          </button>

          <button
            type="button"
            className={`admin-cms-tab-btn ${filterStatus === "unread" ? "active" : ""}`}
            onClick={() => setFilterStatus("unread")}
            aria-pressed={filterStatus === "unread"}
          >
            <Mail size={15} />
            <span>{isAr ? "غير مقروءة" : "Unread"}</span>
            <span className="admin-cms-tab-count">{unreadCount}</span>
          </button>

          <button
            type="button"
            className={`admin-cms-tab-btn ${filterStatus === "read" ? "active" : ""}`}
            onClick={() => setFilterStatus("read")}
            aria-pressed={filterStatus === "read"}
          >
            <MailOpen size={15} />
            <span>{isAr ? "مقروءة" : "Read"}</span>
            <span className="admin-cms-tab-count">{readCount}</span>
          </button>
        </div>

        <div className="admin-messages-toolbar-actions">
          <button
            type="button"
            className="admin-cms-tab-btn"
            onClick={() => void loadMessages()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "admin-spinner" : undefined} />
            <span>{isAr ? "تحديث" : "Refresh"}</span>
          </button>

          <button
            type="button"
            className="admin-cms-tab-btn"
            onClick={handleExportCSV}
            disabled={messages.length === 0}
          >
            <Download size={14} />
            <span>{isAr ? "تصدير CSV" : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="admin-cms-toolbar">
        <div className="admin-cms-search-box admin-search-full">
          <Search size={16} className="admin-cms-search-icon" />
          <input
            id="admin-message-search"
            type="search"
            className="admin-cms-search-input"
            placeholder={isAr ? "بحث عن رسالة حسب الاسم، البريد، أو الموضوع..." : "Search messages by sender, email, or subject..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="admin-messages-grid">
        {/* Messages List */}
        <div className="admin-card">
          <div className="admin-card-header">
            <span className="admin-card-title">
              {isAr ? "قائمة الرسائل" : "Messages List"}
            </span>
            <span className="admin-list-count">
              {filteredMessages.length} {isAr ? "رسالة" : "messages"}
            </span>
          </div>

          <div className="admin-card-body">
            {loading && messages.length === 0 ? (
              <div className="admin-loading-block" role="status">
                <Loader2 size={20} className="admin-spinner" />
                <span>{isAr ? "جاري تحميل الرسائل..." : "Loading inbox..."}</span>
              </div>
            ) : showListError ? (
              <div className="admin-empty-state">
                <div className="icon"><AlertTriangle size={32} /></div>
                <p role="alert">{storeError}</p>
                <div className="admin-empty-actions">
                  <button type="button" className="admin-add-btn sm" onClick={() => void loadMessages()}>
                    <RefreshCw size={14} />
                    <span>{isAr ? "إعادة المحاولة" : "Retry"}</span>
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="admin-empty-state">
                <div className="icon"><Inbox size={32} /></div>
                <p>{isAr ? "صندوق الرسائل فارغ حالياً." : "The inbox is empty."}</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="admin-empty-state">
                <div className="icon"><Search size={32} /></div>
                <p>{isAr ? "لا توجد رسائل مطابقة للبحث أو التصفية" : "No messages match your search criteria"}</p>
                {searchQuery && (
                  <div className="admin-empty-actions">
                    <button type="button" className="admin-btn-cancel sm" onClick={() => setSearchQuery("")}>
                      {isAr ? "مسح البحث" : "Clear Search"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="admin-message-list">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`admin-message-item ${selectedId === msg.id ? "active" : ""} ${!msg.isRead ? "unread" : ""}`}
                  >
                    <button
                      type="button"
                      className="admin-message-open"
                      onClick={() => void handleSelectMessage(msg)}
                      aria-current={selectedId === msg.id ? "true" : undefined}
                    >
                      <span className="admin-message-avatar" aria-hidden="true">
                        {msg.sender.charAt(0).toUpperCase()}
                        {!msg.isRead && <span className="admin-message-unread-dot" />}
                      </span>
                      <span className="admin-message-body">
                        <span className="admin-message-meta">
                          <span className="admin-message-sender">{msg.sender}</span>
                          <span className="admin-message-email">{msg.date}</span>
                        </span>
                        <span className="admin-message-subject">{msg.subject}</span>
                        <span className="admin-message-preview">{msg.message}</span>
                      </span>
                    </button>

                    <div className="admin-message-actions">
                      <button
                        type="button"
                        className="admin-action-btn neutral"
                        onClick={(e) => void handleToggleRead(msg, e)}
                        disabled={busyId === msg.id}
                        title={msg.isRead ? (isAr ? "تحديد كغير مقروءة" : "Mark as unread") : (isAr ? "تحديد كمقروءة" : "Mark as read")}
                      >
                        {msg.isRead ? <Mail size={15} /> : <MailOpen size={15} />}
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn delete"
                        onClick={(e) => handleRequestDelete(msg.id, e)}
                        disabled={busyId === msg.id}
                        title={isAr ? "حذف الرسالة" : "Delete message"}
                      >
                        {busyId === msg.id ? <Loader2 size={15} className="admin-spinner" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reader Pane */}
        {selectedMessage ? (
          <div className="admin-card admin-message-detail">
            <div className="admin-card-header">
              <span className="admin-card-title">
                {isAr ? "قراءة الرسالة" : "Message Reader"}
              </span>
              <button
                type="button"
                className="admin-action-btn neutral"
                onClick={() => setSelectedId(null)}
                aria-label={isAr ? "إغلاق التفاصيل" : "Close message view"}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-card-body-padded">
              <div className="admin-msg-head">
                <div className="admin-msg-sender">
                  <div className="admin-message-avatar admin-avatar-lg">
                    {selectedMessage.sender.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="admin-msg-sender-name">
                      {selectedMessage.sender}
                    </div>
                    <a className="admin-msg-sender-email" href={`mailto:${selectedMessage.email}`}>
                      {selectedMessage.email}
                    </a>
                  </div>
                </div>

                <span className={`admin-badge ${selectedMessage.isRead ? "green" : "amber"}`}>
                  {selectedMessage.isRead ? (isAr ? "مقروءة" : "Read") : (isAr ? "غير مقروءة" : "Unread")}
                </span>
              </div>

              <div className="admin-detail-block">
                <div className="admin-detail-label">
                  {isAr ? "الموضوع" : "Subject"}
                </div>
                <div className="admin-detail-subject">
                  {selectedMessage.subject}
                </div>
              </div>

              <div className="admin-detail-block">
                <div className="admin-detail-label">
                  {isAr ? "نص الرسالة" : "Message Content"}
                </div>
                <div className="admin-msg-body-box">
                  {selectedMessage.message}
                </div>
              </div>

              <div className="admin-msg-facts">
                <span className="admin-msg-fact">
                  <Clock size={14} />
                  {selectedMessage.date}
                </span>

                <button
                  type="button"
                  className="admin-cms-tab-btn sm"
                  onClick={() => void handleToggleRead(selectedMessage)}
                  disabled={busyId === selectedMessage.id}
                >
                  {selectedMessage.isRead ? (isAr ? "تحديد كغير مقروءة" : "Mark unread") : (isAr ? "تحديد كمقروءة" : "Mark read")}
                </button>
              </div>

              {/* Actions: Reply via Email & Delete */}
              <div className="admin-msg-actions">
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                  className="admin-add-btn sm admin-msg-reply-link"
                >
                  <Send size={15} />
                  <span>{isAr ? "الرد عبر البريد" : "Reply via Email"}</span>
                </a>

                <button
                  type="button"
                  className="admin-btn-cancel admin-btn-delete-ghost"
                  onClick={() => handleRequestDelete(selectedMessage.id)}
                  disabled={busyId === selectedMessage.id}
                >
                  <Trash2 size={15} />
                  <span>{isAr ? "حذف" : "Delete"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={isAr ? "تأكيد حذف الرسالة" : "Confirm Deletion"}
        message={
          pendingDeleteMessage
            ? isAr
              ? `هل أنت متأكد من حذف رسالة «${pendingDeleteMessage.sender}»؟ لا يمكن التراجع عن هذا الإجراء.`
              : `Are you sure you want to delete the message from “${pendingDeleteMessage.sender}”? This action cannot be undone.`
            : isAr
              ? "هل أنت متأكد من حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء."
              : "Are you sure you want to delete this message? This action cannot be undone."
        }
        confirmLabel={isAr ? "حذف الرسالة" : "Delete Message"}
        cancelLabel={isAr ? "إلغاء" : "Cancel"}
        busy={pendingDeleteId !== null && busyId === pendingDeleteId}
        onConfirm={() => {
          if (pendingDeleteId !== null) void handlePerformDelete(pendingDeleteId);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
};
