import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";

import {
  createGroup,
  type FilterField,
  type FilterGroup,
} from "../core/filter-tree";
import { GridFilterBuilder } from "./grid-filter-builder";

const FIELDS: FilterField[] = [
  { name: "title", label: "Başlık", type: "text" },
  { name: "estimate", label: "Tahmin", type: "number" },
  {
    name: "priority",
    label: "Öncelik",
    type: "enum",
    options: [
      { value: "high", label: "Yüksek" },
      { value: "low", label: "Düşük" },
    ],
  },
  { name: "dueDate", label: "Son tarih", type: "date" },
];

function Builder({ onTree }: { onTree?: (tree: FilterGroup) => void }) {
  const [tree, setTree] = useState<FilterGroup>(() => createGroup("and"));

  return (
    <GridFilterBuilder
      fields={FIELDS}
      tree={tree}
      onChange={(next) => {
        setTree(next);
        onTree?.(next);
      }}
    />
  );
}

/** En son bildirilen agac. */
function capture() {
  let latest: FilterGroup | undefined;
  const onTree = (tree: FilterGroup) => {
    latest = tree;
  };
  return { onTree, get: () => latest };
}

describe("filtre kurucu", () => {
  test("koşul ekleyip alan ve işleç seçilebiliyor", async () => {
    const user = userEvent.setup();
    const tree = capture();
    render(<Builder onTree={tree.onTree} />);

    // Bos durum ACIKCA yaziyor: "grup ekledim ama bir sey degismedi"
    // sorusunu bastan cevapliyor.
    expect(screen.getByText(/bu grup sonucu etkilemiyor/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Koşul" }));

    await user.selectOptions(screen.getByLabelText("Alan"), "estimate");
    await user.selectOptions(screen.getByLabelText("İşleç"), "gt");
    await user.type(screen.getByLabelText("Değer"), "8");

    const condition = tree.get()?.children[0];
    expect(condition).toMatchObject({
      kind: "condition",
      field: "estimate",
      operator: "gt",
      value: "8",
    });
  });

  test("alan değişince işleç ve değer SIFIRLANIYOR", async () => {
    const user = userEvent.setup();
    const tree = capture();
    render(<Builder onTree={tree.onTree} />);

    await user.click(screen.getByRole("button", { name: "Koşul" }));
    await user.type(screen.getByLabelText("Değer"), "ödeme");

    /*
      "başlık içerir ödeme" kosulunda alani "tahmin"e cevirirsek islec
      ("içerir") o tipte YOK ve deger bir metin. Eskisini korumak, ekranda
      gecerli ama calisirken anlamsiz bir kosul birakirdi.
    */
    await user.selectOptions(screen.getByLabelText("Alan"), "estimate");

    expect(tree.get()?.children[0]).toMatchObject({
      field: "estimate",
      operator: "eq",
      value: "",
    });
  });

  test("'boş' işlecinde DEĞER kutusu çizilmiyor", async () => {
    const user = userEvent.setup();
    render(<Builder />);

    await user.click(screen.getByRole("button", { name: "Koşul" }));
    expect(screen.getByLabelText("Değer")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("İşleç"), "isEmpty");

    /*
      "boş" bir degerle karsilastirmiyor, VARLIGA bakiyor. Kutu cizilseydi
      kullanici doldurur ve doldurmasinin hicbir etkisi olmazdi -- arayuzun
      soyledigi sey ile yaptigi sey ayrisirdi.
    */
    expect(screen.queryByLabelText("Değer")).not.toBeInTheDocument();
  });

  test("'arasında' İKİ uç kutusu çiziyor", async () => {
    const user = userEvent.setup();
    const tree = capture();
    render(<Builder onTree={tree.onTree} />);

    await user.click(screen.getByRole("button", { name: "Koşul" }));
    await user.selectOptions(screen.getByLabelText("Alan"), "estimate");
    await user.selectOptions(screen.getByLabelText("İşleç"), "between");

    await user.type(screen.getByLabelText("Alt sınır"), "3");
    await user.type(screen.getByLabelText("Üst sınır"), "8");

    expect(tree.get()?.children[0]).toMatchObject({
      operator: "between",
      value: ["3", "8"],
    });
  });

  test("enum alanı ROZETLERLE çoklu seçim", async () => {
    const user = userEvent.setup();
    const tree = capture();
    render(<Builder onTree={tree.onTree} />);

    await user.click(screen.getByRole("button", { name: "Koşul" }));
    await user.selectOptions(screen.getByLabelText("Alan"), "priority");

    /*
      `<select multiple>` Ctrl/Cmd basili tutmayi gerektiriyor; bunu bilmeyen
      kullanici her tiklamada onceki secimini kaybediyor ve dokunmatik
      cihazda pratikte kullanilamaz. Rozetler tek tikla acilip kapaniyor.
    */
    await user.click(screen.getByRole("button", { name: "Yüksek" }));
    await user.click(screen.getByRole("button", { name: "Düşük" }));
    expect(tree.get()?.children[0]).toMatchObject({ value: ["high", "low"] });

    // Ikinci tiklama KALDIRIYOR.
    await user.click(screen.getByRole("button", { name: "Düşük" }));
    expect(tree.get()?.children[0]).toMatchObject({ value: ["high"] });
  });

  test("bağlaç VE/VEYA arasında geçiyor ve hangisinin açık olduğu görünüyor", async () => {
    const user = userEvent.setup();
    const tree = capture();
    render(<Builder onTree={tree.onTree} />);

    const toggle = screen.getByRole("group", { name: "Bağlaç" });
    expect(within(toggle).getByRole("button", { name: "VE" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(toggle).getByRole("button", { name: "VEYA" }));

    expect(tree.get()?.combinator).toBe("or");
    expect(
      within(toggle).getByRole("button", { name: "VEYA" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("iç içe grup eklenip kaldırılabiliyor", async () => {
    const user = userEvent.setup();
    const tree = capture();
    render(<Builder onTree={tree.onTree} />);

    await user.click(screen.getByRole("button", { name: "Grup" }));

    const child = tree.get()?.children[0];
    expect(child).toMatchObject({ kind: "group", combinator: "or" });

    // Ic grup KENDI bağlac anahtarini tasiyor -- parantezin anlami bu.
    expect(screen.getAllByRole("group", { name: "Bağlaç" })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Grubu kaldır" }));
    expect(tree.get()?.children).toHaveLength(0);
  });

  test("koşul kaldırma yalnızca O koşulu siliyor", async () => {
    const user = userEvent.setup();
    const tree = capture();
    render(<Builder onTree={tree.onTree} />);

    await user.click(screen.getByRole("button", { name: "Koşul" }));
    await user.click(screen.getByRole("button", { name: "Koşul" }));
    expect(tree.get()?.children).toHaveLength(2);

    await user.click(
      screen.getAllByRole("button", {
        name: "Koşulu kaldır",
      })[0] as HTMLElement,
    );
    expect(tree.get()?.children).toHaveLength(1);
  });

  test("kök grubun KALDIR düğmesi YOK", async () => {
    const user = userEvent.setup();
    render(<Builder />);

    // Kok silinebilseydi kurucu kullanilamaz hale gelirdi: icine kosul
    // eklenecek bir grup kalmazdi.
    expect(
      screen.queryByRole("button", { name: "Grubu kaldır" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Grup" }));
    expect(
      screen.getAllByRole("button", { name: "Grubu kaldır" }),
    ).toHaveLength(1);
  });
});
