import { describe, it, expect, beforeEach } from "vitest";
import { apiService, ApiError, clearApiCache, apiMetrics } from "./api";

describe("🧪 Frontend Completeness & Backend Readiness Test Suite", () => {
  beforeEach(() => {
    clearApiCache();
    apiMetrics.reset();
  });

  describe("1. Public Read Endpoints & Cache System", () => {
    it("fetches programs with valid payload structure", async () => {
      const programs = await apiService.getPrograms();
      expect(Array.isArray(programs)).toBe(true);
      expect(programs.length).toBeGreaterThan(0);
      expect(programs[0]).toHaveProperty("id");
      expect(programs[0]).toHaveProperty("titleAr");
      expect(programs[0]).toHaveProperty("titleEn");
    });

    it("fetches initiatives, events, courses, games, opportunities, blog posts, team", async () => {
      const [initiatives, events, courses, games, opportunities, posts, team, careers, carbonQuestions] = await Promise.all([
        apiService.getInitiatives(),
        apiService.getEvents(),
        apiService.getCourses(),
        apiService.getGames(),
        apiService.getOpportunities(),
        apiService.getBlogPosts(),
        apiService.getTeam(),
        apiService.getCareerPathways(),
        apiService.getCarbonQuestions(),
      ]);

      expect(initiatives.length).toBeGreaterThan(0);
      expect(events.length).toBeGreaterThan(0);
      expect(courses.length).toBeGreaterThan(0);
      expect(games.length).toBeGreaterThan(0);
      expect(opportunities.length).toBeGreaterThan(0);
      expect(posts.length).toBeGreaterThan(0);
      expect(team.length).toBeGreaterThan(0);
      expect(careers.length).toBeGreaterThan(0);
      expect(carbonQuestions.length).toBeGreaterThan(0);
    });

    it("retrieves individual item by ID correctly", async () => {
      const programs = await apiService.getPrograms();
      const firstProgram = programs[0];
      if (!firstProgram) throw new Error("No programs available");
      const fetched = await apiService.getProgramById(firstProgram.id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(firstProgram.id);

      const posts = await apiService.getBlogPosts();
      const firstPost = posts[0];
      if (!firstPost) throw new Error("No blog posts available");
      const fetchedPost = await apiService.getBlogPostById(firstPost.id);
      expect(fetchedPost).toBeDefined();
      expect(fetchedPost?.id).toBe(firstPost.id);
    });
  });

  describe("2. Public Form Submissions", () => {
    it("submits contact form with success mutation result", async () => {
      const res = await apiService.submitContact({
        firstName: "Ahmad",
        lastName: "Mahmoud",
        email: "ahmad@example.com",
        subject: "Climate Inquiry",
        message: "I want to collaborate on climate initiatives in Dubai.",
      });
      expect(res.success).toBe(true);
      expect(res.message).toBeTruthy();
    });

    it("submits meeting booking form", async () => {
      const res = await apiService.bookMeeting({
        name: "Sara Al-Hashimi",
        email: "sara@example.com",
        date: "2026-09-01",
        time: "10:00",
        notes: "Strategy meeting",
      });
      expect(res.success).toBe(true);
      expect(res.message).toBeTruthy();
    });

    it("submits partnership request, workshop, event registration, and opportunity application", async () => {
      const [partnership, workshop, eventReg, oppApp, newsletter] = await Promise.all([
        apiService.submitPartnership({ orgName: "Green Org", orgType: "NGO", contactPerson: "Ali", email: "ali@green.org", proposal: "Sponsorship collaboration for climate initiatives" }),
        apiService.submitWorkshopRequest({ institutionName: "Green School", city: "Dubai", studentCount: "50", workshopType: "Recycling", email: "mariam@school.ae" }),
        apiService.registerForEvent({ eventId: "event-1", name: "Omar", email: "omar@example.com", phone: "+971500000000" }),
        apiService.applyToOpportunity({ opportunityId: "opp-1", name: "Fatima", email: "fatima@example.com", portfolio: "https://cv.com/fatima.pdf", coverLetter: "Excited!" }),
        apiService.subscribeNewsletter("subscriber@example.com"),
      ]);

      expect(partnership.success).toBe(true);
      expect(workshop.success).toBe(true);
      expect(eventReg.success).toBe(true);
      expect(oppApp.success).toBe(true);
      expect(newsletter.success).toBe(true);
    });
  });

  describe("3. Member & Admin Authentication", () => {
    it("logs in admin successfully in mock mode", async () => {
      const res = await apiService.loginAdmin("admin@climatify.org", "any-pass");
      expect(res.success).toBe(true);
      expect(res.token).toBeTruthy();
    });

    it("registers and logs in members with expected responses", async () => {
      const regRes = await apiService.registerMember({
        name: "Tariq Al-Mansoori",
        email: "tariq@climatify-youth.org",
        password: "securepassword123",
      });
      expect(regRes.success).toBe(true);

      const loginRes = await apiService.loginMember("tariq@climatify-youth.org", "securepassword123");
      expect(loginRes.success).toBe(true);
      expect(loginRes.token).toBeTruthy();
    });
  });

  describe("4. Error Handling & Localization", () => {
    it("provides Arabic and English localized error messages for network errors", () => {
      const err = new ApiError("Failed to fetch", 0, "/programs");
      expect(err.isNetworkError).toBe(true);
      expect(err.localizedMessage("ar")).toContain("تعذّر الاتصال بالخادم");
      expect(err.localizedMessage("en")).toContain("Could not reach the server");
    });

    it("provides Arabic and English localized error messages for 401/403 and 404", () => {
      const authErr = new ApiError("Unauthorized", 401, "/admin/stats");
      expect(authErr.localizedMessage("ar")).toContain("انتهت صلاحية الجلسة");
      expect(authErr.localizedMessage("en")).toContain("Your session expired");

      const notFoundErr = new ApiError("Not Found", 404, "/programs/999");
      expect(notFoundErr.localizedMessage("ar")).toContain("غير موجود");
      expect(notFoundErr.localizedMessage("en")).toContain("not found");
    });
  });

  describe("5. AI Chat Assistant", () => {
    it("generates relevant AI replies for Arabic climate prompts", async () => {
      const replyAr = await apiService.sendAIChatMessage("كيف أحسب البصمة الكربونية؟", "ar");
      expect(replyAr.success).toBe(true);
      expect(replyAr.reply).toContain("البصمة الكربونية");

      const replyEn = await apiService.sendAIChatMessage("How do I calculate carbon footprint?", "en");
      expect(replyEn.success).toBe(true);
      expect(replyEn.reply).toContain("Carbon footprint");
    });
  });
});
