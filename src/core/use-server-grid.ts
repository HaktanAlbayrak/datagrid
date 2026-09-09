import type {
  ColumnFiltersState,
  PaginationState,
  RowData,
  SortingState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";

/** Sunucuya gonderilen izgara durumu. */
export interface ServerGridQuery {
  pagination: PaginationState;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  /**
   * Gelismis filtre agaci, SERILESTIRILMIS hali (Faz 2b).
   *
   * Nesne degil DIZE tasiyoruz. Sebep bu kancanin sorgu kimligi: durum
   * degisikligini derin karsilastirma yerine bir dizeye bakarak anliyoruz;
   * nesne olsaydi her render'da yeni bir referans gelir ve sonsuz istek
   * dongusu olusurdu. `useFilterBuilder` zaten `useMemo`lu dize veriyor.
   */
  filterTree?: string;
}

export interface ServerGridResult<TData> {
  rows: TData[];
  total: number;
}

export interface UseServerGridOptions<TData extends RowData> {
  /** Durumu alip sunucudan sayfayi getirir. */
  fetcher: (query: ServerGridQuery) => Promise<ServerGridResult<TData>>;
  initialPageSize?: number;
  initialSorting?: SortingState;
  /**
   * Yazarken beklenecek sure (ms).
   *
   * YALNIZCA filtre ve arama icin. Sayfa/siralama degisikligi tek bir
   * tiklama; onlari geciktirmek arayuzu tembel gosterir.
   */
  debounceMs?: number;
  /**
   * Gelismis filtre agaci, serilestirilmis (Faz 2b).
   *
   * Bu kanca agaci YONETMIYOR, yalnizca sorguya katiyor. Sebep: agac
   * kullanicinin kurdugu bir ifade ve arayuzu (kurucu) tamamen disarida --
   * durumunu burada tutmak, iki ayri yerin ayni seyin sahibi olmasi
   * demekti. `useFilterBuilder` uretiyor, buraya DIZE olarak geliyor.
   */
  filterTree?: string;
  onError?: (error: unknown) => void;
}

const EMPTY_ROWS: never[] = [];

/**
 * SUNUCU TARAFLI IZGARA DURUMU.
 *
 * Sayfalama, siralama ve filtreleme SUNUCUDA yapildiginda izgaranin durumu
 * artik bir "goruntuleme tercihi" degil, bir SORGU. Bu kanca o sorguyu
 * yonetiyor: durumu tutuyor, degistiginde veriyi cekiyor ve `useGridTable`e
 * verilecek secenekleri uretiyor.
 *
 * Cozdugu dort problem asagida; dordu de elle yazildiginda unutuluyor.
 */
export function useServerGrid<TData extends RowData>({
  fetcher,
  initialPageSize = 25,
  initialSorting = [],
  debounceMs = 300,
  filterTree,
  onError,
}: UseServerGridOptions<TData>) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [rows, setRows] = useState<TData[]>(EMPTY_ROWS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * YENIDEN CEKME ANAHTARI.
   *
   * OLCULEN HATA: hucre duzenlemesi kaydedildikten sonra izgara ESKI degeri
   * gosteriyordu. Veri sunucuya yazilmisti (veritabanindan dogruladim) ama
   * istemcideki satirlar bir onceki cevaptan kalmaydi -- kullanicinin
   * gordugu sey "kaydettim, hicbir sey olmadi".
   *
   * Sunucu tarafli izgarada bu KACINILMAZ: veriyi yalnizca sunucu biliyor,
   * yerel bir "iyimser guncelleme" yapmak da yanlis olurdu (sunucu degeri
   * donusturmus olabilir -- kirpma, varsayilan, hesaplanan alan).
   *
   * Sayaci artirmak tek dogru cozum: kaydeden taraf `refetch()` cagiriyor,
   * izgara tazeleniyor ve ekranda SUNUCUNUN degeri gorunuyor.
   */
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * (1) YARIS KOSULU: SON ISTEK KAZANIR.
   *
   * Kullanici hizli yazdiginda birden fazla istek ucusta olur ve AG
   * SIRAYI GARANTI ETMEZ: "ab" icin baslayan istek "abc" icin baslayandan
   * sonra donebilir. Sirali sayac olmadan ekranda "abc" yazarken "ab"
   * sonuclari kalir -- yeniden uretmesi zor, kullanicinin "arama bazen
   * yanlis" dedigi hata tam olarak budur.
   */
  const requestId = useRef(0);

  /**
   * (2) FILTRE/ARAMA DEGISINCE ILK SAYFAYA DON.
   *
   * 12. sayfadayken filtre uygulayip sonuc 3 sayfaya duserse sunucu bos
   * bir sayfa doner ve kullanici "filtreledim, hicbir sey kalmadi" der.
   * Oysa veri var, yalnizca yanlis sayfada duruyor.
   *
   * TanStack bunu KENDILIGINDEN yapmiyor -- `manualPagination` modunda
   * sayfa durumu tamamen bizim.
   */
  const resetPage = useCallback(() => {
    setPagination((old) =>
      old.pageIndex === 0 ? old : { ...old, pageIndex: 0 },
    );
  }, []);

  /**
   * (3) GECIKTIRME YALNIZCA YAZILAN ALANLARDA.
   *
   * Sayfa ve siralama tek tiklama: geciktirmek arayuzu tembel gosterir.
   * Filtre ve arama ise tus basina bir istek uretir -- "Mühendislik"
   * yazmak 11 istek demek.
   *
   * Bu yuzden iki ayri bagimlilik listesi var: biri aninda, digeri
   * gecikmeli tetikliyor.
   */
  /*
    GELISMIS FILTRE DE GECIKTIRILENLER ARASINDA.

    Kurucudaki bir metin kutusuna yazmak da tus basina bir durum
    degisikligi uretiyor; sayfa/siralama gibi tek tiklamalik degil.
    Ayni kefeye koymak, "Mühendislik" yazarken 11 istek atilmasini
    onluyor.
  */
  const filterKey = JSON.stringify({ columnFilters, globalFilter, filterTree });
  const [debouncedFilterKey, setDebouncedFilterKey] = useState(filterKey);

  useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedFilterKey(filterKey);
      return;
    }
    const timer = setTimeout(
      () => setDebouncedFilterKey(filterKey),
      debounceMs,
    );
    return () => clearTimeout(timer);
  }, [filterKey, debounceMs]);

  /*
    GELISMIS FILTRE DEGISINCE DE ILK SAYFAYA DON.

    Kolon filtreleri ve arama icin bu, asagidaki `options` sarmalayicilarinda
    yapiliyor; gelismis filtre disaridan geldigi icin onu bir etki
    izliyor. Olmasaydi 12. sayfadayken kurulan bir filtre sonucu 3 sayfaya
    dusurur ve kullanici bos bir ekran gorurdu -- veri var, yalnizca yanlis
    sayfada.
  */
  // `filterTree` govdede OKUNMUYOR ama bagimlilikta olmak ZORUNDA: burada
  // bir DEGER degil TETIKLEYICI. Yalnizca `resetPage` yazsaydik (kararli bir
  // `useCallback`) etki bir kez calisir ve filtre degisince sayfa
  // sifirlanmazdi. Linter kullanimini goremedigi icin "gereksiz" diyor --
  // `reloadToken` ile ayni durum.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filterTree bir tetikleyici; kaldırılırsa filtre değişince sayfa sıfırlanmaz
  useEffect(() => {
    resetPage();
  }, [filterTree, resetPage]);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // `reloadToken` bir DEGER degil, TETIKLEYICI: govdede okunmuyor, yalnizca
  // artinca efekti yeniden calistiriyor. Linter "gereksiz bagimlilik" diyor
  // cunku kullanimini goremiyor -- kaldirmak `refetch()`i islevsiz birakirdi.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken bir tetikleyici; kaldırılırsa refetch() çalışmaz
  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    setIsLoading(true);

    const {
      columnFilters: filters,
      globalFilter: search,
      filterTree: tree,
    } = JSON.parse(debouncedFilterKey) as {
      columnFilters: ColumnFiltersState;
      globalFilter: string;
      filterTree?: string;
    };

    fetcherRef
      .current({
        pagination,
        sorting,
        columnFilters: filters,
        globalFilter: search,
        ...(tree === undefined ? {} : { filterTree: tree }),
      })
      .then((result) => {
        // Bayat cevap: daha yeni bir istek baslamis, bunu YOK SAY.
        if (requestId.current !== id) return;
        setRows(result.rows);
        setTotal(result.total);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (requestId.current !== id) return;
        setIsLoading(false);
        onError?.(error);
      });
    // `fetcher` bagimlilikta DEGIL: cagiran onu her render'da yeniden
    // olusturursa (cok yaygin) sonsuz dongu olurdu. Guncel surumu `ref`te
    // tutuyoruz -- davranis ayni, dongu yok.
  }, [pagination, sorting, debouncedFilterKey, reloadToken, onError]);

  return {
    rows,
    total,
    isLoading,
    /**
     * Veriyi sunucudan yeniden ceker.
     *
     * Duzenleme, silme ya da harici bir degisiklikten SONRA cagirilmali --
     * aksi halde ekran sunucudan sapar.
     */
    refetch,

    /**
     * (4) `useGridTable`e OLDUGU GIBI yayilacak secenekler.
     *
     * `manual*` bayraklarini tek tek yazmak kolayca eksik kalir: yalnizca
     * `manualPagination` verip `manualFiltering` unutulursa TanStack
     * ISTEMCIDE bir kez daha filtreler ve sunucunun dondurdugu 25 satirin
     * bir kismi kaybolur. Kullanici "filtre iki kez uygulaniyor" der.
     * Uc bayragi birlikte vermek o hatayi imkansiz kiliyor.
     */
    options: {
      data: rows,
      rowCount: total,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      state: { pagination, sorting, columnFilters, globalFilter },
      onPaginationChange: setPagination,
      onSortingChange: (
        updater: SortingState | ((old: SortingState) => SortingState),
      ) => {
        setSorting(updater);
        resetPage();
      },
      onColumnFiltersChange: (
        updater:
          | ColumnFiltersState
          | ((old: ColumnFiltersState) => ColumnFiltersState),
      ) => {
        setColumnFilters(updater);
        resetPage();
      },
      onGlobalFilterChange: (updater: string | ((old: string) => string)) => {
        setGlobalFilter(updater);
        resetPage();
      },
    },
  };
}

