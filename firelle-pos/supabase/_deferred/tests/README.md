# SQL tests

Run the automated pgTAP suite with:

```bash
npx supabase test db
```

Files are executed in alphabetical order, each inside its own transaction and
rolled back. They create their own `auth.users` fixtures and impersonate users
via:

```sql
select set_config('request.jwt.claim.sub', '<user-uuid>', true);
set local role authenticated;
```

---

## True two-session concurrency check (last unit)

The pgTAP suite verifies the last-unit invariant sequentially. To observe the
row lock itself, use two `psql` sessions against a local database:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Prerequisites:

- Two users exist (sign up twice; the first is `ADMIN`, the second
  `CASHIER`).
- Use the seeded walk-in client:
  `c1c1c1c1-0001-4000-8000-000000000001`.
- Set a product to exactly one unit as the postgres role:

```sql
update public.products set stock = 1 where sku = 'HJ-001';
```

### Session A

```sql
select set_config('request.jwt.claim.sub', '<user-a-uuid>', false);
set role authenticated;

begin;
select public.create_transaction(
  'c1c1c1c1-0001-4000-8000-000000000001'::uuid,
  '[{"product_id":"a1b2c3d4-0001-4000-8000-000000000001","qty":1}]'::jsonb,
  'CASH'::public.payment_method, 75000,
  'aaaaaaaa-0001-4000-8000-000000000001'::uuid
);
-- stock is now 0 in this uncommitted transaction; do NOT commit yet
```

### Session B

```sql
select set_config('request.jwt.claim.sub', '<user-b-uuid>', false);
set role authenticated;

select public.create_transaction(
  'c1c1c1c1-0001-4000-8000-000000000001'::uuid,
  '[{"product_id":"a1b2c3d4-0001-4000-8000-000000000001","qty":1}]'::jsonb,
  'CASH'::public.payment_method, 75000,
  'bbbbbbbb-0002-4000-8000-000000000002'::uuid
);
-- blocks on the products row lock held by session A
```

Now commit Session A:

```sql
commit;
```

Session B unblocks, re-reads `stock = 0`, and raises:

```
ERROR: INSUFFICIENT_STOCK
SQLSTATE: FR001
DETAIL: Pashmina Ceruty: available=0 requested=1
```

Finally reset the stock:

```sql
update public.products set stock = 24 where sku = 'HJ-001';
```
