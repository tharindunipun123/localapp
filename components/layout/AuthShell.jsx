export function AuthShell({ children }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden min-h-[420px] lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-login.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink)]/85 via-[var(--color-ink)]/40 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Local App Sri Lanka
          </p>
          <p className="mt-3 max-w-md text-3xl font-semibold tracking-tight">
            One ink. One ledger. One institution.
          </p>
        </div>
      </div>
      <div className="flex items-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
