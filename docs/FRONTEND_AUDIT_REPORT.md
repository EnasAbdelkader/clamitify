# 🔬 تقرير المراجعة الشاملة للفرونت إند — Climatify

> مراجعة ملف‑بملف لكامل المشروع (74 ملف / ~15,000 سطر) قبل تسليمه لمطوّر الباك إند (Flask + PostgreSQL).
> **تاريخ المراجعة:** 2026‑07‑26

---

## ⚡ الخلاصة التنفيذية

المشروع **مبني بذوق عالٍ ومعمارية سليمة**: تقسيم صحيح للراوتس مع `lazy` + `Suspense`، فصل كامل للـ Admin في bundle مستقل، طبقة types مركزية، zustand منظّم، وتنظيف صحيح لـ WebGL في `Aurora`. الـ build ينجح، و`tsc -b` يخرج بـ 0، و`oxlint` نظيف.

**لكن** — ودي النقطة اللي تهمّك — الـ build النظيف هنا **مش دليل على الجودة**، لأن `tsconfig.app.json` **مفيهوش `"strict": true`**. يعني `strictNullChecks` مطفي، و`any` بيمرّ بدون اعتراض. الكومبايلر بيوافق على كود هيقع في الرَن‑تايم.

راجعت المشروع على 13 محور متوازي، والحصيلة **379 ملاحظة موثّقة** (بعد إزالة التكرار):

| الخطورة | العدد | المعنى |
|---|---|---|
| 🔴 حرِج | **50** | يكسر المنتج أو يضلّل مطوّر الباك إند بشكل مباشر |
| 🟠 عالي | **128** | باگ ظاهر للمستخدم أو فجوة تكامل حقيقية |
| 🟡 متوسط | **161** | عيب جودة/وصولية/اتساق يرفضه أي senior reviewer في PR |
| ⚪ منخفض | **40** | تلميع |

### الحكم النهائي

**المشروع لسه مش جاهز للتسليم.** مش لأن فيه شغل ناقص بس — لكن لأن فيه **ثلاث آليات مستقلة بتتعاون على إخفاء الأعطال**، فمطوّر الباك إند مش هيقدر يعرف إن السيرفر بتاعه شغّال صح ولا لأ:

1. **`api.ts` بيبلع كل خطأ ويرجّع mock كأنه نجاح** — أي 401/404/422/500 من Flask بيتحوّل لبيانات وهمية + `{success: true}`.
2. **التوثيق بيأمر مطوّر الباك إند يكتب `VITE_API_BASE_URL` غلط** — من غير `/api` — فكل الريكوستات تعمل 404.
3. **الـ `API_CONTRACT.md` — اللي بيسمّي نفسه «المرجع الوحيد» — بيخالف الكود الفعلي في 26 endpoint من 53.**

النتيجة المركّبة: مطوّر الباك إند هيقعد يوم كامل يبني endpoints على مسارات غلط، الفرونت مش هيناديها أصلاً، وهيفتح الموقع يلاقيه **شغّال 100% وبيعرض بيانات** — لأنها mock. مش هيكتشف الكارثة غير بعد أسبوع.

---

## 🔴 القسم الأول: العشرة الأخطر (لازم تتصلّح قبل ما الباك إند يبدأ)

### 1. سقوط الـ Login على mock بيقبل **أي** كريدنشيالز — ثغرة أمنية في build الإنتاج

`src/services/api.ts:332‑355`

```ts
loginAdmin: async (email, password) => {
  if (!USE_MOCK_API) {
    try {
      const res = await authFetch("/admin/login", {...});
      const json = await res.json();          // ← يرمي لو الرد مش JSON
      ...
    } catch (err) {
      console.warn("Backend loginAdmin failed, using mock response", err);
    }                                          // ← بيكمل للـ mock
  }
  // MOCK: أي إيميل فيه @ وباسورد 4 حروف = دخول ناجح + توكن
  if (email.includes("@") && password.length >= 4) {
    resolve({ success: true, token: "mock-jwt-token-xyz" });
  }
```

**سيناريو الفشل:** سيرفر Flask واقع، أو CORS غلط، أو رجّع صفحة HTML 500 (فـ `res.json()` يرمي). في كل الحالات دي الكود بينزل على الـ mock، وأي حد يكتب `a@b.c` / `1234` **يدخل لوحة التحكم كاملة** — في build الإنتاج، مش الديف بس.

> ⚠️ ودي بالضبط الظروف اللي هتحصل يوميًا وقت تطوير الباك إند.

**الإصلاح:** امنع الـ mock نهائيًا لما `USE_MOCK_API === false`. خلّي الفشل يرجّع `{success: false, error}` ويتعرض للمستخدم.

---

### 2. حماية لوحة الأدمن = مجرد وجود مفتاح في localStorage

`src/store/useAuthStore.ts:49‑52` + `src/pages/Admin/AdminLayout.tsx:71`

```ts
initializeAuth: () => {
  const token = localStorage.getItem("admin_token");
  if (token) set({ isAuthenticated: true, token });   // بس كده
}
// AdminLayout:
if (!isAuthenticated) return <AdminLogin onLogin={handleLogin} />;
```

**الاختراق في 3 خطوات:** افتح DevTools → `localStorage.setItem('admin_token','x')` → اعمل reload. **لوحة التحكم كاملة مفتوحة**، وكل زرار CRUD شغّال.

مفيش تحقق من التوقيع، ولا من `exp`، ولا سؤال للسيرفر.

**الإصلاح:** الـ gating في الفرونت للـ UX بس. **مطوّر الباك إند لازم يفرض `@jwt_required` + فحص `role == "admin"` على كل endpoint إداري** — وده مش مذكور في أي وثيقة حاليًا. + فكّ الـ JWT في الفرونت وتحقق من `exp` قبل ما تعتبره صالح.

---

### 3. التوثيق بيأمر مطوّر الباك إند يكسر الاتصال بنفسه

`docs/BACKEND_DEVELOPER_GUIDE.md:99` و `docs/API_CONTRACT.md:950`

```bash
echo "VITE_API_BASE_URL=http://127.0.0.1:5000" > .env
```

فيها **غلطتين قاتلتين**:

1. **ناقصة `/api`.** الكود بيعمل `fetch(\`${API_BASE_URL}${endpoint}\`)` و`endpoint` = `/programs`. فالنتيجة `http://127.0.0.1:5000/programs` مش `/api/programs` → **كل ريكوست بيعمل 404**.
2. **`>` بيمسح الملف كله** — يعني `VITE_USE_MOCK_API` و`VITE_APP_TITLE` بيتشالوا.

والـ `.env` و`.env.example` الحقيقيين **صح** (`.../api`). يعني التوثيق بيناقض الإعداد السليم الموجود فعلاً.

ولما الـ 404 يحصل، **البند رقم 4 تحت بيخفيه تمامًا** والموقع يفضل شغّال بالـ mock.

**الإصلاح:** صحّح السطرين لـ `VITE_API_BASE_URL=http://127.0.0.1:5000/api` واستخدم `>>` أو عدّل يدوي.

---

### 4. `api.ts` بيحوّل كل خطأ سيرفر لنجاح — أخطر عيب في المشروع كله

`src/services/api.ts` — النمط ده مكرر في **43 ميثود**:

```ts
getPrograms: async () => {
  if (!USE_MOCK_API) {
    try {
      const res = await authFetch("/programs");
      if (res.ok) return await res.json();     // ← لو مش ok... بيقع تحت
    } catch (err) { console.warn(...) }
  }
  return new Promise(r => setTimeout(() => r(mockPrograms), 200));  // ← mock كأنه نجاح
}
```

وفي عمليات الكتابة أسوأ:

```ts
submitContact: async (data) => {
  ...
  return { success: true, message: "تم إرسال رسالتك بنجاح!" };   // حتى لو السيرفر رفض
}
```

**جدول ما يحصل فعليًا:**

| رد Flask | اللي بيوصل للـ UI | اللي المستخدم يشوفه |
|---|---|---|
| `200 OK` | البيانات الحقيقية | ✅ صح |
| `401 Unauthorized` | بيانات mock | ✅ «نجاح» ❌ |
| `404 Not Found` | بيانات mock | ✅ «نجاح» ❌ |
| `422 Validation Error` | `{success:true}` | ✅ «تم الإرسال بنجاح!» ❌ |
| `500 Server Error` | `{success:true}` | ✅ «تم الإرسال بنجاح!» ❌ |
| السيرفر مقفول | بيانات mock | ✅ الموقع شغّال ❌ |

**النتيجة العملية:** مطوّر الباك إند **مالوش أي إشارة صادقة في المشروع كله**. مينفعش يستخدم الـ UI كأداة اختبار. تغيير كلمة سر الأدمن اللي السيرفر رفضها (`400 كلمة المرور الحالية غلط`) بتتعرض له **«تم تحديث كلمة المرور بنجاح!»** (`api.ts:475‑485`).

**الإصلاح:** الـ mock يشتغل **فقط** لما `USE_MOCK_API === true`. لما تكون `false`، ارمِ `ApiError{status, body}` وخلي كل صفحة تعرض حالة خطأ حقيقية.

---

### 5. عقد الـ API بيناقض الكود في 26 endpoint من 53

`docs/API_CONTRACT.md` بيقول عن نفسه: *«هذا المستند هو المرجع الرسمي الوحيد (Source of Truth)»* — والحقيقة إنه **الوثيقة الأقل دقة** من التلاتة.

#### جدول الفروق المؤكَّد (استخرجته من الكود مباشرة):

| ما يناديه الكود فعلًا | ما يوثّقه API_CONTRACT | ما يقوله HANDOFF_SUMMARY | الحكم |
|---|---|---|---|
| `POST /api/admin/login` | `POST /api/auth/login` | `POST /api/admin/login` | ❌ العقد غلط |
| `POST /api/workshops` | `POST /api/education-workshops` | `POST /api/workshops` | ❌ العقد غلط |
| `POST /api/carbon-footprint` | `POST /api/user/carbon-footprint` | `POST /api/carbon-footprint` | ❌ العقد غلط |
| `GET /api/carbon-questions` | `GET /api/games/carbon-questions` | `GET /api/carbon-questions` | ❌ العقد غلط |
| `PUT /api/admin/messages/<id>/read` | `PUT /api/admin/messages/<id>` | `.../read` | ❌ العقد غلط (ومعلّم عليه «⚠️ مهم جداً») |
| `POST/PUT/DELETE /api/events` | `/api/admin/events` | `/api/events` | ❌ العقد غلط |
| …ونفس الشيء لـ posts / programs / initiatives / courses / opportunities / team | `/api/admin/*` | بدون بادئة | ❌ **21 endpoint** |
| — | `GET /api/curricula/download` | غير موجود | ⚠️ endpoint وهمي، الكود مبيناديهوش أبدًا |

**وفروق في شكل البيانات:**

| العنصر | الكود بيبعت/يتوقع | العقد بيوثّق |
|---|---|---|
| `POST /api/ai/chat` | `{ prompt, language }` | `{ message, language }` ❌ |
| `AnalyticItem.icon` | `"BarChart3"` (اسم أيقونة lucide) | `"📊"` (إيموجي) ❌ |
| كل الـ GETs العامة | `Authorization: Bearer` مرفق **دايمًا** | «Auth Required: ❌ No» ❌ |

**سيناريو الفشل:** مطوّر الباك إند ينفّذ العقد حرفيًا → 26 endpoint على مسارات مالهاش لازمة، والفرونت بيضرب على مسارات تانية خالص → 404 على طول الخط → **والـ mock fallback يخفي كل ده** فالموقع يبان تمام.

**الإصلاح:** الجدول الصحيح موجود في **القسم الرابع** تحت. اعتمده وامسح العقد القديم.

---

### 6. لوحة الأدمن مش قادرة تكتب محتوى المقالات ولا الكورسات

`src/pages/Admin/AdminContent.tsx`

الـ state معرَّف صح، لكن **الـ inputs ناقصة**:

| الكيان | حقول في الـ state | حقول ليها input فعلًا | الناقص |
|---|---|---|---|
| **Articles** | 12 | **6** | `contentEn`, `contentAr`, `authorEn`, `authorAr`, `categoryEn`, `categoryAr` |
| **Courses** | 12 | **5** | `descriptionEn/Ar`, `durationEn/Ar`, `lessonsCount`, `categoryEn/Ar` |
| **Initiatives** | 11 | ناقص | `categoryEn/Ar`, `targetEn/Ar`, `status` |
| **Team** | 5 | ناقص | `image` (فبيتبعت `""` → أفاتار مكسور) |
| **Events** | 9 | ناقص | `categoryAr` (الزوج ثنائي اللغة مكسور) |

**سيناريو الفشل:** الأدمن ينشر مقال من الـ CMS → السيرفر يستقبل `contentEn: ""` و`contentAr: ""` → صفحة `/blog/:id` تفتح على **جسم مقال فاضي**. الميزة الأساسية للـ CMS معطّلة.

كمان: `Program` مالوش input لـ `longDescriptionEn/Ar`، مع إن صفحة البرامج بتعرضهم.

---

### 7. مفيش رفع صور — والمشكلة دي مش مذكورة في أي وثيقة

4 كيانات (`BlogPost`, `Course`, `Initiative`, `TeamMember`) عندها حقل `image` إلزامي، والـ CMS بيتعامل معاه كـ **حقل نص لـ URL**. مفيش:

- endpoint رفع (`POST /api/upload`) — لا في `api.ts` ولا في أي وثيقة
- عقد `multipart/form-data`
- أي ذكر لاستضافة الصور (S3 / static folder / CDN)

**سيناريو الفشل:** مطوّر الباك إند يخلّص كل الـ 49 endpoint، وبعدين يكتشف إن الأدمن مش قادر يرفع صورة مقال ولا صورة عضو فريق. ميزة كاملة مش موجودة في أي مكان في التخطيط.

---

### 8. كل نقاط المستخدم وشاراته وتسجيلاته **بتتمسح** أول ما يفتح لوحة التحكم

`src/store/useAuthStore.ts:84‑104` + `157‑248`

```ts
registerForEvent: (event) => {   // ← مفيش أي نداء API خالص
  set(state => ({ registeredEvents: [newEvent, ...state.registeredEvents],
                  stats: {...state.stats, ecoPoints: state.stats.ecoPoints + 20} }));
}
// وبعدين:
loadUserProfile: async () => {
  const data = await apiService.getUserProfile();
  set({ stats: data.stats, registeredCourses: ..., registeredEvents: ... });  // ← يدهس كل حاجة
}
```

مفيش `persist` middleware، ومفيش endpoint يحفظ التسجيل ولا تقدّم الكورس ولا الشجر الافتراضي.

**سيناريو الفشل:** المستخدم يحسب بصمته (+50 نقطة) → يسجّل في فعالية (+20) → يخلّص كورس (+100 وشارة) → يفتح `/dashboard` → **يرجع لـ 240 نقطة و3 شجرات، وكل حاجة عملها اختفت**. لأن `loadUserProfile` دهس الـ state بالبيانات الثابتة من السيرفر.

وفي نفس الوقت `apiService.registerForEvent` **موجود** لكن الـ store بيتجاهله.

**الإصلاح:** حدّد صراحةً إيه اللي يتحفظ سيرفر‑سايد، واطلب من مطوّر الباك إند الـ endpoints الناقصة (`POST /api/user/events`، `DELETE /api/user/events/<id>`، `POST /api/user/courses/<id>/progress`، `POST /api/user/trees`)، واعمل merge بدل الدهس.

---

### 9. `/dashboard` صفحة عامة… ومفيش تسجيل دخول للأعضاء أصلاً

`src/App.tsx:52`

```tsx
<Route path="dashboard" element={<Dashboard />} />   // جوه الـ Layout العام، بدون أي guard
```

- أي زائر مجهول يفتح `/dashboard` يشوف **«عبد الله الشامسي» و240 نقطة** (بيانات mock).
- `authFetch` بيقرا `user_token` — **مفيش سطر واحد في المشروع كله بيكتب المفتاح ده**. مفيش صفحة تسجيل/دخول للأعضاء.
- فبيبعت `admin_token` بتاع الأدمن لـ `/user/profile` → Flask يرجّع 401 → `authFetch` يمسح توكن الأدمن ويطلّع الأدمن برّه → **والـ mock يخفي الفشل** فالصفحة تبان شغالة.

**الإصلاح:** إما تبني auth للأعضاء (register/login/refresh) وتوثّقه، أو تشيل `/dashboard` من الإصدار الأول. الحالة الحالية بتخلي مطوّر الباك إند يصمّم auth لمستخدمين مش موجودين.

---

### 10. مفيش `ErrorBoundary` + مفيش صفحة 404 → شاشة بيضا

`src/App.tsx:37` و `:54`

```tsx
<Route path="*" element={<Home />} />     // أي رابط غلط = الصفحة الرئيسية بـ 200
```

مفيش `ErrorBoundary` في الشجرة كلها. وأي throw = **شاشة بيضا كاملة**. ودي حالات حقيقية موجودة دلوقتي:

| المكان | الـ throw |
|---|---|
| `GamesHub.tsx:138` | `questions[step].questionAr` — لو `getCarbonQuestions` رجّعت `[]` |
| `Home.tsx:49` | لو Flask رجّع `{success, data}` بدل array |
| `Opportunities.tsx:165` | `.map` على `skillsAr` من غير guard |
| `AnalyticsChart.tsx:46` | prop `data` = null/undefined |
| `Aurora.tsx:130` | جهاز من غير WebGL |
| `ThemeContext.tsx:14` | `localStorage` محجوب (Safari private) |

**الإصلاح:** ضيف `ErrorBoundary` حوالين `<Routes>`، واعمل صفحة `NotFound` حقيقية.

---

## 🟠 القسم الثاني: أعطال ظاهرة للمستخدم دلوقتي

### أ) بصريات مكسورة (شكل — وده طلبك الأساسي)

| # | المشكلة | الملف | التأثير |
|---|---|---|---|
| 1 | **كل spinners الموقع مجمّدة** — `@keyframes spin` معرّف **بس** في `Events.css:1054`، وده chunk مستقل. `Home.css:17` بيستخدمه. | `Home.css:17` | لغاية ما المستخدم يزور `/events`، كل مؤشرات التحميل حلقة ثابتة مش بتلف |
| 2 | **الـ RouteLoader العام بدون أي ستايل** — بيستخدم `home-loader-container` من `Home.css` اللي مش محمّل على deep link | `App.tsx:26` | فتح `/contact` مباشرة = شاشة بيضا بدل spinner |
| 3 | **مودال التسجيل بيتغطّى** — `z-index: 2000` بينما الهيدر والـ bottom nav `99990 !important` وبالون الشات `99996` | `Events.css:804` | المودال بيظهر **تحت** الهيدر وبالون الشات وشريط الموبايل |
| 4 | **مودال الشهادة بدون أي CSS** — `.modal-overlay` / `.modal-content` **مش معرّفين في أي stylesheet** (الموجود `.modal-overlay-v2` و`.opps-modal-overlay`) | `LearningHub.tsx:248` | الشهادة بتتعرض ككتلة عادية بدون overlay ولا توسيط |
| 5 | **`.section-header-alignment` مش معرّف في أي مكان** | `Home.tsx:236` | قسمين في الرئيسية محاذاتهم مختلفة عن التالت |
| 6 | **`.pc-card { overflow: hidden }` بيقص توهّج BorderGlow** | `ProgramCards.css:17` | تأثير الـ glow في الدارك مود **مش ظاهر خالص** |
| 7 | **`EmptyState` مش بيستورد الـ CSS بتاعه** — و**مش مستورَد في أي مكان أصلاً** | `EmptyState.tsx:2` | كومبوننت ميت (57 + 52 سطر) |
| 8 | **لون تبويب الموبايل النشط 2.35:1** (11px أخضر) | `MobileBottomNav.css:77` | أهم مؤشر تنقّل على الموبايل غير مقروء |
| 9 | **`admin.css` مالوش دارك مود خالص** + بيعرّف `:root` تاني (`--admin-*`) بيناقض `variables.css` | `admin.css:9` | اللوحة بتفضل فاتحة والمستخدم مختار دارك |

### ب) أزرار وميزات بتكدب على المستخدم

| # | الميزة | الملف | الحقيقة |
|---|---|---|---|
| 1 | زرار **«تحميل المناهج (PDF)»** | `Portals.tsx:108` | `setTimeout(1500)` وبعدين «نجح» — **مفيش تحميل بيحصل** |
| 2 | **كود التذكرة + QR** بعد التسجيل | `Events.tsx:616` | الكود متولّد في المتصفح و**واحد لكل الحاضرين**، والـ QR رسمة SVG |
| 3 | **مفتاح «وضع الصيانة»** | `AdminSettings.tsx:99` | مفيش سطر واحد في التطبيق بيقرا `enableMaintenance` |
| 4 | **بادچ الرسائل غير المقروءة** | `AdminLayout.tsx:78` | الرقم `2` مكتوب حرفيًا، مش بيتغير |
| 5 | **كل رسوم التحليلات** (4 مواضع) | `AdminDashboardHome/AdminLayout/Dashboard` | 100% أرقام ثابتة في الكود |
| 6 | **«مسار أثرك المناخي»** في لوحة العضو | `Dashboard.tsx:87` | خيال كامل، مفيش endpoint وراه |
| 7 | **إلغاء التسجيل من فعالية** | `Dashboard.tsx:298` | بيعدّل الـ state محليًا بس، ومفيش DELETE endpoint في العقد |
| 8 | **الألعاب** | `GamesHub.tsx:203` | كروت مكتوبة يدويًا؛ `apiService.getGames()` **مش متنادى من أي كومبوننت**، و`playUrl` بيشاور على راوتس مش موجودة |
| 9 | **ملاحظة لمطوّر الباك إند ظاهرة في واجهة الأدمن الحيّة** | `AdminLayout.tsx:252‑265` | كارت مكتوب فيه «يا مطور الباك إند: … الأرقام الحالية محاكاة مؤقتة» — العميل بيشوفها |

