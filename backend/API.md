# 🚀 Django REST API Reference

**Backend:** Django REST Framework + PostgreSQL (Supabase-compatible)  
**Base URL:** `https://YOUR-API-HOST/api`  
**Authentication:** JWT Bearer Token  
**Response Format:** JSON  
**File Upload:** Multipart Form Data

---

## 📑 Table of Contents

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
| Backend | Django |
| API Framework | Django REST Framework |
| Database | PostgreSQL |
| Compatibility | Supabase-compatible |
| Authentication | JWT |
| Response Format | JSON |
| File Upload | Multipart Form Data |

**General Rules:**
- All endpoints normally end with `/`.
- Protected endpoints require JWT authentication.
- List endpoints use pagination.
- Normal writes use JSON.
- File uploads use `multipart/form-data`.
- Access is controlled by roles, ownership and assignment.

## 2. 🔐 Authentication & Authorization

**Authorization Header:**

`Authorization: Bearer <access_token>`

| Token | Purpose |
|---|---|
| Access Token | Access protected endpoints |
| Refresh Token | Refresh/rotate JWT tokens |

**Authentication Flow:**
1. Register an account.
2. Login and receive JWT tokens.
3. Use the access token for protected requests.
4. Refresh tokens when required.
5. Retrieve account details using `/auth/me/`.

## 3. 👥 User Roles & Permissions

| Role | Permissions |
|---|---|
| 🌍 Public | Access public endpoints |
| 👤 Authenticated User | Access permitted role-scoped records |
| 🏢 Facility Manager | Manage own facilities, equipment and jobs |
| 👨‍🔧 Technician | Manage own profile, credentials, capabilities and work history |
| 🏗️ Contractor Manager | Manage own company, technicians and compliance |
| 🛡️ Admin | Administrative reviews and verification |

**Role Responsibilities:**
- **Facility Manager:** Creates facilities and jobs, manages equipment, assigns technicians and reviews service reports.
- **Technician:** Manages professional records, submits evidence, handles assigned jobs and submits reports.
- **Contractor Manager:** Manages company information, connected technicians and compliance documents.
- **Admin:** Reviews companies, credentials, capabilities, documents and audit integrity.
- **Public:** Accesses published technician verification information.

> ⚠️ Ownership, assignment and company membership checks can further restrict role permissions.

## 4. ❤️ Health & Authentication APIs

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health/` | Public | API and database health check |
| POST | `/auth/register/` | Public | Register user |
| POST | `/auth/login/` | Public | Login and receive JWT tokens |
| POST | `/auth/refresh/` | Refresh Token | Refresh/rotate tokens |
| GET | `/auth/me/` | Authenticated | Get current user |
| PATCH | `/auth/me/` | Authenticated | Update own account |
| POST | `/auth/password-reset/` | Public | Request password reset email |
| POST | `/auth/password-reset/confirm/` | Reset Token | Set new password |

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
| GET | `/onboarding/` | Authenticated | User onboarding checklist |

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
| GET | `/facilities/` | Authenticated | List accessible facilities |
| POST | `/facilities/` | Facility Manager | Create own facility |
| GET | `/facilities/{id}/` | Scoped Access | Get facility details |
| PUT | `/facilities/{id}/` | Owner | Replace facility details |
| PATCH | `/facilities/{id}/` | Owner | Update facility details |
| DELETE | `/facilities/{id}/` | Owner | Delete facility |

### Equipment

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/equipment/` | Authenticated | List accessible equipment |
| POST | `/equipment/` | Facility-scoped | Register equipment |
| GET | `/equipment/{id}/` | Scoped Access | Get equipment details |
| PUT | `/equipment/{id}/` | Facility Owner | Replace equipment details |
| PATCH | `/equipment/{id}/` | Facility Owner | Update equipment |
| DELETE | `/equipment/{id}/` | Facility Owner | Delete equipment |
| GET | `/equipment/{id}/label/` | Scoped Access | Download/print equipment label |
| GET | `/equipment/{id}/history/` | Scoped Access | View equipment history |

**Access Rules:**
- Facility creation is restricted to Facility Managers.
- Equipment registration is facility-scoped.
- Facility owners control facility management.
- Equipment access depends on facility ownership and user role.

