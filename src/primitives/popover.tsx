import { Popover } from "@base-ui/react/popover";

import { cn } from "../lib/cn";

/**
 * POPOVER -- filtre baloncugu icin.
 *
 * NEDEN `Menu` DEGIL (kolon secicide onu kullaniyoruz)?
 *
 * Menu bir SECIM listesi: ok tuslari ogeler arasinda gezer, harfe basmak
 * eslesen ogeye atlar, Enter secer. Bu davranislar bir FORMDA yikici:
 * filtre kutusuna "a" yazmak istediginizde menu "a" ile baslayan ogeye
 * atlamaya calisir, yukari-asagi ok tuslari sayi girdisini artirmak yerine
 * odagi kaydirir.
 *
 * Popover bunlarin hicbirini yapmiyor: yalnizca konumlandirma, disari
 * tiklayinca kapanma, ESC ve odak tuzagi veriyor. Bir form icin dogru olan bu.
 */
export const GridPopover = Popover.Root;
export const GridPopoverTrigger = Popover.Trigger;

export function GridPopoverContent({
  align = "start",
  side = "bottom",
  className,
  ...props
}: Popover.Popup.Props &
  Pick<Popover.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <Popover.Portal>
      <Popover.Positioner
        className="isolate z-50 outline-none"
        align={align}
        side={side}
        sideOffset={4}
      >
        <Popover.Popup
          className={cn(
            "min-w-56 origin-(--transform-origin) rounded-lg bg-popover p-2 text-popover-foreground text-sm shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
          {...props}
        />
      </Popover.Positioner>
    </Popover.Portal>
  );
}

export const GridPopoverClose = Popover.Close;
