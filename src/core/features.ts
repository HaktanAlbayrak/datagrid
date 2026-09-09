import type { RowData } from "@tanstack/react-table";
import {
  aggregationFn_count,
  aggregationFn_max,
  aggregationFn_mean,
  aggregationFn_min,
  aggregationFn_sum,
  aggregationFn_uniqueCount,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludesSome,
  filterFn_between,
  filterFn_betweenInclusive,
  filterFn_equals,
  filterFn_equalsString,
  filterFn_greaterThan,
  filterFn_greaterThanOrEqualTo,
  filterFn_includesString,
  filterFn_inNumberRange,
  filterFn_lessThan,
  filterFn_lessThanOrEqualTo,
  filterFn_startsWith,
  globalFilteringFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { filterFn_oneOf } from "./filter-fns";

/**
 * IZGARANIN OZELLIK KUMESI.
 *
 * ---
 * NEDEN TEK, GENIS BIR KUME? (TanStack "yalnizca kullandigini kaydet" diyor)
 *
 * O tavsiye UYGULAMA tablolari icin dogru: bir sayfada yalnizca siralama
 * lazimsa sayfalama kodunu paketlemenin anlami yok. Ama biz bir UYGULAMA
 * TABLOSU degil, DEVEXTREME SINIFINDA BIR IZGARA yaziyoruz -- burada
 * "gruplama gerekmiyor" diye bir durum yok, cunku ayni bilesenin bir sonraki
 * tuketicisi onu isteyecek.
 *
 * Alternatif, ozellikleri tuketiciye sectirmekti (`createDataGrid({features})`).
 * Denedim ve REDDETTIM: o zaman `DataGrid`in prop tipleri secilen kumeye gore
 * degisir; tuketici `enableGrouping` yazdiginda "bu ozellik kayitli degil"
 * hatasini TIP seviyesinde alir ve neyi eksik biraktigini anlamak icin
 * TanStack'in ic tiplerini okumak zorunda kalir. Bir paketin en pahali
 * ozelligi, kullanicisinin ic yapisini ogrenmeye mecbur kalmasidir.
 *
 * BEDELI DURUST OLARAK: ~40 KB (gzip) ek JS, kullanilmayan ozellikler dahil.
 * Kabul ediyoruz. Kabul etmediginiz durumda `tableFeatures(...)` ile kendi
 * kumenizi kurup `useGridTable`i atlayabilirsiniz -- alt katman acik.
 *
 * ---
 * `stockFeatures` KULLANMADIK, tek tek yazdik. Iki sebep:
 *   1. `cellSpanningFeature` ve `cellSelectionFeature` bu surumde YOK burada;
 *      onlari eklemek ayri bir tasarim karari (Faz 7 klavye/secim isi).
 *   2. Liste acikca yazilinca, bir ozellik eklendiginde/cikarildiginda
 *      degisiklik DIFF'te gorunur. `stockFeatures` yazsaydik TanStack'in bir
 *      minor surumu sessizce davranis ekleyebilirdi.
 */
/**
 * KOLON META VERISI -- izgaranin kolon tanimina ekledigi alanlar.
 *
 * TanStack'in `columnMeta` yuvasi tam bunun icin var: yeni bir ozellik
 * eklentisi (feature plugin) yazmadan kolon tanimina alan eklemek.
 *
 * Neden ozellik eklentisi DEGIL? Eklenti, DAVRANIS ve DURUM sahiplenen
 * seylerde dogru (ornegin duzenleme kipi -- Faz 6'da oyle yapacagiz). Ama
 * burada tuttuklarimiz saf VERI: hangi filtre denetimi cizilecek, hucre
 * nasil hizalanacak. Bunun icin eklenti yazmak, tek satirlik bir bilgiyi
 * on satirlik bir tip bildirimine gommek olurdu.
 */
export interface GridColumnMeta {
  /**
   * Filtre satirinda hangi denetim cizilecek?
   * - `text`   : icerir araması (varsayilan, dize kolonlari icin)
   * - `number` : min-max araligi
   * - `select` : o kolonda GERCEKTEN var olan degerlerden coklu secim
   * - `date`   : tarih araligi
   * - `false`  : bu kolon filtrelenmez
   *
   * Verilmezse `text` varsayiliyor; `false` yazmak filtreyi kapatiyor.
   */
  filter?: "text" | "number" | "select" | "date" | false;

  /** Hucre ve baslik hizalamasi. Sayilar icin `end` onerilir. */
  align?: "start" | "center" | "end";

  /**
   * Bu kolon gruplandiginda ve altta OZET satirinda nasil ozetlenecek?
   *
   * - `sum` / `mean` / `min` / `max` : sayisal kolonlar
   * - `count`                        : satir sayar, degere BAKMAZ
   * - `uniqueCount`                  : farkli deger sayar
   * - `false` / verilmezse           : ozet yok
   *
   * ---
   * NEDEN `aggregationFn` DEGIL DE META?
   *
   * TanStack'in `aggregationFn`i yalnizca GRUPLANMIS satirlarda calisiyor.
   * Bize iki yerde ayni cevap lazim: grup basligi satirinda ve tablonun
   * altindaki GENEL TOPLAM satirinda. Tek bir meta alanindan ikisini de
   * turetmek, "toplami iki yere ayri ayri yazip birbirini tutmamasi"
   * sinifindaki hatayi bastan imkansiz kiliyor.
   *
   * `use-grid-table.ts` bunu kolonun `aggregationFn`ine ceviriyor; kolon
   * kendi `aggregationFn`ini yazmissa ona dokunulmuyor.
   */
  aggregate?: "sum" | "count" | "min" | "max" | "mean" | "uniqueCount" | false;

  /**
   * GRUP BASLIGI satirinda bu kolonun normal hucresi cizilsin mi?
   *
   * ---
   * VARSAYILAN `false` VE SEBEBI OLCULMUS BIR HATA.
   *
   * Gruplama acikken sentetik bir grup satiri olusuyor ve `row.original`i
   * YOK. TanStack, ozeti olmayan kolonlarda o satir icin NORMAL `cell`
   * ciziciye dusuyor -- yani satir islemleri menusu grup basliginda da
   * beliriyordu ve "Sil"e basildiginda tanimsiz bir kayit uzerinde islem
   * yapilacakti. (Testte gorundu: grup satirinda "Satır işlemleri" dugmesi.)
   *
   * Kural: grup satiri, grubun ETIKETINI ve OZETLERINI gosterir; tekil bir
   * kaydi anlatan hucreler orada bos kalir.
   *
   * `true` yazmak, hucrenin grup satirinda da anlamli oldugunu SOYLEMEK
   * demek. Tipik ornek secim kutusu: grup satirindaki kutu tum grubu secer
   * (secim alt satirlara zaten yayiliyor). Bu kolonlar `row.original`a
   * dokunmamali.
   */
  showOnGroupRow?: boolean;

  /**
   * Ozet degerini bicimlendirir (grup basligi ve genel toplam icin ayni).
   *
   * Varsayilan bicimlendirme sayilari yerel ayara gore yaziyor. Para birimi,
   * yuzde ya da birim eklemek isteyen buraya yaziyor -- ve BIR KEZ yazinca
   * her iki yerde birden gecerli oluyor.
   */
  formatAggregate?: (value: unknown) => ReactNode;

  /**
   * Alttaki GENEL TOPLAM satirinda gosterilsin mi?
   *
   * Varsayilan: `aggregate` verilmisse evet. `false` yazmak, kolonun
   * gruplarda ozetlenip genel toplamda gosterilmemesini sagliyor -- ornegin
   * bir ortalamanin grup icinde anlamli, tum veri icinde yaniltici oldugu
   * durumlar.
   */
  summary?: boolean;

  /**
   * Disa aktarmaya dahil mi? Varsayilan: evet.
   *
   * `false` yapilacak tipik yer: ekranda anlamli ama dosyada olmayan
   * kolonlar (ornegin bir ilerleme cubugu ya da avatar).
   */
  export?: boolean;

  /**
   * Disa aktarilan degeri donusturur.
   *
   * Varsayilan davranis HAM degeri yazmak; bu bilincli, cunku ham deger
   * Excel'de SAYI/TARIH olarak kaliyor ve uzerinde islem yapilabiliyor.
   * Bicimlenmis metin ("₺455.167") toplanamaz.
   *
   * Bu kanca yalnizca ham degerin dosyada anlamsiz oldugu durumlar icin:
   * ornegin bir kimlik yerine ada cevirmek.
   */
  exportValue?: (value: unknown, row: unknown) => unknown;

  /**
   * `filter: "select"` icin SABIT secenek listesi.
   *
   * ---
   * SUNUCU TARAFLI IZGARADA BU ZORUNLU.
   *
   * Yuzeyleme (faceting) listeyi ISTEMCIDEKI satirlardan uretiyor. Sunucu
   * modunda istemcide yalnizca GORUNEN SAYFA var; yani liste ya bos kaliyor
   * ya da "bu sayfada gecen degerler" gibi yaniltici bir sey gosteriyor.
   * Ikisi de kullanilamaz: kullanici filtre acar, secenek bulamaz.
   *
   * Enum alanlarinda (tip, oncelik, durum) degerler ZATEN derleme zamaninda
   * belli -- sunucuya "hangi oncelikler var" diye sormak bes elemanli bir
   * kume icin gereksiz bir gidis-donus olurdu.
   *
   * Verilmezse yuzeyleme kullanilir (istemci tarafli izgarada dogru olan bu).
   */
  filterOptions?: Array<{ value: string; label?: string }>;

  /**
   * Ice aktarmada bu kolona hangi basliklar eslesir?
   *
   * Dosyadaki baslik `columnDef.header` ile birebir ayni olmayabilir
   * ("Bütçe" / "butce" / "Budget"). Burada verilen adlar da kabul ediliyor.
   */
  importAliases?: string[];
}

export const gridFeatures = tableFeatures({
  // Kolon meta tipini KAYIT EDIYORUZ: `meta: { filter: "sayi" }` yazmak
  // artik derleme hatasi. Kayit etmeseydik `meta` `unknown` kalir ve her
  // okumada tip donusumu yazmak gerekirdi.
  columnMeta: {} as GridColumnMeta,

  // --- filtreleme ---------------------------------------------------------
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  /**
   * Kayitli filtre fonksiyonlari. Tek tek import ediyoruz, toplu `filterFns`
   * nesnesini DEGIL: o, kullanilmayanlar dahil hepsini paketler.
   *
   * Anahtar adlari SOZLESMEDIR -- kolon tanimlari `filterFn: "between"` gibi
   * dize ile bunlara basvuruyor ve dize yanlissa TypeScript yakaliyor.
   */
  filterFns: {
    includesString: filterFn_includesString,
    equalsString: filterFn_equalsString,
    startsWith: filterFn_startsWith,
    equals: filterFn_equals,
    between: filterFn_between,
    /**
     * Sayi araligi icin `inNumberRange`, duz `between` DEGIL.
     *
     * Farki onemli: `inNumberRange` bos uclari ACIK UC olarak normalize
     * ediyor ("min: 100, max: bos" -> 100 ve uzeri) ve ters girilen uclari
     * takas ediyor ("min 500, max 100" -> 100-500). `between` bunlari
     * yapmiyor; kullanici yalnizca min yazdiginda HIC satir donmezdi.
     */
    inNumberRange: filterFn_inNumberRange,
    /** Tarih araligi: ISO dizeleri sozluksel karsilastirilabiliyor. */
    betweenInclusive: filterFn_betweenInclusive,
    greaterThan: filterFn_greaterThan,
    greaterThanOrEqualTo: filterFn_greaterThanOrEqualTo,
    lessThan: filterFn_lessThan,
    lessThanOrEqualTo: filterFn_lessThanOrEqualTo,
    /**
     * Baslik filtresinin (faceted) coklu secimi -- KENDI yazdigimiz fonksiyon.
     *
     * TanStack'in `arrIncludesSome`unu bagladim ve secim yapinca HER ZAMAN
     * "0 kayit" dondu: `arr*` ailesi SATIR DEGERI dizi oldugunda calisiyor,
     * bizde satir degeri tek, FILTRE degeri dizi. Gerekcenin tamami
     * `filter-fns.ts`de.
     */
    oneOf: filterFn_oneOf,
    /** Dizi degerli kolonlar (ornegin "etiketler") icin hala duruyor. */
    arrIncludesSome: filterFn_arrIncludesSome,
  },
  globalFilteringFeature,

  // --- yuzeyleme (faceting) ----------------------------------------------
  /**
   * DevExtreme'in "header filter" acilir listesi, o kolonda GERCEKTEN var olan
   * degerleri gosterir. Faceting tam olarak bunu hesapliyor.
   *
   * `facetedRowModel` DIGER kolonlarin filtrelerini uygulayip bu kolonunkini
   * uygulamayan bir model uretiyor -- bu incelik onemli: aksi halde bir degeri
   * sectiginizde liste tek elemana duser ve secimi genisletemezsiniz.
   */
  columnFacetingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),

  // --- siralama -----------------------------------------------------------
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },

  // --- gruplama + ozetler -------------------------------------------------
  columnGroupingFeature,
  groupedRowModel: createGroupedRowModel(),
  rowAggregationFeature,
  aggregationFns: {
    sum: aggregationFn_sum,
    count: aggregationFn_count,
    min: aggregationFn_min,
    max: aggregationFn_max,
    mean: aggregationFn_mean,
    uniqueCount: aggregationFn_uniqueCount,
  },

  // --- hiyerarsi ----------------------------------------------------------
  /**
   * AGAC IZGARASI (TreeGrid) BURADAN CIKIYOR.
   *
   * DevExtreme'de `DataGrid` ve `TreeList` AYRI iki bilesen. Biz tek bilesen
   * tuttuk: `getSubRows` verirseniz agac, vermezseniz duz izgara.
   *
   * Neden? Ikisinin %90'i ayni (kolonlar, filtreler, secim, duzenleme) ve
   * DevExtreme'de bu ikizlik gercek bir maliyet: bir ozellik birine eklenip
   * digerine eklenmiyor. Tek bilesende o ayrisma MUMKUN degil.
   *
   * Ayni ozellik "master-detail" satirlarini da tasiyor: `getRowCanExpand`
   * verip alt satir yerine ozel bir panel cizdiriyorsunuz.
   */
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),

  // --- satirlar -----------------------------------------------------------
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  rowPinningFeature,

  // --- kolonlar -----------------------------------------------------------
  columnVisibilityFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  // `columnResizingFeature`, `columnSizingFeature` olmadan kayit edilemez --
  // `FeatureSlotPrereqs` bunu derleme zamaninda zorluyor.
  columnResizingFeature,
});

export type GridFeatures = typeof gridFeatures;

/**
 * Kolon yardimcisi -- `createColumnHelper<GridFeatures, TData>()` yazmaktan
 * kurtariyor.
 *
 * Neden onemli: ilk jenerigi elle yazmak zorunda kalan tuketici er ya da gec
 * yanlis kumeyi verir ve hata mesaji TanStack'in ic tiplerinin derinliginden
 * gelir. Tek satirlik bu sarmalayici o sinifi hatayi tamamen kaldiriyor.
 */
export function createGridColumnHelper<TData extends RowData>() {
  return createColumnHelper<GridFeatures, TData>();
}
