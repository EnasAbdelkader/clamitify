# 🚀 دليل وثائق التسليم الشامل لمطور الباك إند (Backend Developer Handoff Summary)
## Climatify Platform — Docs v2.0

> **أهلاً بك يا بطل! 👋**
> واجهة كلايمتيفاي (Frontend) جاهزة للربط المباشر بسيرفر Flask + PostgreSQL.
> المستند ده **ملخّص سريع**. المرجع الملزم بالتفصيل هو
> [`API_CONTRACT.md`](API_CONTRACT.md)، والحقيقة النهائية هي الكود
> `src/services/api.ts`.

---

## 🚨 0. خمس حقائق قبل أي حاجة (اقرأها ولو مش هتقرأ غيرها)

**Five facts. Read these even if you read nothing else.**

1. **`VITE_API_BASE_URL` لازم ينتهي بـ `/api`** → `http://127.0.0.1:5000/api`.
   من غير `/api` كل request بيرجع **404**. والفرونت مش بيضيف البادئة بنفسه.
   وعدّل `.env` **بمحرر نصوص** — `echo "..." > .env` بيمسح الملف وبيوّدي بقية المتغيرات.

2. **الـ login هو `POST /api/admin/login`** (مش `/api/auth/login`)، والتوكن لازم
   يكون **JWT بتلات أجزاء وفيه `exp` رقمي**، و **`token` في أعلى مستوى** في الـ body
   (مش جوه `data`). *The frontend decodes `exp` on every load; an opaque token
   means the session dies on refresh.*

3. **مفيش Safe Fallback ولا Mock Fallback بعد الآن.** *(النسخة القديمة من المستند
   ده كانت بتقول العكس — وده مبقى صحيح.)* أي `non-2xx` أو انقطاع اتصال أو تجاوز
   **15 ثانية** بيظهر **كرسالة خطأ صريحة** في الواجهة، مش بيانات وهمية.
   البيانات الوهمية بتيجي **بس** لما `VITE_USE_MOCK_API=true`.
   **The UI is now a trustworthy test surface:** if you see data, your endpoint
   really returned it.

4. **بوابة الأدمن في الفرونت `localStorage` فقط وممكن تجاوزها من devtools.**
   Flask **MUST** enforce `@jwt_required()` **and** `role == "admin"` on **every**
   `/api/admin/*` route. الفرونت حماية شكلية للـ UX، مش أمان.

5. **الـ `Authorization` header بيتبعت في كل request** (حتى `GET /api/programs`) لو
   فيه توكن → CORS لازم يسمح بـ `Authorization` وهيحصل **preflight `OPTIONS`**.
   وأي **`401`** بره الـ login **بيعمل logout فوري للأدمن** — فمتستخدمهاش بأي
   معنى تاني (استخدم `403` أو `404` أو `200`).

---

## 📋 1. نظرة عامة على الهيكلية والاتصال (Architecture & Connection)

1. **التقنية المعتمدة للباك إند (Recommended Tech Stack):**
   - **Framework:** Python Flask / Flask-RESTful.
   - **Database:** PostgreSQL (مع SQLAlchemy ORM & Flask-Migrate).
   - **Authentication:** JWT Bearer Token (`flask-jwt-extended`).
   - **Caching:** Redis (اختياري).
   - **Task Queue:** Celery (للإيميلات والتقارير الثقيلة — اختياري).

2. **عنوان وسياق الـ APIs:**
   - **Default Base URL:** `http://127.0.0.1:5000/api` (في `.env` عبر
     `VITE_API_BASE_URL` — **مع `/api`**).
   - **Auth Header:** التوكن بيتبعت تلقائياً كـ `Authorization: Bearer <token>`
     في **كل** الطلبات اللي فيها توكن مخزّن، بما فيها الـ public GETs.
   - **Timeout:** الفرونت بيلغي أي طلب مردّش خلال **15000 ms**.
   - **CORS:** لازم يسمح لـ `http://localhost:5173` و `http://127.0.0.1:5173`
     ويشمل `Authorization` في `allow_headers` ويرد على `OPTIONS`.
   - **بديل أسهل محلياً:** `vite.config.ts` فيه **بروكسي dev** لـ `/api` →
     `http://127.0.0.1:5000`. حطّ `VITE_API_BASE_URL=/api` وخلاص — مفيش CORS خالص.
   - **Frontend dev port ثابت على 5173** (`strictPort: true`) عشان الـ allowlist
     ما تبوظ في السكوت.

