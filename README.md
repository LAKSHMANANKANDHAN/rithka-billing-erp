# RITHKA BILLING, INWARD STOCK & OUTWARD DELIVERY CHALLAN ERP

A production-ready, full-stack web-based ERP and billing management system built for small businesses, manufacturing plants, and job-work units. Designed specifically to match the Excel **DELIVERY CHALLAN Cum Packing Note** and Inward/Outward registers.

---

## 🌟 Key Features

1. **Role-Based Access Control**:
   - **Owner / Administrator**: Full control over customer masters, goods/rates, UOMs, package types, notes, worker accounts, company identity, GST settings, and audit logs.
   - **Worker**: Log in with individual credentials, record multi-item inward stock receipts, create outward delivery challans, view stock, and print challans. Workers cannot delete master records or alter settings. Full audit trail tracks which user created every transaction.

2. **Master Base Management**:
   - **Customer Master**: Unlimited clients with Company Name, full factory address, GSTIN, Company Type, contact person, phone, and email. Auto-populates across all modules.
   - **Goods / Particulars Master**: Configurable default unit rates (₹) and UOMs (e.g. `STEEL TRAY`, `PLASTIC TRAY`, `DEDICATED TRAY`, `PLASTIC BIN`, `WOODEN PALLET`). Also supports **"Manual Typing"** for custom descriptions.
   - **Kind of Package Master**: `Loose`, `Wooden Pallet-1`, `Wooden Pallet-2`, `Plastic Tray`, `Plastic Crate`, `Gunny bag`, `NIL`.
   - **Note Master**: Standard delivery notes (`Customer Material returned`, `Material handling purpose`, `Sent for service and return`, etc.).
   - **UOM Master**: `Nos`, `Kgs`, `Litres`, `Meter`.

3. **Inward Register (Multi-Item Consignments)**:
   - Record customer receipts with Customer selection (auto-fills Address and GST), P.O. Number, P.O. Date, Delivery Challan (or Note) Number, Delivery Challan Date, and Vehicle Number.
   - Multi-item entry grid with Add/Remove item buttons, auto-filled rates from Goods Master or Manual Typing, auto-calculated line totals, and live total quantity/value cards.
   - Unique auto-incrementing serial number generation (`INW-0001`, `INW-0002`, etc.).

4. **Outward Delivery Challan (Excel-Accurate Reproduction)**:
   - Worker selects an existing Inward Stock Entry; system automatically loads customer details, PO reference, DC reference, and vehicle number.
   - Lists all items in that inward entry showing Original Inward Qty, Already Outward Qty, and Pending Balance.
   - **Strict Validation**: Outward dispatch quantity can NEVER exceed the remaining pending inward balance.
   - **9% Tax Calculation**: Computes Subtotal, Tax @ 9% (configurable in settings), and Grand Total.
   - Unique auto-numbering with fiscal year format (`0001/26-27`).

5. **A4 Printable Challan Layout (`reference_outward_challan.png`)**:
   - Faithful digital reproduction of the provided Excel reference format:
     - Bright yellow branded header with GST, phone number, certified badge logos, company name, address, and email.
     - Two-column top section: Left "To" party box with address and GSTIN; Right DC metadata box.
     - Table columns: `Sl.No | Your Ref. No | DESCRIPTION OF GOODS | Quantity | UOM | Kind of Package`.
     - Value summary: Value of Goods (Subtotal), Tax @ 9%, Grand Total, Note, and Remarks.
     - Dual-signature footer: "Received the above goods in good condition" and "For Shri.Bharathi & Co., Authorised Signatory" in yellow box.
   - Dedicated print preview with single-page A4 CSS optimizations and one-click PDF download.

6. **Stock Ledger & Reporting Engine**:
   - Searchable transaction ledger tracking every inward receipt and outward delivery.
   - Live aggregated stock matrix showing Total Inward, Total Outward, Pending Quantity, and Status (`PENDING` vs `COMPLETED`).
   - Reporting suite: Daily, Weekly, Monthly, Customer-wise, Pending Tasks, and Complete Work reports.
   - Export to CSV / Excel and Print on all reports.

7. **Persistent Relational Database & Audit Trail**:
   - SQLite persistent database (`server/db/erp.db`) with foreign key constraints, indexes, and atomic transaction updates.
   - Immutable audit log capturing user logins, inward/outward creations, deletes, and configuration changes.

---

## 🚀 Quick Start Guide

### 1. Launch with One Click (Windows)
Double-click the included batch script:
```bash
start-application.bat
```
This starts the backend server and opens `http://localhost:5000` in your web browser.

### 2. Manual Command Line Start
Ensure Node.js is available:
```powershell
$env:Path = "C:\Users\laksh\nodejs;" + $env:Path
npm start
```
Then navigate to `http://localhost:5000`.

---

## 🔑 Default User Accounts

| Role | Username | Password | Privileges |
|---|---|---|---|
| **Owner / Admin** | `admin` | `admin123` | Full access to Masters, Inward, Outward, Reports, Settings, Worker Accounts, Audit Logs |
| **Worker** | `worker1` | `worker123` | Operational access to Inward Register, Outward Challans, Stock Ledger, and Challan Printing |

> *One-click demo login buttons are provided directly on the login page for fast testing.*

---

## 🔄 End-to-End Business Workflow

1. **Master Base Setup**:
   - Owner logs in (`admin` / `admin123`).
   - Customer Master has 4 realistic Indian sample companies preloaded (Texmo Precision Tools, Roots Industries, Lakshmi Machine Works, Sundaram Fasteners).
   - Goods Master has preconfigured items (`STEEL TRAY` ₹50, `PLASTIC TRAY` ₹30, `DEDICATED TRAY` ₹75, `PLASTIC BIN` ₹120, `WOODEN PALLET` ₹450). Owner can edit rates or add new items anytime.

2. **Inward Stock Receipt**:
   - Worker logs in (`worker1` / `worker123`).
   - Selects customer from dropdown -> Address & GST automatically populate.
   - Enters PO number, DC number, vehicle number.
   - Adds items: e.g. 100 `STEEL TRAY` and 50 `PLASTIC TRAY`. Rates and totals calculate automatically.
   - Clicks **"Save Inward Entry"** -> Assigned `INW-0001`, stock transactions logged in ledger.

3. **Outward Challan Generation**:
   - Worker navigates to **Outward Challan** -> **Create Challan**.
   - Selects `INW-0001` from dropdown -> Customer details and references pre-fill.
   - System displays pending items: 100 `STEEL TRAY` and 50 `PLASTIC TRAY`.
   - Worker enters dispatch quantity: e.g. 40 `STEEL TRAY` and 20 `PLASTIC TRAY`. (If a quantity > pending is entered, system validation blocks it).
   - System calculates Subtotal (₹2,600.00), Tax @ 9% (₹234.00), and Grand Total (₹2,834.00).
   - Clicks **"Generate & Print Challan"** -> Assigned `0001/26-27`.

4. **Print & PDF Export**:
   - Challan opens in pixel-perfect A4 preview matching the reference image.
   - Click **"Print Challan"** to print via physical printer (all application chrome is hidden, pure A4 layout).
   - Click **"Download PDF"** to save a PDF copy.

5. **Stock Depletion & Reports**:
   - Stock Ledger automatically reflects remaining pending balance: 60 `STEEL TRAY` and 30 `PLASTIC TRAY`.
   - Daily report and Customer report update in real-time.
   - Download reports in CSV / Excel format.
