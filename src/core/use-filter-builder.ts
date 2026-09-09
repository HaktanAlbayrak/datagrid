import { useCallback, useMemo, useState } from "react";

import {
  countActiveConditions,
  createGroup,
  type FilterGroup,
  filterRowsByTree,
  serializeFilterTree,
} from "./filter-tree";

/**
 * FILTRE KURUCUSUNUN DURUMU.
 *
 * Ince bir sarmalayici ama iki isi var ve ikisi de cagiran tarafta sik
 * yapilan bir hatayi kapatiyor:
 *
 * 1. SERILESTIRMEYI `useMemo` ILE tutuyor. Sunucu kipinde bu deger sorgu
 *    anahtarinin parcasi; her render'da yeniden uretilseydi `useServerGrid`
 *    her render'da yeni bir istek atardi -- sonsuz dongu.
 *
 * 2. `applyTo` ile istemci suzmesini AYNI agactan turetiyor. Iki tarafin
 *    ayri kod yollari olsaydi, istemci ve sunucu ayni filtre icin farkli
 *    sonuc verebilirdi ve hangisinin dogru oldugunu anlamak imkansiza
 *    yakin olurdu.
 */
export function useFilterBuilder(initial?: FilterGroup) {
  const [tree, setTree] = useState<FilterGroup>(
    // Baslatici FONKSIYON: `createGroup()` her render'da yeni bir nesne
    // uretirdi ve durum sifirlanmasa bile gereksiz is yapilirdi.
    () => initial ?? createGroup("and"),
  );

  const clear = useCallback(() => setTree(createGroup("and")), []);

  const serialized = useMemo(() => serializeFilterTree(tree), [tree]);
  const activeCount = useMemo(() => countActiveConditions(tree), [tree]);

  /** ISTEMCI kipi: satirlari agaca gore suzer. */
  const applyTo = useCallback(
    <TData>(
      rows: TData[],
      getValue: (row: TData, field: string) => unknown,
    ): TData[] => filterRowsByTree(rows, tree, getValue),
    [tree],
  );

  return { tree, setTree, clear, serialized, activeCount, applyTo };
}