3. **وضع المحاكاة والبيانات الحقيقية (Mock vs Real API Switch):**
   - `VITE_USE_MOCK_API` في `.env`.
   - `true` → **مفيش أي network request خالص**؛ كل حاجة من `src/services/mockData.ts`.
   - `false` (الافتراضي) → طلبات حقيقية لـ Flask، **وأي فشل بيبان للمستخدم**
     كرسالة خطأ مع زر "إعادة المحاولة". **مفيش fallback صامت.**

4. **أشكال الردود المقبولة (Response envelopes):**
   الـ client بيقبل الشكلين لأي endpoint —
   `[...]` / `{...}` مباشرة، **أو** `{ "success": true, "data": ... }`.
   - ⚠️ **استثناء واحد:** `POST /api/admin/login` **مش** بيعدي على الـ unwrap —
     `token` لازم يكون top-level.
   - ⚠️ **`200` مع `{"success": false}` بيتعامل كنجاح.** الفشل لازم status غير 2xx.

5. **الأخطاء:** JSON دايماً. في `400`/`422` الـ client بيعرض للمستخدم **أول** مفتاح
   موجود من `message` → `error` → `detail` — فاكتبه بالعربي ومفهوم.

---

## 🔗 2. مسارات الـ REST API المطلوبة (Endpoints Checklist)

**المجموع: 54 method+path pair عبر 45 مسار** — مستخرجة من `src/services/api.ts`.

### 🌐 Public Endpoints (العامة) — 13
| Method | Endpoint | Description | Request Payload | Response Sample |
|---|---|---|---|---|
| `GET` | `/api/programs` | جلب قائمة البرامج والخدمات | None | `[{ id, titleEn, titleAr, descriptionEn, descriptionAr, icon }]` |
| `GET` | `/api/programs/<id>` | تفاصيل برنامج معين | None | `{ id, titleEn, titleAr, ... }` |
| `GET` | `/api/initiatives` | قائمة المبادرات والحملات | None | `[{ id, titleEn, titleAr, image, progress, participantsCount }]` |
| `GET` | `/api/events` | قائمة الفعاليات | None | `[{ id, titleEn, titleAr, date, locationEn, registeredCount }]` |
| `GET` | `/api/courses` | قائمة المساقات والدروس | None | `[{ id, titleEn, titleAr, lessonsCount, durationEn, image }]` |
| `GET` | `/api/games` | الألعاب التفاعلية والمحاكاة | None | `[{ id, titleEn, titleAr, categoryEn, icon, playUrl }]` |
| `GET` | `/api/opportunities` | فرص العمل والتطوع والزمالة | None | `[{ id, titleEn, typeEn, locationEn, postedDate }]` |
| `GET` | `/api/posts` | المقالات والأخبار | None | `[{ id, titleEn, titleAr, contentEn, image, date }]` |
| `GET` | `/api/posts/<id>` | قراءة مقالة كاملة | None | `{ id, titleEn, titleAr, contentEn, ... }` |
| `GET` | `/api/team` | أعضاء الفريق والمجلس الاستشاري | None | `[{ id, nameEn, nameAr, roleEn, roleAr, image }]` |
| `GET` | `/api/careers` | خريطة المسارات المهنية | None | `[{ id, titleEn, skillsEn: [...], salaryEn, demand }]` |
| `GET` | `/api/carbon-questions` | أسئلة حاسبة البصمة الكربونية | None | `[{ questionEn, questionAr, options: [{ textEn, value }] }]` |
| `GET` | `/api/curricula/download` | رابط تحميل المناهج 🆕 مستخدم فعلاً | None | **`{ url: "https://.../curriculum.pdf" }`** |

