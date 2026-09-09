import type * as React from "react";

import { cn } from "../lib/cn";

type Variant = "ghost" | "outline";
type Size = "sm" | "icon";

const VARIANTS: Record<Variant, string> = {
  ghost: "hover:bg-accent hover:text-accent-foreground",
  outline:
    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 rounded-md px-2 text-xs",
  icon: "size-7 rounded-md",
};

/**
 * Paket ici buton -- shadcn'in `Button`unun kucuk bir alt kumesi.
 *
 * `class-variance-authority` KULLANMADIK. cva iyi bir kutuphane ama burada
 * iki varyant ve iki boyut var; bunun icin bir calisma zamani bagimliligi
 * eklemek, tuketicinin `node_modules`una bizim tercihimizi dayatmak olurdu.
 * Iki `Record` ayni isi yapiyor ve tip guvenligi ayni.
 *
 * Dis dunyaya ACMIYORUZ (index.ts'te yok): bu bir tasarim sistemi butonu
 * degil, izgaranin ic parcasi. Acsaydik tuketici onu kullanmaya baslar ve
 * biz stilini degistirdigimizde onun arayuzu bozulurdu.
 */
export function GridButton({
  variant = "ghost",
  size = "sm",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
