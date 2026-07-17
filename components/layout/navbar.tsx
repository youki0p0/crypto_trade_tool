"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LineChart } from "lucide-react";
import { AuthButton } from "./auth-button";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/trade", label: "デモトレード" },
  { href: "/tax-simulator", label: "税シミュ" },
  { href: "/models", label: "AIモデル" },
  { href: "/advisor", label: "アドバイザー" },
  { href: "/insights", label: "市場観" },
  { href: "/history", label: "履歴" },
  { href: "/settings", label: "設定" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <LineChart className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Crypto Trade Sim</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
