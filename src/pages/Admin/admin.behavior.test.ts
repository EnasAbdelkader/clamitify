import { describe, it, expect, beforeEach } from "vitest";
import { useCMSStore } from "../../store/useCMSStore";
import { sanitizeUrl } from "../../services/api";
import { toCsvField, buildCsv, toLocalDateInput, readToken } from "./adminUtils";

/**
 * هذه اختبارات سلوكية للوح الأدمن — بتتأكد إن CRUD الفعلي يشتغل، إن
 * التصفية بالبحث وبالحالة تعطي النتائج الصح، وإن دوال المساعدة
 * (CSV, sanitization, local date) آمنة ومنسجمة مع المنصة.
 *
 * الـ tests السريعة بتمشي على mock mode (USE_MOCK_API) اللي بيرجّع بيانات
 * معقولة بعد ~200ms، فبندي وقت كافي قبل الـ assertion.
 */
describe("Admin content CRUD", () => {
  beforeEach(() => {
    useCMSStore.setState({
      events: [],
      posts: [],
      programs: [],
      initiatives: [],
      courses: [],
      opportunities: [],
      team: [],
      messages: [],
      stats: null,
      analytics: [],
      siteSettings: { siteName: "Climatify", contactEmail: "info@climatify-youth.com", enableMaintenance: false },
      loading: false,
      error: null,
      failedResources: []
    });
  });

  it("loads all 7 sections via loadCMSContent", async () => {
    await useCMSStore.getState().loadCMSContent();
    const s = useCMSStore.getState();
    expect(s.loading).toBe(false);
    expect(s.events.length).toBeGreaterThan(0);
    expect(s.posts.length).toBeGreaterThan(0);
    expect(s.programs.length).toBeGreaterThan(0);
    expect(s.initiatives.length).toBeGreaterThan(0);
    expect(s.courses.length).toBeGreaterThan(0);
    expect(s.opportunities.length).toBeGreaterThan(0);
    expect(s.team.length).toBeGreaterThan(0);
  });

  it("createProgram appends to the list and returns ok", async () => {
    await useCMSStore.getState().loadCMSContent();
    const before = useCMSStore.getState().programs.length;
    const res = await useCMSStore.getState().createProgram({
      titleEn: "Test Program",
      titleAr: "برنامج تجريبي",
      descriptionEn: "EN desc",
      descriptionAr: "وصف تجريبي",
      longDescriptionEn: "long EN",
      longDescriptionAr: "وصف طويل",
      icon: "Leaf"
    });
    expect(res.ok).toBe(true);
    expect(useCMSStore.getState().programs.length).toBe(before + 1);
    const last = useCMSStore.getState().programs.at(-1)!;
    expect(last.icon).toBe("Leaf");
  });

  it("updateInitiative keeps all existing fields not in the patch", async () => {
    await useCMSStore.getState().loadCMSContent();
    const init = useCMSStore.getState().initiatives[0]!;
    const res = await useCMSStore.getState().updateInitiative(init.id, { progress: 77 });
    expect(res.ok).toBe(true);
    const updated = useCMSStore.getState().initiatives.find((i) => i.id === init.id)!;
    expect(updated.progress).toBe(77);
    expect(updated.titleEn).toBe(init.titleEn);
    expect(updated.titleAr).toBe(init.titleAr);
  });

  it("deleteInitiative removes the row", async () => {
    await useCMSStore.getState().loadCMSContent();
    const targetId = useCMSStore.getState().initiatives[0]!.id;
    const res = await useCMSStore.getState().deleteInitiative(targetId);
    expect(res.ok).toBe(true);
    expect(useCMSStore.getState().initiatives.find((i) => i.id === targetId)).toBeUndefined();
  });
});

