/**
 * FILTRE AGACI: "VE / VEYA" ile ic ice kosullar (Faz 2b).
 *
 * ---
 * NEDEN AYRI BIR MODEL? `columnFilters` ZATEN VAR.
 *
 * TanStack'in `columnFilters` durumu tasarimi geregi DUZ bir liste ve
 * aralarindaki baglac HER ZAMAN "VE": `[{durum}, {oncelik}]` demek "durum X
 * VE oncelik Y". Bu, gunluk kullanimin %90'ini karsiliyor ve filtre satiri
 * tam da bunun icin var.
 *
 * Ama "durum = Aktif VE (oncelik = Yuksek VEYA tahmin > 8)" o modele
 * SIGMIYOR. Parantezi ve VEYA'yi duz listeye gommenin yolu yok.
 *
 * Zorlamayi denemek iki seyi birden bozardi: `columnFilters`in sekli
 * hakkinda yalan soylemis olurduk (filtre satiri ve yuzeyleme o sekle
 * guveniyor) ve durum artik "kolon basina bir filtre" olmaktan cikardi.
 *
 * Bu yuzden agac AYRI bir durum dilimi ve sonuc `columnFilters` ile VE'lenir
 * -- DevExtreme'de de filtre satiri ile filtre kurucu birlikte calisiyor.
 *
 * ---
 * NEDEN TABLONUN ICINE DEGIL, VERININ ONUNE?
 *
 * Istemci kipinde agac satirlari tabloya GIRMEDEN once suzuyor
 * (`filterRowsByTree`). Tablonun icine bir "sanal kolon filtresi" olarak
 * sokmak mumkundu ama o zaman kolon filtresi olmayan bir sey kolon filtresi
 * gibi gorunurdu: temizle dugmesi onu da silerdi, filtre sayaci yanlis
 * sayardi, yuzeyleme listesi anlamsizlasirdi.
 *
 * Sunucu kipinde ise agac serilestirilip sorguya ekleniyor; suzme zaten
 * veritabaninda oluyor.
 */

/** Bir alanin filtrelenme bicimi -- hangi islecler mumkun, bunu belirliyor. */
export type FilterFieldType = "text" | "number" | "date" | "enum" | "list";

export type ConditionOperator =
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after"
  | "between"
  | "in"
  | "notIn"
  | "hasAny"
  | "hasAll"
  | "isEmpty"
  | "isNotEmpty";

