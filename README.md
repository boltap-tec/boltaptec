# BoltAp — Workforce Manager

A user-friendly employee, salary & advance management app. Built with **React + TypeScript + Vite + Tailwind**, structured so the same codebase powers the **web app (Vercel)** and the **Android APK (Capacitor)**.

Data is seeded from your `Boltap_Software111.xlsx` and stored in the browser for local development. Cloud sync (Supabase) is scaffolded and ready to switch on.

---

## The concept — two experiences, one app

**Admin** runs the business. **Workers** get a simple self-service phone app.

### Admin side
| Area | What it does |
|------|--------------|
| **Dashboard** | KPIs, weekly salary chart, top advances, recent transactions |
| **Employees** | Add / edit / delete workers, set their **login PIN**, photo, daily wage, UPI ID; view login + registered device, reset device |
| **Attendance** | See everyone's punches; also mark manually. Hours & salary auto-calculate (incl. overtime) |
| **Salary** | Generate weekly payroll from attendance, auto-deduct each worker's **repayment plan**, pay by Cash/UPI, post history |
| **Advances** | Approve/reject worker requests, or give advances directly with a **weekly repayment plan**. Pay via **GPay/UPI** (QR + deep link) |
| **Ledger** | Every transaction, filter by type, CSV export |

### Worker side ("My Money" portal)
- **Log in with phone number + 4-digit PIN** — no passwords to remember.
- **Mark IN / Mark OUT** attendance themselves — locked to their **registered phone** (device binding).
- See **salary to receive**, **advance to repay**, and a repayment progress bar in plain language.
- **"You'll receive ₹X on next payday"** = salary − this week's advance deduction.
- **Request an advance** → it reaches the admin's approval queue; track its status.
- **Upload their own photo** (auto-compressed under 100 KB).
- View their full payment & attendance history.

### About "IMEI" / device binding
Real IMEI can't be read from a browser, and modern Android (10+) blocks apps from reading it too. BoltAp uses the standard replacement: a **stable device ID** bound to each worker on first Mark IN, so attendance can only be punched from their own phone. In the APK, swap `getDeviceId()` in [`src/lib/device.ts`](src/lib/device.ts) for Capacitor's `Device.getId()`.

### Default logins (demo data)
- **Admin PIN:** `1234` (change it in Settings)
- **Workers:** phone number + PIN = **last 4 digits of their phone** (e.g. Karthi 9042595830 → PIN `5830`). Admin can see/change each worker's PIN on their profile.

---

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — log in as **Admin** to see everything.

> Data lives in your browser (localStorage). **Settings → Reset to Excel Import** restores the original data; **Wipe All Data** clears it.

```bash
npm run build      # production build into dist/
npm run preview    # preview the production build
```

---

## Integrations roadmap

### 1. GitHub
```bash
git init
git add .
git commit -m "BoltAp initial"
git branch -M main
git remote add origin https://github.com/<you>/boltap.git
git push -u origin main
```

### 2. Supabase (cloud database + auth)
1. Create a project at supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) — the tables match the app's data types exactly.
3. Copy `.env.example` → `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. The client is ready in [`src/lib/supabase.ts`](src/lib/supabase.ts). Swap the localStorage calls in [`src/store/useData.ts`](src/store/useData.ts) for `supabase.from('<table>')` queries — field names already line up.

### 3. Vercel (web hosting)
- Import the GitHub repo in Vercel.
- Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
- Add the two `VITE_SUPABASE_*` env vars in the Vercel dashboard.
- [`vercel.json`](vercel.json) already handles SPA routing.

### 4. Android APK (Capacitor)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init BoltAp com.boltap.workforce --web-dir dist   # config already provided
npm run build
npx cap add android
npx cap sync
npx cap open android      # build the APK in Android Studio (Build → Build APK)
```
[`capacitor.config.json`](capacitor.config.json) is preconfigured. The UPI deep links open real payment apps once running on a phone.

---

## Project structure

```
src/
  data/           Excel export (seed data)
  lib/            calc, format, upi, supabase, seed
  store/          useData (all business logic), useAuth
  components/     Layout, UpiPay, shared UI
  pages/          Dashboard, Employees, Attendance, Salary, Advances, Ledger, Settings
```

Business rules: `hourly_rate = daily_wage / 8`, `salary = hours × hourly_rate`, overtime = hours beyond 8, `advance_pending = total_advance_given − advance_recovered`.
