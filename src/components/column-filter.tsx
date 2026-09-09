import type { RowData } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";
import { CheckIcon, FilterIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { GridColumn } from "../core/pinning";
import { cn } from "../lib/cn";
import { GridInput } from "../primitives/input";
import { GridMenu, GridMenuContent, GridMenuTrigger } from "../primitives/menu";

/**
 * FILTRE SATIRI DENETIMLERI.
 *
 * DevExtreme'in "filter row"u. Hangi denetimin cizilecegi kolon meta'sindan
 * geliyor (`meta.filter`); verilmezse metin araması.
 *
 * ---
 * NEDEN HER DENETIM `Subscribe` ICINDE?
 *
 * Filtre degeri `columnFilters` durumunda yasiyor. `column.getFilterValue()`
 * ile dogrudan okusaydik React Compiler bu okumayi goremez ve girdinin
 * degeri, filtre disaridan temizlendiginde (arac cubugundaki "Temizle")
 * ekranda ESKI HALIYLE kalirdi. Abonelik bunu acik hale getiriyor.
 */

interface FilterProps<TData extends RowData> {
  column: GridColumn<TData>;
}

export function ColumnFilter<TData extends RowData>({
  column,
  inline = false,
}: FilterProps<TData> & {
  /**
   * Coklu secim listesi DOGRUDAN cizilsin mi?
   *
   * ---
   * OLCULEN PROBLEM: IC ICE IKI ACILIR KATMAN.
   *
   * Popup modunda basliktaki huniye tikliyorsunuz -> bir baloncuk aciliyor
   * -> icinde "Tümü" yazan BIR ACILIR MENU daha var -> ona da tiklamak
   * gerekiyor. Iki tiklama, iki katman, ve ikinci katman birincinin
   * disina tasabiliyor.
   *
   * Satir modunda nested menu DOGRU: filtre satirinda her kolona bir liste
   * gomsek satir devasa olurdu. Ayni denetim, iki baglamda iki farkli
   * dogru bicim -- fark bu bayrakla veriliyor.
   */
  inline?: boolean;
}) {
  const variant = column.columnDef.meta?.filter;

  // `false` -> bu kolon filtrelenmiyor. Bos bir hucre birakiyoruz ki
  // filtre satirinin hizasi bozulmasin.
  if (variant === false || !column.getCanFilter()) return null;

  if (variant === "number") return <NumberRangeFilter column={column} />;
  if (variant === "select") {
    return <FacetedFilter column={column} inline={inline} />;
  }
  if (variant === "date") return <DateRangeFilter column={column} />;

  return <TextFilter column={column} />;
}

function TextFilter<TData extends RowData>({ column }: FilterProps<TData>) {
  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() => (column.getFilterValue() as string | undefined) ?? ""}
    >
      {(value) => (
        <GridInput
          value={value}
          placeholder="Ara…"
          aria-label={`${column.id} filtresi`}
          onChange={(event) =>
            // Bos dizeyi `undefined`a ceviriyoruz: aksi halde kullanici
            // yazdigini silince filtre "bos dizeyi icerenler" olarak
            // kalir ve TanStack onu ETKIN bir filtre sayar -- "filtre
            // temizle" dugmesi aktif kalir, kullanici neyi temizleyecegini
            // bulamaz.
            column.setFilterValue(event.target.value || undefined)
          }
        />
      )}
    </Subscribe>
  );
}

/**
 * Sayi araligi: iki kucuk kutu.
 *
 * Tek kutu + "buyuktur/kucuktur" secici de yapilabilirdi ama iki kutu hem
 * daha az tiklama hem daha az ogrenme: min ve max herkesin bildigi kavram.
 * Filtre fonksiyonu `between` (kolon tanimindan gelmiyorsa burada
 * ayarlaniyor -- asagiya bak).
 */
