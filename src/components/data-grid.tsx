import type { Row, RowData } from "@tanstack/react-table";
import { FlexRender, Subscribe } from "@tanstack/react-table";
import { type ReactNode, useRef } from "react";
import { hasAggregate } from "../core/aggregate";
import type { GridFeatures } from "../core/features";
import { getPinnedEdge, getPinnedStyle } from "../core/pinning";
import { useGridKeyboard } from "../core/use-grid-keyboard";
import type { GridTable } from "../core/use-grid-table";
import { useGridVirtualizer } from "../core/use-grid-virtualizer";
import { cn } from "../lib/cn";
import {
  GridBody,
  GridCell,
  GridHead,
  GridHeader,
  GridRow,
  GridTable as GridTableEl,
} from "../primitives/table";
import { ColumnFilter } from "./column-filter";
import { GridColumnHeader } from "./grid-column-header";
import { GridSummaryRow, tableHasSummary } from "./grid-summary-row";
import { GroupCell } from "./group-cell";

export interface DataGridProps<TData extends RowData> {
  table: GridTable<TData>;
  /**
   * Kaydirma alaninin yuksekligi. Verilmezse izgara icerigi kadar uzar.
   *
   * YAPISKAN BASLIK BUNA BAGLI: `position: sticky` yalnizca bir KAYDIRMA
   * KABI icinde anlam kazanir. Yukseklik verilmezse kap sayfayla birlikte
   * kayar ve baslik sayfanin ustune degil kendi kabinin ustune yapisir --
   * yani hic yapismaz gibi gorunur.
   */
  height?: number | string;
  /**
   * Filtreler NEREDE?
   *
   * - `"popup"` (varsayilan): her baslikta bir huni ikonu, tiklayinca
   *   baloncuk acilir. Dikey alan yemez, gurultu yapmaz.
   * - `"row"`: basliklarin altinda kalici bir filtre satiri. Ardisik olarak
   *   birkac kolonu daraltan kullanici icin daha hizli.
   * - `"none"`: kolon filtresi arayuzu yok (yalnizca genel arama).
   */
  filterMode?: "popup" | "row" | "none";
  /**
   * `filterMode="row"` iken satir gorunsun mu? `GridToolbar` ile ayni
   * durumu paylasiyor.
   */
  showFilterRow?: boolean;
  /** Veri yuklenirken. Iskelet degil, mevcut satirlari SOLUKLASTIRIYORUZ (asagida). */
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  /** Satira tiklandiginda. Secim kutusu ve menu tiklamalari buraya ULASMAZ. */
  onRowClick?: (row: Row<GridFeatures, TData>) => void;
  /**
   * SANALLASTIRMA: yalnizca gorunen satirlari ciz.
   *
   * `"auto"` (varsayilan) -- satir sayisi esigi asinca kendiliginden
   * aciliyor. Bilincli bir varsayilan: 25 satirlik bir izgarada
   * sanallastirma net ZARAR (olcum maliyeti, tarayicinin sayfa ici
   * aramasinin gorunmeyen satirlari bulamamasi), 500 satirda net kazanc.
   * Esigi kullaniciya sordurmak, cevabini bizim daha iyi bildigimiz bir
   * soru olurdu.
   *
   * `true` / `false` ile elle zorlanabiliyor.
   */
  virtual?: boolean | "auto";
  /** `virtual="auto"` esigi. */
  virtualThreshold?: number;
  /** Tahmini satir yuksekligi (px). Yogun/gevsek temada degisir. */
  estimatedRowHeight?: number;
  className?: string;
}

const ALIGN_CLASS = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

/**
 * IZGARA GOVDESI.
 *
 * ---
 * ERISILEBILIRLIK: `role="grid"` -- ve artik DAVRANISI DA VAR.
 *
 * Uzun sure bilincli olarak `role="grid"` YAZMADIK: bu rol ekran okuyucuya
 * "burada hucre hucre gezilebilir bir yapi var" diye SOZ VERIR. Davranis
 * olmadan rolu koymak, kullaniciyi ok tuslarina basip hicbir sey olmayan bir
 * tabloya hapsetmek olurdu -- once soz verip sonra tutmak degil, once tutmak.
 * `useGridKeyboard` yazildigi gun rol de eklendi.
 *
 * `aria-rowcount` / `aria-rowindex` SANALLASTIRMA ICIN SART: DOM'da ~30 satir
 * var ama kullanici 640 kayitlik bir listede. Bu oznitelikler olmadan ekran
 * okuyucu "30 satirdan 1'i" der ve konum bilgisi tamamen yanlis olur; dolgu
 * satirlarinin sayimi bozma problemi de boylece kapaniyor.
 *
 * ---
 * `table-fixed` + acik genislikler.
 *
 * Tarayicinin otomatik tablo yerlesimi icerige gore kolon genisligi hesaplar;
 * bu, yeniden boyutlandirma ve dondurulmus kolonlarla BAGDASMAZ (sticky
 * ofsetlerimiz TanStack'in bildigi genisliklere dayaniyor, tarayicinin
 * uydurduklarina degil). `table-fixed` ile tek dogruluk kaynagi TanStack olur.
 */
