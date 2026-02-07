import Link from "next/link";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/app" className="text-sm font-semibold tracking-wide text-teal">
            VISOBOT
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/app" className="hover:text-slate-900">
              Workspace
            </Link>
            <Link href="/settings" className="hover:text-slate-900">
              Settings
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
