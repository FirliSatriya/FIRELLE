"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  LuArrowRight,
  LuCircleAlert,
  LuCircleCheck,
  LuEye,
  LuEyeOff,
  LuLoaderCircle,
  LuLock,
  LuMail,
  LuUser,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/errors";
import { getCurrentProfile } from "@/lib/supabase/products";
import { landingFor } from "@/lib/session";
import { authFormSchema, type AuthFormValues, type AuthMode } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

type Mode = AuthMode;

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("login");
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    clearErrors,
    resetField,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: { mode: "login", fullName: "", email: "", password: "" },
    mode: "onTouched",
  });

  // Already signed in? Skip the form and land on the right page for the role.
  React.useEffect(() => {
    let active = true;
    const supabase = createClient();

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active || !session) return;

        const profile = await getCurrentProfile(session.user.id);
        if (!active) return;

        // Only a valid, active account skips the login form. A dangling session
        // (e.g. the profile row was removed) stays here so it can be replaced.
        if (profile?.isActive) {
          router.replace(landingFor(profile.role));
          return;
        }

        await supabase.auth.signOut();
      } catch {
        /* ignore: show the form instead */
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  const applyMode = (next: Mode) => {
    setMode(next);
    // Keep the resolver in sync with the visible tab (sign-up-only rules).
    setValue("mode", next);
  };

  const switchMode = (next: Mode) => {
    if (next === mode || isSubmitting) return;
    applyMode(next);
    setFormError(null);
    setNotice(null);
    setShowPassword(false);
    clearErrors();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setNotice(null);

    try {
      const supabase = createClient();
      const email = values.email.trim();
      const password = values.password;

      if (values.mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setFormError(getAuthErrorMessage(error.message));
          return;
        }

        if (!data.session) {
          setFormError("Sesi tidak dapat dibuat. Coba masuk kembali.");
          return;
        }

        const profile = await getCurrentProfile(data.session.user.id);

        // No profile row / deactivated account: don't carry the session into the
        // app, and let them know to contact the store admin instead of looping.
        if (!profile || !profile.isActive) {
          await supabase.auth.signOut();
          setFormError(
            "Akun ini belum aktif atau belum terdaftar sebagai staf toko. Hubungi admin toko."
          );
          return;
        }

        router.replace(landingFor(profile.role));
        router.refresh();
        return;
      }

      const fullName = values.fullName.trim();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) {
        setFormError(getAuthErrorMessage(error.message));
        return;
      }

      if (data.session) {
        const profile = await getCurrentProfile(data.session.user.id);

        if (!profile || !profile.isActive) {
          await supabase.auth.signOut();
          setNotice(
            "Akun berhasil dibuat. Tunggu aktivasi dari admin toko sebelum masuk."
          );
          applyMode("login");
          setShowPassword(false);
          resetField("password", { defaultValue: "" });
          clearErrors();
          return;
        }

        router.replace(landingFor(profile.role));
        router.refresh();
        return;
      }

      setNotice(
        "Akun berhasil dibuat. Cek inbox email Anda untuk konfirmasi, lalu masuk kembali."
      );
      applyMode("login");
      setShowPassword(false);
      resetField("password", { defaultValue: "" });
      clearErrors();
    } catch (err) {
      setFormError(
        getAuthErrorMessage(err instanceof Error ? err.message : String(err))
      );
    }
  });

  const isLogin = mode === "login";
  const busy = isSubmitting;

  return (
    <div className="space-y-6">
      {/* Mode switch */}
      <div
        role="group"
        aria-label="Pilih mode masuk atau daftar"
        className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1"
      >
        {(["login", "signup"] as const).map((value) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => switchMode(value)}
              disabled={busy}
              className={cn(
                "h-9 rounded-md text-xs font-semibold transition-colors disabled:opacity-60",
                active
                  ? "bg-card text-foreground shadow-warm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {value === "login" ? "Masuk" : "Daftar akun"}
            </button>
          );
        })}
      </div>

      <header className="space-y-1.5 text-center">
        <h1 className="font-heading text-3xl font-semibold text-foreground">
          {isLogin ? "Selamat datang kembali" : "Buat akun baru"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isLogin
            ? "Masuk untuk melanjutkan pengelolaan butik Anda."
            : "Daftarkan akun staf untuk mulai mengelola toko."}
        </p>
      </header>

      <form noValidate className="space-y-4" onSubmit={onSubmit}>
        {!isLogin && (
          <div className="space-y-1.5">
            <label
              htmlFor="login-name"
              className="text-xs font-medium text-foreground"
            >
              Nama lengkap
            </label>
            <div className="relative">
              <LuUser
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="login-name"
                type="text"
                autoComplete="name"
                placeholder="Nama Anda"
                className={cn(
                  "bg-background pl-9",
                  errors.fullName &&
                    "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25"
                )}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={
                  errors.fullName ? "login-name-error" : undefined
                }
                disabled={busy}
                {...register("fullName")}
              />
            </div>
            {errors.fullName && (
              <p
                id="login-name-error"
                role="alert"
                className="flex items-center gap-1.5 text-xs text-destructive"
              >
                <LuCircleAlert size={13} aria-hidden="true" />
                {errors.fullName.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="text-xs font-medium text-foreground"
          >
            Email
          </label>
          <div className="relative">
            <LuMail
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nama@firelle.id"
              className={cn(
                "bg-background pl-9",
                errors.email &&
                  "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25"
              )}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              disabled={busy}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p
              id="login-email-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs text-destructive"
            >
              <LuCircleAlert size={13} aria-hidden="true" />
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="text-xs font-medium text-foreground"
          >
            Kata sandi
          </label>
          <div className="relative">
            <LuLock
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="••••••••"
              className={cn(
                "bg-background pl-9 pr-11",
                errors.password &&
                  "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25"
              )}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password
                  ? "login-password-error"
                  : !isLogin
                  ? "login-password-hint"
                  : undefined
              }
              disabled={busy}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={
                showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
              }
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? (
                <LuEyeOff size={16} aria-hidden="true" />
              ) : (
                <LuEye size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password ? (
            <p
              id="login-password-error"
              role="alert"
              className="flex items-center gap-1.5 text-xs text-destructive"
            >
              <LuCircleAlert size={13} aria-hidden="true" />
              {errors.password.message}
            </p>
          ) : (
            !isLogin && (
              <p
                id="login-password-hint"
                className="text-[11px] text-muted-foreground"
              >
                Gunakan minimal 6 karakter.
              </p>
            )
          )}
        </div>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <LuCircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success-foreground"
          >
            <LuCircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full gap-2 font-semibold"
          disabled={busy}
        >
          {busy ? (
            <>
              <LuLoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              {isLogin ? "Memproses..." : "Mendaftarkan..."}
            </>
          ) : (
            <>
              {isLogin ? "Masuk" : "Daftar"}
              <LuArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
