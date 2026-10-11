# Climatify E2E Audit Report

## Executive Summary

Climatify is a React + Vite + TypeScript frontend with a Python Flask backend and SQLite database. The audit covered all major user-facing features: public pages, authentication, profile, dashboard, learning hub, enrollment, progress tracking, certificates, events, activities, data isolation, error handling, navigation, responsive UI, and build/tests.

**Overall Status: NOT READY — BUGS FOUND**

Critical authentication/security vulnerabilities exist where multiple protected endpoints incorrectly return guest user data instead of 401 Unauthorized. A registration bug causes a 500 error on malformed JSON bodies. Certificate generation is entirely client-side with no backend verification. Backend content is nearly empty compared to frontend mock data.

---

## Tests Passed

| Area | Test | Result |
|------|------|--------|
| Frontend Build | `npm run build` | ✅ Passed (4.02s) |
| Frontend Typecheck | `npm run typecheck` | ✅ Passed |
| Frontend Lint | `npm run lint` | ✅ Passed (oxlint) |
| Frontend Unit Tests | `vitest run` | ✅ 7 files / 46 tests passed |
| Backend Unit Tests | `python -m unittest backend.tests` | ✅ All passed (auth + extended) |
| Public API Endpoints | GET /api/programs, events, courses, etc. | ✅ 200 OK |
| Public Routes | All SPA routes return index.html | ✅ 200 OK |
| Registration | Valid JSON registration works | ✅ 201 Created + JWT |
| Login | Valid credentials work | ✅ 200 OK + JWT |
| Profile GET/PUT | Authenticated requests work | ✅ 200 OK |
| Profile Update | Persists to DB | ✅ Verified |
| Course Enrollment | POST /api/user/courses/{id}/progress | ✅ 200 OK |
| Course Progress | 33% → 66% → 100% persists | ✅ Verified in DB |
| User Isolation (Courses) | User A ≠ User B progress | ✅ Separate DB rows |
| Event Registration | POST /api/user/events | ✅ 200 OK |
| Event Cancellation | DELETE /api/user/events/{id} | ✅ Status → Cancelled |
| Error Handling | Invalid inputs return 4xx | ✅ 401/404/409/422 |

---

## Confirmed Bugs

### BUG-001: Registration 500 on Malformed/Empty JSON Body
- **Severity:** High
- **Area:** Authentication / Backend
- **File/Endpoint:** `backend/routes_auth.py:56` — `member_register()`
- **Reproduction:** Send POST to `/api/auth/register` with empty body or invalid JSON (`Content-Type: application/json` but body is `{}` or empty)
- **Expected:** 422 with clear error message
- **Actual:** 500 Internal Server Error — `UnboundLocalError: cannot access local variable 'message' where it is not associated with a value`
- **Root Cause:** Line 55 `if data is None or (message := required(...)):` — when `data` is `{}` (not `None`), `required()` returns `None` (no missing fields), so `message` is never assigned. Line 56 references `message` which is unbound.
- **Evidence:** Werkzeug debugger traceback confirms line 56.

### BUG-002: Protected Endpoints Accept Unauthenticated/Invalid Requests
- **Severity:** Critical
- **Area:** Authentication / Security / Backend
- **File/Endpoint:** `backend/routes_member.py` — `current_member()` function (lines 17-21)
- **Affected Endpoints:**
  - GET `/api/user/profile`
  - PUT `/api/user/profile`
  - POST `/api/user/carbon-footprint`
  - POST `/api/user/events`
  - POST `/api/user/courses/{id}/progress`
  - POST `/api/user/trees`
  - GET `/api/user/impact`
