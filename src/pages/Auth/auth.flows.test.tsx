import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import React from "react";
import { MemberLogin } from "./MemberLogin";
import { MemberRegister } from "./MemberRegister";
import { LanguageProvider } from "../../context/LanguageContext";
import { useAuthStore } from "../../store/useAuthStore";

/**
 * اختبارات تدفقات المصادقة الحساسة:
 *  - التحقق من صيغة البريد قبل الإرسال.
 *  - إشعار "تم إنشاء الحساب" لما التسجيل ينجح والدخول التلقائي يفشل.
 *  - مسح بيانات العضو المحفوظة عند تسجيل الخروج (منع التسريب بين المستخدمين).
 *  - التسجيل في مساق بنسبة 0% بدون نقاط، ومنح النقاط عند تقدم فعلي فقط.
 */

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={["/register"]}>{ui}</MemoryRouter>
    </LanguageProvider>
  );
}

const LocationProbe: React.FC = () => {
  const location = useLocation();
  const state = location.state as { notice?: string } | null;
  return <div data-testid="location-probe">path={location.pathname} notice={state?.notice ?? "none"}</div>;
};

const setTextInputValue = (label: string, value: string) => {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
};

describe("auth form validation", () => {
  beforeEach(() => {
    localStorage.clear();
    window.localStorage.setItem("climatify-lang", "ar");
    useAuthStore.setState({
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
      error: null
    });
  });

  afterEach(() => cleanup());

  it("login rejects a malformed email before reaching the store", async () => {
    const loginMemberSpy = vi.spyOn(useAuthStore.getState(), "loginMember");

    renderWithProviders(<MemberLogin />);
    setTextInputValue("البريد الإلكتروني", "not-an-email");
    setTextInputValue("كلمة المرور", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("برجاء إدخال بريد إلكتروني صحيح");
    // التحقق العميل منع الوصول للـstore تماماً
    expect(loginMemberSpy).not.toHaveBeenCalled();
    loginMemberSpy.mockRestore();
  });

  it("register success + auto-login failure redirects to /login with a clear notice", async () => {
    // mock mode بيسمح بالدخول دايماً — بنفرض فشل الدخول التلقائي عشان نختبر مسار الإشعار
    const originalLoginMember = useAuthStore.getState().loginMember;
    useAuthStore.setState({ loginMember: async () => ({ ok: false }) });

    try {
      renderWithProviders(
        <Routes>
          <Route path="/register" element={<MemberRegister />} />
          <Route path="/login" element={<><MemberLogin /><LocationProbe /></>} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      );

      setTextInputValue("الاسم بالكامل", "تجربة إقليمية");
      setTextInputValue("البريد الإلكتروني", "notice-test@example.com");
      setTextInputValue("كلمة المرور", "secret123");
      // التسجيل والدخول التلقائي غير متزامنين — بنلفّهم في act عشان التحديثات تكتمل
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /إنشاء الحساب/ }));
      });

      const probe = await screen.findByTestId("location-probe", undefined, { timeout: 4000 });
      await waitFor(() => expect(probe.textContent).toContain("path=/login"));
      expect(probe.textContent).toContain("تم إنشاء حسابك بنجاح");
    } finally {
      // الاسترجاع بيعدّل حالة الـstore اللي MemberLogin مشترك فيها — لازم جوّه act
      await act(async () => {
        useAuthStore.setState({ loginMember: originalLoginMember });
      });
    }
  });
});

describe("member progress lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      isAuthenticated: false,
      token: null,
      isMemberAuthenticated: true,
      memberToken: "tok",
      profile: { name: "أ", email: "a@b.co", city: "", bio: "" },
      stats: { ecoPoints: 30, virtualTrees: 1, earnedBadges: 1 },
      recentActivities: [{ id: "act-1", titleAr: "س", titleEn: "s", detailAr: "", detailEn: "" }],
      registeredCourses: [{ id: "c9", titleAr: "ق", titleEn: "C", progress: 40 }],
      registeredEvents: [{ id: "e1", titleAr: "ف", titleEn: "E", date: "2026-01-01", status: "Confirmed" }],
      completedCourseIds: ["c8"],
      carbonCreditAwarded: true,
      loading: false,
      error: null
    });
  });

  it("logout wipes the member session AND the persisted progress", () => {
    useAuthStore.getState().logoutMember();

    const s = useAuthStore.getState();
    expect(s.isMemberAuthenticated).toBe(false);
    expect(s.memberToken).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.stats).toBeNull();
    expect(s.recentActivities).toHaveLength(0);
    expect(s.registeredCourses).toHaveLength(0);
    expect(s.registeredEvents).toHaveLength(0);
    expect(s.completedCourseIds).toHaveLength(0);
    expect(s.carbonCreditAwarded).toBe(false);

    // الـpersist middleware لازم يكون كتب الحالة الممسوحة على الجهاز
    const persisted = JSON.parse(localStorage.getItem("climatify-user") ?? "{}") as {
      state?: { stats?: unknown };
    };
    expect(persisted.state?.stats ?? null).toBeNull();
  });

  it("enrolling at 0% awards nothing; real lesson progress awards points once", () => {
    const store = useAuthStore.getState();

    store.updateCourseProgress("course-x", "مساق", "Course", 0);
    let s = useAuthStore.getState();
    expect(s.registeredCourses.find((c) => c.id === "course-x")?.progress).toBe(0);
    expect(s.stats?.ecoPoints).toBe(30); // لا نقاط على مجرد التسجيل
    expect(s.recentActivities).toHaveLength(1); // ولا نشاط

    // إكمال درس حقيقي (تقدم لأول مرة فوق الصفر)
    store.updateCourseProgress("course-x", "مساق", "Course", 25);
    s = useAuthStore.getState();
    expect(s.stats?.ecoPoints).toBe(40); // +10

    // نداء مكرر بنفس النسبة: لا نقاط إضافية ولا نشاط جديد
    store.updateCourseProgress("course-x", "مساق", "Course", 25);
    s = useAuthStore.getState();
    expect(s.stats?.ecoPoints).toBe(40);
    expect(s.recentActivities).toHaveLength(2);

    // النسبة ما بترجعش لورا
    store.updateCourseProgress("course-x", "مساق", "Course", 5);
    expect(useAuthStore.getState().registeredCourses.find((c) => c.id === "course-x")?.progress).toBe(25);
  });
});
