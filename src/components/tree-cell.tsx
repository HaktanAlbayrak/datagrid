import type { CellContext, RowData } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";

import type { GridFeatures } from "../core/features";
import { cn } from "../lib/cn";

/** Her hiyerarsi seviyesi icin girinti (px). */
const INDENT = 16;

/**
 * AGAC HUCRESI: girinti + acma/kapama oku.
 *
 * DevExtreme'in `TreeList`inde bu davranis ayri bir bilesende yasiyor; bizde
 * yalnizca bir HUCRE ciziciSI. Yani ayni izgara, `getSubRows` verildigi anda
 * agaca donusuyor -- iki ayri bilesen bakimi yok.
 *
 * ---
 * GIRINTI `paddingInlineStart` ILE, BOSLUK KARAKTERI YA DA IC ICE DIV ILE DEGIL.
 *
 * Ic ice `<div>`lerle girinti vermek yaygin ama hatali: hucre `truncate`
 * oldugunda ic katmanlar tasmayi yanlis hesaplar ve metin uc nokta yerine
 * kirpilir. Tek bir dolgu degeri hem dogru hem olculebilir.
 *
 * `paddingInlineStart` (fiziksel `paddingLeft` degil) RTL'de girintiyi dogru
 * tarafa koyuyor -- dondurulmus kolonlardaki `insetInlineStart` karariyla
 * ayni gerekce.
 */
export function TreeCell<TData extends RowData, TValue>({
  context,
  children,
  /**
   * Bu satirin cocuklari SUNUCUDAN mi yuklenecek?
   *
   * Tembel agacta ust satir acildiginda cocuklar HENUZ YOK. Ok'a basildiginda
   * bir istek gidiyor ve o sirada satirin durumu "aciliyor" oluyor. Bunu
   * gostermezsek kullanici oka tekrar tekrar basar.
   */
  isLoadingChildren = false,
}: {
  context: CellContext<GridFeatures, TData, TValue>;
  children?: ReactNode;
  isLoadingChildren?: boolean;
}) {
  const { row, getValue } = context;
  const content = children ?? (getValue() as ReactNode);

  return (
    <Subscribe
      source={row.table.atoms.expanded}
      selector={() => ({
        expanded: row.getIsExpanded(),
        canExpand: row.getCanExpand(),
      })}
    >
      {({ expanded, canExpand }) => (
        <div
          className="flex min-w-0 items-center gap-1"
          style={{ paddingInlineStart: row.depth * INDENT }}
        >
          {canExpand ? (
            <button
              type="button"
              onClick={(event) => {
                // Satir tiklamasini durduruyoruz: agac dugumunu acmak,
                // satiri "secmek" ya da detayini acmak DEMEK DEGIL.
                event.stopPropagation();
                row.toggleExpanded();
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Daralt" : "Genişlet"}
              className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {isLoadingChildren ? (
                <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                /*
                  TEK IKON, DONDURULUYOR -- iki ayri ikon (sag/asagi) DEGIL.
                  Donus animasyonu durum degisikligini gorunur kiliyor; ikon
                  degistirmek ani bir sicrama uretir ve kullanici hangi
                  satirin acildigini gozden kacirir.
                */
                <ChevronRightIcon
                  className={cn(
                    "size-3.5 transition-transform duration-150",
                    expanded && "rotate-90",
                  )}
                />
              )}
            </button>
          ) : (
            /*
              Yapraklarda BOS bir yer tutucu. Olmasaydi yaprak satirlarin
              metni, kardesi olan dallara gore 20px sola kayardi ve hiyerarsi
              gorsel olarak bozulurdu.
            */
            <span className="size-5 shrink-0" aria-hidden="true" />
          )}

          <span className="truncate">{content}</span>
        </div>
      )}
    </Subscribe>
  );
}
