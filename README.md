# Mohamed Khedr 
# Frontend Developer

# 🌱 Climatify — Frontend (React + TypeScript + Vite)

منصة **كلايمتيفاي** للعمل المناخي والرقمنة البيئية: برامج، مبادرات، فعاليات، مساقات
تعليمية، فرص عمل وتطوع، ألعاب مناخية، بوابات للمدارس والشركاء، لوحة تحكم للأعضاء،
ولوحة تحكم كاملة (CMS) للأدمن.

**Climatify** is a bilingual climate-action platform. The UI is **Arabic-first
(RTL by default)** with a full English (LTR) mode; every piece of content carries
both an `...Ar` and an `...En` field.

هذا المستودع هو **الواجهة فقط (frontend only)**. الـ backend سيرفر Flask منفصل —
عقده الرسمي في [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

---

## 🧱 Stack

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) |
| Bundler | Vite 8 |
| Routing | react-router-dom 7 (`BrowserRouter`) |
| State | zustand (`useAuthStore`, `useCMSStore`) |
| Styling | **Plain CSS** + design tokens in `src/styles/variables.css` (no Tailwind, no CSS-in-JS) |
| Icons | lucide-react |
| Motion | framer-motion, gsap, lenis, ogl |
| i18n / theme | React context (`LanguageContext`, `ThemeContext`) |
| Lint | oxlint |
| Tests | **none yet** — there is no test framework in this repo |

---

## ✅ Prerequisites

- **Node.js ≥ 20.19** (مطلوب في `package.json` → `engines`)
- **npm** (يجي مع Node)
- سيرفر **Flask** شغال على `http://127.0.0.1:5000` — *أو* شغّل وضع الـ mock
  (`VITE_USE_MOCK_API=true`) لو الباك إند لسه مش جاهز.

---

## 🚀 Install & Run

```bash
npm install

# انسخ ملف البيئة وعدّله بمحرر نصوص
cp .env.example .env          # PowerShell: Copy-Item .env.example .env

npm run dev                   # http://localhost:5173  (port ثابت — strictPort)
```

| Script | ماذا يفعل |
|---|---|
| `npm run dev` | Vite dev server على `5173` مع بروكسي `/api` لـ Flask |
| `npm run build` | `tsc -b && vite build` → مخرجات في `dist/` |
| `npm run preview` | يخدم مخرجات الـ build محلياً |
| `npm run typecheck` | `tsc -b --force` (TypeScript strict) |
| `npm run lint` | `oxlint` |
| `npm run check` | typecheck + lint معاً — شغّله قبل أي commit |

---

## 🔑 Environment Variables

كل المتغيرات موثّقة في [`.env.example`](.env.example). ملخّص:

| Variable | Default | ماذا يعني |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:5000/api` | **لازم يحتوي على `/api`.** غير كده كل request هيرجع 404. حطّه `/api` لو هتستعمل بروكسي الـ dev. |
| `VITE_USE_MOCK_API` | `false` | `true` = بيانات وهمية محلية من غير أي شبكة. أي قيمة تانية = الاتصال الحقيقي. |
| `VITE_APP_TITLE` | `Climatify - ...` | محفوظ للمستقبل — كود التطبيق لسه مش بيقراه. |

> ⚠️ **عدّل `.env` بمحرر نصوص.** متكتبش `echo "VITE_API_BASE_URL=..." > .env` —
> علامة `>` بتمسح الملف وبتوّدي `VITE_USE_MOCK_API` و `VITE_APP_TITLE`.
> Use `>>` to append, or just edit the file in an editor.

> 🔒 **`.env` أصبح في `.gitignore`.** الملف كان متتبّع في git قبل كده وده اتوقف من
> الآن. النسخة الموجودة على جهازك **لم تُحذف** — لكن لو كانت مرفوعة على الريبو،
> شيلها من التتبع مرة واحدة بالأمر ده (وهو بيسيب الملف على الديسك):
> ```bash
> git rm --cached .env
> ```
> `.env.example` هو النسخة المتتبّعة الوحيدة، ولازم تفضل من غير أي سر.

### Mock mode vs real API — مهم جداً

الـ API layer **لا يعود إلى البيانات الوهمية عند الفشل** (كان بيعمل كده قبل كده).
دلوقتي أي فشل بيظهر كرسالة خطأ في الواجهة مع زر "إعادة المحاولة".

`src/services/api.ts` throws an `ApiError` on any non-2xx response, network
failure, or 15 s timeout. Mock data is served **only** when
`VITE_USE_MOCK_API=true`. That means: if the UI shows data, the backend really
returned it — the UI is a trustworthy integration test surface.

---

## 📁 Project Structure

```
climatify/
├── public/                     # أصول ثابتة تُخدم كما هي
├── index.html                  # نقطة الدخول (HTML shell)
├── vite.config.ts              # alias @→src، بروكسي /api، فصل vendor chunks
├── .env.example                # قالب متغيرات البيئة (متتبّع في git)
├── docs/                       # 📚 وثائق الـ backend — ابدأ من هنا
└── src/
    ├── main.tsx                # ReactDOM root
    ├── App.tsx                 # Routes + ErrorBoundary + Suspense
    ├── types/index.ts          # ⭐ كل شكل بيانات بيتبادل مع السيرفر
    ├── services/
    │   ├── api.ts              # ⭐ الطبقة الوحيدة اللي بتكلّم الشبكة + ApiError
    │   └── mockData.ts         # بيانات وضع الـ mock فقط
    ├── store/
    │   ├── useAuthStore.ts     # جلسة الأدمن + تقدّم العضو
    │   └── useCMSStore.ts      # قراءات وكتابات لوحة التحكم
    ├── context/                # LanguageContext (ar/en + dir) و ThemeContext
    ├── components/
    │   ├── layout/             # Header, Footer, Layout, bottom nav
    │   ├── common/             # ErrorBoundary, RouteLoader
    │   ├── ui/                 # EmptyState وعناصر واجهة مشتركة
    │   └── Aurora, BorderGlow, ChromaGrid, ProgramCards   # عناصر بصرية
    ├── pages/
    │   ├── Home, About, Programs, Events, LearningHub, Media,
    │   ├── Contact, GamesHub, Opportunities, Portals, NotFound,
    │   ├── Dashboard/          # لوحة العضو (route عام حالياً)
    │   └── Admin/              # الـ CMS بالكامل (/admin/*)
    └── styles/
        ├── variables.css       # 🎨 design tokens — استخدمها ولا تكتب hex جديد
        └── global.css          # reset، utilities (.sr-only، @keyframes spin)