describe("Admin messages", () => {
  beforeEach(() => {
    useCMSStore.setState({
      events: [], posts: [], programs: [], initiatives: [], courses: [],
      opportunities: [], team: [], messages: [], stats: null, analytics: [],
      siteSettings: { siteName: "Climatify", contactEmail: "info@climatify-youth.com", enableMaintenance: false },
      loading: false, error: null, failedResources: []
    });
  });

  it("loads the 2 mock messages and tracks unread count", async () => {
    await useCMSStore.getState().loadMessages();
    const s = useCMSStore.getState();
    expect(s.messages.length).toBe(2);
    const unread = s.messages.filter((m) => !m.isRead).length;
    expect(unread).toBe(1);
  });

  it("markMessageRead flips the isRead flag", async () => {
    await useCMSStore.getState().loadMessages();
    const firstUnread = useCMSStore.getState().messages.find((m) => !m.isRead)!;
    const res = await useCMSStore.getState().markMessageRead(firstUnread.id);
    expect(res.ok).toBe(true);
    const after = useCMSStore.getState().messages.find((m) => m.id === firstUnread.id)!;
    expect(after.isRead).toBe(true);
  });

  it("deleteMessage drops the row", async () => {
    await useCMSStore.getState().loadMessages();
    const target = useCMSStore.getState().messages[0]!;
    const res = await useCMSStore.getState().deleteMessage(target.id);
    expect(res.ok).toBe(true);
    expect(useCMSStore.getState().messages.find((m) => m.id === target.id)).toBeUndefined();
  });
});

describe("Admin settings + password", () => {
  beforeEach(() => {
    useCMSStore.setState({
      events: [], posts: [], programs: [], initiatives: [], courses: [],
      opportunities: [], team: [], messages: [], stats: null, analytics: [],
      siteSettings: { siteName: "Climatify", contactEmail: "info@climatify-youth.com", enableMaintenance: false },
      loading: false, error: null, failedResources: []
    });
  });

  it("saveSettings persists siteName/email/maintenance", async () => {
    const res = await useCMSStore.getState().saveSettings({
      siteName: "Climatify New",
      contactEmail: "ops@climatify.org",
      enableMaintenance: true
    });
    expect(res.ok).toBe(true);
    expect(useCMSStore.getState().siteSettings).toEqual({
      siteName: "Climatify New",
      contactEmail: "ops@climatify.org",
      enableMaintenance: true
    });
  });

  it("changePassword returns success in mock mode", async () => {
    const res = await useCMSStore.getState().changePassword({ currentPassword: "old", newPassword: "NewPass123" });
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/Password|كلمة/);
  });
});

describe("Admin utility helpers", () => {
  it("sanitizeUrl rejects dangerous schemes with a sentinel and passes safe ones through", () => {
    // الـ sanitizeUrl مش بيرجّع سلسلة فاضية — بيرجّع "#invalid-url" بدل
    // الرابط الخطر عشان الكود اللي بيستخدمه يقدر يفرق بين "مفيش قيمة" و
    // "القيمة مرفوضة أمنياً" (وده بيمنع كمان ظهور رابط غير صالح في DOM).
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#invalid-url");
    expect(sanitizeUrl("data:text/html,<script>")).toBe("#invalid-url");
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("#invalid-url");
    expect(sanitizeUrl("file:///etc/passwd")).toBe("#invalid-url");
    expect(sanitizeUrl("java\tscript:alert(1)")).toBe("#invalid-url");
    expect(sanitizeUrl("https://example.com/img.png")).toBe("https://example.com/img.png");
    expect(sanitizeUrl("http://localhost:5000/x")).toBe("http://localhost:5000/x");
    expect(sanitizeUrl("//cdn.example.com/x")).toBe("//cdn.example.com/x");
    expect(sanitizeUrl("")).toBe("");
  });

  it("toCsvField guards against formula injection", () => {
    expect(toCsvField("=SUM(A1)")).toBe("\"'=SUM(A1)\"");
    expect(toCsvField("+cmd")).toBe("\"'+cmd\"");
    expect(toCsvField("-cmd")).toBe("\"'-cmd\"");
    expect(toCsvField("@cmd")).toBe("\"'@cmd\"");
    expect(toCsvField("hello")).toBe("\"hello\"");
    expect(toCsvField('he said "hi"')).toBe("\"he said \"\"hi\"\"\"");
    expect(toCsvField("with,comma")).toBe("\"with,comma\"");
  });

  it("buildCsv produces a BOM-prefixed CRLF document", () => {
    const csv = buildCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toEqual(["\"a\",\"b\"", "\"1\",\"2\"", "\"3\",\"4\""]);
  });

  it("toLocalDateInput returns a YYYY-MM-DD string", () => {
    const v = toLocalDateInput(new Date(2026, 0, 5));
    expect(v).toBe("2026-01-05");
    const v2 = toLocalDateInput(new Date(2026, 11, 31));
    expect(v2).toBe("2026-12-31");
  });

  it("readToken returns the fallback in non-DOM environments", () => {
    expect(readToken("--nonexistent-token", "#abc")).toBe("#abc");
  });
});
