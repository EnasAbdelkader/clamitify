# Youssef Ashraf — Backend Changes

## 1. Summary

The project originally contained a React/Vite frontend and documentation for a separate Flask backend. The only backend code initially present was a small Flask authentication prototype with one SQLAlchemy `User` model, admin login, password change, JWT authentication, and a SQLite database created with `db.create_all()`.

The missing backend included public content reads, public form submissions, admin dashboard APIs, CMS persistence, member profile/progress persistence, uploads, analytics, audit logging, rate limiting, lessons, event cancellation, and ticket data.

The implementation now provides a modular Flask application with SQLAlchemy persistence, JWT authentication, admin authorization, public content/form APIs, admin settings/messages/statistics/CMS APIs, member/profile/progress endpoints, uploads, lessons, AI response handling, audit records, rate limiting, seed data, and backend tests.

Current status: **the modular backend is operational with durable lessons, tickets, impact history, bookmarks, migrations, security checks, expanded tests, and verified production SPA serving.** Remaining limitations are exhaustive per-endpoint negative-case coverage, production-grade distributed rate limiting/object storage, and richer provider-backed analytics/AI behavior.

## 2. Backend Architecture

```text
backend/
├── __init__.py
├── app.py                  # Application factory, blueprint registration, errors, CORS, SPA fallback
├── config.py               # Environment-backed configuration
├── extensions.py           # Shared SQLAlchemy and JWT extension instances
├── models.py               # Database models and contract serializers
├── schemas.py              # CMS entity validation rules
├── services.py             # Shared member, activity, analytics, and audit helpers
├── utils.py                # Request parsing, validation, authorization, IDs, audit helpers
├── rate_limit.py           # In-memory per-IP request limiter
├── routes_auth.py          # Admin/member authentication and password changes
├── routes_content.py       # Public content reads
├── routes_forms.py         # Public submissions and event registration
├── routes_member.py        # Profile, carbon, events, progress, trees, impact
├── routes_admin.py         # Admin dashboard, settings, messages, analytics, CMS CRUD
├── routes_extra.py         # Uploads, lessons, curriculum URL, AI chat
├── seed.py                 # Admin/content bootstrap data
├── requirements.txt
├── .env.example
├── .gitignore
└── tests/
    ├── __init__.py
    ├── test_auth.py
    ├── test_contract.py
    ├── test_contract_matrix.py
    ├── test_extended.py
    └── test_rate_limit.py

migrations/
├── alembic.ini
├── env.py
├── README
├── script.py.mako
└── versions/c07e2cb2d634_initial_backend_schema.py
```

The application is an app-factory style Flask service. Blueprints separate transport concerns by domain. Shared SQLAlchemy and JWT instances live in `extensions.py`; route handlers use reusable validation and authorization helpers rather than duplicating authentication logic.

The seven CMS entities use one `ContentItem` table with a `kind` discriminator and JSON payload. This avoids seven duplicated CRUD implementations while preserving separate public/admin resource paths. Relational behavior such as users, registrations, progress, settings, messages, uploads, audit logs, and analytics uses dedicated tables.

## 3. New Files

The following files were created during the backend implementation:

