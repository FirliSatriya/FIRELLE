-- ============================================================================
-- Seed: Firelle defaults + 10 hijab products
-- Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING / NOT EXISTS guards.
-- Runs as the migration role, so RLS is bypassed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Walk-in client (create_transaction falls back to this row when client_id
-- is null). The row is protected from UPDATE/DELETE by the
-- clients_prevent_walk_in_mutation trigger (FR024).
-- ----------------------------------------------------------------------------
insert into public.clients (id, name, phone, is_walk_in, is_active)
values (
  'c1c1c1c1-0001-4000-8000-000000000001',
  'Pelanggan Umum',
  null,
  true,
  true
)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Default settings (singleton row)
-- ----------------------------------------------------------------------------
insert into public.settings (
  singleton, store_name, store_address, store_phone, receipt_footer,
  allow_negative_stock, low_stock_default, receipt_paper
)
values (
  true,
  'Firelle',
  null,
  null,
  'Terima kasih telah berbelanja di Firelle.',
  false,
  5,
  '58mm'
)
on conflict (singleton) do nothing;

-- ----------------------------------------------------------------------------
-- 10 hijab products
-- ----------------------------------------------------------------------------
insert into public.products (
  id, sku, barcode, name, unit, cost_price, selling_price, stock, min_stock
)
values
  ('a1b2c3d4-0001-4000-8000-000000000001', 'HJ-001', '8990000000011',
   'Pashmina Ceruty',        'Pcs',  45000.00,  75000.00,  24.000,  5.000),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'HJ-002', '8990000000028',
   'Bella Square',           'Pcs',  25000.00,  45000.00,  40.000,  8.000),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'HJ-003', '8990000000035',
   'Paris Premium',          'Pcs',  60000.00,  95000.00,  18.000,  5.000),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'HJ-004', '8990000000042',
   'Instan Jersey',          'Pcs',  35000.00,  60000.00,  30.000,  6.000),
  ('a1b2c3d4-0005-4000-8000-000000000005', 'HJ-005', '8990000000059',
   'Inner Ninja',            'Pcs',  15000.00,  25000.00,  50.000, 10.000),
  ('a1b2c3d4-0006-4000-8000-000000000006', 'HJ-006', '8990000000066',
   'Bergo',                  'Pcs',  40000.00,  70000.00,  12.000,  4.000),
  ('a1b2c3d4-0007-4000-8000-000000000007', 'HJ-007', '8990000000073',
   'Segi Empat Voal',        'Pcs',  30000.00,  55000.00,  22.000,  5.000),
  ('a1b2c3d4-0008-4000-8000-000000000008', 'HJ-008', '8990000000080',
   'Khimar Syari',           'Pcs',  85000.00, 135000.00,  10.000,  3.000),
  ('a1b2c3d4-0009-4000-8000-000000000009', 'HJ-009', '8990000000097',
   'Mukena',                 'Pcs', 120000.00, 185000.00,   8.000,  3.000),
  ('a1b2c3d4-0010-4000-8000-000000000010', 'HJ-010', '8990000000103',
   'Peniti / Aksesoris',     'Pcs',   5000.00,  10000.00, 100.000, 20.000)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Audit trail for the seeded opening stock (system rows: created_by = null)
-- ----------------------------------------------------------------------------
insert into public.stock_movements (
  id, product_id, type, qty_change, stock_after, note
)
select
  v.id,
  p.id,
  'INITIAL'::public.stock_movement_type,
  p.stock,
  p.stock,
  'Seed initial stock'
from (values
  ('d1d1d1d1-0001-4000-8000-000000000001'::uuid,
   'a1b2c3d4-0001-4000-8000-000000000001'::uuid),
  ('d1d1d1d1-0002-4000-8000-000000000002'::uuid,
   'a1b2c3d4-0002-4000-8000-000000000002'::uuid),
  ('d1d1d1d1-0003-4000-8000-000000000003'::uuid,
   'a1b2c3d4-0003-4000-8000-000000000003'::uuid),
  ('d1d1d1d1-0004-4000-8000-000000000004'::uuid,
   'a1b2c3d4-0004-4000-8000-000000000004'::uuid),
  ('d1d1d1d1-0005-4000-8000-000000000005'::uuid,
   'a1b2c3d4-0005-4000-8000-000000000005'::uuid),
  ('d1d1d1d1-0006-4000-8000-000000000006'::uuid,
   'a1b2c3d4-0006-4000-8000-000000000006'::uuid),
  ('d1d1d1d1-0007-4000-8000-000000000007'::uuid,
   'a1b2c3d4-0007-4000-8000-000000000007'::uuid),
  ('d1d1d1d1-0008-4000-8000-000000000008'::uuid,
   'a1b2c3d4-0008-4000-8000-000000000008'::uuid),
  ('d1d1d1d1-0009-4000-8000-000000000009'::uuid,
   'a1b2c3d4-0009-4000-8000-000000000009'::uuid),
  ('d1d1d1d1-0010-4000-8000-000000000010'::uuid,
   'a1b2c3d4-0010-4000-8000-000000000010'::uuid)
) as v(id, product_id)
join public.products p on p.id = v.product_id
where p.stock > 0
  and not exists (
    select 1
    from public.stock_movements sm
    where sm.product_id = p.id
  )
on conflict do nothing;
