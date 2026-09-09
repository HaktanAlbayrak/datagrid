import { useVirtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";

export interface GridVirtualizerOptions {
  /** Kaydirma kabi. `DataGrid` kendi `div`ini veriyor. */
  scrollRef: RefObject<HTMLDivElement | null>;
  rowCount: number;
  /** Tahmini satir yuksekligi (px). Olculdukce duzeltiliyor. */
  estimateSize?: number;
  /** Gorunur alanin disinda kac satir cizilsin? */
  overscan?: number;
  enabled: boolean;
}

/**
 * SATIR SANALLASTIRMA.
 *
 * ---
 * NEDEN GEREKLI?
 *
 * Sayfa boyutu 200 secildiginde tarayici 200 × kolon sayisi kadar DOM
 * dugumu ciziyor. 10 kolonla 2.000 hucre; her hucrede bir React bileseni,
 * bir `Subscribe` aboneligi. Ilk boyama gozle gorulur sekilde gecikiyor ve
 * kaydirma takiliyor. Sanallastirma yalnizca GORUNEN ~20 satiri ciziyor:
 * DOM sabit kaliyor, sayfa boyutu 25 de olsa 500 de olsa.
 *
 * ---
 * MUTLAK KONUMLANDIRMA DEGIL, DOLGU SATIRLARI.
 *
 * Yaygin yaklasim satirlari `position: absolute` ile yerlestirmek. Bir
 * `<table>` icinde bu YIKICI: `<tr>` mutlak konumlandirilinca tablo
 * yerlesiminden cikiyor, hucre genislikleri kolonlarla hizasini kaybediyor
 * ve dondurulmus kolonlarin `sticky` ofsetleri anlamsizlasiyor.
 *
 * Bunun yerine ustte ve altta YUKSEKLIGI OLAN BOS `<tr>`ler biraktik.
 * Tablo yerlesimi bozulmuyor, `colgroup` genislikleri gecerli kalıyor,
 * yapiskan baslik ve dondurulmus kolonlar oldugu gibi calisiyor.
 * Kaydirma cubugunun boyu da dogru cikiyor cunku toplam yukseklik gercek.
 *
 * ---
 * `enabled` BAYRAGI: KOSULLU KANCA YAZMAMAK ICIN.
 *
 * Sanallastirmayi kapatmak icin "kancayi cagirma" diyemeyiz -- React'in
 * kurali kancalarin kosulsuz cagrilmasi. Bunun yerine sanal satir sayisini
 * 0 yapip cagiran tarafta gormezden geliyoruz.
 */
export function useGridVirtualizer({
  scrollRef,
  rowCount,
  estimateSize = 37,
  overscan = 8,
  enabled,
}: GridVirtualizerOptions) {
  const virtualizer = useVirtualizer({
    count: enabled ? rowCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    /**
     * `measureElement`: gercek satir yuksekligini olcup tahmini duzeltiyor.
     *
     * Tahmin sabit kalsaydi, icerigi tasan bir satir (uzun baslik, cok
     * etiket) kaydirma konumunu kaydirirdi: kullanici asagi indikce
     * satirlar "atlamaya" baslardi. Olcum bunu kendiliginden duzeltiyor.
     *
     * Firefox'ta `getBoundingClientRect` kesirli deger dondurdugu icin
     * yuvarlama farki birikebiliyor; TanStack Virtual bunu kendi icinde
     * ele aliyor.
     */
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const items = enabled ? virtualizer.getVirtualItems() : [];
  const first = items[0];
  const last = items.at(-1);

  return {
    virtualizer,
    items,
    /** Ustteki dolgu satirinin yuksekligi. */
    paddingTop: first === undefined ? 0 : first.start,
    /** Alttaki dolgu satirinin yuksekligi. */
    paddingBottom:
      last === undefined ? 0 : virtualizer.getTotalSize() - last.end,
  };
}