### ج) منطق غلط

| # | المشكلة | الملف |
|---|---|---|
| 1 | **حفظ نتيجة بصمة = 0 مستحيل** — `if (!finalFootprint) return;` والصفر falsy، فأفضل مستخدم بيئيًا مش قادر يحفظ | `GamesHub.tsx:52` |
| 2 | **رسالة «تم الحفظ في لوحة التحكم» كذبة** — `stats` بيكون `null` (لأن `loadUserProfile` مش متنادى في GamesHub) فالنقاط مش بتتضاف، والـ store برضه بيرجّع `true` | `useAuthStore.ts:128` |
| 3 | **النقاط والشارات قابلة للتفريخ** — `updateCourseProgress(…, 100)` بيدي شارة كل مرة، والـ guard في state محلي بيترجع صفر مع كل remount | `useAuthStore.ts:204` |
| 4 | **`+50` نقطة مع كل ضغطة** على «حفظ البصمة» | `useAuthStore.ts:148` |
| 5 | **الكورس «12 درس» بيخلص في ضغطتين** — التقدّم مثبّت على 3 دروس | `LearningHub.tsx:45` |
| 6 | **الشبكة بتعرض فعاليات قديمة، غير مرتّبة، وزرار التسجيل شغّال** | `Events.tsx:446` |
| 7 | **`new Date("2026-04-25")` بيتفسّر UTC** والمقارنة بـ `now` محلي → في توقيت الإمارات (+4) الفعالية بتتحسب «فاتت» من 4 الفجر | `Events.tsx:107` |
| 8 | **بادچ الطلب في العربي دايمًا «مطلوب جداً»** مهما كانت `demand`، وبيسرّب الإنجليزي الخام بين قوسين | `Opportunities.tsx:135` |
| 9 | **الأدمن بيشوف شاشة الدخول مع كل reload** — `initializeAuth` في `useEffect` بينما الـ guard بيتنفّذ وقت الـ render | `AdminLayout.tsx:37` |
| 10 | **401 على الـ login نفسه بيطلّع الأدمن برّه** — الـ handler العام في `authFetch` بيشتغل على ريكوست الدخول، والعقد بيقول إن الدخول الغلط لازم يرجّع 401 | `api.ts:54` |
| 11 | **`AnimatePresence mode="wait"` من غير `location` مثبّت** → الصفحة الخارجة بترسم محتوى الراوت الجديد | `Layout.tsx:63` |
| 12 | **تصدير CSV بيتقطع عند أول `#`** ويُخرِج نص المستخدم كصيغ Excel (CSV injection) | `AdminMessages.tsx:67` |

### د) الأداء

| # | المشكلة | الملف | الأثر |
|---|---|---|---|
| 1 | **فيديو 57 ميجا** غير مضغوط بيشتغل تلقائيًا في الرئيسية (والاسم فيه خطأ إملائي `Campign`) | `Home.tsx:99` + `public/` | يستهلك باقة موبايل كاملة تقريبًا |
| 2 | **Aurora بيهدم ويعيد بناء سياق WebGL كامل مع كل re‑render** — `colorStops={["#00d0ff",…]}` array literal جوه dependency array | `Home.tsx:88` + `Aurora.tsx:215` | كل toggle للغة/الثيم = إعادة بناء GPU context |
| 3 | **شيدرز `#version 300 es` (WebGL2 فقط)** بدون fallback | `Aurora.tsx:12` | على WebGL1 الـ rAF بيرمي 60 مرة/ثانية للأبد |
| 4 | **`pointermove` غير مخنوق** في `BorderGlow` و`ChromaGrid` + قراءات layout متزامنة | `BorderGlow.tsx:125`, `ChromaGrid.tsx:128` | layout thrash |
| 5 | **`ChromaGrid`: مفيش تنظيف GSAP** — التوينز بتفضل شغالة بعد الـ unmount على DOM مفصول | `ChromaGrid.tsx:101` |
| 6 | **`BorderGlow`: 4 سلاسل rAF + 4 setTimeout بدون أي cleanup** | `BorderGlow.tsx:140` |
| 7 | **طبقتين `backdrop-filter` فوق بعض** بأقنعة radial متحرّكة بالماوس | `ChromaGrid.css:159` | من أغلى تركيبات التركيب البصري |
| 8 | **`Content-Type: application/json` على كل GET/DELETE** → CORS preflight إضافي على **كل** ريكوست | `api.ts:42` |
| 9 | **مفيش timeout ولا AbortSignal** — سيرفر معلّق = spinner للأبد، والـ mock عمره ما هيشتغل | `api.ts:49` |

### هـ) العربية / RTL / الوصولية

| # | المشكلة | التفاصيل |
|---|---|---|
| 1 | **463 شرط `language === "ar" ? … : …`** مقابل **54** نداء لـ `t()` | طبقة الترجمة (45 مفتاح) شبه ديكورية. أي لغة تالتة أو نص من الـ CMS = إعادة كتابة الواجهة |
| 2 | **وميض RTL + وميض الثيم مع كل تحميل** | `index.html` فيها `lang="en"` بدون `dir`، والتطبيق عربي RTL افتراضيًا وبيصلّحها في `useEffect` بعد الرسم |
| 3 | **الخط التجاري في الإنتاج** — `alfont_com_F37WicklowArabicTrial-ExtraBold.otf` كلمة **Trial** في الاسم | مخالفة ترخيص F37، ومحمَّل كـ `.otf` مش `.woff2` |
| 4 | **`font-weight: 900` على وجه خط `800` فقط** | تغليظ صناعي فوق ExtraBold عربي أصلاً |
| 5 | **محاور الرسم البياني بتنعكس والبيانات لأ** | `AnalyticsChart.tsx:158` — في العربي كل label بيشاور على نقطة غلط |
| 6 | **104 خاصية فيزيائية** (`left/right/margin-left/…`) مقابل 35 منطقية و51 override لـ `[dir="rtl"]` | نظام مختلط؛ العربي هو **الافتراضي** فأي فجوة = التجربة الأساسية مكسورة |
| 7 | **مفيش focus trap ولا Escape ولا استرجاع تركيز** في: درج الموبايل، مودال التقديم، لوحة الأوامر، مودالات الأدمن | `Header.tsx:44`, `Opportunities.tsx:264`, `QuickCommandPalette.tsx:117` |
| 8 | **`outline: none` في 8 مواضع** مقابل قاعدة `:focus-visible` **واحدة** في المشروع كله | مستخدم الكيبورد بيفقد مؤشر التركيز |
| 9 | **مفيش skip link ولا `.sr-only`** | تجاوز الهيدر (8+ روابط) مستحيل مع كل تغيير راوت |
| 10 | **كروت الفريق `<article onClick>`** بدون `role`/`tabIndex`/keyboard | غير قابلة للوصول بالكيبورد نهائيًا |
| 11 | **`prefers-reduced-motion` في ملفين CSS بس** | مش مغطّي Lenis ولا framer-motion ولا Aurora ولا GSAP |
| 12 | **الرسوم البيانية بدون `role`/اسم بديل** | غير مرئية تمامًا لقارئ الشاشة |

### و) كود ميت وتنظيف

- `QuickAccessMenu` (78 + 106 سطر) — **مش مستورد في أي مكان**، ومعاه الرابط الوحيد لـ `/dashboard`
- `EmptyState` (57 + 52 سطر) — مش مستورد، ومش بيستورد CSS بتاعه
- زرار فتح **لوحة الأوامر** متستيّل بالكامل (نسخة موبايل كمان) لكن **مش مرسوم أبدًا** — مفيش جهاز لمس يقدر يفتحها
- `apiService.getGames` و`getProgramById` — **مالهمش أي call site**
- `ApiResponse<T>` / `PaginatedResponse<T>` / `AuthResponse` معرّفين كـ «Standard API Response Envelopes» — **مستوردين في صفر مكان**
- `/media` و`/games` و`/dashboard` راوتس شغالة **بدون أي مدخل تنقّل**
- `.env` **مرفوع في الريبو** و`.gitignore` مش مستثنيه
- `VITE_APP_TITLE` معرّف ومش متقرا في أي مكان؛ `index.html` عنوانها `climatify` بحرف صغير، بدون description ولا OG tags
- سلكتورات ميتة: `.events-stats-grid`, `.event-stat-card`, `.admin-form-full`, `.admin-settings-section`
- توكنز ميتة: `--gradient`, `--gradient-soft`, `--gray`, `--space-10`, `--navy-700/800`, `--blue-900`, `--green-900`
- **147 `!important`** و**233 قيمة لون حرفية** خارج نظام التوكنز، و**17 قيمة z-index** بدون سلّم موثّق (تصادمان مؤكدان)
- صورة خلفية النشرة البريدية اسمها `clipboard-image-1784502037.webp` (لصق من الحافظة، مصدر/ترخيص مجهول)
- ملفات قالب Vite متبقية: `src/assets/react.svg`, `vite.svg`

---

## ✅ القسم الثالث: اللي اتعمل صح (عشان الصورة تبقى عادلة)

- **تنظيف WebGL في `Aurora`**: `cancelAnimationFrame` + `removeChild` + `WEBGL_lose_context.loseContext()` — أنضف من أغلب التطبيقات اللي بتستخدم ogl.
- **تنظيف Lenis في `Layout`**: إلغاء rAF + `destroy()` + تصفير الـ ref.
- **تقسيم الراوتس**: كل صفحة chunk مستقل، والأدمن bundle منفصل تمامًا (61 kB) — الزائر العادي مش بيحمّله.
- **ترتيب الراوتس سليم**: `/admin/*` بيغلب `*` بحكم الـ specificity في react-router 7 — **مش باگ**.
- **كل روابط `target="_blank"`** (5 مواضع) عليها `rel="noreferrer"`.
- **مفيش `dangerouslySetInnerHTML`** في المشروع كله — سطح XSS مقفول من الناحية دي.
- **`white-space: pre-line`** على جسم المقال — الأسطر الجديدة هتتعرض صح.
- **`package-lock.json`** سليم: `lockfileVersion 3`، كل الإدخالات عليها `integrity`، والإصدارات مطابقة.
- **`StrictMode`** مفعّل.
- **حذف عناصر الـ CMS** فيه تأكيد (`window.confirm`).
- **مستمع الـ scroll في الهيدر** `{ passive: true }`.
- **صور المؤسسين** موجودة فعلاً على القرص و`loading="lazy"`.

---

## 📋 القسم الرابع: عقد الـ API الصحيح (المستخرَج من الكود)

> **ده الجدول اللي مطوّر الباك إند لازم يبني عليه.** استخرجته من `src/services/api.ts` مباشرة، مش من التوثيق.
> `BASE = http://127.0.0.1:5000/api` — **بالبادئة `/api`**.

### قراءة (عامة)
| Verb | المسار | يرجّع |
|---|---|---|
| GET | `/programs` | `Program[]` |
| GET | `/programs/<id>` | `Program` *(مفيش call site حاليًا)* |
| GET | `/initiatives` | `Initiative[]` |
| GET | `/events` | `Event[]` |
| GET | `/courses` | `Course[]` |
| GET | `/games` | `Game[]` *(مفيش call site حاليًا)* |
| GET | `/opportunities` | `Opportunity[]` |
| GET | `/posts` | `BlogPost[]` |
| GET | `/posts/<id>` | `BlogPost` |
| GET | `/team` | `TeamMember[]` |
| GET | `/careers` | `CareerNode[]` |
| GET | `/carbon-questions` | `CarbonQuestion[]` |

### نماذج
| Verb | المسار | الـ Body |
|---|---|---|
| POST | `/contact` | `{firstName, lastName, email, subject, message}` |
| POST | `/meetings` | `{name, email, date, time, notes}` |
| POST | `/partnerships` | `{orgName, orgType, contactPerson, email, proposal}` |
| POST | `/workshops` | `{institutionName, city, studentCount, workshopType, email}` |
| POST | `/events/register` | `{eventId, name, email, phone}` |
| POST | `/opportunities/apply` | `{opportunityId, name, email, portfolio, coverLetter}` |
| POST | `/carbon-footprint` | `{footprint: number}` |
| POST | `/newsletter/subscribe` | `{email}` |
| POST | `/ai/chat` | `{prompt, language}` |

### مستخدم / أدمن
| Verb | المسار |
|---|---|
| GET / PUT | `/user/profile` |
| POST | `/admin/login` |
| GET | `/admin/stats` · `/admin/analytics` · `/admin/messages` |
| PUT | `/admin/messages/<id>/read` — body `{isRead}` |
| DELETE | `/admin/messages/<id>` |
| POST | `/admin/settings` · `/admin/change-password` |

### CRUD المحتوى — **بدون بادئة `/admin`**
`POST /<res>` · `PUT /<res>/<id>` · `DELETE /<res>/<id>`
حيث `<res>` ∈ `events` · `posts` · `programs` · `initiatives` · `courses` · `opportunities` · `team`

> ⚠️ ملاحظة أمنية: المسارات دي **عامة الشكل** لكنها بتحتاج JWT أدمن. `authFetch` بيرفق التوكن على كل الريكوستات (حتى الـ GETs العامة). Flask لازم يفرض `@jwt_required` + `role == "admin"` على الـ POST/PUT/DELETE.

### ناقص من العقد بالكامل (لازم يتحدّد قبل البداية)
`POST /upload` (رفع الصور) · auth الأعضاء (تسجيل/دخول/refresh) · حفظ التسجيل في فعالية · إلغاء التسجيل · حفظ تقدّم الكورس · حفظ الشجر الافتراضي · pagination/filter/sort · التوقيت الزمني · SPA history fallback · بيانات الأدمن الأولية (seed)

---

## 🎯 القسم الخامس: خطة العمل بالترتيب

**قبل ما مطوّر الباك إند يكتب سطر واحد** (نصف يوم شغل):
1. صحّح `VITE_API_BASE_URL` في الوثيقتين (`/api` + استخدم `>>`)
2. اعتمد جدول القسم الرابع وامسح جداول `API_CONTRACT.md` المخالفة
3. أضِف تحذير صريح: «الـ mock fallback بيخفي أخطاء السيرفر — اطفيه بـ `VITE_USE_MOCK_API`»
4. وثّق SPA history fallback + رفع الصور + الـ endpoints الناقصة

**الأسبوع الأول** (يوازي شغل الباك إند):
5. اقفل الـ mock fallback لما `USE_MOCK_API === false`؛ ارمِ `ApiError` واعرض حالات خطأ حقيقية
6. شيل mock الدخول نهائيًا من مسار الإنتاج
7. `ErrorBoundary` + صفحة 404 حقيقية
8. فعّل `"strict": true` في `tsconfig.app.json` وصلّح الناتج
9. كمّل حقول الـ CMS الناقصة (المقالات والكورسات أولًا)
10. صلّح `@keyframes spin` و`z-index` المودالات و`.modal-overlay` الغايب

**قبل الإطلاق:**
11. استبدل الخط التجريبي بترخيص صحيح (و`.woff2`)
12. اضغط فيديو الـ 57 ميجا أو انقله لـ CDN
13. حزمة الوصولية: focus trap + skip link + `:focus-visible` + `prefers-reduced-motion` عام
14. شيل الكود الميت والملاحظة الظاهرة في واجهة الأدمن
15. وحّد طبقة الترجمة (463 ternary → `t()`)

---

## 📎 الملحق: كل الملاحظات الـ 379

