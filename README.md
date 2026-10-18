# Academic Eligibility Tracking System for Graduation Status Monitoring (REST API)

A production-quality REST API backend built for university graduation status monitoring. The system tracks students' academic results per course per session, computes cumulative grade point averages (CGPA), credit units carried (CCC), credit units earned (CCE), compulsory courses still outstanding, and carryovers, and evaluates whether a student currently meets the department's graduation requirements.

Built specifically around the real curriculum and graduation rules from the **Computer Science Department Student Handbook**.

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript (Strict Mode)
- **Database & ORM**: PostgreSQL & Prisma ORM
- **Validation**: Zod (strict validation across request bodies, queries, and params)
- **Security**: bcrypt (cost 12), jsonwebtoken (JWT in HTTP-only `SameSite=Lax` cookie `access_token`), helmet, cors, express-rate-limit
- **File Processing**: multer + csv-parse (CSV result batch import with row-by-row error reporting)
- **Testing**: Vitest + Supertest
- **Logging**: Pino

---

## Handbook Implementation & Inconsistencies Note

1. **CGPA Policy (Handbook Sections 11.1.8 & 11.1.10)**:
   - The CGPA is computed as Cumulative Credit Points Earned (CPE) divided by Cumulative Credit Units Carried (CCC).
   - In accordance with the handbook worked example (Section 11.1.8), repeated and failed courses remain in CCC and in the CGPA calculation permanently even after the course is passed on a re-sit.
2. **Direct Entry Policy**:
   - Direct Entry students are exempt from all 100-level courses (they require 121 credit units vs 166 for UTME students). 100-level courses are neither required nor counted for them.
3. **Printed Handbook Arithmetic Inconsistencies**:
   - **Level 200, Semester 2**: The handbook table displays a printed semester total of **24 units**, but the individual course units in that table sum to **27 units**.
   - **Level 400, Semester 2**: The handbook table displays a printed semester total of **22 units**, but the individual course units in that table sum to **25 units**.
   - **Status in System**: All 77 curriculum courses are seeded verbatim according to their row definitions without arbitrary modifications.

---

## Quick Start & Setup

### 1. Prerequisites
- Node.js (v20+)
- Docker & Docker Compose (or local PostgreSQL 16)
- npm

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/eligibility_db?schema=public
JWT_SECRET=super-secret-jwt-key-minimum-32-chars-long-12345
COOKIE_SECURE=false
FRONTEND_ORIGIN=http://localhost:3000
```

### 3. Start Database (PostgreSQL via Docker)
```bash
docker compose up -d
```

### 4. Install Dependencies & Generate Prisma Client
```bash
npm install
npm run prisma:generate
```

### 5. Run Migrations & Seed Database
```bash
npm run prisma:push
npm run seed
```

### 6. Start the Server
- Development:
  ```bash
  npm run dev
  ```
- Production build:
  ```bash
  npm run build
  npm start
  ```

---

## Demo Credentials (Development Seed Data)

All accounts share the default password: **`Password123!`**

### Department Examination Officer & Advisers
| Role | Name | Email | Notes |
|---|---|---|---|
| **ADMIN** | Dr. Ibrahim Musa | `admin@cs.edu.ng` | Examination Officer / Admin permissions |
| **ADVISER** | Dr. Ngozi Okonjo | `adviser1@cs.edu.ng` | Senior Adviser (Level 300 & 400 students) |
| **ADVISER** | Dr. Babatunde Adeleke | `adviser2@cs.edu.ng` | Junior Adviser (Level 100 & 200 students) |

### Student Test Scenarios (14 Unique Scenarios)
| Scenario | Student Name | Matric Number | Email | Status / Condition |
|---|---|---|---|---|
| **(a)** | Adebayo Olawale | `CSC/2020/001` | `student_a_eligible@cs.edu.ng` | **ELIGIBLE**: 171 units earned, CGPA 4.70, First Class |
| **(b)** | Chioma Okoli | `CSC/2020/002` | `student_b_shortunits@cs.edu.ng` | **NOT_YET_ELIGIBLE**: 161/166 units (short 5 elective units) |
| **(c)** | Emeka Eze | `CSC/2020/003` | `student_c_lowcgpa@cs.edu.ng` | **NOT_YET_ELIGIBLE**: CGPA < 1.00 (Grade E + failed electives) |
| **(d)** | Fatima Aliyu | `CSC/2020/004` | `student_d_missingcourse@cs.edu.ng` | **NOT_YET_ELIGIBLE**: Missing CMP 499 (Final Project NOT_TAKEN) |
| **(e)** | Grace Danjuma | `CSC/2020/005` | `student_e_failedcompulsory@cs.edu.ng` | **NOT_YET_ELIGIBLE**: CMP 311 FAILED and never re-sat |
| **(f)** | Hassan Bello | `CSC/2020/006` | `student_f_resitpass@cs.edu.ng` | **ELIGIBLE**: Failed CMP 211 once, passed on re-sit (F in CGPA) |
| **(g)** | Ifunanya Nwosu | `CSC/2024/007` | `student_g_new100@cs.edu.ng` | **NOT_YET_ELIGIBLE**: New Level 100 student, no results |
| **(h)** | Jubril Sani | `CSC/2023/008` | `student_h_mid200@cs.edu.ng` | **NOT_YET_ELIGIBLE**: Level 200 student mid-programme |
| **(i)** | Kehinde Bakare | `CSC/2022/009` | `student_i_carryover300@cs.edu.ng` | **NOT_YET_ELIGIBLE**: Level 300 student with carryover (CMP 241) |
| **(j)** | Lukman Gbadamosi | `CSC/2021/DE01` | `student_j_de_eligible@cs.edu.ng` | **ELIGIBLE**: Direct Entry, 122/121 units earned |
| **(k)** | Maryam Usman | `CSC/2024/DE02` | `student_k_de_new200@cs.edu.ng` | **NOT_YET_ELIGIBLE**: Direct Entry Level 200 (no 100-level results) |
| **(l)** | Nnamdi Kalu | `CSC/2020/010` | `student_l_exactboundary@cs.edu.ng` | **ELIGIBLE**: Exactly 166 units, CGPA exactly 1.00 (Pass) |
| **(m)** | Oluwaseun Ajayi | `CSC/2020/011` | `student_m_highcgpa_short@cs.edu.ng` | **NOT_YET_ELIGIBLE**: High CGPA (4.60) but short on units |
| **(n)** | Peace Chukwu | `CSC/2020/012` | `student_n_noadviser@cs.edu.ng` | **ELIGIBLE**: No assigned adviser |

---

## API Documentation & Example Requests

Base URL: `http://localhost:4000/api/v1`

