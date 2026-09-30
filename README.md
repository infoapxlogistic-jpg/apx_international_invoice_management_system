# Invoice Management System — Creonetix & APXpress Limited

React frontend, FastAPI + Pydantic backend, MySQL database.

## Features
- Login with roles: **Super Administrator** and **Staff**; change password
- Dashboard per company: total invoiced, received, outstanding, overdue, 12-month chart
- Invoices for both companies: unlimited lines (qty × rate), discount, tax/VAT %, due date, notes
- Automatic invoice numbers per company (`CRX-00001`, `APX-00001`); numbers are never reused
- Payments (cash, bank transfer, cheque, card) with automatic Unpaid / Partially paid / Paid status
- A4 print / Save as PDF with company logo, bank details and terms
- Saved customers with search, billed totals and balance due
- Search and filter invoices (company, status, overdue, date range), CSV export, duplicate invoice
- Company settings: logo upload, address, NTN, currency, invoice prefix, default tax, brand colour
- User management (Super Administrator only)

Staff can create and edit invoices and record payments. Only a Super Administrator can cancel
invoices, delete payments, delete customers, and manage companies and users.

## Companies shown
Only APXpress is switched on for now (`ACTIVE_COMPANIES=APX` in `backend/.env`).
To bring Creonetix back, set `ACTIVE_COMPANIES=APX,CRX` and restart the backend; the company pickers
and Creonetix menu items then appear automatically.

## First-time setup
1. Open `backend/.env` and put the MySQL root password in `DATABASE_URL`
   (replace `YOUR_PASSWORD`). The `invoice_db` database and its tables are created automatically.
2. Double-click `start.bat`. It starts MySQL (if needed), the API on port 8000 and the website on port 5173.
3. Sign in with `admin` / `admin123`, then change the password from **Change Password**.

## Manual start
```
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
```
cd frontend
npm run dev
```
API docs: http://localhost:8000/docs

## Tests
Invoice maths (VAT, rounding, discounts, monthly record). They use a temporary database, never the real one.
```
cd backend
.venv\Scripts\python.exe -m pytest tests -q
```
```
cd frontend
node src/calc.test.mjs
```

## Production
Run `npm run build` in `frontend`. The backend then serves the built site itself, so only
`uvicorn app.main:app --host 0.0.0.0 --port 8000` needs to run. Set a new `SECRET_KEY` in `.env`.

## Structure
```
backend/app/
  main.py        app, routers, static files
  models.py      SQLAlchemy tables
  schemas.py     Pydantic request/response models
  security.py    password hashing, JWT login, role checks
  seed.py        creates tables, first admin, the two companies
  routers/       auth, users, companies, customers, invoices, dashboard
frontend/src/
  pages/         Dashboard, Invoices, InvoiceForm, InvoiceView, Customers, Companies, Users, ...
  components/    Layout, shared UI, icons
```