export function DataGrid<TData extends RowData>({
  table,
  height,
  filterMode = "popup",
  showFilterRow = false,
  isLoading = false,
  emptyMessage = "Kayıt yok",
  onRowClick,
  virtual = "auto",
  virtualThreshold = 60,
  estimatedRowHeight = 37,
  className,
}: DataGridProps<TData>) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;
  const isMultiSorted = table.state.sorting.length > 1;
  const totalSize = table.getTotalSize();

  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  /*
    SANALLASTIRMA YUKSEKLIK ISTIYOR.

    `height` verilmezse kaydirma kabi diye bir sey yok: sayfa kayiyor ve
    "gorunur alan" hesaplanamiyor. Bu durumda sanallastirmayi KAPATIYORUZ --
    yanlis calismasindansa hic calismamasi iyi. (Ayni gerekce yapiskan
    baslikta da vardi.)
  */
  const isVirtual =
    height !== undefined &&
    (virtual === true ||
      (virtual === "auto" && rows.length > virtualThreshold));

  const { virtualizer, items, paddingTop, paddingBottom } = useGridVirtualizer({
    scrollRef,
    rowCount: rows.length,
    estimateSize: estimatedRowHeight,
    enabled: isVirtual,
  });

  const visibleRows = isVirtual
    ? items.map((item) => ({
        row: rows[item.index] as Row<GridFeatures, TData>,
        index: item.index,
      }))
    : rows.map((row, index) => ({ row, index }));

  const keyboard = useGridKeyboard({
    gridRef,
    rowCount: rows.length,
    colCount: columnCount,
    scrollToRow: isVirtual
      ? (index) => virtualizer.scrollToIndex(index, { align: "auto" })
      : undefined,
    pageSize: 10,
  });

  return (
    <div
      ref={scrollRef}
      className={cn(
        /*
          `w-0 min-w-full` -- OLCULEN BIR TASMANIN DUZELTMESI.

          BELIRTI: izgara sayfasinda TUM SAYFA yatayda kayiyordu
          (`document.scrollWidth` 1521, pencere 1280). `/boards` sayfasinda
          boyle bir sey yoktu; yani sebep izgaraydi.

          SEBEP: kolonlarin toplam genisligi (1398px) pencereden genis. Bu
          normal ve zaten `overflow-auto` ile KAP ICINDE kaymasi gerekiyor.
          Ama kabin ustundeki `<main>` bir esnek (flex) oge ve `min-width`i
          `auto`: yani "icerigimden dar olamam" diyor. Icerik zinciri
          asagida tabloya kadar iniyor ve `<main>` 1265px'e siserek sayfayi
          tasiriyor.

          `w-full` bunu ENGELLEMIYOR: %100, ebeveynin sismis genisliginin
          %100'u oluyor.

          `width: 0` + `min-width: 100%` ikilisi zinciri kesiyor: taban
          genislik 0 oldugu icin ust katmanlara "genis olmam gerek" sinyali
          gitmiyor, ama `min-width: 100%` kabi ebeveynin tam genisligine
          getiriyor. Gorunum ayni, tasma yok.

          ALTERNATIF tuketicinin `<main>`ine `min-w-0` yazmakti -- calisiyor
          ama HER tuketiciye ayni tuzagi yasatirdi ve belirtisi (gizemli
          sayfa kaydirmasi) sebebiyle uzak. Bir kutuphane kendi tasmasini
          kendi kapatmali.
        */
        "relative w-0 min-w-full overflow-auto rounded-lg border bg-background",
        className,
      )}
      style={height === undefined ? undefined : { height }}
    >
      <GridTableEl
        ref={gridRef}
        role="grid"
        // Baslik satiri da sayiliyor: ekran okuyucu "satir 1" derken
        // basligi kastediyor, ilk kaydi degil.
        aria-rowcount={table.getRowCount() + 1}
        aria-colcount={columnCount}
        onKeyDown={keyboard.onKeyDown}
        className="table-fixed"
        /*
          GENISLIK: `min-width` KOLON TOPLAMI, `width` %100.

          OLCULEN PROBLEM: yalnizca `width: totalSize` yaziyordum ve kolonlar
          toplami kaptan darsa izgara SOLA YAPISIK, ekranin ucte birinde
          kaliyordu. Bildirilen hata buydu.

          `width: 100%` TEK BASINA da yanlis olurdu: `table-fixed` fazla alani
          TUM kolonlara oranli dagitir, boylece gercek genislikler TanStack'in
          bildiklerinden sapar ve dondurulmus kolon ofsetleri (`getStart`)
          kayar -- sabit kolonun altindan icerik gorunur.

          Cozum ikisi BIRLIKTE + sonda bir DOLGU HUCRESI: gercek kolonlar
          piksel genisliklerini korur, artan alani genisligi belirtilmemis
          dolgu hucresi yutar (`table-fixed`te genisligi verilmeyen kolon
          kalan alani alir).
        */
        style={{ width: "100%", minWidth: totalSize }}
      >
        {/*
          `z-30`: govdenin SABIT hucrelerinden (z-20) yuksek.

          Once `z-20` yaziyordu ve esitlik DOM sirasina gore cozulup govde
          kazaniyordu: asagi kaydirinca sabit iki kolon basligin uzerine
          cikiyordu. Ayrintili gerekce `core/pinning.ts` basinda.
        */}
        <GridHeader className="sticky top-0 z-30">
          {table.getHeaderGroups().map((group) => (
            <GridRow
              key={group.id}
              aria-rowindex={1}
              className="hover:bg-transparent"
            >
              {group.headers.map((header, colIndex) => (
                <GridColumnHeader
                  key={header.id}
                  header={header}
                  isMultiSorted={isMultiSorted}
                  showFilterButton={filterMode === "popup"}
                  colIndex={colIndex}
                  tabIndex={keyboard.getTabIndex(-1, colIndex)}
                  onFocus={() => keyboard.onCellFocus(-1, colIndex)}
                />
              ))}
              {/* Dolgu: gorunmez, genisligi yok, artan alani yutuyor. */}
              <GridHead aria-hidden="true" className="w-auto p-0" />
            </GridRow>
          ))}

          {filterMode === "row" && showFilterRow && (
            /*
              FILTRE SATIRI BASLIGIN ICINDE (`<thead>`), govdede degil.

              Iki sebep: (1) yapiskan baslikla BIRLIKTE kayiyor -- asagi
              kaydirdiginizda filtreler de ekranda kaliyor, ki bir filtreyi
              degistirmek icin en basa donmek zorunda kalmayasiniz;
              (2) anlamsal olarak dogru: filtre bir VERI satiri degil.
            */
            <GridRow className="hover:bg-transparent">
              {table.getVisibleLeafColumns().map((column) => {
                const edge = getPinnedEdge(column);
                const pinned = column.getIsPinned();

                return (
                  <GridHead
                    key={column.id}
                    style={getPinnedStyle(column, true)}
                    className={cn(
                      "h-auto p-1 font-normal",
                      pinned !== false && "bg-background",
                      edge === "start" &&
                        "shadow-[inset_-1px_0_0_0_var(--border)]",
                      edge === "end" &&
                        "shadow-[inset_1px_0_0_0_var(--border)]",
                    )}
                  >
                    <ColumnFilter column={column} />
                  </GridHead>
                );
              })}
              <GridHead aria-hidden="true" className="w-auto p-0" />
            </GridRow>
          )}
        </GridHeader>

        <GridBody
          className={cn(
            // YUKLENIRKEN ISKELET DEGIL SOLUKLASTIRMA.
            // Iskelet, ilk yuklemede dogru. Ama bir izgarada isteklerin cogu
            // SONRAKI yuklemedir (siralama, filtre, sayfa) ve orada iskelet
            // gostermek ekrandaki veriyi silip yerine gri kutular koymak
            // demek -- kullanici baglamini kaybeder. Mevcut satirlari solgun
            // birakip tiklamayi kesmek, degisenin ne oldugunu goruniyor tutar.
            isLoading && "pointer-events-none opacity-50 transition-opacity",
          )}
        >
          {rows.length === 0 ? (
            <GridRow className="hover:bg-transparent">
              <GridCell
                // +1 dolgu hucresi icin: eksik sayarsak bos durum mesaji
                // tabloyu tam kaplamaz ve sagda bos bir sutun kalir.
                colSpan={columnCount + 1}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </GridCell>
            </GridRow>
          ) : (
            <>
              {/* USTTEKI DOLGU: kaydirilip gecilmis satirlarin yuksekligi.
                  Mutlak konumlandirma yerine bunu kullanmamizin gerekcesi
                  `use-grid-virtualizer.ts` basinda. */}
              {paddingTop > 0 && (
                /*
                  DOLGU SATIRI: DUZ bir `<tr>`, ARIA yok. Artik SORUN DEGIL.

                  Once `aria-hidden`, sonra `role="presentation"` denenmisti;
                  linter ikisini de hakli olarak reddetti (`aria-hidden` bir
                  dali gizleyip iceride odaklanabilir tuzak birakabiliyor;
                  `<tr>`nin `row` rolunu `presentation`a cevirmek tablo
                  yapisini bozuyor).

                  Faz 7 bunu kokten cozdu: `aria-rowcount` TOPLAM kayit
                  sayisini, her gercek satirdaki `aria-rowindex` de GERCEK
                  sirasini tasiyor. Ekran okuyucu konumu artik DOM'daki satir
                  sayisindan degil, bu ozniteliklerden okuyor -- yani dolgu
                  satirlari sayimi bozamiyor. Kalan tek bedel iki bos satirin
                  okunmasi; sanallastirmanin kabul edilmis maliyeti.
                */
                <tr>
                  <td
                    colSpan={columnCount + 1}
                    style={{ height: paddingTop }}
                  />
                </tr>
              )}

              {visibleRows.map(({ row, index }) => (
                <DataGridRow
                  key={row.id}
                  row={row}
                  rowIndex={index}
                  onRowClick={onRowClick}
                  measureRef={
                    isVirtual ? virtualizer.measureElement : undefined
                  }
                  virtualIndex={isVirtual ? index : undefined}
                  keyboard={keyboard}
                  pageOffset={
                    table.state.pagination.pageIndex *
                    table.state.pagination.pageSize
                  }
                />
              ))}

              {paddingBottom > 0 && (
                <tr>
                  <td
                    colSpan={columnCount + 1}
                    style={{ height: paddingBottom }}
                  />
                </tr>
              )}
            </>
          )}
        </GridBody>

        {/*
          OZET SATIRI kolonlarda `meta.aggregate` varsa CIZILIYOR, ayri bir
          bayrak yok. Sebep: "toplansin" bilgisi zaten kolonda yaziyor;
          bir de `showSummary` istemek ayni niyeti iki yere yazdirmak olurdu
          ve biri unutuldugunda ortaya "toplam neden gorunmuyor?" cikardi.
        */}
        {tableHasSummary(table) && <GridSummaryRow table={table} />}
      </GridTableEl>
    </div>
  );
}

