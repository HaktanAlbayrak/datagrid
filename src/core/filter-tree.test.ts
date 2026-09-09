import { describe, expect, test } from "vitest";

import {
  addToGroup,
  countActiveConditions,
  createGroup,
  type FilterCondition,
  type FilterGroup,
  filterRowsByTree,
  isConditionComplete,
  normalizeFilterTree,
  removeNode,
  serializeFilterTree,
} from "./filter-tree";

interface Card {
  title: string;
  estimate: number | null;
  priority: string;
  labels: string[];
  dueDate: string | null;
}

const CARDS: Card[] = [
  {
    title: "Ödeme akışı",
    estimate: 3,
    priority: "high",
    labels: ["backend"],
    dueDate: "2026-03-10T09:00:00.000Z",
  },
  {
    title: "Rapor dışa aktarma",
    estimate: 12,
    priority: "low",
    labels: ["frontend", "acil"],
    dueDate: "2026-03-15T18:30:00.000Z",
  },
  {
    title: "Bildirim servisi",
    estimate: null,
    priority: "high",
    labels: [],
    dueDate: null,
  },
  {
    title: "Arama motoru",
    estimate: 8,
    priority: "urgent",
    labels: ["backend", "acil"],
    dueDate: "2026-04-01T00:00:00.000Z",
  },
];

const getValue = (row: Card, field: string) =>
  (row as unknown as Record<string, unknown>)[field];

let id = 0;
const cond = (
  field: string,
  operator: FilterCondition["operator"],
  value: unknown,
): FilterCondition => {
  id += 1;
  return { kind: "condition", id: `t${id}`, field, operator, value };
};

const group = (
  combinator: "and" | "or",
  ...children: Array<FilterCondition | FilterGroup>
): FilterGroup => {
  id += 1;
  return { kind: "group", id: `g${id}`, combinator, children };
};

const titles = (tree: FilterGroup) =>
  filterRowsByTree(CARDS, tree, getValue).map((card) => card.title);

