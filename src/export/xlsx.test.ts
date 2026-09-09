import { describe, expect, test } from "vitest";

import { fromCsv, toCsv } from "./csv";
import { columnLetter, fromXlsx, toXlsx } from "./xlsx";

/**
 * XLSX GIDIS-DONUS TESTLERI.
 *
 * Bir dosya bicimini elle yazdiginizda tek gercek soru sudur: URETTIGIN
 * DOSYAYI GERI OKUYABILIYOR MUSUN? Bu testler tam olarak onu soruyor --
 * yazip okuyup basta ne verdiysek onu bekliyoruz.
 *
 * KAPSAMAZ: Excel'in gercekten acabildigi. Bunu ancak bir masaustu Excel
 * acabilir. Kanitimiz spesifikasyona uygunluk + LibreOffice/Sheets'in ayni
 * bicimi kabul etmesi; kendi okuyucumuzun kendi dosyamizi okumasi
 * "spesifikasyona uyduk" demek DEGIL, yalnizca "tutarliyiz" demek. Bu sinir
 * bilincli olarak kaydediliyor.
 */

const toBuffer = async (blob: Blob): Promise<ArrayBuffer> => blob.arrayBuffer();

describe("xlsx", () => {
  describe("columnLetter", () => {
    test("Excel sütun adlandırması", () => {
      // 26 tabanli ama SIFIRSIZ bir sayi sistemi: 25 -> Z, 26 -> AA.
      // Duz 26 tabani yazan biri 26 icin "BA" uretir.
      expect(columnLetter(0)).toBe("A");
      expect(columnLetter(25)).toBe("Z");
      expect(columnLetter(26)).toBe("AA");
      expect(columnLetter(701)).toBe("ZZ");
      expect(columnLetter(702)).toBe("AAA");
    });
  });

  describe("gidiş-dönüş", () => {
    test("metin, sayı ve boş hücreler korunur", async () => {
      const rows = [
        ["Ad", "Tutar", "Not"],
        ["Ayşe Yılmaz", 1500, ""],
        ["Mehmet Çelik", 0, "açıklama"],
      ];

      const parsed = await fromXlsx(await toBuffer(toXlsx(rows)));

      expect(parsed[0]).toEqual(["Ad", "Tutar", "Not"]);
      expect(parsed[1]?.[0]).toBe("Ayşe Yılmaz");
      expect(parsed[1]?.[1]).toBe("1500");
      // 0 SAYISI ile BOS hucre farkli seyler: 0 yazilmali, bos kalmamali.
      expect(parsed[2]?.[1]).toBe("0");
    });

    test("Türkçe karakterler bozulmadan döner", async () => {
      // UTF-8 kodlama ZIP dosya adinda ve XML govdesinde ayri ayri
      // ayarlaniyor; biri unutulursa yalnizca Turkce metinlerde bozulma
      // olur ve bu ancak gercek veriyle fark edilir.
      const rows = [["Şehir"], ["İstanbul"], ["Çanakkale"], ["Iğdır"]];

      const parsed = await fromXlsx(await toBuffer(toXlsx(rows)));

      expect(parsed.map((row) => row[0])).toEqual([
        "Şehir",
        "İstanbul",
        "Çanakkale",
        "Iğdır",
      ]);
    });

    test("XML'i kıracak karakterler kaçırılır", async () => {
      // `<`, `&`, tirnak: kacirilmazsa dosya BOZUK olur ve Excel hic acmaz.
      // Kullanicinin verisinde bunlarin bulunmasi olagan ("A & B <şirket>").
      const rows = [["Metin"], ['A & B <şirket> "x"']];

      const parsed = await fromXlsx(await toBuffer(toXlsx(rows)));

      expect(parsed[1]?.[0]).toBe('A & B <şirket> "x"');
    });

    test("tarih SAYI olarak yazılır, ISO tarih olarak geri okunur", async () => {
      /*
        En kritik dönüşüm.

        Metin yazsaydik hucre METIN olurdu: Excel'de siralanamaz,
        filtrelenemez, tarih fonksiyonlarina girmez. Seri numara + tarih
        bicimi ile hucre gercekten TARIH oluyor.

        Geri okurken seri numarayi oldugu gibi vermek (`46023`) hicbir ise
        yaramaz; ISO'ya ceviriyoruz.
      */
      const rows: Array<Array<unknown>> = [["Tarih"], [new Date(2026, 0, 15)]];

      const parsed = await fromXlsx(await toBuffer(toXlsx(rows)));

      expect(parsed[1]?.[0]).toBe("2026-01-15");
    });

    test("BOŞ hücreli satırda sonraki kolonlar KAYMAZ", async () => {
      /*
        Elle yazilmis ayristiricilarin en klasik hatasi.

        Excel bos hucreleri dosyaya YAZMIYOR. Hucreleri sirayla okursak
        "A1, C1" olan bir satirda C'nin degeri B'ye duser ve o satirdan
        sonraki TUM kolonlar kayar. Konumu `r="C1"` ozniteliginden okumak
        zorunlu.
      */
      const rows = [
        ["A", "B", "C"],
        ["dolu", "", "üç"],
      ];

      const parsed = await fromXlsx(await toBuffer(toXlsx(rows)));

      expect(parsed[1]).toEqual(["dolu", "", "üç"]);
    });

    test("düzensiz satırlar (farklı uzunluk) çalışır", async () => {
      const rows = [["A", "B", "C"], ["x"], ["y", "z"]];

      const parsed = await fromXlsx(await toBuffer(toXlsx(rows)));

      expect(parsed[1]?.[0]).toBe("x");
      expect(parsed[2]?.[1]).toBe("z");
    });

    test("bozuk dosya AÇIK hata verir", async () => {
      // ZIP imzasi olmayan bir seyi ayristirmaya calismak sessizce bos
      // sonuc dondurseydi kullanici "dosyam bos geldi" derdi.
      const notAZip = new TextEncoder().encode("bu bir zip degil");

      await expect(fromXlsx(notAZip.buffer as ArrayBuffer)).rejects.toThrow(
        /ZIP|xlsx/i,
      );
    });
  });

  describe("SIKIŞTIRILMIŞ (deflate) dosya okuma", () => {
    /**
     * GERCEK EXCEL DOSYALARI SIKISTIRILMIS GELIYOR.
     *
     * Biz STORE (sikistirmasiz) yaziyoruz, yani kendi dosyalarimiz inflate
     * yolunu HIC calistirmiyor. Kullanicinin yukleyecegi dosyalar ise
     * neredeyse her zaman deflate'li -- yani en cok kullanilacak kod yolu
     * test edilmemis kalirdi.
     *
     * Bu test, ayni XML'leri deflate ile paketleyip okuyor: `readZip`in
     * `DecompressionStream` dali boylece gercekten sinaniyor.
     */
    const deflateZip = async (
      files: Array<{ name: string; text: string }>,
    ): Promise<ArrayBuffer> => {
      const encoder = new TextEncoder();
      // `Uint8Array<ArrayBuffer>`: `Blob` yalnizca bunu kabul ediyor
      // (gerekce `zip.ts`teki `Bytes` tipinde).
      const locals: Array<Uint8Array<ArrayBuffer>> = [];
      const centrals: Array<Uint8Array<ArrayBuffer>> = [];
      let offset = 0;

      // Test icin kucuk bir CRC32 -- uretim kodundan bagimsiz olmasi
      // KASITLI: ayni hatayi iki yerde yapip testin gecmesini istemiyoruz.
      const crc32 = (data: Uint8Array<ArrayBuffer>): number => {
        let crc = 0xff_ff_ff_ff;
        for (const byte of data) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xed_b8_83_20 & -(crc & 1));
          }
        }
        return (crc ^ 0xff_ff_ff_ff) >>> 0;
      };

      for (const file of files) {
        const raw = encoder.encode(file.text);
        // Uretim kodundaki `inflateRaw` ile ayni gerekce: `Blob.stream()`
        // jsdom'da yok, `ReadableStream` var.
        // `BufferSource`: `CompressionStream`in yazma tarafinin bekledigi tip.
        const source = new ReadableStream<BufferSource>({
          start(controller) {
            controller.enqueue(raw);
            controller.close();
          },
        });
        const reader = source
          .pipeThrough(new CompressionStream("deflate-raw"))
          .getReader();
        const chunks: Array<Uint8Array<ArrayBuffer>> = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          size += value.length;
        }
        const compressed = new Uint8Array(size);
        let cursor = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, cursor);
          cursor += chunk.length;
        }
        const nameBytes = encoder.encode(file.name);
        const crc = crc32(raw);

        const local = new Uint8Array(30 + nameBytes.length);
        const view = new DataView(local.buffer);
        view.setUint32(0, 0x04_03_4b_50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0x08_00, true);
        view.setUint16(8, 8, true); // 8 = DEFLATE
        view.setUint32(14, crc, true);
        view.setUint32(18, compressed.length, true);
        view.setUint32(22, raw.length, true);
        view.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        locals.push(local, compressed);

        const central = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(central.buffer);
        centralView.setUint32(0, 0x02_01_4b_50, true);
        centralView.setUint16(10, 8, true);
        centralView.setUint32(16, crc, true);
        centralView.setUint32(20, compressed.length, true);
        centralView.setUint32(24, raw.length, true);
        centralView.setUint16(28, nameBytes.length, true);
        centralView.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        centrals.push(central);

        offset += local.length + compressed.length;
      }

      const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
      const end = new Uint8Array(22);
      const endView = new DataView(end.buffer);
      endView.setUint32(0, 0x06_05_4b_50, true);
      endView.setUint16(8, files.length, true);
      endView.setUint16(10, files.length, true);
      endView.setUint32(12, centralSize, true);
      endView.setUint32(16, offset, true);

      return new Blob([...locals, ...centrals, end]).arrayBuffer();
    };

    test("deflate'li xlsx okunur ve PAYLAŞIMLI DİZE tablosu çözülür", async () => {
      /*
        Excel'in urettigi dosyalarin neredeyse tamami `sharedStrings.xml`
        kullaniyor (`t="s"` + indeks). Biz yazmiyoruz ama OKUMAK zorundayiz:
        okumasaydik metin kolonlari sayi (indeks) olarak gelirdi.
      */
      const buffer = await deflateZip([
        {
          name: "xl/sharedStrings.xml",
          text: '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Başlık</t></si><si><t>Değer &amp; Şey</t></si></sst>',
        },
        {
          name: "xl/worksheets/sheet1.xml",
          text: '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>42</v></c></row></sheetData></worksheet>',
        },
      ]);

      const parsed = await fromXlsx(buffer);

      expect(parsed[0]?.[0]).toBe("Başlık");
      expect(parsed[1]?.[0]).toBe("Değer & Şey");
      // C2 -- B atlanmis; kayma OLMAMALI.
      expect(parsed[1]?.[2]).toBe("42");
      expect(parsed[1]?.[1]).toBe("");
    });
  });

  describe("CSV ile aynı sözleşme", () => {
    test("iki biçim de DİZE döndürür", async () => {
      /*
        Ice aktarma sozlesmesi bicimden BAGIMSIZ olmali: tuketici
        `onImport` icinde CSV mi Excel mi geldigini bilmek zorunda
        kalmamali. Ikisi de dize donduruyor; donusum tuketicinin.
      */
      const rows = [
        ["Kod", "Adet"],
        ["0012", 5],
      ];

      const fromExcel = await fromXlsx(await toBuffer(toXlsx(rows)));
      const fromCsvRows = fromCsv(toCsv(rows));

      expect(fromExcel[1]?.[0]).toBe("0012");
      expect(fromCsvRows[1]?.[0]).toBe("0012");
      // "0012" SAYIYA CEVRILMEDI -- urun kodu olabilir, 12 yapmak veriyi bozar.
      expect(fromExcel[1]?.[0]).toBe(fromCsvRows[1]?.[0]);
    });
  });
});
