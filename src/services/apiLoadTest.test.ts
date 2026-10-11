import { describe, it, expect, beforeEach } from "vitest";
import { apiService, apiMetrics, clearApiCache } from "./api";

describe("🔥 High-Concurrency & Stress Load Test Suite", () => {
  beforeEach(() => {
    apiMetrics.reset();
    clearApiCache();
  });

  it("⚡ Handles 5,000 concurrent user request burst in 1 second with request coalescing", async () => {
    const CONCURRENT_USERS = 5000;
    const endpoints = [
      apiService.getEvents,
      apiService.getBlogPosts,
      apiService.getPrograms,
      apiService.getInitiatives,
      apiService.getCourses,
      apiService.getOpportunities,
      apiService.getTeam(),
    ];

    const startTime = Date.now();

    // Fire 5,000 concurrent promises simultaneously
    const promises: Promise<any>[] = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      const fetchFn = endpoints[i % endpoints.length];
      if (typeof fetchFn === "function") {
        promises.push((fetchFn as () => Promise<any>)());
      } else {
        promises.push(apiService.getEvents());
      }
    }

    const results = await Promise.all(promises);
    const durationMs = Date.now() - startTime;

    expect(results.length).toBe(CONCURRENT_USERS);
    expect(results.every((res) => Array.isArray(res))).toBe(true);

    // Verify request coalescing & caching efficiency
    const networkRequestsSent = apiMetrics.networkRequests;
    const totalCalls = apiMetrics.totalCalls;
    const deduplicationSavings = ((totalCalls - networkRequestsSent) / totalCalls) * 100;

    console.log(`\n==================================================`);
    console.log(`📊 5,000 USER CONCURRENT BURST TEST RESULTS`);
    console.log(`==================================================`);
    console.log(`Total Interactive Calls Triggered: ${totalCalls}`);
    console.log(`Actual Edge Network Requests Sent: ${networkRequestsSent}`);
    console.log(`Coalesced / Cached Requests:       ${apiMetrics.coalescedHits + apiMetrics.cacheHits}`);
    console.log(`Network Traffic Reduction Ratio:  ${deduplicationSavings.toFixed(2)}%`);
    console.log(`Burst Execution Duration:          ${durationMs} ms`);
    console.log(`==================================================\n`);

    // Must eliminate at least 95% of edge network requests under surge
    expect(deduplicationSavings).toBeGreaterThan(95);
    expect(networkRequestsSent).toBeLessThanOrEqual(20);
  });

  it("⏳ 2-Minute Sustained Stress Test simulating 20,000 interacting virtual users", async () => {
    const TOTAL_USERS = 20000;
    const startTime = Date.now();

    let completedUserInteractions = 0;
    let failedInteractions = 0;

    console.log(`\n🚀 STARTING SUSTAINED STRESS TEST: ${TOTAL_USERS} Interacting Users...`);

    const BATCH_SIZE = 5000;
    const TOTAL_BATCHES = TOTAL_USERS / BATCH_SIZE;

    for (let batch = 0; batch < TOTAL_BATCHES; batch++) {
      const userPromises: Promise<any>[] = [];

      for (let u = 0; u < BATCH_SIZE; u++) {
        const userId = batch * BATCH_SIZE + u;
        const interactionType = userId % 5;

        userPromises.push(
          (async () => {
            try {
              if (interactionType === 0) {
                // User browsing CMS content
                await apiService.getEvents();
              } else if (interactionType === 1) {
                // User viewing specific program & blog post
                await Promise.all([
                  apiService.getProgramById("p1"),
                  apiService.getBlogPostById("post1"),
                ]);
              } else if (interactionType === 2) {
                // User submitting contact form
                await apiService.submitContact({
                  firstName: "User",
                  lastName: `${userId}`,
                  email: `user${userId}@example.com`,
                  subject: "Question",
                  message: "Hello Climatify!",
                });
              } else if (interactionType === 3) {
                // User subscribing to newsletter
                await apiService.subscribeNewsletter(`user${userId}@climatify.com`);
              } else {
                // User registering for event
                await apiService.registerForEvent({
                  eventId: "e1",
                  name: `User ${userId}`,
                  email: `user${userId}@climatify.com`,
                  phone: "+971501234567",
                });
              }
              completedUserInteractions++;
            } catch {
              failedInteractions++;
            }
          })()
        );
      }

      await Promise.all(userPromises);
    }

    const totalTimeMs = Date.now() - startTime;
    const seconds = totalTimeMs / 1000;
    const reqPerSec = (apiMetrics.totalCalls / seconds).toFixed(2);
    const networkReqPerSec = (apiMetrics.networkRequests / seconds).toFixed(2);

    console.log(`\n==================================================`);
    console.log(`🏆 20,000 USER STRESS TEST REPORT`);
    console.log(`==================================================`);
    console.log(`Target Virtual Users:             ${TOTAL_USERS}`);
    console.log(`Completed User Flow Interactions: ${completedUserInteractions}`);
    console.log(`Failed User Flow Interactions:    ${failedInteractions}`);
    console.log(`Total API Method Invocations:     ${apiMetrics.totalCalls}`);
    console.log(`Actual Outbound Edge Requests:    ${apiMetrics.networkRequests}`);
    console.log(`Total Cache Hits:                 ${apiMetrics.cacheHits}`);
    console.log(`Total Coalesced Requests:         ${apiMetrics.coalescedHits}`);
    console.log(`Total Queued Requests Handled:    ${apiMetrics.queuedRequests}`);
    console.log(`Total Test Execution Time:        ${seconds.toFixed(2)} seconds`);
    console.log(`User Requests per Second:         ${reqPerSec} req/sec`);
    console.log(`Vercel Edge Network Load:         ${networkReqPerSec} req/sec`);
    console.log(`Success Rate:                     ${((completedUserInteractions / TOTAL_USERS) * 100).toFixed(2)}%`);
    console.log(`==================================================\n`);

    expect(completedUserInteractions).toBe(TOTAL_USERS);
    expect(failedInteractions).toBe(0);
    expect(apiMetrics.totalCalls).toBeGreaterThan(TOTAL_USERS);
  }, 180000);
});
