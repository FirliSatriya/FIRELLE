/**
 * Seed data for Demo Mode.
 *
 * Nilai di bawah ini adalah pengganti data seed demo lama (dulu di SQL), tetapi
 * seluruhnya hidup di memori browser — tidak pernah ditulis ke Supabase atau
 * database mana pun. Muat ulang halaman = kembali ke kondisi awal.
 *
 * Modul ini murni data + fungsi pembentuk state; tidak menyimpan singleton.
 */
import type { Database } from "@/types/database.types";
import type { Cashflow } from "@/types/finance";
import type { Client } from "@/types/client";
import type { Product, ProductImage, StockMovement } from "@/types/product";
import type { Transaction, TransactionItem } from "@/types/transaction";
import { round2 } from "@/types/transaction";
import { DEMO_ACCOUNT } from "./account";

export type AppRole = "ADMIN" | "CASHIER";

export type StoreSettingsRow = Database["public"]["Tables"]["settings"]["Row"];

/** Akun yang bisa dipakai untuk masuk mode demo. */
export interface DemoUser {
  id: string;
  email: string;
  /** Hanya ada di memori demo — tidak pernah dikirim ke server. */
  password: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
}

/** Transaksi demo + kolom internal yang dibutuhkan laporan laba. */
export interface DemoTransactionRecord extends Transaction {
  total_cost: number;
  total_profit: number;
  items: TransactionItem[];
}

export interface DemoState {
  users: DemoUser[];
  products: Product[];
  /** Galeri produk (object URL di memori), terpisah dari `Product.images`. */
  images: ProductImage[];
  clients: Client[];
  transactions: DemoTransactionRecord[];
  cashflows: Cashflow[];
  stockMovements: StockMovement[];
  settings: StoreSettingsRow;
  /** key idempotensi checkout → id transaksi (replay aman). */
  idempotency: Map<string, string>;
}

// ============================================================
// Akun & pengaturan
// ============================================================

export const DEMO_ADMIN_ID = "e0e0e0e0-0000-4000-8000-000000000001";

export { DEMO_ACCOUNT };

export function buildDemoUsers(now: Date): DemoUser[] {
  return [
    {
      id: DEMO_ADMIN_ID,
      email: DEMO_ACCOUNT.email,
      password: DEMO_ACCOUNT.password,
      fullName: DEMO_ACCOUNT.fullName,
      role: DEMO_ACCOUNT.role,
      isActive: true,
      createdAt: wibInstant(now, 30, 8).toISOString(),
    },
  ];
}

export function buildDemoSettings(now: Date): StoreSettingsRow {
  const createdAt = wibInstant(now, 30, 8).toISOString();
  return {
    singleton: true,
    store_name: "Firelle Demo Store",
    store_address: "Jl. Braga No. 88, Bandung",
    store_phone: "0812-2000-0000",
    receipt_footer: "Terima kasih sudah berbelanja di Firelle Demo Store.",
    allow_negative_stock: false,
    low_stock_default: 5,
    receipt_paper: "58mm",
    created_at: createdAt,
    updated_at: createdAt,
  };
}

// ============================================================
// Produk & pelanggan
// ============================================================

const PRODUCT_SEEDS: Array<{
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
}> = [
  { sku: "DM-001", barcode: "8991000000011", name: "Pashmina Ceruty Premium", unit: "Pcs", cost: 45000, price: 75000, stock: 40, minStock: 5 },
  { sku: "DM-002", barcode: "8991000000028", name: "Bella Square Motif", unit: "Pcs", cost: 25000, price: 45000, stock: 60, minStock: 8 },
  { sku: "DM-003", barcode: "8991000000035", name: "Paris Premium", unit: "Pcs", cost: 60000, price: 95000, stock: 30, minStock: 5 },
  { sku: "DM-004", barcode: "8991000000042", name: "Instan Jersey", unit: "Pcs", cost: 35000, price: 60000, stock: 36, minStock: 6 },
  { sku: "DM-005", barcode: "8991000000059", name: "Inner Ninja", unit: "Pcs", cost: 15000, price: 25000, stock: 60, minStock: 10 },
  { sku: "DM-006", barcode: "8991000000066", name: "Bergo Sport", unit: "Pcs", cost: 40000, price: 70000, stock: 24, minStock: 4 },
  { sku: "DM-007", barcode: "8991000000073", name: "Segi Empat Voal", unit: "Pcs", cost: 30000, price: 55000, stock: 30, minStock: 5 },
  { sku: "DM-008", barcode: "8991000000080", name: "Khimar Syari", unit: "Pcs", cost: 85000, price: 135000, stock: 15, minStock: 3 },
  { sku: "DM-009", barcode: "8991000000097", name: "Mukena Dewasa", unit: "Pcs", cost: 120000, price: 185000, stock: 6, minStock: 3 },
  { sku: "DM-010", barcode: "8991000000103", name: "Peniti Hijab", unit: "Pcs", cost: 5000, price: 10000, stock: 100, minStock: 20 },
];

