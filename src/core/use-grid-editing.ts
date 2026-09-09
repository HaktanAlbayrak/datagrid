import type { RowData } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

/** Bir hucrenin adresi. */
export interface CellAddress {
  rowId: string;
  columnId: string;
}

/** Bekleyen degisiklikler: satir kimligi -> alan -> yeni deger. */
export type PendingChanges = Record<string, Record<string, unknown>>;

/** Hucre basina dogrulama hatasi. */
export type CellErrors = Record<string, Record<string, string>>;

export type EditMode = "cell" | "batch";

export interface UseGridEditingOptions<TData extends RowData> {
  /**
   * Duzenleme kipi.
   *
   * - `"cell"`: her hucre onaylandiginda ANINDA kaydediliyor. Tek bir alani
   *   duzeltmek icin dogru; her degisiklik bir istek.
   * - `"batch"`: degisiklikler birikiyor, kullanici "Kaydet" diyene kadar
   *   sunucuya gitmiyor. Toplu duzenleme icin dogru; ayrica VAZGECILEBILIR.
   *
   * Ikisi ayni bilesende cunku fark yalnizca "ne zaman kaydedilir" --
   * duzenleme arayuzu, dogrulama ve kirli takibi ayni.
   */
  mode?: EditMode;
  /**
   * Degisiklikleri kaydeder.
   *
   * `"cell"` kipinde tek satirlik bir nesneyle, `"batch"` kipinde hepsiyle
   * cagriliyor. Hata firlatirsa degisiklikler DURUYOR -- kullanicinin
   * yazdigi sey kaybolmuyor.
   */
  onSave: (changes: PendingChanges) => void | Promise<void>;
  /**
   * Hucre dogrulama. Hata mesaji donerse kaydetme ENGELLENIYOR.
   *
   * Neden kolon basina degil de tek fonksiyon? Cunku dogrulama cogu zaman
   * ALANLAR ARASI ("bitis tarihi baslangictan sonra olmali") ve kolon
   * basina bir fonksiyon o kurali ifade edemez.
   */
  validate?: (
    address: CellAddress,
    value: unknown,
    row: TData,
  ) => string | undefined;
}

/**
 * HUCRE DUZENLEME DURUMU.
 *
 * ---
 * NEDEN TANSTACK "FEATURE PLUGIN" DEGIL?
 *
 * TanStack'in eklenti sistemi, tablo NESNELERINI (row/column/cell) yeni
 * metotlarla genisletmek icin var ve dogru kullanim yeri gercekten
 * satir-modeli davranisi degistiren seyler (siralama, gruplama).
 *
 * Duzenleme ise saf ARAYUZ durumu: hangi hucre acik, ne yazildi, hangisi
 * hatali. Satir modelini hic etkilemiyor. Eklenti yazmak, on satirlik bir
 * durumu yuzlerce satirlik tip bildirimine gommek ve tuketiciyi
 * `tableFeatures` kumesini degistirmeye zorlamak olurdu.
 *
 * React durumu olarak tutmak hem daha kucuk hem tuketici icin gorunur:
 * `pendingChanges` dogrudan okunabiliyor, "kaydedilmemis degisiklik var mi"
 * sorusu bir `if` ile cevaplaniyor.
 */
