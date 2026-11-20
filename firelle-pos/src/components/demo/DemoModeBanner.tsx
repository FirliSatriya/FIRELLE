/**
 * Penanda mode demo.
 *
 * Hanya dirender oleh `RootLayout` saat `APP_MODE=demo`, jadi build production
 * tidak pernah menampilkan elemen ini. Sengaja `pointer-events-none` supaya
 * tidak pernah menghalangi tombol yang berada di dekatnya.
 */
export function DemoModeBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-warning/40 bg-warning/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning-foreground shadow-warm-md backdrop-blur-sm"
    >
      <span className="relative flex size-1.5" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-warning" />
      </span>
      Mode Demo
      <span className="hidden font-normal normal-case tracking-normal text-muted-foreground sm:inline">
        data uji coba
      </span>
    </div>
  );
}