const CLIENT_SEEDS = [
  { name: "Nur Aisyah", phone: "081210000001", address: "Jl. Melati No. 12, Bandung" },
  { name: "Siti Rahmawati", phone: "081210000002", address: "Jl. Kenanga No. 8, Bandung" },
  { name: "Dewi Lestari", phone: "081210000003", address: "Komplek Griya Asri Blok C3, Bandung" },
  { name: "Rina Kartika", phone: "081210000004", address: "Jl. Cihampelas No. 45, Bandung" },
  { name: "Fitri Handayani", phone: "081210000005", address: "Jl. Sukajadi No. 21, Bandung" },
  { name: "Maya Sari", phone: "081210000006", address: "Jl. Dipatiukur No. 77, Bandung" },
  { name: "Intan Permata", phone: "081210000007", address: "Jl. Buah Batu No. 15, Bandung" },
  { name: "Ayu Wulandari", phone: "081210000008", address: "Jl. Antapani Lama No. 3, Bandung" },
  { name: "Laila Nuraini", phone: "081210000009", address: "Jl. Kiaracondong No. 90, Bandung" },
  { name: "Zahra Amelia", phone: "081210000010", address: "Jl. Setiabudi No. 210, Bandung" },
];

export function buildDemoProducts(now: Date): Product[] {
  const createdAt = wibInstant(now, 30, 8).toISOString();
  return PRODUCT_SEEDS.map((seed, index) => ({
    id: `d0d0d0d0-${String(index + 1).padStart(4, "0")}-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`,
    sku: seed.sku,
    barcode: seed.barcode,
    name: seed.name,
    unit: seed.unit,
    cost_price: seed.cost,
    selling_price: seed.price,
    stock: seed.stock,
    min_stock: seed.minStock,
    is_deleted: false,
    deleted_at: null,
    created_at: createdAt,
    updated_at: createdAt,
    images: [],
  }));
}

export function buildDemoClients(now: Date): Client[] {
  const createdAt = wibInstant(now, 20, 8).toISOString();
  return CLIENT_SEEDS.map((seed, index) => ({
    id: `demo-client-${String(index + 1).padStart(2, "0")}`,
    name: seed.name,
    phone: seed.phone,
    address: seed.address,
    is_walk_in: false,
    is_active: true,
    created_at: createdAt,
    updated_at: createdAt,
  }));
}

// ============================================================
// Penjualan demo
// ============================================================

interface SaleSpec {
  /** Urutan kronologis (1 = paling lama). */
  seq: number;
  daysAgo: number;
  /** 1-based index ke CLIENT_SEEDS. */
  clientNo: number;
  payment: "CASH" | "QRIS" | "TRANSFER";
  discount: number;
  isVoid: boolean;
  /** p = 1-based index ke PRODUCT_SEEDS, q = qty. */
  items: Array<{ p: number; q: number }>;
}

const SALE_SPECS: SaleSpec[] = [
  { seq: 1, daysAgo: 9, clientNo: 1, payment: "CASH", discount: 0, isVoid: false, items: [{ p: 1, q: 2 }, { p: 5, q: 3 }] },
  { seq: 2, daysAgo: 8, clientNo: 2, payment: "QRIS", discount: 0, isVoid: false, items: [{ p: 2, q: 4 }] },
  { seq: 3, daysAgo: 8, clientNo: 3, payment: "TRANSFER", discount: 0, isVoid: false, items: [{ p: 3, q: 1 }, { p: 10, q: 2 }] },
  { seq: 4, daysAgo: 7, clientNo: 4, payment: "CASH", discount: 0, isVoid: false, items: [{ p: 1, q: 1 }, { p: 2, q: 2 }] },
  { seq: 5, daysAgo: 5, clientNo: 5, payment: "QRIS", discount: 10000, isVoid: false, items: [{ p: 4, q: 3 }, { p: 5, q: 5 }] },
  { seq: 6, daysAgo: 4, clientNo: 6, payment: "CASH", discount: 0, isVoid: false, items: [{ p: 7, q: 2 }, { p: 10, q: 4 }] },
  { seq: 7, daysAgo: 3, clientNo: 7, payment: "TRANSFER", discount: 0, isVoid: true, items: [{ p: 8, q: 1 }] },
  { seq: 8, daysAgo: 2, clientNo: 8, payment: "CASH", discount: 0, isVoid: false, items: [{ p: 6, q: 2 }, { p: 4, q: 1 }] },
  { seq: 9, daysAgo: 1, clientNo: 9, payment: "QRIS", discount: 0, isVoid: false, items: [{ p: 9, q: 2 }, { p: 5, q: 4 }] },
  { seq: 10, daysAgo: 0, clientNo: 10, payment: "CASH", discount: 25000, isVoid: false, items: [{ p: 1, q: 3 }, { p: 3, q: 1 }, { p: 9, q: 2 }] },
];

