# 🚀 Node REST API Reference

**Backend:** Express.js + MongoDB (MongoDB Atlas-compatible)  
**Base URL:** `https://YOUR-API-HOST/api`  
**Authentication:** JWT Bearer Token  
**Response Format:** JSON  
**File Upload:** Multipart Form Data

---

## 📑 Table of Contents — Part 1

1. API Overview
2. Authentication & Authorization
3. User Roles & Permissions
4. Health & Authentication APIs
5. Dashboard & Platform APIs
6. Facilities & Equipment APIs
7. Contractors & Contractor Documents APIs
8. Technicians & Professional Records APIs

---

## 1. 📌 API Overview

| Component | Technology |
|---|---|
| Backend | Express.js |
| Database | MongoDB |
| Database Hosting | MongoDB Atlas-compatible |
| Authentication | JWT |
| API Architecture | REST API |
| Response Format | JSON |
| File Upload | Multipart Form Data |

**General Rules:**
- Protected routes require JWT authentication.
- List routes generally return paginated responses.
- Normal writes use JSON.
- File uploads use `multipart/form-data`.
- Access is restricted by role, ownership, assignment and company membership.

## 2. 🔐 Authentication & Authorization

**Authorization Header:**

`Authorization: Bearer <access_token>`

| Token | Purpose |
|---|---|
| Access Token | Access protected endpoints |
| Refresh Token | Rotate JWT tokens |

**Authentication Flow:**
1. Register an account.
2. Login and receive JWT tokens.
3. Send the access token with protected requests.
4. Refresh tokens when required.
5. Retrieve account details using `/auth/me/`.

## 3. 👥 User Roles & Permissions

| Role | Permissions |
|---|---|
| 🌍 Public | Access public endpoints |
| 👤 Authenticated User | Access permitted role-scoped records |
| 🏢 Facility Manager | Manage own facilities, equipment and related jobs |
| 👨‍🔧 Technician | Manage own profile, credentials, capabilities and work history |
| 🏗️ Contractor Manager | Manage own company, connected team and compliance |
| 🛡️ Admin | Platform-wide administration and reviews |

**Role Responsibilities:**

- **Facility Manager:** Manages own facilities, equipment, related jobs and service evidence.
- **Technician:** Manages professional records, accesses assigned jobs and submits related service reports.
- **Contractor Manager:** Manages own company, connected technicians and compliance documents.
- **Admin:** Handles platform-wide reviews and administrative operations.
- **Public:** Accesses published technician verification information.

> ⚠️ Roles do not grant unrestricted access. Server-side object ownership and permission checks always apply.

## 4. ❤️ Health & Authentication APIs

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health/` | Public | API and database health check |
| POST | `/auth/register/` | Public | Register user |
| POST | `/auth/login/` | Public | Login and receive JWT tokens |
| POST | `/auth/refresh/` | Refresh Token | Rotate JWT tokens |
| GET | `/auth/me/` | Authenticated | Get current user |
| PATCH | `/auth/me/` | Authenticated | Update own account |
| POST | `/auth/password-reset/` | Public | Request password reset email |
| POST | `/auth/password-reset/confirm/` | Reset Token | Set a new password |

**Supported Registration Roles:**
- Facility Manager
- Technician
- Contractor Manager

## 5. 📊 Dashboard & Platform APIs

### Dashboard & Notifications

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/choices/` | Authenticated | Dropdown choices and status values |
| GET | `/alerts/` | Authenticated | Role-scoped alerts |
| GET | `/notifications/` | Authenticated | Own notifications and unread count |
| POST | `/notifications/read/` | Authenticated | Mark notifications as read (`ids` or `all`) |
| GET | `/search/?q=...` | Authenticated | Role-scoped global search |
| GET | `/onboarding/` | Authenticated | Current user's onboarding checklist |

### Web Push Notifications

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/notifications/push/key/` | Authenticated | Get Web Push public key/status |
| POST | `/notifications/push/subscribe/` | Authenticated | Save push subscription |
| POST | `/notifications/push/unsubscribe/` | Authenticated | Remove push subscription |
| POST | `/notifications/push/test/` | Authenticated | Send test notification |

### Admin & Scheduled Operations

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/admin/dashboard/` | Admin | Admin overview and pending reviews |
| GET | `/audit/verify/` | Admin | Verify audit-chain integrity |
| POST | `/alerts/send-digest/` | Cron Caller | Trigger daily email digest |

