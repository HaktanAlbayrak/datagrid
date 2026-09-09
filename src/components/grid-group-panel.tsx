import type { RowData } from "@tanstack/react-table";
import { GroupIcon, XIcon } from "lucide-react";

import { columnLabel } from "../core/column-label";
import type { GridTable } from "../core/use-grid-table";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";
import {
  GridMenu,
  GridMenuCheckboxItem,
  GridMenuContent,
  GridMenuLabel,
  GridMenuSeparator,
  GridMenuTrigger,
} from "../primitives/menu";

/**
 * GRUPLAMA PANELI: hangi kolonlara gore, hangi SIRAYLA gruplandi.
 *
 * ---
 * NEDEN "BASLIGI BURAYA SURUKLEYIN" DEGIL?
 *
 * DevExtreme'in tanidik "group panel"i basliklarin surukleyip birakilmasiyla
 * calisiyor. Bilincli olarak YAPMADIK:
 *
 *   1. BEDELI: surukle-birak bir bagimlilik (dnd-kit ~30 KB) demek ve bu
 *      bedeli, gruplamayi hic kullanmayan tuketiciler de oduyor.
 *   2. ERISILEBILIRLIK: surukle-birak klavyeyle calismiyor -- ya da
 *      calissin diye ayrica klavye yolu yazmak gerekiyor. O yolu zaten
 *      yazacaksak, tek basina yeterli.
 *   3. KESFEDILEBILIRLIK: "basligi buraya surukleyin" yazisi, bos bir panel
 *      olmadan gorunmuyor; bos panel ise hicbir sey yapmayan bir seride
 *      dikey yer harciyor.
 *
 * Yerine: acilir listeden secme (klavyeyle calisiyor, ekran okuyucu
 * anlatiyor) + secilenleri gosteren rozetler. Ayni yetenek, ucte bir kod,
 * sifir bagimlilik.
 *
 * ---
 * ROZETLER NUMARALI: sira ANLAM tasiyor.
 *
 * "Once Durum, sonra Tip" ile "once Tip, sonra Durum" TAMAMEN farkli iki
 * agac uretiyor. Numara olmasaydi kullanici hangi kirilimin ustte oldugunu
 * ancak tabloya bakip tahmin ederdi.
 */
export function GridGroupPanel<TData extends RowData>({
  table,
  className,
}: {
  table: GridTable<TData>;
  className?: string;
}) {
  const grouping = table.state.grouping;
  const groupable = table
    .getAllLeafColumns()
    .filter((column) => column.getCanGroup());

  // Gruplanabilir kolon yoksa panel de yok: her kolonu `enableGrouping:
  // false` olan bir izgarada bu serit hicbir sey yapamaz.
  if (groupable.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <GridMenu>
        <GridMenuTrigger
          render={<GridButton variant="outline" />}
          title="Satırları bir kolona göre grupla"
        >
          <GroupIcon className="size-3.5" />
          Grupla
          {grouping.length > 0 && (
            <span className="rounded bg-primary px-1 font-medium text-[10px] text-primary-foreground tabular-nums">
              {grouping.length}
            </span>
          )}
        </GridMenuTrigger>

        <GridMenuContent className="max-h-72">
          <GridMenuLabel>Gruplama kolonları</GridMenuLabel>
          <GridMenuSeparator />
          {groupable.map((column) => (
            <GridMenuCheckboxItem
              key={column.id}
              checked={column.getIsGrouped()}
              onCheckedChange={() => column.toggleGrouping()}
            >
              {columnLabel(column)}
            </GridMenuCheckboxItem>
          ))}
        </GridMenuContent>
      </GridMenu>

      {grouping.map((columnId, index) => {
        const column = table.getColumn(columnId);
        if (column === undefined) return null;

        return (
          <span
            key={columnId}
            className="flex items-center gap-1 rounded-md bg-primary/10 py-1 ps-1.5 pe-1 font-medium text-primary text-xs"
          >
            <span className="flex size-4 items-center justify-center rounded-sm bg-primary/20 tabular-nums">
              {index + 1}
            </span>
            {columnLabel(column)}
            <button
              type="button"
              onClick={() => column.toggleGrouping()}
              // Etiket kolon adini ICERIYOR: ekran okuyucu bes tane "Kaldır"
              // dugmesi arasinda hangisinin hangisi oldugunu baska turlu
              // soyleyemez.
              aria-label={`${columnLabel(column)} gruplamasını kaldır`}
              className="rounded p-0.5 hover:bg-primary/20"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        );
      })}

      {grouping.length > 0 && (
        <GridButton
          variant="ghost"
          onClick={() => table.resetGrouping(true)}
          title="Gruplamayı kaldır"
        >
          Gruplamayı temizle
        </GridButton>
      )}
    </div>
  );
}
