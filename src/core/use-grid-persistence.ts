import type { RowData } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type GridStorage, localStorageAdapter } from "./grid-storage";
import type { GridTable } from "./use-grid-table";

/**
 * Kaydedilebilen durum dilimleri.
 *
 * Liste KAPALI (birlesim tipi, `string` degil): yazim hatasi derleme
 * zamaninda yakalanmali. `"colummSizing"` yazan biri, calisma zamaninda
 * "neden kaydetmiyor?" diye saatlerce bakardi.
 */
export type PersistedSlice =
  | "columnSizing"
  | "columnOrder"
  | "columnVisibility"
  | "columnPinning"
  | "sorting"
  | "grouping"
  | "pageSize"
  | "columnFilters"
  | "globalFilter";

/**
 * VARSAYILAN KUME -- ve burada iki BILINCLI DISLAMA var.
 *
 * ---
 * FILTRELER VARSAYILAN OLARAK KAYDEDILMIYOR.
 *
 * Kullanici dun 640 kaydi 12'ye indiren bir filtre kurup sekmeyi kapatiyor.
 * Bugun izgarayi aciyor ve 12 kayit goruyor. Filtreyi kendi kurdugunu
 * hatirlamiyor; gordugu sey "verilerim kayboldu". Bu, destek kayitlarinin
 * klasik bir sinifi ve sebebini bulmak kullanici icin neredeyse imkansiz --
 * cunku ekranda "bir filtre acik" diyen bir sey yok, yalnizca eksik veri var.
 *
 * Kolon duzeni ise tam tersi: KALICI olmasi beklenen bir sey. Genisligini
 * ayarladiginiz kolonun ertesi gun eski haline donmesi, isi iki kez
 * yaptirmak demek.
 *
 * Ayrim su: GORUNUMU degistiren sey kaydedilir, VERIYI degistiren sey
 * kaydedilmez. Filtre isteyen `include`a ekliyor -- ama bilerek.
 *
 * ---
 * `pageIndex` HIC KAYDEDILMIYOR (`include`a bile alinamiyor).
 *
 * "7. sayfa" bir tercih degil, gecici bir konum. Ustelik veri degistiyse
 * yarin ayni 7. sayfa BASKA kayitlari gosterir; kullaniciyi hicbir sey
 * hatirlamadigi bir yere birakmak yon kaybi uretir. `pageSize` ("ben 100
 * satir gormek isterim") gercek bir tercih ve kaydediliyor.
 */
const DEFAULT_SLICES: PersistedSlice[] = [
  "columnSizing",
  "columnOrder",
  "columnVisibility",
  "columnPinning",
  "sorting",
  "grouping",
  "pageSize",
];

export interface UseGridPersistenceOptions {
  /**
   * Depolama anahtari. IZGARAYA OZEL olmali.
   *
   * Iki farkli izgara ayni anahtari kullanirsa birinin kolon duzeni
   * digerine yazilir ve ikisi de bozulur. Kolon kimlikleri farkli oldugu
   * icin budama cogunu temizler, ama sonuc yine de "duzenim kayboldu"dur.
   */
  key: string;
  storage?: GridStorage;
  /** Hangi dilimler kaydedilsin? Varsayilan icin yukaridaki gerekceye bak. */
  include?: PersistedSlice[];
  /**
   * SEMA SURUMU.
   *
   * Kolon kimliklerini toptan degistirdiginizde (ornegin `tutar` ->
   * `amount`) budama her seyi atar ve kullanici bos bir duzenle kalir --
   * ama sessizce. Surumu artirmak, kayitli durumu ACIKCA gecersiz kilip
   * varsayilanlara donduruyor.
   */
  version?: number;
  /**
   * Yazma gecikmesi (ms).
   *
   * ZORUNLU: `columnResizeMode: "onChange"` ile kolon suruklenirken durum
   * her fare hareketinde degisiyor. Geciktirmeseydik tek bir surukleme
   * yuzlerce `localStorage.setItem` cagrisi uretirdi -- ve `localStorage`
   * SENKRON, yani her yazma ana is parcacigini kilitler. Suruklemenin
   * takilmasinin sebebi bu olurdu.
   */
  debounceMs?: number;
}

