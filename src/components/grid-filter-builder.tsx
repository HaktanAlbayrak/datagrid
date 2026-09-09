import { FilterIcon, PlusIcon, XIcon } from "lucide-react";

import {
  addToGroup,
  type ConditionOperator,
  countActiveConditions,
  createCondition,
  createGroup,
  defaultValueFor,
  type FilterCondition,
  type FilterField,
  type FilterGroup,
  type FilterNode,
  isConditionComplete,
  OPERATOR_LABEL,
  OPERATORS_BY_TYPE,
  removeNode,
  updateNode,
  VALUELESS_OPERATORS,
} from "../core/filter-tree";
import { cn } from "../lib/cn";
import { GridButton } from "../primitives/button";
import { GridInput } from "../primitives/input";
import {
  GridPopover,
  GridPopoverContent,
  GridPopoverTrigger,
} from "../primitives/popover";
import { GridSelect } from "../primitives/select";

/**
 * FILTRE KURUCU: "VE / VEYA" ile ic ice kosullar (Faz 2b).
 *
 * ---
 * NEDEN AYRI BIR ARAC? FILTRE SATIRI ZATEN VAR.
 *
 * Filtre satiri gunluk isin %90'ini goruyor ve HIZLI: kolonun altina yaz,
 * bitti. Ama aralarindaki baglac her zaman "VE" ve parantez yok. "durum =
 * Aktif VE (oncelik = Yuksek VEYA tahmin > 8)" oraya SIGMIYOR.
 *
 * Ikisini birbirinin yerine koymak yanlis olurdu: kurucu her basit filtre
 * icin uc tiklama demek, filtre satiri ise bilesik sorulari hic soramiyor.
 * DevExtreme de ikisini birlikte tutuyor ve sonuclari VE'liyor.
 *
 * ---
 * OZYINELI CIZIM, DUZ LISTE DEGIL.
 *
 * Grup bir agac; arayuz de agac. Duzlestirip girinti degeri tasimak
 * (`depth: 2`) mumkundu ama grup ekleme/silme islemlerinde indeks
 * aritmetigi gerektirirdi ve o aritmetigin yanlis oldugu her durum,
 * kullanicinin yanlis grubun icine kosul eklemesi olarak gorunurdu.
 */
export function GridFilterBuilder({
  fields,
  tree,
  onChange,
}: {
  fields: FilterField[];
  tree: FilterGroup;
  onChange: (next: FilterGroup) => void;
}) {
  return (
    <div className="min-w-[34rem] space-y-2">
      <GroupEditor
        fields={fields}
        group={tree}
        isRoot
        onChange={onChange}
        root={tree}
      />
    </div>
  );
}

