import type { RowData } from "@tanstack/react-table";
import { Subscribe } from "@tanstack/react-table";

import { createGridColumnHelper } from "../core/features";
import { GridCheckbox } from "../primitives/checkbox";

export const SELECTION_COLUMN_ID = "__select__";

/**
 * SECIM KOLONU.
 *
 * `display` kolonu -- veriden bir alan OKUMUYOR, yalnizca ciziyor. Bu ayrim
 * onemli: `accessor` kolonu olsaydi siralamaya, filtrelemeye ve dISa
 * aktarmaya dahil olurdu ve "onay kutusu" diye bir sutun Excel'e giderdi.
 *
 * ---
 * BASLIKTAKI KUTU SAYFAYI SECER, TUM VERIYI DEGIL.
 *
 * `getToggleAllPageRowsSelectedHandler` kullaniyoruz,
 * `getToggleAllRowsSelectedHandler` DEGIL. Sebep bir guvenlik meselesi:
 * kullanici 25 satir goruyorken kutuya basip "Sil" derse ve o kutu 10.000
 * satiri sectiyse, gordugunden 400 kat fazlasini silmis olur.
 *
 * Gorunen sayfayi secmek, kullanicinin GORDUGU ile YAPTIGI arasindaki bagi
 * koruyor. Tumunu secmek isteyen icin arac cubugunda ayri, ACIK bir eylem
 * olacak ("Tümünü seç: 10.000 kayıt").
 */
export function createSelectionColumn<TData extends RowData>() {
  const helper = createGridColumnHelper<TData>();

  return helper.display({
    id: SELECTION_COLUMN_ID,
    size: 40,
    enableResizing: false,
    enableHiding: false,

    /*
      GRUP BASLIGI SATIRINDA DA CIZILIYOR.

      Grup satirlarinda tekil kayda bagli hucreler bos kalir (bkz.
      `meta.showOnGroupRow`); secim kutusu bilincli istisna: `row.original`a
      dokunmuyor ve grup satirini isaretlemek secimi ALT SATIRLARA yayiyor.
      Yani "bu gruptaki her seyi sec" tek tiklamaya iniyor -- gruplamanin en
      dogal kullanimlarindan biri.
    */
    meta: { showOnGroupRow: true },

    header: ({ table }) => (
      /*
        `Subscribe` SART -- `table.getIsAllPageRowsSelected()` dogrudan
        okunsaydi React Compiler bu okumayi goremez ve baslik kutusu satirlar
        secilirken guncellenmezdi. Baslik baglaminda `table` cekirdek tip
        oldugu icin `table.Subscribe` yerine bagimsiz `Subscribe` kullaniliyor.
      */
      <Subscribe
        source={table.atoms.rowSelection}
        selector={() => ({
          all: table.getIsAllPageRowsSelected(),
          some: table.getIsSomePageRowsSelected(),
        })}
      >
        {({ all, some }) => (
          <GridCheckbox
            aria-label="Sayfadaki tüm satırları seç"
            checked={all}
            // "Bazilari secili" hali: kullaniciya secimin KISMI oldugunu
            // soyleyen tek isaret. Olmazsa yarim secili bir sayfa, hic
            // secili olmayan bir sayfadan ayirt edilemez.
            indeterminate={!all && some}
            // TanStack'in hazir isleyicisi: `enableRowSelection` ile
            // devre disi birakilmis satirlari ve alt satir kurallarini
            // dogru yorumluyor -- elle `toggleAllPageRowsSelected` cagirmak
            // o inceliklerin hepsini bize yeniden yazdirirdi.
            onCheckedChange={(_checked, event) =>
              table.getToggleAllPageRowsSelectedHandler()(event)
            }
          />
        )}
      </Subscribe>
    ),

    cell: ({ row }) => (
      <Subscribe
        source={row.table.atoms.rowSelection}
        selector={() => ({
          selected: row.getIsSelected(),
          // Agacta bir ust satirin cocuklarindan yalnizca bazilari seciliyse
          // ust satir KARARSIZ gorunmeli. `getIsSomeSelected` tam bunu veriyor.
          some: row.getIsSomeSelected(),
          canSelect: row.getCanSelect(),
        })}
      >
        {({ selected, some, canSelect }) => (
          <GridCheckbox
            aria-label="Satırı seç"
            checked={selected}
            indeterminate={!selected && some}
            disabled={!canSelect}
            /*
              `deselectParents: true` -- OLCULEN BIR HATANIN DUZELTMESI.

              Varsayilan (`false`) ile: ebeveyni sectiginizde onun id'si de
              cocuklarinki de secim durumuna yaziliyor. Sonra BIR cocugu
              birakinca ebeveynin id'si durumda KALIYOR ve ebeveyn hala
              "tam secili" gorunuyor -- oysa cocuklarindan biri secili degil.
              Testte tam olarak bunu yakaladim.

              `true` ile bir satir birakildiginda tum ATALARININ id'si de
              siliniyor; ebeveyn "kismi secili" (kararsiz) haline geciyor.

              Ayrica bu isleyici SHIFT ile aralik secimi de veriyor.
            */
            onCheckedChange={(_checked, event) =>
              row.getToggleSelectedHandler({ deselectParents: true })(event)
            }
          />
        )}
      </Subscribe>
    ),
  });
}
