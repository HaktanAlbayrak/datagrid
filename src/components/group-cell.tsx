import type { Cell, Row, RowData } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { ChevronRightIcon } from "lucide-react";

import type { GridFeatures } from "../core/features";
import { cn } from "../lib/cn";

/** Her gruplama seviyesi icin girinti (px) -- agac hucresiyle ayni. */
const INDENT = 16;

/**
 * Bir grup satirinin altindaki GERCEK kayit sayisi.
 *
 * ---
 * NEDEN `subRows.length` DEGIL?
 *
 * Ic ice gruplamada (`["durum", "tip"]`) bir grup satirinin cocuklari yine
 * GRUP satirlari oluyor. `subRows.length` o durumda "3 alt grup" der ve
 * kullanici bunu "3 kayit" diye okur -- sessizce yanlis bir sayi.
 *
 * Ayni sebeple `table.getRowModel().flatRows` uzerinden de sayilamaz: o
 * model CIZIM sirasini tutuyor ve icinde hem grup satirlari hem acilmis
 * satirlar var. Sayim, grup satirinin KENDI agacindan cikmali.
 */
function countLeafRows<TData extends RowData>(
  rows: Array<Row<GridFeatures, TData>>,
): number {
  return rows.reduce(
    (count, row) =>
      count + (row.subRows.length > 0 ? countLeafRows(row.subRows) : 1),
    0,
  );
}

/**
 * Grup degerini etikete cevirir.
 *
 * ---
 * `meta.filterOptions` VARSA ORADAN OKUNUYOR -- yeni bir API DEGIL.
 *
 * OLCULEN SORUN: "Tip"e gore gruplayinca baslikta `task` yaziyordu, oysa
 * hucrelerde "Görev" yaziyor. Ham enum degeri ile kullanicinin gordugu ad
 * arasindaki fark, grup basliginda birden ortaya cikiyor.
 *
 * Cozum icin `meta.formatGroup` diye YENI bir alan eklemek cazipti; ama
 * ayni esleme zaten `filterOptions`ta duruyor (secim filtresi onu
 * kullaniyor). Ikinci bir alan, ayni bilgiyi iki yere yazdirip birbirini
 * tutmama riski uretmekten baska bir sey yapmazdi.
 *
 * ---
 * `null`/`""` icin "(boş)": bu gruplar VAR ve kac kayit tuttuklarini gormek
 * cogu zaman tam da aranan sey ("kac kaydin tipi girilmemis?"). Bos etiket
 * birakmak o grubu gorunmez bir kutuya cevirirdi.
 */
function groupLabel<TData extends RowData, TValue>(
  cell: Cell<GridFeatures, TData, TValue>,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "(boş)";

  const option = cell.column.columnDef.meta?.filterOptions?.find(
    (entry) => entry.value === value,
  );
  if (option !== undefined) return option.label ?? option.value;

  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

/**
 * GRUP BASLIGI HUCRESI: acma oku + grup degeri + kayit sayisi.
 *
 * ---
 * NEDEN TUM SATIRI KAPLAYAN BIR SERIT (`colSpan`) DEGIL?
 *
 * Grup basligini `colSpan` ile satirin tamamina yaymak yaygin ve ilk bakista
 * daha "temiz" duruyor. Ama o zaman grup satirinda OZET GOSTERILEMIYOR:
 * "Aktif (24) — toplam 1.240" bilgisini tasiyacak kolon kalmiyor, cunku
 * kolonlar birlesti. Gruplamanin en degerli yani tam da bu ozetler.
 *
 * Hucreyi kendi kolonunda birakip digerlerini toplamlarla doldurmak,
 * gruplari birer "ozet satiri" haline getiriyor -- DevExtreme'in yaptigi ve
 * dogru olan sey.
 */
export function GroupCell<TData extends RowData, TValue>({
  cell,
}: {
  cell: Cell<GridFeatures, TData, TValue>;
}) {
  const row = cell.row;
  const value = row.getGroupingValue(cell.column.id);

  return (
    <Subscribe
      source={row.table.atoms.expanded}
      // Genisletme durumunu `Subscribe` ile okumak SART: `row.getIsExpanded()`
      // dogrudan cagrilsaydi React Compiler bu okumayi goremezdi (`row`
      // referansi degismiyor) ve ok tiklaninca satir yeniden cizilmezdi.
      selector={() => row.getIsExpanded()}
    >
      {(expanded) => (
        <div
          className="flex min-w-0 items-center gap-1"
          style={{ paddingInlineStart: row.depth * INDENT }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              row.toggleExpanded();
            }}
            aria-expanded={expanded}
            aria-label={expanded ? "Grubu daralt" : "Grubu genişlet"}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 transition-transform duration-150",
                expanded && "rotate-90",
              )}
            />
          </button>

          <span className="truncate font-medium">
            {groupLabel(cell, value)}
          </span>

          {/*
            KAYIT SAYISI, grubun yanindaki en degerli tek bilgi: kullanici
            gruplari karsilastirmak icin acmak zorunda kalmiyor.
          */}
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            ({countLeafRows(row.subRows)})
          </span>
        </div>
      )}
    </Subscribe>
  );
}
