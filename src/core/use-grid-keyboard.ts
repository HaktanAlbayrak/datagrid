import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface CellPosition {
  /** Gorunen satirlar icindeki indeks (0 tabanli). Baslik icin -1. */
  row: number;
  /** Gorunen kolonlar icindeki indeks (0 tabanli). */
  col: number;
}

export interface UseGridKeyboardOptions {
  gridRef: RefObject<HTMLElement | null>;
  rowCount: number;
  colCount: number;
  /** Sanallastirma acikken satiri gorunur alana getirir. */
  scrollToRow?: (index: number) => void;
  /** Bir sayfa kac satir? PageUp/PageDown bu kadar atliyor. */
  pageSize?: number;
  enabled?: boolean;
}

/**
 * IZGARA KLAVYE NAVIGASYONU -- ARIA "grid" deseni.
 *
 * ---
 * NEDEN GEREKLI? (ve neden `role="grid"` bugune kadar YAZILMADI)
 *
 * `role="grid"`, ekran okuyucuya "burada hucre hucre gezilebilir bir yapi
 * var" diye SOZ VERIYOR. Davranisi yazmadan rolu koymak, kullaniciyi ok
 * tuslarina basip hicbir sey olmayan bir tabloya hapsetmek olurdu. Bu
 * yuzden rol, tam da bu kanca yazildiginda eklendi -- once soz, sonra
 * tutmak degil; once tutmak, sonra soz.
 *
 * ---
 * GEZINEN ODAK (roving tabindex).
 *
 * Tek bir hucre `tabIndex=0`, digerleri `-1`. Boylece Tab tusu izgaraya
 * BIR KEZ giriyor ve bir kez cikiyor; icerideki gezinme ok tuslariyla.
 *
 * Alternatif her hucreye `tabIndex=0` vermekti: 25 satir × 10 kolon = 250
 * Tab duragi. Klavye kullanicisi icin izgara gecilmez bir duvar olurdu.
 *
 * ---
 * IKI KIP: GEZINME ve EYLEM.
 *
 * Gezinme kipinde odak HUCREDE; ok tuslari hucreler arasi gezer.
 * Enter/F2 hucrenin ICINE giriyor (dugme, onay kutusu, duzenleme girdisi).
 * Escape geri cikiyor.
 *
 * Bu ayrim olmadan ok tuslari hem gezinmek hem girdi icinde imlec
 * tasimak icin yarisirdi -- ikisi de calismaz olurdu. ARIA'nin izgara
 * deseninin varlik sebebi bu ayrim.
 */
