import type { RowData } from "@tanstack/react-table";
import {
  ChevronRightIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { GridTable } from "../core/use-grid-table";
import {
  type ExportFormat,
  type ExportScope,
  exportGrid,
} from "../export/export-grid";
import {
  applyImport,
  buildImportPreviewFromFile,
  type ImportPreview,
} from "../export/import-grid";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";
import {
  GridMenu,
  GridMenuContent,
  GridMenuItem,
  GridMenuLabel,
  GridMenuSeparator,
  GridMenuTrigger,
  GridSubmenu,
  GridSubmenuTrigger,
} from "../primitives/menu";

export interface GridExportButtonProps<TData extends RowData> {
  table: GridTable<TData>;
  filename?: string;
  /** Sunucu tarafli izgarada "tumu" secenegi icin. Bkz. `exportGrid`. */
  fetchAll?: () => Promise<TData[]>;
  onError?: (message: string) => void;
}

/**
 * DISA AKTARMA MENUSU.
 *
 * ---
 * NEDEN TEK DUGME DEGIL, MENU?
 *
 * "Disa aktar" dugmesi TEK BASINA belirsiz: neyi? Kullanici 4.812 kayitlik
 * bir listede 12 satiri sectiyse ve tek dugmeye basinca 4.812 satir inerse
 * bunu ancak dosyayi acinca anlar.
 *
 * Kapsami ACIKCA sordurmak, o hatayi tamamen kaldiriyor. Ayrica secenek
 * ETIKETLERI sayi tasiyor ("Seçili (12)") -- kullanici tiklamadan once ne
 * alacagini goruyor.
 */
export function GridExportButton<TData extends RowData>({
  table,
  filename,
  fetchAll,
  onError,
}: GridExportButtonProps<TData>) {
  const [isBusy, setIsBusy] = useState(false);

  const selectedCount = table.getSelectedRowModel().rows.length;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getRowModel().rows.length;
  const isServerSide = table.options.manualPagination === true;
  const totalCount = table.getRowCount();

  const run = (format: ExportFormat, scope: ExportScope) => {
    setIsBusy(true);
    exportGrid(table, { filename, scope, format, fetchAll })
      .catch((error: unknown) =>
        onError?.(
          error instanceof Error ? error.message : "Dışa aktarma başarısız",
        ),
      )
      .finally(() => setIsBusy(false));
  };

  /**
   * Kapsam ogeleri -- iki bicim icin de AYNI.
   *
   * Fonksiyon olarak uretiliyor cunku her bicimin kendi alt menusu var ve
   * listeyi kopyalasaydik biri degistiginde digeri unutulurdu.
   */
  const scopeItems = (format: ExportFormat) => (
    <>
      {selectedCount > 0 && (
        <GridMenuItem onClick={() => run(format, "selected")}>
          Seçili ({selectedCount})
        </GridMenuItem>
      )}

      <GridMenuItem onClick={() => run(format, "page")}>
        Bu sayfa ({pageCount})
      </GridMenuItem>

      {/*
        Sunucu modunda "filtrelenmis" secenegi YOK.

        Sunucu tarafinda `getFilteredRowModel()` yalnizca GECERLI SAYFAYI
        tasiyor -- "filtrelenmis hepsi" diye bir sey istemcide mevcut degil.
        Secenegi gostermek, "bu sayfa" ile ayni dosyayi farkli bir isimle
        sunmak olurdu.
      */}
      {!isServerSide && (
        <GridMenuItem onClick={() => run(format, "filtered")}>
          Filtrelenmiş ({filteredCount})
        </GridMenuItem>
      )}

      {(!isServerSide || fetchAll !== undefined) && (
        <GridMenuItem onClick={() => run(format, "all")}>
          Tümü ({totalCount})
        </GridMenuItem>
      )}
    </>
  );

  return (
    <GridMenu>
      <GridMenuTrigger
        render={<GridButton variant="outline" />}
        title="Dışa aktar"
        disabled={isBusy}
      >
        <DownloadIcon className="size-3.5" />
        Dışa aktar
      </GridMenuTrigger>

      <GridMenuContent>
        <GridMenuLabel>Biçim seç</GridMenuLabel>
        <GridMenuSeparator />

        {/*
          IKI EKSEN, IKI KATMAN: once BICIM, sonra KAPSAM.

          Duz listede 2 bicim × 4 kapsam = 8 oge olurdu ve kullanici ne
          secip ne secmedigini takip edemezdi. Alt menu eksenleri ayiriyor.

          Ikonlar da bilerek FARKLI: yesil tablo = Excel, duz belge = CSV.
          Yalnizca metin olsaydi ("CSV" / "Excel") ikisi de ayni agirlikta
          gorunur ve goz taramasi yavaslardi.
        */}
        <GridSubmenu>
          <GridSubmenuTrigger>
            <FileSpreadsheetIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
            Excel (.xlsx)
            <ChevronRightIcon className="ms-auto size-3.5 text-muted-foreground" />
          </GridSubmenuTrigger>
          <GridMenuContent side="right" align="start">
            {scopeItems("xlsx")}
          </GridMenuContent>
        </GridSubmenu>

        <GridSubmenu>
          <GridSubmenuTrigger>
            <FileTextIcon className="size-4 text-muted-foreground" />
            CSV (.csv)
            <ChevronRightIcon className="ms-auto size-3.5 text-muted-foreground" />
          </GridSubmenuTrigger>
          <GridMenuContent side="right" align="start">
            {scopeItems("csv")}
          </GridMenuContent>
        </GridSubmenu>
      </GridMenuContent>
    </GridMenu>
  );
}

export interface GridImportButtonProps<TData extends RowData> {
  table: GridTable<TData>;
  /**
   * Onaylanan satirlar. Degerlerin TAMAMI DIZE -- donusum cagirana ait.
   * Gerekce `import-grid.ts`de: "0012" bir urun kodu olabilir, tarih bicimi
   * belirsizdir; tahmin etmek sessizce yanlis veri yazmanin yaygin yolu.
   */
  onImport: (rows: Array<Record<string, string>>) => void | Promise<void>;
  delimiter?: string;
}

/**
 * ICE AKTARMA: dosya sec -> ONIZLE -> uygula.
 *
 * Onizleme adimi atlanamiyor. Ice aktarma geri alinamaz ve dosyayi baska
 * bir program uretti: kolon sirasi degismis, ayirici farkli, bir sutun
 * kaymis olabilir. Tek asamada uygulasaydik kullanici hatayi ancak
 * veritabaninda gorurdu.
 */
export function GridImportButton<TData extends RowData>({
  table,
  onImport,
  delimiter = ";",
}: GridImportButtonProps<TData>) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const readFile = async (file: File) => {
    // Bicim secimi dosya adindan; kullaniciya "CSV mi Excel mi?" diye
    // sormak, cevabini zaten bildigimiz bir soru olurdu.
    setPreview(await buildImportPreviewFromFile(table, file, delimiter));
  };

  const close = () => {
    setPreview(null);
    // Ayni dosyayi ikinci kez secebilmek icin girdiyi SIFIRLIYORUZ.
    // `<input type="file">` ayni degeri tekrar secince `change` olayi
    // uretmiyor; kullanici "dosyayi duzelttim, tekrar denedim, hicbir sey
    // olmadi" der.
    if (inputRef.current !== null) inputRef.current.value = "";
  };

  return (
    <>
      <GridButton
        variant="outline"
        onClick={() => inputRef.current?.click()}
        title="Excel (.xlsx) veya CSV içe aktar"
      >
        <UploadIcon className="size-3.5" />
        İçe aktar
      </GridButton>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        // `.xlsx` ONCE: dosya seciciler ilk uzantiyi varsayilan filtre
        // yapiyor ve kullanicilarin cogu Excel dosyasi yukluyor.
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) void readFile(file);
        }}
      />

      {preview !== null && (
        <ImportPreviewDialog
          preview={preview}
          onChange={setPreview}
          onCancel={close}
          onConfirm={async () => {
            await onImport(applyImport(preview));
            close();
          }}
        />
      )}
    </>
  );
}

