import { Menu } from "@base-ui/react/menu";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/cn";

/**
 * MENU ILKELLERI -- Base UI uzerine ince bir katman.
 *
 * NEDEN BASE UI (eş bağımlılık), kendi menumuzu yazmak DEGIL?
 * Bir acilir menu gorundugunden cok daha zor: odak tuzagi, ESC ile kapanma,
 * disari tiklama, ok tuslariyla gezinme, yazarak arama, ekran kenarina
 * carpinca ters cevirme, `aria-activedescendant`... Bunlari dogru yazmak
 * haftalar alir ve YANLIS yazmak sessizce erisilemez bir arayuz uretir.
 *
 * Base UI'i EŞ BAGIMLILIK (peer) yaptik, normal bagimlilik degil: shadcn v4
 * zaten onun uzerine kurulu. Kendi kopyamizi paketleseydik tuketicinin
 * uygulamasinda IKI Base UI surumu olur, portal ve odak yonetimi birbirine
 * girerdi.
 *
 * `w-(--anchor-width)` KULLANMIYORUZ (shadcn'in varsayilani oyle).
 * O, menuyu tetikleyicinin genisligine esitliyor; bizim tetikleyicilerimiz
 * 28px'lik ikon dugmeleri, menu de 28px genisliginde cizilirdi.
 */

export const GridMenu = Menu.Root;
export const GridMenuTrigger = Menu.Trigger;

/**
 * ALT MENU.
 *
 * "Disa aktar" iki eksende karar istiyor: BICIM (CSV/Excel) ve KAPSAM
 * (seçili/sayfa/tümü). Duz bir listede bu 6-8 oge eder ve kullanici ne
 * secip ne secmedigini takip edemez. Alt menu iki ekseni ayiriyor:
 * once bicim, sonra kapsam.
 */
export const GridSubmenu = Menu.SubmenuRoot;

export function GridSubmenuTrigger({
  className,
  ...props
}: Menu.SubmenuTrigger.Props) {
  return (
    <Menu.SubmenuTrigger
      className={cn(
        "flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 outline-none",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-popup-open:bg-accent",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function GridMenuContent({
  align = "end",
  side = "bottom",
  className,
  ...props
}: Menu.Popup.Props &
  Pick<Menu.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        className="isolate z-50 outline-none"
        align={align}
        side={side}
        sideOffset={4}
      >
        <Menu.Popup
          className={cn(
            "max-h-(--available-height) min-w-44 origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground text-sm shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export function GridMenuItem({ className, ...props }: Menu.Item.Props) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 outline-none",
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Onay isaretli oge -- kolon secicide kullaniliyor.
 *
 * `closeOnClick={false}`: kolon gizleyip acarken menu HER SEFERINDE
 * kapansaydi kullanici uc kolonu gizlemek icin menuyu uc kez acardi.
 */
export function GridMenuCheckboxItem({
  className,
  children,
  ...props
}: Menu.CheckboxItem.Props) {
  return (
    <Menu.CheckboxItem
      closeOnClick={false}
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pe-2 ps-7 outline-none",
        "relative data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <Menu.CheckboxItemIndicator className="absolute start-1.5 flex items-center justify-center">
        <CheckIcon className="size-3.5" />
      </Menu.CheckboxItemIndicator>
      {children}
    </Menu.CheckboxItem>
  );
}

export function GridMenuLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

export function GridMenuSeparator({ className }: { className?: string }) {
  return (
    <Menu.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} />
  );
}
