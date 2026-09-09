import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DataGrid } from "../components/data-grid";
import { GridToolbar } from "../components/grid-toolbar";
import { createGridColumnHelper } from "./features";
import type { GridStorage } from "./grid-storage";
import {
  type PersistedSlice,
  usePersistedGridLayout,
} from "./use-grid-persistence";
import { useGridTable } from "./use-grid-table";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const helper = createGridColumnHelper<Row>();

const columns = helper.columns([
  helper.accessor("name", { header: "Ad", size: 200 }),
  helper.accessor("amount", { header: "Tutar", size: 120 }),
]);

const DATA: Row[] = [
  { id: "1", name: "Bir", amount: 10 },
  { id: "2", name: "İki", amount: 20 },
  { id: "3", name: "Üç", amount: 30 },
];

/**
 * SAHTE DEPO -- `localStorage` DEGIL.
 *
 * jsdom `localStorage` sagliyor ama testler arasi sizinti ve "hangi test
 * neyi yazdi" belirsizligi uretiyor. Ustelik asil sinamak istedigim sey
 * ARAYUZUN kendisi: sunucuya yazan bir tuketici de bu yolu kullanacak.
 * Sahte depo, asenkron okumayi da sinamayi mumkun kiliyor.
 */
function createMemoryStorage(seed?: Record<string, string>): GridStorage & {
  data: Map<string, string>;
  writes: number;
} {
  const data = new Map(Object.entries(seed ?? {}));
  const storage = {
    data,
    writes: 0,
    read: (key: string) => data.get(key) ?? null,
    write: (key: string, value: string) => {
      storage.writes += 1;
      data.set(key, value);
    },
    remove: (key: string) => {
      data.delete(key);
    },
  };
  return storage;
}

function Grid({
  storage,
  include,
  version,
  storageKey = "test-grid",
  // Testlerin cogu beklemek istemiyor; gercek varsayilan 400ms.
  debounceMs = 1,
}: {
  storage: GridStorage;
  include?: PersistedSlice[];
  version?: number;
  storageKey?: string;
  debounceMs?: number;
}) {
  const table = useGridTable<Row>({
    data: DATA,
    columns,
    getRowId: (row) => row.id,
  });

  const layout = usePersistedGridLayout(table, {
    key: storageKey,
    storage,
    debounceMs,
    ...(include === undefined ? {} : { include }),
    ...(version === undefined ? {} : { version }),
  });

  return (
    <>
      <GridToolbar table={table} onResetLayout={layout.reset} />
      <DataGrid table={table} />
    </>
  );
}

/**
 * `initialState`te DONDURMA tanimlayan izgara.
 *
 * Ayri bir harness cunku sinanan sey tam olarak su: kayitli durum ile
 * uygulamanin varsayilani CATISTIGINDA hangisi kazaniyor.
 */
function PinnedGrid({
  storage,
  include,
}: {
  storage: GridStorage;
  include?: PersistedSlice[];
}) {
  const table = useGridTable<Row>({
    data: DATA,
    columns,
    getRowId: (row) => row.id,
    initialState: { columnPinning: { start: ["name"], end: [] } },
  });

  usePersistedGridLayout(table, {
    key: "test-grid",
    storage,
    debounceMs: 1,
    ...(include === undefined ? {} : { include }),
  });

  return <DataGrid table={table} />;
}

/** Depoya yazilmis durumu okur. */
const readStored = (
  storage: { data: Map<string, string> },
  key = "test-grid",
) =>
  JSON.parse(storage.data.get(key) ?? "{}") as {
    v?: number;
    s?: Record<string, unknown>;
  };

/** Bir kolonun dondurma kenari ("start" / "end") ya da `null`. */
const pinnedOf = (name: string) =>
  screen
    .getByRole("columnheader", { name: new RegExp(name) })
    .getAttribute("data-pinned");

const headerWidth = (name: string) =>
  Number.parseInt(
    (
      screen.getByRole("columnheader", {
        name: new RegExp(name),
      }) as HTMLElement
    ).style.width,
    10,
  );