**Cron Authentication Header:** `X-Cron-Token: <cron_secret_token>`

### Refrigerant Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/refrigerant-types/` | Authenticated | List refrigerant types |
| GET | `/refrigerant-types/{id}/` | Authenticated | Get refrigerant type details |

## 6. 🏢 Facilities & Equipment APIs

### Facilities

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/facilities/` | Facility Owner / Assigned Technician / Contractor Manager / Admin | List accessible facilities |
| POST | `/facilities/` | Facility Manager | Create an owned facility |
| GET | `/facilities/{id}/` | Related Roles | Get facility details |
| PUT | `/facilities/{id}/` | Facility Owner | Replace facility details |
| PATCH | `/facilities/{id}/` | Facility Owner | Update facility details |
| DELETE | `/facilities/{id}/` | Facility Owner | Delete facility |

### Equipment

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/equipment/` | Facility Owner / Assigned Technician / Contractor Manager / Admin | List accessible equipment |
| POST | `/equipment/` | Facility Owner / Admin | Register equipment at an accessible facility |
| GET | `/equipment/{id}/` | Related Roles | Get equipment details |
| PUT | `/equipment/{id}/` | Facility Owner / Admin | Replace equipment details |
| PATCH | `/equipment/{id}/` | Facility Owner / Admin | Update equipment |
| DELETE | `/equipment/{id}/` | Facility Owner / Admin | Delete equipment |
| GET | `/equipment/{id}/label/` | Scoped Access | Download/print equipment label |
| GET | `/equipment/{id}/history/` | Scoped Access | View equipment history |

**Access Rules:**
- Facility Managers can create and manage their own facilities.
- Assigned technicians can access related facilities and equipment.
- Contractor Managers can access facilities and equipment related to their company.
- Admins have authorized administrative access.
- Equipment registration requires an accessible facility.

## 7. 🏗️ Contractors & Contractor Documents APIs

### Contractor Companies

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractors/` | Manager / Admin | List permitted companies |
| POST | `/contractors/` | Contractor Manager | Register own company |
| GET | `/contractors/{id}/` | Scoped Access | Get company details |
| PUT | `/contractors/{id}/` | Company Owner | Update company details |
| PATCH | `/contractors/{id}/` | Company Owner | Partially update company details |
| DELETE | `/contractors/{id}/` | Company Owner | Delete company |

### Contractor Team Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractors/{id}/technicians/` | Manager / Admin | View company technician roster |
| POST | `/contractors/{id}/add-technician/` | Contractor Manager | Add technician to own company |
| POST | `/contractors/{id}/remove-technician/` | Contractor Manager | Remove technician from own company |

### Contractor Compliance

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractors/{id}/compliance/` | Manager / Admin | Company compliance summary |
| GET | `/contractors/{id}/pending-approvals/` | Manager / Admin | Pending team capability count |
| POST | `/contractors/{id}/verify/` | Admin | Verify contractor company |

### Contractor Documents

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractor-documents/` | Manager / Admin | List company compliance documents |
| POST | `/contractor-documents/` | Contractor Manager | Upload compliance document |
| GET | `/contractor-documents/{id}/` | Scoped Access | Read document |
| DELETE | `/contractor-documents/{id}/` | Owner / Admin | Delete document |
| POST | `/contractor-documents/{id}/verify/` | Admin | Approve/reject document |

**Access Rules:**
- Managers can manage only their own companies.
- Technician roster access is company-scoped.
- Compliance records are restricted to authorized managers and Admin.
- Company and document verification is Admin-only.

## 8. 👨‍🔧 Technicians & Professional Records APIs

