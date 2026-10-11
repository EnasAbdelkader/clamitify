import type {
  Program, Initiative, Event, Course, Game, Opportunity,
  BlogPost, TeamMember, AdminStats, AnalyticItem, ContactMessage,
  CareerNode, CarbonQuestion, UserProfileResponse, MutationResult,
  ContactSubmitDto, MeetingBookingDto, PartnershipSubmitDto, WorkshopRequestDto,
  EventRegistrationDto, OpportunityApplicationDto, Certificate
} from "../types";

import {
  mockPrograms,
  mockInitiatives,
  mockEvents,
  mockCourses,
  mockGames,
  mockOpportunities,
  mockBlogPosts,
  mockTeam,
  mockCareers,
  mockCarbonQuestions,
  mockUserProfile,
  mockAdminStats,
  mockAdminAnalytics,
  mockAdminMessages
} from "./mockData";

// ==========================================
// ⚙️ Configuration
// ==========================================

/** Base URL for the Flask REST API. MUST include the /api prefix. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000/api";

/**
 * Detect if the app is hosted on a remote domain (e.g. Vercel, Netlify, custom domain)
 * while API_BASE_URL is pointing to localhost / 127.0.0.1.
 * Attempting to fetch 127.0.0.1 from a remote HTTPS host triggers Chrome's Private
 * Network Access (PNA) security prompt ("wants to access other applications and services on this device").
 * We force USE_MOCK_API = true on remote hosts when API_BASE_URL is local to eliminate all local network calls.
 */
const isLocalhostUrl = (url: string) => /https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url);
const isRemoteHost =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1" &&
  window.location.hostname !== "::1";

const shouldForceMockForRemoteHost = isRemoteHost && isLocalhostUrl(API_BASE_URL);

/**
 * When true, NO network request is made and every method resolves with local
 * mock data.
 */
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true" || shouldForceMockForRemoteHost;

/** Abort a request that the server has not answered within this many ms. */
const REQUEST_TIMEOUT_MS = 15000;

// ==========================================
// 🚨 Error type
// ==========================================

/** Thrown for any non-2xx response, network failure, or timeout. */
export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly body: unknown;

  constructor(message: string, status: number, endpoint: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }

  /** True when the failure is a connectivity/timeout problem rather than an HTTP status. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** A message safe to show to an end user, in the requested language. */
  localizedMessage(language: string): string {
    const ar = language === "ar";
    if (this.isNetworkError) {
      return ar
        ? "تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت وحاول مرة أخرى."
        : "Could not reach the server. Check your connection and try again.";
    }
    if (this.status === 401 || this.status === 403) {
      return ar ? "انتهت صلاحية الجلسة أو لا تملك صلاحية لهذا الإجراء." : "Your session expired or you are not allowed to do this.";
    }
    if (this.status === 404) {
      return ar ? "العنصر المطلوب غير موجود." : "The requested item was not found.";
    }
    if (this.status === 422 || this.status === 400) {
      const serverMsg = extractServerMessage(this.body);
      if (serverMsg) return serverMsg;
      return ar ? "البيانات المُرسلة غير صحيحة. راجع الحقول وحاول مرة أخرى." : "The submitted data is invalid. Please review the fields.";
    }
    return ar ? "حدث خطأ في الخادم. برجاء المحاولة لاحقاً." : "A server error occurred. Please try again later.";
  }
}

/** Pull a human message out of whatever error envelope the backend chose to send. */
function extractServerMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    if (typeof b[key] === "string" && b[key]) return b[key] as string;
  }
  return null;
}

// ==========================================
// 🔑 Helpers
// ==========================================

export function sanitizeUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  // Strip characters browsers ignore when resolving a scheme (tab/newline/NUL/spaces)
  // so that "java\tscript:alert(1)" cannot slip past the prefix check.
  const collapsed = trimmed.split("").filter((ch) => ch.charCodeAt(0) > 32).join("").toLowerCase();
  const blocked = ["javascript:", "data:", "vbscript:", "file:"];
  if (blocked.some((scheme) => collapsed.startsWith(scheme))) {
    return "#invalid-url";
  }
  return trimmed;
}

