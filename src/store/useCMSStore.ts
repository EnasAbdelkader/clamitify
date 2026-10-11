import { create } from "zustand";
import { apiService, ApiError } from "../services/api";
import type {
  Event, BlogPost, Program, Initiative, Course, Opportunity, TeamMember,
  ContactMessage, AdminStats, AnalyticItem, StoreActionResult
} from "../types";

// ==========================================
// 🗣️ Localized failure messages
// الـ store مش جواه React context، فبنقرا اللغة من <html lang>.
// ==========================================

const currentLanguage = (): string =>
  (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ar";

function toMessage(err: unknown, fallbackAr: string, fallbackEn: string): string {
  const language = currentLanguage();
  if (err instanceof ApiError) return err.localizedMessage(language);
  return language === "ar" ? fallbackAr : fallbackEn;
}

type ResourceKey =
  | "event" | "post" | "program" | "initiative"
  | "course" | "opportunity" | "teamMember" | "message" | "settings" | "password";

const RESOURCE_LABELS: Record<ResourceKey, { ar: string; en: string }> = {
  event: { ar: "الفعالية", en: "the event" },
  post: { ar: "المقال", en: "the article" },
  program: { ar: "البرنامج", en: "the program" },
  initiative: { ar: "المبادرة", en: "the initiative" },
  course: { ar: "المساق", en: "the course" },
  opportunity: { ar: "الفرصة", en: "the opportunity" },
  teamMember: { ar: "عضو الفريق", en: "the team member" },
  message: { ar: "الرسالة", en: "the message" },
  settings: { ar: "الإعدادات", en: "the settings" },
  password: { ar: "كلمة المرور", en: "the password" }
};

const VERB_LABELS = {
  create: { ar: "إضافة", en: "create" },
  update: { ar: "تعديل", en: "update" },
  delete: { ar: "حذف", en: "delete" },
  save: { ar: "حفظ", en: "save" }
} as const;

type VerbKey = keyof typeof VERB_LABELS;

/** "تعذّر إضافة الفعالية." / "Could not create the event." */
function failure(verb: VerbKey, resource: ResourceKey): [string, string] {
  return [
    `تعذّر ${VERB_LABELS[verb].ar} ${RESOURCE_LABELS[resource].ar}.`,
    `Could not ${VERB_LABELS[verb].en} ${RESOURCE_LABELS[resource].en}.`
  ];
}

/** أسماء الأقسام اللي بتتعرض لو تحميل واحد منها فشل. */
const SECTION_LABELS: Record<string, { ar: string; en: string }> = {
  events: { ar: "الفعاليات", en: "Events" },
  posts: { ar: "المقالات", en: "Articles" },
  programs: { ar: "البرامج", en: "Programs" },
  initiatives: { ar: "المبادرات", en: "Initiatives" },
  courses: { ar: "المساقات", en: "Courses" },
  opportunities: { ar: "الفرص", en: "Opportunities" },
  team: { ar: "الفريق", en: "Team" }
};

/**
 * الباك المفروض يرجّع status غير 2xx لما العملية تفشل، بس لو رجّع 200
 * ومعاها success:false ما ينفعش نعتبرها نجاح.
 */
function assertServerOk(res: { success?: boolean } | null | undefined): void {
  if (res && res.success === false) {
    throw new ApiError("Server reported the operation as failed", 500, "");
  }
}

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

// ==========================================
// 🗃️ Store
// ==========================================

interface CMSState {
  events: Event[];
  posts: BlogPost[];
  programs: Program[];
  initiatives: Initiative[];
  courses: Course[];
  opportunities: Opportunity[];
  team: TeamMember[];
  messages: ContactMessage[];
  stats: AdminStats | null;
  analytics: AnalyticItem[];
  siteSettings: {
    siteName: string;
    contactEmail: string;
    enableMaintenance: boolean;
  };
  loading: boolean;
  error: string | null;
  /** مفاتيح الأقسام اللي فشل تحميلها في آخر نداء لـ loadCMSContent (مثال: ["events","team"]). */
  failedResources: string[];

  // Actions
  loadCMSContent: () => Promise<void>;
  loadAdminStats: () => Promise<void>;
  loadAdminAnalytics: () => Promise<void>;
  loadMessages: () => Promise<void>;
  clearError: () => void;

  // Events CRUD
  createEvent: (data: Omit<Event, "id" | "registeredCount">) => Promise<StoreActionResult>;
  updateEvent: (id: string, data: Partial<Event>) => Promise<StoreActionResult>;
  deleteEvent: (id: string) => Promise<StoreActionResult>;

  // Posts CRUD
  createBlogPost: (data: Omit<BlogPost, "id">) => Promise<StoreActionResult>;
  updateBlogPost: (id: string, data: Partial<BlogPost>) => Promise<StoreActionResult>;
  deleteBlogPost: (id: string) => Promise<StoreActionResult>;

  // Programs CRUD
  createProgram: (data: Omit<Program, "id">) => Promise<StoreActionResult>;
  updateProgram: (id: string, data: Partial<Program>) => Promise<StoreActionResult>;
  deleteProgram: (id: string) => Promise<StoreActionResult>;

  // Initiatives CRUD
  createInitiative: (data: Omit<Initiative, "id">) => Promise<StoreActionResult>;
  updateInitiative: (id: string, data: Partial<Initiative>) => Promise<StoreActionResult>;
  deleteInitiative: (id: string) => Promise<StoreActionResult>;

  // Courses CRUD
  createCourse: (data: Omit<Course, "id">) => Promise<StoreActionResult>;
  updateCourse: (id: string, data: Partial<Course>) => Promise<StoreActionResult>;
  deleteCourse: (id: string) => Promise<StoreActionResult>;

  // Opportunities CRUD
  createOpportunity: (data: Omit<Opportunity, "id">) => Promise<StoreActionResult>;
  updateOpportunity: (id: string, data: Partial<Opportunity>) => Promise<StoreActionResult>;
  deleteOpportunity: (id: string) => Promise<StoreActionResult>;

  // Team CRUD
  createTeamMember: (data: Omit<TeamMember, "id">) => Promise<StoreActionResult>;
  updateTeamMember: (id: string, data: Partial<TeamMember>) => Promise<StoreActionResult>;
  deleteTeamMember: (id: string) => Promise<StoreActionResult>;

  // Messages CRUD
  markMessageRead: (id: string, isRead?: boolean) => Promise<StoreActionResult>;
  deleteMessage: (id: string) => Promise<StoreActionResult>;

  // Settings
  saveSettings: (data: { siteName: string; contactEmail: string; enableMaintenance: boolean }) => Promise<StoreActionResult>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean; message: string }>;
}

