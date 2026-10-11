# 🚀 دليل Backend Developer — مشروع كلايمتيفاي
## دليل عملي للبدء فوراً في بناء الـ Flask API

> **هذا الدليل مصمم ليأخذك من الصفر إلى Backend شغّال في أقل من 30 دقيقة.**
> يركز على **الخطوات العملية** والـ **نصائح السريعة**.
>
> 📜 **المرجع الملزم هو [`docs/API_CONTRACT.md`](API_CONTRACT.md)** — والحقيقة
> النهائية هي الكود `src/services/api.ts`. الدليل ده بيشرح *إزاي* تنفّذ، والعقد
> بيقول *إيه* بالظبط المطلوب.

---

## 🚨 0. خمس حقائق لازم تعرفها قبل أول سطر كود

**Five facts to internalise before you write any code:**

1. **`VITE_API_BASE_URL` لازم ينتهي بـ `/api`.**
   `http://127.0.0.1:5000/api` ✅ · `http://127.0.0.1:5000` ❌ → كل request 404.
   والفرونت **مش** بيضيف `/api` بنفسه.

2. **الـ login هو `POST /api/admin/login` — مش `/api/auth/login`.**
   والتوكن لازم يكون **JWT بتلات أجزاء وفيه `exp` رقمي**، و **`token` في أعلى
   مستوى في الـ body** (مش جوه `data`). The frontend decodes `exp` on every page
   load; an opaque token means the session dies on refresh.

3. **مفيش mock fallback بعد الآن.** الفرونت قبل كده كان بيبلع أي فشل ويعرض بيانات
   وهمية. دلوقتي أي `non-2xx` أو انقطاع اتصال أو تجاوز **15 ثانية** بيظهر كرسالة
   خطأ صريحة في الواجهة. **This makes the UI a real test surface:** if you see
   data, your endpoint really returned it. البيانات الوهمية بتيجي **بس** لما
   `VITE_USE_MOCK_API=true`.

4. **بوابة الأدمن في الفرونت `localStorage` فقط وممكن تجاوزها من devtools.**
   Flask **MUST** enforce `@jwt_required()` **and** `role == "admin"` on every
   `/api/admin/*` route — §4.5. الفرونت حماية شكلية للـ UX، مش أمان.

5. **الـ `Authorization` header بيتبعت في كل request** (حتى `GET /api/programs`)
   لو فيه توكن مخزّن → لازم CORS يسمح بـ `Authorization` وهيحصل **preflight
   `OPTIONS`** على كل request. And a `401` on any route other than login logs the
   admin out — فمتستخدمش 401 لأي معنى تاني.

---

## ⚡ 1. Quick Start (30 دقيقة)

### Step 1: جهّز البيئة (5 دقائق)
```bash
mkdir climatify-backend
cd climatify-backend
python -m venv venv
source venv/bin/activate  # على Windows: venv\Scripts\activate
pip install flask flask-cors flask-sqlalchemy flask-jwt-extended python-dotenv
```

### Step 2: أنشئ `app.py` (10 دقائق)
```python
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required
from datetime import timedelta

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = "your-secret-key-change-in-production"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)   # الفرونت مفيهوش refresh flow

# لازم Authorization في allow_headers — الفرونت بيبعته في كل request
CORS(app, resources={r"/api/*": {
    "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
}})
jwt = JWTManager(app)

# ============ AUTH ============
# ⚠️ المسار /api/admin/login — مش /api/auth/login
@app.route("/api/admin/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    # TODO: استبدل بـ query حقيقية + check_password_hash
    if email == "admin@climatify.org" and password == "admin123":
        # role claim ضروري عشان تتحقق منه في كل /api/admin/*
        token = create_access_token(identity=email, additional_claims={"role": "admin"})
        return jsonify({
            "success": True,
            "token": token,          # ⚠️ top-level — الفرونت مش بيبص جوه "data"
            "user": {"email": email, "role": "admin"}
        })

    # 401 هنا معناها "بيانات غلط" ومش بتعمل logout — الفرونت بيعرض الرسالة دي
    return jsonify({"success": False, "error": "بريد إلكتروني أو كلمة مرور غير صحيحة"}), 401

# ============ PUBLIC ENDPOINTS ============
@app.route("/api/programs", methods=["GET"])
def get_programs():
    return jsonify([
        {
            "id": "digital-transformation",
            "titleEn": "Digital Transformation",
            "titleAr": "التحول الرقمي",
            "descriptionEn": "...",
            "descriptionAr": "...",
            "icon": "Monitor",
            "longDescriptionEn": "...",
            "longDescriptionAr": "..."
        }
        # TODO: استبدل بقاعدة البيانات
    ])

# ============ ADMIN ENDPOINTS (محمية) ============
# ⚠️ @jwt_required() لوحده مش كفاية في الـ production —
#    لازم تتحقق من role == "admin" كمان. شوف §4.5.
@app.route("/api/admin/messages", methods=["GET"])
@jwt_required()
def get_messages():
    return jsonify([
        {
            "id": "1",                      # ⚠️ string مش int
            "sender": "منى المهيري",
            "email": "mona@example.com",
            "subject": "طلب شراكة",
            "message": "...",
            "date": "2026-07-19",           # ⚠️ YYYY-MM-DD بس
            "isRead": False                 # ⚠️ boolean
        }
    ])

# ⚠️ الـ CMS بيحمّل الإعدادات عند فتح صفحة الإعدادات — من غير ده بيعرض خطأ
@app.route("/api/admin/settings", methods=["GET"])
@jwt_required()
def get_settings():
    return jsonify({
        "siteName": "Climatify",
        "contactEmail": "info@climatify-youth.com",
        "enableMaintenance": False,
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### Step 3: شغّل السيرفر (1 دقيقة)
```bash
python app.py
# * Running on http://127.0.0.1:5000
```

### Step 4: اختبر الـ Integration (5 دقائق)
```bash
# في terminal آخر
cd d:\lab\climatify\ui\climatify
npm install

