# Firelle Supabase layer

Database schema, business RPCs, RLS, cashier-safe views, seed data and SQL
tests for the Firelle POS/ERP.

The product catalog is wired to this layer through the browser Supabase client
(`src/lib/supabase/`): reads come from `products_admin` (ADMIN) or
`products_cashier` (CASHIER), writes go through the `products` table and
`adjust_stock()` RPC. Supabase Auth is required because `anon` has no access;
the first registered user becomes ADMIN (see the auth trigger migration).

---

## Apply

Local:

```bash
npx supabase start
npx supabase db reset     # migrations + seed.sql
npx supabase test db      # pgTAP (Docker required)
```

Linked project:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --include-seed
npx supabase gen types typescript --linked > src/types/database.types.ts
```

`db push` applies migrations. `--include-seed` is required for a remote
project; without it Supabase only checks that seed files are up to date.

If the CLI connects through the linked-project login role, no DB password is
needed. Otherwise pass `--db-url` or `--password`.

---

## Migrations

| File | Concern |
| --- | --- |
| `20261022120000_extensions_enums.sql` | `pgcrypto`, `pg_trgm`, all enum types |
| `20261022120100_tables.sql` | 9 tables, CHECKs, FKs, indexes, `updated_at` triggers |
| `20261022120200_auth_trigger.sql` | `auth.users` → `public.users` profile trigger |
| `20261022120500_functions.sql` | RPCs, role helper, cashflow immutability trigger |
| `20261022120600_rls_views.sql` | RLS policies, column grants, cashier/admin views |
| `20261022130000_invoice_stock_functions.sql` | WIB invoice number + signed-delta `adjust_stock` |
| `20261022131000_reconcile_rpc_api.sql` | Aligns `create_transaction` with WIB dates, keeps one `adjust_stock` API, reserves `FR020` for invalid dates |
| `20261022132000_harden_function_acl.sql` | Revokes explicit `anon` EXECUTE grants from project functions |
| `20261022140000_transaction_functions.sql` | Final atomic checkout/void definitions; `FR021 INVALID_PAYMENT` |
| `20261022150000_rls_matrix_guards.sql` | Final RLS matrix, cashier-safe products, last-admin and transaction-delete guards |
| `20261022160000_protect_walkin_client.sql` | Makes the seeded walk-in client immutable; `FR024 WALK_IN_CLIENT_PROTECTED` |

One concern per file, timestamped and idempotent. Applied migrations are
history: change them only with a new migration.

### Enums

| Enum | Values |
| --- | --- |
| `user_role` | `ADMIN`, `CASHIER` |
| `txn_status` | `COMPLETED`, `VOID` |
| `payment_method` | `CASH`, `QRIS`, `TRANSFER` |
| `cashflow_type` | `IN`, `OUT` |
| `stock_movement_type` | `INITIAL`, `SALE`, `VOID_RETURN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT` |
| `adjust_reason` | `RESTOCK`, `DAMAGED`, `LOST`, `STOCK_OPNAME`, `OTHER` |

### Tables

`users`, `clients`, `products`, `invoice_counters`, `transactions`,
`transaction_items`, `stock_movements`, `cashflows`, `settings`.

- `users.id` is the `auth.users.id` (1:1 profile); `is_active` blocks access.
- `clients` archives with `is_active = false`; a partial unique index allows
  exactly one walk-in row, and a trigger prevents editing, deactivating or
  deleting that row (`FR024`).
- `products` uses `is_deleted` + `deleted_at` (kept consistent by a CHECK);
  SKU is unique only among active rows.
- `transactions` stores `client_name` and all money totals as snapshots. No
  tax column: totals are `subtotal_amount - discount_amount`.
- `transaction_items` stores product/unit/price/cost snapshots; `subtotal`
  and `subtotal_profit` are enforced against those snapshots.
- `stock_movements` is append-only; adjustments require a reason and the sign
  of `qty_change` must match the movement type.
- `cashflows` separates manual rows from auto sale/void rows.
- `settings` is a singleton row.

Financial links use `ON DELETE RESTRICT`; the `auth.users` → `users` link
uses `ON DELETE CASCADE` because it mirrors identity, not financial history.

---

## RPCs

| Function | Who | Purpose |
| --- | --- | --- |
| `next_invoice_number(date default WIB today)` | authenticated | Daily `INV-YYYYMMDD-NNN` sequence, row-locked |
| `create_transaction(...)` | authenticated | Atomic sale: lock products, re-read prices, stock ledger, auto `IN` cashflow, idempotent by key |
| `void_transaction(id, reason)` | ADMIN | Restore stock, `VOID_RETURN` ledger, auto `OUT` cashflow |
| `adjust_stock(id, delta, reason, note)` | ADMIN | Manual stock in/out with a signed delta and ledger row |
| `current_role()` | internal | Active role for the JWT user, or `NULL` |

Errors use custom SQLSTATEs `FR001`–`FR024`. `FR018` is
`VOID_REASON_REQUIRED`, `FR020` is `INVALID_DATE`, `FR021` is
`INVALID_PAYMENT`, `FR022` is `LAST_ACTIVE_ADMIN`, `FR023` is
`TRANSACTION_DELETE_FORBIDDEN`, and `FR024` is
`WALK_IN_CLIENT_PROTECTED`. See the headers of
`20261022120500_functions.sql`, `20261022131000_reconcile_rpc_api.sql`,
`20261022140000_transaction_functions.sql`,
`20261022150000_rls_matrix_guards.sql` and
`20261022160000_protect_walkin_client.sql`.

`create_transaction` accepts optional per-line `discount_amount` for API
compatibility and folds it into `transactions.discount_amount`; the schema
stores one discount at transaction level. `transaction_items` keeps gross
line values.

---

## RLS and cost visibility

- CASHIER: create sales through `create_transaction()`, read own
  transactions/items, read active products without cost/profit, and create/
  read active clients.
- CASHIER has no cashflow or stock-ledger access. Those are ADMIN-only.
- ADMIN: every other business read/write, including products, clients, users,
  settings, manual cashflows, voids and stock adjustments.
- Active users may read `settings` so receipts can render; only ADMIN updates
  it.
- There are no direct INSERT/UPDATE/DELETE policies on `transactions`.
  `create_transaction()` and `void_transaction()` are the only supported
  writers; a trigger blocks DELETE entirely (`FR023`).
- The last active ADMIN cannot be deleted, deactivated or demoted (`FR022`).
- The seeded walk-in client cannot be edited, deactivated or deleted (`FR024`).
- `products.cost_price`, `transaction_items.subtotal_profit`,
  `transactions.total_cost` and `transactions.total_profit` are not granted
  to `authenticated` on the base tables.
- `products_cashier`, `transaction_items_cashier` and
  `transactions_cashier` are `security_invoker` views without cost/profit.
- `create_transaction` returns `transactions_cashier`, so the receipt never
  carries cost/profit to a cashier.
- `products_admin`, `transaction_items_admin` and `transactions_admin` are
  guarded `security_invoker = false` views that return zero rows for cashiers.
- Auto cashflows reject UPDATE/DELETE through a trigger (`FR014`), not just
  RLS.
- `anon` has no table grants and no EXECUTE on project RPCs; business RPCs
  are granted to `authenticated` and `service_role` only.

---

## Seed

`supabase/seed.sql` is idempotent and inserts:

- `Pelanggan Umum` walk-in client (null `client_id` falls back to it)
- singleton store settings
- 10 hijab products with initial stock movements

It runs automatically on `db reset`; on a linked project use
`npx supabase db push --include-seed`.

---

## Tests

`supabase/tests/` uses pgTAP:

| File | Covers |
| --- | --- |
| `01_sales_and_cost_leak.sql` | happy path, idempotency, last-unit sale, cash underpayment, discount > subtotal, cashier cost leak |
| `02_void_and_cashflow.sql` | void, double void, cashier void denial, auto-cashflow immutability, ADMIN manual cashflows, cashier cashflow denial |
| `03_pricing_and_stock.sql` | stale price, archived product, stock adjustment rules |
| `04_rls_admin_guards.sql` | cashier cashflow/stock-ledger denial, last-active-admin guard, transaction DELETE guard, walk-in-client protection |
| `05_concurrent_last_unit.sql` | true two-session last-unit race via `dblink`; exactly one sale succeeds and the loser gets `FR001 INSUFFICIENT_STOCK` |

### Run the tests

Requirements: Docker, the Supabase CLI, and a local Supabase stack.

```bash
npx supabase start
npx supabase db reset          # migrations + seed.sql
npx supabase test db           # all pgTAP files
```

Run one file only:

```bash
npx supabase test db supabase/tests/01_sales_and_cost_leak.sql
npx supabase test db supabase/tests/05_concurrent_last_unit.sql
```

Tests `01`–`04` run in a transaction and roll back. Test `05` opens two
`dblink` sessions against the local database, resets its dedicated product to
stock 1, and intentionally leaves the successful sale's audit rows (transactions
cannot be deleted). Reset the local database with `npx supabase db reset` for a
pristine state. Do not run test `05` against a linked/production database.

---

## Deferred / superseded

`supabase/_deferred/` keeps the first draft of the functions, RLS, seed and
tests. It targeted an older table shape and is **not** applied. The active
versions are the `20261022120500` / `20261022120600` migrations, with the
final matrix in `20261022150000_rls_matrix_guards.sql` and the walk-in guard in
`20261022160000_protect_walkin_client.sql`, plus `supabase/seed.sql` and
`supabase/tests/`.

`src/types/database.types.ts` must be regenerated after the RPCs/views are
pushed; the checked-in fallback may predate them.
