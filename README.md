# SDQ Assessment Backend — API Server

Backend สำหรับระบบประเมินพฤติกรรมนักเรียน (SDQ Assessment System) สร้างด้วย NestJS + TypeORM + PostgreSQL

---

## ภาพรวม

ระบบ Backend นี้ทำหน้าที่เป็น REST API สำหรับ Frontend ของระบบ SDQ ครอบคลุมการจัดการผู้ใช้, ห้องเรียน, นักเรียน, แบบประเมิน, การคำนวณคะแนน, ระบบ subscription และการชำระเงิน

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | NestJS 11 |
| Language | TypeScript |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL 16 |
| Auth | JWT (Passport) + bcrypt |
| Validation | class-validator + class-transformer |
| API Docs | Swagger (OpenAPI) |
| Excel | ExcelJS |
| Payment | Stripe (Phase 2) |

---

## โครงสร้างโปรเจกต์

```
src/
├── admin/          # จัดการผู้ใช้ทั้งหมด (ADMIN only)
├── assessments/    # แบบประเมิน SDQ + การคำนวณคะแนน
│   └── sdq-calculator.ts  # scoring logic + Thai interpretation
├── auth/           # signup, signin, JWT strategy
├── classrooms/     # จัดการห้องเรียน
├── common/         # Guards, decorators, interceptors
├── config/         # Environment config
├── payments/       # ระบบชำระเงิน
├── students/       # จัดการนักเรียน + Excel import
├── subscriptions/  # จัดการ subscription plan
├── users/          # User entity + management
├── app.module.ts
├── main.ts
└── seed.ts         # ข้อมูลเริ่มต้น (admin + demo teacher)
```

---

## การติดตั้งและรัน

### ความต้องการเบื้องต้น
- Node.js 18+
- Docker (สำหรับ PostgreSQL)

### ขั้นตอน

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. สร้างไฟล์ environment
cp .env.example .env
# แก้ไขค่าใน .env ให้ครบถ้วน

# 3. เริ่ม PostgreSQL ด้วย Docker
docker compose up -d

# 4. Seed ข้อมูลเริ่มต้น (admin + demo teacher)
npm run seed

# 5. รัน development server
npm run start:dev
```

- API: `http://localhost:4000/api`
- Swagger Docs: `http://localhost:4000/api/docs`

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=sdq_db
DB_SYNC=true

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# App
PORT=4000
FRONTEND_URL=http://localhost:3000

# Email (optional)
# RESEND_API_KEY=

# Stripe (Phase 2)
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
```

---

## Seed Accounts

| Email | Password | Role | Plan |
|---|---|---|---|
| admin@admin.com | password | ADMIN | LIFETIME |
| teacher@demo.com | password | TEACHER | FREE |

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | สมัครสมาชิก |
| POST | `/api/auth/signin` | เข้าสู่ระบบ (set cookie) |
| POST | `/api/auth/signout` | ออกจากระบบ |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/api/auth/forgot-password` | ขอ reset password |
| POST | `/api/auth/reset-password` | reset password |
| POST | `/api/auth/verify-email` | ยืนยัน email |

### Classrooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classrooms` | รายการห้องเรียนของตัวเอง |
| POST | `/api/classrooms` | สร้างห้องเรียนใหม่ |
| GET | `/api/classrooms/:id` | ข้อมูลห้องเรียน |
| PATCH | `/api/classrooms/:id` | แก้ไขห้องเรียน |
| DELETE | `/api/classrooms/:id` | ลบห้องเรียน |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students?classroomId=<uuid>` | รายการนักเรียนในห้อง |
| POST | `/api/students` | เพิ่มนักเรียน |
| PATCH | `/api/students/:id` | แก้ไขข้อมูลนักเรียน |
| DELETE | `/api/students/:id` | ลบนักเรียน |
| POST | `/api/students/import?classroomId=<uuid>` | นำเข้าจาก Excel (multipart) |

### Assessments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assessments/questions` | รายการคำถาม SDQ 25 ข้อ |
| GET | `/api/assessments?classroomId=<uuid>` | รายการผลประเมินในห้อง |
| GET | `/api/assessments/reports?classroomId=<uuid>` | สถิติรายห้อง |
| GET | `/api/assessments/by-student/:studentId` | ประวัติการประเมินของนักเรียน |
| GET | `/api/assessments/:id` | ผลประเมินรายการ |
| POST | `/api/assessments` | สร้าง assessment ใหม่ |
| PUT | `/api/assessments/:id/submit` | ส่งคำตอบ + คำนวณคะแนน |
| DELETE | `/api/assessments/:id` | ลบผลประเมิน |

### Subscriptions & Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscriptions/me` | subscription ปัจจุบัน |
| GET | `/api/payments` | ประวัติการชำระเงิน |
| POST | `/api/payments` | สร้าง payment `{ plan, method }` |
| POST | `/api/payments/:id/mark-successful` | ยืนยันการชำระเงิน (mock) |

### Admin (role=ADMIN only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | รายการผู้ใช้ทั้งหมด |
| PATCH | `/api/users/:id/active` | เปิด/ปิดการใช้งาน |

---

## SDQ Scoring

คะแนนคำนวณอัตโนมัติเมื่อ submit โดย `sdq-calculator.ts` แบ่งเป็น 5 มิติ:

| มิติ | คำอธิบาย | คะแนนเต็ม |
|------|----------|-----------|
| Emotional Symptoms | อาการทางอารมณ์ | 10 |
| Conduct Problems | พฤติกรรมก้าวร้าว | 10 |
| Hyperactivity | สมาธิสั้น/ซน | 10 |
| Peer Problems | ความสัมพันธ์กับเพื่อน | 10 |
| Prosocial | พฤติกรรมเชิงบวก | 10 |

**Total Difficulties** = ผลรวม 4 มิติแรก (0–40) → แปลผลเป็น ปกติ / เสี่ยง / มีปัญหา

---

## Subscription Limits

| Plan | จำนวนห้องเรียน | จำนวนนักเรียน/ห้อง |
|------|---------------|-------------------|
| FREE | 1 | 10 |
| MONTHLY | ไม่จำกัด | ไม่จำกัด |
| LIFETIME | ไม่จำกัด | ไม่จำกัด |

---

## Known Issues

ดูรายละเอียดที่ [ISSUES.md](./ISSUES.md)

---

## Frontend

> Repository: [site-project-sdq-assessment](../site-project-sdq-assessment)

---

## License

Private — สงวนสิทธิ์
