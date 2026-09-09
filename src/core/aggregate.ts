import type { Row, RowData } from "@tanstack/react-table";
import type { ReactNode } from "react";

import type { GridFeatures } from "./features";
import type { GridColumn } from "./pinning";

/**
 * Ozet degerlerinin varsayilan bicimi.
 *
 * `undefined` locale: TARAYICININ dili. Sabit bir dil yazsaydik (ornegin
 * "tr-TR") paketi kullanan her uygulama Turkce ayirac gorurdu; kullanicinin
 * kendi ayarini ezmek bir kutuphanenin isi degil.
 *
 * Kesir siniri 2: ortalama (`mean`) hesaplari 13 basamakli kuyruklar
 * uretebiliyor ve bir ozet satirinda "1.333333333333" okunabilir bilgi
 * degil, gurultudur. Daha fazlasi gerekiyorsa `meta.formatAggregate` var.
 */
const NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

/** Ozet degerini ekrana yazilabilir hale getiriyor. */
export function formatAggregateValue<TData extends RowData>(
  column: GridColumn<TData>,
  value: unknown,
): ReactNode {
  const custom = column.columnDef.meta?.formatAggregate;
  if (custom !== undefined) return custom(value);

  // Bos grup ya da sayisal degeri olmayan kolon: TIRE.
  // "0" yazmak YANLIS BILGI olurdu -- "hic kayit yok" ile "toplami sifir"
  // ayni sey degil ve bir ozet satirinda bu ayrim tam da onemli olan sey.
  if (value === null || value === undefined) return "—";

  if (typeof value === "number") {
    return Number.isFinite(value) ? NUMBER_FORMAT.format(value) : "—";
  }
  if (value instanceof Date) return value.toLocaleDateString();

  return String(value);
}

/**
 * Bu kolon OZETLENIYOR mu? -- tek yetkili kaynak `meta.aggregate`.
 *
 * ---
 * NEDEN TanStack'IN `cell.getIsAggregated()`I DEGIL?
 *
 * OLCULEN HATA: `rowAggregationFeature`in varsayilan kolon tanimi
 * `aggregationFn: "auto"` iceriyor -- yani HER kolon, ilk satirdaki degerin
 * tipine bakip kendine bir ozet fonksiyonu seciyor. Sayisal her kolon
 * otomatik TOPLANIYOR.
 *
 * Tarayicida gorunusu: "Tip"e gore gruplayinca kart NUMARASI kolonu grup
 * basliklarinda 91, 72, 78, 84 gosterdi. Bunlar kimlik numaralarinin
 * toplami: hicbir anlami olmayan, ama tam da anlamli duracak bicimde
 * bicimlenmis dort sayi. Kullanicinin bunu fark etmesinin yolu yok.
 *
 * Otomatik cikarim tip bilgisinden ANLAM cikarmaya calisiyor ve sayisal
 * olmak "toplanabilir" demek degil (kimlik, yil, posta kodu, oda numarasi).
 * Bu yuzden ozet OPT-IN: yalnizca `meta.aggregate` yazan kolonlar.
 */
export function hasAggregate<TData extends RowData>(
  column: GridColumn<TData>,
): boolean {
  const aggregate = column.columnDef.meta?.aggregate;
  return aggregate !== undefined && aggregate !== false;
}

/** Bu kolon alttaki GENEL TOPLAM satirinda yer aliyor mu? */
export function hasSummary<TData extends RowData>(
  column: GridColumn<TData>,
): boolean {
  if (!hasAggregate(column)) return false;
  return column.columnDef.meta?.summary ?? true;
}

/**
 * GENEL TOPLAM: tum FILTRELENMIS satirlar uzerinden.
 *
 * ---
 * NEDEN SAYFADAKI SATIRLAR DEGIL?
 *
 * Sayfadaki 25 satirin toplamini gostermek, ozet satirini kullanicinin
 * sordugu soruya cevap VERMEYEN bir sayiya cevirir: kimse "su anda ekranda
 * duran 25 kaydin toplami" merak etmiyor, "bu filtreye uyan her seyin
 * toplami" merak ediliyor. Ustelik sayfa degistikce degisen bir "toplam",
 * yanlis oldugu fark edilene kadar guvenilir sanilir.
 *
 * Filtrelenmis model, filtreye TABI ama sayfalamaya tabi degil -- istenen
 * tam olarak bu.
 *
 * ---
 * SUNUCU TARAFLI IZGARADA SINIR.
 *
 * `manualFiltering`/`manualPagination` acikken istemcide yalnizca O SAYFA
 * var; buradaki toplam "gorunen sayfanin toplami" olur. Dogru toplami ancak
 * sunucu hesaplayabilir. Bu yuzden sunucu modunda ozet satirini ya
 * kapatiyor ya da toplami sunucudan alip `meta.formatAggregate` ile
 * yaziyorsunuz -- sessizce yanlis bir sayi gostermektense.
 *
 * ---
 * AGACTA: KOK satirlar toplaniyor (`maxDepth` varsayilani).
 *
 * Kok + cocuk birlikte toplansaydi CIFT SAYIM olurdu. Kokler, kullanicinin
 * ust seviyede gordugu kayitlar; toplamin onlarla ayni duzlemde olmasi
 * beklentiye uyuyor.
 */
export function getSummaryValue<TData extends RowData>(
  column: GridColumn<TData>,
  rows: ReadonlyArray<Row<GridFeatures, TData>>,
): unknown {
  return column.getAggregationValue<unknown>({ rows });
}