/**
 * اللغة الحالية من <html lang> — طبقة الـ API مش جواها React context،
 * وبتحتاجها لتوطين رسائل الفشل اللي بترجع كنتيجة مباشرة (مش ApiError).
 */
function clientLanguage(): string {
  return (typeof document !== "undefined" && document.documentElement.getAttribute("lang")) || "ar";
}

/**
 * Resolve the bearer token. Admin token wins so the CMS keeps working while an admin is signed in.
 *
 * الوصول لـ localStorage يرمي SecurityError عند حجب التخزين (حظر الكوكيز كلياً) —
 * وبقية طبقات التطبيق تلتف على ذلك بـ try/catch لنفس السبب. هنا الخطر أعظم:
 * رمي الاستثناء داخل authFetch يُفسَّر في request() كفشل شبكة، فتسقط خوادم
 * حقيقية صامتة إلى بيانات الـ mock، وقد يُرجع تسجيل دخول الأدمن جلسة وهمية.
 */
function getToken(endpoint = ""): string | null {
  try {
    if (endpoint.startsWith("/user/")) {
      return localStorage.getItem("user_token") || null;
    }
    if (endpoint.startsWith("/admin/")) {
      return localStorage.getItem("admin_token") || null;
    }
    return localStorage.getItem("admin_token") || localStorage.getItem("user_token");
  } catch {
    return null; // لا جلسة مقروءة — الطلب يُمضى بدون Authorization كما لو التخزين فارغ
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("user_token");
  } catch {
    // التخزين محجوب — لا يوجد ما يُمسح، وفضاء auth_unauthorized يتولى تفكيك الذاكرة.
  }
}

/** Endpoints where a 401 is an expected answer and must NOT tear down the session. */
const AUTH_ENDPOINTS = ["/admin/login", "/admin/change-password", "/auth/login", "/auth/register"];

export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken(endpoint);
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  // Only declare a JSON body when one is actually being sent. Sending
  // Content-Type on a bodyless GET/DELETE forces a CORS preflight on every request.
  if (options.body !== undefined && headers["Content-Type"] === undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  // A 401 on a protected route means the session is gone. A 401 from the login
  // route itself just means the credentials were wrong — do not log the user out.
  if (response.status === 401 && !AUTH_ENDPOINTS.includes(endpoint)) {
    clearTokens();
    window.dispatchEvent(new Event("auth_unauthorized"));
  }

  return response;
}

/**
 * Accept both a bare payload (`[...]` / `{...}`) and the `{ success, data }`
 * envelope documented in types/index.ts, so either backend style works.
 */
function unwrap<T>(json: unknown): T {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const obj = json as Record<string, unknown>;
    if ("data" in obj && "success" in obj) return obj.data as T;
  }
  return json as T;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ==========================================
// 🛡️ High-Concurrency Edge Optimizer & Queue System
// ==========================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL_MS = 10000; // 10 seconds SWR TTL cache for GET requests
const MAX_CONCURRENT_REQUESTS = 20; // Max parallel active HTTP requests

/** In-memory GET response cache (Endpoint -> CacheEntry) */
const apiCache = new Map<string, CacheEntry<unknown>>();

/** In-flight request deduplication map (Endpoint -> Active Promise) */
const inFlightRequests = new Map<string, Promise<unknown>>();

/** Metrics tracking for verification & load testing */
export const apiMetrics = {
  totalCalls: 0,
  cacheHits: 0,
  coalescedHits: 0,
  networkRequests: 0,
  queuedRequests: 0,
  activeRequests: 0,
  reset() {
    this.totalCalls = 0;
    this.cacheHits = 0;
    this.coalescedHits = 0;
    this.networkRequests = 0;
    this.queuedRequests = 0;
    this.activeRequests = 0;
    apiCache.clear();
    inFlightRequests.clear();
  }
};

