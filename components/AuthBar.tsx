"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

async function fetchMe(): Promise<{ user: { id: string; username: string } | null }> {
  const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
  if (!res.ok) return { user: null };
  return res.json();
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="size-5 text-stone-200"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </>
      )}
    </svg>
  );
}

export function AuthBar() {
  const menuId = useId();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const qc = useQueryClient();
  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, staleTime: 60_000 });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auth", "me"] });
      void qc.removeQueries({ queryKey: ["profile"] });
      setMenuOpen(false);
    },
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => setMenuOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const closeIfDesktop = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", closeIfDesktop);
    closeIfDesktop();
    return () => mq.removeEventListener("change", closeIfDesktop);
  }, []);

  const user = meQuery.data?.user ?? null;

  return (
    <>
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] md:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <header className="relative z-50 shrink-0 border-b border-white/10 bg-[#17120f] shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/45 to-transparent"
          aria-hidden
        />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-[max(1rem,env(safe-area-inset-left))] py-2.5 pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="group flex min-w-0 flex-col rounded-lg outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400/80"
              onClick={() => setMenuOpen(false)}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500 transition-colors group-hover:text-stone-400">
                Good Game
              </span>
              <span className="truncate text-sm font-semibold text-teal-300/95 transition-colors group-hover:text-teal-200">
                Home
              </span>
            </Link>
          </div>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Account"
          >
            {user ? (
              <>
                <span className="mr-2 max-w-[12rem] truncate rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-xs text-stone-200">
                  <span className="sr-only">Signed in as </span>
                  {user.username}
                </span>
                <Link
                  href="/profile"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-teal-300/95 transition-colors hover:bg-white/[0.06] hover:text-teal-200"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-400 transition-colors hover:bg-white/[0.06] hover:text-stone-100 disabled:opacity-50"
                  disabled={logoutMutation.isPending}
                  onClick={() => void logoutMutation.mutate()}
                >
                  {logoutMutation.isPending ? "Signing out…" : "Log out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-teal-300/95 transition-colors hover:bg-white/[0.06] hover:text-teal-200"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-400 transition-colors hover:bg-white/[0.06] hover:text-stone-100"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>

          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-stone-200 transition-colors hover:border-white/20 hover:bg-white/[0.08] md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>

        <nav
          id={menuId}
          className="border-t border-white/10 bg-[#14100d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-1 md:hidden"
          aria-label="Account menu"
          hidden={!menuOpen}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1 py-2">
            {user ? (
              <>
                <p className="px-1 pb-2 text-xs text-stone-500">
                  Signed in as{" "}
                  <span className="font-mono text-sm text-stone-200">{user.username}</span>
                </p>
                <Link
                  href="/profile"
                  className="rounded-lg px-3 py-3 text-base font-medium text-teal-300/95 transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  type="button"
                  className="rounded-lg px-3 py-3 text-left text-base font-medium text-stone-300 transition-colors hover:bg-white/[0.06] active:bg-white/[0.08] disabled:opacity-50"
                  disabled={logoutMutation.isPending}
                  onClick={() => void logoutMutation.mutate()}
                >
                  {logoutMutation.isPending ? "Signing out…" : "Log out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-3 text-base font-medium text-teal-300/95 transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
                  onClick={() => setMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg px-3 py-3 text-base font-medium text-stone-300 transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
