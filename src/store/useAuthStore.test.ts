import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./useAuthStore";

describe("useAuthStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      isAuthenticated: false,
      token: null,
      isMemberAuthenticated: false,
      memberToken: null,
      profile: null,
      stats: { ecoPoints: 0, virtualTrees: 0, earnedBadges: 0 },
      recentActivities: [],
      registeredCourses: [],
      registeredEvents: [],
      completedCourseIds: [],
      carbonCreditAwarded: false,
      loading: false,
      error: null
    });
  });

  it("awards carbon footprint credit points only once", async () => {
    const store = useAuthStore.getState();
    await store.saveCarbonFootprint(2.5);

    let updated = useAuthStore.getState();
    expect(updated.carbonCreditAwarded).toBe(true);
    expect(updated.stats?.ecoPoints).toBe(50);

    // Second call should not award points again
    await store.saveCarbonFootprint(2.5);
    updated = useAuthStore.getState();
    expect(updated.stats?.ecoPoints).toBe(50);
  });

  it("prevents registering for the same event twice", async () => {
    const event = { id: "ev-1", titleAr: "فعالية الشجر", titleEn: "Tree Event", date: "2026-08-01" };
    const attendee = { name: "Ahmad", email: "ahmad@example.com", phone: "123456" };

    const store = useAuthStore.getState();
    const res1 = await store.registerForEvent(event, attendee);
    expect(res1.ok).toBe(true);
    expect(useAuthStore.getState().registeredEvents).toHaveLength(1);

    // Duplicate attempt
    const res2 = await store.registerForEvent(event, attendee);
    expect(res2.ok).toBe(false);
    expect(useAuthStore.getState().registeredEvents).toHaveLength(1);
  });

  it("updates course progress and awards completion bonus on 100%", () => {
    const store = useAuthStore.getState();
    store.updateCourseProgress("course-1", "أساسيات المناخ", "Climate Basics", 50);

    let state = useAuthStore.getState();
    expect(state.registeredCourses[0]?.progress).toBe(50);
    expect(state.stats?.ecoPoints).toBe(10); // +10 progress bonus

    // Complete course
    store.updateCourseProgress("course-1", "أساسيات المناخ", "Climate Basics", 100);
    state = useAuthStore.getState();
    expect(state.registeredCourses[0]?.progress).toBe(100);
    expect(state.stats?.ecoPoints).toBe(110); // +100 completion bonus
    expect(state.stats?.earnedBadges).toBe(1);
    expect(state.completedCourseIds).toContain("course-1");
  });

  it("handles member registration and login flow", async () => {
    const store = useAuthStore.getState();

    const testPass = `mock_pass_${Math.random().toString(36).substring(2)}`;
    // Register member
    const regRes = await store.registerMember({
      name: "Fatima Al-Ali",
      email: "fatima@example.com",
      password: testPass
    });
    expect(regRes.ok).toBe(true);

    // Login member
    const loginRes = await store.loginMember("fatima@example.com", testPass);
    expect(loginRes.ok).toBe(true);
    expect(useAuthStore.getState().isMemberAuthenticated).toBe(true);
    expect(useAuthStore.getState().memberToken).toBeTruthy();

    // Logout member
    useAuthStore.getState().logoutMember();
    expect(useAuthStore.getState().isMemberAuthenticated).toBe(false);
    expect(useAuthStore.getState().memberToken).toBeNull();
  });

  it("keeping sessions isolated: admin logout leaves the member session intact", () => {
    localStorage.setItem("admin_token", "mock_admin_token");
    localStorage.setItem("user_token", "mock_user_token");
    useAuthStore.setState({
      isAuthenticated: true,
      token: "mock_admin_token",
      isMemberAuthenticated: true,
      memberToken: "mock_user_token"
    });

    useAuthStore.getState().logoutAdmin();

    const state = useAuthStore.getState();
    // جلسة الأدمن انتهت…
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(localStorage.getItem("admin_token")).toBeNull();
    // …وجلسة العضو لم تمس لا في الـ storage ولا في الـ state
    expect(state.isMemberAuthenticated).toBe(true);
    expect(state.memberToken).toBe("mock_user_token");
    expect(localStorage.getItem("user_token")).toBe("mock_user_token");

    localStorage.removeItem("user_token");
  });

  it("member logout keeps an active admin session untouched", () => {
    localStorage.setItem("admin_token", "mock_admin_token");
    useAuthStore.setState({
      isAuthenticated: true,
      token: "mock_admin_token",
      isMemberAuthenticated: true,
      memberToken: "mock_user_token"
    });

    useAuthStore.getState().logoutMember();

    const state = useAuthStore.getState();
    expect(state.isMemberAuthenticated).toBe(false);
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe("mock_admin_token");
    expect(localStorage.getItem("admin_token")).toBe("mock_admin_token");

    localStorage.removeItem("admin_token");
  });

  // ==========================================
  // 🔬 Production-critical regression tests
  // ==========================================

  it("logout clears all user-specific persisted state", () => {
    // Set up authenticated member with persisted data
    localStorage.setItem("user_token", "mock_token");
    useAuthStore.setState({
      isMemberAuthenticated: true,
      memberToken: "mock_token",
      profile: { name: "User A", email: "a@example.com", city: "Dubai", bio: "Bio A" },
      stats: { ecoPoints: 100, virtualTrees: 5, earnedBadges: 2 },
      recentActivities: [{ id: "1", titleAr: "نشاط", titleEn: "Activity", detailAr: "تفاصيل", detailEn: "Details" }],
      registeredCourses: [{ id: "course-1", titleAr: "مساق", titleEn: "Course", progress: 50 }],
      registeredEvents: [{ id: "ev-1", titleAr: "فعالية", titleEn: "Event", date: "2026-01-01", status: "Confirmed" }],
      completedCourseIds: ["course-1"],
      carbonCreditAwarded: true
    });

    useAuthStore.getState().logoutMember();

    const state = useAuthStore.getState();
    expect(state.isMemberAuthenticated).toBe(false);
    expect(state.memberToken).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.stats).toBeNull();
    expect(state.recentActivities).toEqual([]);
    expect(state.registeredCourses).toEqual([]);
    expect(state.registeredEvents).toEqual([]);
    expect(state.completedCourseIds).toEqual([]);
    expect(state.carbonCreditAwarded).toBe(false);
    expect(localStorage.getItem("user_token")).toBeNull();
  });

  it("loginMember resets user-specific state before loading profile", async () => {
    // Pre-fill with "stale" data from previous user
    localStorage.setItem("user_token", "old_token");
    useAuthStore.setState({
      isMemberAuthenticated: true,
      memberToken: "old_token",
      profile: { name: "Old User", email: "old@example.com", city: "Old City", bio: "Old Bio" },
      stats: { ecoPoints: 999, virtualTrees: 99, earnedBadges: 9 },
      recentActivities: [{ id: "old", titleAr: "قديم", titleEn: "Old", detailAr: "قديم", detailEn: "Old" }],
      registeredCourses: [{ id: "old-course", titleAr: "قديم", titleEn: "Old", progress: 99 }],
      registeredEvents: [{ id: "old-ev", titleAr: "قديم", titleEn: "Old", date: "2020-01-01", status: "Confirmed" }],
      completedCourseIds: ["old-course"],
      carbonCreditAwarded: true
    });

    // Login as new user (mock mode returns success and loads mock profile)
    const store = useAuthStore.getState();
    const res = await store.loginMember("new@example.com", "password123");
    expect(res.ok).toBe(true);

    // State should be reset (old user's data cleared) THEN new profile loaded
    // In mock mode, loadUserProfile populates mockUserProfile
    const state = useAuthStore.getState();
    expect(state.memberToken).not.toBe("old_token");
    // Old user's data should NOT be present
    expect(state.profile?.name).not.toBe("Old User");
    expect(state.stats?.ecoPoints).not.toBe(999);
    expect(state.registeredCourses).not.toContainEqual(expect.objectContaining({ id: "old-course" }));
    expect(state.registeredEvents).not.toContainEqual(expect.objectContaining({ id: "old-ev" }));
    expect(state.completedCourseIds).not.toContain("old-course");
    // New mock profile should be loaded
    expect(state.profile).not.toBeNull();
    expect(state.stats).not.toBeNull();
  });

  it("registerMember resets user-specific state before loading profile", async () => {
    localStorage.setItem("user_token", "old_token");
    useAuthStore.setState({
      isMemberAuthenticated: true,
      memberToken: "old_token",
      profile: { name: "Old", email: "old@example.com", city: "Old", bio: "Old" },
      stats: { ecoPoints: 500, virtualTrees: 10, earnedBadges: 3 },
      recentActivities: [],
      registeredCourses: [],
      registeredEvents: [],
      completedCourseIds: [],
      carbonCreditAwarded: false
    });

    const store = useAuthStore.getState();
    const res = await store.registerMember({ name: "New User", email: "new@example.com", password: "password123" });
    expect(res.ok).toBe(true);

    const state = useAuthStore.getState();
    // Old user's data cleared
    expect(state.profile?.name).not.toBe("Old");
    expect(state.stats?.ecoPoints).not.toBe(500);
    // New mock profile loaded (includes mock registered course/event)
    expect(state.profile).not.toBeNull();
    expect(state.stats).not.toBeNull();
    // Mock profile has registered course/event; verify it's not the old user's data
    expect(state.registeredCourses.every(c => c.id !== "old-course")).toBe(true);
    expect(state.registeredEvents.every(e => e.id !== "old-ev")).toBe(true);
    expect(state.completedCourseIds).toEqual([]);
    expect(state.carbonCreditAwarded).toBe(false);
  });
});
