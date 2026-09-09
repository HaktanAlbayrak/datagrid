import type { RowData } from "@tanstack/react-table";

import type { GridColumn } from "./pinning";

/**
 * Kolonun INSAN OKUYABILIR adi.
 *
 * ---
 * NEDEN AYRI BIR FONKSIYON?
 *
 * Ayni uc satir dort ayri yerde tekrarlaniyordu (kolon secici, filtre
 * popup'i, disa aktarma basliklari, ice aktarma eslestirmesi) ve simdi
 * gruplama paneli ile ozet satiri da ayni seye ihtiyac duyuyor. Altincida
 * kopyalamak yerine tek yere tasindi -- kural degisirse (ornegin ileride
 * `meta.label` eklenirse) alti yerin ALTISI birden degisiyor.
 *
 * ---
 * NEDEN `columnDef.header` HER ZAMAN KULLANILAMIYOR?
 *
 * `header` bir REACT BILESENI olabilir (ikon + metin, rozet, ozel duzen) --
 * ekranda dogru, ama bir menu ogesinde ya da CSV baslik satirinda
 * `[object Object]` yazar. Dize degilse kolon kimligine dusuyoruz: "amount"
 * mukemmel bir etiket degil ama HICBIR SEYDEN, hatta yanlis bir seyden iyi.
 *
 * Ozel bir baslik cizen kolonun etiketini duzeltmenin yolu `meta`ya deger
 * yazmak degil, `header`i dize tutup suslemeyi hucreye tasimak.
 */
export function columnLabel<TData extends RowData>(
  column: GridColumn<TData>,
): string {
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
}
