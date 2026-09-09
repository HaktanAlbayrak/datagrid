import type * as React from "react";

import { cn } from "../lib/cn";

/**
 * Izgara ici girdi -- filtre satiri ve arama kutusu icin.
 *
 * `h-7` ve `text-xs`: filtre satiri BASLIGIN ALTINDA duruyor ve veri
 * satirlariyla ayni dikey ritmi bozmamali. Standart form girdisi (h-9)
 * kullansaydik filtre satiri iki veri satiri yuksekliginde olur ve ekranda
 * gorulen kayit sayisi duserdi -- bir izgarada en pahali sey dikey alan.
 */
export function GridInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        // `ps-2 pe-2` (mantiksal), `px-2` DEGIL.
        //
        // Tuketici "solda ikon var" diyip `ps-7` gecmek isteyebilir. `px-2`
        // yazsaydik iki sinif da CSS uretir ve kazanani sinif sirasi degil
        // STIL SAYFASINDAKI SIRA belirlerdi -- yani tuketicinin ezmesi
        // bazen calisir bazen calismaz. `ps-2`, `ps-7` ile TAM ayni ozelligi
        // hedefliyor; `tailwind-merge` cakismayi gorup oncekini siliyor.
        // Yan fayda: RTL'de dolgu dogru tarafta.
        "h-7 w-full min-w-0 rounded-md border border-input bg-background ps-2 pe-2 text-foreground text-xs",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