```

### Routes

`/` · `/about` · `/programs` · `/events` · `/learning-hub` · `/media` ·
`/blog/:id` · `/contact` · `/games` · `/opportunities` · `/portals` ·
`/dashboard` · `/admin/*` · `*` → NotFound

> الراوتنج `BrowserRouter` (بدون hash). أي سيرفر بيخدم الـ `dist/` **لازم**
> يرجّع `index.html` لأي مسار غير موجود، وإلا كل رابط عميق هيرجع 404.
> See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) → *SPA history fallback*.

---

## 📚 Documentation

| File | المحتوى |
|---|---|
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | **العقد الرسمي.** كل endpoint، كل payload، كل status code. مرجع واحد لا غير. |
| [`docs/BACKEND_DEVELOPER_GUIDE.md`](docs/BACKEND_DEVELOPER_GUIDE.md) | دليل عملي لبناء سيرفر Flask من الصفر + الأخطاء الشائعة. |
| [`docs/BACKEND_HANDOFF_SUMMARY.md`](docs/BACKEND_HANDOFF_SUMMARY.md) | ملخّص التسليم وجدول سريع بكل المسارات. |
| [`docs/FRONTEND_AUDIT_REPORT.md`](docs/FRONTEND_AUDIT_REPORT.md) | تقرير تدقيق الواجهة (مخرجات مراجعة — مرجع تاريخي). |

---

## 👋 For the backend developer — start here

1. اقرأ **[`docs/BACKEND_DEVELOPER_GUIDE.md`](docs/BACKEND_DEVELOPER_GUIDE.md) §1**
   → سيرفر Flask شغّال في أقل من 30 دقيقة.
2. بعدها **[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)** هو المرجع الملزم لكل
   مسار وشكل بيانات. ولو فيه تضارب بين أي مستند والكود → **`src/services/api.ts`
   هو الحقيقة**، وأي فرق بينه وبين العقد يعتبر باج في العقد.
3. تلات حقائق لازم تعرفها قبل أول سطر كود:
   - **الـ login هو `POST /api/admin/login`** (مش `/api/auth/login`).
   - **بوابة الأدمن في الفرونت `localStorage` فقط** ويمكن تجاوزها من devtools.
     Flask **MUST** enforce `@jwt_required()` **and** `role == "admin"` on every
     `/api/admin/*` route. The frontend guard is UX, not security.
   - **مفيش fallback للـ mock.** أي 500 أو انقطاع اتصال هيبان كرسالة خطأ في
     الواجهة — وده مقصود عشان تشوف الأخطاء بدل ما تتخبّى.
4. الـ endpoints اللي الواجهة محتاجاها ولسه **غير موجودة** (upload، تسجيل
   الأعضاء، تقدّم المساقات...) مجمّعة في **§12** من العقد.

---

## 🤝 Contributing notes

- **Arabic is the default direction.** استخدم الخصائص المنطقية في CSS
  (`margin-inline-start`, `inset-inline-start`, `text-align: start`) بدل
  `left`/`right`، وإلا لازم تضيف override لـ `[dir="rtl"]`.
- خُد الألوان والمسافات من `src/styles/variables.css` — **ممنوع hex جديد**.
- z-index scale: محتوى الصفحة 1–10، chrome ثابت 40–100، **modals ‏100000+**،
  toasts 100100 (الهيدر والـ bottom nav على 99990).
- متكتبش `outline: none` من غير بديل في `:focus-visible`.
- غلّف الحركة غير الضرورية بـ `@media (prefers-reduced-motion: reduce)`.
- شغّل `npm run check` قبل أي commit.
