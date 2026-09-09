import type { RowData } from "@tanstack/react-table";

import type { GridTable } from "../core/use-grid-table";
import { fromCsv } from "./csv";
import { fromXlsx } from "./xlsx";

export interface ImportColumn {
  /** Kolon kimligi (`column.id`). */
  id: string;
  /** Ekranda gorunen baslik. */
  label: string;
  /** Dosyadaki hangi baslik bu kolona esleniyor? `null` = eslenmedi. */
  sourceHeader: string | null;
}

export interface ImportPreview {
  /** Dosyanin ilk satirindan okunan basliklar. */
  headers: string[];
  /** Kolon eslemesi -- kullanici degistirebiliyor. */
  mapping: ImportColumn[];
  /** Ham satirlar (baslik HARIC). */
  rows: string[][];
  /** Ayristirma sirasinda fark edilen sorunlar. */
  issues: string[];
}

/**
 * Turkce metni karsilastirma icin normalize eder.
 *
 * `toLocaleLowerCase("tr")` SART, `toLowerCase()` DEGIL: Turkcede
 * "I" -> "ı" ve "İ" -> "i". Ingilizce kucultme "İSİM"i "i̇si̇m" yapar ve
 * "isim" ile eslesmez. Baslik eslestirme tam da bu tur sozcuklerde calisiyor
 * ("Bütçe", "İşlem", "Kişi").
 *
 * Ayrica aksanlari ve bosluk/tireleri atiyoruz ki "Son Tarih", "son_tarih"
 * ve "sontarih" ayni sey sayilsin.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, "");
}

/**
 * CSV METNINI ONIZLEMEYE CEVIRIR -- HENUZ HICBIR SEY YAZMIYOR.
 *
 * ---
 * NEDEN IKI ASAMA (once onizleme, sonra uygula)?
 *
 * Ice aktarma GERI ALINAMAZ bir islem ve girdiyi kullanici degil BASKA bir
 * program uretti. Dosyanin kolon sirasi degismis, ayirici farkli, bir sutun
 * kaymis olabilir. Tek asamada uygulasaydik kullanici hatayi ancak
 * veritabaninda gorurdu.
 *
 * Onizleme, "sunu sununla eslestirdim, ilk bes satir soyle gorunuyor,
 * onayliyor musun?" diye soruyor. Excel'in ice aktarma sihirbazinin
 * varlik sebebi de bu.
 *
 * ---
 * BASLIK ESLESTIRME OTOMATIK BASLIYOR, KILITLI DEGIL.
 *
 * Cogu dosya bizim urettigimiz dosya (disa aktar -> duzenle -> geri yukle),
 * yani basliklar zaten tutuyor. Otomatik esleme o yaygin durumu sifir
 * tiklamaya indiriyor; tutmayan alanlari kullanici elle secebiliyor.
 */
export function buildImportPreview<TData extends RowData>(
  table: GridTable<TData>,
  text: string,
  delimiter = ";",
): ImportPreview {
  return buildPreviewFromRows(table, fromCsv(text, delimiter), delimiter);
}

/**
 * .xlsx dosyasindan onizleme.
 *
 * CSV yolundan TEK farki ayristirma; kolon eslestirme, uyarilar ve
 * uygulama mantigi AYNI fonksiyonlarda. Iki ayri boru hatti yazsaydik
 * "Excel'de eslesme calismiyor ama CSV'de calisiyor" turunden hatalar
 * kacinilmaz olurdu.
 */
export async function buildImportPreviewFromXlsx<TData extends RowData>(
  table: GridTable<TData>,
  buffer: ArrayBuffer,
): Promise<ImportPreview> {
  return buildPreviewFromRows(table, await fromXlsx(buffer), null);
}

/**
 * Dosya adina gore dogru ayristiriciyi secer.
 *
 * Uzantiya bakiyoruz, ICERIGE degil. Icerik tespiti (ZIP imzasi arama)
 * daha "akilli" olurdu ama yaniltici: kullanicinin `.csv` diye kaydettigi
 * bir dosya gercekten CSV'dir ve bizim onu Excel sanmamiz kafa karistirir.
 */