/** Request queue mechanism for outbound requests */
type QueueTask = () => Promise<void>;
const requestQueue: QueueTask[] = [];

function processNextQueueTask() {
  if (apiMetrics.activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return;
  }
  const task = requestQueue.shift();
  if (task) {
    apiMetrics.activeRequests++;
    task().finally(() => {
      apiMetrics.activeRequests--;
      processNextQueueTask();
    });
  }
}

function enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
  if (apiMetrics.activeRequests < MAX_CONCURRENT_REQUESTS) {
    apiMetrics.activeRequests++;
    return fn().finally(() => {
      apiMetrics.activeRequests--;
      processNextQueueTask();
    });
  }

  apiMetrics.queuedRequests++;
  return new Promise<T>((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const res = await fn();
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/** Clear API cache for specific endpoints or all endpoints on mutations */
export function clearApiCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.startsWith(endpointPrefix)) {
      apiCache.delete(key);
    }
  }
}

/** Resolve after `ms`, used only to keep mock mode feeling asynchronous. */
function mockDelay<T>(value: T, ms = 200): Promise<T> {
  const isTest = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE === "test";
  if (isTest) {
    return Promise.resolve(value);
  }
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * The single network entry point.
 * In mock mode (USE_MOCK_API only) it resolves `mock()`.
 * When the backend answers with an HTTP status, that answer is respected:
 * a non-2xx response is an explicit rejection from a live server, so it is
 * thrown as ApiError instead of being masked by fake mock success — otherwise
 * a 422 on /contact would still render "message sent" and the message would
 * be silently lost. A network failure is thrown as well (contract §0 in
 * docs/API_CONTRACT.md): a silent mock fallback would make a downed real
 * server look healthy and show fake data to real users. Every caller in the
 * app already handles thrown ApiErrors with a retry-able error state.
 */
async function request<T>(endpoint: string, options: RequestInit, mock: () => T, mockMs = 200): Promise<T> {
  if (USE_MOCK_API) {
    return mockDelay(mock(), mockMs);
  }

  let res: Response;
  try {
    res = await authFetch(endpoint, options);
  } catch (err) {
    throw new ApiError(`Network request to ${endpoint} failed`, 0, endpoint, err);
  }

  const body = await parseBody(res);

  if (!res.ok) {
    console.warn(`[API] Request to ${endpoint} failed with status ${res.status}.`);
    throw new ApiError(
      extractServerMessage(body) || `Request to ${endpoint} failed with status ${res.status}`,
      res.status,
      endpoint,
      body
    );
  }

  return unwrap<T>(body);
}

const GET = <T>(endpoint: string, mock: () => T, ms?: number, ttlMs = DEFAULT_TTL_MS): Promise<T> => {
  apiMetrics.totalCalls++;

  // 1. Check TTL cache
  const cached = apiCache.get(endpoint);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    apiMetrics.cacheHits++;
    return Promise.resolve(cached.data as T);
  }

  // 2. Check in-flight coalesced request
  const activePromise = inFlightRequests.get(endpoint);
  if (activePromise) {
    apiMetrics.coalescedHits++;
    return activePromise as Promise<T>;
  }

  // 3. Execute via queue
  const requestPromise = enqueueRequest(() => {
    apiMetrics.networkRequests++;
    return request<T>(endpoint, {}, mock, ms).then((data) => {
      apiCache.set(endpoint, { data, timestamp: Date.now() });
      return data;
    });
  }).finally(() => {
    inFlightRequests.delete(endpoint);
  });

  inFlightRequests.set(endpoint, requestPromise);
  return requestPromise;
};

const SEND = <T>(method: "POST" | "PUT" | "DELETE", endpoint: string, data: unknown, mock: () => T, ms = 300): Promise<T> => {
  apiMetrics.totalCalls++;
  // Invalidate GET cache on mutations
  clearApiCache();

  return enqueueRequest(() => {
    apiMetrics.networkRequests++;
    return request<T>(endpoint, { method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }, mock, ms);
  });
};

