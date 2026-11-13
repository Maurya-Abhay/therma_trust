
# ❄️ ThermaTrust
### HVAC/R Maintenance & Technician Verification Platform

<p align="center">
  <strong>Smarter Maintenance. Trusted Technicians. Better Facilities.</strong>
</p>

<p align="center">
  ![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
  ![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)
  ![Django](https://img.shields.io/badge/Django-092E20?logo=django&logoColor=white)
  ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
  ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
</p>

---

## 🌟 Overview

ThermaTrust is an HVAC/R maintenance and technician-verification platform designed to simplify facility management, contractor operations, technician verification, and maintenance workflows.

The platform includes:

- 🌐 Web dashboard built with Next.js and React.
- 📱 Android and iOS application built with Expo.
- ⚙️ Django REST API with PostgreSQL support.
- 🟢 Alternative Node.js REST API with MongoDB support.
- 🔐 JWT authentication and role-based authorization.
- 📋 Maintenance jobs, service reports, and technician credentials.

## ✨ Features

| Feature | Description |
|---|---|
| 🏢 Facility Management | Manage facilities and equipment. |
| 👨‍🔧 Technician Management | Manage technician profiles and qualifications. |
| 🪪 Verification | Verify technician credentials. |
| 📋 Job Management | Create and track maintenance jobs. |
| 📝 Service Reports | Maintain service records and evidence. |
| 🏗️ Contractor Management | Manage companies, teams, and compliance. |
| 🔐 Authentication | Secure JWT-based authentication. |
| 📱 Mobile App | Android and iOS support. |
| 📂 Documents | Upload credentials and service photos. |

## 👥 User Roles

- **Admin:** Platform-wide administration and verification.
- **Facility Manager:** Manage facilities, equipment, and jobs.
- **Contractor Manager:** Manage contractor companies, teams, and documents.
- **Technician:** Manage credentials, assigned jobs, and service reports.

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Mobile | Expo, React Native, TypeScript |
| Backend 1 | Django REST Framework |
| Backend 2 | Node.js, Express |
| Database 1 | Supabase PostgreSQL |
| Database 2 | MongoDB Atlas |
| Authentication | JWT |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Mobile Builds | Expo EAS |

## 📁 Project Structure

```text
ThermaTrust/
├── frontend/       # Next.js Website
├── backend/        # Django REST API
├── server/         # Node.js REST API
├── mobile/         # Expo Mobile Application
├── .gitignore
└── README.md
```

## 🏗️ Backend Architecture

ThermaTrust provides two alternative backend implementations.

### 🐍 Django + Supabase (Recommended)

- Django REST Framework.
- PostgreSQL database.
- Supabase-managed hosting.
- Relational data architecture.

### 🟢 Node.js + MongoDB (Alternative)

- Node.js and Express.
- MongoDB Atlas.
- Document-based database architecture.

**Important:** Deploy only one backend for a single installation. Supabase is PostgreSQL hosting, not MongoDB hosting.

## 🔄 Switching Between Backends

Both clients use the common `/api` route prefix.

Website environment:

```env
THERMATRUST_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Mobile environment:

```env
EXPO_PUBLIC_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

To switch backends:

1. Deploy the alternative backend.
2. Configure its database.
3. Update the website API URL.
4. Update the mobile API URL.
5. Rebuild and redeploy the clients.

**Database Warning:** Changing the API URL does not migrate data. PostgreSQL and MongoDB are independent databases. Plan and test data and file migration before switching a live installation.

## ⚙️ Prerequisites

Install:

- [Node.js](https://nodejs.org/)
- [Python](https://www.python.org/)
- [Git](https://git-scm.com/)
- [Supabase](https://supabase.com/) or local PostgreSQL.
- [MongoDB Atlas](https://www.mongodb.com/atlas) for the alternative backend.
- [Expo](https://expo.dev/) for mobile development.

Docker is not required.

## 💻 Local Development

### 1. Django Backend

```bash
cd backend
```

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=YOUR_SUPABASE_POSTGRESQL_URI
```

Install and run:

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### 2. Node.js Backend

```bash
cd server
```

Copy `.env.example` to `.env`:

```env
MONGODB_URI=YOUR_MONGODB_ATLAS_URI
```

Run:

```bash
npm ci
npm start
```

### 3. Frontend Website

```bash
cd frontend
```

Create `.env.local`:

```env
THERMATRUST_API_BASE_URL=http://localhost:8000/api
```

Run:

```bash
npm ci
npm run dev
```

### 4. Mobile Application

```bash
cd mobile
```

Create `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR-COMPUTER-LAN-IP:8000/api
```

Run:

```bash
npm ci
npx expo start
```

**Physical Device:** Use your computer's LAN IP instead of `localhost`. Keep your phone and computer connected to the same Wi-Fi network.

## 🌐 Deployment

### Frontend — Vercel

1. Import the GitHub repository.
2. Set Root Directory to `frontend`.
3. Framework: Next.js.
4. Install Command: `npm ci`.
5. Build Command: `npm run build`.
6. Add the environment variable:

```env
THERMATRUST_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

7. Deploy and configure the Vercel origin in backend CORS settings.

### Backend — Render (Django)

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python |
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput` |
| Start Command | `python manage.py migrate --noinput && gunicorn config.wsgi:application --workers 2 --timeout 120` |
| Health Check | `/api/health/` |

Environment variables:

```env
SECRET_KEY=YOUR_UNIQUE_SECRET
DEBUG=False
ALLOWED_HOSTS=YOUR-RENDER-HOSTNAME
DATABASE_URL=YOUR_SUPABASE_POSTGRESQL_URI
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
```

Configure SMTP:

```env
EMAIL_BACKEND=YOUR_EMAIL_BACKEND
EMAIL_HOST=YOUR_SMTP_HOST
EMAIL_PORT=YOUR_SMTP_PORT
EMAIL_HOST_USER=YOUR_SMTP_USERNAME
EMAIL_HOST_PASSWORD=YOUR_SMTP_PASSWORD
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=YOUR_VERIFIED_EMAIL
```

Create the first administrator from a secure Render shell:

```bash
python manage.py createsuperuser
```

### Backend — Render (Node.js)

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check | `/api/health/` |

Environment variables:

```env
NODE_ENV=production
JWT_SECRET=YOUR_UNIQUE_SECRET
MONGODB_URI=YOUR_MONGODB_ATLAS_URI
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
PUBLIC_API_URL=https://your-api.onrender.com
UPLOAD_DIR=YOUR_PERSISTENT_PRIVATE_DISK_PATH
```

SMTP configuration:

```env
SMTP_HOST=YOUR_SMTP_HOST
SMTP_PORT=YOUR_SMTP_PORT
SMTP_USER=YOUR_SMTP_USERNAME
SMTP_PASSWORD=YOUR_SMTP_PASSWORD
SMTP_SECURE=YOUR_SMTP_SECURITY_SETTING
DEFAULT_FROM_EMAIL=YOUR_VERIFIED_EMAIL
```

Create the first administrator using a secure Render shell:

```bash
npm run user -- create-admin
```

Set `MONGODB_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the shell before running the command. Unset `ADMIN_PASSWORD` immediately after successful creation.

## 📱 Mobile Production Builds

Install EAS CLI:

```bash
npm install -g eas-cli
eas login
```

Configure the deployed API URL in the EAS environment:

```env
EXPO_PUBLIC_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Android:

```bash
cd mobile
eas build --platform android --profile production
```

iOS:

```bash
eas build --platform ios --profile production
```

Build profiles are available in `mobile/eas.json`.

## 🔐 API & Authentication

Both backends use JWT Bearer Authentication for protected routes.

Example:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Security rules:

- Protected routes require authentication.
- API permissions enforce user roles.
- Record ownership is checked by the backend.
- Public verification routes expose only intentionally published information.
- Hiding frontend screens is not a substitute for backend authorization.

## 📚 API Documentation

| Backend | Documentation |
|---|---|
| Django | [backend/API.md](backend/API.md) |
| Node.js | [server/API.md](server/API.md) |

Both implementations use the `/api` prefix and JWT authentication. Their database implementations remain independent, so test compatibility before changing production backends.

## 🛡️ Production Checklist

### Security

- [ ] Generate strong production secrets.
- [ ] Set Django `DEBUG=False`.
- [ ] Configure exact CORS origins.
- [ ] Configure trusted CSRF origins.
- [ ] Enable HTTPS.
- [ ] Protect database credentials.
- [ ] Never commit `.env` files.
- [ ] Restrict database network access.
- [ ] Verify roles and permissions.

### Storage

- [ ] Configure private persistent file storage.
- [ ] Configure backups.
- [ ] Review document access permissions.
- [ ] Configure retention policies.
- [ ] Protect technician credentials and service photos.

**Important:** Both backends currently use local filesystem upload paths. Render's ephemeral filesystem can lose files during redeployment. Configure durable storage before accepting real production documents.

A persistent disk is not automatically encrypted object storage.

### Testing

- [ ] Login and logout.
- [ ] Token refresh.
- [ ] Role-based permissions.
- [ ] Facility and equipment management.
- [ ] Job assignment.
- [ ] Technician verification.
- [ ] Document uploads and downloads.
- [ ] Service reports.
- [ ] Password reset.
- [ ] Email notifications.
- [ ] Data exports.
- [ ] Database backups.
- [ ] Android and iOS builds.
- [ ] Physical-device permissions.

A successful local build does not guarantee production readiness. Configure and test SMTP, push notifications, OCR providers, storage, backups, and monitoring in their target environments.

## 📦 Repository Information

The ZIP distribution includes:

- `frontend/`
- `backend/`
- `server/`
- `mobile/`
- `README.md`
- `.gitignore`

It does not include Docker configuration, GitHub workflows, Git history, or production `.env` secrets.

## 🤝 Contributing

Contributions, bug reports, improvements, and feature suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Test the affected application.
5. Submit a pull request.

Never commit passwords, API keys, database credentials, or private user information.

## 📌 Important Notes

- Use only one backend per installation unless intentionally operating separate environments.
- PostgreSQL and MongoDB do not synchronize automatically.
- Keep `/api` at the end of the API base URL.
- Configure persistent file storage before production.
- Test authentication, permissions, uploads, and migrations before release.

---

<p align="center">

### ❄️ ThermaTrust

**Smarter Maintenance. Trusted Technicians. Better Facilities.**

</p>