## 7. 🏗️ Contractors & Contractor Documents APIs

### Contractor Companies

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractors/` | Manager / Admin | List permitted companies |
| POST | `/contractors/` | Contractor Manager | Register own company |
| GET | `/contractors/{id}/` | Scoped Access | Get company details |
| PUT | `/contractors/{id}/` | Company Owner | Replace company details |
| PATCH | `/contractors/{id}/` | Company Owner | Update company details |
| DELETE | `/contractors/{id}/` | Company Owner | Delete company |

### Contractor Team Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractors/{id}/technicians/` | Manager / Admin | View technician roster |
| POST | `/contractors/{id}/add-technician/` | Contractor Manager | Add technician |
| POST | `/contractors/{id}/remove-technician/` | Contractor Manager | Remove technician |

### Contractor Compliance

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractors/{id}/compliance/` | Manager / Admin | Company compliance summary |
| GET | `/contractors/{id}/pending-approvals/` | Manager / Admin | Pending capability count |
| POST | `/contractors/{id}/verify/` | Admin | Verify contractor company |

### Contractor Documents

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/contractor-documents/` | Manager / Admin | List compliance documents |
| POST | `/contractor-documents/` | Contractor Manager | Upload company document |
| GET | `/contractor-documents/{id}/` | Scoped Access | Get document details |
| PUT | `/contractor-documents/{id}/` | Owner / Admin | Replace document record |
| PATCH | `/contractor-documents/{id}/` | Owner / Admin | Update document record |
| DELETE | `/contractor-documents/{id}/` | Owner / Admin | Delete document |
| POST | `/contractor-documents/{id}/verify/` | Admin | Approve/reject document |

**Access Rules:**
- Managers can manage only their own companies.
- Technician roster access is company-scoped.
- Compliance records are restricted to the owning manager and Admin.
- Document verification is Admin-only.

## 8. 👨‍🔧 Technicians & Professional Records APIs

### Technician Profiles

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/technicians/` | Admin / Manager / Technician | List permitted profiles |
| GET | `/technicians/me/` | Technician | Get own profile |
| GET | `/technicians/{id}/` | Scoped Access | Get technician details |
| PUT | `/technicians/{id}/` | Authorized Owner | Replace profile |
| PATCH | `/technicians/{id}/` | Authorized Owner | Update profile |
| DELETE | `/technicians/{id}/` | Authorized Owner | Delete profile |

### Professional Credentials

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/credentials/` | Scoped Access | List credentials |
| POST | `/credentials/` | Technician | Add credential with evidence |
| GET | `/credentials/{id}/` | Scoped Access | Get credential details |
| PUT | `/credentials/{id}/` | Technician Owner | Replace credential |
| PATCH | `/credentials/{id}/` | Technician Owner | Update credential |
| DELETE | `/credentials/{id}/` | Technician Owner | Delete credential |
| POST | `/credentials/extract/` | Technician | AI-assisted credential extraction |
| POST | `/credentials/{id}/ai-check/` | Admin | Run AI credential comparison |
| POST | `/credentials/{id}/verify/` | Admin | Verify credential |

**AI Credential Extraction:** `POST /credentials/extract/`  
**Content-Type:** `multipart/form-data`

### Technician Capabilities

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/capabilities/` | Scoped Access | List capabilities |
| POST | `/capabilities/` | Technician | Submit capability evidence |
| GET | `/capabilities/{id}/` | Scoped Access | Get capability details |
| PUT | `/capabilities/{id}/` | Technician Owner | Replace capability |
| PATCH | `/capabilities/{id}/` | Technician Owner | Update capability |
| DELETE | `/capabilities/{id}/` | Technician Owner | Delete capability |
| POST | `/capabilities/{id}/verify/` | Admin / Owning Contractor Manager | Verify capability |

### Technician Work History

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/work-history/` | Scoped Access | List work history |
| POST | `/work-history/` | Technician | Add work history |
| GET | `/work-history/{id}/` | Scoped Access | Get work history details |
| PUT | `/work-history/{id}/` | Technician Owner | Replace work history |
| PATCH | `/work-history/{id}/` | Technician Owner | Update work history |
| DELETE | `/work-history/{id}/` | Technician Owner | Delete work history |