| Exact path | Purpose | Related feature |
|---|---|---|
| `backend/__init__.py` | Package marker | Backend package |
| `backend/.gitignore` | Ignores local databases, uploads/cache artifacts | Local persistence hygiene |
| `backend/.env.example` | Names and example placeholders for backend configuration | Environment setup |
| `backend/requirements.txt` | Flask, CORS, JWT, SQLAlchemy, dotenv dependencies | Backend runtime |
| `backend/config.py` | Configuration classes and environment-backed paths/settings | Configuration |
| `backend/extensions.py` | Shared `db` and `jwt` instances | Application infrastructure |
| `backend/models.py` | User, content, forms, registrations, member state, settings, audit, analytics, upload models | Database persistence |
| `backend/schemas.py` | Required fields and value validation for CMS entities | Validation/CMS |
| `backend/services.py` | Shared member creation, activity, analytics, and audit helpers | Service layer |
| `backend/utils.py` | JSON parsing, field/date/time/email/URL validation, admin guard, IDs | Cross-cutting concerns |
| `backend/rate_limit.py` | Per-IP in-memory minute limiter | Rate limiting |
| `backend/routes_auth.py` | Admin/member login, registration, password change | Authentication |
| `backend/routes_content.py` | Public programs, initiatives, events, courses, games, opportunities, posts, team, careers, questions | Public content |
| `backend/routes_forms.py` | Contact, meetings, partnerships, workshops, event registration, applications, newsletter | Public submissions |
| `backend/routes_member.py` | Profile, carbon footprint, event cancellation, progress, trees, impact | Member state |
| `backend/routes_admin.py` | Admin settings, stats, analytics, messages, CMS CRUD | Admin/CMS |
| `backend/routes_extra.py` | Uploads, lessons, curriculum URL, AI chat | Extensions/uploads |
| `backend/seed.py` | Development admin/content bootstrap | Seed data |
| `backend/tests/__init__.py` | Test package marker | Tests |
| `backend/tests/test_auth.py` | JWT, password, authentication, and authorization tests | Backend tests |
| `backend/tests/test_contract.py` | Public route, CMS CRUD, form, and protected-route tests | Contract tests |
| `backend/tests/test_contract_matrix.py` | Functional status/JSON matrix for all 54 API contract method/path pairs | Contract verification |
| `backend/tests/test_extended.py` | Lessons, tickets, impact, bookmarks, analytics, uploads, and CMS integration tests | Extended backend behavior |
| `backend/tests/test_rate_limit.py` | Rate-limit status and `Retry-After` test | Rate limiting |
| `migrations/alembic.ini` | Alembic configuration generated by Flask-Migrate | Database migrations |
| `migrations/env.py` | Flask-Migrate metadata and engine integration | Database migrations |
| `migrations/README` | Migration directory guidance | Database migrations |
| `migrations/script.py.mako` | Alembic revision template | Database migrations |
| `migrations/versions/c07e2cb2d634_initial_backend_schema.py` | Fresh-database-safe baseline revision | Database migrations |

Runtime-only files also created during live testing were `backend/climatify.db` and files under `backend/uploads/`. They are local database/upload artifacts, are ignored by backend configuration, and are not source files.

## 4. Modified Files

| Exact path | What changed | Why | Related feature |
|---|---|---|---|
| `backend/app.py` | Added Flask-Migrate, configured CORS/security headers, persisted page-view analytics, JSON errors, rate-limit headers, and production SPA fallback | Integrate the expanded backend safely | Infrastructure/security |
| `backend/models.py` | Added Lesson, ImpactHistory, CarbonFootprint, and Bookmark models; standardized UTC timestamps | Persist the newly completed member features | Database/member state |
| `backend/routes_member.py` | Added durable impact records, ticket exposure, bookmark CRUD, authenticated ownership, and persisted member actions | Complete member functionality | Member features |
| `backend/routes_forms.py` | Returned event ticket codes, recorded event impact, and allowed empty meeting notes per contract | Close contract mismatches | Forms/events |
| `backend/routes_extra.py` | Added persisted lesson reads, strict upload URLs, controlled AI configuration errors, and upload audit records | Harden extensions and uploads | Lessons/uploads/AI |
| `backend/routes_admin.py` | Added lesson CRUD, complete statistics, date-filtered traffic, and migration-compatible analytics | Complete admin features | Admin/analytics |
| `backend/routes_auth.py` | Added login/password audit events | Complete security audit coverage | Authentication |
| `backend/services.py` | Added impact-history service helper and UTC activity IDs | Avoid duplicated business logic | Services |
| `backend/utils.py` | Fixed optional JWT verification for member ownership checks | Make optional bearer behavior real | Authorization |
| `backend/config.py` | Added environment-configurable CORS origins | Secure deployment configuration | Configuration |
| `backend/extensions.py` | Added Flask-Migrate extension | Migration support | Database migrations |
| `backend/requirements.txt` | Added Flask-Migrate dependency | Install migration tooling | Dependencies |
| `backend/.env.example` | Added CORS, rate-limit, upload, frontend, AI, and port variable names | Document runtime configuration | Configuration |
| `src/services/api.ts` | Added client methods for lessons, progress, event cancellation, trees, impact, and bookmarks | Expose durable backend capabilities | Frontend integration |
| `src/store/useAuthStore.ts` | Synchronizes authenticated progress, tree, and event-cancellation actions to Flask | Preserve local UX while persisting state | Frontend integration |

Frontend integration files were modified in the final hardening pass: `src/services/api.ts` and `src/store/useAuthStore.ts`.

## 5. Deleted or Renamed Files

