# 📘 Product Requirement Document (PRD)
## Simple POS & Mini-ERP System — v2.0

| | |
|---|---|
| **Version** | 2.0 (revision of v1.0 "Full CRUD Edition") |
| **Last Updated** | 21 Oct 2026 |
| **Status** | Ready for build |
| **Currency / Locale / TZ** | IDR (Rp), `id-ID`, `Asia/Jakarta` (store all timestamps in UTC, render in WIB) |

### Changelog v1.0 → v2.0
| # | Change | Why |
|---|---|---|
| 1 | Added `users` + RBAC (Superadmin / Admin / Cashier) | v1 mentioned "Superadmin" but had no auth or role model |
| 2 | Added `stock_movements` ledger | Stock adjustments, sales, voids must be auditable; v1 only mutated `products.stock` |
| 3 | Money = `NUMERIC(14,2)`, qty = `NUMERIC(12,3)` | `Integer` qty breaks units like Kg/Liter |
| 4 | Checkout & Void run as **single atomic DB transaction** (RPC / `$transaction`) | Prevent half-written sales and stock race conditions |
| 5 | Void creates a **reversal cashflow entry** (not delete) | Preserves audit trail / bookkeeping integrity |
| 6 | Hard delete of transactions **removed** → replaced by VOID only | Hard delete of financial records is an accounting anti-pattern |
| 7 | Concurrency-safe invoice numbering (`invoice_counters`) | `INV-YYYYMMDD-NNN` collides under concurrent checkouts |
| 8 | Per-product `min_stock` + `barcode`/`sku` | Fixed thresholds (5/10) don't fit all products; barcode enables scanner |
| 9 | Walk-in default client, `discount_amount`, payment rules per method | Real cashier edge cases |
| 10 | Profit definition clarified (Gross Profit vs Net Cashflow) | v1 mixed them in one card set |
| 11 | Added NFR, edge cases, acceptance criteria, RLS, indexes, milestones, out-of-scope | v1 had none |
| 12 | Vibe-coding prompts expanded (8 prompts) + sharper constraints | Less ambiguity → fewer rewrites |

---

## 1. Overview & Context
- **Product:** Web-based POS + lightweight ERP (inventory, clients, cashflow, profit reporting).
- **Target users:** Retail store owners, cashiers, small business operators (single store, v1).
- **Primary goals:**
  1. Complete a sale in **≤ 5 clicks / ≤ 15 seconds** for a 3-item cart.
  2. Stock and cashflow always consistent with transactions — **zero manual reconciliation**.
  3. Owner sees real profit (not just revenue) at any time.
