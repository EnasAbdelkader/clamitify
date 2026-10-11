import { describe, it, expect, vi, afterEach } from "vitest";
import { sanitizeUrl, ApiError } from "./api";

describe("apiService helpers", () => {
  describe("sanitizeUrl", () => {
    it("returns empty string for empty input", () => {
      expect(sanitizeUrl("")).toBe("");
    });

    it("leaves safe URLs unchanged", () => {
      expect(sanitizeUrl("https://climatify-youth.com")).toBe("https://climatify-youth.com");
      expect(sanitizeUrl("/programs")).toBe("/programs");
    });

    it("blocks dangerous javascript: URLs", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("#invalid-url");
      expect(sanitizeUrl("java\tscript:alert(1)")).toBe("#invalid-url");
      expect(sanitizeUrl("JAVASCRIPT:void(0)")).toBe("#invalid-url");
    });

    it("blocks data: and vbscript: schemes", () => {
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#invalid-url");
      expect(sanitizeUrl("vbscript:msgbox")).toBe("#invalid-url");
    });
  });

  describe("ApiError", () => {
    it("identifies network errors (status 0)", () => {
      const err = new ApiError("Network failed", 0, "/programs");
      expect(err.isNetworkError).toBe(true);
      expect(err.localizedMessage("ar")).toContain("تعذّر الاتصال بالخادم");
      expect(err.localizedMessage("en")).toContain("Could not reach the server");
    });

    it("handles 401/403 session errors", () => {
      const err = new ApiError("Unauthorized", 401, "/admin/stats");
      expect(err.localizedMessage("ar")).toContain("الجلسة");
      expect(err.localizedMessage("en")).toContain("session expired");
    });

    it("handles 404 not found errors", () => {
      const err = new ApiError("Not Found", 404, "/events/999");
      expect(err.localizedMessage("ar")).toContain("غير موجود");
      expect(err.localizedMessage("en")).toContain("not found");
    });
  });

  describe("network-failure contract (docs/API_CONTRACT.md §0)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it("throws ApiError on transport failure instead of silently serving mock data", async () => {
      // عقد v2.0: مع VITE_USE_MOCK_API=false لا يوجد fallback صامت للـ mock —
      // تعطّل السيرفر لازم يظهر كخطأ صريح وإلا كان السيرفر الحقيقي ممكن
      // يبان شغال وهو واقع على بيانات وهمية.
      vi.stubEnv("VITE_USE_MOCK_API", "false");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

      // استيراد جديد عشان USE_MOCK_API تُحسب من البيئة المُبدَّلة —
      // بدون resetModules هيرجع نفس instance الوحدة المخزّن ببيئة الاختبار.
      vi.resetModules();
      const { apiService } = await import("./api");

      // مطابقة بالشكل لا بـ instanceof: بعد resetModules يوجد class ApiError
      // جديد من نسخة الوحدة المُعادة تحميلها.
      await expect(apiService.getPrograms()).rejects.toMatchObject({
        name: "ApiError",
        status: 0,
        endpoint: "/programs",
      });
    });
  });
});
