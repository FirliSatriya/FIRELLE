"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuCircleAlert, LuCircleCheck } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/errors";

type Mode = "login" | "signup";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("login");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Already signed in? Skip the form.
  React.useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active && data.session) router.replace("/products");
      })
      .catch(() => {
        /* ignore: show the form instead */
      });
    return () => {
      active = false;
    };
  }, [router]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(getAuthErrorMessage(signInError.message));
          return;
        }

        router.replace("/products");
        router.refresh();
        return;
      }

      if (!fullName.trim()) {
        setError("Nama lengkap wajib diisi.");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (signUpError) {
        setError(getAuthErrorMessage(signUpError.message));
        return;
      }

      if (data.session) {
        router.replace("/products");
        router.refresh();
        return;
      }

      setNotice(
        "Akun berhasil dibuat. Cek inbox email Anda untuk konfirmasi, lalu masuk kembali."
      );
      setMode("login");
    } catch (err) {
      setError(getAuthErrorMessage(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {mode === "signup" && (
        <div className="space-y-1.5">
          <label htmlFor="login-name" className="text-xs font-medium text-foreground">
            Nama lengkap
          </label>
          <Input
            id="login-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Nama Anda"
            className="bg-background"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            disabled={loading}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="login-email" className="text-xs font-medium text-foreground">
          Email
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@firelle.id"
          className="bg-background"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="login-password" className="text-xs font-medium text-foreground">
            Kata sandi
          </label>
          <button
            type="button"
            className="text-[11px] font-medium text-primary underline-offset-4 hover:underline"
            tabIndex={-1}
          >
            Lupa kata sandi?
          </button>
        </div>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="••••••••"
          className="bg-background"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
          disabled={loading}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <LuCircleAlert size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success-foreground"
        >
          <LuCircleCheck size={16} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <Button type="submit" className="w-full gap-2 font-semibold" disabled={loading}>
        {loading
          ? mode === "login"
            ? "Memproses..."
            : "Mendaftarkan..."
          : mode === "login"
          ? "Masuk"
          : "Daftar"}
        <LuArrowRight size={16} aria-hidden="true" />
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
        <button
          type="button"
          className="font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          disabled={loading}
        >
          {mode === "login" ? "Daftar akun" : "Masuk"}
        </button>
      </p>
    </form>
  );
}
