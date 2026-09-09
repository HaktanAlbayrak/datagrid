import type { RowData, TableOptions } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { formatAggregateValue } from "./aggregate";
import { type GridFeatures, gridFeatures } from "./features";
import type { GridColumn } from "./pinning";

/**
 * `meta.filter` -> varsayilan filtre fonksiyonu.
 *
 * NEDEN OTOMATIK? Cunku ikisini ayri ayri yazdirmak SESSIZ bir hata kaynagi:
 * `meta: { filter: "number" }` yazip `filterFn`i unutan biri, min/max
 * kutularini gorur, doldurur ve HICBIR SEY OLMAZ -- varsayilan `includesString`
 * `[100, 500]` dizisini metin gibi arar. Hata mesaji yok, yalnizca "filtre
 * calismiyor".
 *
 * Denetim tipi ile filtre mantigi ayni seyin iki yuzu; tek yerden turetmek
 * o hata sinifini tamamen kaldiriyor. Kolon kendi `filterFn`ini yazarsa ona
 * DOKUNMUYORUZ (asagida) -- ozellestirme hala mumkun.
 */
const FILTER_FN_BY_VARIANT = {
  text: "includesString",
  number: "inNumberRange",
  select: "oneOf",
  date: "betweenInclusive",
} as const;

/**
 * `meta.aggregate` -> kolonun `aggregationFn`i.
 *
 * `meta.filter` -> `filterFn` esleme ile AYNI gerekce: tek bir niyet
 * ("bu kolon toplanir") iki ayri yerde tekrar edilirse er ya da gec
 * birbirini tutmaz olur. Isimler TanStack'in kayitli fonksiyonlariyla
 * birebir ayni oldugu icin esleme kimlik; yine de acikca yaziyoruz ki
 * `features.ts`teki kayittan farklilasirsa DERLEME hatasi versin, sessiz
 * bir "bilinmeyen aggregationFn" degil.
 */
const AGGREGATION_FN_BY_KIND = {
  sum: "sum",
  count: "count",
  min: "min",
  max: "max",
  mean: "mean",
  uniqueCount: "uniqueCount",
} as const;

/**
 * `useTable`in izgaraya baglanmis hali.
 *
 * Ozellik kumesini ve izgara icin dogru olan varsayilanlari sabitliyor;
 * geri kalan HER TanStack secenegi aynen geciyor.
 *
 * NEDEN SECENEKLERI YENIDEN TANIMLAMADIM (kendi arayuzumu yazip icini
 * doldurmak yerine)?
 * Yazsaydim TanStack'in bugun ya da yarin ekledigi her secenek icin bu
 * dosyayi guncellemek gerekirdi ve guncellemedigim gun tuketici o secenege
 * ERISEMEZDI -- paket, altindaki kutuphaneden daha az yetenekli hale gelirdi.
 * Sarmalayicinin en sik oldurucu hatasi budur. `Omit<..., "features">` ile
 * yalnizca BIZIM sahiplendigimiz alani kapatiyoruz.
 */
export type GridTableOptions<TData extends RowData> = Omit<
  TableOptions<GridFeatures, TData>,
  "features"
>;

export type GridTable<TData extends RowData> = ReturnType<
  typeof useGridTable<TData>
>;