interface StoredState {
  v: number;
  s: Record<string, unknown>;
}

/**
 * IZGARA DURUMUNU KALICI KILAR (Faz 8).
 *
 * ```tsx
 * const table = useGridTable({ ... });
 * const layout = usePersistedGridLayout(table, { key: "kartlar" });
 * ```
 *
 * ---
 * NEDEN `initialState` DEGIL DE ETKI (effect) ICINDE GERI YUKLEME?
 *
 * En dogal cozum kayitli durumu `useState` baslaticisinda okuyup
 * `initialState`e vermekti. SUNUCUDA CALISMAZ: Next, istemci bilesenlerini
 * de sunucuda cizip HTML uretiyor ve orada `localStorage` yok. Sunucu
 * varsayilan genislikleri, istemci kayitli genislikleri cizerdi -- React
 * bunu "hydration mismatch" diye yuzumuze carpar ve agaci yamamaz.
 *
 * SUNUCU TARAFLI IZGARADA IKINCI BIR BEDEL: geri yukleme siralamayi ya da
 * sayfa boyutunu degistiriyorsa bu, `useServerGrid`in denetimli durumuna
 * yaziliyor ve BIR EK ISTEK uretiyor (ilki varsayilanlarla gitmis oluyor).
 * Kacinmanin tek yolu ilk istegi kayit okunana kadar BEKLETMEK olurdu; o da
 * her acilista gorunur bir gecikme demek. Bir fazladan istek, her kullaniciya
 * odetilecek bir beklemeden ucuz.
 *
 * Bedeli: bir kare boyunca varsayilan duzen gorunuyor. Bunu gizlemek icin
 * izgarayi bekletmeyi de dusundum; daha kotu -- bos ekran, kisa bir kaymadan
 * cok daha rahatsiz edici. `isRestored` bayragi disari veriliyor, isteyen o
 * kareyi kendi yontemiyle orter.
 */
