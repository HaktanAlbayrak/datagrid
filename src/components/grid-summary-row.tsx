import type { RowData } from "@tanstack/react-table";

import {
  formatAggregateValue,
  getSummaryValue,
  hasSummary,
} from "../core/aggregate";
import { getPinnedEdge, getPinnedStyle } from "../core/pinning";
import type { GridTable } from "../core/use-grid-table";
import { cn } from "../lib/cn";
import { GridCell, GridFooter, GridRow } from "../primitives/table";

const ALIGN_CLASS = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

/**
 * GENEL TOPLAM SATIRI (`<tfoot>`).
 *
 * ---
 * `<tfoot>`, GOVDENIN SON SATIRI DEGIL.
 *
 * Ozeti tbody'nin sonuna bir satir olarak eklemek kolaydi. Uc sey bozulurdu:
 * (1) satir SANALLASTIRMAYA girer ve kaydirilinca ekrandan cikardi;
 * (2) satir siralamaya/filtreye dahil bir "kayit" gibi gorunurdu;
 * (3) ekran okuyucu onu bir veri satiri olarak sayardi. `<tfoot>` bu ucunu
 * de anlamsal olarak cozuyor -- HTML'in bu elemani var olma sebebi bu.
 *
 * ---
 * ALTA YAPISKAN (`sticky bottom-0`).
 *
 * Toplam, kaydirilinca kaybolmamali: kullanici listeyi tararken "toplam ne
 * kadardi?" diye basa donmek zorunda kalmasin. Yapiskan baslikla ayni
 * gerekce, ters yon.
 *
 * ---
 * NEDEN AYRI BILESEN, `DataGrid`in ICINDE DEGIL?
 *
 * Aslinda `DataGrid` bunu kendisi ciziyor (kolonlarda `meta.aggregate`
 * varsa). Ayri dosya olmasinin sebebi test edilebilirlik ve okunurluk:
 * ozetin hangi satirlar uzerinden hesaplandigi karari (`aggregate.ts`teki
 * gerekce) tek basina okunabilsin.
 */
export function GridSummaryRow<TData extends RowData>({
  table,
}: {
  table: GridTable<TData>;
}) {
  const columns = table.getVisibleLeafColumns();
  if (!columns.some(hasSummary)) return null;

  const rows = table.getFilteredRowModel().rows;

  /*
    KAPSAM ETIKETI -- ve SUNUCU MODUNDA DURUSTLUK.

    Sunucu tarafli izgarada istemcide yalnizca O SAYFA var. Buradaki toplam
    ister istemez "gorunen sayfanin toplami" oluyor; dogrusunu ancak sunucu
    hesaplayabilir.

    Bu durumda iki kotu secenek vardi: ozeti hic gostermemek (kullanici
    sayfa basi toplamdan da yararlanabilirdi) ya da "Toplam" diye yazip
    yanlis bir sayiyi dogruymus gibi sunmak. Ikisi de yanlis.

    Ucuncusunu yaziyoruz: sayiyi goster, KAPSAMINI soyle. "Bu sayfa" yazan
    bir toplam yaniltmiyor -- kullanici neye baktigini biliyor.
  */
  const isServerSide =
    table.options.manualPagination === true ||
    table.options.manualFiltering === true;
  const scopeLabel = isServerSide ? "Bu sayfa" : "Toplam";

  /*
    ETIKET NEREYE? -- ilk toplamdan hemen ONCEKI uygun kolona.

    Ilk denemede "ozeti olmayan ILK kolon" secilmisti; o kolon secim kutusu
    kolonu (40px) cikti ve etiket "Bu sa..." diye kirpildi -- tarayicida
    goruldu.

    Dogru yer sayinin YANI: "… | Bu sayfa | 134 | …" tek bir cumle gibi
    okunuyor. Bu yuzden ilk ozetli kolondan geriye dogru gidip yeterince
    genis (>=80px) ilk kolona yaziyoruz. Boyle bir kolon yoksa etiket
    dusuyor -- eksik bir etiket, kirpilmis bir etiketten iyi.
  */
  const firstSummaryIndex = columns.findIndex(hasSummary);
  const labelColumnId = columns
    .slice(0, firstSummaryIndex)
    .reverse()
    .find((column) => !hasSummary(column) && column.getSize() >= 80)?.id;

  return (
    <GridFooter className="sticky bottom-0 z-30 border-t bg-muted">
      {/*
        `aria-rowindex` YOK ve bu bilincli: ozet satiri bir KAYIT degil.
        `aria-rowcount` toplam kayit sayisini soyluyor; ozete de bir sira
        numarasi versek sayim ile numaralar birbirini tutmazdi.
      */}
      <GridRow className="hover:bg-transparent">
        {columns.map((column) => {
          const edge = getPinnedEdge(column);
          const pinned = column.getIsPinned();
          const align = column.columnDef.meta?.align;
          const showsSummary = hasSummary(column);

          return (
            <GridCell
              key={column.id}
              style={getPinnedStyle(column, false)}
              data-pinned={pinned || undefined}
              className={cn(
                "truncate font-medium tabular-nums",
                align !== undefined && ALIGN_CLASS[align],
                // Yapiskan hucre saydam olamaz -- altindan gecen satirlar
                // gorunur. `bg-muted` govdedeki `bg-background`tan farkli
                // olsun ki ozet satiri veriden AYRISSIN.
                pinned !== false && "bg-muted",
                edge === "start" && "shadow-[inset_-1px_0_0_0_var(--border)]",
                edge === "end" && "shadow-[inset_1px_0_0_0_var(--border)]",
              )}
            >
              {showsSummary ? (
                formatAggregateValue(column, getSummaryValue(column, rows))
              ) : column.id === labelColumnId ? (
                <span className="font-normal text-muted-foreground text-xs">
                  {scopeLabel}
                </span>
              ) : /*
                  Ozeti olmayan kolonlar BOS kaliyor -- "—" bile degil.
                  Tire, "hesaplandi ve degeri yok" demek; burada durum "bu
                  kolon toplanmiyor". Ikisini ayni gostermek, ozet satirini
                  okuyan birine yanlis bir sey soylerdi.
                */
              null}
            </GridCell>
          );
        })}
        {/* Dolgu hucresi -- baslik ve govdedeki ile ayni. */}
        <GridCell aria-hidden="true" className="w-auto p-0" />
      </GridRow>
    </GridFooter>
  );
}

/**
 * Bir satirin ozet gosterip gostermeyecegini disaridan sormak icin.
 * `DataGrid` bunu `<tfoot>` cizip cizmemeye karar vermek icin kullaniyor.
 */
export function tableHasSummary<TData extends RowData>(
  table: GridTable<TData>,
): boolean {
  return table.getVisibleLeafColumns().some(hasSummary);
}
