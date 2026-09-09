import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, test, vi } from "vitest";

import { DataGrid } from "../components/data-grid";
import { TreeCell } from "../components/tree-cell";
import { createGridColumnHelper } from "./features";
import { useGridTable } from "./use-grid-table";
import { useLazyTree } from "./use-lazy-tree";

interface Node {
  id: string;
  name: string;
  childCount: number;
}

const helper = createGridColumnHelper<Node>();

const columns = helper.columns([
  helper.accessor("name", {
    header: "Ad",
    cell: (context) => <TreeCell context={context} />,
  }),
]);

/**
 * Sunucu taklidi: KOK iki dugum, "Pano A"nin iki cocugu var, "Pano B"nin
 * `childCount` 1 diyor ama BOS donuyor (bayat sayim senaryosu).
 */
const TREE: Record<string, Node[]> = {
  __root__: [
    { id: "a", name: "Pano A", childCount: 2 },
    { id: "b", name: "Pano B", childCount: 1 },
  ],
  a: [
    { id: "a1", name: "Kolon A1", childCount: 0 },
    { id: "a2", name: "Kolon A2", childCount: 0 },
  ],
  b: [],
};

function Tree({
  load,
  onError,
}: {
  load: (parent: Node | null) => Promise<Node[]>;
  onError?: (error: unknown) => void;
}) {
  const lazy = useLazyTree<Node>({
    loadChildren: load,
    getRowId: (row) => row.id,
    hasChildren: (row) => row.childCount > 0,
    ...(onError === undefined ? {} : { onError }),
  });

  const table = useGridTable<Node>({
    data: lazy.rows,
    columns,
    getRowId: (row) => row.id,
    getSubRows: lazy.getSubRows,
    getRowCanExpand: lazy.getRowCanExpand,
  });

  /*
    ACIK SATIRLARI BILDIRIYORUZ, "acildi" olayini degil.

    Bir satir programatik olarak da acilabiliyor (durum geri yukleme,
    `expandAll`, baglantiyla gelme) ve o yollarin hicbiri tiklama olayi
    uretmiyor -- dal acik gorunur ama bos kalirdi.
  */
  // biome-ignore lint/correctness/useExhaustiveDependencies: expanded durumu tetikleyici; kaldırılırsa açılan dal boş kalır
  useEffect(() => {
    lazy.ensureLoaded(
      table
        .getRowModel()
        .rows.filter((row) => row.getIsExpanded())
        .map((row) => row.original),
    );
  }, [table.state.expanded, lazy.ensureLoaded, table]);

  return (
    <>
      <DataGrid table={table} isLoading={lazy.isLoadingRoot} />
      <button
        type="button"
        onClick={() => {
          const row = lazy.rows.find((entry) => entry.id === "a");
          if (row !== undefined) lazy.retry(row);
        }}
      >
        Tekrar dene
      </button>
      <button
        type="button"
        onClick={() => {
          const row = lazy.rows.find((entry) => entry.id === "a");
          if (row !== undefined) lazy.invalidate(row);
        }}
      >
        Dalı tazele
      </button>
    </>
  );
}

const loader = (delayMs = 0) =>
  vi.fn(async (parent: Node | null) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return TREE[parent === null ? "__root__" : parent.id] ?? [];
  });

const expandButton = (name: string) =>
  screen.getByRole("row", { name: new RegExp(name) }).querySelector("button");