export function usePersistedGridLayout<TData extends RowData>(
  table: GridTable<TData>,
  {
    key,
    storage = localStorageAdapter,
    include = DEFAULT_SLICES,
    version = 1,
    debounceMs = 400,
  }: UseGridPersistenceOptions,
) {
  const [isRestored, setIsRestored] = useState(false);

  /**
   * `table` ve `storage` REF'te tutuluyor.
   *
   * Ikisi de her render'da yeni referans olabilir ve etki bagimliligina
   * konsalardi geri yukleme her render'da yeniden calisirdi: kaydedilmis
   * durumu uygula -> durum degisti -> yeniden ciz -> yeniden uygula.
   * Sonsuz dongu.
   */
  const tableRef = useRef(table);
  tableRef.current = table;
  const storageRef = useRef(storage);
  storageRef.current = storage;

  /*
    `include` dizisi cagiran tarafta her render'da yeniden yazilabiliyor
    (`include={["columnSizing"]}`). Referansini bagimlilik yapsaydik geri
    yukleme sonsuz donerdi. Icerigi tek bir dizeye cevirip ANLAM'a
    baglaniyoruz; dizinin kendisi de o dizeden turetiliyor ki iki taraf
    ayrisamasin.
  */
  const includeKey = include.join(",");
  const slices = useMemo(
    () => includeKey.split(",") as PersistedSlice[],
    [includeKey],
  );

  /** --- GERI YUKLEME: bir kez, baglandiktan sonra. --- */
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      let stored: StoredState | undefined;
      try {
        const raw = await storageRef.current.read(key);
        if (raw !== null && raw !== undefined && raw !== "") {
          stored = JSON.parse(raw) as StoredState;
        }
      } catch {
        /*
          BOZUK KAYIT = KAYIT YOK.

          Elle kurcalanmis, yarim yazilmis ya da eski bicimde bir deger
          `JSON.parse`i patlatabiliyor. Hatayi yukari birakmak izgarayi
          acilmaz yapardi; oysa dogru davranis varsayilan duzene donmek.
        */
        stored = undefined;
      }

      if (cancelled) return;

      if (stored !== undefined && stored.v === version) {
        applyState(tableRef.current, stored.s, slices);
      }

      // Surum uyusmuyorsa DA hazir sayiyoruz: kayit gecersiz, varsayilanlar
      // gecerli ve bundan sonrasi normal sekilde kaydedilecek.
      setIsRestored(true);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [key, version, slices]);

  /** --- ANLIK GORUNTU: yalnizca istenen dilimler. --- */
  const snapshot = useMemo(
    () => JSON.stringify(collectState(table, slices)),
    [table, slices],
  );

  /** --- KAYDETME: geciktirilmis, ve GERI YUKLEMEDEN SONRA. --- */
  useEffect(() => {
    /*
      `isRestored` KONTROLU KRITIK.

      Olmasaydi sira su olurdu: bilesen baglanir -> durum VARSAYILAN ->
      kaydetme etkisi calisir -> varsayilanlar depoya YAZILIR -> geri
      yukleme okumaya gittiginde kendi sildigi seyi bulur.
      Yani kalicilik ozelligi, kaliciligi bozan sey olurdu.
    */
    if (!isRestored) return;

    const timer = setTimeout(() => {
      void storageRef.current.write(
        key,
        JSON.stringify({ v: version, s: JSON.parse(snapshot) } as StoredState),
      );
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [snapshot, isRestored, key, version, debounceMs]);

  /**
   * DUZENI SIFIRLA -- ve bu bir kacis kapisi, sus degil.
   *
   * Kullanici bir kolonu 60px'e daraltip icerigini kaybedebiliyor ya da
   * anlamadigi bir duzene sikisabiliyor. Kalicilik olmasaydi sayfayi
   * yenilemek kurtarirdi; kalicilikla birlikte o yol da kapaniyor.
   * Sifirlamayi eklemeden kaliciligi acmak, kullaniciyi kendi kurdugu
   * tuzakta birakmak olurdu.
   */
  const reset = useCallback(() => {
    void storageRef.current.remove(key);
    const current = tableRef.current;
    current.resetColumnSizing();
    current.resetColumnOrder();
    current.resetColumnVisibility();
    current.resetColumnPinning();
    current.resetSorting();
    current.resetGrouping();
  }, [key]);

  return { isRestored, reset };
}

/** Tablodan yalnizca istenen dilimleri topluyor. */
function collectState<TData extends RowData>(
  table: GridTable<TData>,
  include: PersistedSlice[],
): Record<string, unknown> {
  const state = table.state;
  const result: Record<string, unknown> = {};

  for (const slice of include) {
    switch (slice) {
      case "pageSize":
        result.pageSize = state.pagination.pageSize;
        break;
      case "globalFilter":
        result.globalFilter = state.globalFilter ?? "";
        break;
      default:
        result[slice] = state[slice];
        break;
    }
  }

  return result;
}

/**
 * Kayitli durumu tabloya uygular -- BUDAYARAK.
 *
 * ---
 * BUDAMA NEDEN ZORUNLU?
 *
 * Kayit, o gunku KOLON KIMLIKLERINE gonderme yapiyor. Aradan gecen surede
 * bir kolon kaldirilmis ya da adi degismis olabilir. Uc sonucu var ve
 * ucuncusu gercekten tehlikeli:
 *
 *   1. `columnSizing: { "eskiKolon": 200 }` -- zararsiz artik.
 *   2. `columnPinning: { start: ["eskiKolon"] }` -- dondurma ofsetleri var
 *      olmayan bir kolonu saymaya calisir.
 *   3. `columnFilters: [{ id: "eskiKolon", ... }]` -- SUNUCU TARAFLI
 *      izgarada bu filtre API'ye gider ve sunucu (dogru sekilde)
 *      "Filtrelenemeyen alan: eskiKolon" diye 400 doner. Kullanicinin
 *      gordugu sey: izgara acilmiyor, sebebi hakkinda hicbir ipucu yok --
 *      ve sayfayi yenilemek KURTARMIYOR, cunku hata kayitli.
 *
 * Var olmayan kimlikleri atmak bu ucunu birden kapatiyor.
 */
function applyState<TData extends RowData>(
  table: GridTable<TData>,
  stored: Record<string, unknown>,
  include: PersistedSlice[],
): void {
  const ids = new Set(table.getAllLeafColumns().map((column) => column.id));
  const keep = (id: unknown) => typeof id === "string" && ids.has(id);

  /*
    BUDAMA BIR DILIMI TAMAMEN BOSALTTIYSA O DILIMI HIC UYGULAMIYORUZ.

    OLCULEN HATA: tarayicida bayat bir kayit denedim -- `columnPinning:
    { start: ["silinmisKolon"] }`. Budama bunu `{ start: [], end: [] }`
    yapti ve tabloya oylece yazildi. Sonuc: uygulamanin `initialState`te
    tanimladigi "kimlik kolonlari dondurulsun" karari SESSIZCE silindi ve
    izgara dondurmasiz acildi.

    Ayrimi kacirmamak gerek:
      - Kayit ZATEN bostu  -> kullanici gercekten hepsini cozmus; UYGULA.
        (Aksi halde tercihleri her yenilemede geri gelir.)
      - Kayit DOLUYDU ama budama bosaltti -> kayitli niyet bu semada
        temsil EDILEMIYOR; uygulanacak bir sey yok, VARSAYILANI KORU.

    Bu, "eksik bilgiyi bilgi sanmamak" kurali: bosalmis bir liste
    "kullanici bos istedi" demek degil, "elimizde bir sey kalmadi" demek.
  */
  const prunedToNothing = (raw: unknown, pruned: { length: number }) =>
    pruned.length === 0 && rawLength(raw) > 0;

  const pickRecord = (value: unknown) =>
    Object.fromEntries(
      Object.entries((value ?? {}) as Record<string, unknown>).filter(([id]) =>
        keep(id),
      ),
    );

  for (const slice of include) {
    const value = stored[slice];
    if (value === undefined) continue;

    switch (slice) {
      case "columnSizing":
        table.setColumnSizing(pickRecord(value) as Record<string, number>);
        break;
      case "columnVisibility":
        table.setColumnVisibility(pickRecord(value) as Record<string, boolean>);
        break;
      case "columnOrder": {
        const order = (value as unknown[]).filter(keep) as string[];
        if (!prunedToNothing(value, order)) table.setColumnOrder(order);
        break;
      }
      case "columnPinning": {
        const pinning = (value ?? {}) as { start?: unknown[]; end?: unknown[] };
        const start = (pinning.start ?? []).filter(keep) as string[];
        const end = (pinning.end ?? []).filter(keep) as string[];
        const rawCount =
          (pinning.start ?? []).length + (pinning.end ?? []).length;
        if (!(start.length + end.length === 0 && rawCount > 0)) {
          table.setColumnPinning({ start, end });
        }
        break;
      }
      case "sorting": {
        const sorting = (value as Array<{ id: unknown }>).filter((entry) =>
          keep(entry.id),
        );
        if (!prunedToNothing(value, sorting)) {
          table.setSorting(sorting as never);
        }
        break;
      }
      case "grouping": {
        const grouping = (value as unknown[]).filter(keep) as string[];
        if (!prunedToNothing(value, grouping)) table.setGrouping(grouping);
        break;
      }
      case "columnFilters": {
        const filters = (value as Array<{ id: unknown }>).filter((entry) =>
          keep(entry.id),
        );
        if (!prunedToNothing(value, filters)) {
          table.setColumnFilters(filters as never);
        }
        break;
      }
      case "globalFilter":
        table.setGlobalFilter(value as string);
        break;
      case "pageSize":
        if (typeof value === "number" && value > 0) table.setPageSize(value);
        break;
      default:
        break;
    }
  }
}

/** Kayittaki ham deger kac oge tasiyordu? (Dizi degilse 0.) */
function rawLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
