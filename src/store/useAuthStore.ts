import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { apiService, ApiError, clearApiCache } from "../services/api";
import type {
  EventRegistrationAttendee,
  MemberAuthResult,
  StoreActionResult,
  UserActivity,
  UserCourse,
  UserEvent,
  UserProfile,
  UserStats
} from "../types";

// ==========================================
// 🔒 Storage that can never throw
// Safari private mode / blocked cookies make localStorage throw on access.
// A crash here would take the whole app down before it renders.
// ==========================================

const memoryFallback = new Map<string, string>();

function safeGet(name: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(name);
  } catch {
    return memoryFallback.get(name) ?? null;
  }
}

function safeSet(name: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(name, value);
  } catch {
    // التخزين متقفل (وضع التصفح الخاص مثلاً) — بنكمل في الذاكرة بس من غير ما نكسر التطبيق
    memoryFallback.set(name, value);
  }
}

function safeRemove(name: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  } catch {
    memoryFallback.delete(name);
  }
}

const safeStorage: StateStorage = {
  getItem: safeGet,
  setItem: safeSet,
  removeItem: safeRemove
};

const readToken = safeGet;
const writeToken = safeSet;
const dropToken = safeRemove;

// ==========================================
// 🎫 Token validity
// ==========================================

/**
 * Base64url-decodes a JWT payload and returns its `exp` claim in seconds.
 * Returns null for anything that is not a decodable three-part JWT.
 */
function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    if (!parsed || typeof parsed !== "object") return null;
    const exp = (parsed as Record<string, unknown>).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/**
 * A stored string is NOT a session. Only a JWT whose `exp` is still in the
 * future counts. An opaque non-JWT token is accepted in mock mode only,
 * because that is the one place a fake token is legitimate.
 */
function isTokenUsable(token: string | null): boolean {
  if (!token) return false;
  if (token === "mock-jwt-token-xyz" || token.startsWith("mock-")) return true;
  const exp = decodeJwtExp(token);
  if (exp === null) return false;
  return exp * 1000 > Date.now();
}

// ==========================================
// 📡 auth_unauthorized listener (module scope, properly detachable)
// ==========================================

let unauthorizedListenerAttached = false;

function attachUnauthorizedListener(onUnauthorized: () => void): () => void {
  if (typeof window === "undefined" || unauthorizedListenerAttached) {
    return () => {};
  }
  unauthorizedListenerAttached = true;
  const handler = () => onUnauthorized();
  window.addEventListener("auth_unauthorized", handler);
  return () => {
    window.removeEventListener("auth_unauthorized", handler);
    unauthorizedListenerAttached = false;
  };
}

// ==========================================
// 🧮 Merge helpers — local progress must survive a profile load
// ==========================================

const MAX_ACTIVITIES = 20;

const ZERO_STATS: UserStats = { ecoPoints: 0, virtualTrees: 0, earnedBadges: 0 };

/** Never trust a number off the wire. */
const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** كل عدّاد بياخد الأعلى بين السيرفر والمحلي — عشان مفيش نقطة تضيع. */
function mergeStats(local: UserStats | null, server: UserStats | null | undefined): UserStats {
  const s: UserStats = {
    ecoPoints: num(server?.ecoPoints),
    virtualTrees: num(server?.virtualTrees),
    earnedBadges: num(server?.earnedBadges)
  };
  if (!local) return s;
  return {
    ecoPoints: Math.max(num(local.ecoPoints), s.ecoPoints),
    virtualTrees: Math.max(num(local.virtualTrees), s.virtualTrees),
    earnedBadges: Math.max(num(local.earnedBadges), s.earnedBadges)
  };
}

