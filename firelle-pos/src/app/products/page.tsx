import Image from "next/image";
import {
  LuLayoutDashboard,
  LuPackage,
  LuShoppingCart,
  LuReceipt,
  LuUsers,
  LuWallet,
  LuSettings,
} from "react-icons/lu";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function ProductsPage() {
  return (
    <div className="app-shell">
      {/* Sidebar */}
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
          <button className="nav-item">
            <span className="nav-icon"><LuLayoutDashboard size={18} /></span>
            <span>Dashboard</span>
          </button>
          <button className="nav-item active">
            <span className="nav-icon"><LuPackage size={18} /></span>
            <span>Produk</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon"><LuShoppingCart size={18} /></span>
            <span>POS</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon"><LuReceipt size={18} /></span>
            <span>Transaksi</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon"><LuUsers size={18} /></span>
            <span>Klien</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon"><LuWallet size={18} /></span>
            <span>Keuangan</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon"><LuSettings size={18} /></span>
            <span>Pengaturan</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="topbar">
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <span className="breadcrumb-item">Beranda</span>
            <span className="breadcrumb-sep" aria-hidden="true">/</span>
            <span className="breadcrumb-item" aria-current="page">Katalog Produk</span>
          </nav>
          <div className="topbar-user">
            <div>
              <div className="user-name">Admin</div>
              <div className="user-role"></div>
            </div>
            <div className="user-avatar">F</div>
            <LogoutButton />
          </div>
        </div>
        <ProductCatalog />
      </main>
    </div>
  );
}
