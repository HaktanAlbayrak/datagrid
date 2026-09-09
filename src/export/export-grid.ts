import type { Row, RowData } from "@tanstack/react-table";

import type { GridFeatures } from "../core/features";
import type { GridTable } from "../core/use-grid-table";
import { type CsvOptions, downloadFile, toCsv } from "./csv";
import { toXlsx } from "./xlsx";

/** Disa aktarmada hangi satirlar? */
export type ExportScope = "page" | "filtered" | "selected" | "all";

/**
 * Dosya bicimi.
 *
 * CSV her yerde acilir ve bagimliliksiz. XLSX ise TIP BILGISINI koruyor:
 * sayilar sayi, tarihler tarih olarak kaliyor; kullanici dosyayi acar acmaz
 * siralayabiliyor ve formul yazabiliyor. CSV'de her sey metin -- Excel
 * tahmin etmeye calisir ve "0012" yi 12 yapar, "1.5" i tarihe cevirir.
 */
export type ExportFormat = "csv" | "xlsx";

export interface ExportOptions<TData extends RowData> extends CsvOptions {
  filename?: string;
  scope?: ExportScope;
  format?: ExportFormat;
  /**
   * SUNUCU TARAFLI VERIDE tum kayitlari getiren fonksiyon.
   *
   * `manualPagination` kullanan bir izgarada istemcinin elinde YALNIZCA
   * gecerli sayfa var. "Tumunu disa aktar" derken 25 satir yazmak SESSIZ bir
   * veri kaybi olurdu: kullanici 4.812 kayit bekliyor, dosyayi acinca 25
   * goruyor ve bunu fark etmesi icin saymasi gerekiyor.
   *
   * Bu yuzden sunucu modunda `scope: "all"` bu fonksiyon OLMADAN CALISMAZ --
   * eksik dosya uretmektense acikca hata veriyoruz.
   */
  fetchAll?: () => Promise<TData[]>;
}

/**
 * IZGARAYI DISA AKTARIR (CSV ya da XLSX).
 *
 * Adi `exportGridToCsv` degil: Excel eklendikten sonra o ad YANLIS bilgi
 * verirdi ve kullanan biri "xlsx icin baska bir fonksiyon var mi?" diye
 * arardi. Bicim bir SECENEK, ayri bir fonksiyon degil -- ikisi ayni satir
 * dizisinden uretiliyor.
 *
 * ---
 * KOLON SECIMI: EKRANDA GORUNENLER, TANIMLI OLANLAR DEGIL.
 *
 * Kullanici uc kolonu gizlediyse dosyada da olmamalilar. "Ne gorduysem onu
 * indirdim" beklentisi, disa aktarmanin en temel sozlesmesi.
 *
 * `display` kolonlari (secim kutusu, islem menusu) DISLANIYOR: veri
 * tasimiyorlar, Excel'de "[object Object]" olurlardi. Ayirt etme yolu
 * `accessorFn`in varligi.
 *
 * ---
 * DEGERLER `getValue()` ILE, `cell` CIZICISIYLE DEGIL.
 *
 * `cell` bir React elemani doner (rozet, ikon, bicimlenmis para). Onu metne
 * cevirmek ya imkansiz ya yaniltici. Ham deger Excel'de SAYI olarak kaliyor
 * ve uzerinde islem yapilabiliyor; "₺455.167" bir METIN olurdu ve toplanamazdi.
 *
 * Ozel bicim gerekirse kolon `meta.exportValue` verir.
 */
export async function exportGrid<TData extends RowData>(
  table: GridTable<TData>,
  {
    filename,
    scope = "filtered",
    format = "csv",
    fetchAll,
    ...csvOptions
  }: ExportOptions<TData> = {},
): Promise<void> {
  // Uzanti BICIME gore: `.csv` uzantili bir xlsx dosyasi Excel'de "bicim
  // uyusmuyor" uyarisi veriyor ve kullanici dosyanin bozuk oldugunu saniyor.
  const name = filename ?? `izgara.${format}`;
  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef.meta?.export !== false)
    .filter((column) => column.accessorFn !== undefined);

  const header = columns.map((column) =>
    typeof column.columnDef.header === "string"
      ? column.columnDef.header
      : column.id,
  );

  const isServerSide = table.options.manualPagination === true;

  /**
   * SUNUCU MODUNDA "tumu": veriyi CAGIRANDAN aliyoruz ve satir modelinden
   * DEGIL, ham nesnelerden okuyoruz. `accessorFn` tam bunun icin var --
   * `Row` nesnesi olmadan da kolonun degerini uretebiliyor.
   */
  if (isServerSide && scope === "all") {
    if (fetchAll === undefined) {
      throw new Error(
        'Sunucu taraflı ızgarada scope:"all" için `fetchAll` gerekli — ' +
          "aksi halde yalnızca görünen sayfa dışa aktarılırdı.",
      );
    }

    const all = await fetchAll();
    const rows = all.map((item, index) =>
      columns.map((column) => {
        const raw = column.accessorFn?.(item, index);
        const custom = column.columnDef.meta?.exportValue;
        return custom === undefined ? raw : custom(raw, item);
      }),
    );

    write(name, format, [header, ...rows], csvOptions);
    return;
  }

  const rows = pickRows(table, scope).map((row) =>
    columns.map((column) => {
      const custom = column.columnDef.meta?.exportValue;
      return custom === undefined
        ? row.getValue(column.id)
        : custom(row.getValue(column.id), row.original);
    }),
  );

  write(name, format, [header, ...rows], csvOptions);
}

/**
 * Secilen bicimde dosyayi uretip indirir.
 *
 * CSV ve XLSX ayni satir dizisinden uretiliyor; fark yalnizca serilestirme.
 * Iki ayri "disa aktar" fonksiyonu yazsaydik kolon secimi, `exportValue`
 * kancasi ve kapsam mantigi ikizlenirdi.
 */
function write(
  filename: string,
  format: ExportFormat,
  rows: Array<Array<unknown>>,
  csvOptions: CsvOptions,
): void {
  if (format === "xlsx") {
    downloadFile(
      filename,
      toXlsx(rows),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    return;
  }

  downloadFile(filename, toCsv(rows, csvOptions));
}

/**
 * Kapsama gore satirlari secer.
 *
 * `all` ile `filtered` FARKLI: `all` filtreleri yok sayar (`getCoreRowModel`),
 * `filtered` kullanicinin daralttigi kumeyi verir. Ikisini karistirmak
 * "filtreledim ama her sey geldi" sikayetinin kaynagidir.
 */
function pickRows<TData extends RowData>(
  table: GridTable<TData>,
  scope: ExportScope,
): Array<Row<GridFeatures, TData>> {
  if (scope === "page") return table.getRowModel().rows;
  if (scope === "selected") return table.getSelectedRowModel().rows;
  if (scope === "all") return table.getCoreRowModel().rows;
  return table.getFilteredRowModel().rows;
}
