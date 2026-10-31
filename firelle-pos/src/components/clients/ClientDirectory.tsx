"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuUsers,
  LuUserPlus,
  LuSearch,
  LuX,
  LuTriangleAlert,
  LuRotateCcw,
  LuChevronLeft,
  LuChevronRight,
  LuPencil,
  LuArchive,
  LuEye,
  LuPhone,
  LuChevronsUpDown,
  LuArrowUp,
  LuArrowDown,
} from "react-icons/lu";
import {
  clientInitials,
  type Client,
  type ClientInput,
  type ClientSortField,
  type ClientStatusFilter,
  type SortDirection,
} from "@/types/client";
import type { Transaction } from "@/types/transaction";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { useDebouncedSearch, usePagination } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import {
  archiveClient,
  createClientRecord,
  listClientTransactions,
  listClientsSorted,
  restoreClient,
  updateClient,
} from "@/lib/supabase/clients";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientFormDialog } from "./ClientFormDialog";
import { ArchiveClientDialog } from "./ArchiveClientDialog";
import { ClientDetailDrawer } from "./ClientDetailDrawer";

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: ClientSortField;
  sortField: ClientSortField;
  sortDir: SortDirection;
}) {
  if (sortField !== field) {
    return (
      <span className="sort-icon" aria-hidden="true">
        <LuChevronsUpDown size={14} />
      </span>
    );
  }
  return (
    <span className="sort-icon active" aria-hidden="true">
      {sortDir === "asc" ? <LuArrowUp size={14} /> : <LuArrowDown size={14} />}
    </span>
  );
}

