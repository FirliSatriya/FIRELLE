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

    switch (err.code) {
      case "42501":
        return "Akses ditolak. Hanya akun dengan peran ADMIN yang dapat mengubah produk.";
      case "23505":
        return "SKU sudah dipakai produk aktif lain. Gunakan SKU yang berbeda.";
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
