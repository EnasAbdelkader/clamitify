# Climatify Deployment Guide

This document describes how to deploy the Climatify application (React+Vite+TypeScript frontend, Flask backend, SQLite/PostgreSQL database) to production.

## Prerequisites

- Python 3.11+
- Node.js 18+ (for frontend build)
- A production WSGI server (Gunicorn, uWSGI, etc.)
- Reverse proxy (nginx, Caddy, Apache)
- SSL/TLS certificates (Let's Encrypt or similar)

---

## Frontend Deployment

### 1. Install Dependencies

```bash
npm ci
```

### 2. Configure Environment

Copy the example and edit for production:

```bash
cp .env.example .env
```

**Required production variables in `.env`:**

```env
# API base URL - MUST include /api prefix
# Use your production API domain, e.g.:
VITE_API_BASE_URL=https://api.yourdomain.com/api

# Disable mock mode (default is false, but be explicit)
VITE_USE_MOCK_API=false

# Optional: App title
VITE_APP_TITLE=Climatify - Climate Innovation Platform
```

### 3. Build for Production

```bash
npm run build
```

This creates a `dist/` directory with optimized static assets.

### 4. Serve Static Files

Configure your web server to serve the `dist/` directory:

**nginx example:**
```nginx
server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;
    root /path/to/climatify/dist;
    index index.html;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API requests proxied to backend (see backend section)
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Backend Deployment

### 1. Create Virtual Environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or .venv\Scripts\activate  # Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

**Required production variables in `backend/.env`:**

```env
# JWT Secret - MUST be 32+ characters, generate with:
# python -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_SECRET_KEY=your-32-plus-character-random-secret-here

# Database - use absolute path for SQLite, or PostgreSQL URL
# SQLite example:
DATABASE_URL=sqlite:////var/lib/climatify/climatify.db
# PostgreSQL example:
# DATABASE_URL=postgresql://user:pass@localhost/climatify

# Admin bootstrap credentials
ADMIN_BOOTSTRAP_EMAIL=admin@yourdomain.com
ADMIN_BOOTSTRAP_PASSWORD=strong-random-password-here

# CORS - MUST be your actual frontend domain(s), comma-separated
CORS_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com

# Upload directory - absolute path
UPLOAD_FOLDER=/var/lib/climatify/uploads

# Frontend build directory for SPA fallback
FRONTEND_DIST=/path/to/climatify/dist

# Rate limiting
RATE_LIMIT_PER_MINUTE=120

# AI provider (optional)
AI_PROVIDER_URL=
AI_PROVIDER_KEY=

# Port (internal, behind reverse proxy)
PORT=5000

# IMPORTANT: Do NOT set FLASK_ENV=development in production!
# Leave unset or set to: production
```

### 4. Run Database Migrations

```bash
flask db upgrade
```

This applies all migrations from the `migrations/versions/` directory to create the complete schema.

### 5. Seed Initial Data

```bash
flask seed-admin
```

This creates the admin user and seeds default content (courses, events, programs).

### 6. Start Production Server

**Using Gunicorn (recommended):**

```bash
gunicorn --bind 127.0.0.1:5000 --workers 4 --threads 2 --timeout 120 "backend.app:create_app()"
```

**Using uWSGI:**

```bash
uwsgi --http-socket 127.0.0.1:5000 --module backend.app:create_app --master --processes 4 --threads 2
```

### 7. Configure Reverse Proxy

**nginx example (in the same server block as frontend or separate):**

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}

# Uploaded files
location /api/uploads/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_cache_valid 200 1d;
}
```

### 8. Process Management

Use systemd, supervisor, or Docker to manage the backend process:

**systemd example (`/etc/systemd/system/climatify-backend.service`):**
```ini
[Unit]
Description=Climatify Backend
After=network.target

[Service]
Type=exec
User=climatify
WorkingDirectory=/opt/climatify/backend
EnvironmentFile=/opt/climatify/backend/.env
ExecStart=/opt/climatify/backend/.venv/bin/gunicorn --bind 127.0.0.1:5000 --workers 4 --threads 2 "backend.app:create_app()"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable climatify-backend
sudo systemctl start climatify-backend
```

---

## Production Checklist

Before going live, verify:

- [ ] `JWT_SECRET_KEY` is 32+ characters and kept secret
- [ ] `CORS_ORIGINS` matches your frontend domain(s) exactly
- [ ] `DATABASE_URL` uses absolute path (SQLite) or proper PostgreSQL connection string
- [ ] `UPLOAD_FOLDER` exists and is writable by the backend user
- [ ] `FRONTEND_DIST` points to the built frontend `dist/` directory
- [ ] `FLASK_ENV` is NOT set to `development`
- [ ] SSL/TLS is configured on the reverse proxy
- [ ] Database migrations applied: `flask db upgrade`
- [ ] Admin seeded: `flask seed-admin`
- [ ] Frontend `VITE_API_BASE_URL` points to the production API endpoint
- [ ] Frontend `VITE_USE_MOCK_API=false`
- [ ] Reverse proxy forwards `X-Forwarded-Proto` and `Host` headers
- [ ] Upload directory is not directly accessible via web (served through `/api/uploads/` endpoint only)

---

## Database Persistence

### SQLite (Development/Small Deployments)

- Database file location: `/var/lib/climatify/climatify.db` (configured via `DATABASE_URL`)
- Must be on persistent storage (not ephemeral container filesystem)
- Backup regularly: `sqlite3 /var/lib/climatify/climatify.db .dump > backup.sql`

### PostgreSQL (Recommended for Production)

- Use managed PostgreSQL (RDS, Cloud SQL, etc.) or self-hosted
- Connection string: `postgresql://user:pass@host:5432/dbname`
- Enable connection pooling (PgBouncer) for high traffic
- Regular automated backups

---

## File Uploads

- Uploaded files stored in `UPLOAD_FOLDER` (default: `backend/uploads/`)
- Only PNG, JPEG, WebP images allowed (validated by magic bytes)
- Max file size: 5MB (configured via `MAX_CONTENT_LENGTH`)
- Files served via `GET /api/uploads/<filename>` — no direct filesystem access
- Ensure `UPLOAD_FOLDER` is on persistent storage and backed up

---

## Monitoring & Logs

- Application logs to stdout/stderr (capture via systemd/journald or Docker logging)
- Key metrics: request latency, error rates, rate limit hits
- Audit logs stored in `audit_logs` table (admin actions, uploads, etc.)
- Analytics events in `analytics_events` table

---

## Security Notes

- Never commit `.env` files to version control
- Rotate `JWT_SECRET_KEY` periodically (invalidates all existing sessions)
- Use strong `ADMIN_BOOTSTRAP_PASSWORD` and change after first login
- Keep dependencies updated: `pip-audit` / `npm audit`
- Run behind HTTPS only — no plain HTTP in production
- The Flask development server (`flask run`) is NOT for production use

---

## Quick Start Summary

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with production values
flask db upgrade
flask seed-admin
gunicorn --bind 127.0.0.1:5000 --workers 4 "backend.app:create_app()"

# Frontend (separate machine or same)
npm ci
cp .env.example .env
# Edit .env with VITE_API_BASE_URL=https://your-api-domain.com/api
npm run build
# Serve dist/ via nginx/Caddy
```