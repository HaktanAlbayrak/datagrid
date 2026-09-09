/**
 * KUCUK BIR ZIP YAZICI/OKUYUCU -- BAGIMLILIKSIZ.
 *
 * `.xlsx` bir ZIP arsividir; Excel destegi icin once ZIP'e ihtiyacimiz var.
 *
 * ---
 * NEDEN JSZip / fflate DEGIL?
 *
 * Ikisi de iyi kutuphaneler ama bir IZGARA paketine 30-90 KB eklemek, o
 * paketi kullanan HERKESE Excel bedelini odetmek demek -- CSV yeter diyenlere
 * bile. "Istege bagli bagimlilik" (`optionalDependencies` + dinamik `import`)
 * denedigimde ise Next/Turbopack'te DERLEME hatasi cikiyor: paketleyici
 * kurulu olmayan modulu cozemeyip yapiyi kiriyor. Yani "istege bagli"
 * pratikte istege bagli olmuyor.
 *
 * Kalan iki secenek: Excel'i hic desteklememek ya da kendimiz yazmak.
 * Ihtiyacimiz olan ZIP yuzeyi cok dar oldugu icin ikincisi makul:
 *
 *   YAZARKEN sikistirma YOK (STORE/method 0). Sikistirma algoritmasi
 *   (DEFLATE) yazmak gercekten buyuk bir is; sikistirmamak ise ZIP
 *   standardinin izin verdigi bir secenek. Excel, LibreOffice ve Google
 *   Sheets sikistirilmamis .xlsx dosyalarini sorunsuz aciyor. Bedeli dosya
 *   boyutu -- XML cok tekrarli oldugu icin ~3-4 kat buyuk. 10.000 satirlik
 *   bir disa aktarmada ~2 MB yerine ~7 MB; kabul edilebilir.
 *
 *   OKURKEN sikistirma cozme LAZIM (Excel'in urettigi dosyalar deflate'li).
 *   Bunu da yazmiyoruz: tarayicinin YERLESIK `DecompressionStream` API'si
 *   yapiyor. Chrome 103+, Safari 16.4+, Firefox 113+, Node 18+.
 *
 * SINIR: cok buyuk dosyalar (>100 MB) icin akisli bir cozum gerekir. O gun
 * geldiginde bir kutuphane eklenir; bugun eklemek "ileride lazim olur"
 * bagimliligi olur.
 */

/**
 * `Uint8Array<ArrayBuffer>` -- suslu parantezli hali BILINCLI.
 *
 * TypeScript 5.7'den beri `Uint8Array` bir jenerik: destegi `ArrayBuffer` ya
 * da `SharedArrayBuffer` olabiliyor. `Blob` yalnizca ilkini kabul ediyor.
 * Duz `Uint8Array` yazarsak derleyici "SharedArrayBuffer da olabilir" deyip
 * `Blob`a vermemize izin vermiyor. Daraltmak, her cagri yerinde tip
 * donusumu yazmaktan temiz.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

export interface ZipEntry {
  name: string;
  data: Bytes;
}

// ------------------------------------------------------------------ CRC32

/**
 * CRC32 tablosu -- ZIP her dosya icin bunu istiyor.
 *
 * Tablo BIR KEZ uretiliyor (`lazy`): modul yuklenirken hesaplamak, Excel'i
 * hic kullanmayan bir sayfada bosuna 256 dongu demek.
 */
let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable !== null) return crcTable;

  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  crcTable = table;
  return table;
}

function crc32(data: Bytes): number {
  const table = getCrcTable();
  let crc = 0xff_ff_ff_ff;

  for (let index = 0; index < data.length; index += 1) {
    // biome-ignore lint/style/noNonNullAssertion: sabit 256'lik tablo, indeks maskeleniyor
    crc = table[(crc ^ (data[index] as number)) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

// ------------------------------------------------------------------ yazma

/**
 * MS-DOS tarih/saat bicimi -- ZIP'in 1980'den kalma mirasi.
 *
 * Yil 1980'den kucukse tasma olur; Excel bozuk tarih gosterir. Bu yuzden
 * alt sinira kirpiyoruz.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const now = dosDateTime(new Date());

  const locals: Bytes[] = [];
  const centrals: Bytes[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04_03_4b_50, true); // yerel dosya basligi imzasi
    localView.setUint16(4, 20, true); // gereken surum
    // 0x0800 = dosya adi UTF-8. Bu bit olmadan Turkce dosya adlari
    // Windows'ta bozuk gorunuyor.
    localView.setUint16(6, 0x08_00, true);
    localView.setUint16(8, 0, true); // yontem 0 = STORE
    localView.setUint16(10, now.time, true);
    localView.setUint16(12, now.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true); // sikistirilmis boyut
    localView.setUint32(22, size, true); // ham boyut (STORE'da ayni)
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true); // ek alan yok
    local.set(nameBytes, 30);

    locals.push(local, entry.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02_01_4b_50, true); // merkezi dizin imzasi
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x08_00, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, now.time, true);
    centralView.setUint16(14, now.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true); // yerel basligin konumu
    central.set(nameBytes, 46);

    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06_05_4b_50, true); // merkezi dizin sonu
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...locals, ...centrals, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ------------------------------------------------------------------ okuma

/**
 * ZIP'i cozer. Excel'in urettigi dosyalar DEFLATE'li geliyor.
 *
 * Cozme isini tarayicinin `DecompressionStream`ine birakiyoruz -- kendi
 * INFLATE'imizi yazmak, sikistirmamaktan cok daha buyuk bir is ve
 * platformda zaten hazir bir uygulama var.
 */
async function inflateRaw(data: Bytes): Promise<Bytes> {
  /*
    `Blob.stream()` ve `Response` KULLANMIYORUZ -- bilincli.

    Ikisi de tarayicida var ama jsdom'da (testler) `Blob.stream()` YOK ve
    kod sessizce test edilemez hale geliyordu. `ReadableStream` +
    `DecompressionStream` her iki ortamda da mevcut; parcalari elle
    birlestirmek birkac satir fazla ama kodu HER YERDE calisir kiliyor.

    Test edilemeyen kod, en cok kullanilacak yolun (Excel'in urettigi
    sikistirilmis dosyalar) hic sinanmamasi demekti.
  */
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const reader = source
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export async function readZip(
  buffer: ArrayBuffer,
): Promise<Map<string, Bytes>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  /*
    MERKEZI DIZINI SONDAN ARIYORUZ.

    ZIP'i bastan okumak MUMKUN DEGIL: dosya boyutlari yerel baslikta
    olmayabiliyor (akisli yazicilar 0 yazip sonrasina "data descriptor"
    koyuyor). Tek guvenilir giris noktasi sondaki "merkezi dizin sonu"
    kaydi. Yorum alani yuzunden tam sonda olmayabilir; geriye dogru
    tariyoruz (yorum en fazla 65535 bayt).
  */
  let endOffset = -1;
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06_05_4b_50) {
      endOffset = index;
      break;
    }
  }

  if (endOffset === -1) {
    throw new Error("Geçerli bir ZIP/xlsx dosyası değil");
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);

  const decoder = new TextDecoder();
  const files = new Map<string, Bytes>();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02_01_4b_50) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);

    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );

    // Yerel basliktaki ad/ek alan uzunluklari MERKEZI dizindekinden
    // FARKLI olabiliyor; veri konumu icin yereli okumak zorundayiz.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    files.set(name, method === 0 ? raw : await inflateRaw(raw));

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}
