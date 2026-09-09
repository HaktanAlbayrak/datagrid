import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createGridColumnHelper } from "../core/features";
import { useGridEditing } from "../core/use-grid-editing";
import { useGridTable } from "../core/use-grid-table";
import { DataGrid } from "./data-grid";
import { GridEditBar } from "./edit-bar";
import { EditableCell } from "./editable-cell";

interface Item {
  id: string;
  name: string;
  amount: number;
}

const DATA: Item[] = [
  { id: "1", name: "Birinci", amount: 10 },
  { id: "2", name: "İkinci", amount: 20 },
];

const onSave = vi.fn();

function Grid({
  mode = "cell",
  failing = false,
}: {
  mode?: "cell" | "batch";
  failing?: boolean;
}) {
  const [data] = useState(DATA);

  const editing = useGridEditing<Item>({
    mode,
    onSave: async (changes) => {
      onSave(changes);
      if (failing) throw new Error("sunucu hatası");
    },
    validate: (address, value) => {
      if (
        address.columnId === "amount" &&
        typeof value === "number" &&
        value < 0
      ) {
        return "Negatif olamaz";
      }
      if (address.columnId === "name" && value === null) {
        return "Ad zorunlu";
      }
      return undefined;
    },
  });

  /*
    Kolonlar BILESEN ICINDE cunku `editing` nesnesine ihtiyaclari var.

    Bu, "kolonlari modul seviyesinde tut" kuralinin MESRU istisnasi:
    duzenleme durumu her render'da degisiyor ve hucrelerin onu gormesi
    gerekiyor. `useMemo` ile sabitlemek de yanlis olurdu -- bayat bir
    `editing` yakalanirdi.
  */
  const helper = createGridColumnHelper<Item>();
  const columns = helper.columns([
    helper.accessor("name", {
      header: "Ad",
      cell: (context) => <EditableCell context={context} editing={editing} />,
    }),
    helper.accessor("amount", {
      header: "Tutar",
      cell: (context) => (
        <EditableCell context={context} editing={editing} type="number" />
      ),
    }),
  ]);

  const table = useGridTable<Item>({
    data,
    columns,
    getRowId: (row) => row.id,
  });

  return (
    <>
      <GridEditBar editing={editing} />
      <DataGrid table={table} />
    </>
  );
}

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1] as HTMLElement).getAllByRole("row");

const openCell = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
  columnIndex: number,
) => {
  const cell = within(bodyRows()[rowIndex] as HTMLElement).getAllByRole(
    "button",
  )[columnIndex] as HTMLElement;
  await user.dblClick(cell);
};

