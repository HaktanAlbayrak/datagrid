import type { Column, RowData } from "@tanstack/react-table";
import type { CSSProperties } from "react";

import type { GridFeatures } from "./features";

export type GridColumn<TData extends RowData> = Column<
  GridFeatures,
  TData,
  unknown
>;

/**
 * DONDURULMUS (pinned) KOLONLARIN CSS'i.
 *
 * DevExtreme'in `fixed: true` kolonlarinin karsiligi. Uc sey gerekiyor:
 *
 * 1. `position: sticky` + dogru OFSET.
 *    Ofset SABIT DEGIL: bastan ucuncu sabit kolonun konumu, ondan onceki iki
 *    kolonun O ANDAKI genisliklerinin toplami -- kullanici kolonu yeniden
 *    boyutlandirinca degisiyor. `column.getStart("start")` bu toplami O(1)
 *    veriyor (TanStack ofsetleri onbellekliyor).
 *
 * 2. `z-index` KATMANLARI -- ve burada YIGIN BAGLAMI (stacking context)
 *    tuzagi var. Bir kez dustum, aciklamasi uzun ama gerekli.
 *
 *    OLCULEN HATA: asagi kaydirinca sabit iki kolonun GOVDE hucreleri,
 *    yapiskan BASLIGIN uzerine cikiyordu. Baslik satirinin y'sinde
 *    `elementFromPoint` `<th>` degil `<td>` donduruyordu.
 *
 *    SEBEP: `<thead>` yapiskan olmak icin kendi `z-index`ini tasiyor ve
 *    bu bir YIGIN BAGLAMI aciyor. Icerideki `<th>` degerleri (10/30)
 *    artik yalnizca THEAD ICINDE anlamli -- disaridaki govde hucreleriyle
 *    KARSILASTIRILMIYOR. Karsilastirilan sey `<thead>`in kendi degeri ile
 *    govde hucresinin degeri. Ikisi de 20 olunca esitlik DOM SIRASINA
 *    gore cozuluyor ve govde (sonra geldigi icin) kazaniyor.
 *
 *    DOGRU KURGU:
 *      thead (yigin baglami)  = 30   <- govde hucrelerinin HEPSINDEN yuksek
 *        thead ici sabit th   =  2
 *        thead ici normal th  =  1
 *      govde sabit hucre      = 20
 *      govde normal hucre     = auto
 *
 *    Yani baslik ici degerler KUCUK sayilar: dis dunyayla yarismiyorlar,
 *    yalnizca birbirleriyle. Buyuk sayi yazmak (30) o yarisin var oldugu
 *    yanilsamasini uretiyordu.
 *
 * 3. ARKA PLAN. Yapiskan hucre altindan gecen satirlari kapatmak zorunda;
 *    saydam birakilirsa metinler ust uste biner. Arka plan sinifi cagiranda.
 *
 * ---
 * `left`/`right` DEGIL, `insetInlineStart`/`insetInlineEnd`.
 *
 * TanStack v9 dondurma konumlarini `"start" | "end"` diye adlandiriyor,
 * `"left" | "right"` diye DEGIL -- yani MANTIKSAL yon. Fiziksel `left`
 * yazsaydik izgara `dir="rtl"` bir sayfada ters calisirdi: "basa sabitlenmis"
 * kolon SAGDA olmasi gerekirken solda kalirdi. Mantiksal CSS ozellikleri
 * bunu bedavaya cozuyor; tarayici destegi de evrensel.
 *
 * ---
 * NEDEN INLINE STIL, Tailwind SINIFI DEGIL?
 * Ofset calisma zamaninda hesaplanan bir PIKSEL sayisi. Tailwind siniflari
 * derleme zamaninda uretir; `start-[137px]` gibi bir sinifi calisma zamaninda
 * uydurmak JIT taramasindan kacar ve stil HIC olusmaz. Dinamik sayilar inline
 * stile aittir -- Tailwind'in kendi tavsiyesi de bu.
 */
export function getPinnedStyle<TData extends RowData>(
  column: GridColumn<TData>,
  isHeader: boolean,
): CSSProperties {
  const pinned = column.getIsPinned();

  if (pinned === false) {
    // Baslik icinde: sabit olmayan th, sabit th'nin ALTINDA kalmali.
    // Deger kucuk cunku `<thead>`in kendi yigin baglami icindeyiz.
    return isHeader ? { zIndex: 1 } : {};
  }

  return {
    position: "sticky",
    zIndex: isHeader ? 2 : 20,
    ...(pinned === "start"
      ? { insetInlineStart: column.getStart("start") }
      : { insetInlineEnd: column.getAfter("end") }),
  };
}

/**
 * Sabit blogun IC KENARINDAKI kolonu isaretler -- golge oraya cizilecek.
 *
 * Golge, kullaniciya "buradan sonrasi kayiyor" diyen tek isaret. Olmazsa
 * sabit kolon, yatayda kaydirirken altindan gecen icerikle gorsel olarak
 * karisir ve kullanici neyin neden yerinde durdugunu anlamaz.
 *
 * Golgeyi HER sabit kolona koymak yanlis olurdu: bitisik sabit kolonlar
 * arasinda cizgiler birikir ve arayuz kirlenir. Yalnizca blogun ic kenari.
 */
export function getPinnedEdge<TData extends RowData>(
  column: GridColumn<TData>,
): "start" | "end" | undefined {
  const pinned = column.getIsPinned();
  if (pinned === false) return undefined;

  const index = column.getPinnedIndex();

  if (pinned === "start") {
    const siblings = column.table.getStartVisibleLeafColumns();
    return index === siblings.length - 1 ? "start" : undefined;
  }

  return index === 0 ? "end" : undefined;
}