/**
 * Izgara durumunu sorgu parametrelerine cevirir.
 *
 * Bicim, `tudos-api-nest`in `GET /cards` uc noktasiyla ayni:
 *   sort    = "alan:yon,alan:yon"
 *   filters = JSON dizi
 *
 * Paketin icinde duruyor cunku "durumdan sorguya" cevrimi HER tuketici
 * yeniden yazacak ve her biri kucuk farklarla yazacak. Sunucu tarafi farkli
 * bir bicim bekliyorsa bu fonksiyon kullanilmaz -- zorunlu degil, hazir.
 */
export function serializeGridQuery(query: ServerGridQuery): {
  page: number;
  pageSize: number;
  sort?: string;
  q?: string;
  filters?: string;
  filterTree?: string;
} {
  const sort = query.sorting
    .map((entry) => `${entry.id}:${entry.desc ? "desc" : "asc"}`)
    .join(",");

  return {
    page: query.pagination.pageIndex,
    pageSize: query.pagination.pageSize,
    ...(sort === "" ? {} : { sort }),
    ...(query.globalFilter === "" ? {} : { q: query.globalFilter }),
    ...(query.filterTree === undefined || query.filterTree === ""
      ? {}
      : { filterTree: query.filterTree }),
    ...(query.columnFilters.length === 0
      ? {}
      : { filters: JSON.stringify(query.columnFilters) }),
  };
}