export async function buildImportPreviewFromFile<TData extends RowData>(
  table: GridTable<TData>,
  file: File,
  delimiter = ";",
): Promise<ImportPreview> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    return buildImportPreviewFromXlsx(table, await file.arrayBuffer());
  }

  return buildImportPreview(table, await file.text(), delimiter);
}

function buildPreviewFromRows<TData extends RowData>(
  table: GridTable<TData>,
  parsed: string[][],
  /** CSV ise ayirici, Excel ise `null` (ayirici uyarisi anlamsiz). */
  delimiter: string | null,
): ImportPreview {
  const issues: string[] = [];

  if (parsed.length === 0) {
    return { headers: [], mapping: [], rows: [], issues: ["Dosya boş."] };
  }

  const [headers = [], ...rows] = parsed;

  /**
   * TEK SUTUNLU SONUC = MUHTEMELEN YANLIS AYIRICI.
   *
   * Sessizce devam etseydik kullanici "her sey ilk kolona doldu" derdi ve
   * sebebini bulmasi zor olurdu. Ayirici, ulkeye gore degisen bir seydir;
   * uyarmak zorundayiz.
   */
  if (delimiter !== null && headers.length === 1 && rows.length > 0) {
    issues.push(
      `Tek sütun bulundu. Ayırıcı "${delimiter}" doğru mu? (Türkçe Excel ";", İngilizce "," kullanır.)`,
    );
  }

  const importable = table
    .getAllLeafColumns()
    .filter((column) => column.accessorFn !== undefined);

  const mapping: ImportColumn[] = importable.map((column) => {
    const label =
      typeof column.columnDef.header === "string"
        ? column.columnDef.header
        : column.id;

    const candidates = [
      label,
      column.id,
      ...(column.columnDef.meta?.importAliases ?? []),
    ].map(normalize);

    const match = headers.find((header) =>
      candidates.includes(normalize(header)),
    );

    return { id: column.id, label, sourceHeader: match ?? null };
  });

  const unmapped = mapping.filter((item) => item.sourceHeader === null);
  if (unmapped.length > 0) {
    issues.push(
      `Eşleşmeyen kolon: ${unmapped.map((item) => item.label).join(", ")}`,
    );
  }

  // Baslik sayisiyla uyusmayan satirlar: bir hucrede kacilmamis ayirici
  // olabilir. Satiri ATMIYORUZ (kullanici karar versin) ama sayisini
  // soyluyoruz -- sessizce bozuk veri yazmaktan iyi.
  const ragged = rows.filter((row) => row.length !== headers.length).length;
  if (ragged > 0) {
    issues.push(`${ragged} satırın sütun sayısı başlıkla uyuşmuyor.`);
  }

  return { headers, mapping, rows, issues };
}

/**
 * Onizlemeyi nesne dizisine cevirir.
 *
 * DONUSUM YAPMIYORUZ -- her deger DIZE olarak kaliyor.
 *
 * Once sayilari ve tarihleri otomatik cevirmeyi dusundum ve vazgectim:
 * "0012" bir urun kodu olabilir, sayiya cevirmek onu 12 yapar; "01.02.2026"
 * gun/ay mi ay/gun mu belirsiz. Tahmin etmek, sessizce yanlis veri yazmanin
 * en yaygin yolu.
 *
 * Donusum, alanlarin ANLAMINI bilen tarafta olmali: tuketici `onImport`
 * icinde kendi semasiyla (zod vb.) ayristirir ve hatalari kullaniciya
 * gosterir. Paket, dosyayi dogru okumaktan sorumlu; ne anlama geldiginden degil.
 */
export function applyImport(
  preview: ImportPreview,
): Array<Record<string, string>> {
  const indexByColumn = new Map<string, number>();
  for (const item of preview.mapping) {
    if (item.sourceHeader === null) continue;
    const index = preview.headers.indexOf(item.sourceHeader);
    if (index !== -1) indexByColumn.set(item.id, index);
  }

  return (
    preview.rows
      // Tamamen bos satirlari atiyoruz: dosya sonundaki bos satir cok yaygin
      // ve her ice aktarmada bir bos kayit uretmek anlamsiz.
      .filter((row) => row.some((cell) => cell.trim() !== ""))
      .map((row) => {
        const record: Record<string, string> = {};
        for (const [columnId, index] of indexByColumn) {
          record[columnId] = row[index] ?? "";
        }
        return record;
      })
  );
}
