# คู่มือการนำแอพขึ้น Cloudflare Pages + Cloudflare D1 (อัตโนมัติ 100%)

แอพนี้ถูกเตรียมโครงสร้างสำหรับ **Cloudflare Pages (Frontend + Pages Functions API)** และ **Cloudflare D1 (SQL Database)** ครบสมบูรณ์แล้ว โดยรองรับข้อมูลบริษัท, ข้อมูลเครื่องปรับอากาศ 2569 (`1,161` เครื่อง), ประวัติการล้าง (`2,897` รายการ), ระบบสิทธิ์ผู้ใช้แบบ RBAC และรหัสผ่าน PBKDF2-SHA256

---

## ไฟล์โครงสร้าง Cloudflare ที่เตรียมไว้พร้อมใช้งาน
- `wrangler.toml` — ตั้งค่า Cloudflare Pages (`rkk-ac-maintenance`) และ D1 binding ชื่อ `DB` (`rkk-ac-db`)
- `migrations/0001_init.sql` — สคริปต์สร้างตาราง SQL (`company_settings`, `users`, `sessions`, `ac_units`, `cleaning_logs`)
- `migrations/0002_seed_2569.sql` — ข้อมูลตั้งต้น พ.ศ. 2569 (`1,161` เครื่อง / `2,897` รายการ) + บัญชีผู้ดูแลระบบ
- `functions/api/[[path]].ts` — Cloudflare Pages Functions Backend Router สำหรับ `/api/*` เชื่อมต่อ D1 โดยตรง (รวม `/api/health`)
- `scripts/cf-auto-deploy.mjs` — สคริปต์ Deploy อัตโนมัติครบวงจร (ล็อกอิน/ตรวจ Token → สร้างหรือซิงก์ D1 Database → อัปเดต `wrangler.toml` → รัน D1 Migration → สร้าง Pages Project → Build & Deploy → ตรวจสอบ `/api/health`)
- `.github/workflows/deploy-cloudflare.yml` — Deploy อัตโนมัติทุกครั้งที่ Push ขึ้น GitHub (`main`)

---

## วิธีที่ 1: รันคำสั่งเดียวอัตโนมัติจากเครื่องของคุณ (`npm run cf:auto`)

1. ติดตั้งแพ็กเกจ (ครั้งแรก):
   ```bash
   npm install
   ```
2. รันสคริปต์อัตโนมัติ:
   ```bash
   npm run cf:auto
   ```
   > **สิ่งที่สคริปต์ทำให้โดยอัตโนมัติ:**
   > - เปิดหน้าเว็บให้ล็อกอิน Cloudflare (หรือใช้ `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` ถ้าตั้งค่าไว้)
   > - ตรวจสอบ/สร้างฐานข้อมูล Cloudflare D1 ชื่อ `rkk-ac-db` และซิงก์ `database_id` ลงใน `wrangler.toml` ให้อัตโนมัติ
   > - รัน `migrations/0001_init.sql` และ `migrations/0002_seed_2569.sql` ขึ้น D1 (`--remote`) โดยไม่ต้องกดยืนยันซ้ำ
   > - สร้างโปรเจกต์ Cloudflare Pages, Build แอพ (`dist`), Deploy ขึ้น Cloud และทดสอบ `/api/health` + `/api/public/company` ทันที

> หมายเหตุ: หากชื่อโดเมน `rkk-ac-maintenance.pages.dev` ถูกใช้งานแล้ว สามารถกำหนดชื่อโปรเจกต์ใหม่ได้ทันที เช่น:
> ```bash
> CF_PAGES_PROJECT=rkk-ac-ramkhamhaeng npm run cf:auto
> ```

---

## วิธีที่ 2: Deploy อัตโนมัติผ่าน GitHub Actions (Zero-Config)

1. Push โค้ดนี้ขึ้น GitHub Repository ของคุณ
2. ใน GitHub ไปที่ **Settings → Secrets and variables → Actions** แล้วเพิ่ม Secret 2 ตัว:
   - `CLOUDFLARE_API_TOKEN` — Token ที่มีสิทธิ์ **Cloudflare Pages: Edit** และ **D1: Edit**
   - `CLOUDFLARE_ACCOUNT_ID` — Account ID จากหน้าแรกของ Cloudflare Dashboard
3. Push ขึ้น branch `main` (หรือกด **Run workflow** ในแท็บ Actions) — ระบบจะสร้าง D1, รัน Migration, Build และ Deploy ขึ้น Cloudflare Pages ให้อัตโนมัติ

---

## บัญชีผู้ดูแลระบบเริ่มต้นหลัง Migrate D1
- **Admin สูงสุด:** ชื่อผู้ใช้ `admin` | รหัสผ่าน `admin1234`
- **หัวหน้าช่างเทคนิค:** ชื่อผู้ใช้ `headtech` | รหัสผ่าน `head1234`

> หลัง Deploy เสร็จ สามารถเปิด `https://<your-project>.pages.dev/api/health` เพื่อตรวจสอบว่า D1 เชื่อมต่อสำเร็จ (`"ok": true, "units": 1161, "logs": 2897`) และแนะนำให้เปลี่ยนรหัสผ่านในหน้า **จัดการบัญชีผู้ใช้งานและสิทธิ์** ทันที