None.

## 6. Implemented Features

| Feature | Status | Implementation details | Relevant files/endpoints/models | Verification |
|---|---|---|---|---|
| Authentication | ✅ COMPLETE AND VERIFIED | JWTs contain `role` and a seven-day numeric `exp`; passwords use Werkzeug hashing | `routes_auth.py`; `POST /api/admin/login`, compatibility `POST /api/auth/login`, `POST /api/auth/register`; `User` | Backend tests and live login passed |
| Authorization | ✅ COMPLETE AND VERIFIED | Admin routes use `admin_required`; missing/invalid tokens return `401`, valid non-admin roles return `403` | `utils.py`, `routes_admin.py`, `routes_auth.py`; all `/api/admin/*` protected except login | Backend tests and live unauthorized checks passed |
| Admin login | ✅ COMPLETE AND VERIFIED | Top-level `token`, `success`, and `user`; uniform invalid credential response | `routes_auth.py`; `POST /api/admin/login` | Tested |
| Admin password changes | ✅ COMPLETE AND VERIFIED | Current password checked; new password hashed and persisted | `routes_auth.py`; `POST /api/admin/change-password`; `users` | Tested old/new login behavior |
| Admin statistics | ✅ COMPLETE AND VERIFIED | Counts are generated from database users, content, audit records, submissions, uploads, analytics, and registrations | `routes_admin.py`; `GET /api/admin/stats` | Matrix and live checks passed |
| Admin messages | ✅ COMPLETE AND VERIFIED | Contact submissions persist as messages; read/delete operations are protected | `models.py`, `routes_forms.py`, `routes_admin.py`; `contact_messages`; `GET /api/admin/messages`, `PUT /api/admin/messages/<id>/read`, `DELETE /api/admin/messages/<id>` | Live read/update checks passed |
| Admin settings | ✅ COMPLETE AND VERIFIED | Settings are stored and defaulted when absent | `AdminSettings`, `routes_admin.py`; `GET/POST /api/admin/settings` | Live checks passed |
| CMS CRUD | ✅ COMPLETE AND VERIFIED | Generic persisted CRUD for events, posts, programs, initiatives, courses, opportunities, team; POST/PUT return complete entities | `ContentItem`, `schemas.py`, `routes_admin.py`; 21 CMS method/path pairs | CMS create/update/delete test passed; all routes registered |
| Courses | ✅ COMPLETE AND VERIFIED | Course resources persist through `ContentItem` | `ContentItem`; `GET /api/courses`, CMS course CRUD | Live course read passed |
| Lessons | ✅ COMPLETE AND VERIFIED | Dedicated `Lesson` rows are created, ordered, published, read, updated, and deleted | `Lesson`, `routes_extra.py`, `routes_admin.py`; lesson read/admin CRUD endpoints | Expanded tests and live lesson reads passed |
| Server-side progress | ✅ COMPLETE AND VERIFIED | Course progress is persisted per user/course and never decreases | `CourseProgress`, `routes_member.py`; `POST /api/user/courses/<id>/progress` | Expanded tests and authenticated live member flow passed |
| Event cancellation | ✅ COMPLETE AND VERIFIED | Owned registration status changes to `Cancelled` and its ticket remains stored | `EventRegistration`, `routes_member.py`; `DELETE /api/user/events/<id>` | Expanded tests passed |
| Ticket identifiers | ✅ COMPLETE AND VERIFIED | Registration creates a unique non-guessable code and returns it; profiles expose it | `EventRegistration`, `routes_forms.py`, `routes_member.py` | Expanded tests and live registration passed |
| Trees | ✅ COMPLETE AND VERIFIED | `UserStats.virtual_trees` and impact history increment through the trees endpoint | `UserStats`, `ImpactHistory`, `routes_member.py`; `POST /api/user/trees` | Expanded tests and authenticated live member flow passed |
| Bookmarks | ✅ COMPLETE AND VERIFIED | Ownership-protected list/create/delete with duplicate and missing-content checks | `Bookmark`, `routes_member.py`; `/api/user/bookmarks` CRUD | Expanded tests and authenticated live member flow passed |
| Impact history | ✅ COMPLETE AND VERIFIED | Carbon, progress, trees, registration, and cancellation actions persist as history records | `ImpactHistory`, `CarbonFootprint`, `routes_member.py`; `GET /api/user/impact` | Expanded tests and authenticated live member flow passed |
| Public form submissions | ✅ COMPLETE AND VERIFIED | Forms validate and persist through `FormSubmission`; contacts also populate `ContactMessage` | `routes_forms.py`; seven public POST endpoints | Full live form matrix passed, including empty meeting notes |
| Image uploads | ✅ COMPLETE AND VERIFIED | Admin-only multipart upload with MIME, magic-byte, size, and filename checks | `routes_extra.py`; `POST /api/upload` | Fake PNG rejected; valid PNG accepted |
| Image storage | ✅ COMPLETE AND VERIFIED | Local filesystem storage under configured `UPLOAD_FOLDER`; metadata is persisted | `Upload`, `routes_extra.py` | Valid PNG/JPEG storage and retrieval tests passed; object storage/CDN remains a deployment option |
| Image URL generation | ✅ COMPLETE AND VERIFIED | Returns relative `/api/uploads/<filename>` URL | `routes_extra.py`; `POST /api/upload`, `GET /api/uploads/<filename>` | Upload response and retrieval verified |
| Database-backed analytics | ✅ COMPLETE AND VERIFIED | Analytics derives values from persisted page-view/form/registration events and database counts; traffic supports validated date ranges | `AuditLog`, `AnalyticsEvent`, `routes_admin.py`; `GET /api/admin/analytics`, `GET /api/admin/analytics/traffic` | Expanded tests, live admin flow, and invalid-date checks passed |
| Validation | ✅ COMPLETE AND VERIFIED | Required fields, dates, times, emails, enums, URLs, numeric ranges, image signatures | `schemas.py`, `utils.py`, route modules | Backend tests and invalid upload check passed |
| Rate limiting | ✅ COMPLETE AND VERIFIED | In-memory per-IP limiter returns `429` and `Retry-After`; applies to API traffic and is configurable | `rate_limit.py`, `app.py` | Dedicated rate-limit test passed |
| Audit logging | ✅ COMPLETE AND VERIFIED | Login, settings/CMS mutations, message actions, uploads, and member actions create `AuditLog` rows without secrets | `AuditLog`, `services.py`, route modules | Expanded audit assertions passed |
| Backend tests | ✅ COMPLETE AND VERIFIED | `unittest` suite covers authentication, authorization, all 54 contract pairs, public forms, CMS CRUD, lessons, member persistence, tickets, impact, bookmarks, uploads, analytics, audit logging, and rate limiting | `backend/tests/` | 21 passed, 0 failed |
| Frontend integration with `VITE_USE_MOCK_API=false` | ✅ COMPLETE AND VERIFIED | Vite frontend communicated with live Flask API; client synchronization methods compile and authenticated live member flows passed | `src/services/api.ts`, `src/store/useAuthStore.ts`; backend routes | `npm run check`, browser runtime, and live API flows passed |