# انسخ قالب البيئة مرة واحدة بس (لو الملف مش موجود)
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
```

بعدها **افتح `.env` بمحرر نصوص وعدّل السطرين دول** (متمسحش الملف):

```
VITE_API_BASE_URL=http://127.0.0.1:5000/api
VITE_USE_MOCK_API=false
```

> 🚨 **متكتبش `echo "VITE_API_BASE_URL=..." > .env`** — علامة `>` بتمسح الملف كله
> وبتوّدي `VITE_USE_MOCK_API` و `VITE_APP_TITLE`، والنتيجة سلوك غريب مش مفهوم.
> ولو نسيت `/api` في آخر العنوان → **كل request هيرجع 404**.
>
> **Edit `.env` in an editor. Never overwrite it with `>`, and always keep the
> `/api` suffix.** (Use `>>` if you really must append from the shell.)

```bash
npm run dev
# افتح http://localhost:5173/admin
# Login: admin@climatify.org / admin123
```

### Step 4-alt: بروكسي الـ dev — أسرع طريق، من غير CORS خالص

`vite.config.ts` فيه بروكسي جاهز بيوجّه `/api/*` لـ Flask:

```ts
server: {
  port: 5173,
  strictPort: true,   // ما يزحفش لـ 5174 ويكسر الـ CORS allowlist في السكوت
  proxy: { "/api": { target: "http://127.0.0.1:5000", changeOrigin: true } },
}
```

عشان تستخدمه، حطّ في `.env`:

```
VITE_API_BASE_URL=/api
```

كل الطلبات بتبقى same-origin (`http://localhost:5173/api/...`) و Vite بيمرّرها
لـ Flask → **مفيش CORS، مفيش preflight، مفيش allowlist تتصان**.
Add real CORS later, for the deployed frontend. (البروكسي للتطوير بس.)

---

## 🛠️ 2. الأدوات الموصى بها

### 2.1 Backend Stack:
- **Flask** — الـ framework الأساسي
- **Flask-CORS** — للـ CORS
- **Flask-JWT-Extended** — للـ JWT tokens
- **Flask-SQLAlchemy** — ORM للـ database
- **Flask-Migrate** — للـ migrations
- **python-dotenv** — للـ environment variables
- **marshmallow** — للـ serialization (optional)
- **pytest** — للـ testing (مستقبلي)

### 2.2 Database:
- **PostgreSQL** (recommended للـ production)
- **SQLite** (good for development)

### 2.3 Testing Tools:
- **Postman** أو **Insomnia** — لاختبار الـ APIs
- **curl** — للاختبار السريع من الـ terminal

### 2.4 Code Quality:
- **black** — formatter
- **flake8** — linter
- **mypy** — type checker (optional)

---

## 📁 3. بنية المشروع المقترحة

```
climatify-backend/
├── app.py                    # Entry point
├── config.py                 # Configuration
├── requirements.txt          # Dependencies
├── .env                      # Environment variables
├── .env.example              # Example env file
├── README.md                 # Documentation
├── models/                   # Database models
│   ├── __init__.py
│   ├── user.py
│   ├── program.py
│   ├── event.py
│   ├── blog_post.py
│   ├── message.py
│   └── ...
├── routes/                   # API endpoints
│   ├── __init__.py
│   ├── auth.py
│   ├── public.py
│   ├── user.py
│   └── admin.py
├── middleware/               # Custom middleware
│   ├── auth.py
│   └── validation.py
├── utils/                    # Helper functions
│   ├── jwt_helper.py
│   └── validators.py
└── tests/                    # Tests
    ├── test_auth.py
    └── test_endpoints.py
```

---

## 🔐 4. تطبيق الـ Authentication

### 4.1 Required Dependencies:
```bash
pip install flask-jwt-extended
```

### 4.2 Setup in `app.py`:
```python
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity

app.config["JWT_SECRET_KEY"] = os.environ["JWT_SECRET_KEY"]     # من .env — مش hardcoded
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
jwt = JWTManager(app)
```

### 4.3 Login Endpoint (`POST /api/admin/login`):

> ⚠️ **المسار `/api/admin/login`** — مش `/api/auth/login`. ده أكثر سبب لفشل
> التكامل من أول يوم.

```python
@app.route("/api/admin/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        token = create_access_token(
            identity=user.email,
            additional_claims={"role": user.role},   # ← الفرونت مش بيتحقق، إنت اللي بتتحقق
        )
        return jsonify({
            "success": True,
            "token": token,             # ⚠️ top-level. NOT {"data": {"token": ...}}
            "user": {"email": user.email, "role": user.role},
        })

    # رسالة موحّدة — متقولش "الإيميل مش موجود"
    return jsonify({"success": False, "error": "بريد إلكتروني أو كلمة مرور غير صحيحة"}), 401
```

**ما يتوقعه الفرونت من التوكن (normative):**

| مطلوب | لماذا |
|---|---|
| JWT بتلات أجزاء `header.payload.signature` | الفرونت بيفك الـ payload بنفسه |
| claim **`exp` كرقم** (Unix seconds) | لو ناقص أو نص → الجلسة تُرفض عند أول reload |
| `token` في أعلى مستوى في الـ body | الـ login هو الاستثناء الوحيد من الـ `{success,data}` envelope |
| `role` claim | إنت اللي هتقراه في الـ guard تحت |

`flask-jwt-extended` بيحط `exp` تلقائي — فمتعملش توكن يدوي.
مفيش refresh-token flow في الواجهة: لما `exp` يعدّي، الأدمن يسجّل دخول من جديد.

### 4.4 Protected Endpoint:
```python
@app.route("/api/admin/messages", methods=["GET"])
@admin_required                      # 👈 مش @jwt_required() لوحده — شوف 4.5
def get_messages():
    messages = Message.query.all()
    return jsonify([m.to_dict() for m in messages])
```

### 4.5 🚨 الحماية الحقيقية مسؤوليتك — الفرونت بوابته شكلية

الواجهة بتعتبر إن فيه أدمن مسجّل دخول **بمجرد وجود string في
`localStorage.admin_token`**. أي حد يفتح devtools ويكتب:

```js
localStorage.setItem("admin_token", "anything")
```

يقدر يفتح `/admin` ويشوف الشاشات. **هو مش هيشوف أي بيانات** لأن السيرفر هيرفض
الطلبات — **بس بشرط إنك تحمي كل route فعلاً.**

**The frontend admin gate is localStorage-only and trivially bypassable.
Flask MUST enforce `@jwt_required()` AND `role == "admin"` on every
`/api/admin/*` route. The frontend guard is UX, not security.**

```python
from functools import wraps
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if get_jwt().get("role") != "admin":
            return jsonify({"error": "Admin privileges required"}), 403
        return fn(*args, **kwargs)
    return wrapper
```

✅ **الأفضل:** guard على مستوى الـ Blueprint، عشان يستحيل تنسى route جديد:

```python
admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.before_request
def guard_admin():
    if request.method == "OPTIONS":
        return None                                  # سيب الـ CORS preflight يعدّي
    if request.endpoint == "admin.login":
        return None                                  # الـ login مفتوح
    verify_jwt_in_request()                          # from flask_jwt_extended
    if get_jwt().get("role") != "admin":
        return jsonify({"error": "Admin privileges required"}), 403
```

### 4.6 معنى الـ status codes عند العميل — مهم جداً

| Status | ما يحدث في الواجهة |
|---|---|
| `401` على أي route **غير** `/api/admin/login` و `/api/admin/change-password` | **الفرونت بيمسح التوكن ويعمل logout فوري** |
| `401` على الـ login أو change-password | "بيانات غلط" — الجلسة ما بتتأثرش |
| `403` | "لا تملك صلاحية لهذا الإجراء" |
| `400` / `422` | **رسالتك بتُعرض للمستخدم حرفياً** من `message` / `error` / `detail` |
| `404` | "العنصر المطلوب غير موجود" |
| `200` مع `{"success": false}` | ❌ **بيتعامل كنجاح** — الفشل لازم يكون non-2xx |

> ⚠️ **متستخدمش `401` بمعنى "مفيش بيانات" أو "مش مسجّل دخول كعضو"** — هتطرد
> الأدمن من الـ CMS وهو بينشر مقال. Use `403` or an empty `200` instead.

### 4.7 أول أدمن (bootstrap / seed)

مفيش شاشة تسجيل أدمن في الواجهة — **فأول أدمن لازم تعمله بنفسك**.

```python
# seed.py  →  flask --app app shell < seed.py   أو  flask seed-admin
import os
from werkzeug.security import generate_password_hash

email = os.environ.get("ADMIN_BOOTSTRAP_EMAIL", "admin@climatify.org")
password = os.environ["ADMIN_BOOTSTRAP_PASSWORD"]      # مش hardcoded

if not User.query.filter_by(email=email).first():
    admin = User(email=email, role="admin")
    admin.set_password(password)                        # generate_password_hash
    db.session.add(admin)
    db.session.commit()
```

- بيانات التطوير في الأمثلة: `admin@climatify.org` / `admin123` — **للتطوير
  المحلي فقط**، لازم تتغير قبل أي deploy.
- الباسورد يُخزّن **hashed** دايماً. أبداً plaintext.
- بعد الـ seed، الأدمن يغيّر الباسورد من `POST /api/admin/change-password`.

### 4.8 ⚠️ مفيش تسجيل دخول للأعضاء في التطبيق كله

**There is NO member/user authentication in the app.**
`localStorage.user_token` **بيتقرا** في الكود لكن **مفيش أي حاجة بتكتبه**، ومفيش
شاشة تسجيل عضو، و **`/dashboard` route عام** أي حد يفتحه.

يعني `/api/user/*` بتتنادى بتوكن الأدمن لو موجود، أو من غير توكن خالص.

**للـ MVP:** متردّش `401` من `/api/user/profile` — ده هيعمل logout للأدمن (§4.6).
رجّع `200` مع بروفايل افتراضي، أو `403`. وأي member auth حقيقي محتاج
`POST /api/user/login` (شوف §12 في العقد).

---

## 🌐 5. تطبيق الـ CORS

### 5.1 Install:
```bash
pip install flask-cors
```

> 💡 أسرع بديل: **استخدم بروكسي الـ dev** (Step 4-alt) وحطّ
> `VITE_API_BASE_URL=/api` — الطلبات تبقى same-origin ومحتاجش CORS محلياً خالص.
> لكن هتحتاج CORS للـ frontend المنشور، فده الإعداد الصح:

### 5.2 Setup (الإعداد الموصى به):
```python
from flask_cors import CORS

CORS(app, resources={r"/api/*": {
    # الفرونت ثابت على 5173 (strictPort) — والاتنين لأن الناس بتفتح الاتنين
    "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],   # ⚠️ Authorization إلزامي
}})

# للـ production
# CORS(app, resources={r"/api/*": {"origins": ["https://climatify-youth.com"], ...}})
```

### 5.3 🚨 حقيقتان عن الـ CORS في المشروع ده

1. **`Authorization` بيتبعت في كل request** — حتى `GET /api/programs` — لو فيه
   توكن مخزّن. الهيدر ده **مش** من الهيدرز المسموحة تلقائياً في CORS، فالمتصفح
   بيعمل **preflight `OPTIONS`** قبل **كل** request.
   **Your app must answer `OPTIONS` on every `/api/*` route.** Flask-CORS بيعمل
   ده تلقائياً — بس أي `before_request` guard أو catch-all route كتبته بنفسك لازم
   **يسيب `OPTIONS` يعدّي** من غير auth (شوف §4.5).

2. `Content-Type: application/json` بيتبعت **بس لما يكون فيه body** — الـ
   `GET`/`DELETE` بيتبعتوا من غير body ومن غير `Content-Type`.
   **So never call `request.get_json()` on a `DELETE` route** (هيرمي 400).
   الاستثناء الوحيد: `PUT /api/admin/messages/<id>/read` **بياخد body**
   `{"isRead": true}`.

> `supports_credentials` **مش مطلوب** — الفرونت مش بيستخدم cookies، بس Bearer
> token. متفعّلهوش من غير داعي (بيمنع `origins: "*"`).

---

## 📊 6. نماذج Database (SQLAlchemy)

### 6.1 User Model:
```python
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255))
    city = db.Column(db.String(255))
    bio = db.Column(db.Text)
    role = db.Column(db.String(50), default="user")  # "user" or "admin"
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "city": self.city,
            "bio": self.bio,
            "role": self.role
        }
```

### 6.2 Program Model:
```python
class Program(db.Model):
    __tablename__ = "programs"
    
    id = db.Column(db.String(100), primary_key=True)
    title_en = db.Column(db.String(255), nullable=False)
    title_ar = db.Column(db.String(255), nullable=False)
    description_en = db.Column(db.Text, nullable=False)
    description_ar = db.Column(db.Text, nullable=False)
    icon = db.Column(db.String(50), default="Monitor")
    long_description_en = db.Column(db.Text)
    long_description_ar = db.Column(db.Text)
    
    def to_dict(self):
        return {
            "id": self.id,
            "titleEn": self.title_en,
            "titleAr": self.title_ar,
            "descriptionEn": self.description_en,
            "descriptionAr": self.description_ar,
            "icon": self.icon,
            "longDescriptionEn": self.long_description_en,
            "longDescriptionAr": self.long_description_ar
        }
```

### 6.3 Event Model:
```python
class Event(db.Model):
    __tablename__ = "events"
    
    id = db.Column(db.String(100), primary_key=True)
    title_en = db.Column(db.String(255), nullable=False)
    title_ar = db.Column(db.String(255), nullable=False)
    description_en = db.Column(db.Text, nullable=False)
    description_ar = db.Column(db.Text, nullable=False)
    date = db.Column(db.Date, nullable=False)
    location_en = db.Column(db.String(255), nullable=False)
    location_ar = db.Column(db.String(255), nullable=False)
    category_en = db.Column(db.String(100), nullable=False)
    category_ar = db.Column(db.String(100), nullable=False)
    registered_count = db.Column(db.Integer, default=0)
    
    def to_dict(self):
        return {
            "id": self.id,
            "titleEn": self.title_en,
            "titleAr": self.title_ar,
            "descriptionEn": self.description_en,
            "descriptionAr": self.description_ar,
            "date": self.date.isoformat(),
            "locationEn": self.location_en,
            "locationAr": self.location_ar,
            "categoryEn": self.category_en,
            "categoryAr": self.category_ar,
            "registeredCount": self.registered_count
        }
```

### 6.4 Blog Post Model:
```python
class BlogPost(db.Model):
    __tablename__ = "blog_posts"
    
    id = db.Column(db.String(100), primary_key=True)
    title_en = db.Column(db.String(255), nullable=False)
    title_ar = db.Column(db.String(255), nullable=False)
    excerpt_en = db.Column(db.Text, nullable=False)
    excerpt_ar = db.Column(db.Text, nullable=False)
    content_en = db.Column(db.Text, nullable=False)
    content_ar = db.Column(db.Text, nullable=False)
    image = db.Column(db.String(500), nullable=False)
    date = db.Column(db.Date, nullable=False)
    author_en = db.Column(db.String(255), default="Climatify Admin")
    author_ar = db.Column(db.String(255), default="مسؤول كلايمتيفاي")
    category_en = db.Column(db.String(100), nullable=False)
    category_ar = db.Column(db.String(100), nullable=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "titleEn": self.title_en,
            "titleAr": self.title_ar,
            "excerptEn": self.excerpt_en,
            "excerptAr": self.excerpt_ar,
            "contentEn": self.content_en,
            "contentAr": self.content_ar,
            "image": self.image,
            "date": self.date.isoformat(),
            "authorEn": self.author_en,
            "authorAr": self.author_ar,
            "categoryEn": self.category_en,
            "categoryAr": self.category_ar
        }
```

### 6.5 ContactMessage Model:
```python
class ContactMessage(db.Model):
    __tablename__ = "contact_messages"
    
    id = db.Column(db.Integer, primary_key=True)
    sender = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(500), nullable=False)
    message = db.Column(db.Text, nullable=False)
    date = db.Column(db.Date, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "sender": self.sender,
            "email": self.email,
            "subject": self.subject,
            "message": self.message,
            "date": self.date.isoformat(),
            "isRead": self.is_read
        }
```

---

## 🧪 7. Testing the Integration

### 7.1 Test Login (لاحظ المسار):
```bash
# ⚠️ /api/admin/login   — NOT /api/auth/login
curl -X POST http://127.0.0.1:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@climatify.org","password":"admin123"}'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {"email": "admin@climatify.org", "role": "admin"}
}
```

- `token` لازم يكون **top-level** ومكوّن من **تلات أجزاء** بينهم نقطة.
- افتح الجزء الأوسط على jwt.io وتأكد إن فيه `exp` رقمي و `role: "admin"`.

### 7.2 Test Protected Endpoint:
```bash
# Save the token from above
TOKEN="your-token-here"

curl http://127.0.0.1:5000/api/admin/messages \
  -H "Authorization: Bearer $TOKEN"

# ولازم تجرّب العكس كمان — من غير توكن المفروض 401:
curl -i http://127.0.0.1:5000/api/admin/messages

# وبتوكن مش أدمن المفروض 403:
curl -i http://127.0.0.1:5000/api/admin/messages -H "Authorization: Bearer $MEMBER_TOKEN"
```

### 7.3 Test CORS (Preflight مع Authorization):
```bash
curl -i -X OPTIONS http://127.0.0.1:5000/api/programs \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

> لو `Authorization` مش موجود في `Allow-Headers` → **كل** الطلبات هتفشل بمجرد أن
> يكون فيه أدمن مسجّل دخول، حتى الـ public GETs.

### 7.4 Test mark-as-read (المسار فيه `/read` والـ PUT بياخد body):
```bash
curl -X PUT http://127.0.0.1:5000/api/admin/messages/1/read \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"isRead": true}'
# Expected: { "success": true }
```

### 7.5 اختبار من الواجهة نفسها (أهم اختبار)

بعد ما تشغّل الاتنين مع `VITE_USE_MOCK_API=false`، لفّ على الصفحات دي.
**أي بانر خطأ = endpoint بايظ فعلاً** (مفيش mock fallback يخبّي المشكلة):

| الصفحة | بتنادي |
|---|---|
| `/` `/programs` | `/api/programs`, `/api/initiatives` |
| `/events` | `/api/events` |
| `/learning-hub` | `/api/courses` |
| `/media` + `/blog/:id` | `/api/posts`, `/api/posts/<id>` |
| `/about` | `/api/team` |
| `/opportunities` | `/api/opportunities`, `/api/careers` |
| `/games` | `/api/games`, `/api/carbon-questions` |
| `/portals` | `/api/workshops`, `/api/curricula/download` |
| `/contact` | `/api/contact`, `/api/meetings`, `/api/partnerships` |
| الـ Footer (أي صفحة) | `/api/newsletter/subscribe` |
| `/dashboard` | `/api/user/profile` |
| `/admin` | `/api/admin/login`, `stats`, `analytics`, `messages`, `settings` |

---

## 🔍 8. نصائح سريعة

### 8.1 استخدام Environment Variables:
```python
# .env
FLASK_ENV=development
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost/climatify
JWT_SECRET_KEY=your-jwt-secret
```

```python
# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
```

### 8.2 Validation:
```python
from marshmallow import Schema, fields, validate

class ContactSchema(Schema):
    firstName = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    lastName = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(required=True)
    subject = fields.Str(required=True, validate=validate.Length(min=1, max=500))
    message = fields.Str(required=True, validate=validate.Length(min=1, max=5000))

@app.route("/api/contact", methods=["POST"])
def submit_contact():
    try:
        data = ContactSchema().load(request.get_json())
    except ValidationError as err:
        return jsonify({"success": False, "errors": err.messages}), 400
    
    # Save to DB
    new_message = ContactMessage(**data)
    db.session.add(new_message)
    db.session.commit()
    
    return jsonify({"success": True, "message": "تم إرسال رسالتك بنجاح!"}), 201
```

### 8.3 Pagination / filtering / sorting

> ⚠️ **الفرونت دلوقتي مش بيبعت أي query params**، وبيعمل كل الفلترة والترتيب
> والبحث **في المتصفح** على القائمة الكاملة.
> **A request with NO query parameters MUST return the complete list.**
> متعملش pagination افتراضية بترجّع 20 عنصر — الواجهة هتعرض 20 وتسكت.

```python
@app.route("/api/events", methods=["GET"])
def get_events():
    query = Event.query

    # فلترة/بحث اختياريين — بيتجاهلوا لو مش مبعوتين
    if search := request.args.get("search"):
        like = f"%{search}%"
        query = query.filter(db.or_(Event.title_en.ilike(like), Event.title_ar.ilike(like)))
    if category := request.args.get("category"):
        query = query.filter(Event.category_en == category)

    order = request.args.get("order", "asc")
    query = query.order_by(Event.date.desc() if order == "desc" else Event.date.asc())

    page = request.args.get("page", type=int)
    if page is None:
        # ✅ الافتراضي: القائمة كاملة — ده اللي الفرونت بيعتمد عليه
        return jsonify([e.to_dict() for e in query.all()])

    # لو الفرونت اتطوّر بعد كده ليستخدم pagination، الشكل ده الـ client بيفهمه
    per_page = request.args.get("perPage", 20, type=int)
    result = query.paginate(page=page, per_page=per_page)
    return jsonify({
        "success": True,
        "data": [e.to_dict() for e in result.items],
        "total": result.total, "page": page, "perPage": per_page,
    })
```

الـ params المتفق عليها: `page` (1-based) · `perPage` · `search` · `category` /
`type` / `status` (بالقيم الإنجليزية بالحرف) · `sort` · `order` (`asc|desc`).

### 8.4 Error Handling — ⚠️ الـ 404 handler ده بيكسر روابط الـ SPA

الشكل المعتاد ده **بيكسر كل رابط عميق** في الواجهة:

```python
# ❌ غلط لو بتخدم الـ frontend من نفس السيرفر:
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404
```

السبب: الواجهة SPA بـ `BrowserRouter`. لما المستخدم يعمل refresh على `/events`
السيرفر لازم يرجّع `index.html` — الـ handler اللي فوق بيرجّع JSON 404، فالمستخدم
يشوف خطأ. **الحل: خُد الـ path في الحسبان.**

```python
from flask import request, jsonify, send_from_directory

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Resource not found"}), 404      # API → JSON
    return send_from_directory(app.static_folder, "index.html")   # SPA → index.html

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(ValidationError)
def validation_error(e):
    # الرسالة دي بتُعرض للمستخدم في حالة 400/422 — خليها مفهومة
    return jsonify({"success": False, "message": "البيانات المُرسلة غير صحيحة", "errors": e.messages}), 400
```

> 📌 كل الأخطاء **لازم JSON** لأي مسار `/api/*`. صفحة HTML للخطأ بتخلي الرسالة
> غير مفهومة عند العميل (بيحاول `JSON.parse` وبيرجع النص الخام).
> تفاصيل الـ SPA fallback كاملة في §14.

### 8.5 رفع الصور — endpoint ناقص ومطلوب

**4 كيانات فيها حقل `image` مطلوب** (`Initiative`, `Course`, `BlogPost`,
`TeamMember`) و **مفيش أي endpoint لرفع الصور في المنصة**. فورمات الأدمن بتاخد
**رابط نصي** بس، يعني الأدمن مضطر يرفع الصورة في مكان تاني بنفسه.

**Required: `POST /api/upload` returning `{ url }`.**

```python
import os, uuid
from werkzeug.utils import secure_filename

ALLOWED = {"png", "jpg", "jpeg", "webp", "gif"}
MAX_BYTES = 5 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_BYTES

@app.route("/api/upload", methods=["POST"])
@admin_required
def upload():
    file = request.files.get("file")          # ⚠️ اسم الحقل: "file"
    if not file or not file.filename:
        return jsonify({"success": False, "message": "لم يتم إرسال أي ملف"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED:
        return jsonify({"success": False, "message": "صيغة الملف غير مدعومة"}), 400

    name = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(app.config["UPLOAD_FOLDER"], secure_filename(name)))

    # ✅ الرد لازم يكون { url } عشان يتحط مباشرة في حقل image
    return jsonify({"url": f"/static/uploads/{name}"})
```

- الرابط لازم يكون `https://` أو مسار نسبي. المخططات `javascript:` / `data:` /
  `vbscript:` / `file:` **الواجهة بترفضها** (`sanitizeUrl`).
- لحد ما يتعمل، سيب حقل `image` يقبل أي رابط `https` صالح.

### 8.6 التواريخ والتوقيت — قاعدة واحدة

- كل التواريخ **`YYYY-MM-DD`** بس: لا `T`، لا `Z`، لا offset. الأوقات `HH:MM` (24h).
- في SQLAlchemy استخدم `db.Date` (مش `db.DateTime`) و `self.date.isoformat()`.

> 🕐 **الفرونت بيفسّر `YYYY-MM-DD` كتاريخ محلي، مش UTC.** الكود بيبني التاريخ
> بنفسه (`new Date(y, m-1, d)`) لأن `new Date("2026-04-25")` كانت بتتفسّر منتصف
> ليل UTC، فالفعالية بتاعة النهاردة كانت تبان "منتهية" من الساعة 4 الفجر في
> الإمارات (UTC+4).
>
> **A `date` field is a calendar day, not an instant.** Store it as `DATE`, never
> shift it by a timezone offset, and never send `"2026-04-25T22:00:00Z"` — the
> client would read that in local time and may show a different day.

---

## 📊 9. خارطة الطريق (Roadmap)

### Week 1: Foundation
- [ ] Setup Flask project
- [ ] Configure CORS (مع `Authorization` في `allow_headers`) أو استخدم بروكسي الـ dev
- [ ] Setup JWT auth (مع `exp` و `role` claims)
- [ ] Seed أول أدمن (§4.7)
- [ ] Create database models
- [ ] Implement **`POST /api/admin/login`** ← المسار الصح
- [ ] Implement public GET endpoints (programs, initiatives, events, courses, posts)

### Week 2: Admin & Forms
- [ ] `admin_required` guard على الـ blueprint كله (§4.5)
- [ ] Implement admin CMS CRUD — **21 route تحت `/api/admin/*`**
      (events, posts, programs, initiatives, courses, opportunities, team)
- [ ] Implement contact/meetings/partnerships/**workshops** form endpoints
- [ ] Implement admin messages: GET · **`PUT .../<id>/read`** · DELETE
- [ ] Implement `/api/admin/stats` و `/api/admin/analytics`
      (⚠️ `icon` = اسم أيقونة lucide، مش إيموجي)
- [ ] Implement settings: **`GET`** و `POST /api/admin/settings`

### Week 3: بقية الـ public + Dashboard
- [ ] `/api/team` · `/api/careers` · `/api/games` · `/api/carbon-questions`
- [ ] `GET /api/curricula/download` → **`{ url }` JSON**
- [ ] `POST /api/newsletter/subscribe`
- [ ] `POST /api/ai/chat` (⚠️ المفتاح `prompt` مش `message`)
- [ ] `GET`/`PUT /api/user/profile` + `POST /api/user/carbon-footprint`
- [ ] `POST /api/admin/change-password`

### Week 4: Polish & Deploy
- [ ] `POST /api/upload` (§8.5) — 4 كيانات محتاجاه
- [ ] **SPA history fallback** (§14) — من غيره كل رابط عميق 404
- [ ] Add validation (رسائل عربية مفهومة في 400/422)
- [ ] Add error handling (JSON دايماً، والـ 404 handler مش بياكل مسارات الـ SPA)
- [ ] الـ endpoints الناقصة للأعضاء (§12 في العقد)
- [ ] Write tests · Setup CI/CD · Deploy

---

## ⚠️ 10. الأخطاء الشائعة اللي تتجنبها

### ❌ خطأ 1: عدم تفعيل CORS من البداية
```python
# ❌ غلط — هيبوظ الـ frontend
app = Flask(__name__)

# ✅ صح
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})
```

### ❌ خطأ 2: نسيان Content-Type
```python
# ❌ غلط — الـ frontend مش هيقدر يقرأ الـ response
return jsonify(data)

# ✅ صح
return jsonify(data), 200  # Content-Type: application/json automatically set
```

### ❌ خطأ 3: عدم تطابق الـ Field Names
```python
# ❌ غلط — الفرونت متوقع titleEn مش title_en
return jsonify({"title_en": "..."})

# ✅ صح
return jsonify({"titleEn": "..."})  # استخدم الـ exact naming من الـ contract
```

### ❌ خطأ 4: إرسال Dates كـ Objects
```python
# ❌ غلط — الفرونت متوقع string
return jsonify({"date": event.date})

# ✅ صح
return jsonify({"date": event.date.isoformat()})  # "2026-04-25"
```

### ❌ خطأ 5: عدم تضمين Token في الـ Response
```python
# ❌ غلط
return jsonify({"success": True})

# ✅ صح — لازم يكون فيه token في أعلى مستوى
return jsonify({
    "success": True,
    "token": create_access_token(identity=email, additional_claims={"role": "admin"})
})
```

### ❌ خطأ 6: الـ token جوه `data`
```python
# ❌ غلط — الـ login مش بيعدي على unwrap()، الفرونت مش هيلاقي التوكن
return jsonify({"success": True, "data": {"token": token}})

# ✅ صح
return jsonify({"success": True, "token": token})
```

### ❌ خطأ 7: `200` مع `success: false` بدل status code
```python
# ❌ غلط — الفرونت بيعتبرها نجاح وبيعرض بيانات فاضية
return jsonify({"success": False, "error": "Not found"}), 200

# ✅ صح
return jsonify({"success": False, "error": "Program not found"}), 404
```

### ❌ خطأ 8: `401` في مكان غلط
```python
# ❌ غلط — أي 401 بره الـ login بيمسح جلسة الأدمن ويطرده من الـ CMS
@app.route("/api/user/profile")
def profile():
    if not current_user:
        return jsonify({"error": "login required"}), 401

# ✅ صح — 403 أو 200 ببيانات افتراضية
    return jsonify({"error": "Not allowed"}), 403
```

### ❌ خطأ 9: `request.get_json()` على `DELETE`
```python
# ❌ غلط — الـ DELETE بيتبعت من غير body ومن غير Content-Type → 400
@app.route("/api/admin/events/<id>", methods=["DELETE"])
@admin_required
def delete_event(id):
    data = request.get_json()          # 💥

# ✅ صح
    Event.query.filter_by(id=id).delete()
    db.session.commit()
    return jsonify({"success": True})
```
> الاستثناء الوحيد اللي **بياخد** body هو
> `PUT /api/admin/messages/<id>/read` → `{"isRead": true}`.

### ❌ خطأ 10: `POST`/`PUT` بترجع `{success: true}` بس
```python
# ❌ غلط — الـ CMS بيحقن الرد في الجدول على طول، فالصف يطلع فاضي
return jsonify({"success": True}), 201

# ✅ صح — رجّع الكيان كامل مع الـ id اللي السيرفر ولّده
return jsonify(new_event.to_dict()), 201
```

### ❌ خطأ 11: `null` بدل `[]`
```python
# ❌ غلط — لستة فاضية مش خطأ، ومتردّش 404 عليها
return jsonify(None), 404

# ✅ صح — الواجهة عندها "empty state" جاهزة للـ []
return jsonify([]), 200
```

---

## 🆘 11. حل المشاكل الشائعة

### المشكلة: CORS Error في الـ Console
**الحل:** تأكد إن الـ CORS مفعّل و **`Authorization` مسموح** — الفرونت بيبعت
الهيدر ده في كل request لو فيه توكن، وده بيخلي المتصفح يعمل preflight:
```python
CORS(app, resources={r"/api/*": {
    "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
}})
```
**أسهل حل محلياً:** استخدم بروكسي الـ dev (`VITE_API_BASE_URL=/api`) — مفيش CORS
خالص (Step 4-alt).

### المشكلة: كل الطلبات بترجع 404 (حتى `/api/programs`)
**الحل:** غالباً `VITE_API_BASE_URL` من غير `/api`. لازم تكون
`http://127.0.0.1:5000/api` (أو `/api` لو بتستخدم البروكسي).
وتأكد إنك مسحتش الـ `.env` بـ `echo ... > .env`.

### المشكلة: 401 Unauthorized
**الحل:** الفرونت بيبعت `Authorization: Bearer <token>` تلقائياً لو فيه توكن.
شيّك على:
1. `Authorization` موجود في `allow_headers` بتاع CORS.
2. الـ `JWT_SECRET_KEY` هو نفسه اللي وقّعت بيه التوكن (متغيّرهوش بين الـ restarts).
3. التوكن لسه مش منتهي (`exp`).
4. **وخد بالك:** أي `401` بره الـ login بيعمل logout للأدمن — فمتستخدمهاش بمعنى
   تاني (§4.6).

### المشكلة: الأدمن بيتطرد من الـ CMS كل شوية
**الحل:** فيه route بيرجّع `401` وهو مفروض يرجّع `403` أو `404` أو `200`. دوّر على
أي `401` بترجعه من `/api/user/*` أو من قراءات فاضية.

### المشكلة: الأدمن يعمل login وبعد الـ refresh الجلسة ضايعة
**الحل:** التوكن مش JWG صالح: لازم **تلات أجزاء** وفيه **`exp` رقمي**. الفرونت
بيفك الـ payload ويرفض أي توكن opaque (§4.3).

### المشكلة: 404 Not Found على route معرّف
**الحل:** تأكد إن الـ route معرّف بشكل صحيح. مثلاً:
- ✅ `@app.route("/api/posts/<id>", methods=["GET"])`
- ❌ `@app.route("/api/posts?id=<id>", methods=["GET"])`
- ⚠️ ولاحظ المسارات اللي بتتلخبط كتير:
  `/api/admin/login` · `/api/workshops` · `/api/carbon-questions` ·
  `/api/user/carbon-footprint` · `/api/admin/messages/<id>/read`

### المشكلة: `/events` بيرجع 404 لما أعمل refresh (بعد الـ deploy)
**الحل:** ناقص **SPA history fallback** — §14. والـ `@app.errorhandler(404)`
الافتراضي بيكسره، فلازم تعمله path-aware (§8.4).

### المشكلة: صفحة بتعرض بانر خطأ أحمر بدل البيانات
**الحل:** ده **مقصود** — مفيش mock fallback بعد الآن. افتح Network tab في
المتصفح، شوف الـ request الأحمر، وصلّح الـ endpoint. الرسالة نفسها بتقولك النوع:
"تعذّر الاتصال بالخادم" = مفيش رد/CORS/timeout · "حدث خطأ في الخادم" = 5xx ·
"العنصر المطلوب غير موجود" = 404.

### المشكلة: البيانات ظاهرة بس مش بيانات السيرفر
**الحل:** `VITE_USE_MOCK_API` لسه `true`. حطّها `false` وأعد تشغيل `npm run dev`
(متغيرات Vite بتتقرا عند الإقلاع بس).

### المشكلة: 500 Internal Server Error
**الحل:** شوف الـ Flask logs:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### المشكلة: Database Errors
**الحل:** استخدم migrations:
```bash
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

---

## 🌍 14. تقديم الواجهة نفسها — SPA history fallback (إلزامي)

الواجهة SPA بتستخدم `BrowserRouter` (History API، بدون `#`). أي سيرفر بيخدم
`dist/` **لازم** يرجّع `index.html` لأي مسار مش ملف موجود ومش `/api/*`.

**Without this, every deep link 404s.** الصفحة الرئيسية تشتغل، بس أول ما المستخدم
يعمل refresh على `/events` أو يفتح `/blog/some-id` مباشرة → 404 من السيرفر.

**المسارات اللي لازم ترجّع `index.html`:**
`/` `/about` `/programs` `/events` `/learning-hub` `/media` `/blog/:id`
`/contact` `/games` `/opportunities` `/portals` `/dashboard` `/admin/*`

```python
import os
from flask import send_from_directory, jsonify

DIST = os.path.join(os.path.dirname(__file__), "..", "climatify", "dist")
app = Flask(__name__, static_folder=DIST, static_url_path="")

# ⚠️ لازم يتسجّل بعد كل routes الـ API — عشان ما يلتهمهاش
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404          # الـ API يرد JSON دايماً
    full = os.path.join(app.static_folder, path)
    if path and os.path.isfile(full):
        return send_from_directory(app.static_folder, path)   # assets حقيقية
    return send_from_directory(app.static_folder, "index.html")
```

وكمان صلّح الـ `404` handler زي ما في §8.4، وإلا هيسبق الـ catch-all.

لو بتستخدم سيرفر ويب تاني:
```nginx
location / { try_files $uri $uri/ /index.html; }
location /api/ { proxy_pass http://127.0.0.1:5000; }
```
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_URI} !^/api/
RewriteRule . /index.html [L]
```
Netlify: `/* /index.html 200` · Vercel: rewrite `/(.*)` → `/index.html`.

**اختبار:**
```bash
curl -i http://127.0.0.1:5000/events     # لازم HTML 200 — مش JSON 404
curl -i http://127.0.0.1:5000/api/nope   # لازم JSON 404
```

---

## 📞 15. معلومات التواصل والروابط

- **الـ Frontend Repo:** `d:\lab\climatify\ui\climatify`
- **الـ Frontend Dev Port:** `http://localhost:5173` (ثابت — `strictPort: true`)
- **الـ Backend Dev Port:** `http://127.0.0.1:5000`
- **الـ Environment Variable:** `VITE_API_BASE_URL=http://127.0.0.1:5000/api`
  ← **لاحظ الـ `/api`** · أو `VITE_API_BASE_URL=/api` مع بروكسي الـ dev.

### روابط مفيدة:
- **API Contract (المرجع الملزم):** [`docs/API_CONTRACT.md`](API_CONTRACT.md)
- **Handoff Summary (جدول سريع):** [`docs/BACKEND_HANDOFF_SUMMARY.md`](BACKEND_HANDOFF_SUMMARY.md)
- **Frontend Audit Report:** [`docs/FRONTEND_AUDIT_REPORT.md`](FRONTEND_AUDIT_REPORT.md)
- **Frontend README:** [`README.md`](../README.md)
- **الحقيقة النهائية للمسارات:** `src/services/api.ts`

---

## ✅ 16. Checklist قبل ما تقول "خلصت"

**المسارات الحرجة (أكثر حاجة بتتلخبط):**
- [ ] `POST /api/admin/login` — مش `/api/auth/login`
- [ ] `POST /api/workshops` — مش `/api/education-workshops`
- [ ] `GET /api/carbon-questions` — مش `/api/games/carbon-questions`
- [ ] `POST /api/user/carbon-footprint` — تحت `/user/`
- [ ] `PUT /api/admin/messages/<id>/read` — بالـ `/read` وبياخد body
- [ ] كل الـ CMS CRUD تحت `/api/admin/*` (21 route)
- [ ] `GET /api/admin/settings` موجود (جديد)
- [ ] `POST /api/ai/chat` بيقرا **`prompt`** مش `message`
- [ ] `GET /api/curricula/download` بيرجّع **`{ url }` JSON**

**الأمان:**
- [ ] كل `/api/admin/*` عليه `@jwt_required()` **و** فحص `role == "admin"`
- [ ] التوكن JWT بتلات أجزاء وفيه `exp` رقمي و `role` claim، و `token` top-level
- [ ] الباسوردات hashed، وأول أدمن معمول seed من متغير بيئة مش hardcoded
- [ ] مفيش `401` غير على login/change-password والجلسات المنتهية فعلاً

**الأشكال:**
- [ ] الأسماء `camelCase` بالحرف (`titleEn` مش `title_en`)
- [ ] كل التواريخ `YYYY-MM-DD` من غير أي جزء وقت
- [ ] الأنواع مطابقة (`AdminStats` strings · `progress` number · `isRead` boolean ·
      كل `id` string · `icon` اسم lucide مش إيموجي)
- [ ] المحتوى بلغتين والاتنين مش فاضيين
- [ ] لستة فاضية = `[]` مع 200 — مش `null` ومش 404
- [ ] `POST`/`PUT` في الـ CMS بترجّع الكيان الكامل مع الـ `id`
- [ ] الأخطاء JSON، والفشل status غير 2xx مش `success:false` مع 200

**التكامل:**
- [ ] CORS بيسمح بـ `Authorization` والـ `OPTIONS` شغال (أو بروكسي الـ dev)
- [ ] SPA fallback شغال — `/events` بيرجّع HTML بعد الـ build (§14)
- [ ] لفّة كاملة على كل صفحات الواجهة بـ `VITE_USE_MOCK_API=false`
      **من غير أي بانر خطأ** (§7.5)

**لو كل الـ items دي ✅، أنت جاهز للـ production!** 🚀

---

> **Last Updated:** 2026-07-26
> **Version:** 2.0 — synced with `src/services/api.ts` (v2.0 contract)
> **Target:** Flask Backend Developer
