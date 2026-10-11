# 📜 API Contract — العقد الرسمي بين الفرونت إند والباك إند
## Climatify Platform — Contract v2.0

> **⚠️ هذا المستند هو المرجع الرسمي لكل الـ API endpoints.**
> ولو حصل تضارب بينه وبين أي مستند تاني → **هذا المستند هو المرجع.**
>
> **The ultimate authority is the code:** `src/services/api.ts`. Every path,
> method and payload in this document was verified against that file. If the
> code and this document ever disagree, **the code wins and this document is
> the bug** — fix the document.

> 🌍 **Bilingual by design.** الشرح بالعربي، لكن **كل قاعدة ملزمة** (المسارات،
> أشكال الـ payload، الـ status codes، متطلبات الـ auth) مكتوبة **بالإنجليزي كمان**
> عشان أي مطوّر backend مش بيقرا عربي يقدر ينفّذ صح.

---

## 🚨 0. أهم تغيير في هذا الإصدار — مفيش Mock Fallback بعد الآن

### 0.1 What changed

الـ API layer قديماً كان **بيبلع كل الأخطاء** ويرجّع بيانات وهمية `{success: true}`
لو السيرفر رد بـ 500 أو مكانش شغال أصلاً. **ده اتشال بالكامل.**

The old client swallowed every failure and silently returned hardcoded mock data
with `{success: true}`. **That behaviour is gone.** The new contract:

| الحالة | Old behaviour | **New behaviour** |
|---|---|---|
| non-2xx HTTP status | fake mock data, `success: true` | `throw new ApiError(msg, status, endpoint, body)` |
| Network down / DNS / CORS reject | fake mock data | `throw new ApiError(msg, 0, endpoint, err)` |
| No response within **15 000 ms** | fake mock data | request aborted → `ApiError` with `status: 0` |
| `VITE_USE_MOCK_API=true` | mock data | mock data (**the only** source of mock data) |

**Why it matters to you, the backend developer:** لو الواجهة بتعرض بيانات، يعني
السيرفر رجّعها فعلاً. ولو حصل أي خطأ، هيظهر في الواجهة كرسالة خطأ صريحة مع زر
"إعادة المحاولة" — مش صفحة فاضية ولا بيانات مزيّفة.

**The UI is now a trustworthy integration test surface.** A broken endpoint can
no longer look healthy. Open the page, and if you see an error banner, your
endpoint really failed.

### 0.2 `ApiError` — the single error type

```ts
class ApiError extends Error {
  status: number;          // HTTP status, or 0 for network failure / timeout
  endpoint: string;        // e.g. "/admin/messages/12/read"  (without the /api prefix)
  body: unknown;           // the parsed response body, if any
  get isNetworkError(): boolean;        // true when status === 0
  localizedMessage(lang: "ar" | "en"): string;   // ready-to-display sentence
}
```

`localizedMessage()` بيختار الرسالة على أساس الـ status:

| status | ماذا يعرض للمستخدم |
|---|---|
| `0` | "تعذّر الاتصال بالخادم…" / "Could not reach the server…" |
| `401`, `403` | "انتهت صلاحية الجلسة أو لا تملك صلاحية…" / "Your session expired…" |
| `404` | "العنصر المطلوب غير موجود." / "The requested item was not found." |
| `400`, `422` | **رسالة السيرفر نفسها** لو موجودة، وإلا رسالة تحقق عامة |
| أي حاجة تانية | "حدث خطأ في الخادم…" / "A server error occurred…" |

> ✅ **Actionable rule:** for `400` and `422`, the client shows **your** message
> verbatim. Put a human-readable, user-facing sentence in `message`, `error`, or
> `detail` — the first of those three keys that holds a non-empty string wins.
> ولو الرسالة موجهة للمستخدم النهائي، اكتبها بالعربي (الواجهة عربية افتراضياً).

### 0.3 The client accepts BOTH response shapes

```ts
// unwrap(): if the body is an object containing BOTH "success" AND "data",
// the client uses body.data. Otherwise it uses the body as-is.
```

يعني الاتنين دول مقبولين لأي endpoint:

```json
[ { "id": "a" }, { "id": "b" } ]
```
```json
{ "success": true, "data": [ { "id": "a" }, { "id": "b" } ] }
```

**Pick one style and be consistent.** لكن خد بالك من الاستثناء الوحيد:

> ⚠️ **`POST /api/admin/login` is NOT unwrapped.** The client reads `token` from
> the **raw top-level body**. `{"success":true,"data":{"token":"…"}}` **will not
> work** — the token must be at the top level. See §6.1.

> ⚠️ **`{"success": false}` with HTTP 200 is NOT supported anywhere.** Failure
> MUST be a non-2xx status code, otherwise the client treats the call as a
> success. الفشل لازم يكون status code غلط، مش flag في body ناجح.

---

## 🌐 1. Base Configuration

| Item | Value |
|---|---|
| **Base URL (default)** | `http://127.0.0.1:5000/api` |
| **Environment Variable** | `VITE_API_BASE_URL` — **must include the `/api` suffix** |
| **API Prefix** | `/api` (part of the base URL, not added by the client) |
| **Auth Header** | `Authorization: Bearer <jwt_token>` — sent on **every** request when a token exists |
| **Content-Type (requests)** | `application/json`, sent **only when there is a body** |
| **Content-Type (responses)** | `application/json` for every endpoint, including errors |
| **Date Format** | `YYYY-MM-DD` (see §10.1) |
| **Time Format** | `HH:MM` 24-hour |
| **Request timeout** | **15 000 ms**, then the client aborts and reports a network error |
| **Token Storage** | `localStorage.admin_token` (`user_token` is read but never written — see §2.4) |

> ⚠️ **الغلطة رقم واحد:** لو حطيت `VITE_API_BASE_URL=http://127.0.0.1:5000`
> (من غير `/api`) → **كل request هيرجع 404**. الـ client مش بيضيف `/api` بنفسه.

