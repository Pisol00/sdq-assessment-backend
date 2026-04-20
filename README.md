# SDQ Assessment Backend

NestJS + TypeORM + PostgreSQL backend for the SDQ Assessment platform.

## Stack
- NestJS 11 + TypeScript
- TypeORM + PostgreSQL 16
- JWT auth (Passport) + bcrypt
- class-validator + Swagger (OpenAPI)
- ExcelJS for student bulk import

## Quick start

```bash
# 1. Install deps
npm install

# 2. Copy env
cp .env.example .env

# 3. Start PostgreSQL
docker compose up -d

# 4. Seed initial users (admin + demo teacher)
npm run seed

# 5. Run dev server
npm run start:dev
```

API: http://localhost:4000/api
Swagger: http://localhost:4000/api/docs

## Seed accounts
| Email | Password | Role | Plan |
|---|---|---|---|
| admin@admin.com | password | ADMIN | LIFETIME |
| teacher@demo.com | password | TEACHER | FREE |

## API surface

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET  /api/auth/me`

### Classrooms (teacher-owned)
- `GET    /api/classrooms`
- `POST   /api/classrooms`
- `GET    /api/classrooms/:id`
- `PATCH  /api/classrooms/:id`
- `DELETE /api/classrooms/:id`

### Students
- `GET    /api/students?classroomId=<uuid>`
- `POST   /api/students`
- `PATCH  /api/students/:id`
- `DELETE /api/students/:id`
- `POST   /api/students/import?classroomId=<uuid>` (multipart/form-data, `file`)

### Assessments
- `GET /api/assessments/questions` (public)
- `GET /api/assessments?classroomId=<uuid>`
- `GET /api/assessments/reports?classroomId=<uuid>`
- `GET /api/assessments/by-student/:studentId`
- `POST /api/assessments` (create empty assessment)
- `PUT /api/assessments/:id/submit` (save responses + calculate scores)
- `DELETE /api/assessments/:id`

### Subscriptions & Payments
- `GET /api/subscriptions/me`
- `GET /api/payments`
- `POST /api/payments` `{ plan, method }`
- `POST /api/payments/:id/mark-successful` (stub until Omise is wired)

### Admin (role=ADMIN only)
- `GET /api/users`
- `PATCH /api/users/:id/active` `{ isActive }`

## Subscription limits (Free plan)
- `FREE_PLAN_MAX_CLASSROOMS` (default 1)
- `FREE_PLAN_MAX_STUDENTS` (default 10)

Enforced at classroom/student creation and during Excel import.

## SDQ scoring
Scoring and Thai interpretation rules live in [src/assessments/sdq-calculator.ts](src/assessments/sdq-calculator.ts) and mirror the frontend logic.

## Next steps
- Wire Omise integration (cards + PromptPay + webhook)
- Replace `synchronize: true` with TypeORM migrations before production
- Add email (Resend) for signup / password reset / receipts
- Add request logging + Sentry