- **Reproduction:** Call any affected endpoint with: (a) no Authorization header, (b) `Bearer invalid-token`, (c) expired JWT
- **Expected:** 401 Unauthorized
- **Actual:** 200 OK returning `guest@climatify.local` user data (name="", email="", stats from guest user including activities from other users)
- **Root Cause:** `current_member()` falls back to `get_or_create_member("guest@climatify.local", "")` when `optional_user()` returns None or non-member role. `optional_user()` returns None for missing/invalid/expired tokens without raising.
- **Evidence:** Tested with Python requests — all three scenarios returned 200 with guest data including cross-user activities.
- **Positive Control:** `/api/user/bookmarks` correctly uses `authenticated_member()` and returns 401.

### BUG-003: Certificate Generation is Client-Side Only
- **Severity:** High
- **Area:** Certificates / Backend / Frontend
- **File/Endpoint:** Frontend: `src/pages/LearningHub/LearningHub.tsx` lines 216-217, 344-353, 425-491
- **Reproduction:** Complete course to 100% → certificate modal appears with generated ID `CLM-{courseId.toUpperCase()}-2026`
- **Expected:** Backend-verified certificate with server-side persistence, authorization, tamper-proof ID
- **Actual:** Certificate is a frontend-only modal. No backend endpoint exists for certificates. No DB table exists. Certificate ID, date, user name, course are all client-controlled. Any user can manipulate localStorage/Zustand to show certificate without completion.
- **Evidence:** API checks for `/api/user/certificates`, `/api/user/courses/{id}/certificate`, `/api/certificates`, `/api/admin/certificates` all return 404. SQLite schema has no certificate table. Frontend code generates certificate on `progress === 100`.

### BUG-004: Backend Content Nearly Empty vs Frontend Mock Data
- **Severity:** Medium
- **Area:** Content / Data / Backend
- **Reproduction:** Compare `GET /api/courses`, `/api/events`, `/api/programs`, `/api/posts`, `/api/team`, `/api/games`, `/api/opportunities`, `/api/initiatives`, `/api/careers`, `/api/carbon-questions` with frontend mock data
- **Expected:** Production-ready content matching frontend display
- **Actual:** Backend has only 4 content items (1 program, 1 event, 1 course, 1 opportunity). Frontend mock data contains 9 courses, 10 events, 6 programs, 5 blog posts, 10 team members, 3 games, 2 opportunities, 2 initiatives, 4 careers, 3 carbon questions.
- **Impact:** If `VITE_USE_MOCK_API` accidentally becomes `true` in production, users see demo content. If backend is intended as source of truth, it's severely under-populated.

### BUG-005: Mock User Profile Hardcoded in Frontend Store
- **Severity:** Medium
- **Area:** Frontend / Auth / Store
- **File/Endpoint:** `src/services/mockData.ts` lines 688-728 (`mockUserProfile`)
- **Reproduction:** Inspect `mockUserProfile` — contains "عبد الله الشامسي" (Abdullah Al Shamsi), pre-enrolled in `course-shift-internship` at 50%, pre-registered for `shift-first-cohort-graduation`, with stats ecoPoints:240, virtualTrees:3, earnedBadges:2
- **Expected:** No hardcoded demo user data in production code paths
- **Actual:** This mock profile is used when `USE_MOCK_API=true`. Even with `USE_MOCK_API=false`, the `useAuthStore` merge logic (`mergeCourses`, `mergeStats`, `mergeActivities`) can merge stale localStorage data with server data, potentially leaking demo data into real sessions.
- **Evidence:** Code in `useAuthStore.ts` lines 164-172 (`mergeCourses`), 134-146 (`mergeStats`), 178-187 (`mergeActivities`) all take `Math.max(local, server)`, meaning local progress never decreases.

### BUG-006: Duplicate Event Registration Returns 200 Without Prevention
- **Severity:** Low
- **Area:** Events / Backend
- **File/Endpoint:** `backend/routes_member.py:71-83` (`add_event`)
- **Reproduction:** Register for same event twice with valid token
- **Expected:** 409 Conflict or idempotent 200 with no duplicate
- **Actual:** Returns 200 both times. Backend checks for existing `status="Confirmed"` registration and skips insert, but still returns success. No indication to caller that registration already existed.
- **Evidence:** Tested — second registration returned 200, DB has single registration with status "Confirmed".

