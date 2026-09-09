import type { Row, RowData } from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { createGridColumnHelper, type GridFeatures } from "../core/features";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";
import {
  GridMenu,
  GridMenuContent,
  GridMenuItem,
  GridMenuSeparator,
  GridMenuTrigger,
} from "../primitives/menu";

export const ACTIONS_COLUMN_ID = "__actions__";

export interface RowAction<TData extends RowData> {
  /** Menude gorunecek metin. */
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  onSelect: (row: Row<GridFeatures, TData>) => void;
  /** Satira gore devre disi birakma (ornegin "kilitli kaydi silme"). */
  disabled?: (row: Row<GridFeatures, TData>) => boolean;
  /** Yikici eylem -- kirmizi cizilir ve menunun SONUNA ayrilir. */
  destructive?: boolean;
  /** Ustune ayirici cizgi koy. */
  separatorBefore?: boolean;
}

/**
 * SATIR EYLEMLERI KOLONU.
 *
 * ---
 * NEDEN SATIR ICINDE YAN YANA IKONLAR DEGIL, MENU?
 *
 * Yan yana ikonlar (kalem, cop kutusu, kopyala...) ilk bakista daha hizli
 * gorunur ama uc problemi var:
 *   1. YER. Her ikon ~28px; dort eylem 112px eder ve bu genislik HER satirda
 *      duruyor. Bir izgarada yatay alan en kit kaynak.
 *   2. YANLIS TIKLAMA. "Sil" ikonu, "Duzenle"nin 4px yaninda duruyor ve
 *      geri alinamaz.
 *   3. BUYUME. Bes eylem oldugunda tasarim cokuyor; menu ise buyumeye acik.
 *
 * Jira, Linear ve GitHub'in tamami satir eylemlerini "..." menusunde tutuyor.
 * Cok sik kullanilan TEK bir eylem varsa, tuketici onu ayri bir `display`
 * kolonu olarak zaten ekleyebilir -- bu bilesen onu engellemiyor.
 *
 * ---
 * `opacity-0 group-hover/row:opacity-100`: menu dugmesi satirin uzerine
 * gelmeden GORUNMUYOR ama YER KAPLIYOR (gizlenmiyor, saydamlasiyor).
 * Kaybolsaydi satirlar hover'da yatay olarak zipplardi.
 * `focus-visible:opacity-100` sayesinde klavyeyle gezerken de goruntuye
 * geliyor -- yalnizca hover'a baglamak, klavye kullanicisi icin gorunmez
 * bir dugmeye Tab yapmak demekti.
 */
export function createRowActionsColumn<TData extends RowData>(
  actions: Array<RowAction<TData>>,
) {
  const helper = createGridColumnHelper<TData>();

  return helper.display({
    id: ACTIONS_COLUMN_ID,
    size: 48,
    enableResizing: false,
    enableHiding: false,
    /*
      `showOnGroupRow` YAZMIYORUZ (varsayilan `false`): grup basligi
      satirinda islem menusu CIZILMIYOR. O satirin `row.original`i yok --
      "Sil"e basildiginda tanimsiz bir kayit uzerinde islem yapilirdi.
      Grup seviyesinde bir eylem gerekiyorsa o, satir eylemi degil toplu
      islemdir.
    */
    meta: { align: "center", filter: false },

    cell: ({ row }) => {
      /*
        EYLEMLER GIZLENMIYOR, DEVRE DISI BIRAKILIYOR.

        Once uygun olmayan eylemleri listeden CIKARIYORDUM. Yanlisti:
        menu ogeleri satirdan satira yer degistirir, kullanicinin kas
        hafizasi bozulur ("Sil hep en alttaydi, simdi ucuncu sirada") ve
        en kotusu, bir eylemin neden YOK oldugu hicbir yerde yazmaz.

        Devre disi oge yerinde durur ve "burada yapilamaz" der. Menude hic
        oge kalmayacagi bir durum da yok -- o yuzden bos kontrolu de yok.
      */
      return (
        <GridMenu>
          <GridMenuTrigger
            render={<GridButton variant="ghost" size="icon" />}
            aria-label="Satır işlemleri"
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 data-popup-open:opacity-100"
            onClick={(event) => {
              // Satir tiklamasi (detay acma) tetiklenmesin: menuyu acmak
              // satiri secmek ya da acmak DEMEK DEGIL.
              event.stopPropagation();
            }}
          >
            <MoreHorizontalIcon className="size-4" />
          </GridMenuTrigger>

          <GridMenuContent>
            {actions.map((action, index) => {
              const isDisabled = action.disabled?.(row) === true;
              const Icon = action.icon;

              return (
                <div
                  key={typeof action.label === "string" ? action.label : index}
                >
                  {action.separatorBefore && <GridMenuSeparator />}
                  <GridMenuItem
                    disabled={isDisabled}
                    onClick={() => action.onSelect(row)}
                    className={cn(
                      action.destructive &&
                        "text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive",
                    )}
                  >
                    {Icon && <Icon className="size-4" />}
                    {action.label}
                  </GridMenuItem>
                </div>
              );
            })}
          </GridMenuContent>
        </GridMenu>
      );
    },
  });
}