### 1. Health Check
```bash
curl -X GET http://localhost:4000/api/v1/health
```

### 2. Login
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"student_a_eligible@cs.edu.ng","password":"Password123!"}'
```

### 3. Student Check Progress
```bash
curl -X GET http://localhost:4000/api/v1/me/progress \
  -b cookies.txt
```

### 4. Student Check Results Breakdown
```bash
curl -X GET http://localhost:4000/api/v1/me/results \
  -b cookies.txt
```

### 5. Adviser List Assigned Students
```bash
# Login as adviser
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c adviser_cookie.txt \
  -d '{"email":"adviser1@cs.edu.ng","password":"Password123!"}'

# Get assigned students
curl -X GET "http://localhost:4000/api/v1/adviser/students?page=1&pageSize=10" \
  -b adviser_cookie.txt
```

### 6. Admin Department Stats
```bash
# Login as admin
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c admin_cookie.txt \
  -d '{"email":"admin@cs.edu.ng","password":"Password123!"}'

# Get stats
curl -X GET http://localhost:4000/api/v1/admin/stats \
  -b admin_cookie.txt
```

### 7. Import Results CSV (Admin)
CSV format:
```csv
matricNumber,courseCode,session,score
CSC/2020/001,CMP 499,2023/2024,85
```
Upload:
```bash
curl -X POST http://localhost:4000/api/v1/admin/results/import \
  -b admin_cookie.txt \
  -F "file=@results.csv"
```

---

## Testing

Run unit and integration tests with Vitest:
```bash
npm test
```
All 12 eligibility engine test cases (including the exact Section 11.1.8 worked example from the handbook) and API health tests run offline without database dependencies.

---

## Production Deployment (Render + Neon)

### 1. Database (Neon PostgreSQL)
The database is hosted on **Neon PostgreSQL** (serverless). When using Prisma with Neon, make sure connection string does not include unsupported query parameters like `&channel_binding=require`.

### 2. Backend Web Service on Render
1. Create a new **Web Service** on [Render](https://dashboard.render.com).
2. Connect your GitHub repository.
3. Configure the service:
   - **Environment**: `Node`
   - **Region**: Frankfurt (or nearest region)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build` (Note: `postinstall: prisma generate` runs automatically)
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health` (or `/api/v1/health`)
4. Configure Environment Variables in Render:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (injected automatically by Render)
   - `COOKIE_SECURE`: `true`
   - `DATABASE_URL`: `postgresql://neondb_owner:npg_...` (from your Neon dashboard)
   - `JWT_SECRET`: Minimum 32-character secure random string
   - `FRONTEND_ORIGIN`: Your Vercel frontend URL, e.g. `https://<your-project>.vercel.app` (comma-separated if including `http://localhost:3000`)

---

## Frontend Integration Context (Vercel)

### 1. Environment Variable
In your Next.js project on Vercel or `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com
```

### 2. Cookie Credentials (CRITICAL)
In production, the backend sets `access_token` with `SameSite=None` and `Secure=true`. Browsers treat cross-domain requests (Vercel -> Render) as third-party requests and will **drop** cookies unless `credentials: "include"` is set:

```typescript
// With fetch:
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/me/progress`, {
  credentials: "include", // REQUIRED
  headers: { "Content-Type": "application/json" }
});

// With axios:
axios.defaults.withCredentials = true; // REQUIRED
```
