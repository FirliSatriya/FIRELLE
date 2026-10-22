# Firelle Supabase layer

Schema, RPCs, RLS, seed and SQL tests for the Firelle POS/ERP.

The UI is intentionally **not** wired to this database yet. Every table, enum,
view and RPC here exists so the POS, cashflow, client and reporting modules can
be connected in a later step.

---

## Apply

```bash
# 1. Link the project once (needs a Supabase access token)
npx supabase login
npx supabase link --project-ref <project-ref>

# 2. Push migrations
npx supabase db push

# 3. Seed (db push does NOT run seed.sql on a remote project)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql

# 4. Generate TypeScript types
npx supabase gen types typescript --linked > src/types/database.types.ts

# 5. SQL tests (local Supabase / Docker required)
npx supabase test db
```

Local-only alternative: `npx supabase start && npx supabase db reset` runs all
migrations plus `seed.sql` automatically.

Migration files are timestamped and idempotent (`if not exists`,
`create or replace`, `drop policy/trigger if exists`). One concern per file:

| File | Concern |
| --- | --- |
| `20261022120000_extensions_enums.sql` | `pgcrypto`, `pg_trgm`, all enums |
| `20261022120100_tables.sql` | 9 tables, checks, FKs, indexes, `updated_at` |
| `20261022120200_auth_trigger.sql` | `auth.users` → `public.users` profile |
| `20261022120300_functions.sql` | RPCs + immutable-cashflow trigger |
| `20261022120400_rls_views.sql` | RLS, column grants, safe views, RPC grants |

---

## Objects

### Tables
`users`, `products`, `stock_movements`, `clients`, `invoice_counters`,
`transactions`, `transaction_items`, `cashflows`, `settings`.

Money is `NUMERIC(14,2)`, quantities `NUMERIC(12,3)`. Financial tables use
`ON DELETE RESTRICT`; products/clients are soft-deleted via
`is_deleted` + `deleted_at` (kept consistent by a CHECK).

### RPCs (all `SECURITY DEFINER`, `search_path = public`)
- `next_invoice_number(date)` → `INV-YYYYMMDD-NNNN` (daily reset).
- `create_transaction(client, items jsonb, method, paid, idempotency_key, ...)`
- `void_transaction(transaction_id, reason)`
- `adjust_stock(product_id, 'add'|'deduct', qty, reason, note)`
- `current_role()` → `user_role` or `NULL`.

### Views
- `products_cashier` — `security_invoker`, no `cost_price`.
- `transaction_items_cashier` — `security_invoker`, no `unit_cost`/`profit`.
- `products_admin` — `security_definer`, guarded by `current_role() = 'ADMIN'`, includes cost.
- `transaction_items_admin` — same guard, includes cost/profit.

---

## Error contract

`create_transaction`, `void_transaction` and `adjust_stock` raise custom
SQLSTATEs so clients can map errors without parsing prose.

| Code | Message | Meaning |
| --- | --- | --- |
| `FR001` | `INSUFFICIENT_STOCK` | Requested qty > current stock |
| `FR002` | `PRODUCT_ARCHIVED` | Product is soft-deleted |
| `FR003` | `PRICE_CHANGED` | Client `unit_price` ≠ current DB price |
| `FR004` | `DISCOUNT_EXCEEDS_SUBTOTAL` | Line or header discount too large |
| `FR005` | `INSUFFICIENT_PAYMENT` | `amount_paid` < total (cash underpay) |
| `FR006` | `ALREADY_VOID` | Transaction already voided |
| `FR007` | `INVALID_QUANTITY` | Qty ≤ 0 or adjustment qty ≤ 0 |
| `FR008` | `EMPTY_CART` | No items |
| `FR009` | `UNAUTHENTICATED` / `FORBIDDEN` / `IDEMPOTENCY_KEY_CONFLICT` | Auth/RBAC failure |
| `FR010` | `INVALID_ADJUSTMENT` | Bad direction or missing reason |
| `FR011` | `TRANSACTION_NOT_FOUND` | Void target missing |
| `FR012` | `INVALID_ITEM` / `DUPLICATE_ITEM` | Malformed item payload |
| `FR013` | `PRODUCT_NOT_FOUND` | Product id missing |
| `FR014` | `IMMUTABLE_CASHFLOW` | UPDATE/DELETE of `is_manual = false` row |
| `FR015` | `INVALID_IDEMPOTENCY_KEY` | Null/absent key |
| `FR016` | `INVALID_AMOUNT` | Negative discount/tax or null date |
| `FR017` | `CLIENT_NOT_FOUND` | Missing or soft-deleted client |

In `supabase-js`, `error.code` carries `FR00x` and `error.message` the stable
identifier (e.g. `INSUFFICIENT_STOCK`).

---

## RBAC matrix (assumed)

| Capability | ADMIN | CASHIER |
| --- | :---: | :---: |
| Sell (`create_transaction`) | ✅ | ✅ |
| Read own transactions | ✅ | ✅ |
| Read all transactions | ✅ | ❌ |
| Void | ✅ | ❌ |
| Products create/edit/archive | ✅ | ❌ |
| Read active products | ✅ | ✅ (safe view) |
| Read cost / profit | ✅ (admin view) | ❌ |
| Stock adjustment | ✅ | ❌ |
| Clients read/insert | ✅ | ✅ |
| Clients edit/delete | ✅ | ❌ |
| Manual cashflows | ✅ | ✅ (own) |
| Auto cashflows mutate | ❌ | ❌ |
| Settings | ✅ | ❌ |
| Manage users | only CASHIER rows | ❌ |