function ImportPreviewDialog({
  preview,
  onChange,
  onCancel,
  onConfirm,
}: {
  preview: ImportPreview;
  onChange: (next: ImportPreview) => void;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const mappedCount = preview.mapping.filter(
    (item) => item.sourceHeader !== null,
  ).length;

  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * ESC ILE KAPATMA + ACILINCA ODAK.
   *
   * Ikisi de gerekli ve ikisi de linter uyarisi sayesinde fark edildi:
   * kapatmanin tek yolu ARKA PLANA TIKLAMAK ise klavye kullanicisi
   * diyalogdan cikamiyor. Simdi uc yol var: Esc, "Vazgeç" dugmesi,
   * arka plana tiklama.
   *
   * Odagi diyaloga almak da sart: aksi halde Tab tusu ARKADAKI sayfada
   * gezinmeye devam eder ve ekran okuyucu diyalogun acildigini duyurmaz.
   * (Tam odak tuzagi -- Tab'in diyalogun icinde donmesi -- henuz yok;
   * `aria-modal` ile ekran okuyucular zaten disariyi gizliyor.)
   */
  useEffect(() => {
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    // Yerli `<dialog>` DEGIL, konumlandirilmis bir katman: paketin zaten
    // bir diyalog ilkeline ihtiyaci yok ve `<dialog>`un `showModal()`
    // yasam dongusu React ile ayri bir senkronizasyon isi cikarirdi.
    // Arka plana tiklamak DEKORATIF bir kisayol: ayni islemin klavye
    // karsiligi Esc ve "Vazgeç" dugmesi (yukaridaki efekt). Kural, klavye
    // esdegeri OLMAYAN tiklama isleyicilerini hedefliyor; burada var.
    // biome-ignore lint/a11y/noStaticElementInteractions: kapatmanin klavye karşılığı Esc ve "Vazgeç" düğmesi
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="İçe aktarma önizlemesi"
        tabIndex={-1}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-popover p-4 text-popover-foreground shadow-lg outline-none ring-1 ring-foreground/10"
      >
        <h2 className="font-medium text-sm">İçe aktarma önizlemesi</h2>
        <p className="mt-1 text-muted-foreground text-xs">
          {preview.rows.length} satır okundu · {mappedCount}/
          {preview.mapping.length} kolon eşleşti
        </p>

        {preview.issues.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-md bg-amber-500/10 p-2 text-amber-600 text-xs dark:text-amber-400">
            {preview.issues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-2">
          <p className="font-medium text-xs">Kolon eşlemesi</p>
          {preview.mapping.map((item) => (
            <label
              key={item.id}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="truncate">{item.label}</span>
              <select
                value={item.sourceHeader ?? ""}
                onChange={(event) =>
                  onChange({
                    ...preview,
                    mapping: preview.mapping.map((row) =>
                      row.id === item.id
                        ? {
                            ...row,
                            sourceHeader:
                              event.target.value === ""
                                ? null
                                : event.target.value,
                          }
                        : row,
                    ),
                  })
                }
                className={cn(
                  "h-7 w-48 shrink-0 rounded-md border border-input bg-background px-1.5 text-foreground",
                  item.sourceHeader === null && "text-muted-foreground",
                )}
              >
                <option value="">— eşleme yok —</option>
                {preview.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {preview.rows.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="font-medium text-xs">
              {/* Ilk bes satir: dogrulamak icin yeterli, ekrani doldurmadan.
                  Tamamini gostermek 4.000 satirlik bir dosyada diyalogu
                  kullanilamaz hale getirirdi. */}
              İlk satırlar
            </p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {preview.headers.map((header) => (
                      <th
                        key={header}
                        className="px-2 py-1 text-left font-medium"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, rowIndex) => (
                    // Ham CSV satirlarinin kararli bir kimligi yok; onizleme
                    // salt okunur ve siralanmiyor, indeks burada guvenli.
                    // biome-ignore lint/suspicious/noArrayIndexKey: ham CSV satirinin kimligi yok, liste salt okunur
                    <tr key={rowIndex} className="border-t">
                      {preview.headers.map((header, cellIndex) => (
                        <td key={header} className="truncate px-2 py-1">
                          {row[cellIndex] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <GridButton variant="outline" onClick={onCancel}>
            Vazgeç
          </GridButton>
          <GridButton
            variant="outline"
            className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            onClick={() => void onConfirm()}
            disabled={mappedCount === 0}
          >
            {preview.rows.length} satırı aktar
          </GridButton>
        </div>
      </div>
    </div>
  );
}