## 7. API Endpoints

The contract defines 54 method/path pairs across 45 paths. The functional matrix in `backend/tests/test_contract_matrix.py`, existing auth tests, and live HTTP checks exercise every pair. The AI endpoint is the one configuration-dependent exception: valid input returns controlled `503` until a provider is configured.

### Public reads

| Method | Endpoint | Authentication | Purpose | Implementation | Tested |
|---|---|---|---|---|---|
| GET | `/api/programs` | None | List programs | ✅ | Yes, live |
| GET | `/api/programs/<id>` | None | Program detail | ✅ | Yes, matrix |
| GET | `/api/initiatives` | None | List initiatives | ✅ | Yes, live route sweep |
| GET | `/api/events` | None | List events | ✅ | Yes, live |
| GET | `/api/courses` | None | List courses | ✅ | Yes, live |
| GET | `/api/games` | None | List games | ✅ | Yes, live route sweep |
| GET | `/api/opportunities` | None | List opportunities | ✅ | Yes, live |
| GET | `/api/posts` | None | List posts | ✅ | Yes, live route sweep |
| GET | `/api/posts/<id>` | None | Post detail | ✅ | Yes, matrix |
| GET | `/api/team` | None | List team | ✅ | Yes, live route sweep |
| GET | `/api/careers` | None | List careers | ✅ | Yes, live route sweep |
| GET | `/api/carbon-questions` | None | Carbon questions | ✅ | Yes, live route sweep |
| GET | `/api/curricula/download` | None | Curriculum URL | ✅ | Yes, matrix/live |