`current_role()` returns `NULL` for inactive users, so all active-user policies
fail closed after deactivation.

---

## Cashier cost-price protection

Postgres grants are per **database role**, not per application role, and
`authenticated` covers both admins and cashiers. To prevent a cashier from
reading margin data:

1. `authenticated` has **column-level** `SELECT` on `products` without
   `cost_price`, and on `transaction_items` without `unit_cost`/`profit`.
   `select cost_price ...` and even `select * ...` fail with `42501`.
2. Cashiers read products through `products_cashier`.
3. Admins read costs through `products_admin` / `transaction_items_admin`.
   These are `security_definer` views guarded by `current_role()`, so a cashier
   gets zero rows (never an error with data in it).

Trade-off: Supabase's linter reports `security_definer_view` for the two admin
views. That is deliberate — it is the only way to keep one API role while
showing cost to admins only. Do not replace them with direct base-table grants.

If the app later uses `select('*')` on `products` as an admin, point it at
`products_admin` instead.

---

## PRD assumptions resolved

The PRD is not present in this repository, so the following were inferred and
should be confirmed before production:

1. **Roles**: `ADMIN`, `CASHIER`. The first auth user ever becomes `ADMIN`;
   later signups default to `CASHIER`.
2. **Payment methods**: `CASH`, `TRANSFER`, `QRIS`, `CARD`, `EWALLET`.
3. **Void**: only `ADMIN`, and only once (`ALREADY_VOID`).
4. **Stock adjustment**: only `ADMIN`, reason always required.
   Cashiers cannot restock; they can only sell.
5. **Invoice**: `INV-YYYYMMDD-NNNN`, counter resets per `invoice_date`.
   Numbering uses the database timezone (`current_date`). Set the project
   timezone to `Asia/Jakarta` if business dates must follow WIB. Gaps are
   possible if a transaction aborts after taking a number.
6. **Rounding**: every monetary result is rounded half-up to 2 decimals.
   `line_total = round(unit_price * qty - discount, 2)`; header totals are the
   exact sum of those values (enforced by CHECK constraints).
7. **Tax**: `tax_amount` is supplied by the caller and stored; the DB does not
   compute tax rates. `settings.tax_percent` is informational.
8. **Payment**: `CASH` requires `amount_paid`; other methods default to the
   exact total when `amount_paid` is omitted. Overpayment is allowed for every
   method and `change_amount` is recorded.
9. **Prices**: the client may send `unit_price`; if it does, it must equal the
   current DB price (`PRICE_CHANGED` otherwise). Costs are always re-read from
   `products.cost_price` at sale time and snapshotted into the line.
10. **Idempotency**: a non-null key is required. Replaying returns the original
    transaction for the same user; a key owned by another user raises
    `IDEMPOTENCY_KEY_CONFLICT`. Lines are unique per product per transaction.
11. **Clients**: `client_id` is required; a walk-in client is seeded. Soft-deleted
    clients cannot be used for new sales.
12. **Archiving**: archived products cannot be sold or adjusted, but historical
    transaction lines remain intact (name/SKU/unit snapshots).
13. **Inventory**: stock is `NUMERIC(12,3)`, never negative (CHECK + locked
    checks). `stock_movements` is append-only from the app's perspective.
14. **Cashflows**: every sale creates an immutable `INCOME / SALE` row; a void
    creates an immutable `EXPENSE / VOID` row. Manual rows must be
    `is_manual = true`, unlinked to a transaction, and created by the caller.
15. **Soft delete**: `is_deleted` and `deleted_at` must agree; active-only unique
    indexes let SKU/barcode be reused after archiving.
16. **No hard deletes** of users, products, clients, transactions or cashflows
    from the app; use archive/void. FKs are `ON DELETE RESTRICT` where the
    financial trail must survive.
17. **User management**: no self-service role escalation. `ADMIN` can update
    `CASHIER` rows but cannot change its own role or create another `ADMIN`.
18. **System ledger rows**: `stock_movements.created_by` is nullable for seeded
    `INITIAL` rows; all RPC-generated rows use `auth.uid()`.
19. **Seed data**: the 10 hijab products and their prices are illustrative
    defaults; replace them with the real catalog before go-live.
20. **Concurrency test**: the automated pgTAP suite reproduces the last-unit
    race sequentially (second caller gets `FR001`). The actual protection is the
    `SELECT ... FOR UPDATE` in `create_transaction`; a two-session manual check
    is described in `tests/README.md`.

---

## Tests

```bash
npx supabase test db
```

pgTAP files:

- `01_sales_and_cost_leak.sql` — sale, replay, last unit, cash underpayment,
  discount > subtotal, cashier cost/profit leak.
- `02_void_and_cashflow.sql` — void, double void, RBAC, immutable auto
  cashflows, editable manual cashflows.
- `03_pricing_and_stock.sql` — stale price, archived product, adjustment rules.

`tests/README.md` documents the multi-session concurrency check.