> مرتّبة بالخطورة ثم بالملف. كل صف فيه المرجع الدقيق `ملف:سطر`.
| # | الخطورة | التصنيف | الملف:السطر | المشكلة | الإصلاح المقترح |
|---|---|---|---|---|---|
| 1 | 🔴 حرِج | docs-mismatch | `docs/API_CONTRACT.md:4` | API_CONTRACT.md declares itself the sole source of truth but disagrees with the code on 26 of 53 endpoints; the accurate doc is the one it overrules | Either regenerate API_CONTRACT.md from api.ts, or invert the precedence clause. Do not ship two endpoint tables; delete one and keep a single generated list (ideally an OpenAPI YAML checked into docs/). |
| 2 | 🔴 حرِج | docs-mismatch | `docs/API_CONTRACT.md:13` | API_CONTRACT.md declares a Base URL that contradicts .env and the code | State `http://127.0.0.1:5000/api` and add an explicit note that api.ts appends endpoint paths directly (`${API_BASE_URL}${endpoint}`), so the `/api` segment must be in the variable, not in the endpoint strings. |
| 3 | 🔴 حرِج | docs-mismatch | `docs/API_CONTRACT.md:465` | Login is documented as POST /api/auth/login but the frontend calls POST /api/admin/login | Pick one path and make all three docs plus api.ts:335 agree. BACKEND_HANDOFF_SUMMARY.md:78 already says /api/admin/login, which matches the code; API_CONTRACT.md:465, 854 and BACKEND_DEVELOPER_GUIDE.md:35/189 must be corrected to match, or api.ts changed to /a |
| 4 | 🔴 حرِج | docs-mismatch | `docs/API_CONTRACT.md:717` | All 21 admin CMS CRUD endpoints are documented under /api/admin/* but the frontend calls the bare public paths | Rewrite API_CONTRACT.md section 6 (lines 713-829) and its summary rows 865-885 to the actual paths the code uses: POST/PUT/DELETE on /api/events, /api/posts, /api/programs, /api/initiatives, /api/courses, /api/opportunities, /api/team — and state explicitly th |
| 5 | 🔴 حرِج | docs-mismatch | `docs/BACKEND_DEVELOPER_GUIDE.md:99` | The backend guide (and API_CONTRACT §9.1) tells the dev to set VITE_API_BASE_URL without the /api suffix, which 404s every request | Fix both doc lines to http://127.0.0.1:5000/api, and add a dev-mode console assertion in api.ts that warns if API_BASE_URL does not end in /api. |
| 6 | 🔴 حرِج | backend-integration | `docs/BACKEND_DEVELOPER_GUIDE.md:99` | Backend guide tells the Flask dev to write a VITE_API_BASE_URL that is missing the /api prefix, and to overwrite .env while doing it | Change lines 99 and 675 of BACKEND_DEVELOPER_GUIDE.md and line 13 of API_CONTRACT.md to `http://127.0.0.1:5000/api`, and change the command from `>` (overwrite) to `cp .env.example .env`. Better: delete the echo step entirely since .env is already committed wi |
| 7 | 🔴 حرِج | backend-integration | `docs/BACKEND_DEVELOPER_GUIDE.md:532` | SPA history fallback is documented nowhere, and the guide's Flask 404 handler will actively break every deep link | Add a section to BACKEND_DEVELOPER_GUIDE.md: `@app.route('/', defaults={'path':''}) @app.route('/<path:path>') def spa(path): if path.startswith('api/'): abort(404); return send_from_directory('dist', 'index.html')` — and scope the JSON 404 handler to the `/ap |
| 8 | 🔴 حرِج | backend-integration | `docs/BACKEND_HANDOFF_SUMMARY.md:26` | No document warns that a 4xx/5xx from the backend is silently converted into a successful mock response | Add a prominent section to API_CONTRACT.md and BACKEND_HANDOFF_SUMMARY.md stating that mock fallback fires on ANY non-2xx, listing the affected methods, and instructing the backend dev to verify integration via the Network tab / Flask access log rather than th |
| 9 | 🔴 حرِج | correctness | `src/App.tsx:37` | No ErrorBoundary anywhere: a failed lazy chunk fetch or any render throw produces a permanent blank white page | Wrap `<Routes>` (or each lazy element) in an error boundary class component that catches chunk-load failures and renders a retry button that calls `window.location.reload()`. Migrate to `createBrowserRouter` + `errorElement` for route-level granularity. |
| 10 | 🔴 حرِج | security | `src/App.tsx:52` | /dashboard is a public route; no member login/register exists anywhere in the app | Either ship a member auth page that writes `user_token` and wrap /dashboard in a guard that redirects unauthenticated users, or remove /dashboard and the QuickAccessMenu link until member auth exists. Also stop api.ts:296 from returning mock profile data on a  |
| 11 | 🔴 حرِج | missing-feature | `src/App.tsx:54` | The `*` route renders <Home /> — there is no 404 page, so every mistyped URL returns a 200 homepage | Create `src/pages/NotFound/NotFound.tsx` with a translated 404 message and links back to `/`, and render it at `path="*"`. Add a matching `<Route path="*">` inside AdminLayout's nested routes. |
| 12 | 🔴 حرِج | correctness | `src/components/Aurora/Aurora.tsx:130` | No WebGL capability check or try/catch — a device without WebGL throws inside useEffect and (with no ErrorBoundary) blanks the whole app | Probe first: `const test = document.createElement('canvas').getContext('webgl2'); if (!test) return;` and wrap the `new Renderer(...)` in try/catch, returning early so the hero falls back to the CSS gradient/video. Add an ErrorBoundary around the route regardl |
| 13 | 🔴 حرِج | performance | `src/components/Aurora/Aurora.tsx:215` | Aurora's effect depends on the `colorStops` array identity, so every Home re-render destroys and rebuilds the whole WebGL context | Drop `colorStops`/`amplitude`/`blend` from the dep array entirely — the render loop already reads them live from `propsRef.current` (lines 194-202), so the deps are redundant. Use `[]` and let propsRef drive updates. Independently, memoize the two context prov |
| 14 | 🔴 حرِج | backend-integration | `src/components/ChromaGrid/ChromaGrid.tsx:99` | ChromaGrid falls back to six hardcoded fictional staff members whenever the items array is empty | Delete the `demo` array from the component (move it to a Storybook/example file). Render an explicit empty state when `items` is empty, and have About render a skeleton while the fetch is in flight. |
| 15 | 🔴 حرِج | backend-integration | `src/components/layout/AIChatAssistant.tsx:58` | AI chat silently degrades to a hardcoded keyword matcher; `success` is never checked and a null reply renders an empty bubble | Remove the keyword-matcher fallback. Check `response.success` before appending, and append a visible error message bubble on failure. Document the contract as: POST /api/ai/chat {prompt:string, language:"en"\|"ar"} -> 200 {success:boolean, reply:string} \| non |
| 16 | 🔴 حرِج | backend-integration | `src/components/layout/Footer.tsx:20` | Newsletter always reports success even when the Flask endpoint 500s or 422s | Delete the mock fallback for mutation endpoints entirely (or gate it strictly behind USE_MOCK_API===true). Make subscribeNewsletter throw on !res.ok with the status and parsed body, and give the Footer a real error branch. |
| 17 | 🔴 حرِج | react | `src/components/layout/Layout.tsx:63` | AnimatePresence mode="wait" wraps <Outlet/> without a pinned location, so the exiting page renders the NEW route | In App.tsx use `const location = useLocation()` and `<Routes location={location} key={location.pathname}>`, or move AnimatePresence above Routes. Keying the motion.div alone is not sufficient with Outlet. |
| 18 | 🔴 حرِج | correctness | `src/components/ui/EmptyState.tsx:2` | EmptyState.tsx never imports EmptyState.css, so the component renders completely unstyled | Add `import "./EmptyState.css";` at the top of EmptyState.tsx. |
| 19 | 🔴 حرِج | dead-code | `src/components/ui/EmptyState.tsx:23` | EmptyState is dead code — zero import sites in the entire app | Either wire EmptyState into every fetched list (Media, LearningHub, Events, Programs, Opportunities, Portals, admin tables) or delete the file so nobody believes empty states are handled. |
| 20 | 🔴 حرِج | i18n-rtl | `src/context/LanguageContext.tsx:135` | Full-page RTL mirror flash and light-to-dark flash on every cold load | Set `<html lang="ar" dir="rtl">` in index.html and add a tiny inline <script> in <head> that reads localStorage keys "climatify-lang" and "climatify-theme" (wrapped in try/catch) and sets lang/dir/data-theme before the bundle loads. Change both context effects |
| 21 | 🔴 حرِج | backend-integration | `src/pages/About/About.tsx:27` | About page renders ChromaGrid's built-in demo team ("Alex Rivera — Full Stack Developer", pravatar photos) on first paint and whenever /api/team returns empty | Add `const [teamLoading, setTeamLoading] = useState(true)` and render a skeleton while loading, an error message on failure, and an explicit empty state when `team.length === 0`. Never let ChromaGrid fall back to `demo` — pass a sentinel or delete the `demo` a |
| 22 | 🔴 حرِج | missing-feature | `src/pages/Admin/AdminContent.tsx:353` | The Articles form has no contentEn/contentAr/author/category inputs, so every CMS-created post has an empty body | Add textareas for contentEn/contentAr (the primary field of the entity), inputs for categoryEn/categoryAr, and editable author fields; mark them required. |
| 23 | 🔴 حرِج | missing-feature | `src/pages/Admin/AdminContent.tsx:451` | The Courses form collects only 4 of the 12 Course fields; description, duration, lessonsCount, category and image are never editable | Render inputs for every non-generated Course field, or drop the unsupported columns from the type and the contract. |
| 24 | 🔴 حرِج | design-system | `src/pages/Events/Events.css:804` | All modal overlays sit at z-index 2000 while fixed chrome sits at 99990–999999 — header, chat bubble and bottom nav render on top of every dialog | Add a documented scale to variables.css (--z-base:0; --z-sticky:100; --z-header:200; --z-drawer:300; --z-modal:400; --z-toast:500), replace all 18 distinct ad-hoc values with it, and drop the `!important` on the header/bottom-nav z-index. |
| 25 | 🔴 حرِج | backend-integration | `src/pages/Events/Events.tsx:219` | Registration shows a confirmed ticket even when the backend rejected the POST | Remove the mock fallback for all write operations. Make registerForEvent throw on !res.ok (parse and surface `error`/`errors`), keep mock fallback only behind USE_MOCK_API === true, and render a visible error state in the modal. |
| 26 | 🔴 حرِج | correctness | `src/pages/GamesHub/GamesHub.tsx:138` | Unguarded questions[step] dereference crashes the page (no ErrorBoundary) whenever the question list is empty or not an array | Guard the calculator branch: `if (!questions.length) return <Loader/>` and `const q = questions[step]; if (!q) return null;`. Validate `Array.isArray(data)` in the fetch at line 24 and add an ErrorBoundary around routes. |
| 27 | 🔴 حرِج | backend-integration | `src/pages/Home/Home.tsx:49` | If Flask returns the documented {success,data} envelope instead of a bare array, the Home page throws and the whole app goes blank (no ErrorBoundary) | Normalize in api.ts: `const json = await res.json(); return Array.isArray(json) ? json : (json?.data ?? []);` for every list endpoint, and add an ErrorBoundary around <Outlet/> in Layout.tsx. Also delete `ApiResponse`/`PaginatedResponse` from types/index.ts if |
| 28 | 🔴 حرِج | design-system | `src/pages/LearningHub/LearningHub.tsx:248` | The certificate "modal" has zero CSS — .modal-overlay / .modal-content / .modal-header / .modal-actions / .btn-close are not defined in any stylesheet | Add the missing .modal-overlay/.modal-content/.modal-header/.modal-actions/.btn-close rules to LearningHub.css (or promote the Programs.css modal styles to global.css and reuse them), and scroll/focus the dialog when it opens. |
| 29 | 🔴 حرِج | backend-integration | `src/pages/Opportunities/Opportunities.tsx:56` | Job application modal reports "Application Submitted!" on any backend error; no error branch exists | Handle !response.success explicitly with a visible, aria-live error; surface HTTP status from the service layer. |
| 30 | 🔴 حرِج | backend-integration | `src/pages/Portals/Portals.tsx:65` | Both portal forms show the success screen even when the server rejects the submission | Add `error` state to both handlers; render an aria-live error region on failure; and remove the mock fallback in api.ts so non-ok responses reject. |
| 31 | 🔴 حرِج | backend-integration | `src/pages/Portals/Portals.tsx:82` | Workshop form posts to /api/workshops but API_CONTRACT.md documents /api/education-workshops — three sources disagree | Pick one path, change api.ts:241 and both docs to match, and delete the stale JSDoc block at Portals.tsx:77-84. |
| 32 | 🔴 حرِج | forms | `src/pages/Portals/Portals.tsx:338` | Neither portal form disables its submit button while the request is in flight — duplicate rows guaranteed | Add `const [submitting,setSubmitting]=useState(false)`, set it around the await, and pass `disabled={submitting}` plus a loading label to both buttons (the download button at line 237 already does this correctly — copy that pattern). |
| 33 | 🔴 حرِج | backend-integration | `src/pages/Programs/Programs.tsx:196` | The Programs error state can never render — api.ts never rejects, so a Flask 500 shows five mock programs as if they were real | In api.ts, only fall back to mocks when `USE_MOCK_API === true`; otherwise `throw new Error(...)` on `!res.ok` and on network failure so `loadError` actually fires. At minimum surface a visible "showing offline sample data" banner whenever the fallback path is |
| 34 | 🔴 حرِج | backend-integration | `src/services/api.ts:54` | Visiting the public /dashboard sends the admin Bearer token to /user/profile; the resulting 401 silently destroys the admin session while the mock fallback hides the failure | Ship a member auth flow (or drop the member dashboard). Scope authFetch's 401 handling to the token that was actually sent, and never mock-fallback an authenticated endpoint. |
| 35 | 🔴 حرِج | backend-integration | `src/services/api.ts:74` | Every read method treats 400/401/403/404/422/500 identically to a network outage and returns hardcoded mock data as a successful result | Add an explicit non-2xx branch that throws a typed ApiError(status, body). Make the mock path conditional on `USE_MOCK_API` only — a runtime fallback must never substitute for an errored response. Callers already have try/catch, so throwing gives them a real e |
| 36 | 🔴 حرِج | backend-integration | `src/services/api.ts:208` | Every POST/PUT method returns {success:true, message:'...بنجاح'} when the server rejects the payload | Same as the read fix: throw on non-2xx. Additionally surface `errors: Record<string,string[]>` (already declared in types/index.ts:209) to the forms so field-level validation from Flask can be rendered. |
| 37 | 🔴 حرِج | docs-mismatch | `src/services/api.ts:335` | Login posts to /api/admin/login but the contract (§3.1 and the §7 summary table and the §9.3 curl test) specifies /api/auth/login | Change the path to /auth/login (matching the contract) or update §3.1, §7 and §9.3. Combine with the loginAdmin mock removal so this failure mode is loud. |
| 38 | 🔴 حرِج | security | `src/services/api.ts:336` | loginAdmin: res.json() is called before the ok-check, so a non-JSON 401/500 body also drops into the any-credentials mock | Guard the parse: `const json = await res.json().catch(() => ({}))`, and branch on `res.ok` first. Never let a parse failure reach a success path. |
| 39 | 🔴 حرِج | security | `src/services/api.ts:342` | loginAdmin falls through to a mock that accepts ANY credentials when the Flask server is unreachable | Delete the mock branch from loginAdmin entirely. On network error, reject or return {success:false,error:'NETWORK'} — never a token. Gate any remaining mock behind `if (USE_MOCK_API)` at the top of the function and `import.meta.env.DEV`. |
| 40 | 🔴 حرِج | security | `src/services/api.ts:348` | Any 500/non-JSON response from the login endpoint downgrades to a mock login that accepts any email plus a 4-character password | Move `res.json()` inside `if (res.ok)`, and gate the mock branch on `import.meta.env.DEV \|\| USE_MOCK_API` so it can never authenticate in a production bundle. Document the change in the contract's auth section. |
| 41 | 🔴 حرِج | backend-integration | `src/services/api.ts:480` | A rejected password change (400 wrong current password) is reported to the admin as success | On !res.ok, parse and return the server body (it already matches the {success,message} shape) instead of falling through to the mock. |
| 42 | 🔴 حرِج | backend-integration | `src/services/api.ts:491` | All 21 admin CRUD calls hit /api/<resource> while API_CONTRACT.md §6 specifies /api/admin/<resource> | Pick one. Either prefix all mutating admin calls with /admin/ in api.ts, or rewrite API_CONTRACT.md §6 and §7 to the unprefixed paths. Note the GET collections legitimately share /api/events etc., so the collision must be resolved deliberately (verb-based on t |
| 43 | 🔴 حرِج | backend-integration | `src/services/api.ts:516` | Every CMS delete reports success on any non-2xx, so the row vanishes from the UI while the DB row survives | Make all delete methods throw on !res.ok; have AdminContent.handleDelete surface the false return in a toast and re-fetch on failure. |
| 44 | 🔴 حرِج | security | `src/store/useAuthStore.ts:50` | Admin gating is a localStorage key-presence check with no signature, expiry or server validation | Validate the token server-side on admin mount (GET /api/admin/me) before rendering the CMS, decode exp client-side to pre-empt dead sessions, and add an explicit 'client gate is cosmetic, enforce server-side' warning to BACKEND_HANDOFF_SUMMARY.md. |
| 45 | 🔴 حرِج | state | `src/store/useAuthStore.ts:88` | loadUserProfile blindly overwrites stats/courses/events, so every visit to /dashboard erases all points, trees, badges and registrations earned elsewhere | Either persist those mutations server-side and treat the server as the single source of truth (remove the local point arithmetic), or merge the server payload with unsynced local deltas. Do not silently replace client state that the app itself mutated with no  |
| 46 | 🔴 حرِج | backend-integration | `src/store/useAuthStore.ts:88` | Every point, badge, tree and course-progress the user earns is client-only and is silently destroyed the moment the Dashboard mounts | Either persist each mutation through a real endpoint (POST /api/user/courses/<id>/progress, POST /api/user/trees, POST /api/user/points) and add them to API_CONTRACT.md, or make loadUserProfile merge rather than replace and document loudly that the gamificatio |
| 47 | 🔴 حرِج | backend-integration | `src/store/useAuthStore.ts:157` | registerForEvent / updateCourseProgress / plantVirtualTree mutate points, trees and badges purely in memory — no persist middleware and no API call, while apiService.registerForEvent exists and is bypassed | Add POST endpoints for course progress, tree redemption and points to the contract and call them from the store actions; on success reconcile with the server response. Until then, at minimum add zustand persist for the user slice and delete the "saved to your  |
| 48 | 🔴 حرِج | security | `src/styles/global.css:9` | Commercial TRIAL font shipped in production build — F37 EULA violation | Purchase an F37 Wicklow Arabic webfont license, or replace with a licensed Arabic display face. Until then remove the @font-face and the [dir="rtl"] heading rule at global.css:44-56 so headings fall back to IBM Plex Sans Arabic. Also stop serving the .otf from |
| 49 | 🔴 حرِج | i18n-rtl | `src/styles/global.css:55` | Heading font has only 115 glyphs — no Arabic comma, question mark, or harakat; homepage H1 breaks | Do not ship a trial subset as a UI font. Either license the full family, or restrict the display font to a decorative role with explicit `unicode-range` and design copy around its coverage. At minimum add `unicode-range: U+0621-064A, U+0660-0669, U+0020-007E;` |
| 50 | 🔴 حرِج | backend-integration | `src/types/index.ts:204` | ApiResponse<T>/PaginatedResponse<T>/AuthResponse are declared as 'Standard API Response Envelopes' but are imported nowhere; api.ts assumes bare arrays | Decide the envelope once and enforce it: either delete ApiResponse/PaginatedResponse from types and state 'bare arrays, no envelope' in the contract, or actually unwrap `json.data` in api.ts. Add a runtime shape guard (`Array.isArray(json) ? json : json?.data  |
| 51 | 🟠 عالي | security | `.gitignore:13` | .env is committed to the repo and .gitignore does not exclude it | Add `.env`, `.env.local`, `.env.*.local` to .gitignore, `git rm --cached .env`, and keep only `.env.example` in version control. Add a line to BACKEND_DEVELOPER_GUIDE.md telling the dev to `cp .env.example .env`. |
| 52 | 🟠 عالي | docs-mismatch | `docs/API_CONTRACT.md:225` | API_CONTRACT (declared "the only source of truth") says /api/team is unused and the team is hardcoded in About.tsx — About.tsx actually calls it | Delete the note, mark /api/team as REQUIRED and consumed by About.tsx, and add `borderColor` / `gradient` (both optional strings) to the documented response. |
| 53 | 🟠 عالي | docs-mismatch | `docs/API_CONTRACT.md:311` | Education-workshop form is documented at /api/education-workshops but posts to /api/workshops | Correct API_CONTRACT.md:311 and summary row 850 to `POST /api/workshops`. |
| 54 | 🟠 عالي | missing-feature | `docs/API_CONTRACT.md:334` | GET /api/curricula/download is a specified endpoint with two alternative contracts; the frontend never calls it and fakes success with a setTimeout | Either implement the call in Portals.tsx (window.open / blob download) and pick ONE response contract in the doc, or remove section 2.5 and summary row 851 and label the button 'coming soon'. Do not ship a doc that offers the backend a choice of two incompatib |
| 55 | 🟠 عالي | docs-mismatch | `docs/API_CONTRACT.md:408` | POST /api/ai/chat is documented with a `message` field but the frontend sends `prompt` | Change API_CONTRACT.md:408 to `prompt`, add /api/ai/chat to the summary table (currently missing), and document the `language` value domain ('ar' \| 'en') plus expected response `{ success, reply }`. |
| 56 | 🟠 عالي | docs-mismatch | `docs/API_CONTRACT.md:445` | Carbon-question bank documented at /api/games/carbon-questions; code fetches /api/carbon-questions | Change API_CONTRACT.md:445 to `GET /api/carbon-questions` (matches BACKEND_HANDOFF_SUMMARY.md:48 and api.ts:755) and add it to the summary table at line 837-885, where it is currently absent. |
| 57 | 🟠 عالي | docs-mismatch | `docs/API_CONTRACT.md:567` | Carbon-footprint save is documented as authenticated POST /api/user/carbon-footprint; the code posts to the unauthenticated-looking /api/carbon-footprint | Fix the path in API_CONTRACT.md:567/857, and state explicitly whether an anonymous POST is a 401 or an accepted anonymous record — the calculator is reachable without login, so the answer matters. |
| 58 | 🟠 عالي | docs-mismatch | `docs/API_CONTRACT.md:642` | Mark-message-read is documented as PUT /api/admin/messages/<id> but the code calls PUT /api/admin/messages/<id>/read | Change API_CONTRACT.md:642 and summary row 861 to `PUT /api/admin/messages/<id>/read` to match api.ts:442 and BACKEND_HANDOFF_SUMMARY.md:82. |
| 59 | 🟠 عالي | backend-integration | `docs/API_CONTRACT.md:940` | No document covers pagination/filter/sort/search params, timezone, rate limits, SPA history fallback, seed data, or admin bootstrap credentials | Add an 'Operational Contract' section covering: allowed query params per list endpoint (even if just ?limit), the timezone rule (recommend storing UTC and specifying that `time` is Asia/Dubai local), rate limits for public POSTs, SPA history-fallback config if |
| 60 | 🟠 عالي | i18n-rtl | `index.html:2` | index.html hardcodes lang="en" with no dir, while the app defaults to Arabic RTL and only fixes it in a post-paint effect | Set `<html lang="ar" dir="rtl">` as the default in index.html to match LanguageContext.tsx:132, and add a blocking inline script in `<head>` that reads `localStorage['climatify-lang']` and `climatify-theme` and stamps `lang`/`dir`/`data-theme` on `document.doc |
| 61 | 🟠 عالي | correctness | `src/App.tsx:26` | The global route loader's CSS lives inside the code-split Home chunk, so every cold deep link shows a blank white screen instead of a spinner | Move `.home-loader-container`, `.spinner` and `@keyframes spin` out of Home.css/Events.css into `src/styles/global.css` (which is in the main bundle via index.css:2). Rename to `.route-loader` / `.route-spinner` while you are there. |
| 62 | 🟠 عالي | correctness | `src/components/Aurora/Aurora.tsx:12` | Shaders are GLSL ES 3.00 but ogl silently falls back to WebGL1 — the rAF loop then throws 60 times per second, forever | Gate on WebGL2 explicitly (`new Renderer({ webgl: 2 })` still falls back; check `renderer.isWebgl2` and bail if false), or ship GLSL ES 1.00 shaders. Also wrap the body of `update` in try/catch and `cancelAnimationFrame` on first error. |
| 63 | 🟠 عالي | performance | `src/components/Aurora/Aurora.tsx:192` | Aurora runs a full-viewport fragment shader forever — no IntersectionObserver, no visibilitychange, no prefers-reduced-motion | Add an IntersectionObserver on `ctnDom` that cancels the rAF when the hero leaves the viewport, plus a `document.visibilitychange` guard, plus `window.matchMedia('(prefers-reduced-motion: reduce)').matches` -> render a single static frame and never start the l |
| 64 | 🟠 عالي | performance | `src/components/Aurora/Aurora.tsx:199` | The render loop allocates three ogl Color objects and three arrays every single frame | Parse the stops once outside the loop and only re-parse when the stop strings actually change (compare the joined string); write into a preallocated Float32Array/nested array in place. |
| 65 | 🟠 عالي | performance | `src/components/BorderGlow/BorderGlow.tsx:125` | pointermove handler is unthrottled and forces two synchronous layout reads per event, then repaints three masked+blended layers | Cache the rect on pointerenter/resize instead of reading it per event, and batch the two setProperty calls into a single rAF (`if (!raf) raf = requestAnimationFrame(apply)`), cancelling it on unmount. |
| 66 | 🟠 عالي | react | `src/components/BorderGlow/BorderGlow.tsx:140` | The `animated` intro sweep starts four uncancellable rAF chains plus four setTimeouts, and the effect returns no cleanup at all | Have `animateValue` return a cancel function (store the rAF id and the timeout id, expose `() => { clearTimeout(t); cancelAnimationFrame(id); }`), collect the four cancels, and return `() => cancels.forEach(c => c())` from the effect. |
| 67 | 🟠 عالي | design-system | `src/components/ChromaGrid/ChromaGrid.css:50` | On touch devices the entire team section is permanently black-and-white and dimmed — the reveal is hover-only | Wrap the grayscale default and the spotlight machinery in `@media (hover: hover) and (pointer: fine)`, and render the cards in full colour with `.chroma-fade { opacity: 0 }` otherwise. |
| 68 | 🟠 عالي | performance | `src/components/ChromaGrid/ChromaGrid.css:159` | Two stacked full-grid `backdrop-filter` layers with pointer-driven radial masks — one of the most expensive compositing combinations available | Collapse the two layers into one (the fade is just the inverse mask of the overlay — animate a single layer's opacity), and replace `backdrop-filter` with an ordinary `background` gradient + per-card `filter`, which composites without a backdrop read. |
| 69 | 🟠 عالي | react | `src/components/ChromaGrid/ChromaGrid.tsx:101` | No GSAP teardown — tweens keep running after unmount, writing through quickSetters bound to detached DOM | Wrap the setup in `const ctx = gsap.context(() => {...}, rootRef)` and return `() => ctx.revert()`, or at minimum return `() => { gsap.killTweensOf(pos.current); if (fadeRef.current) gsap.killTweensOf(fadeRef.current); }`. |
| 70 | 🟠 عالي | performance | `src/components/ChromaGrid/ChromaGrid.tsx:128` | Every pointermove allocates two GSAP tweens and forces two layout reads across two nested handlers | Store the grid rect on pointerenter/resize rather than reading it per event; hoist the fade tween out of the move handler (only run it on pointerenter, not on every move); and batch the card's `--mouse-x/--mouse-y` writes into a shared rAF. |
| 71 | 🟠 عالي | a11y | `src/components/ChromaGrid/ChromaGrid.tsx:175` | Clickable team cards are `<article onClick>` — no role, no tabIndex, no key handler, unreachable by keyboard or screen reader | Render an `<a href={c.url} target="_blank" rel="noopener noreferrer">` wrapping the card content when a url exists (and a plain article when it does not), instead of a synthetic onClick + window.open. |
| 72 | 🟠 عالي | state | `src/components/layout/AIChatAssistant.tsx:43` | handleSend has no in-flight guard, so quick-reply chips fire concurrent requests that resolve out of order | Return early if `isTyping`, disable the send button and all quick-reply chips while pending, track requests with an AbortController stored in a ref and abort it in an unmount cleanup. |
| 73 | 🟠 عالي | forms | `src/components/layout/Footer.tsx:21` | A 200 response with {success:false} produces absolutely no feedback — the button just does nothing | Add an error state rendering `response.message` in a role="alert" region, disable the submit button while a request is in flight, and surface network errors from the catch instead of only console.error. |
| 74 | 🟠 عالي | missing-feature | `src/components/layout/Header.tsx:28` | /media, /games and /dashboard are registered routes with zero navigation entry anywhere in the shell | Add /media and /games to navItems (or explicitly remove the routes), add the auth-gated /dashboard entry, and extract the single navItems array into one shared module consumed by Header, MobileBottomNav and QuickCommandPalette. |
| 75 | 🟠 عالي | a11y | `src/components/layout/Header.tsx:44` | Mobile nav drawer has no focus trap, no Escape handler, no focus restore, no dialog role, and no body scroll lock | Give the panel `role="dialog" aria-modal="true" id="mobile-nav"`, add `aria-controls="mobile-nav"` to the hamburger, trap Tab inside the panel, move focus to the close button on open and back to the hamburger on close, bind Escape, and call `lenis.stop()` / se |
| 76 | 🟠 عالي | correctness | `src/components/layout/Layout.tsx:19` | Lenis hijacks the wheel globally, so the AI chat transcript and the mobile nav drawer cannot be scrolled with a mouse | Add `data-lenis-prevent` to `.ai-chat-body` and `.mobile-nav-links` (and any other overflow container), or pass `allowNestedScroll: true` to the Lenis constructor. Also import 'lenis/dist/lenis.css', which is currently never imported anywhere in src. |
| 77 | 🟠 عالي | correctness | `src/components/layout/Layout.tsx:48` | Scroll is reset to top three times per navigation, including on Back/Forward, destroying scroll restoration | Delete ScrollToTop and the redundant window.scrollTo; keep one reset in Layout, guard it with `if (navigationType !== 'POP')`, and restore the saved offset on POP. |
| 78 | 🟠 عالي | a11y | `src/components/layout/MobileBottomNav.css:77` | Active mobile tab label is 11px green-500 at 2.35:1 — the primary mobile wayfinding cue is unreadable | Use --green-700 #028263 (4.86:1 on white) for the active label, and add a 2px top indicator bar so the state is not conveyed by color alone (WCAG 1.4.1). |
| 79 | 🟠 عالي | design-system | `src/components/ProgramCards/ProgramCards.css:17` | `.pc-card { overflow: hidden }` clips BorderGlow's outer `.edge-light`, so the entire glow effect is invisible in dark mode | Give the glow variant its own rule `.pc-card.pc-card-glow { overflow: visible; }` (specificity 0,2,0) rather than relying on cascade order, and stop applying `.pc-card` to the BorderGlow root. |
| 80 | 🟠 عالي | backend-integration | `src/components/ProgramCards/ProgramCards.tsx:35` | Two divergent, undocumented icon-name maps resolve the same backend `Program.icon` string to different icons | Export a single `PROGRAM_ICONS` map from one module, narrow `Program.icon` to a union of its keys, and `console.warn` on an unmapped value so bad data is visible. Document the allowed set in the API contract. |
| 81 | 🟠 عالي | correctness | `src/components/ui/AnalyticsChart.css:228` | @keyframes fadeIn is defined twice with different content; the full-screen palette overlay consumes it without defining it | Move all shared keyframes (fadeIn, scaleIn, shimmer, spin) into global.css and delete the per-page copies; namespace anything genuinely page-specific. Remove the duplicate programs-shimmer at Programs.css:797. |
| 82 | 🟠 عالي | backend-integration | `src/components/ui/AnalyticsChart.tsx:46` | No runtime guard on the `data` prop — a null/undefined/enveloped API response crashes the whole page | `const points = Array.isArray(data) ? data : [];` at the top, and render an empty/loading state when `points.length === 0`. |
| 83 | 🟠 عالي | a11y | `src/components/ui/AnalyticsChart.tsx:91` | Chart SVGs have no role, no accessible name, no text alternative — completely invisible to screen readers | Add `role="img"` + `aria-label` summarising the series to each SVG, render a `.sr-only` <table> of label/value pairs as the text alternative, and make the dots/segments focusable (`tabIndex={0}` + onFocus/onBlur mirroring the hover handlers). |
| 84 | 🟠 عالي | correctness | `src/components/ui/AnalyticsChart.tsx:97` | Hardcoded, non-unique SVG gradient IDs collide when two line charts are on one page | Generate a per-instance id with React 18's `useId()` (e.g. `const uid = useId()`) and use `id={`chartGradient-${uid}`}` / `url(#chartGradient-${uid})`. |
| 85 | 🟠 عالي | i18n-rtl | `src/components/ui/AnalyticsChart.tsx:158` | In Arabic the line chart's x-axis labels reverse but the plotted SVG does not — every label points at the wrong data point | Either add `direction: ltr` to `.chart-x-axis` (charts conventionally stay LTR), or reverse the SVG x-computation when `language === "ar"`. Pick one and be consistent for line vs bar (the bar chart flips correctly because each label lives inside its own column |
| 86 | 🟠 عالي | dead-code | `src/components/ui/QuickAccessMenu.tsx:7` | QuickAccessMenu (78 TSX + 106 CSS lines) is never imported, yet is documented as a project component | Delete QuickAccessMenu.tsx + QuickAccessMenu.css and remove the entry from .EG-MCP/context.md, or actually mount it in Header.tsx. |
| 87 | 🟠 عالي | dead-code | `src/components/ui/QuickAccessMenu.tsx:37` | The /dashboard route has no entry point anywhere in the shipped app — its only link lives in a component that is never imported | Either mount `<QuickAccessMenu />` in Layout.tsx (it is a sibling of the already-mounted QuickCommandPalette), or add a Dashboard entry to Header.tsx's `navItems` (line 29-36) gated on auth state, or delete QuickAccessMenu.tsx/.css. |
| 88 | 🟠 عالي | missing-feature | `src/components/ui/QuickCommandPalette.css:1` | The palette trigger button is fully styled (including a mobile variant) but never rendered — no touch device can open the palette | Render the trigger button (`<button className="palette-trigger-btn" onClick={() => setIsOpen(true)} aria-label=... aria-haspopup="dialog">`) or delete lines 1-45 and 183-198 of the CSS. |
| 89 | 🟠 عالي | design-system | `src/components/ui/QuickCommandPalette.css:183` | Breakpoint mismatch (640 vs 768) makes the command-palette trigger cover the mobile bottom nav between 641px and 768px | Change QuickCommandPalette.css:183 to `@media (max-width: 768px)`, and define the breakpoints once in a shared comment block / custom media set so the nav, chat bubble and palette can never drift apart again. |
| 90 | 🟠 عالي | i18n | `src/components/ui/QuickCommandPalette.tsx:95` | Language command has identical titleEn and titleAr, so the English UI shows Arabic text and the command is unsearchable in English | Set titleEn to "Switch to Arabic"/"Switch to English" and titleAr to "التغيير للغة العربية"/"التغيير للإنجليزية" independently, and add a `keywords: string[]` field so both languages' terms are searchable in either mode. |
| 91 | 🟠 عالي | a11y | `src/components/ui/QuickCommandPalette.tsx:117` | Modal overlay has no role=dialog / aria-modal, no focus trap, no focus restore, and no body scroll lock | Add role/aria-modal/aria-label to `.palette-modal`, trap Tab within it, store `document.activeElement` on open and `.focus()` it on close, and lock body scroll for the open duration in a useEffect cleanup. |
| 92 | 🟠 عالي | a11y | `src/components/ui/QuickCommandPalette.tsx:139` | Command palette items are click-only divs — a keyboard-opened palette cannot be operated by keyboard | Add an `activeIndex` state, handle ArrowUp/ArrowDown/Enter/Home/End on the input, render items as `<button type="button" role="option" aria-selected>` inside `role="listbox"`, and wire `aria-activedescendant` on the input. |
| 93 | 🟠 عالي | i18n | `src/context/LanguageContext.tsx:11` | 464 inline `language === "ar" ? ... : ...` ternaries bypass the 45-key translation layer | Move every string into the translations map (or a real i18n lib with namespaces + interpolation + plurals) and replace the ternaries with t() calls before the backend lands. At minimum, freeze the pattern now and require all new strings go through t(). |
| 94 | 🟠 عالي | correctness | `src/context/ThemeContext.tsx:14` | Unguarded localStorage reads/writes in a render-phase initializer white-screen the whole app | Wrap every localStorage access in try/catch behind a `safeStorage` helper that returns null / no-ops on failure, and add an ErrorBoundary above ThemeProvider. |
| 95 | 🟠 عالي | i18n | `src/pages/About/About.tsx:82` | About hardcodes Vision/Mission/Values, and its Arabic text diverges from the same three cards on Home, which read the translation layer | Delete the inline strings and use `t("visionText")` / `t("missionText")` / `t("valuesText")` on About, plus new keys for the headings. All 14 other hardcoded ternaries on About (lines 41-46, 80, 106, 132, 146-147, 167-171, 182) should move into LanguageContext |
| 96 | 🟠 عالي | design-system | `src/pages/Admin/admin.css:9` | admin.css declares a second global :root token set (--admin-*) that duplicates and slightly contradicts variables.css, and has zero dark-mode support | Scope the tokens to `.admin-shell { ... }` instead of `:root`, derive them from the base tokens (`--admin-surface: var(--surface)`), and add a `[data-theme="dark"] .admin-shell` block — or hide the theme toggle inside /admin so the mismatch is at least honest. |
| 97 | 🟠 عالي | forms | `src/pages/Admin/AdminContent.tsx:247` | handleSubmit discards the boolean returned by every create/update action and always closes and clears the form, so a rejected save looks identical to a successful one | Capture the boolean, only resetForm() on true, and render store.error (or a returned message) in the form on false. |
| 98 | 🟠 عالي | i18n-rtl | `src/pages/Admin/AdminContent.tsx:344` | Events form renders Category (English) but no Category (Arabic) input, breaking the bilingual pair | Add the categoryAr input to complete the row (the layout already has a free grid cell). |
| 99 | 🟠 عالي | missing-feature | `src/pages/Admin/AdminContent.tsx:378` | Four CMS entities have a required image field but there is no upload endpoint, no multipart contract, and no doc mentions image hosting at all | Add a decision to the contract: either 'images are external HTTPS URLs, backend validates scheme+host and stores the string' (and say so explicitly), or specify POST /api/upload with multipart/form-data, max size, allowed MIME types, and the returned URL shape |
| 100 | 🟠 عالي | missing-feature | `src/pages/Admin/AdminContent.tsx:415` | Initiatives form omits categoryEn/Ar, targetEn/Ar and status although they are required and held in state | Add the four bilingual inputs and a status <select>, or derive status from progress and remove it from the payload. |
| 101 | 🟠 عالي | i18n-rtl | `src/pages/Admin/AdminContent.tsx:500` | Opportunities form writes the English location text into locationAr, and has no description inputs at all | Split into two location inputs and add the two description textareas. |
| 102 | 🟠 عالي | missing-feature | `src/pages/Admin/AdminContent.tsx:507` | Team form has no image input, so every CMS-created member gets image:"" and renders a broken avatar | Add an image URL input for team, and either implement a real upload endpoint + file input or document explicitly that images are externally hosted URLs only. |
| 103 | 🟠 عالي | backend-integration | `src/pages/Admin/AdminDashboardHome.tsx:86` | 100% of AnalyticsChart data is hardcoded literals at every call site — the dashboards are fake | Add a `getAnalyticsTimeseries()` method to the API layer and the CMS store, define the response DTO (e.g. `{ points: [{ labelEn, labelAr, value }] }`), and delete the literal arrays. If they must stay for now, label them in the UI as placeholder, not just in a |
| 104 | 🟠 عالي | react | `src/pages/Admin/AdminLayout.tsx:37` | initializeAuth runs in useEffect but the auth guard runs during render, so an authenticated admin sees the login card on every page load | Read localStorage in the store's initial state (lazy initializer) so the very first render is already correct, and keep initializeAuth only for attaching the auth_unauthorized listener. |
| 105 | 🟠 عالي | correctness | `src/pages/Admin/AdminLayout.tsx:78` | The Messages sidebar badge is the literal 2, not the unread count | Derive from useCMSStore: messages.filter(m => !m.isRead).length, and load messages at layout level so the count exists before the Messages tab is opened. |
| 106 | 🟠 عالي | security | `src/pages/Admin/AdminMessages.tsx:67` | CSV export truncates at the first # character and re-emits untrusted contact-form text as spreadsheet formulas | Build a Blob + URL.createObjectURL instead of a data: URI, and prefix any cell starting with = + - @ or tab with a single quote. |
| 107 | 🟠 عالي | state | `src/pages/Admin/AdminSettings.tsx:10` | Settings are write-only: no GET endpoint exists, the zustand store is not persisted, and local state is seeded once | Add GET /api/admin/settings to the contract and api.ts, load it in a useEffect, and sync the local form state from the store when it changes. |
| 108 | 🟠 عالي | forms | `src/pages/Admin/AdminSettings.tsx:19` | Settings save has no else branch: a false return produces no feedback at all, and neither form disables while submitting | Add an else branch with an inline role=alert error, and disable both submit buttons while the promise is pending. |
| 109 | 🟠 عالي | missing-feature | `src/pages/Admin/AdminSettings.tsx:99` | Maintenance Mode toggle promises visitors will see a maintenance page; nothing in the app reads the flag | Either implement a maintenance gate in App.tsx driven by a public GET /api/settings, or remove the toggle and its promise text. |
| 110 | 🟠 عالي | forms | `src/pages/Contact/Contact.tsx:37` | Both Contact forms hang permanently in the loading state when the API returns success:false | Add "error" to both unions, add an else branch and a catch branch that set it, and render a role="alert" message with the server's `message`/`errors`. |
| 111 | 🟠 عالي | forms | `src/pages/Contact/Contact.tsx:281` | Meeting booking accepts past dates and sends a naive date+time with no timezone | Set min to today's ISO date, constrain time to business hours, block past datetimes client-side, and add `timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` to the DTO and to docs/API_CONTRACT.md §2.2. Re-validate everything server-side. |
| 112 | 🟠 عالي | design-system | `src/pages/Dashboard/Dashboard.tsx:80` | Loading state renders two unstyled empty divs — the spinner CSS lives only in Home.css, which is not loaded on /dashboard or /learning-hub | Move `.home-loader-container` and `.spinner` into src/styles/global.css and add `role="status"` plus an aria-label so the wait is announced. |
| 113 | 🟠 عالي | missing-feature | `src/pages/Dashboard/Dashboard.tsx:87` | The user's "personal climate impact trajectory" chart is hardcoded fiction with no endpoint behind it | Add `GET /api/user/analytics?year=` to api.ts and the contract, fetch the series, and render a proper empty state when there is no history. Until then, do not label mock data as the user's personal trajectory. |
| 114 | 🟠 عالي | backend-integration | `src/pages/Dashboard/Dashboard.tsx:298` | "Cancel registration" only mutates local zustand state — no API call, no confirmation, and no DELETE endpoint exists in api.ts or the contract | Add `DELETE /api/user/events/<id>` (or POST /api/events/<id>/cancel) to api.ts and API_CONTRACT.md, call it from cancelEventRegistration, add a confirm step, disable the button while in flight, and revert the optimistic removal on failure. |
| 115 | 🟠 عالي | forms | `src/pages/Dashboard/Dashboard.tsx:317` | Profile edit form: no labels bound to inputs, no validation, no maxLength, no name/autocomplete, no disabled-while-submitting, and total silence on failure | Add id/htmlFor pairs, name and autoComplete attributes, required + maxLength, trim and validate before submit, disable the button while `loading`, and render an inline error (role="alert") on the false/error branch instead of alert(). |
| 116 | 🟠 عالي | state | `src/pages/Events/Events.tsx:221` | Event registration written to a non-persisted store is wiped by the next profile load | Do not maintain client-side registration state at all: after a successful POST, refetch /api/user/profile (or the events list) so the server is the single source of truth. If optimistic UI is wanted, merge instead of overwrite in loadUserProfile. |
| 117 | 🟠 عالي | forms | `src/pages/Events/Events.tsx:239` | registrationStatus === "error" has no UI — failures are completely silent | Add an error block inside the modal body with role="alert"/aria-live="assertive" rendering `response.message \|\| response.error`, and keep the form values so the user can retry. |
| 118 | 🟠 عالي | backend-integration | `src/pages/Events/Events.tsx:256` | Day number is extracted with a string split, so any non-"YYYY-MM-DD" date serialization renders blank | Parse once into a Date defensively (`new Date(date)`, guard `isNaN`) and format day and month from the same object; render a fallback dash when the value is unparseable. |
| 119 | 🟠 عالي | correctness | `src/pages/Events/Events.tsx:446` | The grid renders past events, unsorted, with an active Register button | Split into Upcoming / Past sections (or filter past out), sort ascending by date, and disable/replace the CTA for events whose date < today. Server-side, support ?upcoming=true ordering. |
| 120 | 🟠 عالي | missing-feature | `src/pages/Events/Events.tsx:616` | Ticket code is invented client-side, is identical for every attendee, and the "QR code" is a decorative SVG | Have POST /api/events/register return `{ registrationId, ticketCode, qrPayload }` (add it to docs/API_CONTRACT.md §2.6), render the returned code, and generate the QR from that payload with a real encoder — or remove the QR block and say "a confirmation email  |
| 121 | 🟠 عالي | react | `src/pages/GamesHub/GamesHub.tsx:168` | GamesHub reads useAuthStore.getState() inside JSX instead of subscribing, so the garden never updates after planting, and the `\|\| 120` fallback contradicts the plant button | Subscribe with `const stats = useAuthStore((s) => s.stats)` and render a real empty/logged-out state instead of `?? 3` / `?? 120` placeholder numbers. |
| 122 | 🟠 عالي | state | `src/pages/GamesHub/GamesHub.tsx:173` | Garden shows fabricated "120 points / 3 trees" when stats is null, then refuses to plant with a contradictory "insufficient balance" alert | Call loadUserProfile (or a dedicated stats loader) on mount, render a real loading/empty state when stats is null, disable the Plant button when stats is null or ecoPoints < 40, and use `?? ` instead of `\|\|`. |
| 123 | 🟠 عالي | backend-integration | `src/pages/GamesHub/GamesHub.tsx:203` | The two game cards are hardcoded JSX; apiService.getGames() is never called by any component and Game.playUrl points at routes that do not exist | Either render the hub from getGames() and register real /games/:slug routes, or delete the Game type, mockGames, GET /api/games and the playUrl field from the contract so the backend dev does not build dead endpoints. |
| 124 | 🟠 عالي | correctness | `src/pages/Home/Home.css:17` | `.spinner` animates `spin`, but `@keyframes spin` is defined only in Events.css — the spinner never rotates until the user has visited /events | Move `@keyframes spin` from `src/pages/Events/Events.css:1054` to `src/styles/global.css`. |
| 125 | 🟠 عالي | design-system | `src/pages/Home/Home.css:17` | `animation: spin` references a keyframe defined only in Events.css, so the Home loader is a frozen ring; App.tsx's global RouteLoader is unstyled entirely on any non-Home entry | Move `@keyframes spin`, `.spinner` and `.home-loader-container` into src/styles/global.css (which is imported eagerly) and delete the duplicates from Home.css and Events.css. |
| 126 | 🟠 عالي | react | `src/pages/Home/Home.tsx:32` | The hero-video useEffect never executes its body — the ref is always null because the loading gate returns before <video> mounts | Change the deps to `[loading]`, or move the play logic into an `onLoadedMetadata` handler on the <video> element. |
| 127 | 🟠 عالي | missing-feature | `src/pages/Home/Home.tsx:81` | Two requirements the technical report marks Critical are absent from the homepage, leaving dead CSS and dead translation keys behind | Either build the section and add a documented `GET /api/stats` returning `{countries, youthEngaged, campaigns, treesPlanted}`, or delete the dead CSS/keys and strike FR-H-02 and FR-H-04 from the report. Do not leave both halves half-done. |
| 128 | 🟠 عالي | performance | `src/pages/Home/Home.tsx:88` | Inline colorStops array literal makes Aurora tear down and recreate its WebGL renderer, program and mesh on every single Home re-render | Hoist the array to a module-level `const AURORA_STOPS = [...]` outside the component (same for `colors` on the three BorderGlow instances at lines 172, 192, 212). |
| 129 | 🟠 عالي | performance | `src/pages/Home/Home.tsx:99` | A 56 MB uncompressed MP4 autoplays on the homepage, with a hotlinked Unsplash poster and a typo in its filename | Transcode to ~2-4 MB H.264 720p + a WebM/AV1 alternate; add a local `poster` image; wrap the `<video>` in a `matchMedia('(prefers-reduced-motion: reduce)')` and a `(max-width: 768px)` guard so mobile gets the poster only. Rename `Climatify-Campign-.mp4` to `cl |
| 130 | 🟠 عالي | performance | `src/pages/Home/Home.tsx:108` | 57 MB autoplaying looping hero video with no reduced-motion path, no pause control, no captions/track, no alternate <source>, and an external Unsplash poster | Re-encode to <5 MB (720p, ~10 s loop, H.264 + WebM sources), self-host the poster as a local webp, add `aria-hidden="true"`, gate playback behind `window.matchMedia('(prefers-reduced-motion: reduce)')`, and add a visible pause toggle. Also fix the filename typ |
| 131 | 🟠 عالي | design-system | `src/pages/Home/Home.tsx:236` | `.section-header-alignment` is applied to two homepage section headers but is defined in no stylesheet, so those headers are start-aligned while the third is centred | Add `.section-header-alignment { text-align: center; } .section-header-alignment .section-lead { margin-inline: auto; }` to global.css, or replace the class with `text-center mx-auto`. |
| 132 | 🟠 عالي | correctness | `src/pages/LearningHub/LearningHub.tsx:45` | Course progress is hardcoded to 3 lessons while the course advertises 12; a "12-lesson" course completes in two clicks | Drive the syllabus from a real `lessons` array on the Course DTO (add it to types, mockData and API_CONTRACT), compute progress against `course.lessonsCount`, and stop marking lesson 1 completed by default. |
| 133 | 🟠 عالي | backend-integration | `src/pages/Media/Media.tsx:20` | Media swallows fetch errors, has no empty state, and white-screens if the response is not an array | Add error and empty states; validate the payload (`Array.isArray(data) ? data : data?.data ?? []`) before setState; and settle the envelope question in one place in the contract. |
| 134 | 🟠 عالي | design-system | `src/pages/Media/Media.tsx:31` | Media and PostDetail loading states use CSS classes that only ship in the Home chunk — the loader is invisible | Move .home-loader-container/.spinner/@keyframes spin into src/styles/global.css (or a shared Spinner component) so they are in the eagerly-loaded stylesheet. |
| 135 | 🟠 عالي | backend-integration | `src/pages/Media/PostDetail.tsx:19` | A 404 from GET /api/posts/<id> falls back to mock data, so deleted posts still render as live articles | Distinguish 404 (render not-found) from other failures (render an error state with retry); drop the mock fallback for GET-by-id when USE_MOCK_API is false. |
| 136 | 🟠 عالي | missing-feature | `src/pages/Media/PostDetail.tsx:115` | Article body is rendered as plain text and the Admin CMS has no field to write it | Decide the content format in the contract. If Markdown, render with a Markdown component; if HTML, sanitize server-side (bleach) AND client-side before dangerouslySetInnerHTML. Either way add content/category/author fields to the admin editor. |
| 137 | 🟠 عالي | backend-integration | `src/pages/Opportunities/Opportunities.tsx:38` | Data-load failure is only console.error'd — the page renders as if the API returned empty, and the catch is unreachable anyway | Add an `error` state with a retry action, and abort the requests in the effect cleanup. |
| 138 | 🟠 عالي | backend-integration | `src/pages/Opportunities/Opportunities.tsx:79` | Type filter calls .toLowerCase()/.includes() on server fields with no null guard; the Arabic half of the condition is dead code | Filter on an exact, canonical `type` code sent by the API (e.g. `opp.type === filterType`) rather than substring-matching localized display strings, and add optional chaining. |
| 139 | 🟠 عالي | i18n-rtl | `src/pages/Opportunities/Opportunities.tsx:135` | Arabic demand badge always says "مطلوب جداً" (very high demand) regardless of the actual demand value, and leaks the raw English enum | Map demand -> localized label: {High:'مطلوب', Medium:'مطلوب بشكل متوسط', Urgent:'مطلوب بشكل عاجل'} with an English counterpart, and never interpolate the raw enum. |
| 140 | 🟠 عالي | backend-integration | `src/pages/Opportunities/Opportunities.tsx:165` | Unguarded .map on skillsAr/skillsEn crashes the whole page if the server omits either array | Guard with `?? []` and add a null-safe render; and correct the summary table to list all nine CareerNode fields. |
| 141 | 🟠 عالي | missing-feature | `src/pages/Opportunities/Opportunities.tsx:225` | No empty state: the "Jobs" filter renders a completely blank area with today's data | Render an explicit empty state when filteredOpportunities.length === 0 (and a separate one when opportunities.length === 0 after load). |
| 142 | 🟠 عالي | a11y | `src/pages/Opportunities/Opportunities.tsx:264` | Apply modal has no dialog role, no focus trap, no Escape handler, no focus restore and no body scroll lock | Port the Events.tsx modal effect verbatim: role="dialog" aria-modal="true" aria-labelledby, keydown Escape + Tab trap, scroll lock, focus restore, and data-lenis-prevent on the scrollable card. |
| 143 | 🟠 عالي | a11y | `src/pages/Opportunities/Opportunities.tsx:287` | All four application inputs have bare <label> with no htmlFor and no id/name/autocomplete | Add id/htmlFor pairs plus name="name\|email\|portfolio\|coverLetter" and autocomplete="name\|email\|url" to Opportunities.tsx:288-326. |
| 144 | 🟠 عالي | forms | `src/pages/Opportunities/Opportunities.tsx:329` | Application submit button is never disabled while submitting | Track submitting state and set disabled + a "جاري الإرسال…" label. |
| 145 | 🟠 عالي | missing-feature | `src/pages/Portals/Portals.tsx:108` | "Download Kit (PDF)" button downloads nothing — it is a setTimeout that fakes success | Either wire the button to the endpoint (fetch blob + createObjectURL, or window.open) or replace it with an honest "coming soon" state; keep the docs consistent either way. |
| 146 | 🟠 عالي | i18n | `src/pages/Programs/Programs.tsx:464` | Modal falls back to hardcoded UAE marketing copy for any program the backend returns without a longDescription | Render nothing (or a neutral "Details coming soon" string from the translation layer) when longDescription is absent, and mark the field required in API_CONTRACT.md if the modal depends on it. |
| 147 | 🟠 عالي | security | `src/services/api.ts:33` | sanitizeUrl is case-sensitive, misses control-character-obfuscated schemes, and is never applied where URLs actually reach the DOM | Lowercase and strip \s\x00-\x20 before the scheme check; allow only http:, https:, mailto:, relative paths, and data:image/*. Apply it in a shared <SafeImage>/<SafeLink> wrapper at every render site, or sanitize once at the api.ts boundary so all data — mock o |
| 148 | 🟠 عالي | backend-integration | `src/services/api.ts:40` | authFetch reads a `user_token` that no code in the repo ever writes; there is no member login flow at all, yet /dashboard calls authenticated endpoints | Either build the member auth flow (POST /api/auth/register + /api/auth/login writing user_token) or delete the member Dashboard/user endpoints from the surface. Until then remove `user_token` from authFetch so the contract stops implying a flow that does not e |
| 149 | 🟠 عالي | backend-integration | `src/services/api.ts:41` | authFetch attaches Authorization and Content-Type to every request including public GETs; no doc mentions this and the documented CORS config does not account for the resulting preflights | Document that Authorization is sent on ALL requests and that endpoints must tolerate (and ignore) a token on public routes; standardise the CORS snippet across both docs to include allow_headers=['Content-Type','Authorization'] and methods GET/POST/PUT/DELETE/ |
| 150 | 🟠 عالي | backend-integration | `src/services/api.ts:42` | authFetch sets Content-Type: application/json on GET and DELETE requests that have no body, forcing a CORS preflight on every single request | Only set Content-Type when there is a body: `if (options.body) headers['Content-Type'] = 'application/json'`. Document that OPTIONS must be allowed for /api/* and that Authorization is an allowed header. |
| 151 | 🟠 عالي | backend-integration | `src/services/api.ts:49` | authFetch has no AbortSignal and no timeout, so a hung server produces an infinite spinner and the mock fallback never fires | Add `AbortSignal.timeout(15000)` (or an AbortController composed with a caller-supplied signal) inside authFetch, expose an optional `signal` in every apiService method, and have effects abort on cleanup. |
| 152 | 🟠 عالي | correctness | `src/services/api.ts:54` | The global 401 side-effect in authFetch also fires for the /admin/login request itself, logging out a signed-in admin who mistypes a password | Add an opt-out (`authFetch(endpoint, options, { skipAuthRedirect: true })`) used by loginAdmin, or check `!endpoint.includes('/login')` before the 401 side-effect. Register the auth_unauthorized listener once in a React effect with a proper removeEventListener |
| 153 | 🟠 عالي | backend-integration | `src/services/api.ts:181` | getBlogPostById falls back to a mockBlogPosts lookup on 404, resurrecting posts the backend has deleted | Never do an id lookup against mock data for a by-id fetch. Throw on non-2xx and let PostDetail distinguish 404 (not-found UI) from 5xx/network (retry UI). |
| 154 | 🟠 عالي | docs-mismatch | `src/services/api.ts:241` | submitWorkshopRequest posts to /api/workshops; the contract §2.4 and Portals.tsx's own inline instruction both say /api/education-workshops | Rename the call to /education-workshops (two doc sources and the in-file comment agree) or fix all three docs. |
| 155 | 🟠 عالي | docs-mismatch | `src/services/api.ts:277` | saveCarbonFootprint posts to /api/carbon-footprint but contract §4.3 documents POST /api/user/carbon-footprint | Use /user/carbon-footprint. Also stop granting points on a response the client cannot verify — read the authoritative point total back from the server. |
| 156 | 🟠 عالي | backend-integration | `src/services/api.ts:299` | getUserProfile's fallback returns a fixed Arabic persona with no bilingual fields, so every unauthenticated or errored dashboard shows the same fake Arabic user to English visitors | Add nameEn/nameAr (or accept that user-entered names are language-neutral and drop the Arabic-only sample). Make the dashboard require a real session and render an unauthenticated state instead of a fabricated profile. |
| 157 | 🟠 عالي | docs-mismatch | `src/services/api.ts:442` | markMessageRead calls PUT /api/admin/messages/<id>/read; contract §5.4 (flagged '⚠️ مهم جداً') documents PUT /api/admin/messages/<id> | Drop the /read suffix, or document the sub-resource. Note the frontend never sends isRead:false (useCMSStore.ts:410 calls markMessageRead(id) with the default), so the toggle capability in the signature is unreachable. |
| 158 | 🟠 عالي | correctness | `src/services/api.ts:509` | update* mock fallbacks return `{id, ...Partial<T>} as T`, and the store replaces the whole record with it — silently blanking fields and zeroing registeredCount | In the mock, merge over the existing record rather than fabricating one, and in useCMSStore use `{...e, ...updated}` instead of a replace so a partial server response cannot blank fields. Put `id` last in the spread. |
| 159 | 🟠 عالي | docs-mismatch | `src/services/api.ts:755` | getCarbonQuestions calls /api/carbon-questions; contract §1.11 documents GET /api/games/carbon-questions | Align the path. Both spellings appear nowhere else, so pick /games/carbon-questions per the contract. |
| 160 | 🟠 عالي | backend-integration | `src/services/api.ts:779` | sendAIChatMessage sends {prompt, language}; contract §2.9 documents {message, language} | Rename the field to `message` (or fix §2.9). The keyword-matcher fallback should also be gated behind USE_MOCK_API — a canned reply presented as an AI answer is user-facing misinformation. |
| 161 | 🟠 عالي | backend-integration | `src/store/useAuthStore.ts:95` | loadUserProfile trusts the response shape with zero validation — a {success,data} envelope produces a permanent spinner, a missing array produces an uncaught TypeError | Validate/normalise the payload in loadUserProfile (default arrays to [], reject and set state.error if stats is missing), and decide one envelope convention across api.ts and the docs. |
| 162 | 🟠 عالي | correctness | `src/store/useAuthStore.ts:148` | saveCarbonFootprint returns true even when no points were awarded, and can be clicked repeatedly for +50 each time | Return true only when the credit was applied, disable the button after one successful save (or make the server idempotent per result), and use `finalFootprint === null` for the guard. |
| 163 | 🟠 عالي | correctness | `src/store/useAuthStore.ts:204` | updateCourseProgress awards points and a badge on every call with no idempotency, and LearningHub's completion guard lives in component-local state that resets on remount — badges and points are farmable in a loop | Award points server-side, or in the store compare against the existing course's progress: only award the completion bonus/badge when the stored progress is < 100 and the new progress is 100, and clamp progress to a monotonic max. |
| 164 | 🟠 عالي | state | `src/store/useCMSStore.ts:21` | `loading` and `error` exist in both stores, are written by 12 actions, and are read by zero components — every failure is invisible | Set state.error with the server's message in every catch and in every non-ok branch, add per-action loading keys, and render both in the admin pages. |
| 165 | 🟠 عالي | backend-integration | `src/store/useCMSStore.ts:152` | createX/updateX push the raw API response object into the list with no shape check — an envelope or a bare {success} response corrupts the table and breaks subsequent edit/delete | Unwrap and validate in api.ts (single place), and in the store assert `created?.id` before inserting; otherwise re-fetch the collection. |
| 166 | 🟠 عالي | backend-integration | `src/store/useCMSStore.ts:174` | Delete and markRead actions require a literal `success:true` key in the response body; a 204 or any other success shape makes a completed server-side delete look failed | Key success off the HTTP status (res.ok) surfaced from api.ts, not off a body field, and document one delete response shape in API_CONTRACT.md. |
| 167 | 🟠 عالي | backend-integration | `src/store/useCMSStore.ts:410` | markMessageRead drops the isRead argument the API supports, and the URL contradicts API_CONTRACT.md | Align the URL with the contract, thread isRead through the store, and add an unread toggle in the detail pane. |
| 168 | 🟠 عالي | i18n-rtl | `src/styles/global.css:83` | Negative and positive letter-spacing applied to Arabic headings/eyebrows with no [dir="rtl"] reset — breaks cursive joining | Add to global.css: `[dir="rtl"] h1, [dir="rtl"] h2, [dir="rtl"] h3, [dir="rtl"] h4, [dir="rtl"] .eyebrow { letter-spacing: normal; }`. Keep `text-transform: uppercase` (harmless no-op on Arabic) but note it signals the eyebrow was designed English-first. |
| 169 | 🟠 عالي | i18n-rtl | `src/styles/global.css:84` | line-height 1.1 on h1–h4 clips Arabic descenders in the default language | `[dir="rtl"] h1, [dir="rtl"] h2, [dir="rtl"] h3, [dir="rtl"] h4 { line-height: 1.35; }` — or raise the global value to 1.25 and accept slightly looser Latin. |
| 170 | 🟠 عالي | a11y | `src/styles/global.css:220` | prefers-reduced-motion exists in only 2 of 30 stylesheets; every global animation is unguarded | Add a single global block: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }` and dele |
| 171 | 🟠 عالي | a11y | `src/styles/global.css:277` | Primary button: white on brand gradient is 2.35:1 / 3.01:1 — fails WCAG AA (needs 4.5:1) | Darken the gradient for text-bearing surfaces: `linear-gradient(135deg, #00795C 0%, #0062A0 100%)` gives ≈5.0:1 and ≈5.3:1 with white. Add a `--gradient-brand-accessible` token and use it for .btn-primary, .empty-state-action, .chat-send-btn and ::selection; k |
| 172 | 🟠 عالي | dead-code | `src/styles/global.css:293` | .btn-glass:hover sets the identical background as its base rule — hover state is a no-op | Change the hover to `rgba(255,255,255,0.34)`, and add `text-shadow: 0 1px 3px rgba(0,0,0,.5)` plus a gradient scrim behind the hero copy so the glass button survives a bright video frame. |
| 173 | 🟠 عالي | a11y | `src/styles/global.css:385` | Eight `outline: none` declarations across the app with zero :focus-visible replacements in shipped code | Add a global `:focus-visible { outline: 2px solid var(--blue-600); outline-offset: 2px; }` in global.css before the component rules, and audit each of the eight sites to confirm the substitute ring meets 3:1 against its adjacent background. |
| 174 | 🟠 عالي | a11y | `src/styles/global.css:387` | Form focus ring uses --green-50 (#E9FBF5) — 1.07:1 against the white input background, effectively invisible | `box-shadow: 0 0 0 3px color-mix(in srgb, var(--green-600) 45%, transparent);` and add a [data-theme="dark"] variant. Do not reuse a -50 tint as a ring color. |
| 175 | 🟠 عالي | a11y | `src/styles/variables.css:53` | --text-3 (#94A3B8) is 2.56:1 on white — a core body-text token that fails AA everywhere it is used | Change light --text-3 to #64748B (4.76:1 on white). Keeps the same slate hue, passes AA. |
| 176 | 🟠 عالي | backend-integration | `src/types/index.ts:224` | AuthResponse declares refreshToken and a user object the frontend never receives, and no document specifies JWT claims, expiry behaviour, refresh, or logout | Either delete AuthResponse/refreshToken from types/index.ts as dead, or implement and document /api/auth/refresh + /api/auth/logout. Document the required JWT claims (sub, role, exp), the expiry, and what the frontend does on expiry. |
| 177 | 🟠 عالي | correctness | `tsconfig.app.json:19` | `strict` is absent from tsconfig.app.json, so `tsc -b` exit 0 is near-worthless as a correctness signal | Add `"strict": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true`. Expect a large error count; fix incrementally, but do it before the backend lands or every server-shape divergence will be a runtime crash instead of a compile error. |
| 178 | 🟠 عالي | backend-integration | `vite.config.ts:6` | vite.config.ts is the bare template — no `server.proxy` for /api, so the entire CORS burden is pushed onto the Flask dev for no reason | Add `server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true } } }` and set `VITE_API_BASE_URL=/api` in .env for dev. This removes cross-origin entirely in development, makes cookies/`SameSite` work, and l |
| 179 | 🟡 متوسط | dead-code | `.env:3` | VITE_APP_TITLE is defined in .env and .env.example but read nowhere; the page title is a hardcoded lowercase 'climatify' | Either delete the variable from .env and .env.example, or use it: add `%VITE_APP_TITLE%` to index.html's `<title>` (Vite substitutes `%ENV_VAR%` in index.html at build time). Also add a per-route `document.title` update so the title is not identical on all 12  |
| 180 | 🟡 متوسط | a11y | `.oxlintrc.json:3` | The linter runs without the jsx-a11y plugin and without exhaustive-deps — the two rule sets that would have caught most of this codebase's defects | Add `"jsx-a11y"` and `"react-perf"` to plugins, enable `"react-hooks/exhaustive-deps": "warn"` and `"jsx-a11y/alt-text"`, `"jsx-a11y/label-has-associated-control"`, `"jsx-a11y/click-events-have-key-events"`, `"jsx-a11y/no-static-element-interactions"` as error |
| 181 | 🟡 متوسط | docs-mismatch | `docs/API_CONTRACT.md:213` | The contract says GET /api/team is unused and the team is hardcoded in About.tsx, but About.tsx calls apiService.getTeam() | Delete the note, and add borderColor/gradient (both optional per types/index.ts:114-115) to the §1.10 response example. |
| 182 | 🟡 متوسط | backend-integration | `docs/API_CONTRACT.md:590` | AdminStats requires the backend to return presentation-formatted, locale-baked strings like "4,520" instead of numbers | Change AdminStats to numbers in types/index.ts and the contract, and format with Intl.NumberFormat(language) in AdminDashboardHome. If the strings must stay, state the exact locale and grouping rule the backend must apply. |
| 183 | 🟡 متوسط | docs-mismatch | `docs/API_CONTRACT.md:887` | The summary table claims '49 endpoints, 100% coverage' while omitting four endpoints documented in its own body | Regenerate the table from api.ts (53 endpoints), drop the coverage claim, and mark the three endpoints that have no call site (GET /api/games, GET /api/programs/<id>, GET /api/curricula/download) as not-yet-consumed. |
| 184 | 🟡 متوسط | i18n-rtl | `docs/API_CONTRACT.md:898` | The hard requirement that every content object carries BOTH *Ar and *En is stated as a soft note, and success/error messages are Arabic-only with no bilingual contract | Promote 8.2 to a normative rule ('POST/PUT MUST 400 if either language variant of a bilingual field is empty'), and define the message contract as either `{ success, code, messageEn, messageAr }` with the client choosing, or client-side i18n keyed on `code` wi |
| 185 | 🟡 متوسط | docs-mismatch | `docs/API_CONTRACT.md:910` | Contract section 8.4 declares every non-Initiative field required, contradicting four optional fields in the TypeScript types | Rewrite section 8.4 as a per-field required/optional table generated from types/index.ts, and add borderColor/gradient to the /api/team response schema at API_CONTRACT.md:226-238. |
| 186 | 🟡 متوسط | docs-mismatch | `docs/BACKEND_DEVELOPER_GUIDE.md:507` | The guide's flagship contact-form example cannot run: the schema fields do not match the model columns and ValidationError is never imported | Fix the example and, critically, document the transform explicitly: `sender = f"{firstName} {lastName}"`, `date = date.today()`, `isRead = false` on insert. |
| 187 | 🟡 متوسط | docs-mismatch | `docs/BACKEND_DEVELOPER_GUIDE.md:679` | Both guides link to documents that do not exist, and the README they cite is a single sentence | Remove the dead links, delete the 'old README' warnings at lines 211/685/780 (they add confusion, not clarity), and either write a real README with setup + env vars or delete the reference. |
| 188 | 🟡 متوسط | missing-feature | `index.html:7` | index.html has no description, no OG/Twitter tags, no theme-color, no robots.txt, no manifest, and no noscript fallback | Add `<meta name="description">`, `og:title/description/image/url/type`, `twitter:card`, `<meta name="theme-color" media="(prefers-color-scheme:dark)">` for both schemes, `<link rel="canonical">`, `<noscript>` with a translated message, and `<link rel="preconne |
| 189 | 🟡 متوسط | correctness | `package.json:23` | No `engines`, no `.nvmrc`, and no `packageManager` — the toolchain hard-requires Node >= 20.19 and will fail cryptically on anything older | Add `"engines": { "node": ">=20.19.0" }` and `"packageManager": "npm@10.x"` to package.json, commit a `.nvmrc` containing `20.19.0`, and state the requirement in README.md and BACKEND_DEVELOPER_GUIDE.md's Step 4. |
| 190 | 🟡 متوسط | docs-mismatch | `README.md:1` | README.md is a 27-byte stub, while two other documents advertise it as the backend developer guide | Write a real README: prerequisites (Node >= 20.19), `npm ci && npm run dev`, the port, the .env contract, the SPA history-fallback requirement for production, a route table, and links to docs/. Fix BACKEND_DEVELOPER_GUIDE.md:679 which points at the nonexistent |
| 191 | 🟡 متوسط | docs-mismatch | `Sitemap.txt:8` | Sitemap.txt (the project map handed to the backend dev) is wrong on at least seven counts, including pointing at a docs file that does not exist | Regenerate Sitemap.txt from the real tree, or delete it and rely on the docs/ folder. If kept, rename it (it is a directory listing, not a URL sitemap) and remove the stray unmatched ``` fence on line 67. |
| 192 | 🟡 متوسط | dead-code | `src/App.css:1` | Leftover Vite scaffold files are still in the repo, including the default Vite favicon being served as the site icon | Delete `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png` and `public/icons.svg`. Replace `public/favicon.svg` with the Climatify mark and add `apple-touch-icon.png` + `site.webmanifest`. |
| 193 | 🟡 متوسط | performance | `src/App.tsx:37` | The Suspense boundary sits above Layout, so an uncached lazy route blanks the entire shell to a spinner | Move the Suspense boundary inside Layout, wrapping only <Outlet/>, so the shell stays painted and only the content area shows the loader. |
| 194 | 🟡 متوسط | react | `src/components/Aurora/Aurora.tsx:122` | `propsRef.current = props` is a ref write during the render phase | Move the assignment into a `useEffect(() => { propsRef.current = props; })` with no dep array, which is the standard latest-props-ref pattern. |
| 195 | 🟡 متوسط | performance | `src/components/Aurora/Aurora.tsx:157` | The deleted `uv` attribute leaves an orphaned GPU buffer, and neither geometry nor program is disposed on unmount | Construct a bare `new Geometry(gl, { position: ... })` instead of `Triangle` + delete, and call `mesh.geometry.remove(); mesh.program.remove();` in the cleanup before `loseContext()`. |
| 196 | 🟡 متوسط | correctness | `src/components/BorderGlow/BorderGlow.tsx:10` | `parseHSL` silently returns a hardcoded yellow for any color format other than bare "h s l" | Accept a real CSS color and let the browser parse it — build the vars with `color-mix(in srgb, var(--glow) X%, transparent)` — or at minimum validate the input and `console.warn` on fallback so a wrong value is visible. |
| 197 | 🟡 متوسط | performance | `src/components/BorderGlow/BorderGlow.tsx:166` | The hover-only glow machinery runs on touch devices, where it can never be seen | Guard the handler with `window.matchMedia('(hover: hover) and (pointer: fine)').matches` and skip attaching `onPointerMove` (and skip the `animated` sweep) when it is false. |
| 198 | 🟡 متوسط | state | `src/components/ChromaGrid/ChromaGrid.tsx:112` | The spotlight centre is measured once on mount, before the team data arrives, and is never recomputed | Re-measure in an effect keyed on `data.length` and via a ResizeObserver on `rootRef`. |
| 199 | 🟡 متوسط | react | `src/components/ChromaGrid/ChromaGrid.tsx:176` | `key={i}` on a list that swaps wholesale from demo data to server data | Use a stable key. `ChromaItem` has no id — add `id` to the interface and key on it (About already has `member.id` from `TeamMember`). |
| 200 | 🟡 متوسط | security | `src/components/ChromaGrid/ChromaGrid.tsx:182` | Server-supplied `gradient` / `borderColor` strings are injected verbatim into inline CSS custom properties | Whitelist server-side and validate client-side: accept only `#rrggbb` for borderColor and only a two-stop `linear-gradient(...)` built from validated hex stops. Tell the Flask dev these two fields are rendered as raw CSS. |
| 201 | 🟡 متوسط | correctness | `src/components/ChromaGrid/ChromaGrid.tsx:191` | The image onError handler has no guard and re-assigns the same URL, so an unreachable fallback loops forever | Guard with a one-shot flag (`if (e.currentTarget.dataset.fallback) return; e.currentTarget.dataset.fallback='1';`) and point the fallback at a local asset in /public, not Unsplash. |
| 202 | 🟡 متوسط | correctness | `src/components/layout/AIChatAssistant.tsx:40` | scrollIntoView on the chat sentinel scrolls the whole document, fighting Lenis | Use `chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })`, or better, set `bodyRef.current.scrollTop = bodyRef.current.scrollHeight` directly and only when the user is already near the bottom. |
| 203 | 🟡 متوسط | react | `src/components/layout/AIChatAssistant.tsx:47` | Message ids derived from Date.now() collide, producing duplicate React keys | Use `crypto.randomUUID()` or a monotonic counter ref for message ids. |
| 204 | 🟡 متوسط | a11y | `src/components/layout/AIChatAssistant.tsx:91` | Chat panel has no dialog role/label, no aria-live transcript, no Escape, no focus management, and two unlabelled icon buttons | Add role="dialog" aria-modal="false" aria-label={t(...)} to the card, role="log" aria-live="polite" aria-relevant="additions" to .ai-chat-body, aria-label on both icon buttons, aria-expanded on the FAB, an Escape keydown handler, and move focus into the input  |
| 205 | 🟡 متوسط | design-system | `src/components/layout/Footer.css:2` | 12 of 30 stylesheets have no dark-theme handling at all; footer becomes lighter than the page background in dark mode | Add `--navy` and `--white` to the [data-theme="dark"] block (or better, introduce semantic `--surface-inverse` / `--text-on-inverse` tokens), and consolidate the five identical `.xxx-btn { background: var(--navy) }` rules into one `.btn-solid` in global.css. |
| 206 | 🟡 متوسط | forms | `src/components/layout/Footer.tsx:66` | Newsletter input has no name/id/autocomplete, the submit is never disabled, and the success timer is never cleared | Add name="email" id="newsletter-email" autoComplete="email" maxLength={254}, a visually-hidden <label>, an isSubmitting state driving `disabled`, and store the timeout id in a ref cleared in a useEffect cleanup. |
| 207 | 🟡 متوسط | dead-code | `src/components/layout/Footer.tsx:97` | Footer logo ternary has identical branches, so the theme check is a no-op | Replace with the literal `src="/logo-white.png"` and drop the unused useTheme() call, or fix the light branch to /logo-dark.png if a light footer is planned. |
| 208 | 🟡 متوسط | missing-feature | `src/components/layout/Footer.tsx:166` | Privacy Policy and Terms & Conditions are non-interactive spans styled to look like clickable links | Either create /privacy and /terms routes and use <Link>, or remove the cursor:pointer and hover styling so they do not advertise interactivity. |
| 209 | 🟡 متوسط | i18n-rtl | `src/components/layout/Header.css:233` | Mobile nav drawer shadow keeps its negative X offset when the drawer flips to the left edge in RTL | `[dir="rtl"] .mobile-nav-panel { box-shadow: 16px 0 48px -12px rgba(18,33,51,.35); }` or switch to a logical `box-shadow` computed from a `--shadow-drawer` token with an RTL variant. |
| 210 | 🟡 متوسط | a11y | `src/components/layout/Header.tsx:102` | Active navigation state is conveyed by CSS class and color only — no aria-current anywhere | Replace Link with NavLink and render `aria-current={isActive ? 'page' : undefined}`; add a non-color affordance (underline or dot) to the active state. |
| 211 | 🟡 متوسط | a11y | `src/components/layout/Header.tsx:112` | Theme and language toggles use hardcoded English aria-labels/titles and expose no pressed state | Route every aria-label and title through t(), and make the labels stateful, e.g. aria-label={theme === 'light' ? t('switchToDark') : t('switchToLight')} plus aria-pressed={theme === 'dark'}. |
| 212 | 🟡 متوسط | design-system | `src/components/layout/Layout.css:11` | Content offset hardcodes 64px while --nav-h is 68px, and scroll-padding-top lands anchors 4px behind the fixed header | Add `--header-top: 16px` to variables.css and use `padding-top: calc(var(--header-top) + var(--nav-h) + var(--space-5))` in Layout.css and `scroll-padding-top: calc(var(--header-top) + var(--nav-h) + 12px)` in global.css. Also add the 56px/52px mobile heights  |
| 213 | 🟡 متوسط | a11y | `src/components/layout/Layout.tsx:19` | Smooth scroll hijacking is unconditional — prefers-reduced-motion is not honored and there is no opt-out | Read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and skip Lenis construction (and set framer-motion transition duration to 0) when true; subscribe to the media query for live changes. |
| 214 | 🟡 متوسط | design-system | `src/components/layout/MobileBottomNav.css:8` | Fixed 62px height plus env(safe-area-inset-bottom) padding under border-box clips the tab labels on notched iPhones | Use `height: calc(62px + env(safe-area-inset-bottom, 0px))` (or `min-height` plus the padding), so the inset extends the bar instead of eating it. |
| 215 | 🟡 متوسط | correctness | `src/components/layout/MobileBottomNav.css:23` | Eight tabs in a horizontal scroller with no scroll-into-view, and a dead scroll-snap-align with no scroll-snap-type | On location change, call `activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })`; add `scroll-snap-type: x proximity` to the container or drop the snap-align; and reduce the tab count to 4-5 as a fixed grid, which is the conventional bottom |
| 216 | 🟡 متوسط | react | `src/components/layout/ScrollToTop.tsx:9` | Scroll-to-top is implemented twice, ignores hash targets, and clobbers back-button scroll restoration | Delete ScrollToTop.tsx and keep only the Layout.tsx effect (which correctly resets Lenis's internal position too), or delete the Layout effect and make ScrollToTop Lenis-aware. In whichever survives, skip the reset when `location.hash` is non-empty and when `u |
| 217 | 🟡 متوسط | performance | `src/components/ProgramCards/ProgramCards.css:203` | `.pc-link` transitions `gap`, a layout property, on hover | Keep the gap fixed and translate the arrow instead (`.pc-link svg { transition: transform .25s } .pc-link:hover svg { transform: translateX(4px) }`, mirrored under `[dir="rtl"]`), and cross-fade a pseudo-element for the gradient background. |
| 218 | 🟡 متوسط | backend-integration | `src/components/ProgramCards/ProgramCards.tsx:85` | Returns `null` on an empty programs array, leaving a section header that claims content that isn't there | Render an explicit empty/error state instead of null, and derive the count in the heading from `programs.length` (or drop the numeral). |
| 219 | 🟡 متوسط | a11y | `src/components/ProgramCards/ProgramCards.tsx:120` | Five sibling links with identical accessible names and a non-labelled arrow icon | Add `aria-label={`${t('learnMore')}: ${isAr ? program.titleAr : program.titleEn}`}` to the Link, `aria-hidden` on the arrow, and drop the unused `id` from the Home card. |
| 220 | 🟡 متوسط | react | `src/components/ProgramCards/ProgramCards.tsx:134` | Theme is branched on in the component tree, so toggling light/dark unmounts and rebuilds every card | Always render BorderGlow and let CSS disable the glow in light mode (`html:not([data-theme="dark"]) .pc-card .edge-light, ...::before, ...::after { display: none }`), keeping one DOM shape. |
| 221 | 🟡 متوسط | design-system | `src/components/ProgramCards/ProgramCards.tsx:138` | `borderRadius={20}` and `backgroundColor="#0f1a27"` are both dead — `.pc-card` overrides them, and the hex bypasses the token system anyway | Delete both props and let the tokens drive it, or pass `backgroundColor="var(--surface-2)"` as Home.tsx:166 already does — never a raw hex. |
| 222 | 🟡 متوسط | design-system | `src/components/ui/AnalyticsChart.css:2` | --admin-* tokens have no dark-theme variant, so the chart card is forced white in dark mode | Add a `[data-theme="dark"] :root` block for the --admin-* tokens, or drop the --admin-* layer from this shared component entirely. |
| 223 | 🟡 متوسط | design-system | `src/components/ui/AnalyticsChart.css:63` | No responsive handling — seven axis labels overflow a 320px viewport with no scroll container | Wrap the chart body in an `overflow-x: auto` container with a `min-width`, reduce the gap under 600px, and rotate/truncate axis labels at narrow widths. |
| 224 | 🟡 متوسط | design-system | `src/components/ui/AnalyticsChart.css:67` | `border-top: 1px stroke ...` is invalid CSS — the x-axis separator never renders | `border-top: 1px solid var(--border, #e2eaf1);` |
| 225 | 🟡 متوسط | design-system | `src/components/ui/AnalyticsChart.css:108` | `overflow: hidden` on the bar track clips the in-bar value label on any short bar | Move `.chart-bar-val` above the fill (absolutely positioned at the top of the column, outside the clipped track), or remove `overflow: hidden` and clip with border-radius only. |
| 226 | 🟡 متوسط | correctness | `src/components/ui/AnalyticsChart.tsx:46` | `secondaryValue` is part of the public DataPoint contract and scales the y-axis, but is never drawn | Either render the secondary series (second path + legend) or remove `secondaryValue` from the interface and from the maxValue computation. |
| 227 | 🟡 متوسط | correctness | `src/components/ui/AnalyticsChart.tsx:52` | The line chart's `height` prop does not control rendered height, and inverts the chart for height < 70 | Set an explicit `height: ${height}px` on `.chart-svg-wrapper` via inline style, drop `preserveAspectRatio="none"` (use xMidYMid meet), and clamp `chartHeight - padding` to a positive minimum. |
| 228 | 🟡 متوسط | backend-integration | `src/components/ui/AnalyticsChart.tsx:75` | AnalyticsChart has no empty, loading, or error state — an empty API response renders a decorated blank card | Add `loading?: boolean` and `error?: string \| null` props, render a skeleton for loading and the (currently unused) EmptyState component for `data.length === 0`. |
| 229 | 🟡 متوسط | i18n | `src/components/ui/AnalyticsChart.tsx:85` | toLocaleString() uses the browser locale, not the app language, and the bar chart skips it entirely | Add a single `const fmt = (n: number) => n.toLocaleString(language === "ar" ? "ar-EG" : "en-US")` and use it at lines 85, 185, 210, 267 and 287. |
| 230 | 🟡 متوسط | design-system | `src/components/ui/AnalyticsChart.tsx:117` | Chart styling depends on --admin-* variables that only exist in the lazily-loaded admin CSS chunk | Use only globally-defined tokens in the shared component (`var(--border)`, `var(--surface)`, `var(--text-3)`), and scope admin overrides under `.admin-layout` rather than `:root`. |
| 231 | 🟡 متوسط | correctness | `src/components/ui/AnalyticsChart.tsx:192` | Bar chart floors every bar at 8% height, so zero and negative values render as visibly non-zero bars | Only apply a minimum height when `d.value > 0`; render zero as a 0-height bar (with the value label moved outside the track), and handle negatives explicitly or reject them. |
| 232 | 🟡 متوسط | design-system | `src/components/ui/AnalyticsChart.tsx:227` | Chart palette is hardcoded hex literals that bypass the design system and have no dark-mode variant | Define `--chart-1..--chart-5` in variables.css with light/dark values, default the props to those vars, and delete the repeated literals at the call sites. |
| 233 | 🟡 متوسط | react | `src/components/ui/EmptyState.tsx:33` | Dead destructure stub plus DOM-attribute language detection that never re-renders on language change | Delete line 33 and use `const { language } = useLanguage(); const isAr = language === "ar";`. |
| 234 | 🟡 متوسط | correctness | `src/components/ui/EmptyState.tsx:48` | Passing only one language variant renders `undefined` — an empty <p> and a blank button | Guard per-language: `const desc = isAr ? descriptionAr : descriptionEn; {desc && <p>{desc}</p>}` and the same for the action label; or make the pairs required together via a discriminated type. |
| 235 | 🟡 متوسط | forms | `src/components/ui/EmptyState.tsx:51` | Action button has no type="button" and will submit any enclosing form | Add `type="button"` here; convert the palette's ESC kbd to `<button type="button" aria-label="Close"><kbd>ESC</kbd></button>`. |
| 236 | 🟡 متوسط | a11y | `src/components/ui/QuickAccessMenu.tsx:57` | Declares role="menu"/role="menuitem" with none of the required keyboard behaviour | Either implement the full menu keyboard pattern (arrow keys, Escape + focus restore, roving tabindex, aria-haspopup) or drop role="menu"/"menuitem" and ship it as a plain <nav> with links. Given the component is dead code, deleting it is the cheaper fix. |
| 237 | 🟡 متوسط | design-system | `src/components/ui/QuickCommandPalette.css:51` | Full-screen overlay uses width:100vw / height:100vh instead of inset:0 — horizontal scrollbar on desktop, wrong height on mobile | Replace lines 48-52 with `position: fixed; inset: 0;` and add `height: 100dvh` only if a fixed height is genuinely needed. |
| 238 | 🟡 متوسط | a11y | `src/components/ui/QuickCommandPalette.css:70` | None of the four shared components honour prefers-reduced-motion | Add a shared `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }` block in global.css, or per-component overrides. |
| 239 | 🟡 متوسط | correctness | `src/components/ui/QuickCommandPalette.tsx:18` | Ctrl/Cmd+K is captured and preventDefault'd unconditionally, including while typing in a form field | Bail out when `e.target` is an input/textarea/contenteditable unless the palette is already open; guard `e.key?.toLowerCase()`; and mount the palette above the Routes (or inside AdminLayout too) so the shortcut is genuinely global. |
| 240 | 🟡 متوسط | i18n | `src/components/ui/QuickCommandPalette.tsx:161` | Palette footer is hardcoded English including a leftover 'Antigravity Engine' branding string | Delete the 'Antigravity Engine' string and route the remaining label through `t()`; migrate the component's inline ternaries to translation keys. |
| 241 | 🟡 متوسط | dead-code | `src/context/LanguageContext.tsx:33` | 13 of 45 translation keys are never referenced, and one of them is duplicated inline in the Footer | Delete the unused keys or wire them up (the nav-related ones — media, login, register, dashboard — indicate missing nav entries, see the routes-with-no-nav-entry finding). Replace Footer.tsx:138 with t("services"). |
| 242 | 🟡 متوسط | performance | `src/context/LanguageContext.tsx:146` | LanguageContext value object and `t` are recreated on every provider render | Wrap `t` in useCallback([language]) and the provider value in useMemo([language, t]); wrap toggleTheme in useCallback([]) and the theme value in useMemo([theme]). |
| 243 | 🟡 متوسط | dead-code | `src/pages/About/About.css:109` | ~105 lines of `.founder-*` CSS for a component About.tsx no longer renders | Delete lines 109-205, 253-256 and 270-273. |
| 244 | 🟡 متوسط | a11y | `src/pages/About/About.tsx:52` | About hero banner: hardcoded English alt text in an Arabic UI, no width/height, external Unsplash source | `alt=""` (decorative) plus `width={1600} height={600} fetchPriority="high"`, and self-host the asset or serve it from the API so it is not a third-party dependency on the About page. |
| 245 | 🟡 متوسط | a11y | `src/pages/About/About.tsx:80` | About page jumps from h1 straight to h3, then back to h2 | Promote the three core cards to `<h2>` and give the section a visually-hidden `<h2>` parent, or demote the section headings consistently. Programs.tsx is correct here (h1 -> h2 -> h3) — match it. |
| 246 | 🟡 متوسط | design-system | `src/pages/About/About.tsx:151` | The leadership team grid is permanently grayscale and dimmed on touch devices because colour only appears on :hover | Add `@media (hover: none) { .chroma-card { filter: none } .chroma-fade, .chroma-overlay { display: none } }` and drive `.chroma-info` colours from theme tokens. |
| 247 | 🟡 متوسط | design-system | `src/pages/Admin/admin.css:434` | Logout button uses a dark-theme salmon text colour on the light admin surface — roughly 1.9:1 contrast | Use var(--admin-danger) (#EF4444) for the text, and add a dark-theme block or explicitly scope :root admin vars under both themes. |
| 248 | 🟡 متوسط | performance | `src/pages/Admin/AdminContent.tsx:66` | Every consumer calls the hook with no selector, subscribing to the entire store and re-rendering on unrelated slices | Use selectors with shallow comparison: `useCMSStore(s => s.events)` etc., or `useShallow` for grouped picks. |
| 249 | 🟡 متوسط | a11y | `src/pages/Admin/AdminContent.tsx:311` | None of the ~40 CMS inputs has an id, name, or an htmlFor on its label | Give every input an id and name and point the label's htmlFor at it (name also unblocks browser autofill and native form serialization). |
| 250 | 🟡 متوسط | design-system | `src/pages/Admin/AdminContent.tsx:539` | The submit spinner uses .spinner, a class that only exists in the lazily-loaded Home page stylesheet | Define an .admin-spinner class with its own keyframes inside admin.css and use that. |
| 251 | 🟡 متوسط | backend-integration | `src/pages/Admin/AdminContent.tsx:574` | CMS tables have no loading state, no empty state and no pagination — the store's loading flag is never read | Read loading and render skeletons, add an empty state per entity, and agree a paginated envelope (PaginatedResponse already exists at types/index.ts:212 and is used nowhere). |
| 252 | 🟡 متوسط | backend-integration | `src/pages/Admin/AdminDashboardHome.tsx:174` | AdminStats values are pre-formatted strings and the activity feed is keyed by array index because AdminActivity has no id | Send numbers (and format in the UI with Intl.NumberFormat honouring ar/en), add an id to AdminActivity, drop the local mirror state, and wire the charts to a real timeseries endpoint or remove them. |
| 253 | 🟡 متوسط | docs-mismatch | `src/pages/Admin/AdminLayout.tsx:184` | Analytics icon lookup expects lucide names while API_CONTRACT.md documents an emoji, and the fallback silently invents an icon | Document the exact allowed icon enum in the contract, expose it as a <select> in the programs form, and console.warn on an unrecognised name instead of falling back silently. |
| 254 | 🟡 متوسط | backend-integration | `src/pages/Admin/AdminLogin.tsx:33` | AdminLogin discards the store's error message and always shows a hardcoded English string, so the server's reason for rejection never reaches the admin | Read `error` from useAuthStore in AdminLayout, pass it to AdminLogin, and localise the fallback. |
| 255 | 🟡 متوسط | i18n | `src/pages/Admin/AdminLogin.tsx:47` | The whole admin is inline language ternaries, and the login screen is English-only with an LTR arrow, in an Arabic-default RTL app | Move admin strings into the translations map (or a dedicated admin namespace), use t(), replace ← with a direction-aware lucide ArrowLeft/ArrowRight, and add a language toggle to the admin topbar. |
| 256 | 🟡 متوسط | state | `src/pages/Admin/AdminMessages.tsx:37` | Opening a message optimistically marks it read in the detail copy regardless of whether the server call succeeds | Keep only the id in local state and derive the selected message from the store array, so list and detail cannot disagree. |
| 257 | 🟡 متوسط | i18n-rtl | `src/pages/Admin/AdminMessages.tsx:101` | Search icon is positioned with physical left in an RTL-first admin, and the inbox grid has no mobile breakpoint | Use insetInlineStart for the icon and move the two-column layout into admin.css behind a min-width media query. |
| 258 | 🟡 متوسط | backend-integration | `src/pages/Admin/AdminMessages.tsx:127` | AdminMessages renders the 'No matching messages' empty state while the request is in flight and after it fails, so a broken endpoint is indistinguishable from an empty inbox | Read loading/error from the store, render a skeleton and a distinct error state, and only apply the read flag after the server confirms. |
| 259 | 🟡 متوسط | i18n | `src/pages/Contact/Contact.tsx:70` | Effectively every string on these four pages is an inline ternary that bypasses the translation layer | Move page copy into the translations dictionary with namespaced keys and call t(); keep only CMS-sourced bilingual fields as ternaries. |
| 260 | 🟡 متوسط | docs-mismatch | `src/pages/Contact/Contact.tsx:95` | Contact email/location are hardcoded, not clickable, and diverge from the Footer and the admin settings field | Add GET /api/settings (site email, phone, address) to the contract, fetch it here and in the Footer, and render `<a href="mailto:...">` / `<a href="tel:...">`. |
| 261 | 🟡 متوسط | design-system | `src/pages/Contact/Contact.tsx:122` | btn-outline and btn-sm are used but defined nowhere in the codebase | Add .btn-outline and .btn-sm to global.css, or switch these to the existing .btn-ghost variant. |
| 262 | 🟡 متوسط | a11y | `src/pages/Contact/Contact.tsx:136` | Success/loading results are not announced and focus is dropped when the form is replaced | Wrap each result region in role="status" aria-live="polite" (assertive for errors), add aria-busy on the form while loading, and programmatically focus the success heading with tabIndex={-1}. |
| 263 | 🟡 متوسط | forms | `src/pages/Contact/Contact.tsx:152` | No input in either Contact form or the Events modal has name, autoComplete, maxLength, or trimming | Add name + autoComplete to every field, maxLength (e.g. 80/120/2000), a phone pattern, trim before submit, and document max field lengths in the API contract. |
| 264 | 🟡 متوسط | design-system | `src/pages/Dashboard/Dashboard.css:219` | Ticket badge, activity icon and the carbon warning box are hardcoded to the light palette and have no dark-theme override | Add [data-theme="dark"] overrides (or theme-scoped tokens) for .ticket-badge, .activity-icon, .feedback-warning, .feedback-success and .trophy-icon, and pass CSS variables to AnalyticsChart instead of hex literals. |
| 265 | 🟡 متوسط | state | `src/pages/Dashboard/Dashboard.tsx:10` | Active dashboard tab is local state, so it is unlinkable and lost on refresh | Drive activeTab and selectedYear from useSearchParams so they are shareable, refresh-safe and Back-navigable. |
| 266 | 🟡 متوسط | correctness | `src/pages/Dashboard/Dashboard.tsx:68` | CSV export does no field escaping and emits no BOM, so an Arabic user name breaks the columns and Excel renders mojibake | Quote and escape each field (`"${String(v).replace(/"/g,'""')}"`), prefix the content with ﻿, use a Blob + URL.createObjectURL instead of a data: URI, and localize the headers via t(). |
| 267 | 🟡 متوسط | backend-integration | `src/pages/Dashboard/Dashboard.tsx:78` | A 200 response missing the `stats` object traps the Dashboard in a permanent (and invisible) loading state | Validate the response shape in loadUserProfile, set `error` when required fields are absent, and give the Dashboard an explicit error state with a retry button distinct from loading. |
| 268 | 🟡 متوسط | i18n-rtl | `src/pages/Dashboard/Dashboard.tsx:160` | Welcome heading ignores the loaded profile name and leaks Latin script into the Arabic string | Use `profile.name` in the greeting, and move all page strings into LanguageContext keys consumed via t(). |
| 269 | 🟡 متوسط | correctness | `src/pages/Dashboard/Dashboard.tsx:243` | The empty-state paragraph is a direct child of <ul>, producing invalid HTML | Move the empty-state check outside the <ul>, or wrap the message in an <li>. |
| 270 | 🟡 متوسط | i18n-rtl | `src/pages/Dashboard/Dashboard.tsx:288` | Dates are rendered as raw ISO strings or with the browser locale, never with the app's selected language | Format all dates through `new Intl.DateTimeFormat(language === "ar" ? "ar-AE" : "en-GB").format(new Date(iso))`, and have the backend issue a real unique credential ID via a certificate endpoint. |
| 271 | 🟡 متوسط | design-system | `src/pages/Dashboard/Dashboard.tsx:297` | .btn-sm and .text-danger are used across all three pages but defined in no stylesheet — the destructive Cancel button is neither small nor red | Define .btn-sm, .text-danger (or a .btn-danger variant) and .btn-close in global.css, or remove the classes and use ones that exist. |
| 272 | 🟡 متوسط | design-system | `src/pages/Events/Events.css:130` | #111a2e hardcoded as a dark surface in 5 places — does not equal --surface (#101A26), producing two different dark card colors side by side | Replace all five `#111a2e` with `var(--surface)` and `rgba(255,255,255,0.08)` with `var(--border)`, then delete the now-redundant [data-theme="dark"] blocks entirely — the base rule already reads the token. Fix the misleading comment at Events.css:4. |
| 273 | 🟡 متوسط | design-system | `src/pages/Events/Events.css:614` | 143 !important declarations and 18 distinct z-index values with two exact collisions and no documented scale | Publish a z-index scale in variables.css and migrate every value to it. Then do an !important amnesty: delete all of them and re-add only the ones that a failing visual test proves are needed. |
| 274 | 🟡 متوسط | dead-code | `src/pages/Events/Events.css:1090` | Dead selectors: .events-stats-grid / .event-stat-card exist only inside media queries and match no TSX; .admin-form-full / .admin-settings-section likewise | Delete Events.css:1086-1110, the .events-stats-grid rule at 1145, the .event-stat-card entry at 1175, and admin.css:761-765, 805-813, 856-859. If the stats section is planned, track it as a feature, not as orphaned CSS. |
| 275 | 🟡 متوسط | state | `src/pages/Events/Events.tsx:81` | The public Events page keeps its own copy of events instead of useCMSStore.events, so the admin's CMS list and the public list are two independent caches | Have the public pages read from the CMS store (or a shared query cache) so there is one cache per collection, and re-fetch after mutations instead of hand-patching counts. |
| 276 | 🟡 متوسط | correctness | `src/pages/Events/Events.tsx:107` | Date-only strings are parsed as UTC then compared/formatted in local time, shifting events by a day | Parse date-only strings as local (`new Date(y, m-1, d)` from the split parts) or compare ISO strings lexicographically (`e.date >= todayIso`); derive day and month from the same parsed value. |
| 277 | 🟡 متوسط | i18n-rtl | `src/pages/Events/Events.tsx:116` | Event search uses toLowerCase only — no Arabic normalization, and it ignores the other language's fields | Normalize both query and haystack (NFKD, strip U+064B-U+0652 diacritics, map أإآ→ا, ى→ي, ة→ه, remove U+0640), and search both language fields plus location/category. |
| 278 | 🟡 متوسط | dead-code | `src/pages/Events/Events.tsx:291` | The "Failed to load events" screen can never render | Let the service throw on failure so this branch actually runs, and add a Retry button to it. |
| 279 | 🟡 متوسط | a11y | `src/pages/Events/Events.tsx:531` | Backdrop click handler fires on drag-release, destroying typed registration data | Close on mousedown-target === overlay tracked through to mouseup (or use <dialog>), and move role/aria-modal/aria-labelledby onto .modal-card-v2. |
| 280 | 🟡 متوسط | i18n-rtl | `src/pages/GamesHub/GamesHub.css:182` | Carbon option buttons have a fixed 90px (72px mobile) height that long Arabic option text overflows | Replace `height: 90px` / `height: 72px` with `min-height` and let the flexbox grow. |
| 281 | 🟡 متوسط | correctness | `src/pages/GamesHub/GamesHub.tsx:52` | saveScoreToDashboard treats a footprint of 0 as "no result" and silently returns | Use `if (finalFootprint === null) return;` and add a submitting state that disables the button and shows success/failure inline instead of alert(). |
| 282 | 🟡 متوسط | i18n-rtl | `src/pages/GamesHub/GamesHub.tsx:82` | Hardcoded left-pointing "←" glyph inside Arabic RTL back buttons points the wrong way | Use `{language === "ar" ? "→ الرجوع للألعاب" : "← Back to Games"}` or, better, render a direction-aware lucide icon component. |
| 283 | 🟡 متوسط | correctness | `src/pages/GamesHub/GamesHub.tsx:97` | Carbon result copy claims a comparison to the UAE average that the model can never reach, and the model itself is a 3-category sum | Either drop the "UAE average" claim or make the thresholds a function of the question set (e.g. return per-band thresholds from GET /carbon-questions). Add per-question back navigation and document the scoring model in API_CONTRACT.md so the backend can serve  |
| 284 | 🟡 متوسط | a11y | `src/pages/GamesHub/GamesHub.tsx:143` | No aria-live on the carbon result, no radiogroup semantics on the options, no tab semantics on the Dashboard sidebar, no dialog semantics or focus management on the certificate | Add role="status" aria-live="polite" to the result panel; wrap options in a fieldset with role="radiogroup" and aria-checked buttons; give the sidebar proper tab/tabpanel roles; convert the certificate to a real dialog with Escape, focus trap and focus restore |
| 285 | 🟡 متوسط | missing-feature | `src/pages/GamesHub/GamesHub.tsx:192` | "Water Plants" button is a pure alert() — no state, no API, no effect | Either implement tree health as real state backed by an endpoint, or remove the button and the eco-benefit claim from the marketing copy. |
| 286 | 🟡 متوسط | dead-code | `src/pages/Home/Home.tsx:70` | `getIcon` is documented as mapping icon names from the database but is only ever called with three string literals; three of its six branches are unreachable, and the icons it returns do not match their names | Replace `getIcon("Monitor")` etc. with the three literal icon components, delete the switch, and rewrite the misleading comments at lines 39-40 and 69. |
| 287 | 🟡 متوسط | backend-integration | `src/pages/Home/Home.tsx:271` | Homepage renders every initiative the API returns with no limit, no pagination and no query params; posts are trimmed client-side after downloading all of them | Add `getFeaturedInitiatives(limit)` and `getBlogPosts({limit, fields})` with documented `?limit=` / `?featured=` query params in API_CONTRACT.md, and have /api/posts support a summary projection that omits the content bodies. |
| 288 | 🟡 متوسط | a11y | `src/pages/Home/Home.tsx:273` | Initiative and news images are CSS background-images on bare divs — aria-label on a generic div is ignored, no alt text, no lazy loading, no intrinsic size | Replace both with real `<img loading="lazy" width height alt={...} onError={...}>` inside a positioned wrapper using object-fit: cover — the same pattern Programs.tsx:314-322 already uses. If background-image must stay, wrap the URL: `url("${CSS.escape ? ... : |
| 289 | 🟡 متوسط | i18n | `src/pages/Home/Home.tsx:342` | Blog post dates are printed as raw backend strings with no locale formatting | `new Intl.DateTimeFormat(language === 'ar' ? 'ar-AE' : 'en-GB', {year:'numeric',month:'long',day:'numeric'}).format(new Date(post.date))`, wrapped in a shared `formatDate(value, language)` helper with a guard for `Number.isNaN(d.getTime())`. |
| 290 | 🟡 متوسط | missing-feature | `src/pages/LearningHub/LearningHub.tsx:186` | Course list has no empty state, no error state, no filter/search and no pagination; images have no dimensions or lazy loading | Add explicit empty and error branches with a retry, add category filter + search, add width/height and loading="lazy" to the images, self-host the fallback image, and agree a pagination contract with the backend. |
| 291 | 🟡 متوسط | missing-feature | `src/pages/LearningHub/LearningHub.tsx:291` | "Print Certificate" calls window.print() with zero @media print rules anywhere in the codebase | Add an @media print block that hides everything except .certificate-paper-body, forces a light background, and removes the modal chrome; or generate a real PDF. Also fix the button label if download is not implemented. |
| 292 | 🟡 متوسط | backend-integration | `src/pages/Media/Media.tsx:55` | Fetched lists render bare .map() with no empty state — an empty backend response looks like a broken page | Import the existing EmptyState component and render `{posts.length === 0 && <EmptyState type="no-data" titleEn=... titleAr=... />}` on Media.tsx:55 and LearningHub.tsx:187 (after fixing the missing CSS import in EmptyState). |
| 293 | 🟡 متوسط | performance | `src/pages/Media/Media.tsx:62` | onError sets a remote fallback src that can re-trigger onError, and images have no lazy loading or dimensions | Guard with a flag (`if (e.currentTarget.dataset.fallback) return; e.currentTarget.dataset.fallback = "1"`), ship a local placeholder asset instead of a third-party URL, and add loading/decoding/width/height. |
| 294 | 🟡 متوسط | react | `src/pages/Media/PostDetail.tsx:15` | Route param change neither resets loading nor cancels the in-flight request | Reset `setPost(null); setLoading(true)` at the top of the effect, use an AbortController plus a `cancelled` flag in the cleanup, and move the id guard inside the try/finally. |
| 295 | 🟡 متوسط | missing-feature | `src/pages/Media/PostDetail.tsx:61` | Articles have no document title, meta description, canonical URL, or OG tags | Add a small useEffect (or react-helmet-async) per route setting title, meta description from the excerpt, og:title/og:description/og:image from the post, and a canonical link; set html lang/dir before paint. |
| 296 | 🟡 متوسط | missing-feature | `src/pages/Media/PostDetail.tsx:99` | Share and Bookmark buttons are inert, and their aria-labels are hardcoded English | Wire Share to navigator.share with a clipboard fallback, translate both aria-labels via the language ternary, and either implement Bookmark against a user endpoint or remove it. |
| 297 | 🟡 متوسط | design-system | `src/pages/Opportunities/Opportunities.css:97` | demand-badge only styles high/urgent/medium; any other server value renders an unstyled, near-invisible pill | Normalize the value in JS with a whitelist + fallback class, and use --warning/--danger/--info tokens with dark-theme overrides. |
| 298 | 🟡 متوسط | design-system | `src/pages/Opportunities/Opportunities.css:210` | minmax(320px, 1fr) overflows a 320px-wide viewport | Use minmax(min(320px, 100%), 1fr) or add a max-width:560px breakpoint that drops to 1fr. |
| 299 | 🟡 متوسط | design-system | `src/pages/Opportunities/Opportunities.css:281` | Apply modal overlay z-index:2000 sits below the header (99990), the mobile bottom nav (99990) and the AI chat widget (99996) | Introduce a --z-modal token above the chrome layer (e.g. 100000) and use it here and in Events.css:804 / Programs.css:660. |
| 300 | 🟡 متوسط | design-system | `src/pages/Opportunities/Opportunities.css:357` | Opportunities.css redefines the global .form-group / .form-group input selectors, silently restyling every other form in the app once its chunk loads | Scope these rules under .opps-modal-card, and never re-declare global design-system selectors from a page stylesheet. Replace outline:none with a visible :focus-visible ring. |
| 301 | 🟡 متوسط | react | `src/pages/Opportunities/Opportunities.tsx:58` | 2.5 s success timer is never cleared — it closes whichever modal happens to be open when it fires, and fires after unmount | Store the timer id in a ref and clearTimeout in a useEffect cleanup (and on manual close). |
| 302 | 🟡 متوسط | i18n-rtl | `src/pages/Opportunities/Opportunities.tsx:246` | postedDate is printed raw with no parsing, localization or relative-time formatting | Parse with new Date(), format via Intl.DateTimeFormat(language==='ar'?'ar-AE':'en-GB'), wrap in <time dateTime={opp.postedDate}>, and sort by postedDate desc (or document that the API must). |
| 303 | 🟡 متوسط | design-system | `src/pages/Opportunities/Opportunities.tsx:251` | .btn-full-width is only defined in Portals.css, so Opportunities' buttons are not full-width until the user visits /portals | Move .btn-full-width into src/styles/global.css next to the other .btn utilities. |
| 304 | 🟡 متوسط | backend-integration | `src/pages/Opportunities/Opportunities.tsx:309` | Applications carry no attachment: the "CV" field is a URL string, and the app contains no file input at all | State this explicitly in API_CONTRACT.md §2.7, and rename the label to "رابط السيرة الذاتية (LinkedIn / Drive)" so nobody expects an upload. |
| 305 | 🟡 متوسط | backend-integration | `src/pages/Opportunities/Opportunities.tsx:321` | coverLetter is the only application field without `required`, and no field has maxLength — the DTO gives the backend no requiredness or size contract | Decide and encode requiredness in one place (mark the textarea required, or type coverLetter as optional in the DTO and doc), and add maxLength to every free-text field. |
| 306 | 🟡 متوسط | backend-integration | `src/pages/Portals/Portals.tsx:26` | Only two portals exist (partner/education) and no non-admin login exists anywhere, yet AuthResponse declares four roles | Either state explicitly in the handoff docs that only admin auth exists in v1 (and narrow AuthResponse.role), or ship the member login that writes user_token. |
| 307 | 🟡 متوسط | docs-mismatch | `src/pages/Portals/Portals.tsx:55` | Handler JSDoc instructs the backend dev to "replace the setTimeout with fetch" for two handlers that already call the API | Delete lines 52-60 and 77-84, keep only the (corrected) download note, and fix the garbled header comment. |
| 308 | 🟡 متوسط | a11y | `src/pages/Portals/Portals.tsx:140` | Portal switcher uses aria-pressed toggle buttons with no tablist semantics, no arrow-key navigation and no panel association | Use role="tablist"/role="tab" with aria-selected + aria-controls, role="tabpanel" with matching id, and roving-tabindex arrow key handling. |
| 309 | 🟡 متوسط | a11y | `src/pages/Portals/Portals.tsx:256` | Replacing the form with the success panel unmounts the focused submit button, dropping focus to <body> | Move focus programmatically to the success heading (tabIndex={-1} + ref.focus()) and add role="status" to the Opportunities success block. |
| 310 | 🟡 متوسط | backend-integration | `src/pages/Portals/Portals.tsx:290` | orgType select offers 3 values but API_CONTRACT.md documents a 4-value enum including "academic" | Add the academic option (or delete it from the contract) so code and doc agree. |
| 311 | 🟡 متوسط | forms | `src/pages/Portals/Portals.tsx:390` | studentCount uses type="number" with no min/max/step, so Flask can receive "-40", "0" or "999999999999" as a string | Add min="1" max="5000" step="1" and inputMode="numeric"; strongly prefer changing the DTO to a number and updating both docs. |
| 312 | 🟡 متوسط | design-system | `src/pages/Programs/Programs.css:20` | Programs hero adds a full navbar height of top padding on top of the layout's existing 88px header offset | Change to `padding: clamp(40px, 6vw, 72px) 0 64px;` — `--nav-h` compensation belongs only in the layout wrapper, not in each page. |
| 313 | 🟡 متوسط | i18n | `src/pages/Programs/Programs.css:74` | `text-transform: uppercase` + `letter-spacing` applied to Arabic label text breaks cursive letter joining | Scope both properties: `.eyebrow, .badge-category, .programs-hero-eyebrow, .programs-modal-label { letter-spacing: 0.08em; text-transform: uppercase; }` then `[dir="rtl"] .eyebrow, [dir="rtl"] .badge-category, ... { letter-spacing: normal; text-transform: none |
| 314 | 🟡 متوسط | design-system | `src/pages/Programs/Programs.css:797` | `@keyframes programs-shimmer` is defined twice verbatim, and `.p-skeleton-accent` declares `width` twice in the same rule | Delete lines 797-804 and line 611. |
| 315 | 🟡 متوسط | a11y | `src/pages/Programs/Programs.css:906` | prefers-reduced-motion removes the Programs hero background image, which is a static image and not motion | Delete the `.programs-hero-bg` rule from the reduced-motion block. If the concern was a parallax effect, none exists in this file. |
| 316 | 🟡 متوسط | react | `src/pages/Programs/Programs.tsx:93` | Hash-scroll setTimeout has no cleanup, does not re-fire for a repeated identical hash, and fights Lenis + global smooth-scroll | `const t = setTimeout(...); return () => clearTimeout(t);`, drive the scroll through the Lenis instance (expose it via context and call `lenis.scrollTo(element, {offset: -navH})`), and use `useLocation().key` in the deps so a repeated identical hash re-trigger |
| 317 | 🟡 متوسط | a11y | `src/pages/Programs/Programs.tsx:149` | Modal cleanup unconditionally clears body overflow and force-focuses the stale trigger, including while the page is unmounting | Only restore focus when the trigger is still connected and the component is not unmounting: `if (triggerBtnRef.current?.isConnected) triggerBtnRef.current.focus();`, and track the previous overflow value rather than resetting to empty string. |
| 318 | 🟡 متوسط | backend-integration | `src/pages/Programs/Programs.tsx:163` | `initiatives[0]` silently becomes the large Featured card — array order is a load-bearing contract that no document mentions | Add a `featured: boolean` (or `sortOrder: number`) field to the Initiative type and the contract, select with `.filter(i => i.featured)[0]`, and document a deterministic ORDER BY. |
| 319 | 🟡 متوسط | correctness | `src/pages/Programs/Programs.tsx:318` | Image onError assigns a remote fallback src that can itself fail, re-firing onError in a request loop; grid images also lack lazy loading and dimensions | Guard with a flag: `if (e.currentTarget.dataset.fallback) return; e.currentTarget.dataset.fallback = '1'; e.currentTarget.src = LOCAL_PLACEHOLDER;` and use a self-hosted placeholder. Add `loading="lazy" decoding="async" width={800} height={400}` to the grid im |
| 320 | 🟡 متوسط | dead-code | `src/services/api.ts:40` | authFetch reads a `user_token` key that nothing in the codebase ever writes, and no doc mentions a second token or any user-login endpoint | Decide and document the member-auth story: add POST /api/auth/register + POST /api/auth/login (user) to the contract with the user_token storage key, or remove the user_token branch and state that /api/user/* is admin-token-only for the MVP. |
| 321 | 🟡 متوسط | dead-code | `src/services/api.ts:134` | getGames and getProgramById are never called anywhere, and mockGames' playUrl values point at routes that do not exist | Either wire GamesHub to getGames (it currently hardcodes the two games) and add the /games/* routes, or delete getGames, mockGames, the Game type and the /api/games and /api/programs/<id> contract entries. |
| 322 | 🟡 متوسط | state | `src/services/api.ts:338` | admin_token is written in two places (api.ts and useAuthStore) with no single owner, and only the store clears it on logout | Remove the localStorage write from api.ts:338. Make useAuthStore the single owner of token persistence, and have logoutAdmin clear both keys. |
| 323 | 🟡 متوسط | correctness | `src/services/api.ts:371` | getAdminStats hardcodes counts that contradict the mock content shown on the same screen | Derive the mock counts from the mock arrays (`mockBlogPosts.length`, `mockEvents.filter(e => e.date >= today).length`). Define 'upcoming' precisely in the contract. |
| 324 | 🟡 متوسط | i18n-rtl | `src/services/api.ts:484` | changeAdminPassword's mock message is Arabic-only and is alerted verbatim to English-language admins on the failure path | Change the response contract to `{success, messageEn, messageAr}` (or return a stable machine code the frontend maps through its i18n layer) and stop rendering server strings directly. Update §8.5 to match whatever is chosen. |
| 325 | 🟡 متوسط | correctness | `src/services/api.ts:497` | Mock ids use deprecated substr and can be short or empty, and always diverge from the server's real primary key | Use crypto.randomUUID(). Better: delete these fabricated-entity mocks — a create that the server rejected must not produce a fake row in the store. |
| 326 | 🟡 متوسط | backend-integration | `src/services/api.ts:517` | Every DELETE unconditionally parses a JSON body; no doc forbids the idiomatic 204 No Content | Add an explicit rule to the contract: 'Every endpoint, including DELETE, MUST return a JSON body. Never return 204 or an empty body.' Alternatively make api.ts tolerate empty bodies (`res.status === 204 ? {success:true} : res.json()`). |
| 327 | 🟡 متوسط | correctness | `src/services/mockData.ts:217` | Mock blog posts are dated 2024 and announce a 2023 report as 'now available'; the profile mock lists a past event as a Confirmed upcoming registration | Move mock dates to relative offsets from Date.now(), or refresh them and add `status:'completed'` / `startDate` to the COP28 initiative so the optional-field path is actually exercised. |
| 328 | 🟡 متوسط | react | `src/store/useAuthStore.ts:54` | The auth_unauthorized listener is registered via a global window flag and never removed, so after a Vite HMR reload of the store module the 401 handler updates a dead store instance | Register the listener once at module scope in the store file (no window flag), or return a cleanup from an effect in a top-level provider and remove it on unmount. |
| 329 | 🟡 متوسط | backend-integration | `src/store/useAuthStore.ts:84` | No AbortController, timeout, retry or in-flight dedupe on any store action; StrictMode double-mount fires every loader twice | Pass an AbortSignal through apiService, abort in the effect cleanup, add a request timeout, and guard against out-of-order responses with a request id. |
| 330 | 🟡 متوسط | backend-integration | `src/store/useAuthStore.ts:186` | cancelEventRegistration only filters an in-memory array — there is no DELETE endpoint in api.ts or in the API contract, so the cancelled event comes back | Add DELETE /api/events/register/<eventId> to the contract, call it, refund the points, and only mutate state on a successful response. |
| 331 | 🟡 متوسط | missing-feature | `src/store/useCMSStore.ts:85` | siteSettings is a hardcoded client default with no loader and no GET endpoint, and enableMaintenance is saved to the server but consumed by nothing | Add GET /api/admin/settings + a loadSettings action called on mount, and either implement the maintenance gate or remove the toggle. |
| 332 | 🟡 متوسط | state | `src/store/useCMSStore.ts:90` | One global `loading` boolean is shared by loadCMSContent, loadMessages and the profile loader — concurrent operations clobber each other | Replace with per-operation keys, e.g. `loading: { cms: false, messages: false, stats: false }`, or a Set of in-flight action names. |
| 333 | 🟡 متوسط | backend-integration | `src/store/useCMSStore.ts:96` | loadCMSContent's Promise.all/catch can never fire because api.ts never rejects — the error path is dead code and a partially-broken backend renders as empty tables | Use Promise.allSettled and record which collections failed in per-collection error state; and stop mock-falling-back on non-ok statuses in api.ts. |
| 334 | 🟡 متوسط | state | `src/store/useCMSStore.ts:151` | CMS create/update writes whatever api.ts returns straight into the store with no reconciliation, so mock-fallback objects become indistinguishable from server truth | Document that the SERVER owns id generation and its format (slug vs uuid), have createEvent/etc. throw instead of returning a fabricated object on failure, and have useCMSStore surface the error to the admin UI rather than returning true. |
| 335 | 🟡 متوسط | performance | `src/styles/global.css:4` | Two third-party font CDNs are pulled in via CSS @import, creating a render-blocking request waterfall with no preconnect | Self-host both families as woff2 subsets in `public/fonts/` with local `@font-face` rules (this also removes the third-party dependency and the GDPR exposure), or at minimum move them to `<link rel="preload" as="style">` + `<link rel="stylesheet">` in index.ht |
| 336 | 🟡 متوسط | a11y | `src/styles/global.css:156` | The design system provides no skip-link and no .sr-only/visually-hidden utility | Add `.sr-only` (clip-path inset(50%), 1px box, no wrap) and `.skip-link` (position:absolute; inset-inline-start:0; top:-100%; :focus { top: 8px }) to global.css, and render the skip link as the first child in Layout.tsx targeting the `.main-content-flow` eleme |
| 337 | 🟡 متوسط | dead-code | `src/styles/variables.css:41` | Seven declared tokens have zero usages, including --gradient which is shadowed by the near-identical --gradient-brand | Delete --gradient, --gradient-soft, --space-10, --navy-700, --navy-800, --blue-900, --green-900. Either delete --gray and its dark override, or document what it is for. |
| 338 | 🟡 متوسط | docs-mismatch | `src/types/index.ts:204` | ApiResponse/PaginatedResponse envelopes are exported as 'Standard API Response Envelopes for Backend Integration' but nothing uses them, and PaginatedResponse contradicts the contract's pagination shape | State in one sentence at the top of the contract: 'All list endpoints return a BARE JSON ARRAY; all mutation endpoints return a bare object. There is no envelope.' Then delete ApiResponse/PaginatedResponse from types/index.ts or actually adopt them — do not le |
| 339 | 🟡 متوسط | performance | `vite.config.ts:5` | No manualChunks, no sourcemaps, no build target, no path alias, no `base` — the build config is untouched from the scaffold | Add `build: { sourcemap: 'hidden', target: 'es2022', rollupOptions: { output: { manualChunks: { react: ['react','react-dom','react-router-dom'], motion: ['framer-motion','gsap','lenis'], gl: ['ogl'] } } } }` and `resolve: { alias: { '@': fileURLToPath(new URL( |
| 340 | ⚪ منخفض | docs-mismatch | `docs/API_CONTRACT.md:423` | Duplicate section number 1.10, public GET sections buried inside the forms chapter, a JSON example with a comment, and a version number that disagrees with the sibling doc | Renumber sections, move 1.10/1.11 into chapter 1, replace `// ...` with a real field list, and align the version/date headers across all three docs (or drop version numbers and rely on git). |
| 341 | ⚪ منخفض | docs-mismatch | `docs/BACKEND_DEVELOPER_GUIDE.md:594` | 'Common mistake #2: forgetting Content-Type' presents two functionally identical snippets as wrong and right | Delete the item or replace it with the real Content-Type pitfall: returning `str(dict)` or a Response without mimetype, and the fact that DELETE must return a JSON body (see the 204 finding) rather than an empty 204. |
| 342 | ⚪ منخفض | design-system | `src/components/BorderGlow/BorderGlow.css:65` | BorderGlow uses unprefixed `mask-image`/`mask-composite` while ChromaGrid prefixes everything — inconsistent, and the fallback is a solid rectangle | Pick one policy. Either add the `-webkit-` pairs to BorderGlow, or drop them from ChromaGrid and declare the baseline; test the `::after` fill on the oldest Safari in the support matrix. |
| 343 | ⚪ منخفض | i18n-rtl | `src/components/BorderGlow/BorderGlow.tsx:143` | The intro sweep's start/end angles are hardcoded clockwise and are not mirrored for Arabic | Read `document.dir === 'rtl'` (or a language context value) and mirror the angles: `start = 360 - 110`, sweeping counter-clockwise. |
| 344 | ⚪ منخفض | performance | `src/components/BorderGlow/BorderGlow.tsx:176` | Seven radial-gradient strings and ~20 custom properties are rebuilt and re-applied on every render | Wrap both builders in `useMemo` keyed on `glowColor`/`glowIntensity` and on `colors.join(',')`, and hoist the palette literals out of the JSX at the call sites. |
| 345 | ⚪ منخفض | dead-code | `src/components/ChromaGrid/ChromaGrid.tsx:32` | The `rows` prop and the `--rows` custom property are never consumed by any CSS, and `columns` only applies above 1124px | Delete `rows` from the props interface and the style object; either honour `--cols` inside the media queries (via `min()`) or document that it is a desktop-only hint. |
| 346 | ⚪ منخفض | dead-code | `src/components/layout/Footer.css:17` | The newsletter band's hero image is a paste-artifact filename shipped to production | Rename to something descriptive (newsletter-band-bg.webp) and update the reference; audit public/ for the other misnamed assets. |
| 347 | ⚪ منخفض | correctness | `src/components/layout/Footer.tsx:97` | Theme ternary on the footer logo returns the same asset in both branches | If the footer is always on a dark background, drop the ternary and use `"/logo-white.png"` directly with a comment. If not, use `theme === "light" ? "/logo-dark.png" : "/logo-white.png"` to match Header.tsx:81. |
| 348 | ⚪ منخفض | design-system | `src/components/layout/Header.css:16` | Header background is a hardcoded rgba with !important, forcing an !important cascade for every state | Introduce `--surface-translucent` / `--surface-translucent-scrolled` tokens per theme, drop every !important in this file, and define a named z-index scale (--z-header, --z-fab, --z-modal) in variables.css. |
| 349 | ⚪ منخفض | a11y | `src/components/layout/Layout.tsx:62` | No skip-to-content link and <main> has no id, so keyboard users tab through 12+ header controls on every page | Add `id="main-content"` and `tabIndex={-1}` to <main>, and render a visually-hidden-until-focused `<a href="#main-content">` as the first focusable element in Layout. |
| 350 | ⚪ منخفض | react | `src/components/ui/AnalyticsChart.tsx:40` | hoveredIndex is not reset when the `data` prop changes, producing a stale tooltip | Add `useEffect(() => setHoveredIndex(null), [data])`, and memoize the call site with useMemo keyed on selectedYear. |
| 351 | ⚪ منخفض | performance | `src/components/ui/AnalyticsChart.tsx:46` | Math.max(...array) spread will throw RangeError once real API data exceeds the argument limit | Use `data.reduce((m, d) => Math.max(m, d.value), 1)`, and downsample/aggregate above a point threshold. |
| 352 | ⚪ منخفض | design-system | `src/components/ui/QuickCommandPalette.css:54` | Two different fixed overlays both sit at z-index 999999, resolved only by DOM order | Define `--z-header: 100`, `--z-drawer: 200`, `--z-modal: 300` etc. in variables.css and replace all five raw values; give the modal layer a strictly higher value than any drawer. |
| 353 | ⚪ منخفض | security | `src/components/ui/QuickCommandPalette.tsx:80` | The public command palette advertises the admin CMS route to every anonymous visitor | Filter the admin entry on an auth/role check from the store, and add the four missing public routes so the palette actually covers the site map. |
| 354 | ⚪ منخفض | missing-feature | `src/pages/About/About.tsx:35` | Three documented About requirements have no UI and no endpoint: organization history, advisory board, strategic partners | Either add `memberType: 'team' \| 'advisory'` to TeamMember plus a `GET /api/partners` endpoint and build the sections, or strike FR-A-03/06/07 from the technical report so nobody signs off on them as delivered. |
| 355 | ⚪ منخفض | missing-feature | `src/pages/About/About.tsx:176` | Annual report CTA is a hardcoded 2023 PDF on an external WordPress host with no endpoint behind it | Add `GET /api/reports -> [{id, year, titleEn, titleAr, fileUrl, sizeBytes}]` to the contract and render the list; add `rel="noopener noreferrer"` (currently only `noreferrer`) and append "(PDF, N MB, opens in a new tab)" to the accessible name. |
| 356 | ⚪ منخفض | dead-code | `src/pages/Admin/AdminLayout.tsx:152` | Notification bell does nothing, sidebar identity is hardcoded, and any unknown /admin/* path renders the dashboard | Wire or remove the bell, persist and display the user object from the login response, render a 404 panel for unknown admin tabs, and delete the unused selectors. |
| 357 | ⚪ منخفض | design-system | `src/pages/Contact/Contact.css:137` | Meeting booking section keeps 40px padding at every breakpoint, squeezing content on 320px screens | Reduce to `padding: 24px 16px` under the 560px media query and drop .booking-form-card padding to 20px there. |
| 358 | ⚪ منخفض | dead-code | `src/pages/Dashboard/Dashboard.css:228` | ~110 lines of admin-only CSS live in Dashboard.css and are used by nothing | Delete the dead admin block from Dashboard.css (move it to the admin stylesheet if it is needed there) and drop the unused .lock-state rule. |
| 359 | ⚪ منخفض | i18n-rtl | `src/pages/Dashboard/Dashboard.tsx:292` | Server-supplied event status leaks raw English into the Arabic UI for any value other than "Confirmed" | Define the status enum in types/index.ts and API_CONTRACT.md, map every value to a translated label, and give each status its own badge style. |
| 360 | ⚪ منخفض | a11y | `src/pages/Events/Events.css:1185` | prefers-reduced-motion removes the hero background image, which was never animated | Remove this rule; keep the reduced-motion block limited to the transition/animation overrides above it. |
| 361 | ⚪ منخفض | i18n | `src/pages/Home/Home.css:98` | Asymmetric physical padding on the hero pill mirrors incorrectly in RTL | `padding-block: 8px; padding-inline: 12px 16px;` (logical properties, which the rest of this file already uses — e.g. `margin-inline` on lines 26 and 118). |
| 362 | ⚪ منخفض | correctness | `src/pages/LearningHub/LearningHub.tsx:208` | Course excerpt appends "..." unconditionally and cuts mid-word | `const excerpt = d.length > 100 ? d.slice(0, 100).trimEnd() + "…" : d;` or use CSS line-clamp and render the full string. |
| 363 | ⚪ منخفض | i18n | `src/pages/Media/Media.tsx:76` | Post dates are printed as raw ISO strings instead of localized dates | Format with `new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", {dateStyle:"long"})` and numbers with Intl.NumberFormat, wrapping the value in a <time dateTime={post.date}> element. |
| 364 | ⚪ منخفض | security | `src/pages/Opportunities/Opportunities.tsx:54` | sanitizeUrl silently replaces a hostile portfolio URL with the literal "#invalid-url" and submits it as if valid | Validate the URL scheme in the form and show a field-level error instead of mutating the value at submit time; keep server-side validation regardless. |
| 365 | ⚪ منخفض | i18n | `src/pages/Opportunities/Opportunities.tsx:90` | Both pages bypass the t() translation layer entirely; Portals additionally uses Egyptian colloquial Arabic in an Emirati/MSA product | Move the strings into the translations record (or the CMS) and settle on one Arabic register. |
| 366 | ⚪ منخفض | design-system | `src/pages/Opportunities/Opportunities.tsx:199` | Four class names used on this page are defined in no stylesheet in the repo | Either add the missing utilities to global.css or remove the misleading class names. |
| 367 | ⚪ منخفض | missing-feature | `src/pages/Opportunities/Opportunities.tsx:250` | Opportunity has no deadline/status field, so "Apply Now" stays live forever and applications keep arriving for closed roles | Add `deadline` and/or `status: 'open'\|'closed'` to the Opportunity contract now, and disable/label the button accordingly. |
| 368 | ⚪ منخفض | a11y | `src/pages/Portals/Portals.css:25` | Neither page honours prefers-reduced-motion, unlike Events.css and Programs.css | Add the same reduced-motion block to Portals.css and Opportunities.css. |
| 369 | ⚪ منخفض | dead-code | `src/pages/Portals/Portals.css:90` | scroll-margin-top targets an anchor that does not exist, and the active portal is not deep-linkable | Drive activePortal from a ?portal= search param (useSearchParams) and give the section an id, or delete the dead rule. |
| 370 | ⚪ منخفض | performance | `src/pages/Programs/Programs.css:574` | Loading skeleton hero is a fixed 360px while the real hero is ~204px of padding plus content, guaranteeing a large jump when data lands | Match the skeleton hero's padding formula to `.programs-hero`, and wrap the skeleton in `<div role="status" aria-live="polite" aria-label={isAr ? 'جارٍ التحميل' : 'Loading'}>` with `aria-hidden` on the decorative bars. |
| 371 | ⚪ منخفض | correctness | `src/services/api.ts:312` | getUserProfile's registeredEvents entry shares an id with mockEvents but carries a different title — two sources of truth for the same record | Have the profile endpoint return only ids + join-specific data (progress, status) and let the frontend resolve titles from the events/courses collections. Fix the §2.7 example to use 'vol-dubai-outreach'. |
| 372 | ⚪ منخفض | performance | `src/services/mockData.ts:342` | 5.1 MB of unoptimized PNG headshots with spaces in their filenames, referenced as raw unencoded URLs | Convert all nine to WebP at the rendered display size (target < 60 KB each), rename to lowercase hyphenated ASCII (`yathreb-mahmoud.webp`), and give the `<img>` in ChromaGrid.tsx:187 explicit `width`/`height` attributes to reserve layout space. |
| 373 | ⚪ منخفض | i18n-rtl | `src/services/mockData.ts:355` | CareerNode salaryEn and salaryAr state different currencies with non-equivalent ranges | Store `salaryMin`/`salaryMax` as numbers plus a currency code and format per locale with Intl.NumberFormat, or at minimum make the two strings numerically equivalent. |
| 374 | ⚪ منخفض | security | `src/store/useAuthStore.ts:79` | logoutAdmin clears only the auth slice; the CMS store keeps contact messages (names, emails, message bodies) in memory after sign-out | Reset the CMS store on logout (add a `reset()` action calling set(initialState)) and add POST /api/admin/logout for revocation. |
| 375 | ⚪ منخفض | forms | `src/store/useAuthStore.ts:117` | updateUserProfile's non-success branch returns false without setting error, and the Dashboard form shows nothing at all on failure | Set state.error from the response message, render it under the form, and apply the server's returned profile object rather than the submitted one. |
| 376 | ⚪ منخفض | react | `src/store/useAuthStore.ts:138` | Activity IDs are generated from Date.now(), which collides for actions dispatched in the same millisecond | Use crypto.randomUUID() for client-generated ids and add a `createdAt` ISO field to UserActivity in types, mockData and API_CONTRACT.md. |
| 377 | ⚪ منخفض | a11y | `src/styles/global.css:161` | .text-gradient sets color:transparent with no @supports or forced-colors fallback — text vanishes in High Contrast Mode | Wrap the transparent color in `@supports ((background-clip: text) or (-webkit-background-clip: text))` and add `@media (forced-colors: active) { .text-gradient { color: CanvasText; background: none; } }`. |
| 378 | ⚪ منخفض | a11y | `src/styles/variables.css:50` | --border (#E2EAF1) is 1.22:1 against --surface — form field boundaries fail WCAG 1.4.11 non-text contrast | Introduce a separate `--border-interactive: #94A3B8` (2.56:1 — still short; use #64748B for 4.76:1) used only on form controls and buttons, keeping the soft --border for decorative dividers. |
| 379 | ⚪ منخفض | backend-integration | `src/types/index.ts:153` | AdminStats declares numeric metrics as pre-formatted strings, forcing Flask to do UI formatting and locking the Arabic UI to Latin digits | Type these as `number` and format in the component with `Intl.NumberFormat(language === 'ar' ? 'ar-AE' : 'en-US')`. |