export function useGridKeyboard({
  gridRef,
  rowCount,
  colCount,
  scrollToRow,
  pageSize = 10,
  enabled = true,
}: UseGridKeyboardOptions) {
  const [focused, setFocused] = useState<CellPosition | null>(null);

  /**
   * "Eylem kipinde miyiz?" -- odak hucrenin ICINDEKI bir denetime gecti mi?
   *
   * `ref` cunku her tus basiminda okunuyor ama yeniden cizim gerektirmiyor;
   * durum olsaydi her giris/cikista tum izgara yeniden cizilirdi.
   */
  const isActionMode = useRef(false);

  /** Odagi DOM'a uygular. Hucre `data-cell="satir:kolon"` ile bulunuyor. */
  const focusCell = useCallback(
    (position: CellPosition) => {
      const grid = gridRef.current;
      if (grid === null) return;

      const selector = `[data-cell="${position.row}:${position.col}"]`;
      const cell = grid.querySelector<HTMLElement>(selector);

      if (cell === null) {
        /*
          HUCRE HENUZ CIZILMEMIS OLABILIR -- sanallastirma.

          Odak gorunur pencerenin disindaki bir satira giderse o satirin DOM
          karsiligi yok. Once kaydiriyoruz; satir cizildikten SONRA (bir
          sonraki cerceve) odak veriliyor. Bu adim olmadan ok tusuyla
          listenin sonuna inmek imkansiz olurdu.
        */
        scrollToRow?.(position.row);
        requestAnimationFrame(() => {
          grid.querySelector<HTMLElement>(selector)?.focus();
        });
        return;
      }

      cell.focus();
      // `block: "nearest"`: hucre zaten gorunuyorsa SAYFAYI OYNATMIYOR.
      // "center" yazsaydik her ok tusunda liste zipplardi.
      cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    [gridRef, scrollToRow],
  );

  const move = useCallback(
    (next: CellPosition) => {
      // Sinirlar KIRPILIYOR, dongu YOK. Son satirdan asagi basinca basa
      // donmek, kullanicinin "listenin sonundayim" bilgisini siliyor.
      const clamped: CellPosition = {
        row: Math.max(-1, Math.min(rowCount - 1, next.row)),
        col: Math.max(0, Math.min(colCount - 1, next.col)),
      };
      setFocused(clamped);
      focusCell(clamped);
    },
    [rowCount, colCount, focusCell],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!enabled) return;

      /*
        TUSLARIN SAHIBI KIM? -- olayin HEDEFINE bakiyoruz, kipe degil.

        OLCULEN HATA: bu kontrol once yoktu, yalnizca `isActionMode` vardi.
        Kolon genisligi ayarlayan tutamak (`role="separator"`, basligin
        ICINDE) ok tuslariyla calisiyor; olay basliga, oradan tabloya
        KABARIYOR ve buradaki `switch` ArrowRight'i kapip odagi bir sonraki
        hucreye tasiyordu. Testte gorunusu: iki ok basimindan yalnizca biri
        genisligi degistirdi (150 -> 166, beklenen 170).

        `isActionMode` bunu yakalayamazdi: tutamaga Tab ya da fareyle de
        girilebiliyor, Enter'la degil. Yani "kip" bayragi odagin GERCEKTEN
        nerede oldugunu bilmiyor -- DOM biliyor.

        Kural: olayin hedefi HUCRENIN KENDISI (`data-cell` tasiyan eleman)
        degilse tuslar hucre icindeki denetime aittir; dokunmuyoruz. Metin
        girdisinde sol/sag okun imleci tasimasi da ayni kuralla korunuyor.
        Tek istisna Escape: kullaniciyi hucreye geri cikariyor.
      */
      const target = event.target as HTMLElement;
      if (!target.hasAttribute("data-cell")) {
        if (event.key === "Escape" && isActionMode.current) {
          event.preventDefault();
          isActionMode.current = false;
          // Buradaki hedef hucrenin ICINDEKI denetim; adresi en yakin
          // hucreden okuyoruz (durum bayat olabilir, DOM olamaz).
          const owner = target.closest<HTMLElement>("[data-cell]");
          const parts = owner?.dataset.cell?.split(":");
          focusCell(
            parts === undefined
              ? (focused ?? { row: -1, col: 0 })
              : { row: Number(parts[0]), col: Number(parts[1]) },
          );
        }
        return;
      }

      // Hucrenin kendisinde bile olsa, bir sey olayi ZATEN ele aldiysa
      // uzerine yazmiyoruz.
      if (event.defaultPrevented) return;

      /*
        ODAGIN NEREDE OLDUGUNU DOM SOYLUYOR, DURUM DEGISKENI DEGIL.

        Once `focused` durumundan okuyordum. OLCULEN HATA: bir hucreye odak
        verilip HEMEN ardindan tusa basildiginda (fareyle tiklayip aninda ok
        tusuna basmak, ya da bir betigin `focus()` + tus dizisi) React'in
        durum guncellemesi henuz islenmemis oluyor ve kanca "hicbir yerde
        degilim" varsayimiyla basliktan (-1,0) baslatiyordu. Tarayicida
        olcum: `0:2` hucresinden ArrowDown, `1:2` yerine `0:0` verdi.

        `data-cell` her zaman GERCEK odagin adresi -- React'in ne zaman
        yeniden cizdiginden bagimsiz. Durum yalnizca `tabIndex` dagitimi
        icin duruyor; navigasyonun dogrulugu ona bagli degil.
      */
      const parsed = target.dataset.cell?.split(":");
      const current: CellPosition =
        parsed === undefined
          ? (focused ?? { row: -1, col: 0 })
          : { row: Number(parsed[0]), col: Number(parsed[1]) };

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          move({ ...current, row: current.row + 1 });
          break;
        case "ArrowUp":
          event.preventDefault();
          move({ ...current, row: current.row - 1 });
          break;
        case "ArrowRight":
          event.preventDefault();
          move({ ...current, col: current.col + 1 });
          break;
        case "ArrowLeft":
          event.preventDefault();
          move({ ...current, col: current.col - 1 });
          break;
        case "Home":
          event.preventDefault();
          // Ctrl+Home: izgaranin BASI. Duz Home: satirin basi.
          // Elektronik tablolarin ortak sozlesmesi.
          move(event.ctrlKey ? { row: 0, col: 0 } : { ...current, col: 0 });
          break;
        case "End":
          event.preventDefault();
          move(
            event.ctrlKey
              ? { row: rowCount - 1, col: colCount - 1 }
              : { ...current, col: colCount - 1 },
          );
          break;
        case "PageDown":
          event.preventDefault();
          move({ ...current, row: current.row + pageSize });
          break;
        case "PageUp":
          event.preventDefault();
          move({ ...current, row: current.row - pageSize });
          break;
        case "Enter":
        case "F2": {
          /*
            EYLEM KIPINE GIRIS.

            Hucrenin ICINDEKI ilk odaklanabilir denetime geciyoruz. Hucrede
            denetim yoksa hicbir sey yapmiyoruz -- salt okunur bir hucrede
            Enter'in bir anlami yok.
          */
          const grid = gridRef.current;
          const cell = grid?.querySelector<HTMLElement>(
            `[data-cell="${current.row}:${current.col}"]`,
          );
          const control = cell?.querySelector<HTMLElement>(
            'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );

          if (control !== null && control !== undefined) {
            event.preventDefault();
            isActionMode.current = true;
            control.focus();
            // Dugme ise ayrica TIKLIYORUZ: Enter'in dogal davranisi bu ve
            // kullanici iki kez basmak zorunda kalmamali.
            if (control.tagName === "BUTTON") control.click();
          }
          break;
        }
        default:
          break;
      }
    },
    [enabled, focused, move, focusCell, rowCount, colCount, pageSize, gridRef],
  );

  /**
   * Odak izgaradan CIKARSA eylem kipini sifirla.
   *
   * Kullanici fareyle baska bir yere tiklarsa `isActionMode` acik kalirdi
   * ve izgaraya donunce ok tuslari calismazdi -- sebebini anlamasi imkansiz
   * bir "bozukluk".
   */
  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null) return;

    const onFocusOut = (event: FocusEvent) => {
      if (!grid.contains(event.relatedTarget as Node | null)) {
        isActionMode.current = false;
      }
    };

    grid.addEventListener("focusout", onFocusOut);
    return () => grid.removeEventListener("focusout", onFocusOut);
  }, [gridRef]);

  return {
    focused,
    onKeyDown,
    /**
     * Bir hucrenin `tabIndex` degeri.
     *
     * Hicbir hucre odakli degilse ILK VERI HUCRESI `0` aliyor: Tab ile
     * izgaraya giren kullanici bos bir kabuga degil, ilk kayda dusuyor.
     */
    getTabIndex: (row: number, col: number) => {
      if (focused === null) return row === 0 && col === 0 ? 0 : -1;
      return focused.row === row && focused.col === col ? 0 : -1;
    },
    /** Fareyle tiklanan hucre odak sayilir; klavye oradan devam ediyor. */
    onCellFocus: (row: number, col: number) => {
      setFocused((old) =>
        old?.row === row && old.col === col ? old : { row, col },
      );
    },
  };
}