### Public forms

| Method | Endpoint | Authentication | Purpose | Implementation | Tested |
|---|---|---|---|---|---|
| POST | `/api/contact` | None | Contact submission | ✅ | Yes, live |
| POST | `/api/meetings` | None | Meeting booking | ✅ | Yes, matrix/live |
| POST | `/api/partnerships` | None | Partnership request | ✅ | Yes, matrix/live |
| POST | `/api/workshops` | None | Workshop request | ✅ | Yes, matrix/live |
| POST | `/api/events/register` | None | Event registration | ✅ | Yes, live |
| POST | `/api/opportunities/apply` | None | Opportunity application | ✅ | Yes, matrix/live |
| POST | `/api/newsletter/subscribe` | None | Newsletter subscription | ✅ | Yes, matrix/live |

### Member endpoints

| Method | Endpoint | Authentication | Purpose | Implementation | Tested |
|---|---|---|---|---|---|
| GET | `/api/user/profile` | Optional bearer | Profile and persisted state | ✅ | Yes, live |
| PUT | `/api/user/profile` | Optional bearer | Update profile | ✅ | Yes, matrix/live |
| POST | `/api/user/carbon-footprint` | Optional bearer | Save footprint | ✅ | Yes, matrix/live |

### AI

| Method | Endpoint | Authentication | Purpose | Implementation | Tested |
|---|---|---|---|---|---|
| POST | `/api/ai/chat` | None | Bilingual climate response | ⚠️ Config-dependent | Controlled `503` and invalid payload tested; provider success requires external configuration |

### Admin auth/dashboard/settings

| Method | Endpoint | Authentication | Purpose | Implementation | Tested |
|---|---|---|---|---|---|
| POST | `/api/admin/login` | None | Admin JWT login | ✅ | Yes, live and unit |
| POST | `/api/admin/change-password` | Admin JWT | Change password | ✅ | Yes, unit |
| GET | `/api/admin/settings` | Admin JWT | Read settings | ✅ | Yes, live |
| POST | `/api/admin/settings` | Admin JWT | Save settings | ✅ | Yes, matrix/live |
| GET | `/api/admin/stats` | Admin JWT | Dashboard statistics | ✅ | Yes, live |
| GET | `/api/admin/analytics` | Admin JWT | Aggregated analytics | ✅ | Yes, live |
| GET | `/api/admin/messages` | Admin JWT | Contact messages | ✅ | Yes, live |
| PUT | `/api/admin/messages/<id>/read` | Admin JWT | Mark message read | ✅ | Yes, live |
| DELETE | `/api/admin/messages/<id>` | Admin JWT | Delete message | ✅ | Yes, matrix/live |

### Admin CMS CRUD

| Method | Endpoint | Authentication | Purpose | Implementation | Tested |
|---|---|---|---|---|---|
| POST | `/api/admin/events` | Admin JWT | Create event | ✅ | Yes, unit |
| PUT | `/api/admin/events/<id>` | Admin JWT | Update event | ✅ | Yes, unit |
| DELETE | `/api/admin/events/<id>` | Admin JWT | Delete event | ✅ | Yes, unit |
| POST | `/api/admin/posts` | Admin JWT | Create post | ✅ | Yes, matrix/live |
| PUT | `/api/admin/posts/<id>` | Admin JWT | Update post | ✅ | Yes, matrix/live |
| DELETE | `/api/admin/posts/<id>` | Admin JWT | Delete post | ✅ | Yes, matrix/live |
| POST | `/api/admin/programs` | Admin JWT | Create program | ✅ | Yes, matrix/live |
| PUT | `/api/admin/programs/<id>` | Admin JWT | Update program | ✅ | Yes, matrix/live |
| DELETE | `/api/admin/programs/<id>` | Admin JWT | Delete program | ✅ | Yes, matrix/live |
| POST | `/api/admin/initiatives` | Admin JWT | Create initiative | ✅ | Yes, matrix/live |
| PUT | `/api/admin/initiatives/<id>` | Admin JWT | Update initiative | ✅ | Yes, matrix/live |
| DELETE | `/api/admin/initiatives/<id>` | Admin JWT | Delete initiative | ✅ | Yes, matrix/live |
| POST | `/api/admin/courses` | Admin JWT | Create course | ✅ | Yes, matrix/live |
| PUT | `/api/admin/courses/<id>` | Admin JWT | Update course | ✅ | Yes, matrix/live |
| DELETE | `/api/admin/courses/<id>` | Admin JWT | Delete course | ✅ | Yes, matrix/live |
| POST | `/api/admin/opportunities` | Admin JWT | Create opportunity | ✅ | Yes, matrix/live |
| PUT | `/api/admin/opportunities/<id>` | Admin JWT | Update opportunity | ✅ | Yes, matrix/live |
| DELETE | `/api/admin/opportunities/<id>` | Admin JWT | Delete opportunity | ✅ | Yes, matrix/live |
| POST | `/api/admin/team` | Admin JWT | Create team member | ✅ | Yes, matrix/live |
| PUT | `/api/admin/team/<id>` | Admin JWT | Update team member | ✅ | Yes, matrix/live |
| DELETE | `/api/admin/team/<id>` | Admin JWT | Delete team member | ✅ | Yes, matrix/live |