function NumberRangeFilter<TData extends RowData>({
  column,
}: FilterProps<TData>) {
  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() =>
        (column.getFilterValue() as [number | "", number | ""] | undefined) ?? [
          "",
          "",
        ]
      }
    >
      {([min, max]) => {
        const update = (next: [number | "", number | ""]) => {
          // Iki uc da bossa filtre YOK. `["", ""]` gonderseydik etkin bir
          // filtre gibi gorunur ve rozet sayaci yanlis olurdu.
          column.setFilterValue(
            next[0] === "" && next[1] === "" ? undefined : next,
          );
        };

        return (
          <div className="flex items-center gap-1">
            <GridInput
              type="number"
              value={min}
              placeholder="min"
              aria-label={`${column.id} en az`}
              onChange={(event) =>
                update([
                  event.target.value === "" ? "" : Number(event.target.value),
                  max,
                ])
              }
            />
            <GridInput
              type="number"
              value={max}
              placeholder="max"
              aria-label={`${column.id} en çok`}
              onChange={(event) =>
                update([
                  min,
                  event.target.value === "" ? "" : Number(event.target.value),
                ])
              }
            />
          </div>
        );
      }}
    </Subscribe>
  );
}

function DateRangeFilter<TData extends RowData>({
  column,
}: FilterProps<TData>) {
  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() =>
        (column.getFilterValue() as [string, string] | undefined) ?? ["", ""]
      }
    >
      {([from, to]) => {
        const update = (next: [string, string]) => {
          column.setFilterValue(
            next[0] === "" && next[1] === "" ? undefined : next,
          );
        };

        return (
          <div className="flex items-center gap-1">
            <GridInput
              type="date"
              value={from}
              aria-label={`${column.id} başlangıç`}
              onChange={(event) => update([event.target.value, to])}
            />
            <GridInput
              type="date"
              value={to}
              aria-label={`${column.id} bitiş`}
              onChange={(event) => update([from, event.target.value])}
            />
          </div>
        );
      }}
    </Subscribe>
  );
}

/**
 * BASLIK FILTRESI (faceted) -- DevExtreme'in "header filter"i.
 *
 * Kolonda GERCEKTEN var olan degerleri sayilariyla listeliyor.
 *
 * ---
 * NEDEN `getFacetedUniqueValues()`, veriyi kendimiz taramak DEGIL?
 *
 * TanStack'in yuzeyleme (faceting) modeli, DIGER kolonlarin filtrelerini
 * uygulayip BU kolonunkini uygulamayan bir satir kumesi uzerinden sayiyor.
 * Fark kritik: kendimiz `data`yi tarasaydik, "Mühendislik"i sectikten sonra
 * liste tek elemana duser ve secimi GENISLETEMEZDINIZ. Kendi filtresini
 * dislamak, coklu secimi kullanilabilir kilan sey.
 */
function FacetedFilter<TData extends RowData>({
  column,
  inline,
}: FilterProps<TData> & { inline: boolean }) {
  const [query, setQuery] = useState("");

  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() => (column.getFilterValue() as string[] | undefined) ?? []}
    >
      {(selected) =>
        inline ? (
          <FacetedOptionList
            column={column}
            selected={selected}
            query={query}
            onQueryChange={setQuery}
          />
        ) : (
          <FacetedFilterMenu
            column={column}
            selected={selected}
            query={query}
            onQueryChange={setQuery}
          />
        )
      }
    </Subscribe>
  );
}

function FacetedFilterMenu<TData extends RowData>({
  column,
  selected,
  query,
  onQueryChange,
}: FilterProps<TData> & {
  selected: string[];
  query: string;
  onQueryChange: (value: string) => void;
}) {
  // Liste `FacetedOptionList`te; burada YALNIZCA tetikleyici var.
  const declared = column.columnDef.meta?.filterOptions;

  return (
    <GridMenu>
      <GridMenuTrigger
        className={cn(
          "flex h-7 w-full items-center gap-1 rounded-md border border-input bg-background px-2 text-left text-xs",
          "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          selected.length > 0 && "border-primary/50 text-foreground",
        )}
        aria-label={`${column.id} filtresi`}
      >
        <FilterIcon className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {/* Secilenleri SAYIYLA ozetliyoruz, adlarini yan yana yazarak
              degil: uc secimden sonra metin kutuya sigmaz ve kirpilinca
              hangilerinin secili oldugu okunamaz hale gelir. */}
          {selected.length === 0
            ? "Tümü"
            : selected.length === 1
              ? // Tek secimde ETIKETI gosteriyoruz, ham degeri degil:
                // kullanici "Yüksek" secip tetikleyicide "high" gorurse
                // ikisinin ayni sey oldugundan emin olamaz.
                (declared?.find((option) => option.value === selected[0])
                  ?.label ?? selected[0])
              : `${selected.length} seçili`}
        </span>
      </GridMenuTrigger>

      <GridMenuContent align="start" className="w-56 p-0">
        <FacetedOptionList
          column={column}
          selected={selected}
          query={query}
          onQueryChange={onQueryChange}
        />
      </GridMenuContent>
    </GridMenu>
  );
}