describe("filtre ağacı", () => {
  test("VE tüm koşulları, VEYA herhangi birini ister", () => {
    expect(
      titles(
        group(
          "and",
          cond("priority", "eq", "high"),
          cond("labels", "hasAny", ["backend"]),
        ),
      ),
    ).toEqual(["Ödeme akışı"]);

    expect(
      titles(
        group(
          "or",
          cond("priority", "eq", "urgent"),
          cond("estimate", "gt", 10),
        ),
      ),
    ).toEqual(["Rapor dışa aktarma", "Arama motoru"]);
  });

  test("iç içe grup PARANTEZ gibi davranır", () => {
    /*
      Bu blogun varlik sebebi: "durum = X VE (a VEYA b)" ifadesi TanStack'in
      `columnFilters` modeline SIGMIYOR -- orada baglac her zaman VE ve
      parantez yok. Ayri bir agac tutmanin tek gerekcesi bu.
    */
    const tree = group(
      "and",
      cond("priority", "eq", "high"),
      group("or", cond("estimate", "lt", 5), cond("estimate", "isEmpty", null)),
    );

    expect(titles(tree)).toEqual(["Ödeme akışı", "Bildirim servisi"]);
  });

  test("YARIM koşul ızgarayı boşaltmaz, YOK SAYILIR", () => {
    /*
      Kullanici "Koşul ekle"ye basiyor ve daha deger yazmadan izgara
      bosalsaydi gordugu sey "verilerim gitti" olurdu. Tamamlanmamis kosul
      degerlendirmeye girmiyor -- yazmaya baslayinca etkisi baslıyor.
    */
    const yarim = cond("title", "contains", "");
    expect(isConditionComplete(yarim)).toBe(false);
    expect(titles(group("and", yarim))).toHaveLength(4);

    // Yazmaya baslayinca suzuyor.
    expect(titles(group("and", cond("title", "contains", "rapor")))).toEqual([
      "Rapor dışa aktarma",
    ]);
  });

  test("BOŞ grup her şeyi silmiyor", () => {
    /*
      Bos bir grubun "hicbir cocugu yok" hali, VEYA altinda "hicbir sey
      eslesmiyor" anlamina gelirdi ve tum sonucu silerdi. Kullanici "bir grup
      ekledim, her sey kayboldu" derdi. Normalizasyon bos gruplari dusuruyor.
    */
    const tree = group(
      "and",
      cond("priority", "eq", "high"),
      group("or"), // yeni eklenmis, henuz bos
    );

    expect(titles(tree)).toEqual(["Ödeme akışı", "Bildirim servisi"]);
    expect(countActiveConditions(tree)).toBe(1);
  });

  test("sayısal karşılaştırma METİN karşılaştırması değil", () => {
    /*
      "10" ile "9"u metin olarak karsilastirmak "10 < 9" verir. Sayisal bir
      kolonda "büyüktür" filtresini SESSIZCE yanlis yapardi -- ve yanlis
      oldugunu fark etmenin yolu, sonuclari elle saymaktan geciyor.
    */
    expect(titles(group("and", cond("estimate", "gt", "9")))).toEqual([
      "Rapor dışa aktarma",
    ]);
    expect(
      titles(group("and", cond("estimate", "between", ["3", "8"]))),
    ).toEqual(["Ödeme akışı", "Arama motoru"]);
    // Acik uc: yalnizca alt sinir.
    expect(
      titles(group("and", cond("estimate", "between", ["8", ""]))),
    ).toEqual(["Rapor dışa aktarma", "Arama motoru"]);
  });

  test("tarihte 'eşittir' AYNI GÜN demek", () => {
    /*
      Kayitlar saat de tasiyor. Zaman damgasini birebir esitlemek istemek
      kullanicinin aklindan gecen sey degil: "15 Mart" yazan biri o gunku
      kayitlari ariyor. Birebir esitlik uygulasaydik filtre "hicbir zaman
      eslesmiyor" gorunurdu.
    */
    expect(titles(group("and", cond("dueDate", "eq", "2026-03-15")))).toEqual([
      "Rapor dışa aktarma",
    ]);

    // "15 Mart'tan sonra" 15 Mart'i ICERMEMELI (gun sonundan sonra).
    expect(
      titles(group("and", cond("dueDate", "after", "2026-03-15"))),
    ).toEqual(["Arama motoru"]);

    // Aralik uclari GUN olarak genisliyor.
    expect(
      titles(
        group("and", cond("dueDate", "between", ["2026-03-10", "2026-03-15"])),
      ),
    ).toEqual(["Ödeme akışı", "Rapor dışa aktarma"]);
  });

  test("boş / dolu VARLIĞA bakar", () => {
    expect(titles(group("and", cond("estimate", "isEmpty", null)))).toEqual([
      "Bildirim servisi",
    ]);
    // Bos DIZI de bos sayiliyor: etiketi olmayan kart "etiketler dolu"
    // filtresine takilmamali.
    expect(titles(group("and", cond("labels", "isNotEmpty", null)))).toEqual([
      "Ödeme akışı",
      "Rapor dışa aktarma",
      "Arama motoru",
    ]);
  });

  test("liste işleçleri: herhangi biri / hepsi", () => {
    expect(
      titles(group("and", cond("labels", "hasAny", ["acil", "backend"]))),
    ).toEqual(["Ödeme akışı", "Rapor dışa aktarma", "Arama motoru"]);

    expect(
      titles(group("and", cond("labels", "hasAll", ["acil", "backend"]))),
    ).toEqual(["Arama motoru"]);
  });

  test("filtre yokken dizi AYNI referans olarak dönüyor", () => {
    /*
      TanStack'te `data` referansi degisirse tum satir ve kolon modelleri
      yeniden hesaplaniyor. Filtre yokken yeni bir dizi uretmek, hicbir sey
      degismemisken tabloyu bastan kurmak demekti.
    */
    expect(filterRowsByTree(CARDS, createGroup("and"), getValue)).toBe(CARDS);
    expect(filterRowsByTree(CARDS, null, getValue)).toBe(CARDS);
  });

  test("serileştirme kimlikleri ATIYOR ve yarım koşulları göndermiyor", () => {
    const tree = group(
      "and",
      cond("priority", "in", ["high"]),
      cond("title", "contains", ""), // yarim
    );

    const wire = serializeFilterTree(tree);
    expect(wire).toBeDefined();
    const parsed = JSON.parse(wire as string);

    // Kimlikler yalnizca React anahtari; tele gitmeleri gereksiz bayt ve
    // sunucuya anlam tasiyorlarmis izlenimi verirdi.
    expect(JSON.stringify(parsed)).not.toContain('"id"');
    expect(parsed.children).toHaveLength(1);
    expect(parsed.children[0].field).toBe("priority");

    // Tamamen yarim bir agac hic gonderilmiyor.
    expect(
      serializeFilterTree(group("and", cond("title", "contains", ""))),
    ).toBe(undefined);
  });

  test("düğüm ekleme/silme kökü bozmuyor", () => {
    const root = createGroup("and");
    const child = cond("title", "contains", "a");
    const withChild = addToGroup(root, root.id, child);

    expect(withChild.children).toHaveLength(1);
    // Degismezlik: kok nesne DEGISMEDI.
    expect(root.children).toHaveLength(0);

    expect(removeNode(withChild, child.id).children).toHaveLength(0);
  });

  test("normalize edilmiş ağaç yeni nesne, orijinali bozmuyor", () => {
    const tree = group("and", cond("title", "contains", "a"));
    const normalized = normalizeFilterTree(tree);
    expect(normalized).not.toBe(tree);
    expect(countActiveConditions(tree)).toBe(1);
  });
});