function GroupEditor({
  fields,
  group,
  isRoot,
  root,
  onChange,
}: {
  fields: FilterField[];
  group: FilterGroup;
  isRoot: boolean;
  root: FilterGroup;
  onChange: (next: FilterGroup) => void;
}) {
  const setCombinator = (combinator: "and" | "or") =>
    onChange(
      updateNode(
        root,
        group.id,
        (node) => ({ ...node, combinator }) as FilterNode,
      ),
    );

  const addCondition = () => {
    const field = fields[0];
    if (field === undefined) return;
    onChange(addToGroup(root, group.id, createCondition(field)));
  };

  return (
    <div
      className={cn(
        "space-y-1.5 rounded-md",
        // Kok grubun cercevesi YOK: tek bir grup varken kutu icinde kutu
        // gormek, olmayan bir hiyerarsi varmis izlenimi verirdi.
        !isRoot && "border border-dashed p-2",
      )}
    >
      <div className="flex items-center gap-1.5">
        {/*
          BAGLAC BIR ANAHTAR, ACILIR LISTE DEGIL.

          Yalnizca iki secenek var ve hangisinin acik oldugu BIR BAKISTA
          gorunmeli: kullanici sonucu okurken "bunlar VE mi VEYA mi?" diye
          listeyi acmak zorunda kalmamali. Bu, kurucunun en cok
          yanlis okunan parcasi.
        */}
        {/*
          `<fieldset>` -- `role="group"` yazilmis bir `<div>` DEGIL.

          Ikisi de erisilebilirlik agacinda ayni role donusuyor ama biri
          YERLESIK. Rolu elle yazmak, tarayicinin zaten verdigi bir anlami
          taklit etmek demek; anlamli elemani kullanmak hem daha kisa hem
          `<legend>`, form sifirlama gibi davranislari bedava getiriyor.
          (Linter de hakli olarak bunu istiyor.)

          `m-0 p-0 border-input`: `<fieldset>`in yerlesik kenarligi ve
          bosluklari var; segment anahtarinin gorunumu icin sifirlaniyor.
        */}
        <fieldset
          className="m-0 inline-flex overflow-hidden rounded-md border border-input p-0"
          aria-label="Bağlaç"
        >
          {(["and", "or"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCombinator(value)}
              aria-pressed={group.combinator === value}
              className={cn(
                "px-2 py-0.5 font-medium text-xs transition-colors",
                group.combinator === value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {value === "and" ? "VE" : "VEYA"}
            </button>
          ))}
        </fieldset>

        <GridButton onClick={addCondition}>
          <PlusIcon className="size-3" />
          Koşul
        </GridButton>
        <GridButton
          onClick={() =>
            onChange(addToGroup(root, group.id, createGroup("or")))
          }
        >
          <PlusIcon className="size-3" />
          Grup
        </GridButton>

        {!isRoot && (
          <GridButton
            size="icon"
            onClick={() => onChange(removeNode(root, group.id))}
            aria-label="Grubu kaldır"
            className="ms-auto"
          >
            <XIcon className="size-3.5" />
          </GridButton>
        )}
      </div>

      {group.children.length === 0 ? (
        <p className="px-1 text-muted-foreground text-xs">
          {/*
            BOS DURUM ACIKCA YAZIYOR.

            Bos bir grup hicbir sey suzmuyor (normalizasyon onu dusuruyor).
            Bunu yazmasaydik kullanici "grup ekledim ama bir sey degismedi"
            der ve sebebini aramaya baslardi.
          */}
          Henüz koşul yok — bu grup sonucu etkilemiyor.
        </p>
      ) : (
        group.children.map((child) => (
          <div key={child.id}>
            {child.kind === "group" ? (
              <GroupEditor
                fields={fields}
                group={child}
                isRoot={false}
                root={root}
                onChange={onChange}
              />
            ) : (
              <ConditionEditor
                fields={fields}
                condition={child}
                root={root}
                onChange={onChange}
              />
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ConditionEditor({
  fields,
  condition,
  root,
  onChange,
}: {
  fields: FilterField[];
  condition: FilterCondition;
  root: FilterGroup;
  onChange: (next: FilterGroup) => void;
}) {
  const field = fields.find((entry) => entry.name === condition.field);
  const type = field?.type ?? "text";
  const operators = OPERATORS_BY_TYPE[type];

  const patch = (changes: Partial<FilterCondition>) =>
    onChange(
      updateNode(
        root,
        condition.id,
        (node) =>
          ({
            ...node,
            ...changes,
          }) as FilterNode,
      ),
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/40 p-1.5">
      <GridSelect
        aria-label="Alan"
        value={condition.field}
        onChange={(event) => {
          const next = fields.find(
            (entry) => entry.name === event.target.value,
          );
          if (next === undefined) return;
          /*
            ALAN DEGISINCE ISLEC VE DEGER DE SIFIRLANIYOR.

            "etiketler herhangi birini içerir [acil]" kosulunda alani
            "tahmin"e cevirseydik islec ("herhangi birini içerir") o tipte
            YOK ve deger bir dizi. Eski degeri korumak, ekranda gecerli ama
            calisirken anlamsiz bir kosul birakirdi.
          */
          const operator = (OPERATORS_BY_TYPE[next.type][0] ??
            "eq") as ConditionOperator;
          patch({
            field: next.name,
            operator,
            value: defaultValueFor(next.type, operator),
          });
        }}
      >
        {fields.map((entry) => (
          <option key={entry.name} value={entry.name}>
            {entry.label}
          </option>
        ))}
      </GridSelect>

      <GridSelect
        aria-label="İşleç"
        value={condition.operator}
        onChange={(event) => {
          const operator = event.target.value as ConditionOperator;
          // Islec degisince degerin SEKLI degisebiliyor ("arasında" iki uc
          // istiyor, "boş" hicbir sey).
          patch({ operator, value: defaultValueFor(type, operator) });
        }}
      >
        {operators.map((operator) => (
          <option key={operator} value={operator}>
            {OPERATOR_LABEL[operator] ?? operator}
          </option>
        ))}
      </GridSelect>

      <ValueEditor
        field={field}
        condition={condition}
        onValueChange={(value) => patch({ value })}
      />

      <GridButton
        size="icon"
        onClick={() => onChange(removeNode(root, condition.id))}
        aria-label="Koşulu kaldır"
        className="ms-auto"
      >
        <XIcon className="size-3.5" />
      </GridButton>
    </div>
  );
}

function ValueEditor({
  field,
  condition,
  onValueChange,
}: {
  field: FilterField | undefined;
  condition: FilterCondition;
  onValueChange: (value: unknown) => void;
}) {
  const { operator, value } = condition;
  const type = field?.type ?? "text";

  // "boş" / "dolu" bir degerle karsilastirmiyor; kutu cizilseydi kullanici
  // doldurur ve doldurmasinin hicbir etkisi olmazdi.
  if (VALUELESS_OPERATORS.has(operator)) return null;

  if (operator === "between") {
    const [min, max] = (value as [unknown, unknown]) ?? ["", ""];
    const inputType = type === "date" ? "date" : "number";
    return (
      <div className="flex items-center gap-1">
        <GridInput
          type={inputType}
          aria-label="Alt sınır"
          value={String(min ?? "")}
          onChange={(event) => onValueChange([event.target.value, max])}
          className="w-28"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <GridInput
          type={inputType}
          aria-label="Üst sınır"
          value={String(max ?? "")}
          onChange={(event) => onValueChange([min, event.target.value])}
          className="w-28"
        />
      </div>
    );
  }

  if (type === "enum" || type === "list") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const options = field?.options ?? [];

    /*
      COKLU SECIM ICIN ROZETLER -- `<select multiple>` DEGIL.

      Yerlesik coklu secim, Ctrl/Cmd basili tutmayi gerektiriyor ve bunu
      bilmeyen kullanici her tiklamada onceki secimini kaybediyor. Ustelik
      dokunmatik cihazlarda pratikte kullanilamaz.

      Rozetler tek tikla acilip kapaniyor ve secili olan BIR BAKISTA
      gorunuyor -- bir filtrede en cok ihtiyac duyulan sey bu.
    */
    return (
      <div className="flex flex-wrap items-center gap-1">
        {options.map((option) => {
          const isOn = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isOn}
              onClick={() =>
                onValueChange(
                  isOn
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value],
                )
              }
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-xs transition-colors",
                isOn
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input hover:bg-accent",
              )}
            >
              {option.label ?? option.value}
            </button>
          );
        })}
        {options.length === 0 && (
          <GridInput
            aria-label="Değer"
            value={selected.join(", ")}
            onChange={(event) =>
              onValueChange(
                event.target.value
                  .split(",")
                  .map((part) => part.trim())
                  .filter((part) => part !== ""),
              )
            }
            placeholder="virgülle ayırın"
            className="w-44"
          />
        )}
      </div>
    );
  }

  return (
    <GridInput
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      aria-label="Değer"
      value={String(value ?? "")}
      onChange={(event) => onValueChange(event.target.value)}
      className="w-44"
    />
  );
}

/**
 * ARAC CUBUGU GIRISI: rozetli dugme + baloncuk.
 *
 * ---
 * NEDEN BALONCUK (popover), SAYFADA SABIT BIR PANEL DEGIL?
 *
 * Kurucu genis: uc secim, deger kutulari, ic ice gruplar. Surekli acik
 * dursaydi izgaranin dikey alanindan kalici olarak yer yerdi -- oysa
 * kullanicilarin cogu onu hic acmiyor (filtre satiri yetiyor).
 *
 * Bedeli: baloncuk kapaninca kurulan ifade GORUNMUYOR. Bu yuzden dugme
 * ETKIN KOSUL SAYISINI tasiyor; olmasaydi kullanici "veri neden eksik?"
 * diye sorar ve cevabi hicbir yerde yazmazdi -- filtre satirindaki rozetle
 * ayni gerekce.
 */
export function GridFilterBuilderButton({
  fields,
  tree,
  onChange,
  onClear,
}: {
  fields: FilterField[];
  tree: FilterGroup;
  onChange: (next: FilterGroup) => void;
  onClear?: () => void;
}) {
  const active = countActiveConditions(tree);

  return (
    <GridPopover>
      <GridPopoverTrigger
        render={<GridButton variant={active > 0 ? "outline" : "ghost"} />}
        title="Gelişmiş filtre (VE / VEYA)"
      >
        <FilterIcon className="size-3.5" />
        Gelişmiş
        {active > 0 && (
          <span className="rounded bg-primary px-1 font-medium text-[10px] text-primary-foreground tabular-nums">
            {active}
          </span>
        )}
      </GridPopoverTrigger>

      <GridPopoverContent className="p-3">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="font-medium text-xs">Gelişmiş filtre</p>
          {active > 0 && onClear !== undefined && (
            <GridButton onClick={onClear}>Temizle</GridButton>
          )}
        </div>

        <GridFilterBuilder fields={fields} tree={tree} onChange={onChange} />

        {/*
          SONUC CUMLE OLARAK DA YAZILIYOR.

          Ic ice kutulardan olusan bir arayuzde "ne sordugumu" okumak zor;
          ozellikle parantezler. Tek satirlik ozet, kullanicinin kurdugu
          seyi DOGRULAMASININ en hizli yolu -- ve yanlis kurdugunda fark
          etmesinin tek yolu.
        */}
        <p className="mt-2 border-t pt-2 text-muted-foreground text-xs">
          {active === 0 ? "Koşul yok" : describeFilterTree(tree, fields)}
        </p>
      </GridPopoverContent>
    </GridPopover>
  );
}

/** Agaci okunabilir bir cumleye cevirir. */
export function describeFilterTree(
  node: FilterNode,
  fields: FilterField[],
): string {
  if (node.kind === "condition") {
    const field = fields.find((entry) => entry.name === node.field);
    const label = field?.label ?? node.field;
    const operator = OPERATOR_LABEL[node.operator] ?? node.operator;

    if (VALUELESS_OPERATORS.has(node.operator)) return `${label} ${operator}`;

    /*
      DEGERLER DE ETIKETE CEVRILIYOR -- ham enum DEGIL.

      OLCULEN HATA: tarayicida ozet cumlesi "Tip şunlardan biri task"
      yaziyordu; kullanicinin rozetlerde ve hucrelerde gordugu ad ise
      "Görev". Ozetin varlik sebebi kullanicinin kurdugu ifadeyi
      DOGRULAMASI; okudugu ad ekranda hicbir yerde gecmiyorsa dogrulama
      isini yapmiyor demektir.

      Esleme icin yeni bir alan eklemedik: `field.options` zaten deger ->
      etiket eslemesini tasiyor (rozetler onu kullaniyor). Grup basliklari
      da ayni kaynaktan besleniyor.
    */
    const describeValue = (part: unknown) => {
      const option = field?.options?.find((entry) => entry.value === part);
      return option === undefined
        ? String(part)
        : (option.label ?? option.value);
    };

    const value = Array.isArray(node.value)
      ? node.value
          .filter((part) => part !== "")
          .map(describeValue)
          .join(" – ")
      : describeValue(node.value ?? "");
    return `${label} ${operator} ${value}`;
  }

  const parts = node.children
    .filter((child) =>
      child.kind === "condition"
        ? isConditionComplete(child)
        : countActiveConditions(child) > 0,
    )
    .map((child) => describeFilterTree(child, fields));

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0] as string;

  const joined = parts.join(node.combinator === "and" ? " VE " : " VEYA ");
  // Parantez YALNIZCA ic gruplarda: kok ifadeyi parantezlemek gurultu.
  return joined;
}