/**
 * Secenek listesi -- hem gomulu (popup modu) hem menu icinde (satir modu)
 * kullaniliyor.
 *
 * Tek uygulama: iki ayri liste yazsaydik biri duzeltilip digeri unutulurdu
 * (arama kutusu, sayaclar, "seçimi temizle"... hepsi ikizlenirdi).
 */
function FacetedOptionList<TData extends RowData>({
  column,
  selected,
  query,
  onQueryChange,
}: FilterProps<TData> & {
  selected: string[];
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const facets = column.getFacetedUniqueValues();
  const declared = column.columnDef.meta?.filterOptions;

  const options = useMemo(() => {
    const entries =
      declared === undefined
        ? [...facets.entries()]
            .filter(([value]) => value !== null && value !== undefined)
            .map(([value, count]) => [String(value), count] as const)
            .sort((a, b) => a[0].localeCompare(b[0], "tr"))
        : declared.map((option) => [option.value, null, option.label] as const);

    if (query === "") return entries;
    const needle = query.toLocaleLowerCase("tr");
    return entries.filter(([value, , label]) =>
      (label ?? value).toLocaleLowerCase("tr").includes(needle),
    );
  }, [facets, declared, query]);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    column.setFilterValue(next.length === 0 ? undefined : next);
  };

  return (
    <div className="w-full">
      {/* Arama kutusu YALNIZCA liste uzunsa. Bes secenekli bir enum icin
          arama kutusu koymak, iki tikla ulasilacak seyi bir kutuyla
          gizlemek olurdu. */}
      {options.length + (query === "" ? 0 : 1) > 8 && (
        <div className="border-b p-1.5">
          <GridInput
            value={query}
            placeholder="Değer ara…"
            aria-label="Değer ara"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      )}

      <div className="max-h-56 overflow-y-auto p-1">
        {options.length === 0 && (
          <p className="px-2 py-3 text-center text-muted-foreground text-xs">
            {query === ""
              ? /*
                     Bos liste + bos arama = kolon SEÇENEK TANIMLAMAMIS ve
                     yuzeyleme de bir sey bulamamis. Sunucu tarafli izgarada
                     bunun sebebi neredeyse her zaman eksik `meta.filterOptions`.
                     Sessiz bos liste yerine sebebi soylemek, gelistiricinin
                     saatini kurtariyor.
                   */
                "Seçenek yok — sunucu taraflı ızgarada meta.filterOptions gerekir"
              : "Eşleşen değer yok"}
          </p>
        )}

        {options.map(([value, count, label]) => {
          const isSelected = selected.includes(value);
          return (
            /*
                `Menu.CheckboxItem` DEGIL, duz `button`.

                Base UI'in onay ogesi kendi durumunu tutuyor ve bizim
                durumumuz TanStack'te; ikisini eslemek icin kontrollu kip
                gerekiyor ve liste 500 ogeye ciktiginda her ogenin ayri bir
                durum aboneligi olmasi bosuna. Burada tek dogruluk kaynagi
                `selected` dizisi.
              */
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent"
            >
              <span
                className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input",
                )}
              >
                {isSelected && (
                  <CheckIcon className="size-2.5" strokeWidth={3} />
                )}
              </span>
              <span className="truncate">{label ?? value}</span>
              {/* Sayi, kullaniciya secimin ne kadar daraltacagini ONCEDEN
                    soyluyor -- tiklayip sonucu gormek zorunda kalmiyor.
                    Sabit listede sayi YOK (`null`): sunucu modunda istemci
                    gercek sayiyi bilmiyor ve uydurmak yalan olurdu. */}
              {count !== null && (
                <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="border-t p-1">
          <button
            type="button"
            onClick={() => column.setFilterValue(undefined)}
            className="w-full rounded-md px-2 py-1 text-center text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
          >
            Seçimi temizle
          </button>
        </div>
      )}
    </div>
  );
}