### Additional implemented endpoints outside the 54-pair contract summary

| Method | Endpoint | Authentication | Purpose | Implementation | Tested |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | None | Frontend-compatible member registration | ✅ | Yes, matrix/live |
| POST | `/api/auth/login` | None | Frontend-compatible member login | ✅ | Yes, auth tests/live |
| GET | `/api/courses/<id>/lessons` | None | Course lessons | ✅ | Yes, extended/live |
| POST | `/api/user/events` | Optional bearer | Persist member event | ✅ | Unit route coverage/live registration path |
| DELETE | `/api/user/events/<id>` | Optional bearer | Cancel event | ✅ | Extended/live |
| POST | `/api/user/courses/<id>/progress` | Optional bearer | Persist course progress | ✅ | Extended/matrix/live |
| POST | `/api/user/trees` | Optional bearer | Persist tree count | ✅ | Extended/matrix/live |
| GET | `/api/user/impact` | Optional bearer | Impact summary/history | ✅ | Extended/matrix/live |
| GET | `/api/admin/analytics/traffic` | Admin JWT | Daily traffic aggregation | ✅ | Matrix/live |
| POST | `/api/upload` | Admin JWT | Image upload | ✅ | Extended/live, valid and invalid cases |
| GET | `/api/uploads/<filename>` | None | Serve uploaded image | ✅ | Extended/live retrieval |

Contract notes:

- All 54 contract pairs have functional automated coverage through the matrix/auth tests; representative live HTTP coverage also passed. AI provider success remains configuration-dependent.
- `ContentItem.data` is JSON rather than normalized per-entity columns.
- The curriculum endpoint returns `/static/climate-curriculum.pdf`; the actual PDF asset was not verified.
- Event ticket codes are returned in the registration response and member profile extension, beyond the original contract shape.
- `/api/auth/login` and `/api/auth/register` are compatibility endpoints used by the existing frontend even though they are outside the current contract summary.

## 8. Database Changes

### New tables/models

- `users`: admin/member identity, role, password hash, profile fields.
- `content_items`: CMS resources keyed by `kind` and JSON payload.
- `contact_messages`: contact inbox records and read state.
- `form_submissions`: meetings, partnerships, workshops, applications, newsletter, and event submission payloads.
- `event_registrations`: event/user relationships, attendee data, ticket code, status.
- `user_stats`: eco points, virtual trees, badges.
- `user_activities`: member activity feed.
- `course_progress`: per-user/per-course progress.
- `lessons`: durable course lessons with unique per-course ordering.
- `carbon_footprints`: persisted carbon submissions.
- `impact_history`: persisted member impact actions.
- `bookmarks`: unique user/content bookmarks.
- `admin_settings`: singleton settings row.
- `audit_logs`: actor, action, resource, IP, timestamp.
- `analytics_events`: event type/path/timestamp storage model.
- `uploads`: stored filename, URL, MIME type, size, timestamp.

### Relationships

- `User` has one `UserStats` record.
- `User` is referenced by `EventRegistration`, `CourseProgress`, `UserActivity`, and `AuditLog`.
- `EventRegistration.event_id` and `CourseProgress.course_id` reference `ContentItem` IDs.
- CMS resources are distinguished by `ContentItem.kind`.

### Migrations/schema changes