### 1.1 Option A — direct requests + CORS

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {
    "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
}})
```

**`Authorization` MUST be in `allow_headers`.** الفرونت بيبعت الهيدر ده في **كل**
request لو فيه توكن مخزّن — حتى في الـ public GETs زي `/api/programs`. ولأن
`Authorization` مش من الهيدرز المسموحة تلقائياً في CORS، المتصفح هيعمل
**preflight `OPTIONS`** قبل كل request. So your app must answer `OPTIONS` on
every `/api/*` route (Flask-CORS does this for you; a hand-rolled catch-all
must not swallow it).

الـ dev port ثابت على **5173** (`strictPort: true` في `vite.config.ts`) عشان
الـ allowlist اللي فوق ما تبوظ لو البورت اتغير لوحده.

### 1.2 Option B — Vite dev proxy (recommended locally, zero CORS)

`vite.config.ts` فيه بروكسي جاهز:

```ts
server: {
  port: 5173,
  strictPort: true,
  proxy: { "/api": { target: "http://127.0.0.1:5000", changeOrigin: true } },
}
```

لو استخدمته، حطّ في `.env`:

```
VITE_API_BASE_URL=/api
```

النتيجة: كل الطلبات بتبقى same-origin (`http://localhost:5173/api/...`) و Vite
بيحوّلها لـ Flask، فمفيش CORS ولا preflight خالص. **This is the fastest way to
start;** you can add CORS later for the deployed frontend.

---

## 🔐 2. Authentication & Authorization — اقرأ ده قبل أي كود

### 2.1 ⚠️ بوابة الأدمن في الفرونت هي UX فقط — والحماية الحقيقية مسؤوليتك

الواجهة بتحدد إن فيه أدمن مسجّل دخول بمجرد وجود توكن في `localStorage`. أي حد
يفتح devtools ويكتب `localStorage.setItem("admin_token", "...")` يقدر يفتح
`/admin` ويشوف الشاشات.

**The frontend admin gate is localStorage-only and trivially bypassable.
Therefore Flask MUST enforce, on EVERY `/api/admin/*` route:**

```python
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_jwt().get("role") != "admin":
            return jsonify({"error": "Admin privileges required"}), 403
        return fn(*args, **kwargs)
    return wrapper

@app.route("/api/admin/events", methods=["POST"])
@admin_required
def create_event(): ...
```

- `@jwt_required()` **and** an explicit `role == "admin"` check. التوكن الصالح
  لوحده **مش** كفاية — لازم تتأكد إن الدور أدمن.
- خليها على مستوى الـ Blueprint (`before_request`) عشان مستحيل تنسى route.
- **Never trust anything the frontend sends about identity or role.** الفرونت
  بيقرا التوكن بس مش بيتحقق منه — التحقق عندك.

### 2.2 JWT claims & expiry the client expects

الفرونت بيفتح الـ JWT payload (base64url) عشان يعرف هل الجلسة لسه صالحة:

```ts
// isTokenUsable(): decodes the payload and requires a numeric `exp` in the future.
```

**Normative requirements for the token you return:**

1. لازم يكون **JWT حقيقي بتلات أجزاء** `header.payload.signature`. أي توكن
   opaque (مثلاً UUID) → الفرونت هيرفض الجلسة عند أول reload.
   *An opaque token is accepted in mock mode only.*
2. الـ payload لازم يحتوي **`exp` كرقم بالثواني** (Unix seconds) — وده الافتراضي
   في `flask-jwt-extended`. لو `exp` ناقص أو نص → الجلسة تُرفض بعد الـ reload.
3. حطّ `role` في الـ claims عشان تتحقق منه في السيرفر:
   `create_access_token(identity=user.email, additional_claims={"role": user.role})`
4. المدة المقترحة: **7 أيام** (`JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)`).
   الفرونت **مفيهوش refresh token flow** — لما الـ `exp` يعدّي، الأدمن بيسجّل دخول
   من جديد. Don't bother issuing a refresh token; nothing consumes it.

### 2.3 معنى الـ 401 عند العميل — مهم

```ts
if (response.status === 401 && endpoint is not /admin/login or /admin/change-password) {
  clearTokens();                                    // logs the admin out
  window.dispatchEvent(new Event("auth_unauthorized"));
}
```

- **401 على أي route (غير الـ login) = تسجيل خروج فوري** للأدمن.
- **متستخدمش 401 لأي معنى تاني.** For "resource not found" use `404`; for
  "you are authenticated but not allowed" use `403`; for validation use
  `400`/`422`. A stray `401` will kick the admin out of the CMS mid-edit.
- الاستثناء: `POST /api/admin/login` و `POST /api/admin/change-password` —
  الـ 401 هنا معناه "بيانات غلط" وما بيعملش logout.

### 2.4 مفيش تسجيل دخول للأعضاء في التطبيق كله

**There is NO member/user authentication anywhere in the app today.**

- `localStorage.user_token` **بيتقرا** في `api.ts` و `Dashboard.tsx` — لكن **مفيش
  أي كود بيكتبه**. مفيش صفحة تسجيل عضو، ولا endpoint `POST /api/user/login`
  مستخدم.
- `/dashboard` **route عام** — أي حد يفتحه.
- الـ member endpoints (`/api/user/*`) بتتنادى بـ `admin_token` لو الأدمن مسجّل
  دخول، أو من غير أي توكن لو مفيش.

**Consequences for you:**
1. متبنيش منطق يعتمد على وجود مستخدم عضو مصادَق عليه في `/api/user/*` لحد ما
   يتعمل member auth. للـ MVP خليها ترجّع بيانات المستخدم المرتبط بالتوكن الموجود.
2. لو رجّعت `401` من `/api/user/profile` وقتما مفيش توكن → **الأدمن هيتطرد من
   الجلسة** (§2.3). الأفضل للـ MVP: رجّع `200` مع بروفايل فاضي/تجريبي، أو `403`.
3. member auth الحقيقي محتاج endpoints جديدة — §12.

### 2.5 Admin bootstrap / seed credentials

مفيش شاشة تسجيل أدمن في الواجهة، فأول أدمن **لازم** يتعمل seed من ناحيتك.

**Required:** ship a seed command/script that creates the first admin. Example:

```python
# seed.py — flask shell أو CLI command
from werkzeug.security import generate_password_hash

admin = User(email="admin@climatify.org", role="admin")
admin.set_password(os.environ["ADMIN_BOOTSTRAP_PASSWORD"])   # مش hardcoded
db.session.add(admin); db.session.commit()
```

- بيانات التطوير المستخدمة في الأمثلة: `admin@climatify.org` / `admin123`
  — **للتطوير المحلي فقط، تتغيّر قبل أي deploy.**
- خزّن الباسورد **hashed** دايماً (`generate_password_hash`) — أبداً plaintext.
- خلي الأدمن يغيّر الباسورد من `POST /api/admin/change-password` (§6.3).

---

## 📂 3. Public Read Endpoints (بدون Auth)

> ملحوظة: الفرونت بيبعت `Authorization` header هنا كمان لو فيه توكن (§1.1) —
> بس **ماينفعش** تطلب auth على المسارات دي. Treat the header as optional metadata.

### 3.1 `GET /api/programs` — البرامج والخدمات

**Response (200 OK):**
```json
[
  {
    "id": "digital-transformation",
    "titleEn": "Digital Transformation",
    "titleAr": "التحول الرقمي",
    "descriptionEn": "We build platforms, dashboards...",
    "descriptionAr": "نبني منصات ذكية، لوحات تحكم...",
    "icon": "Monitor",
    "longDescriptionEn": "Our digital transformation services...",
    "longDescriptionAr": "تساعد خدمات التحول الرقمي..."
  }
]
```

`icon` هو **اسم أيقونة lucide** كنص: `"Monitor"` | `"Search"` | `"Megaphone"` |
`"Users"` | `"MessageSquare"`. `longDescription*` اختياريين.

### 3.2 `GET /api/programs/<id>` — تفاصيل برنامج

**200 OK:** نفس شكل العنصر أعلاه (object واحد).
**404 Not Found:** `{ "error": "Program not found" }`

### 3.3 `GET /api/initiatives` — المبادرات

```json
[
  {
    "id": "cop28-campaign",
    "titleEn": "Paving the Way to COP28 Campaign",
    "titleAr": "حملة تمهيد الطريق نحو مؤتمر COP28",
    "descriptionEn": "...",
    "descriptionAr": "...",
    "image": "https://...",
    "categoryEn": "Outreach & Advocacy",
    "categoryAr": "التوعية والمناصرة",
    "progress": 100,
    "targetEn": "Engage 10,000+ Students",
    "targetAr": "توعية أكثر من 10,000 طالب وطالبة",
    "status": "completed",
    "participantsCount": 1024,
    "startDate": "2023-11-01"
  }
]
```

- `progress`: **number** 0–100 (مطلوب).
- `image`: **مطلوب** — انظر §10.6 (مفيش endpoint upload لسه).
- اختياري: `status` (`"active"` | `"completed"` | `"upcoming"`)،
  `participantsCount` (number)، `startDate` (`YYYY-MM-DD`).
  لو `status` ناقص، الفرونت بيستنتجه من `progress`.

### 3.4 `GET /api/events` — الفعاليات

```json
[
  {
    "id": "khalifa-univ-day",
    "titleEn": "Khalifa University's Environmental Day",
    "titleAr": "يوم البيئة والصحة والسلامة في جامعة خليفة",
    "descriptionEn": "...",
    "descriptionAr": "...",
    "date": "2026-04-25",
    "locationEn": "Khalifa University, Abu Dhabi",
    "locationAr": "جامعة خليفة، أبوظبي",
    "categoryEn": "Outreach & Education",
    "categoryAr": "التوعية والتعليم",
    "registeredCount": 320
  }
]
```

`registeredCount`: **number**. `date`: `YYYY-MM-DD` بالظبط — §10.1.
الفرونت بيقسّم الفعاليات لـ upcoming/past على أساس `date`، فأي صيغة تانية بتبوّظ الفرز.

### 3.5 `GET /api/courses` — المساقات التعليمية

```json
[
  {
    "id": "intro-climate-digitization",
    "titleEn": "Introduction to Climate Digitization",
    "titleAr": "مقدمة في الرقمنة المناخية",
    "descriptionEn": "...",
    "descriptionAr": "...",
    "instructorEn": "Yathreb Mahmoud",
    "instructorAr": "يثرب محمود",
    "durationEn": "4 weeks (8 hours)",
    "durationAr": "4 أسابيع (8 ساعات)",
    "lessonsCount": 12,
    "categoryEn": "Climate Tech",
    "categoryAr": "تكنولوجيا المناخ",
    "image": "https://..."
  }
]
```

`lessonsCount`: **number**. `duration*` نص حر معروض كما هو. `image` **مطلوب**.

### 3.6 `GET /api/games` — الألعاب التفاعلية

> ✅ **مستخدم فعلاً** — `GamesHub.tsx` بينادي عليه عند التحميل.
> (الملاحظة القديمة "معرّف لكن غير مستخدم" **لم تكن صحيحة وتم حذفها**.)

```json
[
  {
    "id": "carbon-footprint",
    "titleEn": "Carbon Footprint Simulator",
    "titleAr": "محاكي البصمة الكربونية",
    "descriptionEn": "...",
    "descriptionAr": "...",
    "categoryEn": "Education",
    "categoryAr": "تعليمي",
    "icon": "Activity",
    "playUrl": "/games/carbon-simulator"
  }
]
```

`icon` = اسم أيقونة lucide. `playUrl` = مسار داخلي أو رابط `https://`.
**`javascript:`, `data:`, `vbscript:`, `file:` URLs are rejected by the client**
(`sanitizeUrl`) — أي رابط بالمخططات دي هيتحوّل لـ `#invalid-url`.

### 3.7 `GET /api/opportunities` — فرص العمل والتطوع

```json
[
  {
    "id": "vol-dubai-outreach",
    "titleEn": "Community Outreach Volunteer",
    "titleAr": "متطوع في التوعية الجماهيرية",
    "descriptionEn": "...",
    "descriptionAr": "...",
    "typeEn": "Volunteering",
    "typeAr": "تطوع",
    "locationEn": "Dubai",
    "locationAr": "دبي",
    "postedDate": "2026-07-15"
  }
]
```

`typeEn` ∈ `"Job"` | `"Internship"` | `"Volunteering"` (الفلترة في الواجهة بتعتمد
على القيم دي بالحرف). `postedDate`: `YYYY-MM-DD`.

### 3.8 `GET /api/posts` — مقالات المدونة

```json
[
  {
    "id": "progress-report-2023",
    "titleEn": "Climatify Progress Report is Now Available",
    "titleAr": "تقرير تقدم كلايمتيفاي أصبح متاحاً الآن",
    "excerptEn": "...",
    "excerptAr": "...",
    "contentEn": "...",
    "contentAr": "...",
    "image": "https://...",
    "date": "2024-01-08",
    "authorEn": "Climatify Admin",
    "authorAr": "مسؤول كلايمتيفاي",
    "categoryEn": "Reports",
    "categoryAr": "التقارير"
  }
]
```

> ⚠️ المسار هو `/api/posts` (**مش** `/api/blog`).

### 3.9 `GET /api/posts/<id>` — تفاصيل مقال

**200 OK:** object واحد بنفس الشكل. **404:** `{ "error": "Post not found" }`
الـ route `/blog/:id` في الواجهة بيعتمد على ده مباشرة.

### 3.10 `GET /api/team` — أعضاء الفريق

> ✅ **مستخدم فعلاً** — `About.tsx` و `useCMSStore` بينادوا عليه.
> (الملاحظة القديمة "hardcoded في About.tsx" **لم تكن صحيحة وتم حذفها**.)

```json
[
  {
    "id": "yathreb",
    "nameEn": "Yathreb Mahmoud",
    "nameAr": "يثرب محمود",
    "roleEn": "Founder & Executive Director",
    "roleAr": "المؤسس والمدير التنفيذي",
    "image": "https://..."
  }
]
```

اختياري: `borderColor`, `gradient` (قيم CSS تُستخدم في التصميم). `image` **مطلوب**.

### 3.11 `GET /api/careers` — مسارات المهن الخضراء

```json
[
  {
    "id": "solar-engineer",
    "titleEn": "Solar Energy Systems Engineer",
    "titleAr": "مهندس نظم الطاقة الشمسية",
    "skillsEn": ["Photovoltaics", "Grid Integration"],
    "skillsAr": ["الأنظمة الكهروضوئية", "ربط الشبكات"],
    "salaryEn": "$85,000 - $110,000 / year",
    "salaryAr": "300,000 - 450,000 درهم / سنوياً",
    "pathEn": "Bachelor in Engineering...",
    "pathAr": "بكالوريوس هندسة...",
    "demand": "High"
  }
]
```

`skills*`: **arrays of strings** (مش نص واحد مفصول بفاصلة).
`demand` ∈ `"High"` | `"Medium"` | `"Urgent"` — **بالحرف كده**، الواجهة بتلوّن
الشارة على أساسه.

### 3.12 `GET /api/carbon-questions` — أسئلة حاسبة البصمة الكربونية

> ⚠️ المسار هو `/api/carbon-questions` — **مش** `/api/games/carbon-questions`.

```json
[
  {
    "questionEn": "How do you commute to work or school daily?",
    "questionAr": "كيف تتنقل إلى العمل أو الدراسة يومياً؟",
    "options": [
      { "textEn": "By private car (Gasoline)", "textAr": "بسيارة خاصة (بنزين)", "value": 4.6 },
      { "textEn": "Bicycle / Walking", "textAr": "الدراجة الهوائية أو المشي", "value": 0 }
    ]
  }
]
```

- مفيش `id` في السؤال — الترتيب في الـ array هو الهوية.
- `options[].value`: **number** (طن CO₂e سنوياً)، بيتجمع لحساب النتيجة النهائية.
- كل سؤال لازم يكون فيه **option واحدة على الأقل**، وإلا الحاسبة بتوقف عند السؤال.

### 3.13 `GET /api/curricula/download` — رابط تحميل المناهج

> ✅ **بقى مستخدم فعلاً** — زر التحميل في صفحة `/portals` كان وهمي واتوصّل بالسيرفر.

**MUST return JSON with a `url` string. Streaming the PDF bytes directly no
longer works** — الـ client بيقرا JSON وبيدوّر على `url`، وبعدين بيفتحه في تاب جديد.

**Response (200 OK):**
```json
{ "url": "https://cdn.climatify.org/climate-curriculum.pdf" }
```

- ينفع مسار نسبي كمان: `{ "url": "/static/climate-curriculum.pdf" }`.
- الرابط بيعدي على `sanitizeUrl`، فـ `javascript:` / `data:` / `vbscript:` /
  `file:` **مرفوضة** والواجهة بتعرض خطأ.
- لو `url` ناقص أو مش نص → الواجهة بتعرض خطأ صريح للمستخدم.
- ✅ الأفضل: يرجع رابط لملف ثابت أو presigned S3 URL.

---

## 📝 4. Public Form Submissions

كلها **بدون auth**، والـ response المتوقع `{ success, message }`
(`201 Created` أو `200 OK`). الرسالة العربية بتُعرض للمستخدم لو رجّعتها،
وإلا الواجهة عندها رسالة نجاح افتراضية.

**On validation failure return `400` or `422` with a human sentence** in
`message` / `error` / `detail` — الواجهة بتعرضها كما هي (§0.2).

### 4.1 `POST /api/contact` — استمارة اتصل بنا
```json
{
  "firstName": "أحمد",
  "lastName": "العتيبة",
  "email": "ahmed@example.com",
  "subject": "استفسار بخصوص المبادرات",
  "message": "نص الرسالة هنا..."
}
```
**201:** `{ "success": true, "message": "تم إرسال رسالتك بنجاح!" }`
> الرسائل اللي بتوصل من هنا هي نفسها اللي تظهر في `GET /api/admin/messages` (§6.5).
> The `sender` shown to the admin is expected to be `firstName + " " + lastName`.

### 4.2 `POST /api/meetings` — حجز موعد
```json
{
  "name": "عبد الله",
  "email": "abdalla@example.com",
  "date": "2026-08-01",
  "time": "14:00",
  "notes": "نرغب بمناقشة الحلول المناخية الرقمية."
}
```
`date`: `YYYY-MM-DD` · `time`: `HH:MM` بنظام 24 ساعة · `notes` قد تكون `""`.
**201:** `{ "success": true, "message": "تم حجز الموعد بنجاح!" }`

### 4.3 `POST /api/partnerships` — طلب شراكة
```json
{
  "orgName": "مؤسسة الإمارات للبيئة",
  "orgType": "ngo",
  "contactPerson": "فاطمة الحوسني",
  "email": "fatima@example.org",
  "proposal": "تفاصيل مقترح الشراكة..."
}
```
`orgType` ∈ `"corporate"` | `"government"` | `"ngo"` | `"academic"`.
**201:** `{ "success": true, "message": "تم إرسال طلب الشراكة بنجاح!" }`

### 4.4 `POST /api/workshops` — طلب ورشة تعليمية

> ⚠️ المسار هو `/api/workshops` — **مش** `/api/education-workshops`.

```json
{
  "institutionName": "جامعة الإمارات",
  "city": "العين",
  "studentCount": "150",
  "workshopType": "climate-basics",
  "email": "uaeu@example.ac.ae"
}
```
- `studentCount` بيتبعت كـ **string** (جاي من `<input>`) — اعمله cast عندك.
- `workshopType` ∈ `"climate-basics"` | `"carbon-calculator"` | `"ghaf-planting"`.

**201:** `{ "success": true, "message": "تم تسجيل طلب ورشة العمل بنجاح!" }`

### 4.5 `POST /api/events/register` — تسجيل في فعالية
```json
{
  "eventId": "khalifa-univ-day",
  "name": "سلطان القاسمي",
  "email": "sultan@example.com",
  "phone": "+971501234567"
}
```
**201:** `{ "success": true, "message": "تم التسجيل في الفعالية بنجاح!" }`
- الواجهة بتضيف الفعالية لقائمة العضو **بعد** ما تنجح المكالمة فقط.
- لو الإيميل مسجّل قبل كده، رجّع `409` أو `400` برسالة واضحة — الواجهة هتعرضها.
- المفروض `registeredCount` في `GET /api/events` يزيد بعد التسجيل الناجح.

### 4.6 `POST /api/opportunities/apply` — التقديم على فرصة
```json
{
  "opportunityId": "solar-engineer",
  "name": "سارة الحمادي",
  "email": "sara@example.com",
  "portfolio": "https://linkedin.com/in/sara",
  "coverLetter": "أرغب بالتقديم لوظيفة مهندس..."
}
```
**201:** `{ "success": true, "message": "تم إرسال طلب التقديم بنجاح!" }`
> مفيش رفع ملفات (CV) — `portfolio` مجرد رابط نصي. Attachments would need §10.6.

### 4.7 `POST /api/newsletter/subscribe` — الاشتراك في النشرة
```json
{ "email": "user@example.com" }
```
**200 / 201:** `{ "success": true, "message": "تم الاشتراك في النشرة الإخبارية بنجاح!" }`
> بيتنادى من الـ Footer في كل الصفحات. الإيميل المكرر: رجّع `200` (idempotent)
> أو `409` برسالة واضحة — الاتنين الواجهة بتتعامل معاهم صح.

---

## 👤 5. Member (User) Endpoints

> ⚠️ اقرا **§2.4** الأول: **مفيش تسجيل دخول للأعضاء في التطبيق.** الـ endpoints
> دي بتتنادى بتوكن الأدمن لو موجود، أو من غير توكن خالص.
> ⚠️ **متردّش `401` هنا للـ MVP** — هيعمل logout للأدمن (§2.3).

### 5.1 `GET /api/user/profile` — بيانات العضو

**Response (200 OK):**
```json
{
  "name": "عبد الله الشامسي",
  "email": "abdalla.shamsi@example.com",
  "city": "دبي",
  "bio": "ناشط مناخي مهتم بالرقمنة والحلول الصديقة للبيئة.",
  "stats": {
    "ecoPoints": 240,
    "virtualTrees": 3,
    "earnedBadges": 2
  },
  "recentActivities": [
    {
      "id": "1",
      "titleAr": "أنهيت الدرس الأول بنجاح",
      "titleEn": "Completed Lesson 1 Successfully",
      "detailAr": "في مساق مقدمة الرقمنة المناخية",
      "detailEn": "In Intro to Climate Digitization Course"
    }
  ],
  "registeredCourses": [
    {
      "id": "intro-climate-digitization",
      "titleAr": "مقدمة في الرقمنة المناخية",
      "titleEn": "Introduction to Climate Digitization",
      "progress": 50
    }
  ],
  "registeredEvents": [
    {
      "id": "khalifa-univ-day",
      "titleAr": "يوم البيئة بجامعة خليفة",
      "titleEn": "Khalifa University Environmental Day",
      "date": "2026-04-25",
      "status": "Confirmed"
    }
  ]
}
```

- كل المفاتيح الأربعة `stats`, `recentActivities`, `registeredCourses`,
  `registeredEvents` **لازم تكون موجودة** (arrays فاضية `[]` لو مفيش بيانات).
  Do not omit them and do not send `null`.
- `stats.*` أرقام. `progress` رقم 0–100.
- الواجهة **بتدمج** التقدّم المحلي مع اللي جاي من السيرفر (التقدّم المحلي ما
  بيتمسحش) — فرجّع أعلى قيمة تعرفها ومتصفّرهاش.

### 5.2 `PUT /api/user/profile` — تحديث بيانات العضو
```json
{ "name": "عبد الله", "city": "أبوظبي", "bio": "نبذة جديدة..." }
```
**200:** `{ "success": true, "message": "تم تحديث الملف الشخصي بنجاح!" }`
> `email` **مش** بيتبعت وما ينفعش يتغير من هنا.

### 5.3 `POST /api/user/carbon-footprint` — حفظ نتيجة البصمة

> ⚠️ المسار هو `/api/user/carbon-footprint` (تحت `/user/`) — **مش**
> `/api/carbon-footprint`.

```json
{ "footprint": 4.8 }
```
`footprint`: **number** (طن CO₂e سنوياً، عشري).
**200:** `{ "success": true, "message": "تم حفظ النتيجة بنجاح!" }`

---

## 🔑 6. Admin Auth & Dashboard

### 6.1 `POST /api/admin/login` — تسجيل دخول الأدمن

> 🚨 **المسار هو `/api/admin/login`.** الإصدارات القديمة من العقد كانت بتقول
> `/api/auth/login` وده **غلط** — الكود بينادي `/api/admin/login`.
> **This is the single most common integration failure. Get it right first.**

**Auth Required:** ❌ No · **Body:**
```json
{ "email": "admin@climatify.org", "password": "your-password-here" }
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "email": "admin@climatify.org", "role": "admin" }
}
```

**Normative rules for this endpoint (it is the one exception to §0.3):**
1. **`token` MUST be at the TOP LEVEL of the body.** الـ client بيقرا
   `body.token` من الـ raw response ومش بيعمل unwrap —
   `{"success":true,"data":{"token":"…"}}` **هيفشل**.
2. `token` لازم يكون **JWT بتلات أجزاء وفيه `exp` رقمي** — §2.2. غير كده الجلسة
   هتضيع عند أول reload.
3. `user` بيتم تجاهله من الـ client حالياً (بس رجّعه، مفيد للتشخيص).
4. `200` من غير `token` بيتعامل كفشل تسجيل دخول.

**Response (401 / 400 / 422) — بيانات غلط:**
```json
{ "success": false, "error": "بريد إلكتروني أو كلمة مرور غير صحيحة" }
```
- الـ statuses التلاتة دي بتتعرض في الفورم كـ "بيانات غلط" **وما بتعملش logout**.
- الرسالة اللي في `error` / `message` / `detail` بتُعرض للمستخدم — اكتبها بالعربي.
- أي status تاني (500 مثلاً) بيتحوّل لـ `ApiError` وبيبان كمشكلة سيرفر، مش
  بيانات غلط. **Never return 500 for wrong credentials.**
- 🔒 متقولش أي معلومة إضافية (زي "الإيميل مش موجود") — رسالة واحدة موحّدة.

### 6.2 `GET /api/admin/settings` — قراءة إعدادات الموقع  🆕

> 🆕 **endpoint جديد** — الـ CMS بقى بيحمّل الإعدادات عند فتح صفحة الإعدادات.
> Without it the settings form shows an error banner instead of the saved values.

**Auth:** ✅ Admin · **Response (200 OK):**
```json
{ "siteName": "Climatify", "contactEmail": "info@climatify-youth.com", "enableMaintenance": false }
```
`enableMaintenance`: **boolean** (مش نص). لو مفيش إعدادات محفوظة، رجّع الافتراضيات
مش `404`.

### 6.3 `POST /api/admin/settings` — حفظ إعدادات الموقع
**Auth:** ✅ Admin · **Body:** نفس الشكل اللي فوق · **200:** `{ "success": true }`

### 6.4 `POST /api/admin/change-password` — تغيير كلمة مرور الأدمن
**Auth:** ✅ Admin
```json
{ "currentPassword": "old-password", "newPassword": "new-password" }
```
**200:** `{ "success": true, "message": "تم تحديث كلمة المرور بنجاح!" }`
**400 / 401:** `{ "success": false, "message": "كلمة المرور الحالية غير صحيحة" }`
> `401` هنا **ما بيعملش logout** (مستثنى زي الـ login) — فينفع تستخدمه لـ
> "الباسورد الحالية غلط". لازم تتحقق من `currentPassword` قبل التغيير.

### 6.5 `GET /api/admin/stats` — إحصائيات لوحة التحكم
**Auth:** ✅ Admin
```json
{
  "totalVisitors": "4,520",
  "activeMembers": "128",
  "upcomingEvents": "3",
  "publishedPosts": "12",
  "recentActivities": [
    {
      "textAr": "تم نشر فعالية 'هاكاثون المناخ 2026'",
      "textEn": "New event 'Climate Hackathon 2026' published",
      "timeAr": "منذ ساعتين",
      "timeEn": "2 hours ago"
    }
  ]
}
```
> ⚠️ الأربع عدادات دي **strings** (مش numbers) عشان تسمح بالتنسيق زي `"1,240"`.
> `recentActivities` لازم تكون array (`[]` لو فاضية). الـ `time*` نص جاهز للعرض —
> الفرونت مش بيحسب "منذ ساعتين" بنفسه.

### 6.6 `GET /api/admin/analytics` — مؤشرات المنصة
**Auth:** ✅ Admin
```json
[
  { "labelAr": "زيارات هذا الشهر", "labelEn": "Visits This Month", "value": "1,240", "icon": "BarChart3" },
  { "labelAr": "مستخدمون جدد", "labelEn": "New Users", "value": "85", "icon": "Users" },
  { "labelAr": "معدل الاحتفاظ", "labelEn": "Retention Rate", "value": "87%", "icon": "TrendingUp" },
  { "labelAr": "تذاكر محجوزة", "labelEn": "Tickets Booked", "value": "320", "icon": "Ticket" }
]
```

> 🚨 **`icon` is a lucide icon NAME, not an emoji.** العقد القديم كان بيوري `"📊"`
> وده **غلط** — الإيموجي هيتجاهل. القيم المدعومة:
> `"BarChart3"` | `"Users"` | `"TrendingUp"` | `"Ticket"`.
> أي اسم تاني بيرجع لأيقونة افتراضية على أساس ترتيب العنصر.

- `value`: **string** (بيسمح بـ `"87%"` و `"1,240"`).
- الواجهة بترسم chart من البنود اللي `value` بتاعها رقم فعلاً بعد شيل `,` و `%`.

### 6.7 `GET /api/admin/messages` — رسائل اتصل بنا
**Auth:** ✅ Admin
```json
[
  {
    "id": "1",
    "sender": "منى المهيري",
    "email": "mona.m@example.com",
    "subject": "طلب شراكة جامعية",
    "message": "نود التعاون مع كلايمتيفاي...",
    "date": "2026-07-19",
    "isRead": false
  }
]
```
`id`: **string** (لو الـ DB بيستخدم integer، حوّله `str(self.id)`).
`isRead`: **boolean**. `date`: `YYYY-MM-DD`.

### 6.8 `PUT /api/admin/messages/<id>/read` — تعليم رسالة كمقروءة

> 🚨 المسار فيه **`/read` في الآخر**. العقد القديم كان بيقول
> `PUT /api/admin/messages/<id>` وده **غلط**.
> `PUT /api/admin/messages/<id>/read` — **note the `/read` suffix.**

**Auth:** ✅ Admin · **Body:**
```json
{ "isRead": true }
```
**200:** `{ "success": true }`
> ⚠️ **الـ PUT ده بياخد body** — متعملش الـ route من غير `request.get_json()`.
> الـ client دايماً بيبعت `isRead: true` حالياً، لكن اقبل `false` كمان (toggle).

### 6.9 `DELETE /api/admin/messages/<id>` — حذف رسالة
**Auth:** ✅ Admin · **بدون body** · **200:** `{ "success": true }`
> ⚠️ كل الـ `DELETE` في العقد ده **بتتبعت من غير body ومن غير `Content-Type`**.
> متعملش `request.get_json()` عليها (هترمي 400 في Flask).

---

## 🗂️ 7. Admin CMS CRUD — كل الكتابات تحت `/api/admin/*`

> ✅ **كل الـ 21 route دول تحت `/api/admin/`** — الكود اتعدّل عشان يطابق العقد هنا.
> ✅ **All 21 CMS write routes live under `/api/admin/*`.** Any older document
> showing `POST /api/events` (without `/admin`) is wrong.
> ⚠️ القراءة عامة (`GET /api/events`) والكتابة أدمن (`POST /api/admin/events`) —
> ده مقصود عشان تحمي الكتابات كلها بـ guard واحد على الـ blueprint (§2.1).

**النمط الموحّد لكل الكيانات السبعة:**

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/admin/{entity}` | كامل الكيان بدون `id` | **201** + الكيان كامل **مع `id`** |
| `PUT` | `/api/admin/{entity}/<id>` | حقول جزئية (partial OK) | **200** + الكيان كامل بعد التعديل |
| `DELETE` | `/api/admin/{entity}/<id>` | لا شيء | **200** `{ "success": true }` |

`{entity}` ∈ `events` · `posts` · `programs` · `initiatives` · `courses` ·
`opportunities` · `team`

**Normative rules:**
1. **`POST` و `PUT` لازم يرجّعوا الكيان الكامل** (مش `{success:true}` بس). الـ CMS
   بيحقن الرد في القائمة على طول من غير reload — رد ناقص = صف مكسور في الجدول.
2. **الـ `id` اللي بيرجع من `POST` هو الحقيقة.** الفرونت بيولّد `id` مؤقت في وضع
   الـ mock فقط.
3. `PUT` **partial** — طبّق الحقول الموجودة بس، ومتصفّرش اللي مش مبعوت.
4. الحقول المشتقّة اللي مش في فورم الأدمن لازم يحسبها السيرفر: مثلاً
   `Event.registeredCount` (يبدأ `0`).
5. `404` لو الـ `id` مش موجود · `403` لو مش أدمن · `400`/`422` لو الفاليديشن فشل.

### 7.1 Events — `/api/admin/events`
```json
{
  "titleEn": "...", "titleAr": "...",
  "descriptionEn": "...", "descriptionAr": "...",
  "date": "2026-09-12",
  "locationEn": "...", "locationAr": "...",
  "categoryEn": "...", "categoryAr": "..."
}
```
**201:** الكيان كامل + `"id"` + `"registeredCount": 0`.

### 7.2 Blog Posts — `/api/admin/posts`
```json
{
  "titleEn": "...", "titleAr": "...",
  "excerptEn": "...", "excerptAr": "...",
  "contentEn": "...", "contentAr": "...",
  "image": "https://...",
  "date": "2026-07-20",
  "authorEn": "Climatify Admin", "authorAr": "مسؤول كلايمتيفاي",
  "categoryEn": "...", "categoryAr": "..."
}
```
> المسار `/api/admin/posts` (**مش** `/api/admin/blog`). `image` **مطلوب** — §10.6.

### 7.3 Programs — `/api/admin/programs`
```json
{ "titleEn": "...", "titleAr": "...", "descriptionEn": "...", "descriptionAr": "...", "icon": "Monitor" }
```
`icon` ∈ `"Monitor"` | `"Search"` | `"Megaphone"` | `"Users"` | `"MessageSquare"`.
`longDescriptionEn` / `longDescriptionAr` اختياريين.

### 7.4 Initiatives — `/api/admin/initiatives`
كامل شكل §3.3. `progress` **number** إلزامي، `image` إلزامي،
و `status`/`participantsCount`/`startDate` اختياريين.

### 7.5 Courses — `/api/admin/courses`
كامل شكل §3.5. `lessonsCount` **number**، `image` إلزامي.

### 7.6 Opportunities — `/api/admin/opportunities`
كامل شكل §3.7. لازم `typeEn` **و** `typeAr` — الفلترة بتعتمد على `typeEn` بالحرف.

### 7.7 Team Members — `/api/admin/team`
كامل شكل §3.10. `image` إلزامي، و `borderColor`/`gradient` اختياريين.

---

## 🤖 8. AI Assistant

### 8.1 `POST /api/ai/chat` — المساعد الذكي للمناخ

**Auth:** ❌ No (بس الفرونت بيبعت التوكن لو موجود)

> 🚨 **مفتاح السؤال هو `prompt` — مش `message`.** العقد القديم كان بيقول
> `{ message, language }` وده **غلط**. The client sends:

```json
{ "prompt": "كيف أحسب بصمتي الكربونية؟", "language": "ar" }
```

`language` ∈ `"ar"` | `"en"` — لازم ترد بنفس اللغة.

**Response (200 OK):**
```json
{ "success": true, "reply": "البصمة الكربونية هي إجمالي الانبعاثات..." }
```

- `reply` **string مطلوب** — هو اللي يتعرض في نافذة الشات. مفيش streaming.
- ينفع تستخدم الـ envelope كمان: `{"success":true,"data":{"reply":"…"}}` (§0.3).
- خد بالك من **الـ 15 ثانية timeout** — لو المزوّد بطيء الطلب بيتلغي ويظهر خطأ
  اتصال. Keep the round trip well under 15 s.
- عقّم مخرجات الموديل: الواجهة بتعرض الرد كنص عادي (مش HTML).

---

## 📊 9. الملخّص الكامل — 54 method + path pair

> العدد الحقيقي المستخرَج من `src/services/api.ts`:
> **54 method+path pairs** across **45 distinct paths** — تسعة مسارات بيخدموا
> method-ين: `/api/user/profile` (GET+PUT)، `/api/admin/settings` (GET+POST)،
> والسبعة `/api/admin/{entity}/<id>` (PUT+DELETE).
> *(النسخة القديمة كانت بتقول "49 endpoint / تغطية 100%" وكانت ناقصة
> `/api/newsletter/subscribe` و `/api/ai/chat` و `/api/careers` و
> `/api/carbon-questions` و `GET /api/admin/settings`.)*

### 9.1 Public reads — 13
| Method | Endpoint | Auth | § |
|---|---|---|---|
| GET | `/api/programs` | ❌ | 3.1 |
| GET | `/api/programs/<id>` | ❌ | 3.2 |
| GET | `/api/initiatives` | ❌ | 3.3 |
| GET | `/api/events` | ❌ | 3.4 |
| GET | `/api/courses` | ❌ | 3.5 |
| GET | `/api/games` | ❌ | 3.6 |
| GET | `/api/opportunities` | ❌ | 3.7 |
| GET | `/api/posts` | ❌ | 3.8 |
| GET | `/api/posts/<id>` | ❌ | 3.9 |
| GET | `/api/team` | ❌ | 3.10 |
| GET | `/api/careers` | ❌ | 3.11 |
| GET | `/api/carbon-questions` | ❌ | 3.12 |
| GET | `/api/curricula/download` | ❌ | 3.13 |

### 9.2 Public forms — 7
| Method | Endpoint | Auth | § |
|---|---|---|---|
| POST | `/api/contact` | ❌ | 4.1 |
| POST | `/api/meetings` | ❌ | 4.2 |
| POST | `/api/partnerships` | ❌ | 4.3 |
| POST | `/api/workshops` | ❌ | 4.4 |
| POST | `/api/events/register` | ❌ | 4.5 |
| POST | `/api/opportunities/apply` | ❌ | 4.6 |
| POST | `/api/newsletter/subscribe` | ❌ | 4.7 |

### 9.3 Member — 3
| Method | Endpoint | Auth | § |
|---|---|---|---|
| GET | `/api/user/profile` | ⚠️ Bearer if present | 5.1 |
| PUT | `/api/user/profile` | ⚠️ Bearer if present | 5.2 |
| POST | `/api/user/carbon-footprint` | ⚠️ Bearer if present | 5.3 |

### 9.4 AI — 1
| Method | Endpoint | Auth | § |
|---|---|---|---|
| POST | `/api/ai/chat` | ❌ | 8.1 |

### 9.5 Admin auth, dashboard & settings — 9
| Method | Endpoint | Auth | § |
|---|---|---|---|
| POST | `/api/admin/login` | ❌ | 6.1 |
| POST | `/api/admin/change-password` | ✅ Admin | 6.4 |
| GET | `/api/admin/settings` | ✅ Admin | 6.2 🆕 |
| POST | `/api/admin/settings` | ✅ Admin | 6.3 |
| GET | `/api/admin/stats` | ✅ Admin | 6.5 |
| GET | `/api/admin/analytics` | ✅ Admin | 6.6 |
| GET | `/api/admin/messages` | ✅ Admin | 6.7 |
| PUT | `/api/admin/messages/<id>/read` | ✅ Admin | 6.8 |
| DELETE | `/api/admin/messages/<id>` | ✅ Admin | 6.9 |

### 9.6 Admin CMS CRUD — 21
| Method | Endpoint | Auth |
|---|---|---|
| POST / PUT / DELETE | `/api/admin/events` · `/api/admin/events/<id>` | ✅ Admin |
| POST / PUT / DELETE | `/api/admin/posts` · `/api/admin/posts/<id>` | ✅ Admin |
| POST / PUT / DELETE | `/api/admin/programs` · `/api/admin/programs/<id>` | ✅ Admin |
| POST / PUT / DELETE | `/api/admin/initiatives` · `/api/admin/initiatives/<id>` | ✅ Admin |
| POST / PUT / DELETE | `/api/admin/courses` · `/api/admin/courses/<id>` | ✅ Admin |
| POST / PUT / DELETE | `/api/admin/opportunities` · `/api/admin/opportunities/<id>` | ✅ Admin |
| POST / PUT / DELETE | `/api/admin/team` · `/api/admin/team/<id>` | ✅ Admin |

**13 + 7 + 3 + 1 + 9 + 21 = 54.**
✅ التغطية دي كافية لكل شاشة موجودة **ما عدا** الناقص في **§12**.

---

## ⚠️ 10. قواعد عامة (Cross-cutting rules)

### 10.1 Dates, times & timezone

- **كل التواريخ `YYYY-MM-DD`** — لا وقت، لا `T`، لا `Z`، لا offset.
  الحقول: `Event.date`, `BlogPost.date`, `Opportunity.postedDate`,
  `Initiative.startDate`, `ContactMessage.date`, `UserEvent.date`, `meetings.date`.
- **الأوقات `HH:MM`** بنظام 24 ساعة (`meetings.time`).
- في SQLAlchemy: `self.date.isoformat()` مع `db.Date` بيطلع `"2026-04-25"` ✅.
  متبعتش `datetime` object ولا `datetime.isoformat()` (هتطلع `"2026-04-25T00:00:00"`).

> 🕐 **Timezone — الفرونت بيفسّر `YYYY-MM-DD` كتاريخ محلي، مش UTC.**
> `new Date("2026-04-25")` كان بيتفسّر منتصف ليل UTC، فكانت الفعالية بتبان
> "منتهية" من الساعة 4 الفجر في الإمارات (UTC+4). الكود دلوقتي بيبني التاريخ
> محليًا (`new Date(y, m-1, d)`) وبيقارن بمنتصف ليل النهاردة محليًا.
>
> **Implication for you:** a `date` field is a **calendar day**, not an instant.
> Store it as `DATE`, not `TIMESTAMP`, and never shift it by a timezone offset.
> لو بعتّ `"2026-04-25T22:00:00Z"` الواجهة هتفسّرها بالتوقيت المحلي وممكن تعرض
> يوم مختلف.

### 10.2 Bilingual content

- كل حقل محتوى ليه نسختين: `titleEn`/`titleAr`, `descriptionEn`/`descriptionAr`…
- **الاتنين مطلوبين.** لو رجّعت `titleAr` فاضي، المستخدم العربي هيشوف مكان فاضي.
  Validate on the server that both language variants are non-empty before saving.
- استخدم **الأسماء بالحرف** — `titleEn` مش `title_en`. حوّل في الـ `to_dict()`.

### 10.3 String vs Number vs Boolean — جدول حاسم

| Field | Type | ملاحظة |
|---|---|---|
| `AdminStats.totalVisitors` / `activeMembers` / `upcomingEvents` / `publishedPosts` | **string** | بتسمح بالتنسيق `"4,520"` |
| `AnalyticItem.value` | **string** | بتسمح بـ `"87%"` |
| `AnalyticItem.icon` | **string** | اسم أيقونة lucide — **مش إيموجي** |
| `Initiative.progress` | **number** | 0–100 |
| `Initiative.participantsCount` | **number** | اختياري |
| `Event.registeredCount` | **number** | يبدأ 0 |
| `Course.lessonsCount` | **number** | |
| `UserStats.ecoPoints` / `virtualTrees` / `earnedBadges` | **number** | |
| `UserCourse.progress` | **number** | 0–100 |
| `CarbonQuestionOption.value` | **number** | عشري |
| `ContactMessage.isRead` | **boolean** | مش `"true"` |
| `settings.enableMaintenance` | **boolean** | مش `"false"` |
| `ContactMessage.id` وكل الـ `id` | **string** | `str(self.id)` لو الـ DB integer |
| `workshops.studentCount` | **string** | جاي من input — الفرونت بيبعته نص |
| `CareerNode.skillsEn` / `skillsAr` | **array of strings** | |

### 10.4 Required vs Optional

**Optional (ينفع تتجاهلها):**
`Program.longDescriptionEn`, `Program.longDescriptionAr`,
`Initiative.status`, `Initiative.participantsCount`, `Initiative.startDate`,
`TeamMember.borderColor`, `TeamMember.gradient`.

**كل باقي الحقول في `Program`, `Event`, `Course`, `Game`, `Opportunity`,
`BlogPost`, `TeamMember`, `Initiative`, `CareerNode`, `CarbonQuestion` مطلوبة.**

> الفرونت بيتحمّل الحقول الناقصة من غير كراش (فيه guards)، بس بيعرض مكان فاضي.
> Missing required fields render as blanks, not errors — so validate on save.
> Arrays: رجّع `[]` مش `null`.

### 10.5 Error format & status codes

الشكل المقترح للأخطاء:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "messageAr": "رسالة الخطأ بالعربي"
}
```

الـ client بيقرا **أول مفتاح موجود** من: `message` → `error` → `detail`
ويعرضه للمستخدم في حالات `400`/`422`. (`messageAr` مش مقروء حالياً — لو الرسالة
للمستخدم، حطّها بالعربي مباشرةً في `message`.)

| Status | استخدمه لـ | تأثيره على الواجهة |
|---|---|---|
| `200` | نجاح قراءة/تحديث | البيانات تُعرض |
| `201` | نجاح إنشاء | نفس معاملة 200 |
| `400` / `422` | فاليديشن | **رسالتك بتُعرض للمستخدم** |
| `401` | جلسة منتهية / بيانات دخول غلط | **logout فوري** (ماعدا login و change-password) — §2.3 |
| `403` | مصادَق عليه بس ممنوع | "لا تملك صلاحية" |
| `404` | مورد مش موجود | "العنصر المطلوب غير موجود" |
| `409` | تعارض (تسجيل مكرر مثلاً) | رسالة سيرفر عامة — حطّ سبب واضح |
| `500` | خطأ سيرفر | "حدث خطأ في الخادم" |

> ⚠️ **`200` + `{"success": false}` = نجاح عند العميل.** الفشل لازم status code.
> ⚠️ **الأخطاء لازم ترجع JSON.** صفحة HTML للخطأ بتخلي الرسالة غير مفهومة
> (الـ client بيحاول `JSON.parse` وبيرجع النص الخام).

### 10.6 🖼️ Image upload — endpoint مطلوب وغير موجود

**4 كيانات فيها حقل `image` مطلوب: `Initiative`, `Course`, `BlogPost`,
`TeamMember`** — ومفيش أي endpoint لرفع الصور في المنصة كلها. فورمات الأدمن
بتاخد **رابط نصي** بس، يعني الأدمن لازم يرفع الصورة في مكان تاني بنفسه.

**Required (not yet implemented anywhere):**

```
POST /api/upload
Auth: ✅ Admin
Content-Type: multipart/form-data
Body: file=<binary>            # field name: "file"

200 OK → { "url": "https://cdn.../uploads/abc123.webp" }
```

- يرجّع **`{ url }`** بنفس شكل §3.13 عشان يتحط مباشرة في حقل `image`.
- تحقق من نوع الملف (`image/png|jpeg|webp`) وحدّد حجم أقصى (مثلاً 5 MB).
- الرابط لازم يكون `https://` أو مسار نسبي — المخططات `javascript:`/`data:`/
  `vbscript:`/`file:` بيرفضها الـ client.
- 🔗 لحد ما يتعمل، سيب حقل `image` يقبل أي رابط `https` صالح.

### 10.7 Pagination, filtering & sorting

**الحالة اليوم:** الفرونت **مش بيبعت أي query params**، وبيعمل كل الفلترة
والترتيب والبحث **في المتصفح** على القائمة الكاملة.

**Therefore, for every list endpoint: a request with NO query parameters MUST
return the complete set.** متعملش pagination افتراضية بترجّع أول 20 عنصر بس —
الواجهة هتعرض 20 وتسكت.

لو ضفت pagination بعد كده، اتفق على الشكل ده (الـ client بيتحمّله بالفعل عن طريق
`unwrap()` — §0.3):

```
GET /api/events?page=1&perPage=20&search=climate&category=Education&sort=date&order=desc
```
```json
{ "success": true, "data": [ ... ], "total": 100, "page": 1, "perPage": 20 }
```

| Param | معنى |
|---|---|
| `page` | 1-based · default 1 |
| `perPage` | حجم الصفحة · default = الكل |
| `search` | بحث نصي في الحقول بلغتين |
| `category` / `type` / `status` | فلترة بالقيم الإنجليزية بالحرف |
| `sort` | اسم الحقل (`date`, `postedDate`, `progress`…) |
| `order` | `asc` \| `desc` |

الترتيب المفضّل من غير params: **الأحدث أولاً** (`date` / `postedDate` تنازلي)
للمقالات والفرص، و**الأقرب أولاً** للفعاليات القادمة.

---

## 🌍 11. SPA history fallback — لازم، وإلا كل رابط عميق بيرجع 404

الواجهة **SPA** بتستخدم `BrowserRouter` (History API، بدون `#`). السيرفر اللي
بيخدم الـ build **لازم** يرجّع `index.html` لأي مسار مش ملف موجود ومش `/api/*`.

**Routes that must fall back to `index.html`:**
`/` `/about` `/programs` `/events` `/learning-hub` `/media` `/blog/:id`
`/contact` `/games` `/opportunities` `/portals` `/dashboard` `/admin/*`

بدون ده: الصفحة الرئيسية تشتغل، بس أول ما المستخدم يعمل refresh على `/events`
أو يفتح لينك `/blog/some-id` مباشرة → **404 من السيرفر**.

### 11.1 Flask serving the built frontend

```python
import os
from flask import Flask, send_from_directory

DIST = os.path.join(os.path.dirname(__file__), "..", "climatify", "dist")
app = Flask(__name__, static_folder=DIST, static_url_path="")

# ⚠️ لازم يكون آخر route يتسجّل — عشان ما يلتهمش /api/*
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404       # خلي الـ API يرد بـ JSON
    full = os.path.join(app.static_folder, path)
    if path and os.path.isfile(full):
        return send_from_directory(app.static_folder, path)   # assets حقيقية
    return send_from_directory(app.static_folder, "index.html")  # أي حاجة تانية → SPA
```

### 11.2 🚨 الـ catch-all 404 handler في الدليل بيكسر ده

الـ handler اللي في `BACKEND_DEVELOPER_GUIDE.md` §8.4:

```python
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404
```

ده **بيرد JSON 404 على `/events`** بدل `index.html`، فبيكسر كل الروابط العميقة.
**Scope it to the API only:**

```python
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Resource not found"}), 404
    return send_from_directory(app.static_folder, "index.html")   # SPA fallback
```

### 11.3 لو بتستخدم سيرفر ويب تاني

```nginx
# Nginx
location / { try_files $uri $uri/ /index.html; }
location /api/ { proxy_pass http://127.0.0.1:5000; }
```
```apache
# Apache .htaccess
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_URI} !^/api/
RewriteRule . /index.html [L]
```
Netlify: `/* /index.html 200` · Vercel: rewrite `/(.*)` → `/index.html`.

---

## 🧩 12. Endpoints الواجهة محتاجاها ولسه غير موجودة

الحاجات دي **مش في `api.ts`** لكن الواجهة محتاجاها عشان تكمّل. حالياً الشاشات
دي بتشتغل بحالة محلية بس، والـ progress بيضيع لو المستخدم مسح بيانات المتصفح.

### 12.1 Member progress (لوحة الأعضاء) — الأهم

| المطلوب | Body | لماذا |
|---|---|---|
| `POST /api/user/events` | `{ eventId }` | إضافة فعالية لقائمة العضو. حالياً `POST /api/events/register` بيسجّل الحضور بس، والقائمة بتتحدث محلياً. |
| `DELETE /api/user/events/<id>` | — | **إلغاء التسجيل. مفيش أي endpoint له**، فالإلغاء محلي بس والسيرفر لسه شايف العضو مسجّل. `useAuthStore.cancelEventRegistration` معلّم بـ `TODO(backend)`. |
| `POST /api/user/courses/<id>/progress` | `{ progress: 0..100 }` | حفظ التقدّم في المساق. حالياً محلي بالكامل. |
| `POST /api/user/trees` | `{ count }` أو `{}` | عدّاد الأشجار الافتراضية في لعبة الغاف — محلي بالكامل. |

كلهم المفروض يرجّعوا `{ success, message }` والقيم المحدَّثة تظهر في
`GET /api/user/profile`.

### 12.2 Member authentication (§2.4)
`POST /api/user/login` (+ ممكن `POST /api/user/register`) يرجّع JWT بنفس قواعد
§2.2 مع `role: "member"`. الواجهة هتحتاج شاشة تسجيل دخول للعضو وتخزين
`user_token` — **دلوقتي مفيش، و `/dashboard` صفحة عامة.**

### 12.3 Content the CMS/UI shows but cannot fetch
| المطلوب | مين محتاجه |
|---|---|
| `GET /api/courses/<id>/lessons` | `LearningHub` — قائمة الدروس معمولة placeholder |
| `GET /api/admin/analytics/traffic` | `AdminDashboardHome` — الشارت الشهري بيانات عيّنة معلّمة كده صريحة |
| توزيع أسبوعي للزيارات | صفحة التحليلات — نفس الحكاية |
| `POST /api/upload` | 4 كيانات فيها `image` مطلوب — §10.6 |
| كود تذكرة حقيقي للفعالية | `Events` — التذكرة حالياً بصرية بس |

> 🔎 كل الحاجات دي معلّمة في الكود بـ `TODO(backend)` — دوّر على النص ده لو عايز
> تشوف مكان الاستخدام بالظبط.

---

## 🧪 13. Testing the Integration

### 13.1 Frontend (local)

```bash
cd d:\lab\climatify\ui\climatify
npm install

# انسخ القالب وعدّله بمحرر نصوص — متكتبش فوق الملف
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
```

بعدها **افتح `.env` وتأكد إن القيم كده:**

```
VITE_API_BASE_URL=http://127.0.0.1:5000/api
VITE_USE_MOCK_API=false
```

> 🚨 **متستخدمش `echo "VITE_API_BASE_URL=..." > .env`.** الـ `>` بيمسح الملف
> وبيوّدي `VITE_USE_MOCK_API` و `VITE_APP_TITLE`. ولو كتبت العنوان من غير `/api`
> كل request هيرجع **404**.
> **Edit `.env` in a text editor. Do not overwrite it, and keep the `/api` suffix.**

```bash
npm run dev
# Open http://localhost:5173
```

بديل من غير CORS: حطّ `VITE_API_BASE_URL=/api` واستخدم بروكسي الـ dev (§1.2).

### 13.2 Backend
```bash
cd /path/to/backend
flask run          # http://127.0.0.1:5000
```

### 13.3 Login (المسار الصح)
```bash
curl -X POST http://127.0.0.1:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@climatify.org","password":"admin123"}'

# Expected: { "success": true, "token": "<three-part JWT with a numeric exp>" }
# ⚠️ /api/admin/login  — NOT /api/auth/login
# ⚠️ token must be TOP-LEVEL, not nested under "data"
```

### 13.4 Protected route
```bash
TOKEN="paste-the-jwt-here"
curl http://127.0.0.1:5000/api/admin/messages -H "Authorization: Bearer $TOKEN"

# ولازم تتأكد إن ده بيرجع 401:
curl -i http://127.0.0.1:5000/api/admin/messages
```

### 13.5 Mark-as-read (لاحظ `/read` والـ body)
```bash
curl -X PUT http://127.0.0.1:5000/api/admin/messages/1/read \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"isRead": true}'
```

### 13.6 CORS preflight (الـ Authorization header)
```bash
curl -i -X OPTIONS http://127.0.0.1:5000/api/programs \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"

# لازم ترجع:
#   Access-Control-Allow-Origin: http://localhost:5173
#   Access-Control-Allow-Headers: ... Authorization ...
```

### 13.7 SPA fallback (بعد الـ build)
```bash
npm run build
# وبعد ما تخدم dist/ من Flask:
curl -i http://127.0.0.1:5000/events        # لازم HTML (200) — مش JSON 404
curl -i http://127.0.0.1:5000/api/nope      # لازم JSON 404
```

### 13.8 ✅ Definition of done للتكامل
- [ ] `POST /api/admin/login` بيرجّع JWT بتلات أجزاء وفيه `exp` رقمي، top-level.
- [ ] كل `/api/admin/*` بترجع `401` من غير توكن و `403` لتوكن مش أدمن.
- [ ] `GET /api/admin/settings` موجود (§6.2) ومش بيرجع 404.
- [ ] `PUT /api/admin/messages/<id>/read` (بالـ `/read`) بيقرا الـ body.
- [ ] كل `POST`/`PUT` في §7 بيرجّع الكيان الكامل مع `id`.
- [ ] `GET /api/curricula/download` بيرجّع `{ url }` JSON.
- [ ] `/api/ai/chat` بيقرا `prompt` (مش `message`).
- [ ] كل التواريخ `YYYY-MM-DD` من غير أي جزء وقت.
- [ ] كل الأخطاء JSON، والفشل status غير 2xx (مش `success:false` مع 200).
- [ ] لسته فاضية بترجع `[]` مش `null` ومش 404.
- [ ] الروابط العميقة بترجّع `index.html` (§11).
- [ ] `VITE_USE_MOCK_API=false` والواجهة كلها بتعرض بيانات حقيقية من غير أي
      error banner.

---

## 📝 14. ملاحظات ختامية

1. **`src/services/api.ts` هو الحقيقة النهائية** — أي فرق بينه وبين المستند ده باج
   في المستند.
2. كل الـ responses **JSON**، حتى الأخطاء.
3. الـ `Authorization` header بيتبعت في **كل** request لو فيه توكن → CORS لازم
   يسمح بيه والـ `OPTIONS` لازم يشتغل (§1.1).
4. **مفيش mock fallback** — أي فشل بيبان للمستخدم (§0).
5. كل التواريخ `YYYY-MM-DD` وبتُفسّر كأيام تقويمية **محلية** (§10.1).
6. المحتوى **bilingual** والاتنين مطلوبين (§10.2).
7. حقول `icon` كلها **أسماء أيقونات lucide كنصوص** — مش إيموجي، مش SVG.
8. التوكن بيتخزّن في `localStorage.admin_token` — **والحماية الحقيقية مسؤولية
   Flask** (§2.1).
9. الناقص في **§12** — لو محتاج تحدد أولوية، `DELETE /api/user/events/<id>` و
   `POST /api/upload` هما الأكثر إلحاحاً.

**بالنجاح يا صاحبي! 🚀**

---

> **Last Updated:** 2026-07-26
> **Contract Version:** 2.0 — verified line-by-line against `src/services/api.ts`
> **Status:** ✅ Ready for Implementation