/** Client-side id used only by mock mode; the server owns real ids. */
const mockId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `mock-${Date.now()}`;

const okResult = (messageAr: string): MutationResult => ({ success: true, message: messageAr });

// ==========================================
// 🚀 Climatify API Service
//
// Endpoint paths below are the CONTRACT. Admin mutations live under /admin/*
// so Flask can protect them with a single blueprint-level guard.
// ==========================================

export const apiService = {
  // ---------- Public reads ----------
  getPrograms: (): Promise<Program[]> => GET("/programs", () => mockPrograms),

  getProgramById: (id: string): Promise<Program | undefined> =>
    GET(`/programs/${id}`, () => mockPrograms.find((p) => p.id === id)),

  getInitiatives: (): Promise<Initiative[]> => GET("/initiatives", () => mockInitiatives),

  getEvents: (): Promise<Event[]> => GET("/events", () => mockEvents),

  getCourses: (): Promise<Course[]> => GET("/courses", () => mockCourses),

  getGames: (): Promise<Game[]> => GET("/games", () => mockGames),

  getOpportunities: (): Promise<Opportunity[]> => GET("/opportunities", () => mockOpportunities),

  getBlogPosts: (): Promise<BlogPost[]> => GET("/posts", () => mockBlogPosts),

  getBlogPostById: (id: string): Promise<BlogPost | undefined> =>
    GET(`/posts/${id}`, () => mockBlogPosts.find((p) => p.id === id)),

  getTeam: (): Promise<TeamMember[]> => GET("/team", () => mockTeam),

  getCareerPathways: (): Promise<CareerNode[]> => GET("/careers", () => mockCareers),

  getCarbonQuestions: (): Promise<CarbonQuestion[]> => GET("/carbon-questions", () => mockCarbonQuestions),

  /**
   * Awareness curriculum pack.
   * The server may either stream the PDF directly or answer `{ url }` with a
   * redirect target; both shapes are handled by the caller.
   */
  getCurriculaDownloadUrl: (): Promise<{ url: string }> =>
    GET("/curricula/download", () => ({ url: "/climate-curriculum.pdf" })),

  // ---------- Public form submissions ----------
  submitContact: (data: ContactSubmitDto): Promise<MutationResult> =>
    SEND("POST", "/contact", data, () => okResult("تم إرسال رسالتك بنجاح! سيتواصل معك فريق كلايمتيفاي قريباً."), 400),

  bookMeeting: (data: MeetingBookingDto): Promise<MutationResult> =>
    SEND("POST", "/meetings", data, () => okResult("تم حجز الموعد بنجاح! سنرسل لك بريداً إلكترونياً بتفاصيل التأكيد."), 400),

  submitPartnership: (data: PartnershipSubmitDto): Promise<MutationResult> =>
    SEND("POST", "/partnerships", data, () => okResult("تم إرسال طلب الشراكة بنجاح!"), 400),

  submitWorkshopRequest: (data: WorkshopRequestDto): Promise<MutationResult> =>
    SEND("POST", "/workshops", data, () => okResult("تم تسجيل طلب ورشة العمل بنجاح!"), 400),

  registerForEvent: (data: EventRegistrationDto): Promise<MutationResult> =>
    SEND("POST", "/events/register", data, () => okResult("تم التسجيل في الفعالية بنجاح!"), 400),

  applyToOpportunity: (data: OpportunityApplicationDto): Promise<MutationResult> =>
    SEND("POST", "/opportunities/apply", data, () => okResult("تم إرسال طلب التقديم بنجاح!"), 400),

  subscribeNewsletter: (email: string): Promise<MutationResult> =>
    SEND("POST", "/newsletter/subscribe", { email }, () => okResult("تم الاشتراك في النشرة الإخبارية بنجاح!")),

  // ---------- Member profile ----------
  getUserProfile: (): Promise<UserProfileResponse> => GET("/user/profile", () => mockUserProfile, 300),

  updateUserProfile: (data: { name: string; city: string; bio: string }): Promise<MutationResult> =>
    SEND("PUT", "/user/profile", data, () => okResult("تم تحديث الملف الشخصي بنجاح!"), 400),

  saveCarbonFootprint: (footprint: number): Promise<MutationResult> =>
    SEND("POST", "/user/carbon-footprint", { footprint }, () => okResult("تم حفظ النتيجة بنجاح!"), 400),

  getCourseLessons: (courseId: string): Promise<unknown[]> =>
    GET(`/courses/${courseId}/lessons`, () => []),

  saveCourseProgress: (courseId: string, progress: number): Promise<MutationResult> =>
    SEND("POST", `/user/courses/${courseId}/progress`, { progress }, () => okResult("تم حفظ التقدم بنجاح!")),

  addUserEvent: (eventId: string): Promise<MutationResult> =>
    SEND("POST", "/user/events", { eventId }, () => okResult("تمت إضافة الفعالية بنجاح!")),

  cancelUserEvent: (eventId: string): Promise<MutationResult> =>
    SEND("DELETE", `/user/events/${eventId}`, undefined, () => okResult("تم إلغاء التسجيل بنجاح!")),

  saveVirtualTrees: (count: number): Promise<MutationResult> =>
    SEND("POST", "/user/trees", { count }, () => okResult("تم حفظ عدد الأشجار بنجاح!")),

  getImpactHistory: (year?: number): Promise<unknown> =>
    GET(`/user/impact${year ? `?year=${year}` : ""}`, () => ({ history: [] })),

  getBookmarks: (): Promise<unknown[]> => GET("/user/bookmarks", () => []),

  addBookmark: (contentType: string, contentId: string): Promise<unknown> =>
    SEND("POST", "/user/bookmarks", { contentType, contentId }, () => ({ success: true })),

  deleteBookmark: (bookmarkId: string): Promise<MutationResult> =>
    SEND("DELETE", `/user/bookmarks/${bookmarkId}`, undefined, () => okResult("تم حذف العلامة بنجاح!")),

  // ---------- Certificates ----------
  getCertificates: (): Promise<Certificate[]> =>
    GET("/user/certificates", () => []),

  getCertificate: (courseId: string): Promise<Certificate> =>
    GET(`/user/certificates/${courseId}`, () => ({ id: "", certificateId: "", courseId: "", userId: 0, issuedAt: "" })),

  issueCertificate: (courseId: string): Promise<Certificate> =>
    SEND("POST", `/user/courses/${courseId}/certificate`, {}, () => ({ id: "", certificateId: "", courseId: "", userId: 0, issuedAt: "" })),

  // ---------- Admin auth ----------
  /**
   * Signs an administrator in. Returns a discriminated result rather than
   * throwing, because "wrong password" is a normal outcome the form renders.
   * A transport failure throws ApiError with status 0 so it can never be
   * mistaken for a successful session — the store surfaces it as a
   * server problem and the login form shows a retryable error.
   */
  loginAdmin: async (email: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> => {
    if (USE_MOCK_API) {
      await mockDelay(null, 200);
      return { success: true, token: "mock-jwt-token-xyz" };
    }

    let res: Response;
    try {
      res = await authFetch("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });
    } catch (err) {
      throw new ApiError("Network request to /admin/login failed", 0, "/admin/login", err);
    }

    const body = await parseBody(res);

    if (res.ok) {
      const payload = (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
      const token = typeof payload.token === "string" ? payload.token : undefined;
      if (token) return { success: true, token };
      // 200 بدون توكن = رد غير مكتمل من السيرفر، مش دخول ناجح.
      throw new ApiError("Admin login response did not include a token", 500, "/admin/login", body);
    }

    const ar = clientLanguage() === "ar";
    const invalidCredentials = ar
      ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
      : "Invalid email or password.";
    if (res.status === 400 || res.status === 401 || res.status === 422) {
      return { success: false, error: extractServerMessage(body) || invalidCredentials };
    }
    throw new ApiError(
      extractServerMessage(body) || `Admin login failed with status ${res.status}`,
      res.status,
      "/admin/login",
      body
    );
  },

  changeAdminPassword: (data: { currentPassword: string; newPassword: string }): Promise<MutationResult> =>
    SEND("POST", "/admin/change-password", data, () => okResult("تم تحديث كلمة المرور بنجاح!")),

  // ---------- Member auth ----------
  /**
   * Registers a new member account.
   * Returns a discriminated result: `{ success, error }` on bad input (e.g. email
   * taken, weak password), throws ApiError on transport failure so it cannot be
   * mistaken for a validation error.
   */
  registerMember: async (data: { name: string; email: string; password: string }): Promise<{ success: boolean; token?: string; error?: string }> => {
    if (USE_MOCK_API) {
      await mockDelay(null, 400);
      if (!data.email.includes("@") || data.password.length < 6) {
        return {
          success: false,
          error: clientLanguage() === "ar"
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            : "That email or password is not valid"
        };
      }
      return { success: true, token: "mock-member-token-xyz" };
    }

    let res: Response;
    try {
      res = await authFetch("/auth/register", { method: "POST", body: JSON.stringify(data) });
    } catch (err) {
      throw new ApiError("Network request to /auth/register failed", 0, "/auth/register", err);
    }

    const body = await parseBody(res);

    if (res.ok) {
      const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const token = typeof payload.token === "string" ? payload.token : undefined;
      if (!token) {
        throw new ApiError("Member registration response did not include a token", 500, "/auth/register", body);
      }
      clearApiCache("/user");
      return { success: true, token };
    }

    if (res.status === 409 || res.status === 422 || res.status === 400) {
      const ar = clientLanguage() === "ar";
      return {
        success: false,
        error: extractServerMessage(body) || (ar
          ? "البريد الإلكتروني مستخدم بالفعل أو كلمة المرور ضعيفة جداً"
          : "That email is already registered or the password is too weak")
      };
    }
    throw new ApiError(
      extractServerMessage(body) || `Registration failed with status ${res.status}`,
      res.status,
      "/auth/register",
      body
    );
  },

  /**
   * Signs a member in. Returns a discriminated result rather than throwing,
   * because "wrong password" is a normal outcome the form renders.
   * A transport failure still throws so it cannot be mistaken for bad credentials.
   */
  loginMember: async (email: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> => {
    if (USE_MOCK_API) {
      await mockDelay(null, 400);
      if (email.includes("@") && password.length >= 4) {
        return { success: true, token: "mock-member-token-xyz" };
      }
      return {
        success: false,
        error: clientLanguage() === "ar"
          ? "بريد إلكتروني أو كلمة مرور غير صحيحة"
          : "Incorrect email or password"
      };
    }

    let res: Response;
    try {
      res = await authFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    } catch (err) {
      throw new ApiError("Network request to /auth/login failed", 0, "/auth/login", err);
    }

    const body = await parseBody(res);
    const payload = (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
    const token = typeof payload.token === "string" ? payload.token : undefined;

    if (res.ok && token) {
      clearApiCache("/user");
      return { success: true, token };
    }
    if (res.status === 401 || res.status === 400 || res.status === 422) {
      const ar = clientLanguage() === "ar";
      return {
        success: false,
        error: extractServerMessage(body) || (ar
          ? "بريد إلكتروني أو كلمة مرور غير صحيحة"
          : "Incorrect email or password")
      };
    }
    throw new ApiError(
      extractServerMessage(body) || `Login failed with status ${res.status}`,
      res.status,
      "/auth/login",
      body
    );
  },

  // ---------- Admin dashboard ----------
  getAdminStats: (): Promise<AdminStats> => GET("/admin/stats", () => mockAdminStats),

  getAdminAnalytics: (): Promise<AnalyticItem[]> => GET("/admin/analytics", () => mockAdminAnalytics),

  getAdminMessages: (): Promise<ContactMessage[]> => GET("/admin/messages", () => mockAdminMessages),

  markMessageRead: (id: string, isRead: boolean = true): Promise<{ success: boolean }> =>
    SEND("PUT", `/admin/messages/${id}/read`, { isRead }, () => ({ success: true }), 200),

  deleteMessage: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/messages/${id}`, undefined, () => ({ success: true }), 200),

  saveAdminSettings: (data: { siteName: string; contactEmail: string; enableMaintenance: boolean }): Promise<{ success: boolean }> =>
    SEND("POST", "/admin/settings", data, () => ({ success: true })),

  getAdminSettings: (): Promise<{ siteName: string; contactEmail: string; enableMaintenance: boolean }> =>
    GET("/admin/settings", () => ({
      siteName: "Climatify",
      contactEmail: "info@climatify-youth.com",
      enableMaintenance: false,
    })),

  // ---------- Admin CMS CRUD ----------
  createEvent: (data: Omit<Event, "id" | "registeredCount">): Promise<Event> =>
    SEND("POST", "/admin/events", data, () => ({ id: mockId(), registeredCount: 0, ...data })),

  updateEvent: (id: string, data: Partial<Event>): Promise<Event> =>
    SEND("PUT", `/admin/events/${id}`, data, () => ({ id, registeredCount: 0, ...data }) as Event),

  deleteEvent: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/events/${id}`, undefined, () => ({ success: true }), 200),

  createBlogPost: (data: Omit<BlogPost, "id">): Promise<BlogPost> =>
    SEND("POST", "/admin/posts", data, () => ({ id: mockId(), ...data })),

  updateBlogPost: (id: string, data: Partial<BlogPost>): Promise<BlogPost> =>
    SEND("PUT", `/admin/posts/${id}`, data, () => ({ id, ...data }) as BlogPost),

  deleteBlogPost: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/posts/${id}`, undefined, () => ({ success: true }), 200),

  createProgram: (data: Omit<Program, "id">): Promise<Program> =>
    SEND("POST", "/admin/programs", data, () => ({ id: mockId(), ...data })),

  updateProgram: (id: string, data: Partial<Program>): Promise<Program> =>
    SEND("PUT", `/admin/programs/${id}`, data, () => ({ id, ...data }) as Program),

  deleteProgram: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/programs/${id}`, undefined, () => ({ success: true }), 200),

  createInitiative: (data: Omit<Initiative, "id">): Promise<Initiative> =>
    SEND("POST", "/admin/initiatives", data, () => ({ id: mockId(), ...data })),

  updateInitiative: (id: string, data: Partial<Initiative>): Promise<Initiative> =>
    SEND("PUT", `/admin/initiatives/${id}`, data, () => ({ id, ...data }) as Initiative),

  deleteInitiative: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/initiatives/${id}`, undefined, () => ({ success: true }), 200),

  createCourse: (data: Omit<Course, "id">): Promise<Course> =>
    SEND("POST", "/admin/courses", data, () => ({ id: mockId(), ...data })),

  updateCourse: (id: string, data: Partial<Course>): Promise<Course> =>
    SEND("PUT", `/admin/courses/${id}`, data, () => ({ id, ...data }) as Course),

  deleteCourse: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/courses/${id}`, undefined, () => ({ success: true }), 200),

  createOpportunity: (data: Omit<Opportunity, "id">): Promise<Opportunity> =>
    SEND("POST", "/admin/opportunities", data, () => ({ id: mockId(), ...data })),

  updateOpportunity: (id: string, data: Partial<Opportunity>): Promise<Opportunity> =>
    SEND("PUT", `/admin/opportunities/${id}`, data, () => ({ id, ...data }) as Opportunity),

  deleteOpportunity: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/opportunities/${id}`, undefined, () => ({ success: true }), 200),

  createTeamMember: (data: Omit<TeamMember, "id">): Promise<TeamMember> =>
    SEND("POST", "/admin/team", data, () => ({ id: mockId(), ...data })),

  updateTeamMember: (id: string, data: Partial<TeamMember>): Promise<TeamMember> =>
    SEND("PUT", `/admin/team/${id}`, data, () => ({ id, ...data }) as TeamMember),

  deleteTeamMember: (id: string): Promise<{ success: boolean }> =>
    SEND("DELETE", `/admin/team/${id}`, undefined, () => ({ success: true }), 200),

  // ---------- AI assistant ----------
  sendAIChatMessage: (text: string, language: string): Promise<{ success: boolean; reply: string }> =>
    SEND("POST", "/ai/chat", { prompt: text, language }, () => ({
      success: true,
      reply: mockAIReply(text, language),
    }), 300),
};

/** Keyword responder used only in mock mode so the assistant is demoable offline. */
function mockAIReply(text: string, language: string): string {
  const input = text.toLowerCase().trim();
  if (language === "ar") {
    if (input.includes("بصمة") || input.includes("كربون"))
      return "البصمة الكربونية هي إجمالي الانبعاثات الناتجة عن أنشطتنا. يمكنك استخدام 'حاسبة الكربون' في صفحة ألعاب المناخ لحساب بصمتك بدقة والحصول على خطة خفض مخصصة!";
    if (input.includes("شجر") || input.includes("زراعة") || input.includes("غاف"))
      return "نحن ننظم حملات لزراعة شجر الغاف في الإمارات لتعزيز التنوع البيئي ومكافحة التصحر. يمكنك التطوع في حملاتنا القادمة من خلال صفحة الفعاليات!";
    if (input.includes("تطوع") || input.includes("فرص") || input.includes("عمل"))
      return "لدينا العديد من الفرص للشباب مثل التدريب الداخلي، التطوع، والزمالات المناخية. يمكنك تصفحها والتقديم عليها مباشرة من خلال قسم الفرص بالموقع!";
    if (input.includes("مسابقة") || input.includes("ألعاب"))
      return "ألعاب المناخ لدينا تشمل AgriClash — لعبة جماعية تعليمية عن الزراعة المستدامة والأمن الغذائي تُقام ضمن فعالياتنا — إضافة إلى محاكي حساب البصمة ولعبة زراعة الغاف التفاعلية. العبها لتجميع النقاط والحصول على شهادات معتمدة!";
    return "سؤال رائع! العمل المناخي يبدأ بخطوات بسيطة كتقليل استهلاك البلاستيك، ترشيد الطاقة، ودعم مبادرات الرقمنة المناخية التي نقودها في كلايمتيفاي. هل تود معرفة المزيد عن برامجنا؟";
  }
  if (input.includes("carbon") || input.includes("footprint"))
    return "Carbon footprint is the total emissions caused by our actions. You can use our Carbon Calculator in the Games Hub to calculate yours and get a personalized reduction plan!";
  if (input.includes("tree") || input.includes("plant") || input.includes("ghaf"))
    return "We organize Ghaf tree planting campaigns across the UAE to combat desertification and promote biodiversity. You can volunteer for our next drive in the Events page!";
  if (input.includes("volunteer") || input.includes("job") || input.includes("opportunity"))
    return "We offer exciting opportunities for youth including internships, volunteering, and climate fellowships. Browse and apply directly through the Opportunities section!";
  if (input.includes("game") || input.includes("play"))
    return "Our Games Hub features AgriClash — a team-based educational game about sustainable agriculture and food security played at our events — alongside the Carbon Calculator and the interactive Ghaf Garden. Play to earn environmental points and get certified certificates!";
  return "Great question! Climate action starts with daily habits: reducing plastic use, saving energy, and supporting climate digitization. Would you like to know more about our programs?";
}