---

# 🚀 Django REST API Reference — Part 2

**Part:** 2 of 3  
**Coverage:** Jobs, Assignments, Service Reports, Evidence Photos, Refrigerant Management and Assessments.

---

## 📑 Table of Contents

9. Jobs & Assignments APIs
10. Service Reports APIs
11. Service Report Photos & Evidence APIs
12. Refrigerant Cylinders APIs
13. Refrigerant Dashboard APIs
14. Assessments APIs

---

## 9. 📋 Jobs & Assignments APIs

### Jobs Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/jobs/` | Authenticated | List role-scoped jobs |
| POST | `/jobs/` | Facility Manager | Create job request |
| GET | `/jobs/{id}/` | Scoped Access | Get job details |
| PUT | `/jobs/{id}/` | Facility Owner | Replace job details |
| PATCH | `/jobs/{id}/` | Facility Owner | Update job details |
| DELETE | `/jobs/{id}/` | Facility Owner | Delete job |

### Job Feedback

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/jobs/{id}/feedback/` | Facility Manager | View job feedback |
| POST | `/jobs/{id}/feedback/` | Facility Manager | Submit job feedback |

### Technician Matching & Assignment

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/jobs/{id}/matches/` | Facility Manager / Admin | View matching technicians |
| POST | `/jobs/{id}/assign/` | Facility Manager / Admin | Assign technician to job |

**Job Management Rules:**
- Facility Managers can create job requests for their facilities.
- Users only see jobs permitted by their role and relationship.
- Facility Managers can manage jobs belonging to their facilities.
- Assigned technicians can access their related jobs.
- Technician matching is available to authorized Facility Managers and Admins.
- Job assignment requires authorized permissions.

---

## 10. 📝 Service Reports APIs

### Service Report Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/service-reports/` | Authenticated | List accessible service reports |
| POST | `/service-reports/` | Assigned Technician | Submit service report |
| GET | `/service-reports/{id}/` | Scoped Access | Get report details |
| PUT | `/service-reports/{id}/` | Authorized Owner | Replace report details |
| PATCH | `/service-reports/{id}/` | Authorized Owner | Update report details |
| DELETE | `/service-reports/{id}/` | Authorized Owner | Delete service report |

### Service Report Approval

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/service-reports/{id}/approve/` | Facility Manager / Admin | Approve service report |
| POST | `/service-reports/{id}/reject/` | Facility Manager / Admin | Reject service report |

### Service Report PDF

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/service-reports/{id}/pdf/` | Authorized Report Viewer | Download service report PDF |

**Service Report Rules:**
- Technicians can submit reports for assigned jobs.
- Facility Managers can review reports related to their facilities.
- Admins can approve or reject reports.
- Report access is restricted by ownership and related facility/contractor permissions.
- PDF downloads require authorized report access.

---

## 11. 📸 Service Report Photos & Evidence APIs

### Service Report Photos

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/service-report-photos/` | Related Report Roles | List accessible report photos |
| POST | `/service-report-photos/` | Related Report Roles | Upload report photo |
| GET | `/service-report-photos/{id}/` | Related Report Roles | Get photo details |
| PUT | `/service-report-photos/{id}/` | Related Report Roles | Replace photo record |
| PATCH | `/service-report-photos/{id}/` | Related Report Roles | Update photo record |
| DELETE | `/service-report-photos/{id}/` | Related Report Roles | Delete photo record |

**File Upload Requirements:**

| Property | Requirement |
|---|---|
| Content-Type | `multipart/form-data` |
| Authentication | Bearer Token |
| Access | Related technician/report roles |
| Storage | Durable private storage |

**Example Request Header:**

`Content-Type: multipart/form-data`

**Evidence Security Rules:**
- Photos must belong to an authorized service report.
- Only related users can access report evidence.
- Private evidence must not be publicly readable.
- Uploaded files should use durable private storage.

---

## 12. 🧯 Refrigerant Cylinders APIs

### Cylinder Transactions

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/cylinders/` | Contractor Manager / Admin / Authorized Technician | List accessible cylinder records |
| POST | `/cylinders/` | Authorized Users | Record cylinder transaction |
| GET | `/cylinders/{id}/` | Scoped Access | Get cylinder record |
| GET | `/cylinders/{id}/history/` | Scoped Access | View cylinder movement history |

