"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Flower2, SlidersHorizontal } from "lucide-react";
export function Header({ onSettings }: { onSettings?: () => void }) {
  const path = usePathname(),
    router = useRouter();
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="PinDou studio">
        <span className="brand-flower">
          <Flower2 size={14} strokeWidth={3} />
        </span>
        pindou<span className="brand-dot">.</span>
      </Link>
      <span className="brand-caption">
        Small beads.
        <br />
        Big good days.
      </span>
      <nav aria-label="Main navigation">
        <Link
          href="/"
          className={path === "/" || path.startsWith("/create") ? "active" : ""}
        >
          Studio
        </Link>
        <Link
          href="/presets"
          className={path.startsWith("/preset") ? "active" : ""}
        >
          Templates
        </Link>
        <Link
          href="/account/projects"
          className={path.startsWith("/account") ? "active" : ""}
        >
          My creations
        </Link>
      </nav>
      <button
        className="profile-button"
        onClick={onSettings || (() => router.push("/"))}
        aria-label="Studio settings"
        title="Studio settings"
      >
        <SlidersHorizontal size={18} />
      </button>
    </header>
  );
}
