import type { CellContext, RowData } from "@tanstack/react-table";
import { AlertCircleIcon } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";

import type { GridFeatures } from "../core/features";
import type { CellAddress, GridEditing } from "../core/use-grid-editing";
import { cn } from "../lib/cn";
import { GridInput } from "../primitives/input";

type EditorType = "text" | "number" | "date";

/**
 * DUZENLENEBILIR HUCRE.
 *
 * ---
 * IKI HAL: GORUNUM ve DUZENLEME. Ucuncu bir hal yok.
 *
 * Her hucreye kalici bir `<input>` koymak (Excel gibi) cazip ama bir web
 * izgarasinda yikici: 25 satir × 8 kolon = 200 girdi elemani, her biri odak
 * sirasinda bir durak. Klavyeyle tabloyu gecmek 200 Tab demek olurdu.
 *
 * Gorunum halinde duz metin, yalnizca duzenlenen hucrede girdi: odak sirasi
 * dogal kaliyor ve DOM kucuk.
 *
 * ---
 * KLAVYE SOZLESMESI (elektronik tablolarin ortak dili):
 *   cift tiklama / Enter / F2 -> duzenlemeyi ac
 *   Enter                     -> onayla
 *   Escape                    -> VAZGEC (yazilan atilir)
 *   Tab                       -> onayla ve sonraki alana gec
 *   alan disina tiklama       -> onayla
 *
 * `Escape`in vazgecmesi sart: onaylasaydi kullanicinin "yanlis yazdim,
 * iptal" refleksi sessizce veri yazardi.
 */
export function EditableCell<TData extends RowData, TValue>({
  context,
  editing,
  type = "text",
  render,
}: {
  context: CellContext<GridFeatures, TData, TValue>;
  editing: GridEditing<TData>;
  /** Girdi tipi. `number` sayisal klavye ve ok tuslariyla artirma veriyor. */
  type?: EditorType;
  /** Gorunum halinde ozel cizim (rozet, bicimlenmis para vb.). */
  render?: (value: TValue) => ReactNode;
}) {
  const { row, column, getValue } = context;
  const address: CellAddress = { rowId: row.id, columnId: column.id };

  const value = editing.getDisplayValue(
    row.id,
    column.id,
    getValue(),
  ) as TValue;

  const isDirty = editing.isDirty(row.id, column.id);
  const error = editing.getError(row.id, column.id);

  /*
    DUZENLEYICI AYRI BIR BILESEN -- ve bu, olculmus bir hatanin duzeltmesi.

    Once taslagi bu bilesende tutuyordum. Sorun: `EditableCell` duzenleme
    acik olsun olmasin HEP mount halinde, yani `useState` baslatici yalnizca
    BIR KEZ calisiyor. Hucre ikinci kez acildiginda taslak eski degerde
    kaliyordu.

    Duzenleyiciyi ayirinca her acilista YENI bir bilesen mount oluyor:
    baslangic degeri dogru, odak ve secim mount aninda -- ek bir efekt ya da
    `key` numarasi olmadan.
  */
  if (editing.isEditing(row.id, column.id)) {
    return (
      <CellEditor
        columnId={column.id}
        initialValue={value}
        type={type}
        hasError={error !== undefined}
        onCommit={(parsed) => {
          void editing.commitCell(address, parsed, row.original);
        }}
        onCancel={editing.cancelEdit}
      />
    );
  }

  return (
    <button
      type="button"
      // `w-full`: hucrenin TAMAMI tiklanabilir olmali. Yalnizca metne
      // tiklanabilseydi BOS hucreleri acmak imkansiz olurdu.
      className={cn(
        "-mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 text-left",
        "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        // KIRLI HUCRE gorsel olarak isaretli. Olmasaydi "Kaydet"e basmadan
        // sayfadan cikan kullanici neyi kaybettigini bilemezdi.
        isDirty && "bg-amber-500/10 ring-1 ring-amber-500/40",
        error !== undefined && "bg-destructive/10 ring-1 ring-destructive/50",
      )}
      onDoubleClick={() => editing.startEdit(address)}
      onKeyDown={(event) => {
        // F2: Excel'in duzenleme tusu. Enter da aciyor -- ikisi de yaygin
        // refleks ve desteklemek bedava.
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          editing.startEdit(address);
        }
      }}
      title={error}
    >
      <span className="min-w-0 flex-1 truncate">
        {render === undefined
          ? value === null || value === undefined
            ? // Bos hucre TIRE ile: tamamen bos birakmak "veri yok" ile
              // "kolon dar" durumlarini ayirt edilemez yapardi.
              "—"
            : String(value)
          : render(value)}
      </span>

      {error !== undefined && (
        <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
      )}
    </button>
  );
}

/**
 * Yalnizca duzenleme suresince yasayan girdi.
 *
 * Mount aninda: deger yerlesiyor, odak veriliyor ve metin TAMAMEN seciliyor.
 * Ucu de geri cagirim ref icinde, yani React elemani DOM'a BAGLARKEN --
 * `requestAnimationFrame` ile bir kare beklemeye gerek yok. (Once oyle
 * yazmistim; zamanlama belirsizligi testte gorundu, demek ki yavas bir
 * cihazda kullanicida da gorunurdu.)
 */
function CellEditor({
  columnId,
  initialValue,
  type,
  hasError,
  onCommit,
  onCancel,
}: {
  columnId: string;
  initialValue: unknown;
  type: EditorType;
  hasError: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    initialValue === null || initialValue === undefined
      ? ""
      : String(initialValue),
  );

  const attach = useCallback((element: HTMLInputElement | null) => {
    if (element === null) return;
    element.focus();
    // Bir hucreyi acmanin en yaygin sebebi degeri DEGISTIRMEK, sonuna
    // ekleme yapmak degil. Excel de acilista tamamini seciyor.
    element.select();
  }, []);

  const commit = () => {
    /*
      BOS METIN -> `null`, bos dize DEGIL.

      "Temizle" ile "bos dize yaz" farkli seyler; veritabaninda ilki NULL,
      ikincisi ''. Sayi ve tarih alanlarinda bos dize zaten gecersiz.
    */
    onCommit(
      draft.trim() === "" ? null : type === "number" ? Number(draft) : draft,
    );
  };

  return (
    <GridInput
      ref={attach}
      type={type}
      value={draft}
      aria-label={`${columnId} düzenle`}
      aria-invalid={hasError}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          // `stopPropagation`: ust katmandaki diyalog/popup ESC ile
          // kapanmasin. Kullanicinin niyeti HUCREYI iptal etmek.
          event.stopPropagation();
          onCancel();
          return;
        }
        if (event.key === "Tab") {
          // `preventDefault` YOK: odak dogal olarak sonraki alana gitsin.
          // `onBlur` zaten onaylayacak.
          commit();
        }
      }}
      className={cn("h-6", hasError && "border-destructive")}
    />
  );
}
