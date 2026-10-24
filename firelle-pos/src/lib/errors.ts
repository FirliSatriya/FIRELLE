/** Turn Supabase/PostgREST/auth errors into a message we can show in the UI. */
export function getErrorMessage(error: unknown): string {
  if (!error) return "Terjadi kesalahan. Coba lagi.";

  if (typeof error === "object") {
    const err = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };

    // ─── POS / transaction RPC contract (FRxxx) ───
    if (err.code && err.code.startsWith("FR")) {
      return getTransactionErrorMessage(err.code, err.details);
    }

    switch (err.code) {
      case "FR024":
        return "Pelanggan Umum (walk-in) tidak dapat diubah atau dihapus.";
      default:
        break;
    }

    switch (err.code) {
      case "42501":
        return "Akses ditolak. Hanya akun dengan peran ADMIN yang dapat mengubah data ini.";
      case "23505":
        return "Data ini sudah dipakai. Gunakan nilai yang berbeda.";
      case "23514":
        return err.message || "Data produk tidak memenuhi aturan validasi.";
      case "FR022":
        return "Aksi diblokir: sistem harus selalu memiliki minimal satu admin aktif.";
      default:
        break;
    }

    if (err.message) return err.message;
  }

  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan. Coba lagi.";
}

/** Stable FRxxx codes from create_transaction / void_transaction. */
export function getTransactionErrorMessage(
  code: string,
  details?: string
): string {
  const detail = details ? ` (${details})` : "";

  switch (code) {
    case "FR001":
      return `Stok tidak mencukupi untuk jumlah yang diminta.${detail}`;
    case "FR002":
      return `Produk sudah diarsipkan dan tidak dapat dijual.${detail}`;
    case "FR003":
      return "Harga produk berubah. Daftar produk dimuat ulang — periksa kembali keranjang.";
    case "FR004":
      return "Diskon melebihi subtotal. Kurangi diskon lalu coba lagi.";
    case "FR005":
      return "Uang yang dibayarkan kurang dari total. Tambahkan nominal pembayaran.";
    case "FR006":
      return "Transaksi ini sudah dibatalkan sebelumnya.";
    case "FR007":
      return "Jumlah (qty) harus lebih dari 0.";
    case "FR008":
      return "Keranjang masih kosong. Tambahkan minimal satu produk.";
    case "FR009":
      return "Sesi berakhir atau akses ditolak. Masuk kembali.";
    case "FR010":
      return "Alasan penyesuaian wajib diisi.";
    case "FR011":
      return "Transaksi tidak ditemukan. Mungkin sudah dihapus.";
    case "FR012":
      return `Item keranjang tidak valid (duplikat atau rusak).${detail}`;
    case "FR013":
      return "Produk tidak ditemukan. Muat ulang daftar produk.";
    case "FR015":
      return "Kunci transaksi tidak valid. Ulangi pembayaran.";
    case "FR016":
      return "Nominal tidak valid. Periksa diskon dan pembayaran.";
    case "FR017":
      return "Pelanggan tidak ditemukan atau tidak aktif.";
    case "FR018":
      return "Alasan pembatalan wajib diisi.";
    case "FR019":
    case "FR021":
      return "Metode pembayaran tidak cocok dengan nominal yang dibayar.";
    case "FR022":
      return "Aksi diblokir: sistem harus selalu memiliki minimal satu admin aktif.";
    case "FR024":
      return "Pelanggan Umum (walk-in) tidak dapat diubah atau dihapus.";
    default:
      return detail
        ? `Transaksi gagal (${code}).${detail}`
        : `Transaksi gagal (${code}). Coba lagi.`;
  }
}

/** Auth errors use plain English messages; translate the common ones. */
export function getAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email atau kata sandi salah.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Email belum dikonfirmasi. Buka tautan konfirmasi di inbox Anda, lalu masuk kembali.";
  }
  if (normalized.includes("user already registered")) {
    return "Email ini sudah terdaftar. Silakan masuk.";
  }
  if (normalized.includes("password should be at least")) {
    return "Kata sandi minimal 6 karakter.";
  }
  if (normalized.includes("signups not allowed")) {
    return "Pendaftaran akun baru sedang dinonaktifkan.";
  }
  if (normalized.includes("rate limit")) {
    return "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.";
  }

  return message;
}
