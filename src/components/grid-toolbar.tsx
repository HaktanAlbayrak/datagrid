import type { RowData } from "@tanstack/react-table";
import {
  Columns3Icon,
  FilterIcon,
  FilterXIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { GridTable } from "../core/use-grid-table";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";
import { GridInput } from "../primitives/input";
import {
  GridMenu,
  GridMenuCheckboxItem,
  GridMenuContent,
  GridMenuItem,
  GridMenuLabel,
  GridMenuSeparator,
  GridMenuTrigger,
} from "../primitives/menu";

export interface GridToolbarProps<TData extends RowData> {
  table: GridTable<TData>;
  /**
   * Filtre satiri acik mi? Yalnizca `filterMode="row"` kullaniyorsaniz.
   *
   * IKISI DE VERILMEZSE anahtar dugmesi CIZILMEZ. Sebep: varsayilan mod
   * popup ve orada bir "filtre satirini ac/kapat" dugmesi hicbir seye
   * baglanmaz -- calismayan bir dugme, olmayan bir dugmeden kotudur.
   * Etkin filtre sayisi yine de gosteriliyor (asagida).
   */
  showFilterRow?: boolean;
  onToggleFilterRow?: (next: boolean) => void;
  /** Sol tarafa eklenecek ozel eylemler (ornegin "Yeni kayit"). */
  children?: ReactNode;
  className?: string;
  searchPlaceholder?: string;
  /**
   * Kolon duzenini varsayilana dondurur -- KALICILIK ACIKSA VERILMELI.
   *
   * Kalicilik olmadan kotu bir duzenden cikmanin yolu sayfayi yenilemekti.
   * Duzen kaydedilir hale gelince o yol da kapaniyor: kullanici bir kolonu
   * en dara cekip icerigini kaybettiginde ya da anlamadigi bir siralamaya
   * sikistiginda geri donusu KALMIYOR.
   *
   * Verilmezse menu ogesi cizilmiyor; kaliciligi olmayan bir izgarada
   * "sifirla" zaten anlamsiz olurdu.
   */
  onResetLayout?: () => void;
}

/**
 * ARAC CUBUGU: genel arama, filtre satiri anahtari, kolon secici.
 *
 * ---
 * GENEL ARAMA ILE KOLON FILTRELERI AYRI SEYLER -- ve ikisi de gerekli.
 *
 * Genel arama TUM kolonlarda dolasir: kullanici ne aradigini bilir ama
 * hangi kolonda oldugunu bilmez ("TUD-42 neredeydi?"). Kolon filtresi ise
 * DARALTMA aracidir: "sadece Mühendislik, bütçesi 100binden büyük".
 * Birini digerinin yerine koymak, iki farkli soruyu tek araca yuklemek olur.
 *
 * TanStack'te ikisi ayri durum dilimi (`globalFilter` / `columnFilters`) ve
 * BIRLIKTE calisiyorlar: once genel arama, sonra kolon filtreleri.
 */
export function GridToolbar<TData extends RowData>({
  table,
  showFilterRow = false,
  onToggleFilterRow,
  children,
  className,
  searchPlaceholder = "Tümünde ara…",
  onResetLayout,
}: GridToolbarProps<TData>) {
  const globalFilter = table.state.globalFilter ?? "";
  const activeFilters = table.state.columnFilters.length;
  const hasAnyFilter = activeFilters > 0 || globalFilter !== "";

  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative">
        <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 start-2 size-3.5 text-muted-foreground" />
        <GridInput
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Tümünde ara"
          className="w-56 ps-7"
        />
        {globalFilter !== "" && (
          /*
            TEMIZLEME DUGMESI kutunun ICINDE.

            Arama kutusunu klavyeyle temizlemek (Ctrl+A, Delete) herkesin
            bildigi bir sey degil; dokunmatik cihazda ise zahmetli. Kutunun
            icindeki carpi, aramayi geri almanin tek tiklamalik yolu.
          */
          <button
            type="button"
            onClick={() => table.setGlobalFilter("")}
            aria-label="Aramayı temizle"
            className="-translate-y-1/2 absolute top-1/2 end-1.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>

      {onToggleFilterRow === undefined ? (
        activeFilters > 0 && (
          /*
            POPUP MODUNDA: dugme degil, ROZET.

            Filtreler basliklarda gizli duruyor; kac tanesinin etkin oldugunu
            soyleyen tek yer burasi. Olmasaydi kullanici "veri neden eksik?"
            diye sorar ve cevabi sekiz baslikta tek tek aramak zorunda kalirdi.
          */
          <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
            <FilterIcon className="size-3" />
            {activeFilters} filtre
          </span>
        )
      ) : (
        <GridButton
          variant={showFilterRow ? "outline" : "ghost"}
          onClick={() => onToggleFilterRow(!showFilterRow)}
          aria-pressed={showFilterRow}
          title="Filtre satırını göster/gizle"
        >
          <FilterIcon className="size-3.5" />
          Filtreler
          {activeFilters > 0 && (
            <span className="rounded bg-primary px-1 font-medium text-[10px] text-primary-foreground tabular-nums">
              {activeFilters}
            </span>
          )}
        </GridButton>
      )}

      {hasAnyFilter && (
        <GridButton
          variant="ghost"
          onClick={() => {
            table.resetColumnFilters();
            table.setGlobalFilter("");
          }}
          title="Tüm filtreleri temizle"
        >
          <FilterXIcon className="size-3.5" />
          Temizle
        </GridButton>
      )}

      <div className="ml-auto flex items-center gap-2">
        {children}

        <GridMenu>
          <GridMenuTrigger
            render={<GridButton variant="outline" />}
            title="Kolonları göster/gizle"
          >
            <Columns3Icon className="size-3.5" />
            Kolonlar
          </GridMenuTrigger>

          <GridMenuContent className="max-h-72">
            <GridMenuLabel>Görünen kolonlar</GridMenuLabel>
            <GridMenuSeparator />
            {hideableColumns.map((column) => (
              <GridMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(checked) => column.toggleVisibility(checked)}
              >
                {/* Baslik metni bir bilesen olabilir (ikon + metin); menude
                    metin lazim. `columnDef.header` dize degilse kolon
                    kimligine dusuyoruz -- hicbir sey yazmamaktan iyi. */}
                {typeof column.columnDef.header === "string"
                  ? column.columnDef.header
                  : column.id}
              </GridMenuCheckboxItem>
            ))}

            {onResetLayout !== undefined && (
              <>
                <GridMenuSeparator />
                <GridMenuItem onClick={onResetLayout}>
                  <RotateCcwIcon className="size-3.5" />
                  Düzeni sıfırla
                </GridMenuItem>
              </>
            )}
          </GridMenuContent>
        </GridMenu>
      </div>
    </div>
  );
}