export function ClientDirectory() {
  const { ready, role } = useSession();
  const canManage = role === "ADMIN";

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [statusFilter, setStatusFilter] = useState<ClientStatusFilter>("ALL");
  const { searchTerm, setSearchTerm, debouncedTerm } = useDebouncedSearch(300);
  const [sortField, setSortField] = useState<ClientSortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);

  // Detail drawer
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const reload = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    setReloadTick((n) => n + 1);
  }, []);

  // ─── Load clients ──────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let active = true;

    void (async () => {
      try {
        const data = await listClientsSorted(sortField, sortDir);
        if (active) {
          setClients(data);
          setLoadError(null);
        }
      } catch (err) {
        if (active) setLoadError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [ready, reloadTick, sortField, sortDir]);

  // ─── Load transaction history for the open drawer ───
  useEffect(() => {
    if (!detailClient) return;
    let active = true;
    setDetailLoading(true);

    void (async () => {
      try {
        const data = await listClientTransactions(detailClient.id);
        if (active) setDetailTransactions(data as Transaction[]);
      } catch (err) {
        if (active) setActionError(getErrorMessage(err));
      } finally {
        if (active) setDetailLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [detailClient]);

  // ─── Filtered list ─────────────────────────────
  const filtered = useMemo(() => {
    let result = clients;

    if (statusFilter === "ACTIVE") {
      result = result.filter((c) => c.is_active && !c.is_walk_in);
    } else if (statusFilter === "ARCHIVED") {
      result = result.filter((c) => !c.is_active);
    }

    if (debouncedTerm) {
      const q = debouncedTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
      );
    }

    return result;
  }, [clients, statusFilter, debouncedTerm]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
  } = usePagination(filtered.length, 25);

  const paged = filtered.slice(startIndex, endIndex);

  // ─── Handlers ──────────────────────────────────
  const handleSort = (field: ClientSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleCreate = async (input: ClientInput) => {
    await createClientRecord(input);
    reload();
    setCreateOpen(false);
  };

  const handleUpdate = async (input: ClientInput) => {
    if (!editClient) return;
    await updateClient(editClient.id, input);
    reload();
    setEditClient(null);
  };

  const handleArchive = async (clientId: string) => {
    await archiveClient(clientId);
    reload();
    setArchiveTarget(null);
  };

  const handleRestore = async (client: Client) => {
    setActionError(null);
    try {
      await restoreClient(client.id);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  // ─── Stats ─────────────────────────────────────
  const stats = useMemo(() => {
    const named = clients.filter((c) => !c.is_walk_in);
    const active = named.filter((c) => c.is_active);
    const archived = named.filter((c) => !c.is_active);
    const withPhone = active.filter((c) => c.phone).length;
    return { active: active.length, archived: archived.length, withPhone };
  }, [clients]);

  return (
    <div className="client-directory">
      {/* ── Header ── */}
      <div className="catalog-header">
        <div className="header-left">
          <h1 className="header-title">
            <span className="header-title-icon" aria-hidden="true">
              <LuUsers size={26} />
            </span>
            <span>Klien</span>
          </h1>
          <p className="header-subtitle">
            {stats.active} pelanggan aktif
            {stats.archived > 0 && (
              <span className="text-muted"> • {stats.archived} diarsipkan</span>
            )}
            {role === "CASHIER" && (
              <span className="text-muted"> • hanya dapat melihat</span>
            )}
          </p>
        </div>
        <div className="header-actions flex items-center gap-2">
          {canManage && (
            <Button
              variant="default"
              onClick={() => setCreateOpen(true)}
              className="gap-2"
            >
              <LuUserPlus size={16} />
              <span>Tambah Klien</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="catalog-toolbar">
        <div className="relative flex-1 min-w-0 sm:min-w-[240px]">
          <LuSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Cari nama, telepon, atau alamat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-11 bg-card"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchTerm("")}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Hapus pencarian"
            >
              <LuX size={14} />
            </Button>
          )}
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as ClientStatusFilter)
          }
        >
          <SelectTrigger
            className="h-11 w-full min-w-0 sm:w-auto sm:min-w-[9.5rem]"
            aria-label="Filter status pelanggan"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua</SelectItem>
            <SelectItem value="ACTIVE">Aktif</SelectItem>
            <SelectItem value="ARCHIVED">Arsip</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <span className="flex items-start gap-2">
            <LuTriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            onClick={() => setActionError(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="table-container">
        <table className="product-table">
          <thead>
            <tr>
              <th className="text-center">Pelanggan</th>
              <th onClick={() => handleSort("phone")} className="sortable">
                Telepon{" "}
                <SortIcon field="phone" sortField={sortField} sortDir={sortDir} />
              </th>
              <th>Alamat</th>
              <th onClick={() => handleSort("created_at")} className="sortable">
                Terdaftar{" "}
                <SortIcon
                  field="created_at"
                  sortField={sortField}
                  sortDir={sortDir}
                />
              </th>
              <th>Status</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuUsers size={44} />
                  </div>
                  <p>Memuat data pelanggan...</p>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  <div className="empty-icon text-destructive" aria-hidden="true">
                    <LuTriangleAlert size={44} />
                  </div>
                  <p className="text-destructive">{loadError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={reload}
                  >
                    <LuRotateCcw size={14} />
                    <span>Coba lagi</span>
                  </Button>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <LuUsers size={44} />
                  </div>
                  <p>
                    {debouncedTerm
                      ? `Tidak ada pelanggan yang cocok dengan "${debouncedTerm}"`
                      : statusFilter === "ARCHIVED"
                      ? "Tidak ada pelanggan yang diarsipkan"
                      : canManage
                      ? "Belum ada pelanggan. Klik \"Tambah Klien\" untuk memulai."
                      : "Belum ada pelanggan terdaftar."}
                  </p>
                </td>
              </tr>
            ) : (
              paged.map((client) => (
                <tr
                  key={client.id}
                  className={cn("product-row", !client.is_active && "archived-row")}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn("client-avatar", client.is_walk_in && "walkin")}
                        aria-hidden="true"
                      >
                        {client.is_walk_in ? "PU" : clientInitials(client.name)}
                      </div>
                      <button
                        className="product-name-link font-medium text-left"
                        onClick={() => {
                          setDetailClient(client);
                          setDetailTransactions([]);
                        }}
                      >
                        {client.name}
                      </button>
                    </div>
                  </td>
                  <td className="mono">
                    {client.phone || <span className="text-muted">—</span>}
                  </td>
                  <td className="text-xs">
                    {client.address ? (
                      <span className="line-clamp-1 max-w-[160px] sm:max-w-[280px]">
                        {client.address}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {client.created_at
                      ? new Date(client.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td>
                    {client.is_walk_in ? (
                      <Badge variant="muted" className="text-[11px]">
                        Pelanggan Umum
                      </Badge>
                    ) : client.is_active ? (
                      <Badge variant="success" className="text-[11px]">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px]">
                        Diarsipkan
                      </Badge>
                    )}
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons flex items-center justify-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Lihat detail"
                        aria-label={`Detail ${client.name}`}
                        onClick={() => {
                          setDetailClient(client);
                          setDetailTransactions([]);
                        }}
                      >
                        <LuEye size={15} />
                      </Button>

                      {canManage && !client.is_walk_in && client.is_active && (
                        <>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Ubah"
                            aria-label={`Ubah ${client.name}`}
                            onClick={() => setEditClient(client)}
                          >
                            <LuPencil size={15} />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Arsipkan"
                            aria-label={`Arsipkan ${client.name}`}
                            className="hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setArchiveTarget(client)}
                          >
                            <LuArchive size={15} />
                          </Button>
                        </>
                      )}

                      {canManage && !client.is_walk_in && !client.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRestore(client)}
                          className="gap-1.5 text-success-foreground border-success/30 hover:bg-success/10"
                        >
                          <LuRotateCcw size={14} />
                          <span>Pulihkan</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {filtered.length > 0 && (
        <div className="pagination flex items-center justify-between pt-4">
          <span className="page-info text-xs text-muted-foreground">
            Menampilkan{" "}
            <strong className="text-foreground">
              {startIndex + 1}–{endIndex}
            </strong>{" "}
            dari <strong className="text-foreground">{filtered.length}</strong>{" "}
            pelanggan
          </span>
          <div className="page-controls flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 1}
              onClick={prevPage}
              aria-label="Halaman sebelumnya"
            >
              <LuChevronLeft size={16} />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "ghost"}
                size="sm"
                className="size-11 p-0 text-sm"
                onClick={() => goToPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === totalPages}
              onClick={nextPage}
              aria-label="Halaman selanjutnya"
            >
              <LuChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      {createOpen && canManage && (
        <ClientFormDialog onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
      )}

      {editClient && canManage && (
        <ClientFormDialog
          client={editClient}
          onClose={() => setEditClient(null)}
          onSubmit={handleUpdate}
        />
      )}

      {archiveTarget && canManage && (
        <ArchiveClientDialog
          client={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onArchive={handleArchive}
        />
      )}

      {detailClient && (
        <ClientDetailDrawer
          client={detailClient}
          transactions={detailTransactions}
          loadingTransactions={detailLoading}
          onClose={() => setDetailClient(null)}
        />
      )}
    </div>
  );
}