### Technician Profiles

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/technicians/` | Admin / Contractor Manager / Technician / Facility Manager | List permitted technician profiles |
| GET | `/technicians/me/` | Technician | Get own technician profile |
| GET | `/technicians/{id}/` | Scoped Access | Get technician details |
| PUT | `/technicians/{id}/` | Technician Owner / Admin | Update technician profile |
| PATCH | `/technicians/{id}/` | Technician Owner / Admin | Partially update technician profile |

**Technician Listing Rules:**
- Admin can view all permitted technician profiles.
- Contractor Managers can view their own company team.
- Technicians can view themselves.
- Facility Managers can view technicians assigned to their jobs.

### Professional Credentials

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/credentials/` | Scoped Access | List credentials |
| POST | `/credentials/` | Technician Owner / Admin | Add credential with evidence |
| GET | `/credentials/{id}/` | Scoped Access | Get credential details |
| PUT | `/credentials/{id}/` | Technician Owner / Admin | Update credential |
| PATCH | `/credentials/{id}/` | Technician Owner / Admin | Partially update credential |
| DELETE | `/credentials/{id}/` | Technician Owner / Admin | Delete credential |
| POST | `/credentials/extract/` | Technician | AI-assisted credential extraction |
| POST | `/credentials/{id}/ai-check/` | Admin | Run AI credential comparison |
| POST | `/credentials/{id}/verify/` | Admin | Review credential status |

**Credential Listing Rules:**
- Technicians can view their own credentials.
- Contractor Managers can view credentials of their own team.
- Admins can view all credentials.

**AI Credential Extraction:**
- Endpoint: `POST /credentials/extract/`
- Content-Type: `multipart/form-data`
- Access: Technician

### Technician Capabilities

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/capabilities/` | Scoped Access | List capabilities |
| POST | `/capabilities/` | Technician Owner / Admin | Submit capability evidence |
| GET | `/capabilities/{id}/` | Scoped Access | Get capability details |
| PUT | `/capabilities/{id}/` | Technician Owner / Admin | Update capability |
| PATCH | `/capabilities/{id}/` | Technician Owner / Admin | Partially update capability |
| DELETE | `/capabilities/{id}/` | Technician Owner / Admin | Delete capability |
| POST | `/capabilities/{id}/verify/` | Admin / Owning Contractor Manager | Verify capability |

**Capability Listing Rules:**
- Technicians can view their own capabilities.
- Contractor Managers can view their own team's capabilities.
- Admins can view all capabilities.

### Technician Work History

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/work-history/` | Scoped Access | List work history |
| POST | `/work-history/` | Technician Owner / Admin | Add work history |
| GET | `/work-history/{id}/` | Scoped Access | Get work history details |
| PUT | `/work-history/{id}/` | Technician Owner / Admin | Update work history |
| PATCH | `/work-history/{id}/` | Technician Owner / Admin | Partially update work history |
| DELETE | `/work-history/{id}/` | Technician Owner / Admin | Delete work history |

**Work History Listing Rules:**
- Technicians can view their own work history.
- Contractor Managers can view their own team's work history.
- Admins can view all work history.

---

## 9. 🌐 Public Technician Verification APIs

These endpoints allow anyone to verify a technician's published professional information without login.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/public/technicians/{token}/` | Public | Get published technician verification profile |
| GET | `/public/technicians/{token}/qr/` | Public | Generate/download technician QR code |
| GET | `/public/technicians/{token}/passport.pdf` | Public | Download technician passport PDF |
| GET | `/public/technicians/{token}/passport/verify/` | Public | Verify passport integrity |

**Features:**
- Public technician profile verification.
- QR-based technician identification.
- Downloadable professional passport.
- Passport integrity verification.

## 10. 💼 Jobs & Assignments APIs

### Job Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/jobs/` | Authenticated | List role-scoped jobs |
| POST | `/jobs/` | Facility Manager | Create a job request |
| GET | `/jobs/{id}/` | Related Roles | Get job details |
| PUT | `/jobs/{id}/` | Facility Owner | Update job |
| PATCH | `/jobs/{id}/` | Facility Owner | Partially update job |
| DELETE | `/jobs/{id}/` | Facility Owner | Delete job |