export function useGridEditing<TData extends RowData>({
  mode = "cell",
  onSave,
  validate,
}: UseGridEditingOptions<TData>) {
  const [editing, setEditing] = useState<CellAddress | null>(null);
  const [changes, setChanges] = useState<PendingChanges>({});
  const [errors, setErrors] = useState<CellErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = useCallback((address: CellAddress) => {
    setEditing(address);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  /**
   * Bir hucreyi onaylar.
   *
   * `"cell"` kipinde HEMEN kaydediyor; `"batch"` kipinde biriktiriyor.
   * Dogrulama iki kipte de ONCE calisiyor: gecersiz bir degeri biriktirmek,
   * hatayi "Kaydet"e kadar ertelemek olurdu ve kullanici o ana kadar on
   * satir daha degistirmis olurdu.
   */
  const commitCell = useCallback(
    async (address: CellAddress, value: unknown, row: TData) => {
      const message = validate?.(address, value, row);

      if (message !== undefined) {
        setErrors((old) => ({
          ...old,
          [address.rowId]: {
            ...old[address.rowId],
            [address.columnId]: message,
          },
        }));
        // Hatali hucre ACIK KALIYOR: kapatsaydik kullanici hatayi gorur ama
        // duzeltmek icin hucreyi yeniden acmak zorunda kalirdi.
        return false;
      }

      setErrors((old) => {
        const forRow = { ...old[address.rowId] };
        delete forRow[address.columnId];
        if (Object.keys(forRow).length === 0) {
          const next = { ...old };
          delete next[address.rowId];
          return next;
        }
        return { ...old, [address.rowId]: forRow };
      });

      const next: PendingChanges = {
        ...changes,
        [address.rowId]: {
          ...changes[address.rowId],
          [address.columnId]: value,
        },
      };

      setEditing(null);

      if (mode === "batch") {
        setChanges(next);
        return true;
      }

      // "cell" kipi: yalnizca BU satirin degisikligini gonderiyoruz.
      setIsSaving(true);
      try {
        await onSave({
          [address.rowId]: next[address.rowId] as Record<string, unknown>,
        });
        return true;
      } catch {
        /*
          KAYIT BASARISIZSA DEGISIKLIK DURUYOR.

          Temizleseydik kullanicinin yazdigi deger kaybolur ve ekranda ESKI
          deger gorunurdu -- "kaydettim sandim" durumunun tam kaynagi.
          Burada degisiklik bekleyenlere yaziliyor ve satir kirli isaretli
          kaliyor; kullanici yeniden deneyebiliyor.
        */
        setChanges(next);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [changes, mode, onSave, validate],
  );

  /** `"batch"` kipinde biriken tum degisiklikleri kaydeder. */
  const saveAll = useCallback(async () => {
    if (Object.keys(changes).length === 0) return;

    setIsSaving(true);
    try {
      await onSave(changes);
      setChanges({});
      setErrors({});
    } finally {
      setIsSaving(false);
    }
  }, [changes, onSave]);

  const discardAll = useCallback(() => {
    setChanges({});
    setErrors({});
    setEditing(null);
  }, []);

  const dirtyRowCount = Object.keys(changes).length;
  const errorCount = Object.values(errors).reduce(
    (sum, row) => sum + Object.keys(row).length,
    0,
  );

  /**
   * Bir hucrenin GORUNTULENECEK degeri.
   *
   * Bekleyen degisiklik varsa O gosteriliyor, orijinal veri degil. Aksi
   * halde `"batch"` kipinde kullanici bir degeri degistirir, hucre eski
   * degere doner ve degisikligin kaydedilip kaydedilmedigini anlayamaz.
   */
  const getDisplayValue = useCallback(
    (rowId: string, columnId: string, original: unknown) => {
      const pending = changes[rowId];
      if (pending !== undefined && columnId in pending)
        return pending[columnId];
      return original;
    },
    [changes],
  );

  return useMemo(
    () => ({
      mode,
      editing,
      changes,
      errors,
      isSaving,
      dirtyRowCount,
      errorCount,
      startEdit,
      cancelEdit,
      commitCell,
      saveAll,
      discardAll,
      getDisplayValue,
      isEditing: (rowId: string, columnId: string) =>
        editing?.rowId === rowId && editing.columnId === columnId,
      isDirty: (rowId: string, columnId: string) =>
        changes[rowId] !== undefined && columnId in changes[rowId],
      getError: (rowId: string, columnId: string) => errors[rowId]?.[columnId],
    }),
    [
      mode,
      editing,
      changes,
      errors,
      isSaving,
      dirtyRowCount,
      errorCount,
      startEdit,
      cancelEdit,
      commitCell,
      saveAll,
      discardAll,
      getDisplayValue,
    ],
  );
}

export type GridEditing<TData extends RowData> = ReturnType<
  typeof useGridEditing<TData>
>;