export function useGridTable<TData extends RowData>(
  options: GridTableOptions<TData>,
) {
  /**
   * Kolonlari BIR KEZ zenginlestiriyoruz.
   *
   * `useMemo` sart: yeni bir kolon dizisi her render'da TanStack'in tum
   * kolon ve satir modellerini gecersiz kilardi. Bagimlilik yalnizca
   * `options.columns` -- tuketici onu sabit tuttugu surece bu is bir kez
   * calisiyor. (Sabit tutmak zaten belgelenmis kural.)
   */
  const columns = useMemo(() => {
    return options.columns.map((column) => {
      const variant = column.meta?.filter;
      const aggregate = column.meta?.aggregate;

      // Acik yazilmis bir tercihi ezmek, otomatik davranisin en kotu
      // bicimidir: kolon kendi fonksiyonunu belirtmisse KARISMIYORUZ.
      const filterFn =
        variant === undefined ||
        variant === false ||
        column.filterFn !== undefined
          ? undefined
          : FILTER_FN_BY_VARIANT[variant];

      const aggregationFn =
        aggregate === undefined ||
        aggregate === false ||
        column.aggregationFn !== undefined
          ? undefined
          : AGGREGATION_FN_BY_KIND[aggregate];

      /*
        GRUP SATIRINDAKI HUCREYE VARSAYILAN CIZICI.

        TanStack, `aggregatedCell` yoksa NORMAL `cell` ciziciye dusuyor.
        Cogu kolonda bu yanlis: `cell`, tekil bir kaydi cizmek icin yazildi
        ve grup satirinda `row.original` YOK. Ornegin duzenlenebilir bir
        hucre, grup basliginda "duzenlenebilir bir toplam" gosterirdi.

        `meta.aggregate` yazan kolonlar bir SAYI istedigini soylemis oluyor;
        varsayilan cizici o sayiyi bicimlendirip yaziyor. Kolon kendi
        `aggregatedCell`ini yazmissa dokunmuyoruz.
      */
      const aggregatedCell =
        aggregationFn === undefined || column.aggregatedCell !== undefined
          ? undefined
          : ({
              column: cellColumn,
              getValue,
            }: {
              column: GridColumn<TData>;
              getValue: () => unknown;
            }) => formatAggregateValue(cellColumn, getValue());

      if (
        filterFn === undefined &&
        aggregationFn === undefined &&
        aggregatedCell === undefined
      ) {
        return column;
      }

      return {
        ...column,
        ...(filterFn === undefined ? {} : { filterFn }),
        ...(aggregationFn === undefined ? {} : { aggregationFn }),
        ...(aggregatedCell === undefined ? {} : { aggregatedCell }),
      };
    });
  }, [options.columns]);

  return useTable<GridFeatures, TData>({
    features: gridFeatures,

    /**
     * GENISLIK SINIRLARI -- olculmus bir kullanim hatasinin onlemi.
     *
     * Sinir olmadan kullanici bir kolonu 8px'e kadar daraltabiliyor (icerik
     * tamamen kayboluyor, tutamagi bir daha yakalamak neredeyse imkansiz) ya
     * da 4000px'e genisletip tabloyu ekrandan tasirabiliyordu. Ikisi de geri
     * donusu zor: kolon genisligi kalici durum, sayfa yenilemek kurtarmiyor.
     *
     * `minSize: 60` -- bir tarih ya da kisa sayi hala okunuyor, tutamak hala
     * yakalanabiliyor. `maxSize: 640` -- en uzun serbest metin bile sigar,
     * ama tek kolon ekrani ele geciremez.
     *
     * Kolon bazinda ezilebilir: `helper.accessor("aciklama", { maxSize: 900 })`.
     */
    defaultColumn: {
      minSize: 60,
      maxSize: 640,
    },

    /**
     * `columnResizeMode: "onChange"` -- kolon suruklenirken ANINDA genisliyor.
     *
     * Digeri (`onEnd`) yalnizca birakinca uyguluyor. DevExtreme canli
     * yeniden boyutlandiriyor ve kullanici beklentisi bu yonde; "onEnd"
     * ucuz gorunse de kullaniciya ne kadar genislettigini gostermeyen bir
     * surukleme, hedefi tutturmayi tahmine cevirir.
     */
    columnResizeMode: "onChange",

    /**
     * ILK TIKLAMA HER ZAMAN ARTAN (`sortDescFirst: false`).
     *
     * TanStack varsayilani SAYISAL kolonlarda azalanla basliyor ("en buyugu
     * once genelde istenen sey"). Tek basina makul, ama bir IZGARADA yikici:
     * ayni tabloda metin kolonu A->Z, sayi kolonu 9->0 basliyor ve kullanici
     * hangi kolona bastiginda ne olacagini KESTIREMIYOR.
     *
     * Ongorulebilirlik, tek bir kolondaki kolaylikatan daha degerli.
     * DevExtreme de her kolonda artanla basliyor. Kolon bazinda
     * `sortDescFirst: true` yazarak istisna yapmak hala mumkun.
     *
     * (Bu karari testin ortaya cikardigini not etmek gerek: "Tutar"
     * kolonuna ilk tiklamada `aria-sort="descending"` geldi.)
     */
    sortDescFirst: false,

    /**
     * Alt satirlar sayfalama SONRASI aciliyor (`paginateExpandedRows: false`).
     *
     * Varsayilan `true` olsaydi: 25 satirlik bir sayfada bir agac dugumunu
     * actiginizda cocuklari da "satir" sayilir, sayfa sinirini asanlar bir
     * SONRAKI sayfaya taser ve ust satir ile cocuklari BOLUNURDU. Kullanicinin
     * gordugu sey "actim, yarisi kayboldu" olur.
     *
     * `false` ile sayfa boyutu KOK satirlari sayiyor, cocuklar her zaman
     * ebeveyniyle ayni sayfada kaliyor. Agac izgarasinda tek dogru davranis bu.
     */
    paginateExpandedRows: false,

    /**
     * GRUPLANAN KOLON BASA TASINIR (`groupedColumnMode: "reorder"`).
     *
     * Alternatifler `"remove"` (gruplanan kolonu tablodan cikarmak) ve
     * `false` (yerinde birakmak).
     *
     * `"remove"` bilgi kaybi: kullanici "Durum"a gore grupladiginda o kolon
     * ekrandan silinince gruplarin NEYE gore olustugunu ancak grup basligina
     * bakarak anlayabiliyor. `false` ise daha kotu: gruplanan kolon on
     * sirasinda kalirsa (diyelim 5. kolon) grup basligi satirin ortasinda
     * bir yerde beliriyor ve hiyerarsi gozle takip edilemiyor.
     *
     * `"reorder"` grup kolonunu sola alarak hiyerarsiyi agac izgarasindaki
     * girintiyle ayni yonde okutuyor -- kullanicinin zaten bildigi sekil.
     */
    groupedColumnMode: "reorder",

    ...options,
    columns,

    initialState: {
      pagination: { pageIndex: 0, pageSize: 25 },
      ...options.initialState,
    },
  });
}