### Job Feedback

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/jobs/{id}/feedback/` | Raising Facility Manager | View job feedback |
| POST | `/jobs/{id}/feedback/` | Raising Facility Manager | Submit job feedback |

### Technician Matching & Assignment

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/jobs/{id}/matches/` | Facility Manager / Admin | View matching technicians |
| POST | `/jobs/{id}/assign/` | Authorized Facility Manager / Admin | Assign technician to job |

**Job Access Rules:**
- Facility Managers can create job requests.
- Technicians can access jobs assigned to them.
- Contractor Managers can access related company records.
- Facility owners manage their own jobs.
- Only authorized users can assign technicians.

## 11. 📝 Service Reports & Evidence Photo APIs

### Service Reports

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/service-reports/` | Authenticated | List role-scoped service reports |
| POST | `/service-reports/` | Assigned Technician | Submit service report |
| GET | `/service-reports/{id}/` | Scoped Access | Get report details |
| PUT | `/service-reports/{id}/` | Authorized Related Roles | Update service report |
| PATCH | `/service-reports/{id}/` | Authorized Related Roles | Partially update report |
| POST | `/service-reports/{id}/approve/` | Facility Manager / Admin | Approve service report |
| POST | `/service-reports/{id}/reject/` | Facility Manager / Admin | Reject service report |
| GET | `/service-reports/{id}/pdf/` | Authorized Viewers | Download service report PDF |

### Service Report Photos

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/service-report-photos/` | Related Roles | List evidence photos |
| POST | `/service-report-photos/` | Related Technician / Report Roles | Upload evidence photo |
| GET | `/service-report-photos/{id}/` | Related Report Roles | Get photo record |
| DELETE | `/service-report-photos/{id}/` | Related Report Roles | Delete photo record |

**Service Report Features:**
- Technician service report submission.
- Facility Manager report approval/rejection.
- Evidence photo uploads.
- PDF report generation.
- Role-scoped report access.

**File Upload:** `multipart/form-data`

## 12. ❄️ Refrigerant Cylinder Management APIs

### Cylinder Transactions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/cylinders/` | Contractor Manager / Admin / Authorized Technician | List cylinder transactions |
| POST | `/cylinders/` | Contractor Manager / Admin / Authorized Technician | Record refrigerant cylinder transaction |
| GET | `/cylinders/{id}/` | Scoped Access | Get cylinder record |
| GET | `/cylinders/{id}/history/` | Authorized Viewers | View cylinder movement history |

> ⚠️ Cylinder records are ledger-like. They are not directly edited or deleted through the API.

### Refrigerant Dashboard

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/dashboard/refrigerant-summary/` | Facility / Contractor / Admin | Refrigerant compliance summary |
| GET | `/dashboard/refrigerant-summary/export/` | Facility / Contractor / Admin | Export refrigerant compliance CSV |

**Refrigerant Management Features:**
- Cylinder transaction tracking.
- Cylinder movement history.
- Refrigerant compliance monitoring.
- Dashboard summaries.
- CSV compliance exports.

## 13. 📚 Assessments APIs

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/assessments/` | Authenticated | List visible assessments |
| GET | `/assessments/{id}/` | Scoped Access | Get assessment and questions |
| POST | `/assessments/{id}/submit/` | Technician | Submit assessment answers |

**Assessment Features:**
- Role-scoped assessment listing.
- Assessment detail and question retrieval.
- Technician answer submission.

## 14. 📂 Protected File Links

The API does not expose the upload directory as a public static folder.

Evidence files are delivered through short-lived signed URLs.

**File URL Format:**

`/media/{folder}/{filename}?expires=...&sig=...`

### 🔐 File Security Rules

- File URLs are temporary bearer links.
- Links expire after their configured validity period.
- Do not publicly share signed URLs.
- Do not store signed URLs as permanent file references.
- Request the parent record again to obtain a fresh file URL.
- Keep private evidence documents protected.

**Supported Upload Format:** `multipart/form-data`

## 15. 📦 API Response & Pagination

List endpoints generally return paginated responses.

**Standard Pagination Structure:**

```json
{
  "count": 100,
  "next": "https://YOUR-API-HOST/api/jobs/?page=2",
  "previous": null,
  "results": []
}