Flask-Migrate/Alembic is initialized at the project-root `migrations/` directory. Revision `c07e2cb2d634_initial_backend_schema.py` bootstraps the complete SQLAlchemy metadata for a fresh SQLite/PostgreSQL database and safely preserves existing tables. Normal production startup no longer calls `db.create_all()`; tests may still use it through `TESTING=True`. Verified commands: `flask db current`, `flask db migrate` with no pending schema changes, and `flask db upgrade` on a fresh SQLite database.

### Seed data

`backend/seed.py` creates baseline development content for a program, event, course, and opportunity. It creates the first admin only when `ADMIN_BOOTSTRAP_PASSWORD` is supplied. The local database used during testing contains those seed records plus live test submissions and registrations.

### Real persistence

Real database persistence is used for authentication, CMS content, settings, messages, forms, registrations, course progress, tree counters, user statistics, activities, uploads metadata, audit logs, and analytics counts.

## 9. Frontend Integration

With `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=http://127.0.0.1:5000/api`, the frontend successfully communicated with Flask. A real browser page at `http://localhost:5173/` rendered persisted backend program data and displayed explicit empty states for unseeded content collections. Live API checks also passed for login, public reads, admin dashboard reads, contact submission, event registration, lessons, profile, upload, CORS, and unauthorized admin access.

Remaining integration limitations:

- The complete UI workflow was not manually exercised for every form and every CMS entity.
- Existing member progress, tree, and event-cancellation UI logic keeps local state for immediate UX and synchronizes when a member JWT is active; the UI does not yet expose a complete bookmark management screen.
- The AI endpoint intentionally returns a controlled `503` until an AI provider is configured server-side.

## 10. Testing and Validation

| Check | Actual result |
|---|---|
| Backend tests | `python -m unittest discover -s backend/tests -v`: **21 passed, 0 failed** |
| Frontend tests | `npm run test` during `npm run check`: **46 passed, 0 failed** across 7 files |
| `npm run check` | Passed: typecheck, lint, and frontend tests |
| Typecheck | Passed through `npm run check` |
| Lint | Passed through `npm run check` |
| API contract validation | Functional matrix covers all 54 method/path pairs with success/error/auth assertions; live HTTP coverage passed representative public/admin/member/CMS flows. AI success remains provider-dependent. |
| Upload validation | Passed: fake/unsupported/oversized/malicious cases rejected; valid PNG/JPEG accepted and retrieved |
| Frontend runtime | Passed representative browser/runtime check with mock mode disabled |
| Production build | `npm run build`: **passed**; Vite generated `dist/` successfully |
| Flask SPA fallback | **Passed** for `/`, `/courses`, `/admin/settings`, a generated static asset, and JSON `/api/no-such-route` 404 |
| CORS preflight | Passed with `200` and `Authorization` allowed |
| Authorization | Missing admin token produced `401`; valid admin routes produced `200` in live checks; non-admin `403` covered by backend test |

The backend emitted Python/SQLAlchemy deprecation/resource warnings during tests, but no test failures occurred.

## 11. Environment Variables

Names only:

- `JWT_SECRET_KEY`
- `DATABASE_URL`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `UPLOAD_FOLDER`
- `FRONTEND_DIST`
- `RATE_LIMIT_PER_MINUTE`
- `AI_PROVIDER_URL`
- `AI_PROVIDER_KEY`
- `PORT`
- `VITE_API_BASE_URL`
- `VITE_USE_MOCK_API`

## 12. Run Instructions

From the project root in PowerShell:

```powershell
# Backend dependencies
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt

# Configure backend environment variables without committing secrets
$env:JWT_SECRET_KEY = "<random-secret-at-least-32-characters>"
$env:DATABASE_URL = "sqlite:///climatify.db"
$env:ADMIN_BOOTSTRAP_EMAIL = "admin@climatify.org"
$env:ADMIN_BOOTSTRAP_PASSWORD = "<development-password>"
$env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:RATE_LIMIT_PER_MINUTE = "120"

# Create or upgrade the database schema
flask --app backend.app db upgrade

# Seed admin/content idempotently
python -m backend.seed

# Run backend
python -m backend.app
```

Run the frontend against the real backend in a separate terminal:

```powershell
$env:VITE_API_BASE_URL = "http://127.0.0.1:5000/api"
$env:VITE_USE_MOCK_API = "false"
npm run dev
```

Run tests and checks:

```powershell
python -m unittest discover -s backend/tests -v
npm run test
npm run typecheck
npm run lint
npm run check
```

Migration workflow for future model changes:

```powershell
flask --app backend.app db migrate -m "describe schema change"
flask --app backend.app db upgrade
```

Build the frontend:

```powershell
npm run build
```

To run Flask with the built frontend, set `FRONTEND_DIST` if the build is not in the default root `dist` folder, set `JWT_SECRET_KEY`, then run:

```powershell
$env:FRONTEND_DIST = "D:\Climatify Project\dist"
$env:JWT_SECRET_KEY = "<random-secret-at-least-32-characters>"
python -m backend.app
```

The SPA fallback is intended to serve `index.html` for non-API deep links after `dist/index.html` exists.

## 13. Final Verification Summary

| Area | Result |
|---|---|
| Backend tests | 21 passed / 0 failed |
| Contract endpoints | 54 / 54 behavior-covered by automated matrix/auth tests; AI provider success is configuration-dependent |
| Public endpoints | 20 / 20 verified by matrix and live checks |
| Admin endpoints | 9 / 9 verified by matrix/auth tests and live checks |
| Member contract endpoints | 3 / 3 verified by matrix and live checks |
| CMS CRUD groups | 7 / 7 verified for create/update/delete |
| Lessons | PASS |
| Tickets | PASS |
| Impact history | PASS |
| Bookmarks | PASS |
| Uploads | PASS |
| Rate limiting | PASS |
| Audit logging | PASS |
| Migrations | PASS |
| Frontend tests | 46 passed / 0 failed |
| Typecheck | PASS |
| Lint | PASS |
| `npm run check` | PASS |
| Production build | PASS |
| Flask SPA fallback | PASS |
| Frontend with `VITE_USE_MOCK_API=false` | PASS for browser/live API flows |

The AI endpoint is intentionally reported as configuration-dependent for provider-backed success: without `AI_PROVIDER_URL` and `AI_PROVIDER_KEY`, valid requests return the tested controlled `503` response.

## 14. Remaining Work

### Required

- Normalize or formally schema-version the CMS JSON payloads; current `ContentItem.data` JSON requires stronger database-level guarantees.
- Add a complete frontend bookmark management screen if bookmarks are exposed to users.

### Recommended

- Replace local filesystem uploads with S3/Cloudinary/object storage and signed or CDN URLs.
- Replace the in-memory rate limiter with Redis-backed distributed rate limiting.
- Add structured production logging, request IDs, security headers, and centralized observability.
- Use timezone-aware UTC timestamps instead of deprecated `datetime.utcnow()` calls.
- Add a real AI provider integration behind `AI_PROVIDER_URL`/`AI_PROVIDER_KEY`, with timeout, quota, and output policy handling.
- Add pagination/filtering only after the frontend contract is extended; current lists return complete arrays as required.
- Add integration tests that start Flask and Vite together and exercise browser workflows.

### Optional

- Member authentication is implemented as compatibility support but is outside the current contract’s primary MVP assumptions.
- Add QR ticket rendering/verification.
- Add weekly/monthly traffic dimensions and richer analytics dashboards.
- Add background jobs for email notifications and analytics aggregation.

## 15. Final Statistics

- New files: **29 source/config/test/migration files** in the current backend implementation, plus runtime database/upload artifacts.
- Modified files: **16 backend/frontend/config files** in the final hardening pass, including `backend/app.py`, `src/services/api.ts`, and `src/store/useAuthStore.ts`.
- Deleted files: **0**.
- Endpoints implemented: **54 contract method/path pairs**, plus extension and compatibility endpoints.
- Endpoints missing: **0 of the 54 contract routes; bookmarks are implemented as extension endpoints.**
- Backend tests passed: **21**.
- Backend tests failed: **0**.
- Frontend tests passed: **46**.
- Frontend tests failed: **0**.
- Contract validation: **54/54 pairs functionally covered by automated matrix/auth tests; representative live success/error/auth flows passed; AI provider success is configuration-dependent**.
- Upload validation: **Passed** for invalid and valid PNG cases.
- Typecheck: **Passed**.
- Lint: **Passed**.
- Build: **Passed**.
- Runtime integration: **Live public, admin, CMS, forms, member, lessons, bookmarks, impact, uploads, AI failure, and analytics flows passed with `VITE_USE_MOCK_API=false`**.
- Overall backend status: **Operational and verified for the tested local configuration. Remaining work is normalized CMS schema, distributed production infrastructure, external AI provider integration, and optional frontend bookmark UI.**
