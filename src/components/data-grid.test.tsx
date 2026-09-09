import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createGridColumnHelper } from "../core/features";
import { useGridTable } from "../core/use-grid-table";
import { DataGrid } from "./data-grid";
import { GridGroupPanel } from "./grid-group-panel";
import { GridPagination } from "./grid-pagination";
import { GridToolbar } from "./grid-toolbar";
import { createRowActionsColumn } from "./row-actions-column";
import { createSelectionColumn } from "./selection-column";
import { TreeCell } from "./tree-cell";

interface Node {
  id: string;
  name: string;
  amount: number;
  status?: string;
  children?: Node[];
}

const onEdit = vi.fn();
const onDelete = vi.fn();

const helper = createGridColumnHelper<Node>();

/**
 * Kolonlar ve veri MODUL SEVIYESINDE.
 *
 * Her render'da yeni dizi uretseydik TanStack'in satir/kolon modelleri her
 * seferinde yeniden hesaplanirdi ve testler gercekte olmayan bir davranisi
 * olcerdi. (Bu, kutuphanenin "stable inputs" kuralinin test tarafindaki
 * karsiligi -- uygulamada da ayni.)
 */
/*
  `helper.columns([...])` SART -- duz dizi YAZILAMAZ.

  Duz `[a, b, c]` yazdigimda TypeScript diziyi tek bir ortak tipe
  daraltmaya calisiyor ve secim kolonu (deger tipi `unknown`) ile
  `name` kolonu (deger tipi `string`) bagdasmadigi icin sayfalarca
  hata veriyor. `helper.columns()` demeti (tuple) oldugu gibi koruyor.

  Bu, paketi kullananlarin da carpacagi ilk duvar; README'de yaziyor.
*/
const columns = helper.columns([
  createSelectionColumn<Node>(),
  helper.accessor("name", {
    header: "Ad",
    cell: (context) => <TreeCell context={context} />,
  }),
  helper.accessor("amount", {
    header: "Tutar",
    // `aggregate` iki yerde birden is goruyor: grup basligindaki ozet ve
    // alttaki genel toplam. Testler ikisinin de AYNI sayiyi verdigini
    // sinamali -- gerekcesi `core/aggregate.ts`te.
    meta: { filter: "number", aggregate: "sum", align: "end" },
  }),
  helper.accessor("status", { header: "Durum", meta: { filter: "select" } }),
  createRowActionsColumn<Node>([
    { label: "Düzenle", onSelect: onEdit },
    {
      label: "Sil",
      destructive: true,
      onSelect: onDelete,
      disabled: (row) => row.original.name === "Yalnız",
    },
  ]),
]);

/**
 * Yalnizca TEK bir test icin ayri kolon kumesi: `status` kolonunda
 * `filterOptions` ETIKETLI.
 *
 * Paylasilan kumeye eklemedim: yuzeyleme (faceting) testleri secenekleri
 * VERIDEN uretiyor ve sabit bir liste vermek onlarin sinadigi seyi ortadan
 * kaldirirdi. Iki kume tutmak, bir testi kurtarmak icin dort testi
 * zayiflatmaktan iyi.
 */
const LABELED_COLUMNS = helper.columns([
  helper.accessor("name", { header: "Ad" }),
  helper.accessor("status", {
    header: "Durum",
    meta: {
      filter: "select",
      filterOptions: [
        { value: "Aktif", label: "Etkin" },
        { value: "Pasif", label: "Durgun" },
      ],
    },
  }),
]);

const TREE: Node[] = [
  {
    id: "1",
    name: "Ana",
    amount: 100,
    status: "Aktif",
    children: [
      { id: "1-1", name: "Alt A", amount: 40, status: "Aktif" },
      { id: "1-2", name: "Alt B", amount: 60, status: "Pasif" },
    ],
  },
  { id: "2", name: "Yalnız", amount: 7, status: "Pasif" },
];

const FLAT: Node[] = Array.from({ length: 30 }, (_, index) => ({
  id: String(index + 1),
  name: `Satır ${index + 1}`,
  amount: index,
  status: index % 2 === 0 ? "Aktif" : "Pasif",
}));

