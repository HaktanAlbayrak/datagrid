import type { Header, RowData } from "@tanstack/react-table";
import { FlexRender } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import type { GridFeatures } from "../core/features";
import { getPinnedEdge, getPinnedStyle } from "../core/pinning";
import { cn } from "../lib/cn";
import { GridHead } from "../primitives/table";
import { ColumnFilterPopup } from "./column-filter-popup";

const SORT_ICON = {
  asc: ArrowUpIcon,
  desc: ArrowDownIcon,
} as const;

const ALIGN_CLASS = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

/**
 * BASLIK HUCRESI: siralama, coklu siralama rozeti ve yeniden boyutlandirma.
 *
 * Ic ice basliklari (DevExtreme'de "column band") AYRICA ele almiyoruz --
 * TanStack'in `getHeaderGroups()`u kolon tanimindaki `columns: [...]` agacini
 * zaten cok satirli baslik gruplarina cevirdi. Bize dusen `colSpan`i yazmak.
 */
export function GridColumnHeader<TData extends RowData>({
  header,
  isMultiSorted,
  showFilterButton = false,
  colIndex,
  tabIndex,
  onFocus,
}: {
  header: Header<GridFeatures, TData, unknown>;
  /**
   * Baslikta filtre huni ikonu cizilsin mi?
   *
   * `filterMode="popup"` oldugunda `true`. Satir modunda gereksiz -- ayni
   * filtreye iki ayri giris noktasi, kullaniciya "bunlar farkli seyler mi?"
   * diye sordurur.
   */
  showFilterButton?: boolean;
  /**
   * Tabloda BIRDEN FAZLA siralama var mi? Yukaridan geliyor, burada
   * hesaplanmiyor -- cunku baslik baglaminda `table` CEKIRDEK tip olarak
   * geliyor ve `table.state` orada yok. Degeri zaten elinde olan `DataGrid`in
   * gecmesi, burada bir abonelik kurmaktan hem ucuz hem dogru.
   */
  isMultiSorted: boolean;
  /**
   * Klavye adresi: bu basligin 0 tabanli kolon sirasi.
   *
   * Baslik satiri gezinmede -1. satir; yukari ok en ustte basliklara cikiyor
   * ki klavye kullanicisi da siralama/filtre dugmelerine ulasabilsin.
   * `undefined` ise izgara klavye kipinde degil (dogrudan kullanim).
   */
  colIndex?: number;
  /** Gezinen odak (roving tabindex) -- yalnizca bir hucre `0` olur. */
  tabIndex?: number;
  onFocus?: () => void;
}) {
  const column = header.column;
  const canSort = column.getCanSort();
  const sorted = column.getIsSorted();
  const edge = getPinnedEdge(column);
  // Baslik, hucreyle AYNI hizada olmali: sayi kolonunun basligi solda,
  // degerleri sagda durursa goz ikisini ayni sutun saymakta zorlanir.
  const align = column.columnDef.meta?.align;

  /**
   * COKLU SIRALAMA ROZETI (1, 2, 3...).
   *
   * DevExtreme bunu gosteriyor ve sebebi soyle: iki kolona gore siralama
   * yapildiginda hangisinin ONCE uygulandigi sonucu tamamen degistirir, ama
   * yalnizca ok isaretlerine bakarak bunu bilmenin YOLU YOKTUR. Rozet
   * olmadan coklu siralama, kullanicinin tahmin ettigi bir ozelliktir.
   *
   * Tek kolona gore siralamada gizliyoruz: "1" yazmak bilgi tasimaz, gurultudur.
   */
  const sortIndex = column.getSortIndex();
  const showSortIndex = sorted !== false && isMultiSorted;

  const Icon = sorted === false ? ChevronsUpDownIcon : SORT_ICON[sorted];

  return (
    <GridHead
      colSpan={header.colSpan}
      style={{ width: header.getSize(), ...getPinnedStyle(column, true) }}
      data-pinned={column.getIsPinned() || undefined}
      // Baslik satiri klavye gezinmesinde -1. satir: yukari ok en ustte
      // basliklara cikiyor (siralamak icin).
      data-cell={colIndex === undefined ? undefined : `-1:${colIndex}`}
      aria-colindex={colIndex === undefined ? undefined : colIndex + 1}
      tabIndex={tabIndex}
      onFocus={onFocus}
      aria-sort={
        sorted === false
          ? "none"
          : sorted === "asc"
            ? "ascending"
            : "descending"
      }
      className={cn(
        "group/head",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        align !== undefined && ALIGN_CLASS[align],
        column.getIsPinned() !== false && "bg-background",
        edge === "start" && "shadow-[inset_-1px_0_0_0_var(--border)]",
        edge === "end" && "shadow-[inset_1px_0_0_0_var(--border)]",
      )}
    >
      {header.isPlaceholder ? null : (
        <div className="flex items-center gap-1">
          {canSort ? (
            <button
              type="button"
              // `onClick` yerine TanStack'in hazir isleyicisi: SHIFT ile coklu
              // siralamayi, ucuncu tiklamada siralamayi kaldirmayi ve
              // `enableMultiSort` gibi secenekleri o zaten dogru yorumluyor.
              onClick={column.getToggleSortingHandler()}
              className={cn(
                "-mx-1 flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                // Sag hizali kolonlarda baslik metni de saga yaslanmali;
                // aksi halde ok isareti basligin degil kolonun ortasinda kalir.
                align === "end" && "justify-end",
                align === "center" && "justify-center",
              )}
            >
              <span className="truncate">
                <FlexRender header={header} />
              </span>
              <Icon
                className={cn(
                  "size-3 shrink-0 transition-opacity",
                  // Siralanmamis kolonda ok SOLUK duruyor ama VAR: kolonun
                  // siralanabilir oldugunu ancak uzerine gelince ogrenmek,
                  // dokunmatik cihazda hic ogrenmemek demek.
                  sorted === false && "opacity-30 group-hover/head:opacity-60",
                )}
              />
              {showSortIndex && (
                <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground tabular-nums">
                  {sortIndex + 1}
                </span>
              )}
            </button>
          ) : (
            <span className="truncate">
              <FlexRender header={header} />
            </span>
          )}

          {showFilterButton && <ColumnFilterPopup column={column} />}
        </div>
      )}

      {column.getCanResize() && (
        /*
          YENIDEN BOYUTLANDIRMA TUTAMAGI.

          ---
          KLAVYEYLE DE CALISIYOR -- ve bu bir "ekstra" degil, ZORUNLULUK.

          Ilk halinde yalnizca fare vardi. Linter hakli olarak uyardi:
          `role="separator"` odaklanabilir DEGILSE ve deger ozniteligi
          tasimiyorsa, ekran okuyucuya "burada ayarlanabilir bir sey var"
          deyip ayarlama yolu VERMEMEK oluyor.

          Iki secenek vardi: rolu kaldirip tutamagi `aria-hidden` yapmak
          (fare zorunlu), ya da gercekten klavyeyle calistirmak. Ikincisini
          sectim: fare kullanamayan biri icin "kolon cok dar, icerigi
          goremiyorum" cikissiz bir durum olurdu.

          - Ok tuslari: 16px adim (gorulebilir bir fark)
          - Shift + ok: 4px ince ayar
          - Home: varsayilana don (cift tiklamanin klavye karsiligi)

          `aria-valuenow/min/max` ile ekran okuyucu genisligi OKUYABILIYOR.

          ---
          `onDoubleClick` -> `resetSize()`: DevExtreme'de de cift tiklama
          kolonu varsayilan genisligine dondurur. Yanlislikla daraltilan bir
          kolonu geri getirmenin baska yolu yoksa kullanici sayfayi yeniler.

          `touch-none`: dokunmatikte tarayici bu hareketi SAYFA KAYDIRMA
          sanip suruklemeyi yutuyor. Bu tek sinif olmadan ozellik telefonda
          hic calismiyor.

          Genislik 4px ama gorsel cizgi 1px (`after:`): tiklama hedefi
          gorunenden buyuk olmali, yoksa piksel avina donusur.
        */
        // Kural `<hr>` oneriyor. Kullanamayiz: `<hr>` ODAKLANAMAYAN ayirici
        // rolune eslenir, oysa buradaki ayirici bir WIDGET -- ok tuslariyla
        // deger degistiriyor. ARIA'nin "window splitter" deseni tam olarak
        // budur: odaklanabilir `role="separator"` + `aria-valuenow`.
        // Ustelik `<hr>`, `<th>` icinde mutlak konumlu bir tutamak olarak
        // anlamsal bir kazanc da saglamazdi.
        // biome-ignore lint/a11y/useSemanticElements: odaklanabilir ayirici (ARIA window splitter) <hr> ile ifade edilemez
        <span
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={`Kolon genişliğini değiştir: ${column.id}`}
          aria-valuenow={Math.round(column.getSize())}
          aria-valuemin={column.columnDef.minSize ?? 20}
          aria-valuemax={column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER}
          onDoubleClick={() => column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onKeyDown={(event) => {
            if (event.key === "Home") {
              event.preventDefault();
              column.resetSize();
              return;
            }

            const direction =
              event.key === "ArrowLeft"
                ? -1
                : event.key === "ArrowRight"
                  ? 1
                  : 0;
            if (direction === 0) return;

            // Tarayicinin yatay kaydirmasini engelliyoruz: aksi halde ok
            // tusu hem kolonu genisletir hem sayfayi kaydirir.
            event.preventDefault();

            const step = event.shiftKey ? 4 : 16;
            const next = Math.max(
              column.columnDef.minSize ?? 20,
              Math.min(
                column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER,
                column.getSize() + direction * step,
              ),
            );

            column.table.setColumnSizing((old) => ({
              ...old,
              [column.id]: next,
            }));
          }}
          className={cn(
            "absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize touch-none select-none",
            "after:absolute after:top-1 after:right-0 after:bottom-1 after:w-px after:bg-border",
            "hover:after:w-0.5 hover:after:bg-primary",
            "focus-visible:outline-none focus-visible:after:w-0.5 focus-visible:after:bg-primary",
            header.column.getIsResizing() && "after:w-0.5 after:bg-primary",
          )}
        />
      )}
    </GridHead>
  );
}