> ✅ `/api/team` و `/api/games` و `/api/careers` و `/api/carbon-questions`
> **كلهم مستخدمين فعلاً** في الواجهة. *(أي ملاحظة قديمة بتقول "معرّف لكن غير
> مستخدم / hardcoded في الفرونت" مبقتش صحيحة واتشالت.)*
> ⚠️ `/api/curricula/download` **لازم JSON فيه `url`** — الـ client بيقرا JSON،
> فإرسال ملف PDF مباشرةً مش هيشتغل.

---

### 📩 Form Submissions & User Actions (نماذج التفاعل) — 8
| Method | Endpoint | Description | Request Payload Body | Response Sample |
|---|---|---|---|---|
| `POST` | `/api/contact` | إرسال رسالة اتصل بنا | `{ firstName, lastName, email, subject, message }` | `{ success: true, message: "..." }` |
| `POST` | `/api/meetings` | حجز موعد اجتماعات | `{ name, email, date, time, notes }` | `{ success: true, message: "..." }` |
| `POST` | `/api/partnerships` | طلبات الشراكة والمؤسسات | `{ orgName, orgType, contactPerson, email, proposal }` | `{ success: true, message: "..." }` |
| `POST` | `/api/workshops` | طلبات المدارس والجامعات | `{ institutionName, city, studentCount, workshopType, email }` | `{ success: true, message: "..." }` |
| `POST` | `/api/events/register` | التسجيل في فعالية | `{ eventId, name, email, phone }` | `{ success: true, message: "..." }` |
| `POST` | `/api/opportunities/apply` | التقديم على فرصة عمل/تطوع | `{ opportunityId, name, email, portfolio, coverLetter }` | `{ success: true, message: "..." }` |
| `POST` | `/api/newsletter/subscribe` | الاشتراك في النشرة الإخبارية | `{ email }` | `{ success: true, message: "..." }` |
| `POST` | `/api/ai/chat` | المساعد الذكي المناخي | **`{ prompt, language }`** | `{ success: true, reply: "..." }` |

> ⚠️ `/api/workshops` — **مش** `/api/education-workshops`.
> ⚠️ `/api/ai/chat` بياخد **`prompt`** — **مش** `message`.
> ⚠️ حفظ البصمة الكربونية بقى **`POST /api/user/carbon-footprint`** (تحت `/user/`)
> وموجود في جدول الأعضاء تحت — **مش** `/api/carbon-footprint`.

---

### 👤 User Profile & Member Dashboard (لوحة الأعضاء) — 3
| Method | Endpoint | Description | Auth Header | Response Sample |
|---|---|---|---|---|
| `GET` | `/api/user/profile` | بيانات ملف المستخدم والإحصائيات | Bearer (لو موجود) | `{ name, email, city, bio, stats, recentActivities, registeredCourses, registeredEvents }` |
| `PUT` | `/api/user/profile` | تعديل بيانات الملف | Bearer (لو موجود) | `{ success: true, message: "..." }` |
| `POST` | `/api/user/carbon-footprint` | حفظ نتيجة البصمة الكربونية | Bearer (لو موجود) | `{ success: true, message: "..." }` |

> 🚨 **مفيش تسجيل دخول للأعضاء في التطبيق كله.** `user_token` بيتقرا في الكود لكن
> **مفيش أي حاجة بتكتبه**، ومفيش شاشة تسجيل عضو، و **`/dashboard` route عام**.
> يعني المسارات دي بتتنادى بتوكن الأدمن لو موجود، أو من غير توكن.
> **للـ MVP متردّش `401` منها** — هتعمل logout للأدمن. رجّع `200` ببروفايل
> افتراضي أو `403`.
> كل المفاتيح الأربعة (`stats`, `recentActivities`, `registeredCourses`,
> `registeredEvents`) لازم تكون موجودة — arrays فاضية `[]` لو مفيش بيانات، مش `null`.

---

### 🔐 Admin Portal — Auth, Dashboard & Settings — 9
| Method | Endpoint | Description | Request Payload / Auth |
|---|---|---|---|
| `POST` | `/api/admin/login` | تسجيل دخول المدير | `{ email, password }` → `{ success: true, token: "JWT..." }` — **`token` top-level** |
| `POST` | `/api/admin/change-password` | تغيير كلمة مرور المدير | Bearer → `{ success: true, message: "..." }` |
| `GET` | `/api/admin/settings` | **🆕 قراءة إعدادات الموقع** | Bearer → `{ siteName, contactEmail, enableMaintenance }` |
| `POST` | `/api/admin/settings` | حفظ إعدادات الموقع | Bearer → `{ success: true }` |
| `GET` | `/api/admin/stats` | إحصائيات لوحة التحكم | Bearer → `{ totalVisitors, activeMembers, upcomingEvents, publishedPosts, recentActivities }` — **العدادات strings** |
| `GET` | `/api/admin/analytics` | الرسوم والمؤشرات | Bearer → `[{ labelAr, labelEn, value, icon }]` — **`icon` = اسم أيقونة lucide** |
| `GET` | `/api/admin/messages` | رسائل اتصل بنا الواردة | Bearer → `[{ id, sender, email, subject, message, date, isRead }]` |
| `PUT` | `/api/admin/messages/<id>/read` | تحديث حالة قراءة الرسالة | Bearer + **body `{ isRead: true }`** → `{ success: true }` |
| `DELETE` | `/api/admin/messages/<id>` | حذف رسالة | Bearer، **بدون body** → `{ success: true }` |

> 🆕 `GET /api/admin/settings` **جديد** — الـ CMS بيحمّل الإعدادات عند فتح الصفحة.
> ⚠️ `PUT /api/admin/messages/<id>/read` **بالـ `/read` في الآخر وبياخد body**.
> ⚠️ `icon` في الـ analytics = `"BarChart3"` | `"Users"` | `"TrendingUp"` |
> `"Ticket"` — **مش إيموجي**، الإيموجي بيتجاهل.

---

### 🗂️ Admin CMS Management — 21 route كلها تحت `/api/admin/*`

> 🚨 **تصحيح مهم:** النسخة القديمة من الجدول ده كانت بتقول
> `POST /api/events` و `PUT /api/posts/<id>` … **بدون `/admin`** — وده **غلط**.
> **كل الـ 21 route دول تحت `/api/admin/`.**
> Public reads stay at `/api/events`; **all writes are `/api/admin/events`.**
> ده مقصود عشان تحمي كل الكتابات بـ guard واحد على الـ blueprint.

| Method | Endpoint | Description | Auth / Response |
|---|---|---|---|
| `POST` | `/api/admin/events` | إضافة فعالية (CMS) | Bearer Admin → **الكيان كامل + `id` + `registeredCount: 0`** |
| `PUT` | `/api/admin/events/<id>` | تعديل فعالية | Bearer Admin → الكيان كامل بعد التعديل |
| `DELETE` | `/api/admin/events/<id>` | حذف فعالية | Bearer Admin → `{ success: true }` |
| `POST` | `/api/admin/posts` | إضافة مقالة | Bearer Admin → BlogPost كامل + `id` |
| `PUT` | `/api/admin/posts/<id>` | تعديل مقالة | Bearer Admin → BlogPost كامل |
| `DELETE` | `/api/admin/posts/<id>` | حذف مقالة | Bearer Admin → `{ success: true }` |
| `POST` | `/api/admin/programs` | إضافة برنامج | Bearer Admin → Program كامل + `id` |
| `PUT` | `/api/admin/programs/<id>` | تعديل برنامج | Bearer Admin → Program كامل |
| `DELETE` | `/api/admin/programs/<id>` | حذف برنامج | Bearer Admin → `{ success: true }` |
| `POST` | `/api/admin/initiatives` | إضافة مبادرة | Bearer Admin → Initiative كامل + `id` |
| `PUT` | `/api/admin/initiatives/<id>` | تعديل مبادرة | Bearer Admin → Initiative كامل |
| `DELETE` | `/api/admin/initiatives/<id>` | حذف مبادرة | Bearer Admin → `{ success: true }` |
| `POST` | `/api/admin/courses` | إضافة مساق | Bearer Admin → Course كامل + `id` |
| `PUT` | `/api/admin/courses/<id>` | تعديل مساق | Bearer Admin → Course كامل |
| `DELETE` | `/api/admin/courses/<id>` | حذف مساق | Bearer Admin → `{ success: true }` |
| `POST` | `/api/admin/opportunities` | إضافة فرصة | Bearer Admin → Opportunity كامل + `id` |
| `PUT` | `/api/admin/opportunities/<id>` | تعديل فرصة | Bearer Admin → Opportunity كامل |
| `DELETE` | `/api/admin/opportunities/<id>` | حذف فرصة | Bearer Admin → `{ success: true }` |
| `POST` | `/api/admin/team` | إضافة عضو فريق | Bearer Admin → TeamMember كامل + `id` |
| `PUT` | `/api/admin/team/<id>` | تعديل عضو فريق | Bearer Admin → TeamMember كامل |
| `DELETE` | `/api/admin/team/<id>` | حذف عضو فريق | Bearer Admin → `{ success: true }` |

> ⚠️ **`POST` و `PUT` لازم يرجّعوا الكيان الكامل** (مش `{success:true}` بس) —
> الـ CMS بيحقن الرد في الجدول على طول من غير reload.
> ⚠️ `PUT` **partial**: طبّق الحقول المبعوتة بس ومتصفّرش الباقي.
> ⚠️ `DELETE` **من غير body** — متعملش `request.get_json()` عليها.

---

## 🌍 3. حاجات لازم تعملها وغالباً هتنساها

| المطلوب | لو نسيته يحصل إيه | التفاصيل |
|---|---|---|
| **SPA history fallback** — رجّع `index.html` لأي مسار مش ملف ومش `/api/*` | كل رابط عميق (`/events`, `/blog/:id`) يرجع **404** بعد الـ refresh | العقد §11 · الدليل §14 |
| **صلّح الـ `@app.errorhandler(404)`** عشان ما يردّش JSON على مسارات الـ SPA | نفس المشكلة اللي فوق — والـ handler الموجود في أمثلة الدليل القديمة كان بيكسرها | الدليل §8.4 |
| **`POST /api/upload` → `{ url }`** | 4 كيانات (`Initiative`, `Course`, `BlogPost`, `TeamMember`) فيها `image` **مطلوب** ومفيش أي endpoint لرفع الصور | العقد §10.6 · الدليل §8.5 |
| **لستة كاملة من غير query params** | الفرونت مش بيبعت `page` — لو رجّعت 20 عنصر افتراضياً، الواجهة هتعرض 20 وتسكت | العقد §10.7 |
| **`YYYY-MM-DD` بدون جزء وقت** | الفرونت بيفسّر التواريخ كأيام تقويمية **محلية**؛ `...T22:00:00Z` ممكن يعرض يوم مختلف | العقد §10.1 |
| **seed لأول أدمن** | مفيش شاشة تسجيل أدمن في الواجهة — مش هتقدر تسجّل دخول خالص | الدليل §4.7 |
| **`role` claim + فحصه في السيرفر** | أي حد يكتب أي string في `localStorage.admin_token` يفتح `/admin` | العقد §2.1 · الدليل §4.5 |

---

## 🧩 4. Endpoints الواجهة محتاجاها ولسه غير موجودة

| المطلوب | لمين | ليه |
|---|---|---|
| `POST /api/user/events` | لوحة العضو | إضافة فعالية لقائمة العضو |
| **`DELETE /api/user/events/<id>`** | لوحة العضو | **الإلغاء محلي بس دلوقتي** — السيرفر لسه شايف العضو مسجّل |
| `POST /api/user/courses/<id>/progress` | لوحة العضو | التقدّم في المساقات محلي بالكامل |
| `POST /api/user/trees` | لعبة الغاف | عدّاد الأشجار محلي بالكامل |
| `POST /api/user/login` (+ register) | تسجيل الأعضاء | مفيش member auth خالص (§2) |
| `POST /api/upload` | 4 كيانات فيها `image` | مفيش رفع صور في المنصة |
| `GET /api/courses/<id>/lessons` | LearningHub | قائمة الدروس placeholder |
| `GET /api/admin/analytics/traffic` | لوحة الأدمن | الشارت الشهري/الأسبوعي بيانات عيّنة معلّمة صريحة |

> 🔎 كلهم معلّمين في الكود بـ `TODO(backend)` — دوّر على النص ده.
> أولوية: **`DELETE /api/user/events/<id>`** و **`POST /api/upload`**.

---

## 📂 5. المستندات المتاحة

| الملف | المحتوى |
|---|---|
| [`docs/API_CONTRACT.md`](API_CONTRACT.md) | **المرجع الملزم** — كل endpoint وpayload وstatus code بالتفصيل، وقواعد الأنواع والتواريخ والأخطاء. |
| [`docs/BACKEND_DEVELOPER_GUIDE.md`](BACKEND_DEVELOPER_GUIDE.md) | دليل عملي خطوة بخطوة: Flask + JWT + CORS + Models + الأخطاء الشائعة + SPA fallback. |
| [`docs/FRONTEND_AUDIT_REPORT.md`](FRONTEND_AUDIT_REPORT.md) | تقرير تدقيق الواجهة (مرجع تاريخي). |
| [`README.md`](../README.md) | تشغيل الفرونت، متغيرات البيئة، بنية المشروع. |
| `src/services/api.ts` | **الحقيقة النهائية** — أي فرق بينه وبين المستندات = باج في المستند. |
| `src/types/index.ts` | كل أشكال البيانات كـ TypeScript interfaces. |

تمنياتنا لك بالتوفيق والنجاح! 🚀🌱

---

> **Last Updated:** 2026-07-26
> **Docs Version:** 2.0 — متوافق مع `API_CONTRACT.md` v2.0 و `src/services/api.ts`