const MANUAL_CASHFLOWS: Array<{
  daysAgo: number;
  type: "IN" | "OUT";
  category: string;
  amount: number;
  description: string;
}> = [
  { daysAgo: 9, type: "OUT", category: "Stock Purchase", amount: 350000, description: "Restock pashmina 10 pcs" },
  { daysAgo: 8, type: "OUT", category: "Operational Expense", amount: 120000, description: "Listrik & internet toko" },
  { daysAgo: 7, type: "IN", category: "Other Income", amount: 500000, description: "Tambahan modal pemilik" },
  { daysAgo: 6, type: "OUT", category: "Operational Expense", amount: 75000, description: "Bensin & parkir kurir" },
  { daysAgo: 5, type: "OUT", category: "Operational Expense", amount: 250000, description: "Iklan Instagram 5 hari" },
  { daysAgo: 4, type: "OUT", category: "Operational Expense", amount: 45000, description: "Air minum & snack staff" },
  { daysAgo: 3, type: "IN", category: "Other Income", amount: 200000, description: "Penjualan aksesoris (non-POS)" },
  { daysAgo: 2, type: "OUT", category: "Salary", amount: 150000, description: "Gaji harian staff" },
  { daysAgo: 1, type: "OUT", category: "Operational Expense", amount: 60000, description: "Plastik & kemasan" },
  { daysAgo: 0, type: "OUT", category: "Rent", amount: 90000, description: "Servis printer struk" },
];

