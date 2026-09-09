import type * as React from "react";

import { cn } from "../lib/cn";

/**
 * TABLO ILKELLERI -- shadcn'in `table.tsx`inin paket ici kopyasi.
 *
 * NEDEN TUKETICININ shadcn KURULUMUNU KULLANMIYORUZ?
 * Kullanamayiz. shadcn bir kutuphane degil, KOD URETICI: bilesenler
 * tuketicinin deposuna kopyalaniyor ve `@/components/ui/table` yolu bizim
 * paketimizden cozulemiyor. Ustelik tuketici o dosyayi degistirmis olabilir.
 *
 * Peki gorunum nasil tutuyor? Cunku burasi da AYNI CSS DEGISKENLERINI okuyor
 * (`--background`, `--muted`, `--border`...). shadcn'in tema modeli zaten bu:
 * bilesenler degiskenlere bakar, degiskenler tuketicinin `globals.css`inde
 * tanimlidir. Yani kod ayri, TEMA ORTAK.
 *
 * `role`/`aria` ozellikleri BILEREK burada yok: eriseilebilirlik anlamini
 * `DataGrid` veriyor (`role="grid"`, `aria-rowcount`...). Ilkeller "aptal"
 * kalmali ki hem grid hem duz tablo icin kullanilabilsinler.
 */

export function GridTable({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="grid-table"
      className={cn(
        "w-full caption-bottom border-separate border-spacing-0 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function GridHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return <thead data-slot="grid-header" className={cn(className)} {...props} />;
}

export function GridBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return <tbody data-slot="grid-body" className={cn(className)} {...props} />;
}

export function GridFooter({
  className,
  ...props
}: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="grid-footer"
      className={cn("bg-muted/50 font-medium", className)}
      {...props}
    />
  );
}

export function GridRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="grid-row"
      className={cn(
        "group/row transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function GridHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="grid-head"
      className={cn(
        // `border-separate` + hucre kenarligi kullaniyoruz, satir kenarligi
        // DEGIL: yapiskan (sticky) baslikta satir kenarligi kayar cunku
        // `border-collapse` modunda kenarlik hucreye degil TABLOYA aittir.
        "relative h-9 select-none border-border border-b bg-background px-2 text-left align-middle font-medium text-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function GridCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="grid-cell"
      className={cn(
        "border-border/60 border-b px-2 py-1.5 align-middle",
        className,
      )}
      {...props}
    />
  );
}
