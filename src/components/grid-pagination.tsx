import type { RowData } from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import type { GridTable } from "../core/use-grid-table";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";

const PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * SAYFALAMA CUBUGU.
 *
 * ---
 * SATIR SAYISI: `getRowCount()`, `data.length` DEGIL.
 *
 * Sunucu tarafi sayfalamada (`manualPagination`) elimizdeki dizi yalnizca
 * GECERLI SAYFAYI tasir; `data.length` 25 der, oysa toplam 4.812'dir.
 * `getRowCount()` her iki modda da dogru: istemci modunda filtrelenmis
 * satirlari sayar, sunucu modunda tuketicinin verdigi `rowCount`u okur.
 *
 * ---
 * NEDEN SAYFA NUMARASI DUGMELERI YOK (1 2 3 ... 47)?
 *
 * Numara dugmeleri iki sey gerektirir: toplam sayfa sayisi ve o sayidan
 * anlamli bir pencere uretmek. Ikisi de var, ama numaraya tiklamak gercekte
 * NADIR bir eylem -- kullanicilar ya ilerler ya arar. Buna karsilik dugmeler
 * dar ekranda tasan bir satir uretir ve mobilde ilk kurban olur.
 *
 * "Ilk / onceki / sonraki / son" dortlusu, sayfa numarasini yazan bir metinle
 * birlikte ayni ise yariyor ve her genislikte ayni kaliyor. Numara secimi
 * gerekirse ayri bir "sayfaya git" alani eklenir.
 */
export function GridPagination<TData extends RowData>({
  table,
  className,
}: {
  table: GridTable<TData>;
  className?: string;
}) {
  const { pageIndex, pageSize } = table.state.pagination;
  const rowCount = table.getRowCount();
  const pageCount = table.getPageCount();

  const firstRow = rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, rowCount);

  const selectedCount = Object.keys(table.state.rowSelection).length;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-muted-foreground text-xs",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {/* Aralik gosteriyoruz ("26-50 / 4.812"), yalnizca sayfa numarasi
              degil: kullanicinin listede NEREDE oldugunu anlatan sey bu. */}
          {rowCount === 0 ? "0 kayıt" : `${firstRow}–${lastRow} / ${rowCount}`}
        </span>
        {selectedCount > 0 && (
          <span className="tabular-nums">{selectedCount} seçili</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span>Sayfa boyutu</span>
          {/*
            Yerli `<select>`. Ozel bir acilir liste daha "sik" olurdu ama
            burada yerli olan daha IYI: mobilde isletim sisteminin kendi
            secicisini aciyor, klavyeyle harfe basinca atliyor ve ekran
            okuyucu icin ek bir sey yazmamiz gerekmiyor.
          */}
          <select
            value={pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="h-7 rounded-md border border-input bg-background px-1.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <span className="tabular-nums">
          Sayfa {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount}
        </span>

        <div className="flex items-center gap-1">
          <GridButton
            variant="outline"
            size="icon"
            aria-label="İlk sayfa"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.firstPage()}
          >
            <ChevronsLeftIcon className="size-3.5" />
          </GridButton>
          <GridButton
            variant="outline"
            size="icon"
            aria-label="Önceki sayfa"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeftIcon className="size-3.5" />
          </GridButton>
          <GridButton
            variant="outline"
            size="icon"
            aria-label="Sonraki sayfa"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRightIcon className="size-3.5" />
          </GridButton>
          <GridButton
            variant="outline"
            size="icon"
            aria-label="Son sayfa"
            disabled={!table.getCanNextPage()}
            onClick={() => table.lastPage()}
          >
            <ChevronsRightIcon className="size-3.5" />
          </GridButton>
        </div>
      </div>
    </div>
  );
}