### BUG-007: Profile Update Uses `current_member()` Allowing Guest Writes
- **Severity:** High
- **Area:** Profile / Backend
- **File/Endpoint:** `backend/routes_member.py:45-52` (`update_profile`)
- **Reproduction:** PUT `/api/user/profile` with no/invalid token
- **Expected:** 401 Unauthorized
- **Actual:** 200 OK — updates `guest@climatify.local` user record
- **Root Cause:** Uses `current_member()` which falls back to guest user.

---

## Security Findings

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| SEC-001 | Unauthenticated access to user data endpoints | Critical | 7 endpoints return guest user data instead of 401, leaking cross-user activity data (carbon footprint calculations, event registrations from other users) |
| SEC-002 | Guest user can be modified via profile update | High | PUT `/api/user/profile` without auth modifies `guest@climatify.local` record |
| SEC-003 | Certificate entirely client-side, forgeable | High | No server verification; user name, course, date, ID all client-controlled; localStorage manipulation can fake completion |
| SEC-004 | Stale localStorage can overwrite server progress | Medium | `mergeCourses`/`mergeStats`/`mergeActivities` use `Math.max(local, server)` — local progress never decreases, enabling progress inflation |
| SEC-005 | Mock user data present in production code path | Medium | `mockUserProfile` with real-looking name "Abdullah Al Shamsi" and demo progress; if `VITE_USE_MOCK_API` flips, demo data appears |
| SEC-006 | JWT validation not enforced on mutation endpoints | Critical | `current_member()` used for mutations (profile update, carbon footprint, event registration, course progress, tree planting) — allows unauthenticated writes to guest user |

---

## Authentication Findings

| Check | Result | Notes |
|-------|--------|-------|
| Valid registration | ✅ Works | 201 + JWT + user object |
| Valid login | ✅ Works | 200 + JWT + user object |
| Invalid password | ✅ 401 | Correct error |
| Nonexistent email | ✅ 401 | Correct error |
| Missing fields | ✅ 422 | "Missing required fields: email, password" |
| Invalid email format | ✅ 422 | Validation works |
| Weak password (<6) | ✅ 422 | Validation works |
| Duplicate email | ✅ 409 | Correct error |
| Valid JWT → profile | ✅ 200 | Correct user data |
| No token → profile | ❌ 200 | Returns guest user (BUG-002) |
| Invalid JWT → profile | ❌ 200 | Returns guest user (BUG-002) |
| Expired JWT → profile | ❌ 200 | Returns guest user (BUG-002) |
| Logout clears token | ✅ Works | Frontend clears localStorage |
| Refresh persistence | ✅ Works | Token in localStorage survives reload |
| Protected route redirect | ✅ Works | Dashboard gate redirects to /login |
| Admin login separate | ✅ Works | Separate `/api/admin/login` endpoint |

---

## Learning Hub Findings

| Check | Result | Notes |
|-------|--------|-------|
| GET /api/courses | ✅ 200 | Returns backend course (1 item) |
| Course detail | ⚠️ 404 | `/api/courses/{id}` not implemented; only `/api/courses` list exists |
| New user enrolled automatically | ✅ No | Fresh user has empty `registeredCourses` |
| Course enrollment | ✅ Works | POST progress=0 creates CourseProgress row |
| Lesson list endpoint | ✅ Works | `GET /api/courses/{id}/lessons` returns 3 lessons |
| Progress 33% → 66% → 100% | ✅ Works | Each persists to DB |
| Progress persists after refresh | ✅ Verified | DB row updated |
| User isolation (courses) | ✅ Verified | User 12=100%, User 13=50% |
| Frontend lesson UI | ⚠️ Hardcoded | `LESSON_TITLES` array hardcoded (3 titles); lessons beyond 3 get generic "Training Module N" |
| Progress calculation | ⚠️ Client-side | Frontend computes `completedLessonIds` from local state + infers from progress %; not from backend lesson completion records |
| Certificate appears at 100% | ✅ Verified | Frontend modal shows at `progress === 100` |