export function buildDemoState(now: Date = new Date()): DemoState {
  const users = buildDemoUsers(now);
  const products = buildDemoProducts(now);
  const clients = buildDemoClients(now);
  const settings = buildDemoSettings(now);
  const transactions: DemoTransactionRecord[] = [];
  const cashflows: Cashflow[] = [];
  const stockMovements: StockMovement[] = [];
  const invoiceCounters = new Map<string, number>();

  // Ledger awal untuk setiap produk.
  const initialAt = wibInstant(now, 30, 8).toISOString();
  for (const product of products) {
    stockMovements.push({
      id: `demo-sm-initial-${product.sku}`,
      product_id: product.id,
      type: "INITIAL",
      qty_change: product.stock,
      stock_after: product.stock,
      reason: null,
      note: "Demo seed: stok awal",
      transaction_id: null,
      created_by: DEMO_ADMIN_ID,
      created_by_name: DEMO_ACCOUNT.fullName,
      created_at: initialAt,
    });
  }

  const stockById = new Map(products.map((product) => [product.id, product.stock]));

  const ordered = [...SALE_SPECS].sort(
    (a, b) => b.daysAgo - a.daysAgo || a.seq - b.seq
  );

  for (const spec of ordered) {
    const createdAt = wibInstant(now, spec.daysAgo, 9, 30 + spec.seq * 35);
    const createdAtIso = createdAt.toISOString();
    const client = clients[spec.clientNo - 1];
    const invoiceNumber = nextInvoice(invoiceCounters, createdAt);
    const transactionId = `demo-tx-${String(spec.seq).padStart(3, "0")}`;

    let subtotal = 0;
    let totalCost = 0;
    const items: TransactionItem[] = [];

    for (let i = 0; i < spec.items.length; i++) {
      const { p, q } = spec.items[i];
      const product = products[p - 1];
      const lineSubtotal = round2(product.selling_price * q);
      subtotal += lineSubtotal;
      totalCost += round2(product.cost_price * q);
      items.push({
        id: `demo-ti-${spec.seq}-${i + 1}`,
        transaction_id: transactionId,
        product_id: product.id,
        product_name: product.name,
        unit: product.unit,
        qty: q,
        selling_price: product.selling_price,
        subtotal: lineSubtotal,
      });
    }

    subtotal = round2(subtotal);
    totalCost = round2(totalCost);
    const discount = round2(spec.discount);
    const total = round2(subtotal - discount);
    const paid =
      spec.payment === "CASH" ? Math.ceil(total / 10000) * 10000 : total;
    const change = round2(paid - total);

    const transaction: DemoTransactionRecord = {
      id: transactionId,
      invoice_number: invoiceNumber,
      client_id: client.id,
      client_name: client.name,
      subtotal_amount: subtotal,
      discount_amount: discount,
      total_amount: total,
      payment_method: spec.payment,
      amount_paid: paid,
      change_amount: change,
      status: "COMPLETED",
      notes: "Demo seed",
      void_reason: null,
      voided_at: null,
      created_by: DEMO_ADMIN_ID,
      cashier_name: DEMO_ACCOUNT.fullName,
      created_at: createdAtIso,
      total_cost: totalCost,
      total_profit: round2(total - totalCost),
      items,
    };

    // Stok keluar + ledger SALE.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const product = products[spec.items[i].p - 1];
      const stockAfter = round2((stockById.get(product.id) ?? 0) - item.qty);
      stockById.set(product.id, stockAfter);
      stockMovements.push({
        id: `demo-sm-${spec.seq}-${i + 1}`,
        product_id: product.id,
        type: "SALE",
        qty_change: -item.qty,
        stock_after: stockAfter,
        reason: null,
        note: null,
        transaction_id: transactionId,
        created_by: DEMO_ADMIN_ID,
        created_by_name: DEMO_ACCOUNT.fullName,
        created_at: createdAtIso,
      });
    }

    if (total > 0) {
      cashflows.push({
        id: `demo-cf-sale-${spec.seq}`,
        type: "IN",
        amount: total,
        category: "SALE",
        description: `Invoice ${invoiceNumber}`,
        is_manual: false,
        transaction_id: transactionId,
        occurred_at: createdAtIso,
        created_by: DEMO_ADMIN_ID,
        created_at: createdAtIso,
        updated_at: createdAtIso,
      });
    }

    if (spec.isVoid) {
      const voidedAt = wibInstant(now, spec.daysAgo, 9, 30 + spec.seq * 35 + 45);
      const voidedAtIso = voidedAt.toISOString();
      transaction.status = "VOID";
      transaction.void_reason = "Salah input metode pembayaran";
      transaction.voided_at = voidedAtIso;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const product = products[spec.items[i].p - 1];
        const stockAfter = round2((stockById.get(product.id) ?? 0) + item.qty);
        stockById.set(product.id, stockAfter);
        stockMovements.push({
          id: `demo-sm-${spec.seq}-void-${i + 1}`,
          product_id: product.id,
          type: "VOID_RETURN",
          qty_change: item.qty,
          stock_after: stockAfter,
          reason: null,
          note: `Void ${invoiceNumber}`,
          transaction_id: transactionId,
          created_by: DEMO_ADMIN_ID,
          created_by_name: DEMO_ACCOUNT.fullName,
          created_at: voidedAtIso,
        });
      }

      if (total > 0) {
        cashflows.push({
          id: `demo-cf-void-${spec.seq}`,
          type: "OUT",
          amount: total,
          category: "VOID",
          description: `Void ${invoiceNumber}`,
          is_manual: false,
          transaction_id: transactionId,
          occurred_at: voidedAtIso,
          created_by: DEMO_ADMIN_ID,
          created_at: voidedAtIso,
          updated_at: voidedAtIso,
        });
      }
    }

    transactions.push(transaction);
  }

  // Terapkan stok akhir ke objek produk.
  for (const product of products) {
    product.stock = stockById.get(product.id) ?? product.stock;
  }

  // Cashflow manual (kategori Inggris agar cocok dengan Net Profit report).
  MANUAL_CASHFLOWS.forEach((spec, index) => {
    const occurredAt = wibInstant(now, spec.daysAgo, 17, 0).toISOString();
    cashflows.push({
      id: `demo-cf-manual-${String(index + 1).padStart(2, "0")}`,
      type: spec.type,
      amount: spec.amount,
      category: spec.category,
      description: spec.description,
      is_manual: true,
      transaction_id: null,
      occurred_at: occurredAt,
      created_by: DEMO_ADMIN_ID,
      created_at: occurredAt,
      updated_at: occurredAt,
    });
  });

  return {
    users,
    products,
    images: [],
    clients,
    transactions,
    cashflows,
    stockMovements,
    settings,
    idempotency: new Map(),
  };
}

// ============================================================
// Util tanggal (WIB = UTC+7, tanpa DST)
// ============================================================

/** Instan UTC untuk jam WIB tertentu, `daysAgo` hari sebelum `now`. */
export function wibInstant(
  now: Date,
  daysAgo: number,
  hour: number,
  minute = 0
): Date {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() - daysAgo,
      hour - 7,
      minute,
      0,
      0
    )
  );
}

/** `YYYYMMDD` untuk tanggal bisnis WIB. */
export function wibDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Nomor invoice `INV-YYYYMMDD-NNN` dengan counter harian. */
export function nextInvoice(
  counters: Map<string, number>,
  date: Date = new Date()
): string {
  const key = wibDateKey(date);
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return `INV-${key}-${String(next).padStart(3, "0")}`;
}