**Important:** Cylinder records are ledger-like. They cannot be directly edited or deleted.

### Cylinder Management Rules

- Contractor Managers can access their own company's records.
- Authorized technicians can record permitted transactions.
- Admins can access records according to administrative permissions.
- Cylinder ownership and transaction access are scope-controlled.
- Movement history provides a record of cylinder transactions.

---

## 13. 📊 Refrigerant Dashboard APIs

### Refrigerant Compliance Summary

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/dashboard/refrigerant-summary/` | Related Facility / Contractor / Admin | Refrigerant compliance summary |
| GET | `/dashboard/refrigerant-summary/export/` | Related Facility / Contractor / Admin | Export refrigerant compliance CSV |

### Available Functions

| Function | Description |
|---|---|
| Compliance Summary | View refrigerant compliance information |
| Dashboard Data | Retrieve role-scoped refrigerant data |
| CSV Export | Download compliance information |
| Facility Scope | Access related facility information |
| Contractor Scope | Access related company information |

**Access Rules:**
- Facility Managers access related facility data.
- Contractor Managers access related company data.
- Admins access administrative data.
- All dashboard results remain role-scoped.

---

## 14. 📚 Assessments APIs

### Assessment Management

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/assessments/` | Authenticated | List accessible assessments |
| GET | `/assessments/{id}/` | Scoped Access | Get assessment and questions |
| POST | `/assessments/{id}/submit/` | Technician | Submit assessment answers |

### Assessment Features

| Feature | Description |
|---|---|
| Assessment Listing | View role-scoped assessments |
| Assessment Details | Retrieve assessment questions |
| Answer Submission | Submit technician answers |
| Access Control | Restrict assessments by role and permissions |

**Assessment Rules:**
- Assessments are visible according to user role and permissions.
- Technicians can submit assessment answers.
- Users cannot access assessments outside their permitted scope.

---

## 📑 Table of Contents

15. Public Technician Verification APIs
16. Technician QR Code APIs
17. Technician Passport APIs
18. Pagination Standards
19. HTTP Status Codes
20. Request & Response Standards
21. File Upload Guidelines
22. API Security Guidelines
23. Integration & Development Checklist

---

## 15. 🌍 Public Technician Verification APIs

### Public Technician Profile

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/public/technicians/{token}/` | Public | Get published technician verification profile |

**Features:**
- Public technician verification.
- View published professional information.
- Access permitted verification details.
- No login required.

**Important:** Only information published through the public verification profile should be accessible.

---

## 16. 📱 Technician QR Code APIs

### QR Code Generation

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/public/technicians/{token}/qr/` | Public | Generate/download technician QR image |

**Features:**
- Public QR code access.
- QR-based technician verification.
- Connect QR codes with public technician profiles.
- No authentication required.

**Usage:** Scan the QR code to open the technician's public verification profile.

---

## 17. 📄 Technician Passport APIs

### Technician Passport PDF

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/public/technicians/{token}/passport.pdf` | Public | Download technician passport PDF |

### Passport Integrity Verification

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/public/technicians/{token}/passport/verify/?hash=...` | Public | Verify passport integrity |

**Passport Features:**
- Downloadable technician passport.
- Public verification using a unique token.
- Passport integrity verification using a hash.
- Public access without login.

**Important:** Passport verification checks document integrity. It should not be treated as a replacement for the API's authorization and verification rules.

---

## 18. 📄 Pagination Standards

All list endpoints use paginated responses.

**Response Structure:**

| Field | Description |
|---|---|
| `count` | Total number of records |
| `next` | URL for the next page |
| `previous` | URL for the previous page |
| `results` | Current page records |

**Example Response:**

```json
{
  "count": 100,
  "next": "https://YOUR-API-HOST/api/facilities/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Main Facility"
    }
  ]
}