---

## Certificate Findings

| Check | Result | Notes |
|-------|--------|-------|
| Backend certificate endpoint | ❌ Missing | All checked endpoints return 404 |
| Backend certificate table | ❌ Missing | SQLite schema has no certificate table |
| Certificate generation | Frontend only | `LearningHub.tsx` lines 425-491 render modal |
| Certificate ID format | Client-generated | `CLM-{courseId.toUpperCase()}-2026` |
| Certificate user name | From `profile?.name` | Client-controlled via localStorage/token |
| Certificate date | `new Date()` | Client-controlled |
| Certificate course | From active course | Client-controlled |
| Certificate accessible by other users | ✅ Not applicable | No backend endpoint to access |
| Certificate persistence | ❌ None | Only in browser memory |
| Certificate verification | ❌ None | No validation possible |
| Faking certificate via localStorage | ✅ Possible | `completedLessonIds` or `registeredCourses` progress can be manipulated to 100% |

---

## Events Findings

| Check | Result | Notes |
|-------|--------|-------|
| Event listing | ✅ Works | `GET /api/events` returns event with `registeredCount` |
| Event registration | ✅ Works | POST `/api/user/events` creates EventRegistration |
| Duplicate registration | ⚠️ 200 OK | No duplicate created but no indication (BUG-006) |
| Event cancellation | ✅ Works | DELETE changes status to "Cancelled" |
| Cancellation persistence | ✅ Verified | Status stays "Cancelled" |
| User isolation (events) | ✅ Verified | User-specific registrations via `user_id` FK |
| Guest user event registration | ❌ Allowed | `current_member()` creates registration for guest (BUG-002) |

---

## Data Isolation Findings

| Test | User A (testuser) | User B (testuser2) | Result |
|------|-------------------|-------------------|--------|
| GET own profile | ✅ Own data | ✅ Own data | Pass |
| GET other profile | N/A (no endpoint) | N/A | N/A |
| PUT own profile | ✅ Works | ✅ Works | Pass |
| PUT other profile | N/A (no user ID in URL) | N/A | N/A |
| GET own course progress | ✅ 100% | ✅ 50% | Pass |
| GET other course progress | N/A (no endpoint) | N/A | N/A |
| POST own course progress | ✅ Updates own | ✅ Updates own | Pass |
| POST other course progress | N/A (no user ID in body) | N/A | N/A |
| GET own events | ✅ Own events | ✅ Own events | Pass |
| DELETE own event | ✅ Works | ✅ Works | Pass |
| DELETE other event | N/A (filtered by user_id) | N/A | Pass (enforced by query) |
| GET own activities | ✅ Own activities | ✅ Own activities | Pass |
| GET own stats | ✅ Own stats | ✅ Own stats | Pass |
| Access other's certificate | N/A (no backend) | N/A | N/A |

**Note:** Backend correctly filters by `user_id` for all `current_member()` endpoints. However, since `current_member()` falls back to guest, unauthenticated requests read/write guest user (BUG-002). Authenticated isolation between real users works correctly.

---

## UI/UX Findings