describe("hücre düzenleme", () => {
  beforeEach(() => onSave.mockClear());

  test("çift tıklama düzenlemeyi açar, Enter kaydeder", async () => {
    const user = userEvent.setup();
    render(<Grid />);

    await openCell(user, 0, 0);

    const input = screen.getByRole("textbox", { name: "name düzenle" });
    await user.clear(input);
    await user.type(input, "Değişti{Enter}");

    expect(onSave).toHaveBeenCalledWith({ "1": { name: "Değişti" } });
  });

  test("Escape VAZGEÇER -- yazılan atılır", async () => {
    /*
      En kritik klavye davranisi.

      Escape onaylasaydi kullanicinin "yanlis yazdim, iptal" refleksi
      SESSIZCE veri yazardi. Elektronik tablolarin ortak dilinde Escape
      her zaman vazgecmektir.
    */
    const user = userEvent.setup();
    render(<Grid />);

    await openCell(user, 0, 0);
    const input = screen.getByRole("textbox", { name: "name düzenle" });
    await user.clear(input);
    await user.type(input, "atılacak{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Birinci")).toBeInTheDocument();
  });

  test("açılınca metin TAMAMEN seçili olur", async () => {
    // Bir hucreyi acmanin en yaygin sebebi degeri DEGISTIRMEK, sonuna
    // ekleme yapmak degil. Secili gelmezse kullanici her seferinde
    // Ctrl+A yapmak zorunda kalir.
    const user = userEvent.setup();
    render(<Grid />);

    await openCell(user, 0, 0);
    const input = screen.getByRole("textbox", {
      name: "name düzenle",
    }) as HTMLInputElement;

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Birinci".length);
  });

  test("boş metin `null` olur, boş dize DEĞİL", async () => {
    // "Temizle" ile "bos dize yaz" farkli seyler: veritabaninda ilki NULL.
    // Burada `name` bos birakilinca dogrulama devreye giriyor.
    const user = userEvent.setup();
    render(<Grid />);

    await openCell(user, 0, 0);
    const input = screen.getByRole("textbox", { name: "name düzenle" });
    await user.clear(input);
    await user.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "name düzenle" }),
    ).toBeInTheDocument();
  });

  describe("doğrulama", () => {
    test("geçersiz değer kaydedilmez ve hücre AÇIK kalır", async () => {
      // Kapatsaydik kullanici hatayi gorur ama duzeltmek icin hucreyi
      // yeniden acmak zorunda kalirdi.
      const user = userEvent.setup();
      render(<Grid />);

      await openCell(user, 0, 1);
      const input = screen.getByRole("spinbutton", { name: "amount düzenle" });
      await user.clear(input);
      await user.type(input, "-5{Enter}");

      expect(onSave).not.toHaveBeenCalled();
      expect(
        screen.getByRole("spinbutton", { name: "amount düzenle" }),
      ).toHaveAttribute("aria-invalid", "true");
    });

    test("düzeltilince kaydediliyor", async () => {
      const user = userEvent.setup();
      render(<Grid />);

      await openCell(user, 0, 1);
      await user.clear(
        screen.getByRole("spinbutton", { name: "amount düzenle" }),
      );
      await user.type(
        screen.getByRole("spinbutton", { name: "amount düzenle" }),
        "-5{Enter}",
      );

      // Girdi YENIDEN sorgulaniyor: hatali onaydan sonra bilesen yeniden
      // ciziliyor ve eski referans DOM'dan kopmus oluyor. Testin sakladigi
      // bayat referans, gercek kullanicinin yasamadigi bir hata uretirdi.
      await user.clear(
        screen.getByRole("spinbutton", { name: "amount düzenle" }),
      );
      await user.type(
        screen.getByRole("spinbutton", { name: "amount düzenle" }),
        "42{Enter}",
      );

      expect(onSave).toHaveBeenCalledWith({ "1": { amount: 42 } });
    });
  });

  describe("kayıt hatası", () => {
    test("sunucu hata verirse değişiklik KAYBOLMAZ", async () => {
      /*
        Temizleseydik kullanicinin yazdigi deger gider ve ekranda ESKI
        deger gorunurdu -- "kaydettim sandim" durumunun tam kaynagi.
        Degisiklik bekleyenlerde kaliyor ve hucre kirli isaretleniyor.
      */
      const user = userEvent.setup();
      render(<Grid failing />);

      await openCell(user, 0, 0);
      const input = screen.getByRole("textbox", { name: "name düzenle" });
      await user.clear(input);
      await user.type(input, "Kalıcı{Enter}");

      expect(await screen.findByText("Kalıcı")).toBeInTheDocument();
    });
  });

  describe("toplu (batch) kip", () => {
    test("değişiklikler birikir, Kaydet'e kadar sunucuya GİTMEZ", async () => {
      const user = userEvent.setup();
      render(<Grid mode="batch" />);

      await openCell(user, 0, 0);
      await user.clear(screen.getByRole("textbox", { name: "name düzenle" }));
      await user.type(
        screen.getByRole("textbox", { name: "name düzenle" }),
        "A{Enter}",
      );

      await openCell(user, 1, 0);
      await user.clear(screen.getByRole("textbox", { name: "name düzenle" }));
      await user.type(
        screen.getByRole("textbox", { name: "name düzenle" }),
        "B{Enter}",
      );

      expect(onSave).not.toHaveBeenCalled();
      expect(
        screen.getByText("2 satırda kaydedilmemiş değişiklik"),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Kaydet/ }));

      expect(onSave).toHaveBeenCalledWith({
        "1": { name: "A" },
        "2": { name: "B" },
      });
    });

    test("Vazgeç değişiklikleri geri alır", async () => {
      const user = userEvent.setup();
      render(<Grid mode="batch" />);

      await openCell(user, 0, 0);
      await user.clear(screen.getByRole("textbox", { name: "name düzenle" }));
      await user.type(
        screen.getByRole("textbox", { name: "name düzenle" }),
        "Geçici{Enter}",
      );

      expect(screen.getByText("Geçici")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Vazgeç/ }));

      expect(screen.getByText("Birinci")).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    test("hata varken Kaydet KAPALI", async () => {
      // Gecersiz satirlari atlayip digerlerini kaydetmek "yardimsever"
      // gorunur ama kullanici hangilerinin gectigini bilemez.
      const user = userEvent.setup();
      render(<Grid mode="batch" />);

      await openCell(user, 0, 0);
      await user.clear(screen.getByRole("textbox", { name: "name düzenle" }));
      await user.type(
        screen.getByRole("textbox", { name: "name düzenle" }),
        "İyi{Enter}",
      );

      await openCell(user, 1, 1);
      const amount = screen.getByRole("spinbutton", { name: "amount düzenle" });
      await user.clear(amount);
      await user.type(amount, "-1{Enter}");

      expect(screen.getByRole("button", { name: /Kaydet/ })).toBeDisabled();
      expect(screen.getByText(/1 hata/)).toBeInTheDocument();
    });

    test("değişiklik yokken çubuk ÇİZİLMEZ", () => {
      // Bos bir arac cubugu dikey alan yiyor ve "burada bir sey var" diye
      // bakmaya zorluyor.
      render(<Grid mode="batch" />);

      expect(
        screen.queryByText(/kaydedilmemiş değişiklik/),
      ).not.toBeInTheDocument();
    });
  });
});