export interface FilterCondition {
  kind: "condition";
  /** Yalnizca ARAYUZ icin: React anahtari ve odak takibi. Tele gitmiyor. */
  id: string;
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface FilterGroup {
  kind: "group";
  id: string;
  combinator: "and" | "or";
  children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

/** Kurucuya gorunen alanlar. */
export interface FilterField {
  name: string;
  label: string;
  type: FilterFieldType;
  /** `enum` alanlar icin secenekler. */
  options?: Array<{ value: string; label?: string }>;
}

/**
 * TIPE GORE IZINLI ISLECLER.
 *
 * Liste bilincli olarak DAR. Her tipe her isleci acmak (ornegin metne
 * "buyuktur") teknik olarak mumkun ama kullaniciya anlamsiz secenekler
 * gostermek, dogru olani bulmayi zorlastiriyor -- ve "ad > 5" gibi bir
 * kosul, sonucu aciklanamaz kilar.
 */
export const OPERATORS_BY_TYPE: Record<
  FilterFieldType,
  readonly ConditionOperator[]
> = {
  text: [
    "contains",
    "notContains",
    "startsWith",
    "endsWith",
    "eq",
    "ne",
    "isEmpty",
    "isNotEmpty",
  ],
  number: [
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
    "isEmpty",
    "isNotEmpty",
  ],
  /*
    TARIHTE "kucuktur" DEGIL "once".

    Ayni isi yapiyorlar ama kullanicinin okudugu sey farkli: "son tarih
    küçüktür 15 Mart" cumlesi bir tarihte anlamsiz duruyor ve okuyani
    duraklatiyor. Ayri islec adlari, sunucuda `lt`/`gt`ye cevriliyor.
  */
  date: ["eq", "before", "after", "between", "isEmpty", "isNotEmpty"],
  enum: ["in", "notIn", "eq", "ne"],
  list: ["hasAny", "hasAll", "isEmpty", "isNotEmpty"],
};

export const OPERATOR_LABEL: Record<string, string> = {
  contains: "içerir",
  notContains: "içermez",
  startsWith: "ile başlar",
  endsWith: "ile biter",
  eq: "eşittir",
  ne: "eşit değildir",
  gt: "büyüktür",
  gte: "büyük veya eşit",
  lt: "küçüktür",
  lte: "küçük veya eşit",
  before: "önce",
  after: "sonra",
  between: "arasında",
  in: "şunlardan biri",
  notIn: "şunlardan biri değil",
  hasAny: "herhangi birini içerir",
  hasAll: "hepsini içerir",
  isEmpty: "boş",
  isNotEmpty: "dolu",
};

/**
 * DEGER ISTEMEYEN ISLECLER.
 *
 * "boş" / "dolu" bir degerle karsilastirmiyor, VARLIGA bakiyor. Arayuz bu
 * ikisinde deger kutusunu hic cizmiyor; cizseydi kullanici doldurmaya
 * calisir ve doldurmasinin hicbir etkisi olmazdi.
 */
export const VALUELESS_OPERATORS = new Set<ConditionOperator>([
  "isEmpty",
  "isNotEmpty",
]);

/** Kimlik uretici -- yalnizca arayuz icin, kalici degil. */
let counter = 0;
const nextId = () => {
  counter += 1;
  return `f${counter}`;
};

export function createCondition(field: FilterField): FilterCondition {
  const operator = (OPERATORS_BY_TYPE[field.type][0] ??
    "eq") as ConditionOperator;
  return {
    kind: "condition",
    id: nextId(),
    field: field.name,
    operator,
    value: defaultValueFor(field.type, operator),
  };
}

export function createGroup(combinator: "and" | "or" = "and"): FilterGroup {
  return { kind: "group", id: nextId(), combinator, children: [] };
}

/** Islec degistiginde degerin SEKLI de degisiyor olabilir. */
export function defaultValueFor(
  type: FilterFieldType,
  operator: ConditionOperator,
): unknown {
  if (VALUELESS_OPERATORS.has(operator)) return null;
  if (operator === "between") return ["", ""];
  if (operator === "in" || operator === "notIn") return [];
  if (operator === "hasAny" || operator === "hasAll") return [];
  if (type === "number") return "";
  return "";
}

/**
 * Bir kosul TAMAMLANMIS mi?
 *
 * ---
 * YARIM KOSUL "HICBIR SEY ESLESMIYOR" DEMEK DEGIL.
 *
 * Kullanici "Kosul ekle"ye basiyor ve daha deger yazmadan izgara BOSALIYOR.
 * Gordugu sey "filtre calismiyor" ya da "verim gitti"; oysa yalnizca henuz
 * yazmamis. Tamamlanmamis kosullar degerlendirmede YOK SAYILIYOR -- kullanici
 * yazmaya basladiginda etkisini gormeye basliyor.
 *
 * Bu, "sessiz basarisizlik" kuralinin istisnasi degil: burada sessizce
 * yanlis bir sonuc URETILMIYOR, henuz sorulmamis bir soru sorulmuyor.
 */
export function isConditionComplete(condition: FilterCondition): boolean {
  if (VALUELESS_OPERATORS.has(condition.operator)) return true;

  const value = condition.value;
  if (condition.operator === "between") {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      // Tek uc yeter: "100 ve uzeri" gecerli bir aralik.
      value.some((part) => part !== "" && part !== null && part !== undefined)
    );
  }
  if (Array.isArray(value)) return value.length > 0;
  return value !== "" && value !== null && value !== undefined;
}

/**
 * Agaci TEMIZLER: yarim kosullar ve bosalan gruplar dusuyor.
 *
 * Bos bir grup ozellikle tehlikeli: "VEYA" ile birlesen bos bir grup, hicbir
 * cocugu olmadigi icin "hicbir sey eslesmiyor" anlamina gelir ve tum sonucu
 * siler. Kullanici "bir grup ekledim, her sey kayboldu" der.
 */
export function normalizeFilterTree(node: FilterNode): FilterNode | null {
  if (node.kind === "condition") {
    return isConditionComplete(node) ? node : null;
  }

  const children = node.children
    .map(normalizeFilterTree)
    .filter((child): child is FilterNode => child !== null);

  return children.length === 0 ? null : { ...node, children };
}

export function countConditions(node: FilterNode): number {
  if (node.kind === "condition") return 1;
  return node.children.reduce(
    (total, child) => total + countConditions(child),
    0,
  );
}

/** Agacta TAMAMLANMIS kac kosul var? Rozet bu sayiyi gosteriyor. */
export function countActiveConditions(node: FilterNode): number {
  const normalized = normalizeFilterTree(node);
  return normalized === null ? 0 : countConditions(normalized);
}

/** Agacta bir dugumu kimligine gore degistirir (degismez / immutable). */
export function updateNode(
  root: FilterGroup,
  id: string,
  update: (node: FilterNode) => FilterNode,
): FilterGroup {
  const walk = (node: FilterNode): FilterNode => {
    if (node.id === id) return update(node);
    if (node.kind === "group") {
      return { ...node, children: node.children.map(walk) };
    }
    return node;
  };
  return walk(root) as FilterGroup;
}

/** Agactan bir dugumu siler. Kok silinemiyor. */
export function removeNode(root: FilterGroup, id: string): FilterGroup {
  const walk = (group: FilterGroup): FilterGroup => ({
    ...group,
    children: group.children
      .filter((child) => child.id !== id)
      .map((child) => (child.kind === "group" ? walk(child) : child)),
  });
  return walk(root);
}

/** Bir gruba yeni cocuk ekler. */
export function addToGroup(
  root: FilterGroup,
  groupId: string,
  child: FilterNode,
): FilterGroup {
  return updateNode(root, groupId, (node) =>
    node.kind === "group"
      ? { ...node, children: [...node.children, child] }
      : node,
  ) as FilterGroup;
}

const asText = (value: unknown) =>
  value === null || value === undefined
    ? ""
    : String(value).toLocaleLowerCase("tr");

/** Yalnizca gun tasiyan deger: `<input type="date">` boyle uretiyor. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Bir degeri KARSILASTIRILABILIR bir sayiya cevirir (ya da `null`).
 *
 * ---
 * SIRA ONEMLI: once sayi, sonra tarih.
 *
 * `Date.parse("2026")` gecerli bir tarih donduruyor (yilin basi). Once
 * tarihe baksaydik, metin bir kolondaki "2026" degeri sessizce bir zaman
 * damgasina cevrilir ve "büyüktür" karsilastirmasi anlasilmaz sonuclar
 * verirdi. Sayi kalibi once denenerek bu kapaniyor.
 */
const asNumber = (value: unknown): number | null => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value === "") return null;

  if (NUMERIC.test(value)) return Number(value);

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Gun basi / gun sonu -- tarih karsilastirmalarinin ucu HER ZAMAN dahil. */
const dayStart = (day: string) => new Date(`${day}T00:00:00.000`).getTime();
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999`).getTime();

/**
 * TARIHTE "esittir" = AYNI GUN.
 *
 * Bir tarih alani neredeyse her zaman saat de tasiyor. Zaman damgasini
 * birebir esitlemek istemek kullanicinin aklindan gecen sey degil: "15
 * Mart" yazan biri o gunku kayitlari ariyor, 15 Mart 00:00:00.000'i degil.
 * Birebir esitlik uygulasaydik filtre "hicbir zaman eslesmiyor" gorunurdu.
 *
 * Ayni gerekce sunucu tarafinda da uygulaniyor (bitis tarihi gunun sonuna
 * cekiliyor) -- iki taraf ayni cevabi vermek zorunda.
 */
const withinDay = (rowValue: unknown, day: string): boolean => {
  const current = asNumber(rowValue);
  if (current === null) return false;
  return current >= dayStart(day) && current <= dayEnd(day);
};

/** Tek bir kosulu bir satir degerine uygular. */
export function evaluateCondition(
  rowValue: unknown,
  condition: FilterCondition,
): boolean {
  const { operator, value } = condition;

  const isBlank =
    rowValue === null ||
    rowValue === undefined ||
    rowValue === "" ||
    (Array.isArray(rowValue) && rowValue.length === 0);

  if (operator === "isEmpty") return isBlank;
  if (operator === "isNotEmpty") return !isBlank;

  switch (operator) {
    case "contains":
      return asText(rowValue).includes(asText(value));
    case "notContains":
      return !asText(rowValue).includes(asText(value));
    case "startsWith":
      return asText(rowValue).startsWith(asText(value));
    case "endsWith":
      return asText(rowValue).endsWith(asText(value));
    case "eq":
      return typeof value === "string" && DATE_ONLY.test(value)
        ? withinDay(rowValue, value)
        : compare(rowValue, value) === 0;
    case "ne":
      return typeof value === "string" && DATE_ONLY.test(value)
        ? !withinDay(rowValue, value)
        : compare(rowValue, value) !== 0;
    case "before": {
      const current = asNumber(rowValue);
      if (current === null || typeof value !== "string") return false;
      return current < dayStart(value);
    }
    case "after": {
      const current = asNumber(rowValue);
      if (current === null || typeof value !== "string") return false;
      // Gun SONUNDAN sonra: "15 Mart'tan sonra" 15 Mart'i icermemeli.
      return current > dayEnd(value);
    }
    case "gt":
      return compare(rowValue, value) > 0;
    case "gte":
      return compare(rowValue, value) >= 0;
    case "lt":
      return compare(rowValue, value) < 0;
    case "lte":
      return compare(rowValue, value) <= 0;
    case "between": {
      const [min, max] = (value as [unknown, unknown]) ?? ["", ""];
      const current = asNumber(rowValue);
      if (current === null) return false;
      // Tarih araliginda uclar GUN olarak genisliyor: "1-15 Mart" 15
      // Mart'in tamamini icermeli.
      const low =
        typeof min === "string" && DATE_ONLY.test(min)
          ? dayStart(min)
          : asNumber(min);
      const high =
        typeof max === "string" && DATE_ONLY.test(max)
          ? dayEnd(max)
          : asNumber(max);
      // Acik uc destekleniyor: yalnizca alt sinir yazmak gecerli bir aralik.
      if (low !== null && current < low) return false;
      if (high !== null && current > high) return false;
      return true;
    }
    case "in":
      return (value as unknown[]).some((item) => compare(rowValue, item) === 0);
    case "notIn":
      return !(value as unknown[]).some(
        (item) => compare(rowValue, item) === 0,
      );
    case "hasAny":
      return (
        Array.isArray(rowValue) &&
        (value as unknown[]).some((item) => rowValue.includes(item))
      );
    case "hasAll":
      return (
        Array.isArray(rowValue) &&
        (value as unknown[]).every((item) => rowValue.includes(item))
      );
    default:
      return true;
  }
}

/**
 * Karsilastirma: IKISI DE sayiya cevrilebiliyorsa sayisal, degilse metin.
 *
 * "10" ile "9"u metin olarak karsilastirmak "10 < 9" verir -- sayisal bir
 * kolonda "büyüktür" filtresini SESSIZCE yanlis yapardi. Metin karsilastirmasi
 * yalnizca gercekten metin olan degerlere kaliyor.
 */
function compare(a: unknown, b: unknown): number {
  const left = asNumber(a);
  const right = asNumber(b);
  if (left !== null && right !== null) {
    return left === right ? 0 : left < right ? -1 : 1;
  }

  const textA = asText(a);
  const textB = asText(b);
  return textA === textB ? 0 : textA < textB ? -1 : 1;
}

/** Agaci tek bir satira uygular. */
export function matchesFilterTree(
  node: FilterNode,
  getValue: (field: string) => unknown,
): boolean {
  if (node.kind === "condition") {
    return evaluateCondition(getValue(node.field), node);
  }

  if (node.children.length === 0) return true;

  return node.combinator === "and"
    ? node.children.every((child) => matchesFilterTree(child, getValue))
    : node.children.some((child) => matchesFilterTree(child, getValue));
}

/**
 * ISTEMCI KIPI: satirlari agaca gore suzer.
 *
 * Agac bos ya da tumuyle yarimsa DIZI OLDUGU GIBI donuyor -- yeni bir dizi
 * bile uretmiyoruz. Sebep TanStack: `data` referansi degisirse tum satir ve
 * kolon modelleri yeniden hesaplaniyor. Filtre yokken o bedeli odemek
 * anlamsiz olurdu.
 */
export function filterRowsByTree<TData>(
  rows: TData[],
  tree: FilterNode | null,
  getValue: (row: TData, field: string) => unknown,
): TData[] {
  const normalized = tree === null ? null : normalizeFilterTree(tree);
  if (normalized === null) return rows;

  return rows.filter((row) =>
    matchesFilterTree(normalized, (field) => getValue(row, field)),
  );
}

/**
 * SUNUCUYA GIDECEK BICIM: kimlikler ATILIYOR.
 *
 * `id` yalnizca React anahtari; tele gondermek hem gereksiz bayt hem de
 * sunucuya "bu alan bir anlam tasiyor" izlenimi verir. Ayrica normalize
 * edilmis agac gonderiliyor: yarim kosullar sunucuya hic ulasmiyor.
 */
export function serializeFilterTree(
  tree: FilterNode | null,
): string | undefined {
  const normalized = tree === null ? null : normalizeFilterTree(tree);
  if (normalized === null) return undefined;

  const strip = (node: FilterNode): unknown =>
    node.kind === "condition"
      ? { field: node.field, operator: node.operator, value: node.value }
      : { combinator: node.combinator, children: node.children.map(strip) };

  return JSON.stringify(strip(normalized));
}