describe("durum kalıcılığı", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("kayıtlı kolon genişliği geri yükleniyor", async () => {
    const storage = createMemoryStorage({
      "test-grid": JSON.stringify({ v: 1, s: { columnSizing: { name: 320 } } }),
    });

    render(<Grid storage={storage} />);

    // Ilk kare VARSAYILAN duzeni ciziyor -- geri yukleme etkide oluyor.
    // (Sunucuda `localStorage` olmadigi icin baslangic durumundan
    // okuyamiyoruz; gerekcesi kancanin basinda.)
    expect(headerWidth("Ad")).toBe(200);

    await waitFor(() => {
      expect(headerWidth("Ad")).toBe(320);
    });
  });

  test("değişiklik depoya yazılıyor", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();

    render(<Grid storage={storage} />);

    await user.click(screen.getByRole("button", { name: /Kolonlar/ }));
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Tutar" }),
    );

    await waitFor(() => {
      expect(readStored(storage).s?.columnVisibility).toEqual({
        amount: false,
      });
    });
  });

  test("GERİ YÜKLEMEDEN ÖNCE yazmıyor -- yoksa kaydı kendisi silerdi", async () => {
    /*
      OLCULEN OLMASI GEREKEN DAVRANIS.

      Kanca once yazip sonra okusaydi sira su olurdu: bilesen baglanir ->
      durum VARSAYILAN -> kaydetme etkisi calisir -> varsayilanlar depoya
      yazilir -> geri yukleme kendi sildigi seyi bulur. Yani kalicilik
      ozelligi kaliciligi bozan sey olurdu.

      Okuma BILEREK yavas: gercek hayattaki sunucu deposu da boyle.
    */
    const inner = createMemoryStorage({
      "test-grid": JSON.stringify({ v: 1, s: { columnSizing: { name: 288 } } }),
    });
    const slowStorage: GridStorage = {
      ...inner,
      read: async (key) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return inner.read(key);
      },
    };

    render(<Grid storage={slowStorage} />);

    await waitFor(() => {
      expect(headerWidth("Ad")).toBe(288);
    });

    // Kayit hala orada: yavas okuma sirasinda uzerine yazilmadi.
    expect(readStored(inner).s?.columnSizing).toEqual({ name: 288 });
  });

  test("ARTIK VAR OLMAYAN kolonlar budanıyor", async () => {
    /*
      Bu, kaliciligin en tehlikeli hatasi. Kayit o gunku kolon
      kimliklerine gonderme yapiyor; kolon kaldirilmis ya da adi degismis
      olabilir.

      En kotusu `columnFilters`: sunucu tarafli izgarada bayat bir filtre
      API'ye gider ve sunucu "Filtrelenemeyen alan" diye 400 doner --
      izgara acilmaz ve SAYFAYI YENILEMEK KURTARMAZ, cunku hata kayitli.
    */
    const storage = createMemoryStorage({
      "test-grid": JSON.stringify({
        v: 1,
        s: {
          columnSizing: { name: 260, silinmisKolon: 999 },
          columnPinning: { start: ["silinmisKolon"], end: [] },
          columnFilters: [{ id: "silinmisKolon", value: "x" }],
        },
      }),
    });

    render(
      <Grid
        storage={storage}
        include={["columnSizing", "columnPinning", "columnFilters"]}
      />,
    );

    await waitFor(() => {
      expect(headerWidth("Ad")).toBe(260);
    });

    const stored = readStored(storage).s;
    expect(stored?.columnSizing).toEqual({ name: 260 });
    expect(stored?.columnFilters).toEqual([]);
  });

  test("budama bir dilimi BOŞALTTIYSA o dilim hiç uygulanmıyor", async () => {
    /*
      TARAYICIDA OLCULEN HATA. Bayat bir kayit denedim:
      `columnPinning: { start: ["silinmisKolon"] }`. Budama bunu
      `{ start: [], end: [] }` yapti ve tabloya oylece yazildi -- yani
      uygulamanin `initialState`te tanimladigi "kimlik kolonlari
      dondurulsun" karari SESSIZCE silindi.

      Bosalmis bir liste "kullanici bos istedi" demek degil, "elimizde bir
      sey kalmadi" demek. Ikisini ayirmak sart:
        - kayit ZATEN bostu      -> kullanici gercekten cozmus, uygula
        - kayit DOLUYDU, budandi -> temsil edilemiyor, VARSAYILANI koru
    */
    const storage = createMemoryStorage({
      "test-grid": JSON.stringify({
        v: 1,
        s: { columnPinning: { start: ["silinmisKolon"], end: [] } },
      }),
    });

    render(<PinnedGrid storage={storage} include={["columnPinning"]} />);

    /*
      Depoya YENIDEN yazilmasini bekliyoruz: kayit tablonun durumuyla
      degistiginde geri yukleme bitmis demektir. (Tohum degerin varligini
      beklemek yetmezdi -- o zaten ilk andan itibaren orada.)
    */
    await waitFor(() => {
      expect(readStored(storage).s?.columnPinning).toEqual({
        start: ["name"],
        end: [],
      });
    });

    // Ve ekranda: `initialState`teki dondurma AYAKTA.
    expect(pinnedOf("Ad")).toBe("start");
  });

  test("GERÇEKTEN boş kayıt uygulanıyor -- tercih geri gelmiyor", async () => {
    // Kullanici dondurmayi kendi cozduyse, her yenilemede geri gelmemeli.
    const storage = createMemoryStorage({
      "test-grid": JSON.stringify({
        v: 1,
        s: { columnPinning: { start: [], end: [] } },
      }),
    });

    render(<PinnedGrid storage={storage} include={["columnPinning"]} />);

    // Once dondurulmus basliyor (`initialState`), sonra kayit uygulaniyor.
    await waitFor(() => {
      expect(pinnedOf("Ad")).toBeNull();
    });
  });

  test("sürüm uyuşmazsa kayıt YOK SAYILIYOR", async () => {
    // Kolon kimliklerini toptan degistirdiginizde budama her seyi atar ama
    // SESSIZCE. Surumu artirmak, gecersizligi ACIK bir karar yapiyor.
    const storage = createMemoryStorage({
      "test-grid": JSON.stringify({ v: 1, s: { columnSizing: { name: 320 } } }),
    });

    render(<Grid storage={storage} version={2} />);

    await waitFor(() => {
      expect(readStored(storage).v).toBe(2);
    });
    expect(headerWidth("Ad")).toBe(200);
  });

  test("bozuk kayıt ızgarayı çökertmiyor", async () => {
    const storage = createMemoryStorage({ "test-grid": "{bu json değil" });

    render(<Grid storage={storage} />);

    // Izgara varsayilan duzenle acildi; hata yukari sizmadi.
    expect(headerWidth("Ad")).toBe(200);
    await waitFor(() => {
      expect(readStored(storage).v).toBe(1);
    });
  });

  test("filtreler varsayılan olarak KAYDEDİLMİYOR", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();

    render(<Grid storage={storage} />);

    await user.type(screen.getByLabelText("Tümünde ara"), "Bir");

    await waitFor(() => {
      expect(readStored(storage).s).toBeDefined();
    });

    /*
      Kullanici dun 640 kaydi 12'ye indiren bir filtre kurup sekmeyi
      kapatsa, bugun gordugu sey "verilerim kayboldu" olurdu -- ekranda
      "bir filtre acik" diyen hicbir sey yok.

      GORUNUMU degistiren sey kaydediliyor, VERIYI degistiren sey
      kaydedilmiyor.
    */
    expect(readStored(storage).s).not.toHaveProperty("globalFilter");
    expect(readStored(storage).s).not.toHaveProperty("columnFilters");
    expect(readStored(storage).s).toHaveProperty("columnSizing");
  });

  test("sayfa NUMARASI hiç kaydedilmiyor, sayfa BOYUTU kaydediliyor", async () => {
    const storage = createMemoryStorage();
    render(<Grid storage={storage} />);

    await waitFor(() => {
      expect(readStored(storage).s).toHaveProperty("pageSize");
    });
    // "7. sayfa" bir tercih degil gecici bir konum; veri degistiyse yarin
    // ayni sayfa BASKA kayitlari gosterir.
    expect(readStored(storage).s).not.toHaveProperty("pagination");
    expect(readStored(storage).s).not.toHaveProperty("pageIndex");
  });

  test("Düzeni sıfırla kaydı siler ve varsayılanlara döner", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage({
      "test-grid": JSON.stringify({ v: 1, s: { columnSizing: { name: 400 } } }),
    });

    render(<Grid storage={storage} />);
    await waitFor(() => {
      expect(headerWidth("Ad")).toBe(400);
    });

    await user.click(screen.getByRole("button", { name: /Kolonlar/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Düzeni sıfırla/ }),
    );

    /*
      KACIS KAPISI. Kalicilik olmadan kotu bir duzenden cikmanin yolu
      sayfayi yenilemekti; duzen kaydedilir hale gelince o yol kapaniyor.
      Sifirlama olmadan kullanici kendi kurdugu tuzakta kalirdi.
    */
    expect(headerWidth("Ad")).toBe(200);
  });

  test("art arda değişiklikler TEK yazmaya iniyor (geciktirme)", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();

    // Gercekci bir gecikme: digerlerinde 1ms, yani fiilen geciktirme yok.
    render(<Grid storage={storage} debounceMs={300} />);
    await waitFor(() => {
      expect(storage.writes).toBeGreaterThan(0);
    });

    const before = storage.writes;
    const separator = screen.getAllByRole("separator")[0] as HTMLElement;
    separator.focus();

    /*
      Art arda on genislik degisikligi. `columnResizeMode: "onChange"` ile
      GERCEK bir surukleme bunu yuzlerce kez uretiyor -- ve `localStorage`
      SENKRON, yani her yazma ana is parcacigini kilitler. Geciktirme
      olmasaydi suruklemenin kendisi takilirdi.
    */
    await user.keyboard("{ArrowRight>10/}");

    await waitFor(
      () => {
        expect(storage.writes).toBeGreaterThan(before);
      },
      { timeout: 2000 },
    );

    // On degisiklik, TEK yazma.
    expect(storage.writes - before).toBe(1);
  });
});