describe("tembel ağaç", () => {
  test("kök yükleniyor, çocuklar AÇILINCA geliyor", async () => {
    const user = userEvent.setup();
    const load = loader();
    render(<Tree load={load} />);

    await screen.findByText("Pano A");
    // Kok icin BIR istek; cocuklar icin henuz hicbiri.
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Kolon A1")).not.toBeInTheDocument();

    await user.click(expandButton("Pano A") as HTMLElement);

    await screen.findByText("Kolon A1");
    expect(screen.getByText("Kolon A2")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("kapatıp açmak YENİDEN çekmiyor", async () => {
    const user = userEvent.setup();
    const load = loader();
    render(<Tree load={load} />);
    await screen.findByText("Pano A");

    await user.click(expandButton("Pano A") as HTMLElement);
    await screen.findByText("Kolon A1");
    expect(load).toHaveBeenCalledTimes(2);

    await user.click(expandButton("Pano A") as HTMLElement);
    await user.click(expandButton("Pano A") as HTMLElement);
    await screen.findByText("Kolon A1");

    /*
      Agacta gezinmek dogal olarak "ac-kapa-ac" bicimindedir; her acilista
      ag turu hem yavas hem gereksiz olurdu.
    */
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("'çocuğu var' deyip BOŞ dönen düğüm yaprağa dönüşüyor", async () => {
    const user = userEvent.setup();
    const load = loader();
    render(<Tree load={load} />);
    await screen.findByText("Pano B");

    // Sunucunun sayimi bayat olabiliyor (arada silinmis olabilir).
    expect(expandButton("Pano B")).not.toBeNull();

    await user.click(expandButton("Pano B") as HTMLElement);

    /*
      Yuklendikten SONRA hala ok cizseydik kullanici tiklar, hicbir sey
      acilmaz ve tekrar tiklar -- calismayan bir dugme. Ok kayboluyor:
      dugum artik yaprak.
    */
    await waitFor(() => {
      expect(expandButton("Pano B")).toBeNull();
    });
  });

  test("hata SONSUZ YÜKLENİYOR bırakmıyor ve otomatik tekrar denemiyor", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const load = vi.fn(async (parent: Node | null) => {
      if (parent === null) return TREE.__root__ as Node[];
      throw new Error("sunucu hatası");
    });

    render(<Tree load={load} onError={onError} />);
    await screen.findByText("Pano A");

    await user.click(expandButton("Pano A") as HTMLElement);
    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    /*
      Otomatik yeniden deneseydik dongu olusurdu: dal acik -> yukle -> hata
      -> durum degisti -> yeniden kos -> yukle... Saniyede onlarca istek,
      ustelik zaten hata veren bir uca.
    */
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(load).toHaveBeenCalledTimes(2);

    // Yeniden deneme ACIK bir eylem.
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }));
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(3);
    });
  });

  test("aynı anda açılan dallar birbirini EZMİYOR", async () => {
    /*
      Kullanici uc dali hizla acabiliyor ve istekler paralel donuyor.
      Durumu anahtarli bir sozlukte tuttugumuz icin her cevap yalnizca
      kendi anahtarini yaziyor. Agaci derin kopyalayip yerinde
      degistirseydik gec donen cevap erken donenin yazdigini silerdi --
      belirtisi "bazen acilan dal bos kaliyor" olurdu.
    */
    const user = userEvent.setup();
    const delays: Record<string, number> = { a: 40, c: 5 };
    const data: Record<string, Node[]> = {
      __root__: [
        { id: "a", name: "Pano A", childCount: 2 },
        { id: "c", name: "Pano C", childCount: 1 },
      ],
      a: [{ id: "a1", name: "Kolon A1", childCount: 0 }],
      c: [{ id: "c1", name: "Kolon C1", childCount: 0 }],
    };

    const load = vi.fn(async (parent: Node | null) => {
      if (parent === null) return data.__root__ as Node[];
      await new Promise((resolve) =>
        setTimeout(resolve, delays[parent.id] ?? 0),
      );
      return data[parent.id] ?? [];
    });

    render(<Tree load={load} />);
    await screen.findByText("Pano A");

    // A YAVAS, C HIZLI: C once donuyor, A sonra.
    await user.click(expandButton("Pano A") as HTMLElement);
    await user.click(expandButton("Pano C") as HTMLElement);

    await screen.findByText("Kolon C1");
    await screen.findByText("Kolon A1");

    // Ikisi de ayakta: gec donen erken doneni silmedi.
    expect(screen.getByText("Kolon C1")).toBeInTheDocument();
    expect(screen.getByText("Kolon A1")).toBeInTheDocument();
  });

  test("invalidate önbelleği atıyor, sonraki açılışta yeniden yüklüyor", async () => {
    const user = userEvent.setup();
    const load = loader();
    render(<Tree load={load} />);
    await screen.findByText("Pano A");

    await user.click(expandButton("Pano A") as HTMLElement);
    await screen.findByText("Kolon A1");
    expect(load).toHaveBeenCalledTimes(2);

    /*
      Onbellek dogru varsayilan ama SONSUZ degil: kullanici bir kart
      eklediginde dal bayatliyor. Tazeleme ACIK bir eylem -- her acilista
      yeniden cekmek yerine, degistigini BILEN taraf haber veriyor.
    */
    await user.click(screen.getByRole("button", { name: "Dalı tazele" }));

    // Kapali dal yeniden acilinca istek TEKRAR gidiyor.
    await user.click(expandButton("Pano A") as HTMLElement);
    await user.click(expandButton("Pano A") as HTMLElement);

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(3);
    });
  });
});
