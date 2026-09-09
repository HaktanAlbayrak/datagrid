import type * as React from "react";

import { cn } from "../lib/cn";

/**
 * YERLESIK `<select>` -- ozel bir acilir liste DEGIL.
 *
 * ---
 * NEDEN?
 *
 * Filtre kurucusunda bir satirda UC secim birden var (alan, islec, bazen
 * deger). Bunlari ozel bileşenle yapmak her birine odak yonetimi, klavye
 * gezinmesi ve konumlandirma yazmak demek -- ve bunlarin hepsini tarayici
 * `<select>` icin ZATEN yapiyor, ustelik dokunmatik cihazlarda yerel bir
 * secici acarak.
 *
 * Ozel bir liste yalnizca gorunum icin kazandiriyor; erisilebilirlik ve
 * mobil davranis tarafinda kaybettiriyor. Bir filtre satirinda gorunum,
 * ucuncu sirada gelen bir kaygi.
 *
 * (Kolon secicide `Menu`, filtre baloncugunda `Popover` kullaniyoruz --
 * onlar acilir MENU; burada bir FORM ALANI var. Farkli isler, farkli
 * araclar.)
 *
 * ---
 * `appearance-none` YOK.
 *
 * Yerel oku silip kendi ikonumuzu koymak sik durur ama Windows yuksek
 * kontrast kipinde ve bazi tarayicilarda okun tamamen kaybolmasina yol
 * aciyor. Yerel gorunumu birakmak, "bu bir acilir liste" bilgisini her
 * ortamda koruyor.
 */
export function GridSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-7 rounded-md border border-input bg-background px-1.5 text-xs",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
