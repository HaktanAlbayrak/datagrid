/**
 * CSV YAZMA VE OKUMA -- BAGIMLILIKSIZ.
 *
 * ---
 * NEDEN HAZIR BIR KUTUPHANE (papaparse vb.) DEGIL?
 *
 * papaparse ~45 KB ve akis (streaming), otomatik tip cikarimi, worker
 * destegi gibi bizim kullanmadigimiz seyler tasiyor. Bir izgaranin ihtiyaci
 * olan CSV yuzeyi kucuk ve TAM OLARAK belirli: RFC 4180 alintilama, satir
 * sonu, BOM. Bunu 80 satirda dogru yazmak, tuketicinin paketine 45 KB
 * eklemekten iyi.
 *
 * SINIR: cok buyuk dosyalar (>50 MB) icin akisli bir cozumelim gerekir.
 * O gun geldiginde papaparse eklenir; bugun eklemek "ileride lazim olur"
 * bagimliligi olur.
 */

/** Excel'in UTF-8'i tanimasi icin bayt sirasi isareti. */
const BOM = "﻿";

/**
 * Bir hucreyi CSV icin alintiler.
 *
 * Kural (RFC 4180): ayirici, cift tirnak ya da satir sonu iceren alanlar
 * tirnaga alinir; ic tirnaklar IKIYE katlanir.
 *
 * `\r` de kontrol ediliyor: Windows'ta uretilmis metinlerde satir sonu
 * `\r\n` ve yalnizca `\n` aransaydi alan ortasindaki `\r` kacar, dosya
 * baska bir programda bozuk acilirdi.
 */
function quote(value: unknown, delimiter: string): string {
  if (value === null || value === undefined) return "";

  const text = value instanceof Date ? value.toISOString() : String(value);

  const needsQuote =
    text.includes(delimiter) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r") ||
    // Bas/son bosluk tirnaksiz yazilirsa okurken kaybolur.
    text !== text.trim();

  return needsQuote ? `"${text.replaceAll('"', '""')}"` : text;
}

export interface CsvOptions {
  /**
   * Alan ayirici.
   *
   * TURKCE EXCEL ICIN `;` GEREKIR ve bu bir kapris degil: Turkce yerelde
   * ondalik ayirici virguldur (`1,5`), bu yuzden Excel CSV'yi noktali
   * virgulle ayirir. Virgul kullanirsak "1,5" iki hucreye bolunur ve
   * kullanici sayilarin dagildigini gorur.
   */
  delimiter?: string;
  /** Excel'in UTF-8 tanimasi icin BOM ekle. Turkce karakterler icin sart. */
  bom?: boolean;
}

export function toCsv(
  rows: Array<Array<unknown>>,
  { delimiter = ";", bom = true }: CsvOptions = {},
): string {
  const body = rows
    .map((row) => row.map((cell) => quote(cell, delimiter)).join(delimiter))
    // `\r\n`: Excel ve eski Windows araclari yalnizca `\n` gorunce butun
    // dosyayi tek satir sayabiliyor.
    .join("\r\n");

  return (bom ? BOM : "") + body;
}

/**
 * CSV metnini satir/hucre dizisine cevirir.
 *
 * Elle yazilmis bir ayristirici -- `text.split(",")` DEGIL. Fark, alintilanmis
 * alanlarda ortaya cikiyor: `"Ankara, Türkiye";42` satirini `split` uc parcaya
 * bolerdi. Durum makinesi tirnak icinde olup olmadigimizi takip ediyor.
 */
export function fromCsv(text: string, delimiter = ";"): string[][] {
  const source = text.startsWith(BOM) ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        // Iki tirnak yan yana -> kacisli tek tirnak, alan devam ediyor.
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  // Son alan/satir: dosya satir sonuyla bitmeyebilir.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Uretilen metni dosya olarak indirir.
 *
 * `URL.revokeObjectURL` SART: her indirme bir blob URL'i olusturuyor ve
 * iptal edilmeyen blob sekme kapanana kadar bellekte kaliyor. Kullanici
 * gun boyu rapor indiren biriyse sizinti gercek.
 */
export function downloadFile(
  filename: string,
  content: string | Blob,
  mimeType = "text/csv;charset=utf-8",
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
