"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuLayoutDashboard,
  LuPackage,
  LuShoppingCart,
  LuReceipt,
  LuUsers,
  LuWallet,
  LuSettings,
} from "react-icons/lu";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import type { AppRole } from "@/lib/supabase/products";
import { LogoutButton } from "@/components/auth/LogoutButton";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  /** Hidden from non-admin roles (e.g. cashiers) in the sidebar. */
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <LuLayoutDashboard size={18} />,
  },
  {
    href: "/products",
    label: "Produk",
    icon: <LuPackage size={18} />,
    adminOnly: true,
  },
  {
    href: "/pos",
    label: "POS",
    icon: <LuShoppingCart size={18} />,
  },
  {
    href: "/transactions",
    label: "Transaksi",
    icon: <LuReceipt size={18} />,
  },
  {
    href: "/clients",
    label: "Klien",
    icon: <LuUsers size={18} />,
  },
  {
    href: "/finance",
    label: "Keuangan",
    icon: <LuWallet size={18} />,
    adminOnly: true,
  },
  {
    href: "/settings",
    label: "Pengaturan",
    icon: <LuSettings size={18} />,
    adminOnly: true,
  },
];

export interface AppShellProps {
  /** Breadcrumb trail, e.g. ["Beranda", "Kasir (POS)"]. */
  breadcrumb: string[];
  /** Overrides the signed-in profile's name when provided. */
  userName?: string;
  /** Overrides the signed-in profile's role label when provided. */
  userRole?: string;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Admin",
  CASHIER: "Kasir",
};

export function AppShell({
  breadcrumb,
  userName,
  userRole,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const { profile } = useSession();

  // The sidebar mirrors the RBAC matrix (§2): admin-only modules are hidden
  // from cashiers. RLS still enforces this server-side (AC-4) — hiding is UX.
  const isAdmin = profile?.role === "ADMIN";
  const displayName = userName ?? profile?.fullName ?? "Admin";
  const displayRole = userRole ?? (profile ? ROLE_LABELS[profile.role] : "");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Image
              src="/firelle-logo.png"
              alt="Logo Firélle"
              width={26}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
            <span>FIRÉLLE</span>
          </div>
          <div className="sidebar-subtitle"></div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            // Admin-only modules are hidden from cashiers (RBAC §2).
            if (item.adminOnly && !isAdmin) {
              return null;
            }

            if (item.disabled) {
              return (
                <button
                  key={item.href}
                  type="button"
                  className="nav-item"
                  disabled
                  title="Segera hadir"
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("nav-item", active && "active")}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <nav aria-label="Breadcrumb" className="breadcrumb">
            {breadcrumb.map((crumb, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <span key={`${crumb}-${index}`} className="flex items-center gap-2">
                  {index > 0 && (
                    <span className="breadcrumb-sep" aria-hidden="true">
                      /
                    </span>
                  )}
                  <span
                    className="breadcrumb-item"
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb}
                  </span>
                </span>
              );
            })}
          </nav>

          <div className="topbar-user">
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-role">{displayRole}</div>
            </div>
            <div className="user-avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <LogoutButton />
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}