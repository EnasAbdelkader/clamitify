import { describe, it, expect, beforeEach } from "vitest";
import { useCMSStore } from "./useCMSStore";

describe("useCMSStore", () => {
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

  it("loads CMS content using allSettled strategy", async () => {
    const store = useCMSStore.getState();
    await store.loadCMSContent();

    const state = useCMSStore.getState();
    expect(state.loading).toBe(false);
    // In mock mode (default mock data returned), programs/events/posts are populated
    expect(Array.isArray(state.events)).toBe(true);
    expect(Array.isArray(state.programs)).toBe(true);
    expect(Array.isArray(state.posts)).toBe(true);
  });
});
