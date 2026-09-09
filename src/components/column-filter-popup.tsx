import type { RowData } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { FilterIcon, FilterXIcon } from "lucide-react";

import type { GridColumn } from "../core/pinning";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";
import {
  GridPopover,
  GridPopoverContent,
  GridPopoverTrigger,
} from "../primitives/popover";
import { ColumnFilter } from "./column-filter";

/**
 * BASLIKTAKI FILTRE DUGMESI + BALONCUK.
 *
 * ---
 * NEDEN SATIR YERINE POPUP? (ikisi de duruyor, varsayilan bu)
 *
 * Filtre satiri her zaman ekranda ve bu iki bedeli var:
 *   1. DIKEY ALAN. Bir izgarada en kit kaynak satir sayisi; kalici filtre
 *      satiri her ekranda bir veri satiri yiyor.
 *   2. GORSEL GURULTU. Sekiz kolonun sekizinde de bos kutu duruyor, oysa
 *      kullanici genelde BIR kolona gore filtreliyor.
 *
 * Popup, filtreyi ihtiyac aninda getiriyor ve baslikta yalnizca kucuk bir
 * huni ikonu birakiyor. DevExtreme'in "header filter"i da boyle calisiyor.
 *
 * Filtre satiri yine de duruyor (`filterMode="row"`): ARDISIK filtreleme
 * yapan kullanici -- birkac kolonu ust uste daraltan biri -- her seferinde
 * popup acmak istemez. Iki farkli kullanim, iki farkli mod.
 *
 * ---
 * ETKIN FILTRE HER ZAMAN GORUNUR.
 *
 * Popup kapaliyken filtrenin varligini gosteren tek sey bu ikon. Dolu ikon +
 * vurgulu renk olmasaydi kullanici "veri neden eksik?" diye sorar ve cevabi
 * bir baslikta gizli duran popup'ta ararsa bulamazdi.
 */
export function ColumnFilterPopup<TData extends RowData>({
  column,
}: {
  column: GridColumn<TData>;
}) {
  if (column.columnDef.meta?.filter === false || !column.getCanFilter()) {
    return null;
  }

  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() => column.getFilterValue() !== undefined}
    >
      {(isActive) => (
        <GridPopover>
          <GridPopoverTrigger
            render={<GridButton variant="ghost" size="icon" />}
            aria-label={`${column.id} filtresi`}
            title="Filtre"
            className={cn(
              "size-5 shrink-0 rounded",
              isActive
                ? "text-primary opacity-100"
                : // Filtresiz kolonda ikon SOLUK ama VAR: yalnizca hover'da
                  // gostermek, dokunmatik cihazda "hic gostermemek" demek.
                  "text-muted-foreground/50 hover:text-foreground",
            )}
            onClick={(event) => {
              // Baslik siralama dugmesinin icinde degiliz ama satir/baslik
              // tiklamalari yukari kabarabilir; filtre acmak SIRALAMA DEMEK
              // DEGIL.
              event.stopPropagation();
            }}
          >
            <FilterIcon
              className="size-3"
              // Etkin filtrede huni DOLU: renk korlugu olan biri icin
              // yalnizca renk degisimi yeterli bir isaret degil.
              fill={isActive ? "currentColor" : "none"}
            />
          </GridPopoverTrigger>

          <GridPopoverContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-xs">
                  {typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id}
                </span>
                {isActive && (
                  <GridButton
                    variant="ghost"
                    onClick={() => column.setFilterValue(undefined)}
                    className="h-6 text-muted-foreground"
                  >
                    <FilterXIcon className="size-3" />
                    Temizle
                  </GridButton>
                )}
              </div>

              {/* Denetimin KENDISI satir modundakiyle AYNI bilesen.
                  Iki ayri uygulama yazsaydik biri duzeltilip digeri
                  unutulurdu -- klasik ikiz bakim borcu.

                  `inline`: coklu secim listesi DOGRUDAN cizilsin. Aksi halde
                  baloncugun icinde BIR ACILIR MENU daha olurdu (iki tiklama,
                  ic ice iki katman). Satir modunda tam tersi dogru -- orada
                  liste gomulu olsaydi filtre satiri devasa olurdu. */}
              <ColumnFilter column={column} inline />
            </div>
          </GridPopoverContent>
        </GridPopover>
      )}
    </Subscribe>
  );
}