| Check | Status | Notes |
|-------|--------|-------|
| Home page loads | ✅ | SPA renders |
| About page loads | ✅ | SPA renders |
| Programs page | ✅ | Renders with backend data (1 item) |
| Events page | ✅ | Renders with backend data (1 item) |
| Learning Hub | ✅ | Renders course list; enrollment works |
| Opportunities page | ✅ | Renders with backend data (1 item) |
| Media page | ✅ | Renders (0 posts in backend) |
| Games page | ✅ | Renders (0 games in backend) |
| Contact page | ✅ | Renders form |
| Portals page | ✅ | Renders |
| 404 page | ✅ | NotFound component renders |
| Navigation links | ✅ | All header/footer links work |
| Forms submit | ✅ | Register, login, profile update work |
| Buttons functional | ✅ | Enroll, progress, register, cancel work |
| Loading states | ✅ | RouteLoader shown during fetch |
| Empty states | ✅ | EmptyState components for no data |
| Dashboard stats | ✅ | Shows user-specific ecoPoints, trees, badges |
| Dashboard charts | ⚠️ Sample data | Disclaimer shown: "Sample data — illustrative only" |
| Dashboard CSV export | ✅ Works | Generates CSV with BOM for Arabic |
| Responsive layout | NOT TESTED | No browser viewport tooling available |
| Mobile navigation | NOT TESTED | No browser viewport tooling available |
| Form usability | NOT TESTED | No browser interaction tooling |
| Modal behavior | NOT TESTED | Certificate modal, event cancellation confirm |

---

## Build & Automated Tests

| Command | Status | Details |
|---------|--------|---------|
| `npm run build` | ✅ Passed | 4.02s, all assets generated |
| `npm run typecheck` | ✅ Passed | `tsc -b --force` no errors |
| `npm run lint` | ✅ Passed | `oxlint` no errors |
| `npm run test` | ✅ Passed | Vitest 7 files / 46 tests |
| `python -m unittest backend.tests.test_auth` | ✅ Passed | 4 tests |
| `python -m unittest backend.tests.test_extended` | ✅ Passed | 7 tests |

---

## Blocked / Not Tested

| Item | Reason |
|------|--------|
| Browser console error check | No browser automation tool available |
| Runtime React errors | No browser automation tool available |
| Failed API calls in browser network tab | No browser automation tool available |
| Responsive UI (mobile/desktop) | No viewport testing tool available |
| Certificate modal interaction | No browser automation tool available |
| Form validation UX | No browser interaction tooling |
| Keyboard navigation / accessibility | No browser automation tool available |
| Admin panel (/admin/*) | Not in scope for member audit |
| File upload | Not tested (requires multipart) |
| AI chat endpoint | Not tested |
| Newsletter/subscribe/forms | Not tested |
| Carbon calculator game | Not tested |
| Ghaf garden game | Not tested |
| AgriClash game | Not tested |
| Search functionality | Not implemented/not found |
| Pagination/infinite scroll | Not applicable (small datasets) |
| Real-time features | Not present |

---

## Recommended Fix Order

| Priority | Bug/Finding | Rationale |
|----------|-------------|-----------|
| 1 | BUG-002: Protected endpoints accept unauthenticated requests | Critical data exposure; affects 7 endpoints; allows guest writes |
| 2 | BUG-007: Profile update allows guest writes | Direct data modification vulnerability |
| 3 | BUG-001: Registration 500 on malformed JSON | High-severity crash; easy fix (initialize `message`) |
| 4 | BUG-003: Certificate client-side only | High business risk; certificates forgeable; needs backend implementation |
| 5 | BUG-005: Stale localStorage can inflate progress | Data integrity; merge logic should prefer server |
| 6 | BUG-004: Backend content empty | Content gap; seed production data or document intentional mock usage |
| 7 | BUG-006: Duplicate event registration silent | UX improvement; should return 409 or idempotent indicator |
| 8 | SEC-004: Merge logic review | Audit all `Math.max(local, server)` usage |
| 9 | Add backend certificate endpoints | If certificates are required feature |
| 10 | Add course detail endpoint | `/api/courses/{id}` returns 404 |
| 11 | Browser/responsive testing | Manual QA needed |

---

## Final Status

**NOT READY — BUGS FOUND**

Critical authentication bypass (BUG-002, BUG-007) and crash bug (BUG-001) must be fixed before production readiness. Certificate system requires backend implementation if feature is required.