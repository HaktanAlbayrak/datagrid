import { CheckIcon, MinusIcon } from "lucide-react";
import { type ChangeEvent, useEffect, useRef } from "react";

import { cn } from "../lib/cn";

/**
 * UC DURUMLU ONAY KUTUSU: isaretli / isaretsiz / KARARSIZ (indeterminate).
 *
 * NEDEN YERLI `<input type="checkbox">`, Base UI DEGIL?
 * Bir onay kutusunun "kararsiz" hali DOM'da bir OZELLIK degil, bir DOM
 * ALANI (`el.indeterminate`). HTML ozniteligi olarak yazilamaz, yalnizca
 * JavaScript'ten atanir -- bu yuzden React onu `checked` gibi otomatik
 * yonetmez ve her sarmalayici kutuphane kendi cozumunu uydurur.
 *
 * Agac izgarasinda bu hal ISTISNA DEGIL KURAL: bir ust satirin cocuklarindan
 * bazilari secili oldugunda gosterilecek tek dogru sey budur. Davranisin tam
 * kontrolunu tasimak, bir bagimliligin bunu nasil yorumladigina bagli
 * kalmaktan iyi.
 *
 * Yerli input GORSEL olarak gizli (`sr-only` degil, `appearance-none` +
 * konumlandirma): boylece odak, klavye ve ekran okuyucu davranisi TARAYICIDAN
 * geliyor -- `role="checkbox"` taklidi yapan bir div'in yeniden uretmek
 * zorunda kalacagi her sey bedava.
 */
export function GridCheckbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  /**
   * OLAYI DA GECIYORUZ, yalnizca `checked` degil.
   *
   * TanStack'in secim isleyicisi SHIFT tusunu okuyup aralik secimi yapiyor
   * (DevExtreme'de de var olan davranis). Modifiye tuslari yalnizca ORIJINAL
   * olayda bulunuyor; sadece `boolean` gecseydik aralik secimi imkansiz olurdu.
   *
   * React'in `onChange`i onay kutularinda gercekte bir TIKLAMADAN turer ve
   * `nativeEvent` orijinal tiklamayi tasir -- bu yuzden ayrica `onClick`
   * baglamaya gerek yok.
   */
  onCheckedChange: (
    checked: boolean,
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current !== null) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={cn("relative inline-flex size-4 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked, event)}
        // Tiklama satir secimini de tetiklemesin: satira tiklamak ayri bir
        // eylem (detay acma) olabiliyor.
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "peer size-4 cursor-pointer appearance-none rounded-[4px] border border-input bg-background outline-none",
          "checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      {/* Isaret input'un USTUNE ciziliyor; `pointer-events-none` olmasa
          tiklamayi yutar ve kutu tiklanamaz hale gelirdi. */}
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-primary-foreground peer-checked:flex peer-indeterminate:hidden">
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-primary-foreground peer-indeterminate:flex">
        <MinusIcon className="size-3" strokeWidth={3} />
      </span>
    </span>
  );
}