- **Success metrics:** checkout success rate ≥ 99.5%; stock discrepancy = 0 on audit; page load (LCP) < 2s on mid-range Android over 4G.
- **Tech stack:**
  - **Frontend:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, Lucide React, React Hook Form + Zod.
  - **Backend/DB:** Supabase (PostgreSQL + Auth + RLS) **or** Prisma + PostgreSQL. Business-critical writes (checkout, void, stock adjust) live in Postgres functions or Prisma `$transaction`.
  - **Data fetching:** TanStack Query or Server Actions (pick one, don't mix).
  - **Extras:** `date-fns` (+tz), `react-to-print` (receipt), `recharts` (dashboard charts).

### Out of Scope (v2.0)
Multi-store/branch, purchase orders & suppliers, partial payment / receivables (piutang), product variants, loyalty points, e-invoice/tax reporting, payment gateway integration (QRIS/Transfer are **manually confirmed** by cashier), offline mode.

---

## 2. Roles & Permissions (RBAC)

| Capability | Cashier | Admin | Superadmin |
|---|:--:|:--:|:--:|
| Use POS, create transaction | ✅ | ✅ | ✅ |
| View own transactions / all transactions | own | all | all |
| Void transaction | ❌ | ✅ (with reason) | ✅ |
| Products: create / edit / stock adjust | ❌ | ✅ | ✅ |
| Products: soft delete / restore | ❌ | ✅ | ✅ |
| Clients: CRUD | create/read | ✅ | ✅ |
| Cashflow: view / manual CRUD | ❌ | ✅ | ✅ |
| See cost price & profit | ❌ | ✅ | ✅ |
| Manage users / roles | ❌ | ❌ | ✅ |
| Purge soft-deleted data (hard delete, never for transactions) | ❌ | ❌ | ✅ |

> Enforce on **both** UI (hide) and DB (RLS / server-side checks). UI hiding alone is not security.

---

## 3. Core Business Logic

```text
[Product Catalog] ── cost_price (HPP) + selling_price + stock
        │
        ▼
[POS / Cashier] ── items + qty + unit + client (or Walk-in) + discount + payment
        │
        ▼
[Checkout — ONE atomic DB transaction]
        ├─ 1. Validate stock (reject if insufficient, unless allow_negative_stock = true)
        ├─ 2. Generate invoice number (concurrency-safe)
        ├─ 3. Insert transactions + transaction_items (price/cost/name snapshots)
        ├─ 4. Deduct stock + insert stock_movements (type SALE)
        └─ 5. Insert cashflow IN (category "POS Sale", is_manual=false)

[Void — ONE atomic DB transaction]
        ├─ 1. Guard: status must be COMPLETED, reason required
        ├─ 2. status → VOID, set voided_at / voided_by / void_reason
        ├─ 3. Restore stock + insert stock_movements (type VOID_RETURN)
        └─ 4. Insert reversal cashflow OUT (category "POS Void", is_manual=false)
             (original IN row is kept — never deleted)
```

### Business Rules
| ID | Rule |
|---|---|
| BR-01 | Stock never goes negative by default. Setting `allow_negative_stock` (store setting) overrides. |
| BR-02 | `transaction_items` store **snapshots** of name, unit, cost, price → later product edits never alter history. |
| BR-03 | Void is final (no un-void). To correct, create a new transaction. |
| BR-04 | Transactions are **never hard deleted**. |
| BR-05 | Auto cashflow rows (`is_manual=false`) are read-only in the Cashflow module. |
| BR-06 | **Gross Profit** = Σ `subtotal_profit` of `COMPLETED` transactions − discounts. **Net Cashflow** = Σ IN − Σ OUT. These are different numbers and shown separately. |
| BR-07 | `Cash`: `amount_paid ≥ total_amount`, `change = amount_paid − total`. `QRIS`/`Transfer`: `amount_paid = total_amount`, `change = 0`. |
| BR-08 | Selling price < cost price is allowed but triggers a visible warning (create/edit product, and at POS if price is overridden). |
| BR-09 | Soft-deleted products are hidden from POS and product list (toggle "Show archived" for Admin) but remain referenced by history. |
| BR-10 | A client with transactions cannot be hard deleted → archived (`is_active=false`). Client with no history can be deleted. |
| BR-11 | Discount per transaction (nominal or %), cannot exceed subtotal. Distributed proportionally to item profit in reports. |
| BR-12 | Stock adjustments require a reason (enum: `RESTOCK`, `DAMAGED`, `LOST`, `STOCK_OPNAME`, `OTHER`) + note. |

---

## 4. Database Schema (PostgreSQL)

> Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` timestamps, money `NUMERIC(14,2)`, qty `NUMERIC(12,3)`, `CHECK` constraints for invariants.

### A. `users` (profile table; Supabase: extends `auth.users`)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` on Supabase |
| full_name | text NOT NULL | |
| email | text UNIQUE NOT NULL | |
| role | text NOT NULL | `CHECK (role IN ('SUPERADMIN','ADMIN','CASHIER'))` |
| is_active | boolean | default `true` |
| created_at | timestamptz | default `now()` |

### B. `products`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| sku | text | UNIQUE (partial: `WHERE is_deleted = false`), nullable |
| barcode | text | indexed, nullable |
| name | text NOT NULL | |
| unit | text NOT NULL | e.g. Pcs, Box, Kg, Pack |
| cost_price | numeric(14,2) NOT NULL | `CHECK (cost_price >= 0)` |
| selling_price | numeric(14,2) NOT NULL | `CHECK (selling_price >= 0)` |
| stock | numeric(12,3) NOT NULL | default `0`; negative blocked by app rule BR-01 |
| min_stock | numeric(12,3) NOT NULL | default `5`; drives low-stock badge |
| is_deleted | boolean | default `false` |
| deleted_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | `updated_at` via trigger |

### C. `stock_movements` *(new)*
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products.id NOT NULL | |
| type | text NOT NULL | `INITIAL`, `SALE`, `VOID_RETURN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT` |
| qty_change | numeric(12,3) NOT NULL | signed (+/−) |
| stock_after | numeric(12,3) NOT NULL | running balance snapshot |
| reason | text | enum from BR-12 for adjustments |
| note | text | |
| transaction_id | uuid FK → transactions.id | nullable |
| created_by | uuid FK → users.id | |
| created_at | timestamptz | |

### D. `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| phone | text | nullable, normalized (+62…) |
| address | text | nullable |
| is_active | boolean | default `true` |
| is_walk_in | boolean | default `false`; exactly one seeded row "Walk-in Customer" |
| created_at / updated_at | timestamptz | |

### E. `invoice_counters` *(new)*
| Column | Type | Notes |
|---|---|---|
| date | date PK | store-local date |
| last_number | integer NOT NULL | incremented with `INSERT … ON CONFLICT DO UPDATE … RETURNING` (row-locked → no duplicates) |

Format: `INV-YYYYMMDD-NNN` (e.g. `INV-20261021-001`), zero-pad to 3, grows beyond if >999.

### F. `transactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoice_number | text UNIQUE NOT NULL | |
| client_id | uuid FK → clients.id | nullable |
| client_name | text NOT NULL | snapshot |
| subtotal_amount | numeric(14,2) NOT NULL | Σ item subtotals |
| discount_amount | numeric(14,2) NOT NULL | default `0` |
| total_amount | numeric(14,2) NOT NULL | `subtotal − discount` |
| total_cost | numeric(14,2) NOT NULL | Σ HPP |
| total_profit | numeric(14,2) NOT NULL | `total_amount − total_cost` (stored for fast reports) |
| payment_method | text NOT NULL | `CASH`, `QRIS`, `TRANSFER` |
| amount_paid | numeric(14,2) NOT NULL | |
| change_amount | numeric(14,2) NOT NULL | default `0` |
| status | text NOT NULL | `COMPLETED` / `VOID`, default `COMPLETED` |
| notes | text | |
| void_reason | text | required when VOID |
| voided_at | timestamptz | |
| voided_by | uuid FK → users.id | |
| created_by | uuid FK → users.id NOT NULL | cashier |
| created_at | timestamptz | |

Constraints: `CHECK (total_amount = subtotal_amount - discount_amount)`, `CHECK (amount_paid >= total_amount)`, `CHECK (status <> 'VOID' OR void_reason IS NOT NULL)`.

### G. `transaction_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| transaction_id | uuid FK → transactions.id **ON DELETE RESTRICT** | (v1 used CASCADE; changed since transactions are never deleted) |
| product_id | uuid FK → products.id | nullable |
| product_name | text NOT NULL | snapshot |
| unit | text NOT NULL | snapshot |
| qty | numeric(12,3) NOT NULL | `CHECK (qty > 0)` |
| cost_price | numeric(14,2) NOT NULL | snapshot per unit |
| selling_price | numeric(14,2) NOT NULL | snapshot per unit |
| subtotal | numeric(14,2) NOT NULL | `qty * selling_price` |
| subtotal_profit | numeric(14,2) NOT NULL | `(selling_price − cost_price) * qty` |

### H. `cashflows`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| type | text NOT NULL | `IN` / `OUT` |
| amount | numeric(14,2) NOT NULL | `CHECK (amount > 0)` (direction is in `type`) |
| category | text NOT NULL | "POS Sale", "POS Void", "Operational Expense", "Stock Purchase", "Rent", "Utilities", "Salary", "Other Income", … |
| description | text | |
| is_manual | boolean | default `true` |
| transaction_id | uuid FK → transactions.id **ON DELETE RESTRICT** | nullable |
| occurred_at | timestamptz NOT NULL | default `now()`; editable for manual entries (backdating) |
| created_by | uuid FK → users.id | |
| created_at / updated_at | timestamptz | |

### I. `settings` *(new, single-row)*
`store_name`, `store_address`, `store_phone`, `receipt_footer`, `allow_negative_stock` (default false), `low_stock_default` (default 5), `receipt_paper` (`58mm`/`80mm`/`A4`).

### Indexes
```sql
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops); -- needs pg_trgm
CREATE INDEX idx_products_barcode ON products (barcode) WHERE is_deleted = false;
CREATE INDEX idx_tx_created_at ON transactions (created_at DESC);
CREATE INDEX idx_tx_client ON transactions (client_id);
CREATE INDEX idx_tx_status_created ON transactions (status, created_at DESC);
CREATE INDEX idx_items_tx ON transaction_items (transaction_id);
CREATE INDEX idx_items_product ON transaction_items (product_id);
CREATE INDEX idx_cf_occurred ON cashflows (occurred_at DESC);
CREATE INDEX idx_cf_type_occurred ON cashflows (type, occurred_at DESC);
CREATE INDEX idx_sm_product ON stock_movements (product_id, created_at DESC);
```

### Atomic Checkout (reference implementation sketch)
```sql
-- create_transaction(p_client_id uuid, p_items jsonb, p_discount numeric,
--                    p_payment_method text, p_amount_paid numeric, p_user uuid)
-- Runs in a single transaction. Steps:
-- 1. For each item: SELECT … FROM products WHERE id = :id AND is_deleted = false FOR UPDATE;
--    -> RAISE EXCEPTION 'INSUFFICIENT_STOCK:<product>' if stock < qty (unless allow_negative_stock)
-- 2. invoice_number := next_invoice_number(current_date_wib);
-- 3. INSERT transactions (…); INSERT transaction_items (… snapshots …);
-- 4. UPDATE products SET stock = stock - qty; INSERT stock_movements (type 'SALE', …);
-- 5. INSERT cashflows (type 'IN', category 'POS Sale', is_manual false, transaction_id, amount = total_amount);
-- RETURN transaction id.
-- Prices used are re-read from DB server-side — NEVER trust client-sent prices/costs.
```
`void_transaction(p_tx_id uuid, p_reason text, p_user uuid)` follows the Void flow in §3 with `SELECT … FOR UPDATE` on the transaction row to block double-void.

### Row Level Security (Supabase)
- All tables: RLS **enabled**; deny by default.
- `products`: Cashier `SELECT` only **through a view/column-masked query that excludes `cost_price`**; Admin+ full access.
- `transactions`/`transaction_items`: Cashier sees own rows; cost/profit columns hidden from Cashier (via view `v_transactions_cashier`).
- `cashflows`, `users`, `settings`: Admin+ / Superadmin per §2.
- All mutations that touch stock/cashflow go through RPC functions (`SECURITY DEFINER` with explicit role checks), not direct table writes.

---

## 5. Feature Specifications

### 🔐 Module 0: Auth & Users (`/login`, `/settings/users`)
- Email + password login; session persisted; auto-redirect by role (Cashier → `/pos`, Admin+ → `/dashboard`).
- Superadmin: create/deactivate users, change role, reset password. Cannot demote/deactivate self if last Superadmin.
- Logout; idle timeout 8h (configurable).

### 📊 Module 1: Dashboard (`/dashboard`) — Admin+
- Cards: Today's Sales, Today's Gross Profit, Transactions Count, Low-Stock Items.
- Charts: Sales & Profit last 7/30 days (line), Top 5 products by qty and by profit (bar), Payment method split (donut).
- Alert list: products at/below `min_stock`.

### 📦 Module 2: Product Catalog (`/products`) — Full CRUD
1. **Create:** Dialog — Name*, SKU, Barcode, Unit* (dropdown + custom), Cost Price*, Selling Price*, Initial Stock*, Min Stock.
   - Live **Margin %** = `(selling − cost) / selling × 100` and **Markup %** = `(selling − cost) / cost × 100`.
   - Warning banner if selling < cost (BR-08). Initial stock > 0 creates an `INITIAL` stock movement.
2. **Read:** Table with columns Name, SKU, Unit, Cost*, Price, Margin, Stock, Status (*Admin+ only). Features: debounced search (name/SKU/barcode), stock filter (All / Low / Out of stock), sortable columns, pagination (25/page), "Show archived" toggle.
   - Stock badge: 🔴 `stock ≤ 0` **Out** or `stock < min_stock` **Low**; 🟡 `stock ≤ min_stock × 2` **Warning**; 🟢 otherwise **OK**.
3. **Update:**
   - Edit dialog: name, SKU, barcode, unit, cost, price, min stock. (Stock is **not** editable here.)
   - **Stock Adjustment dialog:** direction (add/deduct), qty, reason (BR-12), note → writes `stock_movements`. Show current → resulting stock preview; block if result < 0.
   - Detail drawer: **Stock history** (from `stock_movements`) with type, qty, balance, user, date.
4. **Delete:** AlertDialog → soft delete (`is_deleted=true`, `deleted_at`). **Restore** action under "Show archived".
5. **Bonus:** CSV import (template download, row-level error report) and CSV export.

### 👤 Module 3: Client Management (`/clients`) — Full CRUD
1. **Create:** Name*, Phone (validated, normalized to +62), Address/Notes. Duplicate-phone warning.
2. **Read:** Table: Name, Phone, Total Transactions, **Total Spending (COMPLETED only)**, Last Purchase. Search by name/phone. Detail page: transaction history of that client.
3. **Update:** Edit all fields. Walk-in client is not editable/deletable.
4. **Delete:** Confirmation dialog. Per BR-10: no history → hard delete; has history → archive (`is_active=false`), existing snapshots unaffected.

### 🛒 Module 4: POS (`/pos`)
**Layout:** two panels (stacked/tabbed on mobile).
- **Left — Catalog:** search (name/SKU) + **barcode scanner input** (Enter adds exact match), product grid/list with price & stock, out-of-stock items greyed and non-addable.
- **Right — Cart:**
  - Line: name, unit, unit price, qty stepper `+ / −` and direct numeric input, line subtotal, remove.
  - Decimal qty allowed only for units configured as decimal (Kg, Liter, Meter); integer for Pcs/Box/Pack.
  - Client selector: search existing / quick-add new (name, phone) / default **Walk-in Customer**.
  - Discount (Rp or %), notes.
  - Totals: Subtotal, Discount, **Total**.
  - Payment: method (Cash/QRIS/Transfer), amount paid (Cash: quick buttons *Exact, 50k, 100k, 200k*), live **change** or "short by Rp X".
  - **Checkout** button disabled until valid; shows spinner, prevents double submit (idempotency key per cart).
- **Shortcuts:** `F2` focus search, `F4` payment, `Ctrl+Enter` checkout, `Esc` clear search.
- **After success:** success screen with receipt preview → **Print** / **New Sale**. Cart cleared only after server confirms.
- **Hold/Resume cart** (up to 5 parked carts, local state).
- **Errors:** insufficient stock → show which product + available qty, keep cart intact.

### 🧾 Module 5: Transactions (`/transactions`)
1. **Read:** Table: Invoice, Date/Time, Client, Items, Total, Profit*, Payment, Status, Cashier. Filters: date range (Today / 7d / This Month / Custom), status, payment method, cashier, client. Search by invoice. Export CSV.
2. **Detail / Receipt:** items, totals, payment, change, status badge; **Print / Re-print** (thermal 58/80mm CSS + A4), reprint adds "COPY" mark.
3. **Void (Admin+):** dialog requires **reason**; summary of what will be reversed (stock per item, cashflow amount). On confirm → atomic void (§3). VOID rows shown with strikethrough + badge, excluded from sales/profit totals.
4. **Delete:** ❌ Not available (BR-04). Superadmin may only *anonymize notes* if needed — no financial data removal.

### 💰 Module 6: Cashflow & Reports (`/cashflow`) — Admin+
1. **Read:**
   - Cards: **Total Cash In**, **Total Cash Out**, **Net Cashflow**, **Gross Profit (sales)**, **Net Profit** = Gross Profit − manual OUT of operating categories (Operational Expense, Rent, Utilities, Salary). *Stock Purchase is excluded from Net Profit (it is inventory, already counted via HPP)* — shown in tooltip.
   - Table: Date, Type, Category, Description, Amount, Source (Auto/Manual), Linked invoice. Filters: date range (Today / This Week / This Month / Custom), type, category, source. Pagination + CSV export.
   - Breakdown chart: expenses by category.
2. **Create:** Manual form — Type*, Category* (dropdown + custom), Amount* (> 0), Date* (default now, backdate allowed), Description.
3. **Update:** Manual entries only; auto rows locked (🔒) per BR-05. Keep `updated_at`; optional change log.
4. **Delete:** Manual entries only, with confirmation dialog.
5. **Reconciliation helper:** "Cash drawer" view = opening cash + cash-method IN − cash OUT for a chosen day (simple closing report). Print daily closing summary.

### ⚙️ Module 7: Settings (`/settings`) — Superadmin
Store identity & receipt footer, paper size, low-stock default, negative-stock toggle, user management link.

---

## 6. Non-Functional Requirements
| Area | Requirement |
|---|---|
| Performance | Product search < 300ms for 10k products (trigram index); checkout RPC < 1s p95 |
| Integrity | All money/stock mutations transactional; no client-trusted prices; idempotent checkout |
| Security | RLS on all tables, role checks server-side, Zod validation both sides, no secrets in client bundle, rate-limit login |
| Responsiveness | Fully usable on tablet (primary POS device) and mobile; min touch target 44px |
| Accessibility | Keyboard-navigable POS, visible focus, color-blind-safe badges (icon + text, not color only) |
| Reliability | Daily automated DB backup; soft-deletes + void instead of destructive ops |
| Audit | `created_by`, `voided_by`, `stock_movements` for all stock changes |
| i18n | UI language configurable ID/EN (default **ID**); all currency via `Intl.NumberFormat('id-ID')` |
| Observability | Server error logging (e.g., Sentry), failed-checkout log with reason |

---

## 7. Edge Cases (must be handled)
1. Two cashiers sell the last unit simultaneously → second gets `INSUFFICIENT_STOCK`, no negative stock.
2. Double-click / network retry on Checkout → idempotency key prevents duplicate transaction.
3. Product price changed while in cart → server uses current DB price; UI shows "price updated" notice and recalculates before confirming.
4. Product soft-deleted while in cart → checkout rejected with clear message, item flagged.
5. Void of a transaction containing a now-archived product → stock still restored to the archived product row.
6. Void attempted twice (two tabs) → second fails (row lock + status guard).
7. Cash paid < total → checkout disabled; QRIS/Transfer amount must equal total.
8. Discount > subtotal → blocked; discount equal to subtotal → allowed (total 0) but requires payment method `CASH` with paid 0 (free item flow) — *optional; default block total = 0*.
9. Midnight rollover during a cart → invoice number uses date at **checkout time** (WIB).
10. Client deleted/archived after sale → transaction keeps `client_name` snapshot.
11. Decimal qty on Pcs unit → rejected by validation.
12. Date-range filters use WIB day boundaries (00:00–23:59:59), not UTC.

---

## 8. Acceptance Criteria (key flows)
**AC-1 Checkout**
- Given cart with 2 items and sufficient stock, when Cashier checks out with Cash ≥ total → transaction `COMPLETED`, stock reduced by qty, 1 `stock_movements` row per item (`SALE`), 1 cashflow `IN` = `total_amount`, receipt shown.
- Given any step fails → nothing is persisted (stock, transaction, cashflow all unchanged).

**AC-2 Void**
- Given `COMPLETED` transaction, when Admin voids with reason → status `VOID`, stock restored (`VOID_RETURN` movements), reversal cashflow `OUT` created, original `IN` row retained, dashboard/profit exclude the transaction.
- Voiding an already-VOID transaction returns an error and changes nothing.

**AC-3 Stock Adjustment**
- Deducting more than current stock is rejected. Valid adjustments create a `stock_movements` row with reason, note, user, resulting balance.

**AC-4 Permissions**
- Cashier cannot see cost price/profit in UI **or** via direct API/DB query; cannot access `/cashflow`, `/dashboard`, void, or product edit routes (redirect + 403).

**AC-5 Cashflow**
- Manual entries are editable/deletable; auto entries show lock and reject modification at DB level.
- Cards equal the sum of the filtered table for the selected range.

**AC-6 Soft Delete**
- Archived product disappears from POS and default list, remains visible in old receipts, and can be restored.

---

## 9. Milestones
| Phase | Scope | Exit criteria |
|---|---|---|
| M0 | Schema, migrations, seed (walk-in client, settings, sample products), Auth + RBAC + RLS | Roles verified with test users |
| M1 | Products + stock movements + Clients | AC-3, AC-6 pass |
| M2 | POS + checkout RPC + Transactions + Void + receipt print | AC-1, AC-2 pass; concurrency test passes |
| M3 | Cashflow + dashboard + reports + CSV export | AC-5 pass; totals reconcile with transactions |
| M4 | Settings, polish, shortcuts, mobile QA, UAT with real store data | AC-4 pass; no P1 bugs |

---

## 10. Step-by-Step AI Vibe Coding Prompts

> Run sequentially. After each, test the acceptance criteria listed before moving on. Always paste §3 (Business Rules) and §4 (Schema) into the context of the editor.

### 🤖 Prompt 1 — Database, RLS & Atomic Functions
> "Act as a senior full-stack engineer. Using PostgreSQL (Supabase) create SQL migrations for: `users`, `products`, `stock_movements`, `clients`, `invoice_counters`, `transactions`, `transaction_items`, `cashflows`, `settings` exactly per the schema I provide (types, CHECK constraints, FKs with ON DELETE RESTRICT where specified, `updated_at` triggers, indexes incl. pg_trgm). Then write PL/pgSQL functions `next_invoice_number(date)`, `create_transaction(...)`, `void_transaction(...)`, `adjust_stock(...)` that run atomically with `SELECT … FOR UPDATE` row locks, re-read prices server-side, and follow the business rules BR-01…BR-12. Add RLS policies by role (SUPERADMIN/ADMIN/CASHIER) and a cashier-safe view that hides cost/profit. Seed: 1 walk-in client, default settings, 10 sample products. Include SQL tests for concurrent last-unit sale and double void."

### 🤖 Prompt 2 — Project Scaffold, Auth & Layout
> "Scaffold a Next.js App Router TypeScript project with Tailwind and shadcn/ui, Supabase Auth, TanStack Query, React Hook Form + Zod. Implement login, session handling, role-based route guards (middleware + server checks), and an app shell with sidebar (items shown per role), top bar with user menu, dark/light mode, and Indonesian locale helpers (`formatRupiah`, WIB date formatting). Create a typed `database.types.ts` from the schema."

### 🤖 Prompt 3 — Product Catalog (Full CRUD + Stock)
> "Build `/products` per Module 2: table with debounced search (name/SKU/barcode), stock filter, sorting, pagination, stock badges using `min_stock`, 'Show archived' toggle. Dialogs: Create (live margin/markup + selling<cost warning), Edit, Stock Adjustment (reason enum, note, resulting-stock preview, block negative) calling `adjust_stock` RPC, soft-delete AlertDialog + restore. Drawer showing `stock_movements` history. Hide cost price for CASHIER. Add CSV import/export. Use optimistic UI only for non-financial updates."

### 🤖 Prompt 4 — Client Management
> "Build `/clients` per Module 3: CRUD with phone normalization (+62), duplicate-phone warning, columns Total Transactions / Total Spending (COMPLETED only) / Last Purchase via a SQL view, detail page with transaction history, archive-vs-delete logic per BR-10, and protect the Walk-in client."

### 🤖 Prompt 5 — POS Cashier
> "Build `/pos` per Module 4: two-panel responsive layout, product grid + search + barcode-scanner input, cart with qty stepper/direct input (decimal only for decimal units), client selector with quick-add, discount (Rp/%), payment method rules (BR-07), cash quick-amount buttons, live change/shortage, keyboard shortcuts, hold/resume carts. On checkout call `create_transaction` with an idempotency key; handle `INSUFFICIENT_STOCK` and price-changed errors gracefully without clearing the cart. On success show a print-ready receipt (58mm/80mm CSS via react-to-print) using store settings."

### 🤖 Prompt 6 — Transactions, Receipt & Void
> "Build `/transactions` per Module 5: filterable/paginated table (date presets in WIB, status, payment, cashier, client, invoice search), detail drawer with receipt and Re-print (adds COPY mark), CSV export, and an Admin-only Void dialog requiring a reason and showing a reversal summary, calling `void_transaction`. Voided rows styled with strikethrough + badge. No delete action anywhere."

### 🤖 Prompt 7 — Cashflow, Dashboard & Reports
> "Build `/cashflow` and `/dashboard` per Modules 1 and 6: metric cards (Cash In/Out, Net Cashflow, Gross Profit, Net Profit with tooltip on definitions BR-06), filtered cashflow table with source (Auto/Manual) and lock icon on auto rows, manual create/edit/delete modals (Zod: amount > 0, backdating allowed), expenses-by-category chart, daily closing report printable, and dashboard charts (7/30-day sales & profit, top products, payment split, low-stock alerts). Ensure card totals equal table totals for the selected range."

### 🤖 Prompt 8 — Settings, Hardening & QA
> "Add `/settings` (store info, receipt footer, paper size, low-stock default, negative-stock toggle) and `/settings/users` (Superadmin CRUD, role change, deactivate, last-superadmin guard). Then harden: add loading/empty/error states everywhere, toast feedback, form dirty-state guards, 44px touch targets, aria labels, error logging (Sentry), and write Playwright E2E tests for AC-1…AC-6 plus the edge cases in §7."

---

## 11. Open Questions (decide before M2)
1. Is negative stock ever allowed (pre-orders)? *(default: no)*
2. Is a PPN/tax line needed on receipts? *(default: no, out of scope)*
3. Is a physical receipt printer used (thermal 58/80mm) or browser/A4 only?
4. Should Cashiers be able to give discounts, or Admin-approval only?
5. Are products sold in multiple units (e.g., Box = 12 Pcs) requiring unit conversion? *(if yes → add `product_units` table in v2.1; cart "unit selector" in v1 only displays the product's base unit)*