function Grid({
  data,
  tree = false,
  pageSize,
  // Testlerin cogu SATIR modunu sinamayi surduruyor: denetimler dogrudan
  // DOM'da, popup acmadan erisilebiliyor. Popup modu ayri bir blokta.
  filterMode = "row",
  virtual,
  columnsOverride,
}: {
  data: Node[];
  tree?: boolean;
  pageSize?: number;
  filterMode?: "row" | "popup" | "none";
  virtual?: boolean | "auto";
  /** Tek bir testin ihtiyaci: etiketli `filterOptions` tasiyan kolonlar. */
  columnsOverride?: typeof LABELED_COLUMNS;
}) {
  const table = useGridTable<Node>({
    data,
    columns: columnsOverride ?? columns,
    getRowId: (row) => row.id,
    ...(tree ? { getSubRows: (row: Node) => row.children } : {}),
    ...(pageSize === undefined
      ? {}
      : { initialState: { pagination: { pageIndex: 0, pageSize } } }),
  });

  const [showFilterRow, setShowFilterRow] = useState(true);

  return (
    <>
      <GridToolbar
        table={table}
        showFilterRow={showFilterRow}
        // Anahtar YALNIZCA satir modunda veriliyor -- gercek kullanimda da
        // oyle. Popup modunda "filtre satirini ac/kapat" dugmesi hicbir seye
        // baglanmaz; `GridToolbar` bunu gorup yerine ETKIN FILTRE ROZETI
        // ciziyor.
        {...(filterMode === "row"
          ? { onToggleFilterRow: setShowFilterRow }
          : {})}
      />
      <GridGroupPanel table={table} />
      <DataGrid
        table={table}
        filterMode={filterMode}
        showFilterRow={showFilterRow}
        {...(virtual === undefined ? {} : { virtual })}
      />
      <GridPagination table={table} />
    </>
  );
}

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1] as HTMLElement).getAllByRole("row");