/**
 * Satir AYRI BIR BILESEN -- ve bunun sebebi `Subscribe`.
 *
 * Satirin secili olup olmadigini `row.getIsSelected()` ile okusaydim, React
 * Compiler bu okumayi GOREMEZDI: derleyici `row` nesnesinin metodunun icinde
 * ne okundugunu bilmiyor, yalnizca `row` referansinin degismedigini goruyor
 * ve satiri yeniden cizmeyi atliyor. Sonuc: kutuyu isaretlersiniz, satir
 * vurgulanmaz.
 *
 * `Subscribe` ile okuma ACIK bir abonelige donusuyor. Ustelik daha ucuz:
 * secim degistiginde yalnizca ILGILI satirlar yeniden ciziliyor, tablonun
 * tamami degil.
 *
 * (Bu, TanStack'in "react-compiler" rehberinde adi konmus bir tuzak. Paket
 * tuketicisinin React Compiler kullanip kullanmadigini bilemeyecegimiz icin
 * dogru olan, HER ZAMAN calisan bicimi yazmak.)
 */
function DataGridRow<TData extends RowData>({
  row,
  rowIndex,
  onRowClick,
  measureRef,
  virtualIndex,
  keyboard,
  pageOffset,
}: {
  row: Row<GridFeatures, TData>;
  /** Gorunen satirlar icindeki sira -- klavye adresi. */
  rowIndex: number;
  onRowClick?: (row: Row<GridFeatures, TData>) => void;
  /** Sanallastirma acikken satiri olcen geri cagirim. */
  measureRef?: (element: HTMLElement | null) => void;
  virtualIndex?: number;
  keyboard: ReturnType<typeof useGridKeyboard>;
  /** Sayfa basi kayma -- `aria-rowindex` TUM listedeki sirayi gostermeli. */
  pageOffset: number;
}) {
  return (
    <Subscribe
      source={row.table.atoms.rowSelection}
      selector={(selection) => selection[row.id] === true}
    >
      {(isSelected) => (
        <GridRow
          ref={measureRef}
          // `data-index` SART: TanStack Virtual, olctugu elemanin hangi
          // satir oldugunu bu oznitelikten okuyor. Olmazsa olcum sonucu
          // yanlis satira yazilir ve kaydirma zipplar.
          data-index={virtualIndex}
          /*
            `aria-rowindex` TUM listedeki sirayi tasiyor: sayfa kaymasi +
            baslik satiri (+2 cunku ARIA 1 tabanli ve 1 basligin).

            Sanallastirmada DOM'da 30 satir var ama kullanici 640 kayitlik
            listede; bu oznitelik olmadan ekran okuyucu konumu yanlis
            duyururdu.
          */
          aria-rowindex={pageOffset + rowIndex + 2}
          data-state={isSelected ? "selected" : undefined}
          onClick={onRowClick === undefined ? undefined : () => onRowClick(row)}
          className={cn(onRowClick !== undefined && "cursor-pointer")}
        >
          {row.getVisibleCells().map((cell, colIndex) => {
            const edge = getPinnedEdge(cell.column);
            const pinned = cell.column.getIsPinned();
            const align = cell.column.columnDef.meta?.align;

            return (
              <GridCell
                key={cell.id}
                style={getPinnedStyle(cell.column, false)}
                data-pinned={pinned || undefined}
                // Klavye adresi: `useGridKeyboard` hucreyi bununla buluyor.
                data-cell={`${rowIndex}:${colIndex}`}
                aria-colindex={colIndex + 1}
                tabIndex={keyboard.getTabIndex(rowIndex, colIndex)}
                onFocus={() => keyboard.onCellFocus(rowIndex, colIndex)}
                className={cn(
                  "truncate",
                  align !== undefined && ALIGN_CLASS[align],
                  // Yapiskan hucre saydam olamaz; altindan gecen satirlar
                  // gorunur. Satir vurgusunu kaybetmemek icin arka plan
                  // satirin durumuna gore degisiyor.
                  pinned !== false && "bg-background",
                  pinned !== false && isSelected && "bg-muted",
                  edge === "start" && "shadow-[inset_-1px_0_0_0_var(--border)]",
                  edge === "end" && "shadow-[inset_1px_0_0_0_var(--border)]",
                  // Odaklanan hucre GORUNUR olmali: klavye kullanicisi
                  // nerede oldugunu ancak boyle biliyor.
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                )}
              >
                {/*
                  GRUP SATIRINDA HANGI HUCRE CIZILIR?

                  - GRUPLANMIS kolon : grubun BASLIGI ("Aktif (15)").
                  - TOPLANMIS kolon  : ozet -- `FlexRender` bunu kendisi
                                       `aggregatedCell`e yonlendiriyor.
                  - GERI KALANI      : BOS.

                  Son madde IKI olculmus hatanin birden onlemi:

                  (1) Satir islemleri menusu grup basliginda da beliriyordu;
                      o satirin `row.original`i YOK, "Sil"e basmak tanimsiz
                      bir kayit uzerinde islem yapardi.

                  (2) Kart NUMARASI kolonu grup basliklarinda 91, 72, 78, 84
                      gosterdi -- kimlik numaralarinin TOPLAMI. Sebep:
                      TanStack'in varsayilan kolon tanimi `aggregationFn:
                      "auto"` ve sayisal her kolon kendini toplanabilir
                      saniyor. Bu yuzden karar `getIsAggregated()`e degil,
                      bizim `meta.aggregate`imize bakiyor (bkz.
                      `core/aggregate.ts`).

                  Istisna `meta.showOnGroupRow` ile ACIKCA isaretleniyor
                  (secim kutusu boyle: grup satirindaki kutu tum grubu secer).
                */}
                {cell.getIsGrouped() ? (
                  <GroupCell cell={cell} />
                ) : row.getIsGrouped() &&
                  !hasAggregate(cell.column) &&
                  cell.column.columnDef.meta?.showOnGroupRow !== true ? null : (
                  <FlexRender cell={cell} />
                )}
              </GridCell>
            );
          })}
          {/* Dolgu hucresi -- baslikta oldugu gibi artan alani yutuyor. */}
          <GridCell aria-hidden="true" className="w-auto p-0" />
        </GridRow>
      )}
    </Subscribe>
  );
}