export const useCMSStore = create<CMSState>()((set, get) => {
  /**
   * كل عملية كتابة بتعدي من هنا: بتنفذ الشغل، وبتخزن سبب الفشل بلغة المستخدم
   * في `error` وترجّعه كمان في النتيجة — عشان الأدمن يعرف حصل إيه بالظبط.
   */
  const mutate = async (
    work: () => Promise<void>,
    [fallbackAr, fallbackEn]: [string, string]
  ): Promise<StoreActionResult> => {
    try {
      await work();
      set({ error: null });
      return { ok: true };
    } catch (err) {
      const message = toMessage(err, fallbackAr, fallbackEn);
      set({ error: message });
      return { ok: false, error: message };
    }
  };

  return {
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
    siteSettings: {
      siteName: "Climatify",
      contactEmail: "info@climatify-youth.com",
      enableMaintenance: false
    },
    loading: false,
    error: null,
    failedResources: [],

    clearError: () => set({ error: null, failedResources: [] }),

    /**
     * allSettled مش all: endpoint واحد واقع ما ينفعش يفضّي لوحة التحكم كلها.
     * القسم اللي فشل بيفضل على آخر بيانات ناجحة، واسمه بيتسجل في failedResources.
     */
    loadCMSContent: async () => {
      set({ loading: true, error: null, failedResources: [] });

      const [evs, pts, progs, inits, crss, opps, tm] = await Promise.allSettled([
        apiService.getEvents(),
        apiService.getBlogPosts(),
        apiService.getPrograms(),
        apiService.getInitiatives(),
        apiService.getCourses(),
        apiService.getOpportunities(),
        apiService.getTeam()
      ]);

      const failed: string[] = [];
      const previous = get();

      function take<T>(result: PromiseSettledResult<T[]>, key: string, fallback: T[]): T[] {
        if (result.status === "fulfilled") return asArray<T>(result.value);
        failed.push(key);
        return fallback;
      }

      const ar = currentLanguage() === "ar";

      set({
        events: take(evs, "events", previous.events),
        posts: take(pts, "posts", previous.posts),
        programs: take(progs, "programs", previous.programs),
        initiatives: take(inits, "initiatives", previous.initiatives),
        courses: take(crss, "courses", previous.courses),
        opportunities: take(opps, "opportunities", previous.opportunities),
        team: take(tm, "team", previous.team),
        failedResources: [...failed],
        loading: false,
        error: failed.length
          ? ar
            ? `تعذّر تحميل بعض الأقسام: ${failed.map((k) => SECTION_LABELS[k]?.ar ?? k).join("، ")}.`
            : `Some sections failed to load: ${failed.map((k) => SECTION_LABELS[k]?.en ?? k).join(", ")}.`
          : null
      });
    },

    loadAdminStats: async () => {
      try {
        const data = await apiService.getAdminStats();
        set({ stats: data });
      } catch (err) {
        set({ error: toMessage(err, "تعذّر تحميل الإحصائيات.", "Could not load the statistics.") });
      }
    },

    loadAdminAnalytics: async () => {
      try {
        const data = await apiService.getAdminAnalytics();
        set({ analytics: asArray<AnalyticItem>(data) });
      } catch (err) {
        set({ error: toMessage(err, "تعذّر تحميل التحليلات.", "Could not load the analytics.") });
      }
    },

    loadMessages: async () => {
      set({ loading: true, error: null });
      try {
        const data = await apiService.getAdminMessages();
        set({ messages: asArray<ContactMessage>(data), loading: false });
      } catch (err) {
        set({
          error: toMessage(err, "تعذّر تحميل الرسائل.", "Could not load the messages."),
          loading: false
        });
      }
    },

    // Events CRUD
    createEvent: (eventData) =>
      mutate(async () => {
        const created = await apiService.createEvent(eventData);
        set((state) => ({ events: [...state.events, created] }));
      }, failure("create", "event")),

    updateEvent: (id, eventData) =>
      mutate(async () => {
        const updated = await apiService.updateEvent(id, eventData);
        // بندمج فوق السجل الموجود مش بنستبدله: لو الباك رجّع patch جزئي
        // (زي mock fallback)، الحقول الناقصة متضيعش من الليستة.
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updated } : e))
        }));
      }, failure("update", "event")),

    deleteEvent: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteEvent(id));
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
      }, failure("delete", "event")),

    // Posts CRUD
    createBlogPost: (postData) =>
      mutate(async () => {
        const created = await apiService.createBlogPost(postData);
        set((state) => ({ posts: [...state.posts, created] }));
      }, failure("create", "post")),

    updateBlogPost: (id, postData) =>
      mutate(async () => {
        const updated = await apiService.updateBlogPost(id, postData);
        set((state) => ({
          posts: state.posts.map((p) => (p.id === id ? { ...p, ...updated } : p))
        }));
      }, failure("update", "post")),

    deleteBlogPost: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteBlogPost(id));
        set((state) => ({ posts: state.posts.filter((p) => p.id !== id) }));
      }, failure("delete", "post")),

    // Programs CRUD
    createProgram: (programData) =>
      mutate(async () => {
        const created = await apiService.createProgram(programData);
        set((state) => ({ programs: [...state.programs, created] }));
      }, failure("create", "program")),

    updateProgram: (id, programData) =>
      mutate(async () => {
        const updated = await apiService.updateProgram(id, programData);
        set((state) => ({
          programs: state.programs.map((p) => (p.id === id ? { ...p, ...updated } : p))
        }));
      }, failure("update", "program")),

    deleteProgram: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteProgram(id));
        set((state) => ({ programs: state.programs.filter((p) => p.id !== id) }));
      }, failure("delete", "program")),

    // Initiatives CRUD
    createInitiative: (data) =>
      mutate(async () => {
        const created = await apiService.createInitiative(data);
        set((state) => ({ initiatives: [...state.initiatives, created] }));
      }, failure("create", "initiative")),

    updateInitiative: (id, data) =>
      mutate(async () => {
        const updated = await apiService.updateInitiative(id, data);
        set((state) => ({
          initiatives: state.initiatives.map((item) => (item.id === id ? { ...item, ...updated } : item))
        }));
      }, failure("update", "initiative")),

    deleteInitiative: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteInitiative(id));
        set((state) => ({ initiatives: state.initiatives.filter((item) => item.id !== id) }));
      }, failure("delete", "initiative")),

    // Courses CRUD
    createCourse: (data) =>
      mutate(async () => {
        const created = await apiService.createCourse(data);
        set((state) => ({ courses: [...state.courses, created] }));
      }, failure("create", "course")),

    updateCourse: (id, data) =>
      mutate(async () => {
        const updated = await apiService.updateCourse(id, data);
        set((state) => ({
          courses: state.courses.map((item) => (item.id === id ? { ...item, ...updated } : item))
        }));
      }, failure("update", "course")),

    deleteCourse: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteCourse(id));
        set((state) => ({ courses: state.courses.filter((item) => item.id !== id) }));
      }, failure("delete", "course")),

    // Opportunities CRUD
    createOpportunity: (data) =>
      mutate(async () => {
        const created = await apiService.createOpportunity(data);
        set((state) => ({ opportunities: [...state.opportunities, created] }));
      }, failure("create", "opportunity")),

    updateOpportunity: (id, data) =>
      mutate(async () => {
        const updated = await apiService.updateOpportunity(id, data);
        set((state) => ({
          opportunities: state.opportunities.map((item) => (item.id === id ? { ...item, ...updated } : item))
        }));
      }, failure("update", "opportunity")),

    deleteOpportunity: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteOpportunity(id));
        set((state) => ({ opportunities: state.opportunities.filter((item) => item.id !== id) }));
      }, failure("delete", "opportunity")),

    // Team CRUD
    createTeamMember: (data) =>
      mutate(async () => {
        const created = await apiService.createTeamMember(data);
        set((state) => ({ team: [...state.team, created] }));
      }, failure("create", "teamMember")),

    updateTeamMember: (id, data) =>
      mutate(async () => {
        const updated = await apiService.updateTeamMember(id, data);
        set((state) => ({
          team: state.team.map((item) => (item.id === id ? { ...item, ...updated } : item))
        }));
      }, failure("update", "teamMember")),

    deleteTeamMember: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteTeamMember(id));
        set((state) => ({ team: state.team.filter((item) => item.id !== id) }));
      }, failure("delete", "teamMember")),

    // Messages CRUD
    markMessageRead: (id, isRead = true) =>
      mutate(async () => {
        assertServerOk(await apiService.markMessageRead(id, isRead));
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, isRead } : m))
        }));
      }, ["تعذّر تحديث حالة الرسالة.", "Could not update the message status."]),

    deleteMessage: (id) =>
      mutate(async () => {
        assertServerOk(await apiService.deleteMessage(id));
        set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }));
      }, failure("delete", "message")),

    // Settings
    saveSettings: (settingsData) =>
      mutate(async () => {
        assertServerOk(await apiService.saveAdminSettings(settingsData));
        set({ siteSettings: settingsData });
      }, failure("save", "settings")),

    changePassword: async (passwordData) => {
      try {
        const res = await apiService.changeAdminPassword(passwordData);
        set({ error: null });
        return {
          success: res.success !== false,
          message: res.message || (currentLanguage() === "ar" ? "تم تحديث كلمة المرور بنجاح!" : "Password updated successfully!")
        };
      } catch (err) {
        const message = toMessage(err, ...failure("update", "password"));
        set({ error: message });
        return { success: false, message };
      }
    }
  };
});