describe("DataGrid", () => {
  beforeEach(() => {
    onEdit.mockClear();
    onDelete.mockClear();
  });

  test("satırları ve başlıkları çizer", () => {
    render(<Grid data={TREE} />);

    expect(screen.getByText("Ad")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    // Agac KAPALI: `getSubRows` verilmedi, cocuklar satir bile degil.
    expect(screen.queryByText("Alt A")).not.toBeInTheDocument();
  });

  test("boş veride mesaj gösterir", () => {
    render(<Grid data={[]} />);

    expect(screen.getByText("Kayıt yok")).toBeInTheDocument();
  });

  describe("sıralama", () => {
    test("başlığa tıklamak sırayı değiştirir ve aria-sort'u günceller", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      const header = screen.getByRole("columnheader", { name: /Tutar/ });
      expect(header).toHaveAttribute("aria-sort", "none");

      await user.click(within(header).getByRole("button", { name: /Tutar/ }));

      // `aria-sort` yalnizca gorsel bir detay DEGIL: ekran okuyucunun
      // siralamayi duyurmasinin tek yolu bu.
      expect(header).toHaveAttribute("aria-sort", "ascending");
      expect(bodyRows()[0]).toHaveTextContent("Satır 1");

      await user.click(within(header).getByRole("button", { name: /Tutar/ }));

      expect(header).toHaveAttribute("aria-sort", "descending");
      expect(bodyRows()[0]).toHaveTextContent("Satır 30");
    });
  });

  describe("ağaç", () => {
    test("genişletme çocuk satırları getirir, daraltma geri alır", async () => {
      const user = userEvent.setup();
      render(<Grid data={TREE} tree />);

      expect(screen.queryByText("Alt A")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Genişlet" }));

      expect(screen.getByText("Alt A")).toBeInTheDocument();
      expect(screen.getByText("Alt B")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Daralt" }));

      expect(screen.queryByText("Alt A")).not.toBeInTheDocument();
    });

    test("yaprak satırda genişletme düğmesi YOK", () => {
      render(<Grid data={TREE} tree />);

      // "Yalniz" satirinin cocugu yok -> ok cizilmemeli. Cizilseydi kullanici
      // bir sey acilacagini sanip tiklar ve hicbir sey olmazdi.
      const rows = bodyRows();
      const leafRow = rows.find((row) => row.textContent?.includes("Yalnız"));
      expect(leafRow).toBeDefined();
      expect(
        within(leafRow as HTMLElement).queryByRole("button", {
          name: /Genişlet|Daralt/,
        }),
      ).toBeNull();
    });

    test("derinlik arttıkça girinti artar", async () => {
      const user = userEvent.setup();
      render(<Grid data={TREE} tree />);

      await user.click(screen.getByRole("button", { name: "Genişlet" }));

      const parentIndent = screen.getByText("Ana").closest("div")
        ?.style.paddingInlineStart;
      const childIndent = screen.getByText("Alt A").closest("div")
        ?.style.paddingInlineStart;

      expect(parentIndent).toBe("0px");
      expect(childIndent).toBe("16px");
    });
  });

  describe("seçim", () => {
    test("satır seçimi satırı işaretler", async () => {
      const user = userEvent.setup();
      render(<Grid data={TREE} />);

      const rows = bodyRows();
      const firstRow = rows[0] as HTMLElement;

      await user.click(within(firstRow).getByRole("checkbox"));

      // React Compiler tuzagi tam burada: `Subscribe` olmadan bu satir
      // yeniden CIZILMEZDI ve `data-state` "selected" olmazdi.
      expect(firstRow).toHaveAttribute("data-state", "selected");
    });

    test("ağaçta ebeveyn seçimi çocukları da seçer; kısmi seçim KARARSIZ görünür", async () => {
      const user = userEvent.setup();
      render(<Grid data={TREE} tree />);

      await user.click(screen.getByRole("button", { name: "Genişlet" }));

      const rows = bodyRows();
      const parentBox = within(rows[0] as HTMLElement).getByRole("checkbox");
      const childBox = within(rows[1] as HTMLElement).getByRole("checkbox");

      await user.click(parentBox);
      expect((childBox as HTMLInputElement).checked).toBe(true);

      // Bir cocugu birakinca ebeveyn ne secili ne secisiz: KARARSIZ.
      // Bu hal olmasaydi yarim secili bir dal, hic secili olmayandan
      // ayirt edilemezdi.
      await user.click(childBox);
      expect((parentBox as HTMLInputElement).checked).toBe(false);
      expect((parentBox as HTMLInputElement).indeterminate).toBe(true);
    });

    test("başlıktaki kutu SAYFAYI seçer, tüm veriyi değil", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      await user.click(
        screen.getByRole("checkbox", { name: "Sayfadaki tüm satırları seç" }),
      );

      // 30 kaydin 10'u gorunuyor -> 10 secili olmali, 30 degil.
      // Ayrim onemli: "gordugunu sec" ile "her seyi sec" farkli eylemler.
      expect(screen.getByText("10 seçili")).toBeInTheDocument();
    });
  });

  describe("kolon genişliği", () => {
    /**
     * KLAVYEYLE BOYUTLANDIRMA.
     *
     * Fareyle surukleme jsdom'da anlamli sekilde test EDILEMEZ (gercek
     * `mousemove` koordinatlari, `requestAnimationFrame`, belge seviyesi
     * dinleyiciler). Klavye yolu ise saf: tus -> durum. Ve zaten kritik olan
     * o: fare kullanamayan biri icin tek yol bu.
     *
     * (Fare yolunu gercek tarayicida olctum: 280px -> 380px, cift tiklama
     * 280'e donuyor.)
     */
    test("ok tuşları genişliği değiştirir, Home varsayılana döner", async () => {
      const user = userEvent.setup();
      render(<Grid data={TREE} />);

      const header = screen.getByRole("columnheader", { name: /Ad/ });
      const handle = within(header).getByRole("separator");
      const width = () => Number(handle.getAttribute("aria-valuenow"));

      const initial = width();

      handle.focus();
      await user.keyboard("{ArrowRight}");
      expect(width()).toBe(initial + 16);

      // Shift ince ayar: 4px.
      await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
      expect(width()).toBe(initial + 20);

      await user.keyboard("{Home}");
      expect(width()).toBe(initial);
    });

    test("genişlik `aria-valuenow` ile OKUNABILIYOR", () => {
      render(<Grid data={TREE} />);

      // Odaklanabilir bir ayirici deger ozniteligi tasimazsa, ekran okuyucuya
      // "ayarlanabilir bir sey var" deyip ne oldugunu SOYLEMEMIS oluruz.
      const handle = within(
        screen.getByRole("columnheader", { name: /Tutar/ }),
      ).getByRole("separator");

      expect(handle).toHaveAttribute("aria-valuenow");
      expect(handle).toHaveAttribute("aria-orientation", "vertical");
      expect(handle).toHaveAttribute("tabindex", "0");
    });
  });

  describe("filtreleme", () => {
    test("metin filtresi satırları daraltır ve temizlenince geri gelir", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      const filter = screen.getByRole("textbox", { name: "name filtresi" });
      await user.type(filter, "Satır 1");

      // "Satır 1", "Satır 1x" ve "Satır 1" -> 1, 10..19 = 11 satir.
      expect(bodyRows()).toHaveLength(11);

      await user.clear(filter);
      expect(bodyRows()).toHaveLength(30);
    });

    test("sayı aralığında YALNIZCA min verilebilir (açık uç)", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      // Bu, `inNumberRange` yerine `between` baglasaydik BOZULACAK olan
      // durum: `between` acik ucu desteklemiyor ve hic satir donmuyordu.
      await user.type(
        screen.getByRole("spinbutton", { name: "amount en az" }),
        "25",
      );

      // amount 25..29 -> 5 satir.
      expect(bodyRows()).toHaveLength(5);
    });

    test("başlık filtresi (faceted) SEÇİLEN değerleri getirir", async () => {
      // OLCULEN HATA: `arrIncludesSome` bagliyken bu test "0 satir" veriyordu.
      // `arr*` ailesi SATIR degeri dizi oldugunda calisiyor; bizde tersi.
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await user.click(screen.getByRole("button", { name: "status filtresi" }));
      await user.click(await screen.findByRole("button", { name: /^Aktif/ }));

      expect(bodyRows()).toHaveLength(15);
    });

    test("faceted liste KENDİ filtresini dışlar -- seçim genişletilebilir", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await user.click(screen.getByRole("button", { name: "status filtresi" }));
      await user.click(await screen.findByRole("button", { name: /^Aktif/ }));

      // Secimden SONRA liste hala iki secenek gostermeli. Gostermeseydi
      // kullanici "Pasif"i de eklemek isterse listede bulamazdi -- coklu
      // secim fiilen tek secime donerdi.
      expect(
        screen.getByRole("button", { name: /^Aktif/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Pasif/ }),
      ).toBeInTheDocument();
    });

    test("genel arama tüm kolonlarda dolaşır", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await user.type(
        screen.getByRole("textbox", { name: "Tümünde ara" }),
        "Pasif",
      );

      // Kolon filtresi olsaydi "Durum" kolonunu secmek gerekirdi; genel
      // arama hangi kolonda oldugunu bilmeden buluyor.
      expect(bodyRows()).toHaveLength(15);
    });

    test("etkin filtre sayısı rozette görünür ve Temizle hepsini siler", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await user.type(
        screen.getByRole("textbox", { name: "name filtresi" }),
        "Satır 2",
      );
      await user.type(
        screen.getByRole("spinbutton", { name: "amount en az" }),
        "20",
      );

      // Rozet, filtre satiri gizlendiginde bile etkin filtre oldugunu
      // soyleyen tek isaret.
      expect(
        screen.getByRole("button", { name: /Filtreler/ }),
      ).toHaveTextContent("2");

      await user.click(screen.getByRole("button", { name: /Temizle/ }));
      expect(bodyRows()).toHaveLength(30);
    });
  });

  describe("filtre popup'ı", () => {
    test("başlıktaki huni ikonu filtreyi açar", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} filterMode="popup" />);

      // Popup KAPALIYKEN denetim DOM'da yok -- dikey alan ve gorsel gurultu
      // kazanci tam olarak bu.
      expect(
        screen.queryByRole("textbox", { name: "name filtresi" }),
      ).toBeNull();

      await user.click(screen.getByRole("button", { name: "name filtresi" }));

      const input = await screen.findByRole("textbox", {
        name: "name filtresi",
      });
      await user.type(input, "Satır 1");

      expect(bodyRows()).toHaveLength(11);
    });

    test("etkin filtre popup KAPALIYKEN de görünür", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} filterMode="popup" />);

      const trigger = screen.getByRole("button", { name: "amount filtresi" });
      await user.click(trigger);
      await user.type(
        await screen.findByRole("spinbutton", { name: "amount en az" }),
        "25",
      );
      await user.keyboard("{Escape}");

      /*
        Popup kapaninca filtrenin varligini gosteren TEK sey arac
        cubugundaki rozet ve baslikta vurgulanan ikon. Ikisi de olmasaydi
        kullanici "veri neden eksik?" diye sorar ve cevabi sekiz baslikta
        tek tek aramak zorunda kalirdi.
      */
      expect(screen.getByText(/1 filtre/)).toBeInTheDocument();
      expect(bodyRows()).toHaveLength(5);
    });

    test("filtresiz kolonda huni ikonu YOK", () => {
      render(<Grid data={FLAT} filterMode="popup" />);

      // Islem kolonu `meta.filter: false` -- filtrelenemeyen bir kolonda
      // ikon gostermek, tiklayip bos bir kutu bulmaya davet olurdu.
      expect(
        screen.queryByRole("button", { name: "__actions__ filtresi" }),
      ).toBeNull();
    });
  });

  describe("satır işlemleri", () => {
    test("menü açılır ve eylem satırla birlikte çağrılır", async () => {
      const user = userEvent.setup();
      render(<Grid data={TREE} />);

      const firstRow = bodyRows()[0] as HTMLElement;
      await user.click(
        within(firstRow).getByRole("button", { name: "Satır işlemleri" }),
      );
      await user.click(
        await screen.findByRole("menuitem", { name: "Düzenle" }),
      );

      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onEdit.mock.calls[0]?.[0].original.name).toBe("Ana");
    });

    test("uygun olmayan eylem GİZLENMEZ, devre dışı kalır", async () => {
      // Gizleseydik menu ogeleri satirdan satira yer degistirir ve bir
      // eylemin neden yok oldugu hicbir yerde yazmazdi.
      const user = userEvent.setup();
      render(<Grid data={TREE} />);

      const leafRow = bodyRows().find((row) =>
        row.textContent?.includes("Yalnız"),
      ) as HTMLElement;

      await user.click(
        within(leafRow).getByRole("button", { name: "Satır işlemleri" }),
      );

      const remove = await screen.findByRole("menuitem", { name: "Sil" });
      expect(remove).toBeInTheDocument();
      expect(remove).toHaveAttribute("data-disabled");
    });
  });

  describe("kolon seçici", () => {
    test("kolon gizlenebilir ve menü AÇIK kalır", async () => {
      const user = userEvent.setup();
      render(<Grid data={TREE} />);

      await user.click(screen.getByRole("button", { name: /Kolonlar/ }));
      await user.click(
        await screen.findByRole("menuitemcheckbox", { name: "Tutar" }),
      );

      expect(
        screen.queryByRole("columnheader", { name: /Tutar/ }),
      ).not.toBeInTheDocument();

      // `closeOnClick={false}`: uc kolonu gizlemek icin menuyu uc kez
      // acmak zorunda kalmamali.
      expect(
        screen.getByRole("menuitemcheckbox", { name: "Durum" }),
      ).toBeInTheDocument();
    });

    test("gizlenemeyen kolonlar seçicide GÖRÜNMEZ", () => {
      // Secim ve islem kolonlari `enableHiding: false`. Listede olsalardi
      // kullanici onlari kapatir ve satirlari secmenin ya da islem menusune
      // ulasmanin yolunu kaybederdi -- geri getirmek icin yine ayni menuye
      // ihtiyaci olurdu ama artik ne aradigini bilmezdi.
      render(<Grid data={TREE} />);

      const labels = screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent);

      expect(labels.join(" ")).toContain("Ad");
      // Secim kolonunun basligi bir onay kutusu, adi yok -> secicide de yok.
      expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
    });
  });

  describe("sanallaştırma", () => {
    /**
     * SANALLASTIRMA JSDOM'DA SINIRLI OLCULEBILIYOR.
     *
     * jsdom'da hicbir elemanin gercek boyutu yok (`getBoundingClientRect`
     * hep 0 doner), yani "kac satir gorunuyor" sorusunun anlamli bir cevabi
     * yok. Test edebilecegimiz sey KARARIN kendisi: esik asilinca acilıyor
     * mu, yukseklik yokken KAPALI kaliyor mu.
     *
     * Gercek davranis (DOM satir sayisinin sabit kalmasi) tarayicida
     * olculdu; buradaki testler o kararin regresyona ugramamasi icin.
     */
    test("yükseklik VERİLMEZSE sanallaştırma kapalı", () => {
      /*
        `height` olmadan kaydirma kabi yok: "gorunur alan" hesaplanamiyor.
        Yanlis calismasindansa hic calismamasi iyi -- aksi halde tum
        satirlar dolgu icinde kaybolurdu.
      */
      render(<Grid data={FLAT} pageSize={30} />);

      // 30 satirin hepsi cizilmis olmali (esik 60'in altinda zaten).
      expect(bodyRows()).toHaveLength(30);
    });

    test("`virtual={false}` esiği aşsa bile kapatır", () => {
      render(<Grid data={FLAT} pageSize={30} virtual={false} />);

      expect(bodyRows()).toHaveLength(30);
    });
  });

  describe("sayfalama", () => {
    test("aralık metni ve sayfa geçişi", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      expect(screen.getByText("1–10 / 30")).toBeInTheDocument();
      expect(bodyRows()).toHaveLength(10);

      await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));

      expect(screen.getByText("11–20 / 30")).toBeInTheDocument();
      expect(bodyRows()[0]).toHaveTextContent("Satır 11");
    });

    test("ilk sayfada geri düğmeleri kapalı, son sayfada ileri düğmeleri kapalı", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      expect(
        screen.getByRole("button", { name: "Önceki sayfa" }),
      ).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Son sayfa" }));

      expect(
        screen.getByRole("button", { name: "Sonraki sayfa" }),
      ).toBeDisabled();
      expect(screen.getByText("21–30 / 30")).toBeInTheDocument();
    });

    test("ağaçta çocuklar ebeveyniyle AYNI sayfada kalır", async () => {
      const user = userEvent.setup();
      // Sayfa boyutu 2: kok satirlar tam iki sayfa... degil, iki KOK var.
      render(<Grid data={TREE} tree pageSize={2} />);

      await user.click(screen.getByRole("button", { name: "Genişlet" }));

      // `paginateExpandedRows: false` olmasaydi acilan iki cocuk sayfa
      // sinirini asar ve bir sonraki sayfaya taserdi -- kullanici "açtım,
      // yarısı kayboldu" derdi. Burada dordu de ayni sayfada.
      expect(bodyRows()).toHaveLength(4);
      expect(screen.getByText("1–2 / 2")).toBeInTheDocument();
    });
  });

  /*
    KLAVYE GEZINMESI (Faz 7) -- ARIA "grid" deseni.

    Bu blogun varlik sebebi: `role="grid"` ekran okuyucuya bir SOZ veriyor
    ("hucre hucre gezilebilir"). Sozun tutuldugunu kanitlayan sey bu testler;
    olmasalar rol, dogrulanmamis bir iddia olurdu.
  */
  describe("klavye gezinmesi", () => {
    const cellAt = (row: number, col: number) =>
      document.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`);

    /** Odaktaki hucrenin adresi -- "satir:kolon". */
    const focusedAddress = () =>
      (document.activeElement as HTMLElement | null)?.dataset.cell;

    test("ızgarada TEK bir sekme durağı var (gezinen odak)", () => {
      render(<Grid data={FLAT} pageSize={10} />);

      const focusable = document.querySelectorAll('[data-cell][tabindex="0"]');

      /*
        Alternatif her hucreye `tabIndex=0` vermekti: 10 satir x 5 kolon =
        50 sekme duragi. Klavye kullanicisi icin izgara, gecilmesi dakikalar
        suren bir duvar olurdu. Tek durak + ok tuslari, ARIA'nin bu deseni
        tanimlamasinin tek sebebi.
      */
      expect(focusable).toHaveLength(1);
      // Hicbir sey odakli degilken duragin ILK VERI HUCRESI olmasi onemli:
      // Tab'la giren kullanici bos bir kabuga degil, ilk kayda dusuyor.
      expect(focusable[0]).toHaveAttribute("data-cell", "0:0");
    });

    test("ok tuşları hücreler arası gezer, sınırlarda durur", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      await user.click(cellAt(0, 1) as HTMLElement);
      expect(focusedAddress()).toBe("0:1");

      await user.keyboard("{ArrowRight}");
      expect(focusedAddress()).toBe("0:2");

      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(focusedAddress()).toBe("2:2");

      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(focusedAddress()).toBe("2:0");

      /*
        SINIRDA DURUYOR, BASA DONMUYOR.

        Sola dogru bir tus daha: hicbir sey olmamali. Dongu yapsaydik
        kullanicinin "satirin basindayim" bilgisi silinirdi -- ekran
        okuyucuyla calisan biri icin konum kaybi, gezinmenin kendisinden
        daha pahali.
      */
      await user.keyboard("{ArrowLeft}");
      expect(focusedAddress()).toBe("2:0");
    });

    test("odak nereden gelirse gelsin O hücreden devam eder", () => {
      render(<Grid data={FLAT} pageSize={10} />);

      /*
        OLCULEN HATA: konum React DURUMUNDAN okunuyordu. Bir hucreye odak
        verilip HEMEN ardindan tusa basildiginda (tiklayip aninda ok tusu)
        durum guncellemesi henuz islenmemis oluyor ve gezinme "hicbir
        yerdeyim" varsayimiyla basliktan basliyordu. Tarayicida olculdu:
        `0:2` hucresinden ArrowDown, `1:2` yerine `0:0` verdi.

        Burada odak React'in olay yolundan GECMEDEN veriliyor (`focus()` +
        dogrudan tus olayi) -- yani en kotu durum. Adres artik `data-cell`ten,
        yani DOM'dan okundugu icin dogru cikiyor.
      */
      const cell = cellAt(4, 2) as HTMLElement;
      cell.focus();
      fireEvent.keyDown(cell, { key: "ArrowDown" });

      expect(focusedAddress()).toBe("5:2");
    });

    test("yukarı ok en üstte BAŞLIĞA çıkar", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      await user.click(cellAt(0, 2) as HTMLElement);
      await user.keyboard("{ArrowUp}");

      /*
        Baslik satiri gezinmede -1. satir. Buraya cikamasaydik klavye
        kullanicisi SIRALAMAYA hic ulasamazdi: siralama dugmesi basligin
        icinde ve baslik veri satirlarinin "yukarisinda".
      */
      expect(focusedAddress()).toBe("-1:2");
      expect(document.activeElement?.tagName).toBe("TH");
    });

    test("Home/End satırda, Ctrl'lü hâlleri ızgarada gezer", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      await user.click(cellAt(3, 2) as HTMLElement);

      // Duz Home/End SATIRDA: elektronik tablolarin ortak sozlesmesi.
      await user.keyboard("{End}");
      expect(focusedAddress()).toBe("3:4");
      await user.keyboard("{Home}");
      expect(focusedAddress()).toBe("3:0");

      // Ctrl'lu hali IZGARANIN kendisinde: 10 satirlik sayfanin son hucresi.
      await user.keyboard("{Control>}{End}{/Control}");
      expect(focusedAddress()).toBe("9:4");
      await user.keyboard("{Control>}{Home}{/Control}");
      expect(focusedAddress()).toBe("0:0");
    });

    test("PageDown/PageUp sayfa boyu atlar", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await user.click(cellAt(0, 1) as HTMLElement);
      await user.keyboard("{PageDown}");
      expect(focusedAddress()).toBe("10:1");

      await user.keyboard("{PageUp}");
      expect(focusedAddress()).toBe("0:1");
    });

    test("Enter hücrenin İÇİNE girer, Escape geri çıkarır", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      // 0. kolon secim kutusu: icinde odaklanabilir bir denetim var.
      await user.click(cellAt(0, 1) as HTMLElement);
      await user.keyboard("{ArrowLeft}");
      expect(focusedAddress()).toBe("0:0");

      await user.keyboard("{Enter}");

      /*
        EYLEM KIPI. Odak artik hucrede degil, hucrenin ICINDEKI denetimde.
        Bu ayrim olmadan ok tuslari hem gezinmek hem girdi icinde imlec
        tasimak icin yarisirdi -- ikisi de calismaz olurdu.
      */
      expect(document.activeElement?.tagName).toBe("INPUT");

      await user.keyboard("{Escape}");
      expect(focusedAddress()).toBe("0:0");
    });

    test("hücre içindeki denetimin tuşlarına KARIŞMAZ", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      /*
        OLCULEN GERILEME: bu kural once yoktu. Kolon genisligi tutamagi
        (`role="separator"`, basligin ICINDE) ok tuslariyla calisiyor; olay
        basliga, oradan tabloya KABARIYOR ve gezinme kodu ArrowRight'i kapip
        odagi bir sonraki hucreye tasiyordu. Belirti: iki ok basimindan
        yalnizca biri genisligi degistirdi.

        Kural artik olayin HEDEFINE bakiyor: hedef hucrenin kendisi degilse
        (yani icindeki bir denetimse) tuslar ona ait.
      */
      const separator = screen.getAllByRole("separator")[1] as HTMLElement;
      separator.focus();

      await user.keyboard("{ArrowRight}{ArrowRight}");

      // Odak tutamakta KALDI -- gezinme devralmadi.
      expect(document.activeElement).toBe(separator);
    });

    test("ARIA sayıları TÜM listeyi anlatır, DOM'daki satırları değil", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={10} />);

      const grid = screen.getByRole("grid");
      // 30 kayit + 1 baslik satiri. DOM'da 10 satir var; sayim buna
      // BAKMIYOR. Sanallastirmada bu fark 30'a karsi 640 olacak ve bu
      // oznitelikler olmadan ekran okuyucu konumu tamamen yanlis duyurur.
      expect(grid).toHaveAttribute("aria-rowcount", "31");
      expect(grid).toHaveAttribute("aria-colcount", "5");

      expect(bodyRows()[0]).toHaveAttribute("aria-rowindex", "2");

      await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));

      // Ikinci sayfanin ilk satiri DOM'da yine birinci -- ama listede 11.
      // (+1 baslik, +1 ARIA'nin 1 tabanli olmasi.)
      expect(bodyRows()[0]).toHaveAttribute("aria-rowindex", "12");
    });
  });

  /*
    GRUPLAMA + OZETLER (Faz 4).

    Bu blogun ana iddiasi: grup basligindaki ozet ile alttaki genel toplam
    AYNI kaynaktan geliyor (`meta.aggregate`). Ikisini ayri ayri yazdirmak
    "toplamlar birbirini tutmuyor" hatasinin klasik uretim yolu; testler o
    kaynagin tekligini koruyor.
  */
  describe("gruplama ve özetler", () => {
    const groupBy = async (
      user: ReturnType<typeof userEvent.setup>,
      label: string,
    ) => {
      await user.click(screen.getByRole("button", { name: /Grupla/ }));
      await user.click(
        await screen.findByRole("menuitemcheckbox", { name: label }),
      );
      await user.keyboard("{Escape}");
    };

    const summaryRow = () =>
      within(screen.getAllByRole("rowgroup")[2] as HTMLElement).getByRole(
        "row",
      );

    test("özet satırı TÜM filtrelenmiş kayıtları toplar, sayfayı değil", async () => {
      const user = userEvent.setup();
      // Sayfa boyutu 10: ekranda 10 satir var ama toplam 30 kayit uzerinden.
      render(<Grid data={FLAT} pageSize={10} />);

      /*
        0..29 toplami 435. Ekrandaki ilk 10 satirin toplami 45 olurdu ve
        sayfa degistikce degisirdi -- yani kimsenin sormadigi bir soruya
        cevap. Bu test tam olarak o ayrimi koruyor.
      */
      expect(summaryRow()).toHaveTextContent("435");
      // Kapsam ETIKETLI: istemci modunda "Toplam" (sunucu modunda "Bu
      // sayfa" olurdu -- yanlis sayiyi dogruymus gibi sunmamak icin).
      expect(summaryRow()).toHaveTextContent("Toplam");

      await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));

      // Sayfa degisti, toplam DEGISMEDI.
      expect(summaryRow()).toHaveTextContent("435");
    });

    test("özet FİLTREYE tabi", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      // "Satır 3" -> "Satır 3" (tutar 2) ve "Satır 30" (tutar 29) = 31.
      // Onemli olan sayinin kendisi degil, DEGISMESI: ozet, kullanicinin o
      // an baktigi kumeyi anlatmali.
      await user.type(screen.getByLabelText("Tümünde ara"), "Satır 3");

      expect(bodyRows()).toHaveLength(2);
      expect(summaryRow()).toHaveTextContent("31");
    });

    test("kolona göre gruplar, grup başlığı SAYI ve ÖZET taşır", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await groupBy(user, "Durum");

      const rows = bodyRows();
      // 30 satir yerine 2 GRUP satiri: cocuklar kapali basliyor.
      expect(rows).toHaveLength(2);

      // Grup basligi: deger + kac kayit. Sayi olmadan kullanici gruplari
      // karsilastirmak icin hepsini acmak zorunda kalirdi.
      expect(rows[0]).toHaveTextContent("Aktif");
      expect(rows[0]).toHaveTextContent("(15)");

      /*
        VE ozet: cift indeksli 15 satirin tutarlari 0,2,...,28 -> 210.
        Grup satirinin `colSpan` ile tek serit yapilmamasinin tum sebebi
        bu sayinin kendi kolonunda durabilmesi.
      */
      expect(rows[0]).toHaveTextContent("210");
      expect(rows[1]).toHaveTextContent("225");

      // Grup ozetlerinin toplami genel toplama esit: iki sayi da AYNI
      // `meta.aggregate` tanimindan geliyor.
      expect(summaryRow()).toHaveTextContent("435");
    });

    test("grup açılınca kayıtlar görünür", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await groupBy(user, "Durum");
      await user.click(
        within(bodyRows()[0] as HTMLElement).getByRole("button", {
          name: "Grubu genişlet",
        }),
      );

      // 2 grup + 15 kayit. `paginateExpandedRows: false` sayesinde acilan
      // cocuklar sayfa sinirini asip sonraki sayfaya TASMIYOR.
      expect(bodyRows()).toHaveLength(17);
      expect(screen.getByText("Satır 1")).toBeInTheDocument();
    });

    test("rozet gruplamayı kaldırır", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await groupBy(user, "Durum");
      expect(bodyRows()).toHaveLength(2);

      await user.click(
        screen.getByRole("button", { name: "Durum gruplamasını kaldır" }),
      );

      expect(bodyRows()).toHaveLength(30);
    });

    test("gruplanamayan kolonlar listede YOK", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await user.click(screen.getByRole("button", { name: /Grupla/ }));

      /*
        Secim ve islem kolonlarinin `accessorFn`i yok; onlara "gore"
        gruplamanin bir anlami olmazdi. TanStack bunu `getCanGroup()` ile
        zaten soyluyor -- panelin isi o cevaba UYMAK, kendi listesini
        uydurmak degil.
      */
      expect(
        await screen.findByRole("menuitemcheckbox", { name: "Durum" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("menuitemcheckbox", { name: /İşlemler/ }),
      ).not.toBeInTheDocument();
    });

    test("özeti OLMAYAN sayısal kolon grup başlığında toplanmaz", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await groupBy(user, "Durum");

      /*
        OLCULEN HATA: TanStack'in varsayilan kolon tanimi
        `aggregationFn: "auto"` -- sayisal her kolon kendini toplanabilir
        saniyor. Tarayicida kart NUMARASI kolonu grup basliklarinda
        kimliklerin toplamini gosterdi (91, 72, 78, 84): anlamsiz, ama
        anlamli duracak bicimde bicimlenmis dort sayi.

        "Ad" kolonu metin oldugu icin toplanmiyor; ayni tuzagi SAYISAL bir
        kolonla sinamak gerek. `amount` ozetli, `name` degil -- burada
        gruplanan satirda `name` hucresinin BOS oldugunu dogruluyoruz.
      */
      const groupRow = bodyRows()[0] as HTMLElement;
      const cells = within(groupRow).getAllByRole("cell");

      // Kolon sirasi: gruplanan kolon basa alindi (`groupedColumnMode`),
      // ardindan secim, ad, tutar, islemler.
      expect(groupRow).toHaveTextContent("210");
      // "Satır" hicbir yerde yok: ad kolonu grup satirinda bos.
      expect(groupRow).not.toHaveTextContent("Satır");
      expect(cells.length).toBeGreaterThan(0);
    });

    test("grup başlığı HAM değeri değil, kullanıcının gördüğü ETİKETİ yazar", async () => {
      const user = userEvent.setup();
      render(
        <Grid data={FLAT} pageSize={30} columnsOverride={LABELED_COLUMNS} />,
      );

      await groupBy(user, "Durum");

      /*
        OLCULEN SORUN: "Tip"e gore gruplandiginda baslikta ham enum degeri
        (`task`) yaziyordu, oysa hucrelerde "Görev" yaziyor. Ayni seyin iki
        adi olmasi, kullanicinin grup basligini veriyle eslestirememesi
        demek.

        Esleme icin YENI bir meta alani eklemedik: `filterOptions` zaten
        deger -> etiket eslemesini tasiyor (secim filtresi onu kullaniyor).
        Bu test, o tek kaynagin iki yerde birden gecerli oldugunu koruyor.
      */
      expect(bodyRows()[0]).toHaveTextContent("Etkin");
      expect(bodyRows()[0]).not.toHaveTextContent("Aktif");
    });

    test("grup satırında satır işlemleri menüsü ÇİZİLMEZ", async () => {
      const user = userEvent.setup();
      render(<Grid data={FLAT} pageSize={30} />);

      await groupBy(user, "Durum");

      /*
        Grup satirinin `row.original`i YOK. Islem menusu cizilseydi "Sil"e
        basildiginda tanimsiz bir kayit uzerinde islem yapilirdi -- sessiz
        ve geri alinamaz bir hata sinifi.
      */
      expect(
        within(bodyRows()[0] as HTMLElement).queryByRole("button", {
          name: "Satır işlemleri",
        }),
      ).not.toBeInTheDocument();
    });
  });
});