/** اتحاد القائمتين بالـ id — سجل السيرفر هو اللي بيكسب لو الاتنين موجودين. */
function mergeById<T extends { id: string }>(local: T[], server: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of local) {
    if (item && typeof item.id === "string") byId.set(item.id, item);
  }
  for (const item of server) {
    if (item && typeof item.id === "string") byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

/**
 * نفس فكرة mergeById للمساقات، بس النسبة بتاخد الأعلى:
 * لو الطالب خلّص 100% على الجهاز ده والسيرفر لسه شايفه 33%، ما ينفعش نرجّعه لورا.
 */
function mergeCourses(local: UserCourse[], server: UserCourse[]): UserCourse[] {
  const localById = new Map(local.filter((c) => c && typeof c.id === "string").map((c) => [c.id, c]));
  const merged = mergeById(local, server);
  return merged.map((course) => {
    const localCourse = localById.get(course.id);
    if (!localCourse) return course;
    return { ...course, progress: Math.max(num(course.progress), num(localCourse.progress)) };
  });
}

/**
 * الأنشطة المحلية بتيجي الأول لأنها الأحدث (اتولدت على الجهاز ده دلوقتي)،
 * وبعدين سجل السيرفر، مع شيل المكرر بالـ id وسقف 20 عنصر.
 */
function mergeActivities(local: UserActivity[], server: UserActivity[]): UserActivity[] {
  const seen = new Set<string>();
  const merged: UserActivity[] = [];
  for (const activity of [...local, ...server]) {
    if (!activity || typeof activity.id !== "string" || seen.has(activity.id)) continue;
    seen.add(activity.id);
    merged.push(activity);
  }
  return merged.slice(0, MAX_ACTIVITIES);
}

/** ids فريدة حتى لو اتولد أكتر من نشاط في نفس الملّي ثانية — الـ dedupe بيعتمد عليها. */
let activitySeq = 0;
const activityId = (): string => `act-${Date.now()}-${(activitySeq += 1)}`;

const pushActivity = (list: UserActivity[], activity: UserActivity): UserActivity[] =>
  [activity, ...list].slice(0, MAX_ACTIVITIES);

/** اللغة الحالية من <html lang> — الـ store مش جواه React context. */
const currentLanguage = (): string =>
  (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ar";

function toMessage(err: unknown, fallbackAr: string, fallbackEn: string): string {
  const language = currentLanguage();
  if (err instanceof ApiError) return err.localizedMessage(language);
  return language === "ar" ? fallbackAr : fallbackEn;
}

// ==========================================
// 🗃️ Store
// ==========================================

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  /** جلسة الأدمن — localStorage key: admin_token */
  isMemberAuthenticated: boolean;
  memberToken: string | null;
  profile: UserProfile | null;
  stats: UserStats | null;
  recentActivities: UserActivity[];
  registeredCourses: UserCourse[];
  registeredEvents: UserEvent[];
  /** المساقات اللي اتصرفت مكافأة إتمامها قبل كده — بتمنع تكرار الـ +100 والشارة. */
  completedCourseIds: string[];
  /** هل الـ +50 بتاعة البصمة الكربونية اتصرفت قبل كده؟ */
  carbonCreditAwarded: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  loginAdmin: (email: string, password: string) => Promise<MemberAuthResult>;
  logoutAdmin: () => void;
  registerMember: (data: { name: string; email: string; password: string }) => Promise<MemberAuthResult>;
  loginMember: (email: string, password: string) => Promise<MemberAuthResult>;
  logoutMember: () => void;
  loadUserProfile: () => Promise<void>;
  updateUserProfile: (data: { name: string; city: string; bio: string }) => Promise<boolean>;
  saveCarbonFootprint: (footprint: number) => Promise<boolean>;
  registerForEvent: (
    event: { id: string; titleAr: string; titleEn: string; date: string },
    attendee: EventRegistrationAttendee
  ) => Promise<StoreActionResult>;
  cancelEventRegistration: (eventId: string) => void;
  updateCourseProgress: (courseId: string, titleAr: string, titleEn: string, progress: number) => void;
  plantVirtualTree: (treeNameAr: string, treeNameEn: string, costPoints: number) => boolean;
  /** Returns an unsubscribe function for the `auth_unauthorized` listener. */
  initializeAuth: () => () => void;
  clearError: () => void;
}

/** الحقول اللي بتتخزن على الجهاز — من غير أي حاجة ليها علاقة بالجلسة أو التحميل. */
type PersistedAuthState = Pick<
  AuthState,
  "stats" | "recentActivities" | "registeredCourses" | "registeredEvents" | "completedCourseIds" | "carbonCreditAwarded"
>;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      isMemberAuthenticated: false,
      memberToken: null,
      profile: null,
      stats: null,
      recentActivities: [],
      registeredCourses: [],
      registeredEvents: [],
      completedCourseIds: [],
      carbonCreditAwarded: false,
      loading: false,
      error: null,

      clearError: () => set({ error: null }),

      initializeAuth: () => {
        const adminToken = readToken("admin_token");
        if (isTokenUsable(adminToken)) {
          set({ isAuthenticated: true, token: adminToken });
        } else if (adminToken) {
          // توكن موجود بس منتهي أو مش JWT — منظفه بدل ما نفضل فاكرين إن في جلسة
          dropToken("admin_token");
          set({ isAuthenticated: false, token: null });
        }

        const memberToken = readToken("user_token");
        if (isTokenUsable(memberToken)) {
          set({ isMemberAuthenticated: true, memberToken });
        } else if (memberToken) {
          dropToken("user_token");
          set({ isMemberAuthenticated: false, memberToken: null });
        }

        return attachUnauthorizedListener(() => {
          clearApiCache("/user");
          dropToken("admin_token");
          dropToken("user_token");
          set({ isAuthenticated: false, token: null, isMemberAuthenticated: false, memberToken: null, profile: null });
        });
      },

      loginAdmin: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.loginAdmin(email, password);
          if (response.success && response.token) {
            // الـ store هو الكاتب الوحيد للتوكن — api.ts بقى بيقراه بس
            writeToken("admin_token", response.token);
            set({ isAuthenticated: true, token: response.token, loading: false });
            return { ok: true };
          }
          // كريدنشيالز غلط — مش مشكلة سيرفر
          const error = response.error || "بيانات الدخول غير صحيحة";
          set({ error, loading: false });
          return { ok: false, error, isServerProblem: false };
        } catch (err) {
          // فشل شبكة/سيرفر — دي مشكلة سيرفر فعلاً
          const error = toMessage(err, "تعذّر تسجيل الدخول. حاول مرة أخرى.", "Sign-in failed. Please try again.");
          set({ error, loading: false });
          return { ok: false, error, isServerProblem: true };
        }
      },

      logoutAdmin: () => {
        // الجلستان مستقلتان: الخروج من الـ CMS يجب ألا يمس user_token —
        // المسح كان يترك عضوًا مسجّل الدخول بلا توكن بينما الواجهة ما زالت
        // تعرضه كمسجّل، فأول طلب لاحق يفشل ويعيده قسرًا للخروج.
        // الهدم الكامل للجلستين هو مسؤولية مستمع auth_unauthorized وحده.
        dropToken("admin_token");
        set({ isAuthenticated: false, token: null, error: null });
      },

      registerMember: async (data) => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.registerMember(data);
          if (response.success && response.token) {
            clearApiCache("/user");
            dropToken("user_token");
            writeToken("user_token", response.token);
            set({
              isMemberAuthenticated: true,
              memberToken: response.token,
              profile: null,
              stats: null,
              recentActivities: [],
              registeredCourses: [],
              registeredEvents: [],
              completedCourseIds: [],
              carbonCreditAwarded: false,
              loading: false
            });
            await get().loadUserProfile();
            return { ok: true };
          }
          const error = response.error || "تعذّر إنشاء الحساب.";
          set({ error, loading: false });
          return { ok: false, error, isServerProblem: false };
        } catch (err) {
          const error = toMessage(err, "تعذّر إنشاء الحساب. حاول مرة أخرى.", "Could not create your account. Please try again.");
          set({ error, loading: false });
          return { ok: false, error, isServerProblem: true };
        }
      },

      loginMember: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.loginMember(email, password);
          if (response.success && response.token) {
            clearApiCache("/user");
            dropToken("user_token");
            writeToken("user_token", response.token);
            set({
              isMemberAuthenticated: true,
              memberToken: response.token,
              profile: null,
              stats: null,
              recentActivities: [],
              registeredCourses: [],
              registeredEvents: [],
              completedCourseIds: [],
              carbonCreditAwarded: false,
              loading: false
            });
            await get().loadUserProfile();
            return { ok: true };
          }
          const error = response.error || "بيانات الدخول غير صحيحة";
          set({ error, loading: false });
          return { ok: false, error, isServerProblem: false };
        } catch (err) {
          const error = toMessage(err, "تعذّر تسجيل الدخول. حاول مرة أخرى.", "Sign-in failed. Please try again.");
          set({ error, loading: false });
          return { ok: false, error, isServerProblem: true };
        }
      },

      logoutMember: () => {
        clearApiCache("/user");
        dropToken("user_token");
        // بيانات التقدّم بتتخزن على الجهاز (partialize) — لو فضلت بعد الخروج،
        // أول عضو يسجّل دخول على نفس الجهاز هيلاقي نقاط وتذاكر صاحب الحساب السابق
        // وبتتدمج مع بياناته في loadUserProfile. فبنمسحها مع الجلسة نفسها.
        set({
          isMemberAuthenticated: false,
          memberToken: null,
          profile: null,
          stats: null,
          recentActivities: [],
          registeredCourses: [],
          registeredEvents: [],
          completedCourseIds: [],
          carbonCreditAwarded: false,
          error: null
        });
      },

      loadUserProfile: async () => {
        set({ loading: true, error: null });
        try {
          const data = await apiService.getUserProfile();
          const state = get();
          set({
            // بيانات البروفايل نفسها: السيرفر دايماً هو المرجع
            profile: {
              name: typeof data?.name === "string" ? data.name : "",
              email: typeof data?.email === "string" ? data.email : "",
              city: typeof data?.city === "string" ? data.city : "",
              bio: typeof data?.bio === "string" ? data.bio : ""
            },
            // أما التقدّم فبيتدمج — تحميل البروفايل ما ينفعش يمسح مجهود اليوزر
            stats: mergeStats(state.stats, data?.stats),
            recentActivities: mergeActivities(
              state.recentActivities,
              asArray<UserActivity>(data?.recentActivities)
            ),
            registeredCourses: mergeCourses(
              state.registeredCourses,
              asArray<UserCourse>(data?.registeredCourses)
            ),
            registeredEvents: mergeById(
              state.registeredEvents,
              asArray<UserEvent>(data?.registeredEvents)
            ),
            loading: false
          });
        } catch (err) {
          set({
            error: toMessage(err, "تعذّر تحميل الملف الشخصي.", "Could not load your profile."),
            loading: false
          });
        }
      },

      updateUserProfile: async (profileData) => {
        set({ loading: true, error: null });
        try {
          await apiService.updateUserProfile(profileData);
          set((state) => ({
            profile: state.profile ? { ...state.profile, ...profileData } : null,
            loading: false
          }));
          return true;
        } catch (err) {
          set({
            error: toMessage(err, "تعذّر حفظ الملف الشخصي.", "Could not save your profile."),
            loading: false
          });
          return false;
        }
      },

      saveCarbonFootprint: async (footprint) => {
        set({ error: null });
        try {
          await apiService.saveCarbonFootprint(footprint);
        } catch (err) {
          set({
            error: toMessage(err, "تعذّر حفظ نتيجة البصمة الكربونية.", "Could not save your carbon footprint.")
          });
          return false;
        }

        const state = get();
        // المكافأة مرة واحدة بس — قبل كده كل ضغطة كانت بتدي 50 نقطة
        const awardPoints = state.carbonCreditAwarded ? 0 : 50;
        // لو stats لسه null بنبدأها من الصفر، عشان الرصيد يتسجّل فعلاً
        // بدل ما نرجّع true ومحصلش حاجة
        const baseStats = state.stats ?? { ...ZERO_STATS };

        set({
          carbonCreditAwarded: true,
          stats: { ...baseStats, ecoPoints: baseStats.ecoPoints + awardPoints },
          recentActivities: pushActivity(state.recentActivities, {
            id: activityId(),
            titleAr: "حساب البصمة الكربونية",
            titleEn: "Carbon Footprint Calculation",
            detailAr: `تم حساب بصمتك الكربونية: ${footprint} طن/سنوياً${awardPoints ? ` (+${awardPoints} نقطة)` : ""}`,
            detailEn: `Calculated carbon footprint: ${footprint} tons/yr${awardPoints ? ` (+${awardPoints} points)` : ""}`
          })
        });
        return true;
      },

      registerForEvent: async (event, attendee) => {
        const state = get();
        if (state.registeredEvents.some((e) => e.id === event.id)) {
          return {
            ok: false,
            error: currentLanguage() === "ar" ? "أنت مسجّل في الفعالية دي بالفعل." : "You are already registered for this event."
          };
        }

        try {
          await apiService.registerForEvent({
            eventId: event.id,
            name: attendee.name,
            email: attendee.email,
            phone: attendee.phone
          });
        } catch (err) {
          const message = toMessage(err, "تعذّر إتمام التسجيل في الفعالية.", "Could not complete the event registration.");
          set({ error: message });
          return { ok: false, error: message };
        }

        // الحالة المحلية ما بتتغيرش غير بعد ما السيرفر يأكد
        const after = get();
        const baseStats = after.stats ?? { ...ZERO_STATS };
        const newEvent: UserEvent = {
          id: event.id,
          titleAr: event.titleAr,
          titleEn: event.titleEn,
          date: event.date,
          status: "Confirmed"
        };

        set({
          error: null,
          registeredEvents: [newEvent, ...after.registeredEvents],
          stats: { ...baseStats, ecoPoints: baseStats.ecoPoints + 20 },
          recentActivities: pushActivity(after.recentActivities, {
            id: activityId(),
            titleAr: "تسجيل في فعالية بيئية",
            titleEn: "Event Registration",
            detailAr: `تم التسجيل بنجاح في فعالية ${event.titleAr}`,
            detailEn: `Registered successfully for ${event.titleEn}`
          })
        });
        return { ok: true };
      },

      // TODO(backend): needs DELETE /api/user/events/<id>
      // مفيش endpoint للإلغاء لحد دلوقتي، فالإلغاء محلي بس — السيرفر لسه شايف اليوزر مسجّل.
      cancelEventRegistration: (eventId) => {
        const state = get();
        if (state.isMemberAuthenticated) {
          void apiService.cancelUserEvent(eventId).catch(() => undefined);
        }
        set((state) => ({
          registeredEvents: state.registeredEvents.filter((e) => e.id !== eventId)
        }));
      },

      updateCourseProgress: (courseId, titleAr, titleEn, progress) => {
        const clamped = Math.max(0, Math.min(100, Math.round(num(progress))));
        const state = get();
        const existing = state.registeredCourses.find((c) => c.id === courseId);

        // النسبة ما بترجعش لورا
        const nextProgress = existing ? Math.max(num(existing.progress), clamped) : clamped;

        if (state.isMemberAuthenticated) {
          void apiService.saveCourseProgress(courseId, nextProgress).catch(() => undefined);
        }

        const alreadyCompleted = state.completedCourseIds.includes(courseId);
        const justCompleted = nextProgress === 100 && !alreadyCompleted;
        // المكافأة محتاجة تقدّم فعلي أكبر من صفر — التسجيل في مساق بنسبة 0%
        // بيضيفه للقائمة بس من غير نقاط، بدل ما مجرد الضغط على "ابدأ الكورس" يصرف +10.
        const progressAdvanced =
          nextProgress > 0 && (!existing || nextProgress > num(existing.progress));

        // مساق متابع من قبل وبنفس النسبة: مفيش حاجة تتغير ومفيش نقط تتصرف.
        if (existing && !progressAdvanced && !justCompleted) return;

        // .map بدل الإسناد بالـ index — مع noUncheckedIndexedAccess العنصر ممكن يكون undefined
        const updatedCourses: UserCourse[] = existing
          ? state.registeredCourses.map((c) =>
              c.id === courseId ? { ...c, titleAr, titleEn, progress: nextProgress } : c
            )
          : [...state.registeredCourses, { id: courseId, titleAr, titleEn, progress: nextProgress }];

        const bonusPoints = justCompleted ? 100 : progressAdvanced ? 10 : 0;
        const baseStats = state.stats ?? { ...ZERO_STATS };

        set({
          registeredCourses: updatedCourses,
          completedCourseIds: justCompleted
            ? [...state.completedCourseIds, courseId]
            : state.completedCourseIds,
          stats: {
            ...baseStats,
            ecoPoints: baseStats.ecoPoints + bonusPoints,
            earnedBadges: justCompleted ? baseStats.earnedBadges + 1 : baseStats.earnedBadges
          },
          recentActivities:
            progressAdvanced || justCompleted
              ? pushActivity(state.recentActivities, {
                  id: activityId(),
                  titleAr: nextProgress === 100 ? "إتمام مساق تعليمي" : "متابعة دراسة مساق",
                  titleEn: nextProgress === 100 ? "Course Completion" : "Course Progress",
                  detailAr: `${titleAr} (${nextProgress}%)`,
                  detailEn: `${titleEn} (${nextProgress}%)`
                })
              : state.recentActivities
        });
      },

      plantVirtualTree: (treeNameAr, treeNameEn, costPoints) => {
        const state = get();
        const stats = state.stats;
        if (!stats || stats.ecoPoints < costPoints) return false;

        set({
          stats: {
            ...stats,
            ecoPoints: stats.ecoPoints - costPoints,
            virtualTrees: stats.virtualTrees + 1
          },
          recentActivities: pushActivity(state.recentActivities, {
            id: activityId(),
            titleAr: "زراعة شجرة افتراضية",
            titleEn: "Virtual Tree Planted",
            detailAr: `تم خصم النقاط لزراعة شجرة ${treeNameAr}`,
            detailEn: `Redeemed points to plant ${treeNameEn}`
          })
        });
        if (state.isMemberAuthenticated) {
          void apiService.saveVirtualTrees(1).catch(() => undefined);
        }
        return true;
      }
    }),
    {
      name: "climatify-user",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // التقدّم بس هو اللي بيتخزن. التوكن والجلسة وحالة التحميل والأخطاء
      // عمرها ما تتكتب على الجهاز.
      partialize: (state): PersistedAuthState => ({
        stats: state.stats,
        recentActivities: state.recentActivities,
        registeredCourses: state.registeredCourses,
        registeredEvents: state.registeredEvents,
        completedCourseIds: state.completedCourseIds,
        carbonCreditAwarded: state.carbonCreditAwarded
      })
    }
  )
);
