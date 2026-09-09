import type { RowData } from "@tanstack/react-table";
import { AlertCircleIcon, Loader2Icon, SaveIcon, UndoIcon } from "lucide-react";

import type { GridEditing } from "../core/use-grid-editing";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";

/**
 * TOPLU DUZENLEME CUBUGU -- yalnizca `mode: "batch"` icin.
 *
 * ---
 * KAYDEDILMEMIS DEGISIKLIK HER ZAMAN GORUNUR OLMALI.
 *
 * Toplu kipte degisiklikler yalnizca tarayicida duruyor. Sayfayi yenileyen
 * ya da baska bir sayfaya gecen kullanici hepsini kaybediyor. Kalici ve
 * SAYIYLA konusan bir cubuk ("3 satırda değişiklik") o kaybi ongorulebilir
 * kiliyor.
 *
 * Cubuk DEGISIKLIK YOKKEN cizilmiyor: bos bir arac cubugu dikey alan yiyor
 * ve "burada bir sey var" diye bakmaya zorluyor.
 *
 * ---
 * HATA VARSA KAYDETME KAPALI.
 *
 * Gecersiz satirlari atlayip digerlerini kaydetmek daha "yardimsever"
 * gorunur ama kullanici hangilerinin gectigini bilmez. Ya hepsi ya hicbiri;
 * hangi hucrelerin hatali oldugu zaten satirlarda isaretli.
 */
export function GridEditBar<TData extends RowData>({
  editing,
  className,
}: {
  editing: GridEditing<TData>;
  className?: string;
}) {
  if (editing.mode !== "batch" || editing.dirtyRowCount === 0) return null;

  const hasErrors = editing.errorCount > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs",
        className,
      )}
    >
      <span className="font-medium text-amber-700 dark:text-amber-400">
        {editing.dirtyRowCount} satırda kaydedilmemiş değişiklik
      </span>

      {hasErrors && (
        <span className="flex items-center gap-1 text-destructive">
          <AlertCircleIcon className="size-3.5" />
          {editing.errorCount} hata
        </span>
      )}

      <div className="ms-auto flex items-center gap-2">
        <GridButton
          variant="ghost"
          onClick={editing.discardAll}
          disabled={editing.isSaving}
        >
          <UndoIcon className="size-3.5" />
          Vazgeç
        </GridButton>

        <GridButton
          variant="outline"
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          onClick={() => void editing.saveAll()}
          disabled={editing.isSaving || hasErrors}
          title={hasErrors ? "Önce hataları düzeltin" : undefined}
        >
          {editing.isSaving ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SaveIcon className="size-3.5" />
          )}
          Kaydet
        </GridButton>
      </div>
    </div>
  );
}
