# @tudos/datagrid

DevExtreme sınıfında bir **DataGrid / TreeGrid** — TanStack Table v9 + shadcn/Tailwind
üzerine kurulu, başlıksız (headless) çekirdek + hazır arayüz.

> **Durum: Faz 1–8 tamam (yol haritasındaki her şey).** Çalışan: sıralama (çoklu), ağaç/hiyerarşi, satır
> seçimi (üç durumlu, Shift-aralık), dondurulmuş kolonlar, kolon genişletme
> (fare + klavye, sınırlı), **filtre satırı** (metin / sayı aralığı / tarih
> aralığı / faceted çoklu seçim), **genel arama**, **kolon seçici**, **satır
> işlemleri menüsü**, **gruplama + özetler**, **klavye navigasyonu
> (`role="grid"`)**, **düzen kalıcılığı**, sayfalama, yapışkan başlık,
> **gelişmiş filtre (VE/VEYA)**, **tembel ağaç**, boş/yükleniyor durumları.
> 107 test. Yol haritası aşağıda.

---

## Neden TanStack Table v9?

DevExtreme DataGrid'in özellik listesini TanStack v9'un **hazır** verdikleriyle
karşılaştırdım:

| DevExtreme özelliği | TanStack v9 | Durum |
|---|---|---|
| Sıralama (çoklu) | `rowSortingFeature` | ✅ Faz 1 |
| Ağaç / TreeList | `rowExpandingFeature` + `getSubRows` | ✅ Faz 1 |
| Tembel çocuk yükleme | — | ✅ Faz 3 |
| Master-detail | aynı özellik + özel panel | ✅ altyapı hazır |
| Dondurulmuş kolon (`fixed`) | `columnPinningFeature` | ✅ Faz 1 |
| Kolon genişletme | `columnResizingFeature` | ✅ Faz 1 |
| Kolon gizleme / sıralama | `columnVisibility` / `columnOrdering` | ✅ altyapı hazır |
| Satır seçimi (üç durumlu) | `rowSelectionFeature` | ✅ Faz 1 |
| Filtre satırı | `columnFilteringFeature` | ✅ Faz 2 |
| Filtre kurucu (VE/VEYA, iç içe) | — | ✅ Faz 2b |
| Başlık filtresi (var olan değerler) | `columnFacetingFeature` | ✅ Faz 2 |
| Arama paneli | `globalFilteringFeature` | ✅ Faz 2 |
| Kolon seçici | `columnVisibilityFeature` | ✅ Faz 2 |
| Satır işlemleri (menü) | — | ✅ Faz 2 |
| Gruplama + özetler | `columnGrouping` + `rowAggregation` | ✅ Faz 4 |
| Sayfalama | `rowPaginationFeature` | ✅ Faz 1 |
| Sanal kaydırma | ❌ yok | ✅ Faz 5 |
| Düzenleme (hücre/toplu) | ❌ yok | ✅ Faz 6 |
| Kolon genişliği sınırları | ❌ yok | ✅ Faz 2 |
| Durum kalıcılığı (`state storing`) | ❌ yok | ✅ Faz 8 |
| Klavye navigasyonu (hücreler arası) | ❌ yok | ✅ Faz 7 |
| Excel (.xlsx) dışa/içe aktarma | ❌ yok | ✅ (bağımlılıksız) |
| CSV dışa aktarma (kapsam seçmeli) | ❌ yok | ✅ |
| CSV içe aktarma (eşleme + önizleme) | ❌ yok | ✅ |
| Sunucu taraflı sayfalama/filtre/sıralama | `manual*` bayrakları | ✅ |

**Sonuç: başka bir kütüphaneye gerek yok.** Eksikler arayüz ve etkileşim
katmanında; ikisi de bu paketin zaten yazdığı şey. DevExtreme'in ticari lisansı
ve ~500 KB'lık paketi yerine, kendi temanızı kullanan ve yalnızca kullandığınız
kadarını taşıyan bir izgara çıkıyor.

---

## Kurulum

```bash
npm install @tudos/datagrid
```

Eş bağımlılıklar (peer): `react`, `react-dom`, `@tanstack/react-table`,
`@base-ui/react`.

### Tailwind ayarı — ZORUNLU tek satır

Tailwind v4 sınıfları **kaynak tarayarak** bulur ve `node_modules`a varsayılan
olarak bakmaz. Kendi `globals.css` dosyanıza ekleyin:

```css
@source "../../node_modules/@tudos/datagrid/dist";
```

Bu satır olmadan izgara **stilsiz** görünür: HTML doğru, CSS yok.

> Bu bildirimi paketin içinden göndermeyi denedim (`@source "../dist"` taşıyan
> bir `styles.css`); **Turbopack reddetti** — paket yolu proje kökünün dışına
> çıkıyor ("leaves the filesystem root"). Yolu tüketicinin kendi CSS'inde
> tanımlamak hem çalışıyor hem de Tailwind'in üçüncü parti paketler için
> belgelediği yol.

### Tema

Paket **kendi renklerini taşımaz**; shadcn'in CSS değişkenlerini okur:
`--background`, `--foreground`, `--muted`, `--border`, `--primary`, `--ring`,
`--accent`, `--input`, `--popover`. shadcn kurulu bir projede hepsi zaten var.

---

## Kullanım

```tsx
"use client";

import {
  createGridColumnHelper,
  createSelectionColumn,
  DataGrid,
  GridPagination,
  TreeCell,
  useGridTable,
} from "@tudos/datagrid";

interface Row {
  id: string;
  name: string;
  amount: number;
  children?: Row[];
}

const helper = createGridColumnHelper<Row>();

// DİKKAT: modül seviyesinde, bileşenin İÇİNDE değil.
const columns = helper.columns([
  createSelectionColumn<Row>(),
  helper.accessor("name", {
    header: "Ad",
    cell: (context) => <TreeCell context={context} />, // ağaç hücresi
  }),
  helper.accessor("amount", { header: "Tutar" }),
]);

export function MyGrid({ data }: { data: Row[] }) {
  const table = useGridTable<Row>({
    data,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children, // VERİLİRSE ağaç, verilmezse düz ızgara
    initialState: {
      columnPinning: { start: ["__select__", "name"], end: [] },
    },
  });

  return (
    <>
      <DataGrid table={table} height={480} />
      <GridPagination table={table} />
    </>
  );
}
```

### Filtreler

`meta.filter` **hem denetimi hem filtre mantığını** seçiyor — ikisini ayrı ayrı
yazdırmak sessiz bir hata kaynağıydı (`meta` yazıp `filterFn`i unutan biri
kutuları doldurur ve hiçbir şey olmaz):

```tsx
helper.accessor("ad",       { meta: { filter: "text" } })    // içerir araması
helper.accessor("tutar",    { meta: { filter: "number", align: "end" } }) // min–max
helper.accessor("tarih",    { meta: { filter: "date" } })    // tarih aralığı
helper.accessor("durum",    { meta: { filter: "select" } })  // faceted çoklu seçim
helper.accessor("notlar",   { meta: { filter: false } })     // filtrelenmez
```

`select`, kolonda **gerçekten var olan** değerleri sayılarıyla listeler ve
**kendi filtresini dışlar** — bir değeri seçtikten sonra listeye ikinci bir
değer ekleyebilirsiniz. (Kendi filtresini dışlamayan bir liste, çoklu seçimi
fiilen tek seçime çevirir.)

Araç çubuğu ve filtre satırı aynı durumu paylaşır:

```tsx
const [showFilterRow, setShowFilterRow] = useState(true);

<GridToolbar table={table} showFilterRow={showFilterRow} onToggleFilterRow={setShowFilterRow}>
  <Button size="sm">Yeni kayıt</Button>   {/* opsiyonel ek eylemler */}
</GridToolbar>
<DataGrid table={table} showFilterRow={showFilterRow} height={560} />
```

### Sunucu taraflı mod

4.000 kayıtlık bir listede istemci taraflı ızgara, her yüklemede tüm veriyi
ağa koyup tarayıcı belleğinde tutmak demek. `useServerGrid` durumu tutup
veriyi çekiyor:

```tsx
const server = useServerGrid<Card>({
  fetcher: async (query) => {
    const res = await queryCardsGridAction(serializeGridQuery(query));
    return { rows: res.data.items, total: res.data.total };
  },
  initialSorting: [{ id: "number", desc: false }],
});

const table = useGridTable<Card>({ columns, getRowId: (r) => r.id, ...server.options });
```

Kancanın çözdüğü dört şey — dördü de elle yazıldığında unutuluyor:

1. **Yarış koşulu.** Hızlı yazarken birden fazla istek uçuşta olur ve ağ
   sırayı garanti etmez; "ab" isteği "abc"den sonra dönebilir. Sıralı sayaç
   olmadan ekranda "abc" yazarken "ab" sonuçları kalır.
2. **Filtre değişince ilk sayfaya dön.** 12. sayfadayken filtre uygulayıp
   sonuç 3 sayfaya düşerse boş ekran görürsünüz — veri var, yanlış sayfada.
3. **Geciktirme yalnızca yazılan alanlarda.** Sayfa/sıralama tek tıklama;
   onları geciktirmek arayüzü tembel gösterir.
4. **Üç `manual*` bayrağı birlikte.** Yalnızca `manualPagination` verip
   `manualFiltering` unutulursa TanStack istemcide bir kez daha filtreler ve
   sunucunun döndürdüğü satırların bir kısmı kaybolur.

**Dikkat: kolon kimlikleri sunucunun alan adlarıyla aynı olmalı** —
`columnFilters` sunucuya `{"id":"priority",...}` diye gidiyor.

**Faceted (`select`) filtre sunucu modunda `meta.filterOptions` ister.**
Yüzeyleme listeyi istemcideki satırlardan üretiyor ve orada yalnızca görünen
sayfa var; liste ya boş kalır ya yanıltıcı olur. Enum değerleri zaten derleme
zamanında belli:

```tsx
helper.accessor("priority", {
  meta: { filter: "select", filterOptions: CARD_PRIORITY_OPTIONS },
})
```

### Dışa / içe aktarma

```tsx
<GridExportButton table={table} filename="kartlar.csv" fetchAll={fetchAll} />
<GridImportButton table={table} onImport={(rows) => save(rows)} />
```

**Dışa aktarma kapsamı menüden seçiliyor** ("Seçili (12)", "Bu sayfa (25)",
"Tümü (640)"). Tek düğme belirsiz olurdu: kullanıcı 12 satır seçmişken
640 satır inerse bunu ancak dosyayı açınca anlar.

**Sunucu modunda `scope:"all"` için `fetchAll` ZORUNLU** — istemcide o veri
yok; 25 satır yazıp "tümü" demek sessiz bir veri kaybı olurdu. Verilmezse
açık hata atıyoruz.

**Değerler ham yazılıyor**, `cell` çizicisiyle değil: ham değer Excel'de sayı
olarak kalıyor ve üzerinde işlem yapılabiliyor; "₺455.167" bir metin olurdu.

**İçe aktarma iki aşamalı**: dosya → önizleme (kolon eşlemesi + ilk 5 satır +
uyarılar) → uygula. Geri alınamaz bir işlem ve dosyayı başka bir program
üretti; tek aşamada uygulasak hata ancak veritabanında görülürdü.
Değerler **dize olarak** teslim ediliyor — "0012" bir ürün kodu olabilir,
tarih biçimi belirsizdir; tahmin etmek sessizce yanlış veri yazmanın yolu.

### Excel (.xlsx) — bağımlılıksız

Dışa aktarma menüsü **biçim** ve **kapsam** olmak üzere iki eksende soruyor
(alt menü): `Excel (.xlsx) ▸ Seçili (12) / Bu sayfa (25) / Tümü (640)`.
Düz listede 2×4 = 8 öğe olurdu ve kullanıcı ne seçtiğini takip edemezdi.

Üretilen dosya: **kalın başlık, dondurulmuş başlık satırı, otomatik filtre,
içeriğe göre kolon genişlikleri**; sayılar sayı, tarihler gerçek tarih olarak
yazılıyor (seri numara + biçim) — yani Excel'de sıralanabiliyor ve formüle
girebiliyor. CSV'de her şey metindir ve Excel `0012`'yi `12` yapar.

İçe aktarma dosya adına bakıp doğru ayrıştırıcıyı seçiyor; `.xlsx` dosyaları
paylaşımlı dize tablosu (`sharedStrings`) ve tarih biçimleriyle birlikte
okunuyor.

**Neden bir kütüphane değil?** JSZip/fflate/exceljs eklemek, ızgarayı kullanan
**herkese** Excel bedelini ödetmek olurdu — CSV yeter diyenlere bile.
"İsteğe bağlı bağımlılık" (`optionalDependencies` + dinamik `import`) ise
Next/Turbopack'te **derleme hatası** veriyor: paketleyici kurulu olmayan
modülü çözemiyor. Yani isteğe bağlı, pratikte isteğe bağlı olmuyor.

Kalan iki seçenek Excel'i hiç desteklememek ya da kendimiz yazmaktı.
İhtiyacımız olan yüzey dar olduğu için ikincisi seçildi:

- **Yazarken sıkıştırma yok** (ZIP `STORE`). DEFLATE yazmak büyük bir iş;
  sıkıştırmamak ise standardın izin verdiği bir seçenek ve Excel /
  LibreOffice / Sheets bunu sorunsuz açıyor. Bedeli dosya boyutu (~3-4 kat).
- **Okurken** sıkıştırma çözme gerekiyor (gerçek Excel dosyaları DEFLATE'li)
  ve bunu tarayıcının yerleşik `DecompressionStream`i yapıyor.

Sınır dürüstçe: >100 MB dosyalar için akışlı bir çözüm gerekir. O gün bir
kütüphane eklenir; bugün eklemek "ileride lazım olur" bağımlılığı olurdu.

### Sanallaştırma (Faz 5)

```tsx
<DataGrid table={table} height={560} />          // "auto": 60 satır üstü açılır
<DataGrid table={table} height={560} virtual />  // zorla
```

Ölçüldü: sayfa boyutu 100 iken **31 satır** çiziliyor, 100 değil; kaydırınca
görünen aralık kayıyor (TUD-44…TUD-74), üstte/altta yükseklikli boş satırlar.

**Mutlak konumlandırma değil, dolgu satırları.** Yaygın yaklaşım satırları
`position: absolute` ile yerleştirmek; bir `<table>` içinde bu yıkıcı: `<tr>`
tablo yerleşiminden çıkıyor, hücre genişlikleri kolonlarla hizasını
kaybediyor ve dondurulmuş kolonların `sticky` ofsetleri anlamsızlaşıyor.
Üstte/altta yüksekliği olan boş `<tr>`ler bırakınca yapışkan başlık ve
dondurulmuş kolonlar olduğu gibi çalışıyor.

**`height` verilmezse kapalı**: kaydırma kabı yoksa "görünür alan"
hesaplanamıyor; yanlış çalışmasındansa hiç çalışmaması iyi.

### Hücre düzenleme (Faz 6)

```tsx
const editing = useGridEditing<Row>({
  mode: "batch",                       // ya da "cell"
  onSave: async (changes) => { await save(changes); server.refetch(); },
  validate: (address, value) =>
    address.columnId === "title" && !value ? "Başlık zorunlu" : undefined,
});

helper.accessor("title", {
  cell: (context) => <EditableCell context={context} editing={editing} />,
})

<GridEditBar editing={editing} />
```

**Klavye sözleşmesi** (elektronik tabloların ortak dili): çift tıklama /
Enter / F2 açar, Enter onaylar, **Escape vazgeçer**, Tab onaylayıp ilerler,
dışarı tıklama onaylar. Escape'in vazgeçmesi şart — onaylasaydı kullanıcının
"yanlış yazdım, iptal" refleksi sessizce veri yazardı.

**`"cell"` her onayda kaydeder, `"batch"` biriktirir.** Toplu kip ayrıca
**vazgeçilebilir** olmasını sağlıyor; geri alınamaz bir işlemi geri
alınabilir yapmak bir ızgarada en değerli şeylerden biri.

**Kaydettikten sonra `refetch()` çağırın.** Sunucu taraflı ızgarada bu
zorunlu: ölçtüğüm hata tam buydu — veri veritabanına yazılıyordu ama ekranda
eski değer kalıyordu, yani kullanıcının gördüğü şey "kaydettim, hiçbir şey
olmadı" oluyordu. Yerel iyimser güncelleme de yanlış olurdu: sunucu değeri
dönüştürmüş olabilir.

Diğer kararlar: geçersiz değer **hücreyi açık bırakır** (kapatsaydık düzeltmek
için yeniden açmak gerekirdi); kayıt başarısızsa **değişiklik durur**
(temizleseydik kullanıcının yazdığı kaybolurdu); hata varken **Kaydet kapalı**
(kısmi kayıt, kullanıcının hangi satırın geçtiğini bilmemesi demek).

### Gruplama ve özetler (Faz 4)

```tsx
helper.accessor("tutar", {
  header: "Tutar",
  meta: { align: "end", aggregate: "sum" },   // TEK yer, İKİ iş
})

<GridGroupPanel table={table} />   // araç çubuğunun altına
<DataGrid table={table} />         // <tfoot> kendiliğinden çiziliyor
```

`meta.aggregate` (`sum` / `mean` / `min` / `max` / `count` / `uniqueCount`)
hem **grup başlığındaki** özeti hem **alttaki genel toplamı** besliyor. İkisini
ayrı ayrı tanımlatmak, er ya da geç birbirini tutmayan iki sayı üretirdi.

**Özet opt-in.** TanStack'in varsayılanı `aggregationFn: "auto"` — sayısal her
kolon kendini toplanabilir sanıyor. Tarayıcıda ölçüldü: kart **numarası**
kolonu grup başlıklarında 91, 72, 78, 84 gösterdi; bunlar kimlik numaralarının
toplamı. Sayısal olmak toplanabilir olmak değildir (kimlik, yıl, posta kodu,
oda numarası), bu yüzden karar `meta.aggregate`e ait.

**Grup satırında ne çizilir?** Gruplanan kolonun hücresi grubun başlığı
(`Hata (7)`), özetli kolonlar toplamları, **geri kalan hücreler boş**. Grup
satırının `row.original`ı YOK: satır işlemleri menüsü orada çizilseydi "Sil"
tanımsız bir kayıt üzerinde çalışırdı. İstisna `meta.showOnGroupRow` ile açıkça
işaretleniyor — seçim kutusu böyle: grup satırındaki kutu tüm grubu seçer.

**Grup etiketi `filterOptions`tan.** Ham enum değeri (`task`) yerine
kullanıcının hücrelerde gördüğü ad ("Görev") yazılıyor. Bunun için yeni bir
meta alanı **eklenmedi**: aynı değer→etiket eşlemesi seçim filtresinde zaten
duruyor.

**Sunucu taraflı ızgarada** gruplama ve özetler yalnızca görünen sayfa
üzerinde çalışır — istemcide başka veri yok. Özet satırı bunu kendisi söylüyor
("Bu sayfa" etiketi); yanlış bir sayıyı "Toplam" diye sunmaktansa kapsamını
yazmak. Gerçek bir tüm-veri toplamı sunucunun işidir.

### Tembel ağaç (Faz 3)

```tsx
const lazy = useLazyTree<Node>({
  loadChildren: (parent) => fetchChildren(parent),   // kök için parent === null
  getRowId: (row) => row.id,
  hasChildren: (row) => row.childCount > 0,
});

const table = useGridTable({
  data: lazy.rows,
  columns,
  getRowId: (row) => row.id,
  getSubRows: lazy.getSubRows,
  getRowCanExpand: lazy.getRowCanExpand,
});

useEffect(() => {
  lazy.ensureLoaded(
    table.getRowModel().rows.filter((r) => r.getIsExpanded()).map((r) => r.original),
  );
}, [table.state.expanded, lazy.ensureLoaded, table]);
```

**`hasChildren` sunucudan gelmek zorunda.** Tembel ağaçta çocuklar yüklenene
kadar `subRows` boş; "boş ise ok çizme" deseydik hiçbir dal açılamazdı — ok
yok, tıklama yok, yükleme yok. Kilitlenme. Sayımı zaten bilen taraf sunucu
(`_count`).

**"Açıldı" olayı değil, "açık olanların listesi".** Olay dinlemek daha doğal
görünüyor ama kırılgan: bir satır programatik olarak da açılabiliyor (durum
geri yükleme, `expandAll`, bir bağlantıdan gelme) ve o yolların hiçbiri
tıklama olayı üretmiyor — dal açık görünür, boş kalırdı. `ensureLoaded`
fikirsiz (idempotent), her genişletme değişikliğinde çağrılabiliyor.

**Ölçülen iki hata, ikisi de sessizdi:**

1. `getRowCanExpand` önce `(row: TData)` yazılmıştı. TanStack bu geri çağırımı
   **`Row` nesnesiyle** çağırıyor; `Row`un da bir `.id` alanı olduğu için
   kimlik okuması *çalışıyor görünüyordu*, ama `hasChildren(row)` içindeki
   alan `undefined` dönüyordu. Sonuç: hiçbir düğümde ok çizilmiyordu ve
   hiçbir hata da yoktu. Şimdi kanca satırı kendisi açıyor.
2. Çocuklar geliyordu, `getSubRows` doğru diziyi döndürüyordu, **ekranda
   hiçbir şey değişmiyordu** — iki ayrı sebeple: TanStack'in çekirdek satır
   modeli `data` **referansına** göre önbellekleniyor (kök dizi aynı kaldığı
   için model yeniden hesaplanmıyordu), ve `autoResetExpanded` varsayılanı
   `true` olduğu için veri değişince açılan dal **anında kapanıyordu**.
   Birincisi yeni bir dizi referansıyla, ikincisi `useGridTable`ın
   `autoResetExpanded: false` varsayılanıyla çözüldü — ikincisi tazelemede de
   doğru: `refetch()` sonrası kullanıcının açtığı dallar kapanmamalı.

**Bir kez yükleniyor.** Ağaçta gezinmek doğal olarak "aç-kapa-aç" biçiminde;
her açılışta ağ turu hem yavaş hem gereksiz. Tazelemek isteyen
`invalidate(row)` çağırıyor.

**"Çocuğu var" deyip boş dönen düğüm yaprağa dönüşüyor.** Sunucunun sayımı
bayat olabiliyor. Yüklendikten sonra hâlâ ok çizseydik kullanıcı tıklar,
hiçbir şey açılmaz ve tekrar tıklar — çalışmayan bir düğme.

**Hata sonsuz "yükleniyor" bırakmıyor** ve **otomatik yeniden denemiyor**:
denenseydi hata sürerken döngü oluşurdu (aç → yükle → hata → durum değişti →
yeniden koş). Yeniden deneme açık bir eylem: `retry(row)`.

### Gelişmiş filtre — VE / VEYA (Faz 2b)

```tsx
const advanced = useFilterBuilder();

<GridFilterBuilderButton
  fields={FILTER_FIELDS}
  tree={advanced.tree}
  onChange={advanced.setTree}
  onClear={advanced.clear}
/>

// istemci tarafı:  const rows = advanced.applyTo(data, (row, field) => row[field]);
// sunucu tarafı:   useServerGrid({ filterTree: advanced.serialized, ... })
```

**Neden ayrı bir model?** TanStack'in `columnFilters` durumu tasarımı gereği
**düz** bir liste ve aradaki bağlaç her zaman "VE". `durum = Aktif VE (öncelik
= Yüksek VEYA tahmin > 8)` oraya **sığmıyor** — parantezi ve VEYA'yı düz
listeye gömmenin yolu yok. Zorlamak `columnFilters`ın şekli hakkında yalan
söylemek olurdu; filtre satırı ve yüzeyleme o şekle güveniyor.

**Neden tablonun içine değil, verinin önüne?** İstemci kipinde ağaç satırları
tabloya girmeden süzüyor. "Sanal bir kolon filtresi" olarak sokmak mümkündü
ama o zaman *temizle* onu da silerdi, filtre sayacı yanlış sayardı,
yüzeyleme listesi anlamsızlaşırdı.

**Yarım koşul ızgarayı boşaltmıyor.** Kullanıcı "Koşul"a basıp henüz değer
yazmadan ızgara boşalsaydı gördüğü şey "verilerim gitti" olurdu.
Tamamlanmamış koşullar değerlendirmeden **düşüyor** — yazmaya başlayınca
etkisi başlıyor. Aynı gerekçeyle **boş grup** da düşüyor: `OR: []` "hiçbir
şey eşleşmiyor" demek olurdu ve "bir grup ekledim, her şey kayboldu" ile
sonuçlanırdı.

**Sayısal karşılaştırma metin karşılaştırması değil.** `"10" < "9"` metinde
doğrudur ve bir sayı kolonunda "büyüktür" filtresini **sessizce** yanlış
yapardı.

**Tarihte "eşittir" = aynı gün.** Kayıtlar saat de taşıyor; zaman damgasını
birebir eşitlemek kullanıcının aklından geçen şey değil ve filtre "hiçbir
zaman eşleşmiyor" görünürdü. Aynı tanım **sunucuda da** uygulanıyor — iki
taraf ayrışırsa aynı filtre iki yerde farklı sonuç verir.

**Sunucu tarafında iki ek sınır** (`card-filter-tree.ts` örneğinde):
**derinlik** ve **düğüm sayısı**. 5.000 kez iç içe geçmiş bir grup tek bir
istek; özyinelemeli çözümleme yığını taşırabiliyor ve binlerce parantezli bir
SQL üretiyor. İkisi de açıkça **400** ile reddediliyor, sessizce kırpılmıyor:
kırpsaydık filtrenin bir kısmı uygulanır ve sonuç tamamı uygulanmış gibi
görünürdü.

Yine sunucu tarafında ölçülen bir tuzak: **`new Date("15 Mart")` hata
vermiyor**, V8'in gevşek çözümleyicisi "Mart"ı "Mar" okuyup **15 Mart 2001**
döndürüyor. `Number.isNaN(getTime())` bunu yakalayamaz — tarih "geçerli".
Tek savunma biçimi önceden doğrulamak.

### Düzen kalıcılığı (Faz 8)

```tsx
const table = useGridTable({ ... });
const layout = usePersistedGridLayout(table, { key: "kartlar" });

<GridToolbar table={table} onResetLayout={layout.reset} />
```

Varsayılan olarak kaydedilenler: **kolon genişliği, sırası, görünürlüğü,
dondurma, sıralama, gruplama, sayfa boyutu.**

**Filtreler bilerek dışarıda.** Kullanıcı dün 640 kaydı 12'ye indiren bir
filtre kurup sekmeyi kapatıyor; bugün ızgarayı açıp 12 kayıt görüyor.
Filtreyi kendi kurduğunu hatırlamıyor ve gördüğü şey "verilerim kayboldu".
Ekranda "bir filtre açık" diyen hiçbir şey yok. Ayrım şu: **görünümü**
değiştiren şey kaydedilir, **veriyi** değiştiren şey kaydedilmez. İsteyen
`include: [..., "columnFilters"]` yazıyor — ama bilerek.

**`pageIndex` hiç kaydedilmiyor**, `include`a bile alınamıyor: "7. sayfa" bir
tercih değil, geçici bir konum, ve veri değiştiyse yarın aynı sayfa başka
kayıtları gösterir.

**Neden `initialState` değil de effect içinde geri yükleme?** Next, istemci
bileşenlerini de sunucuda çizip HTML üretiyor ve orada `localStorage` yok.
Sunucu varsayılan genişlikleri, istemci kayıtlı genişlikleri çizerdi — React
bunu hydration mismatch diye yüzümüze çarpar ve ağacı yamamaz. Bedeli bir
karelik varsayılan düzen; `isRestored` dışarı veriliyor, isteyen o kareyi
örter.

**Sunucu taraflı ızgarada bir ek istek.** Geri yükleme sıralamayı veya sayfa
boyutunu değiştiriyorsa ilk istek varsayılanlarla gitmiş olur ve bir istek daha
atılır. Kaçınmanın tek yolu ilk isteği kayıt okunana kadar bekletmekti — o da
her açılışta görünür bir gecikme demek.

**Budama zorunlu.** Kayıt o günkü kolon kimliklerine gönderme yapıyor. Kolon
kaldırıldıysa `columnPinning` var olmayan bir kolonun ofsetini saymaya
çalışır — ve en kötüsü, bayat bir `columnFilters` kaydı **sunucu taraflı**
ızgarada API'ye gidip "Filtrelenemeyen alan" 400'ü döndürür. Kullanıcının
gördüğü: ızgara açılmıyor, sebep belirsiz, **sayfayı yenilemek kurtarmıyor**
çünkü hata kayıtlı. Var olmayan kimlikler yüklemede atılıyor.

**Budama bir dilimi tamamen boşalttıysa o dilim hiç uygulanmıyor.** Tarayıcıda
ölçüldü: bayat bir `columnPinning: { start: ["silinmisKolon"] }` kaydı budanıp
`{ start: [], end: [] }` olarak tabloya yazılıyordu ve uygulamanın
`initialState`teki "kimlik kolonları dondurulsun" kararını sessizce siliyordu.
Boşalmış bir liste "kullanıcı boş istedi" demek değil, "elimizde bir şey
kalmadı" demek — kayıt **zaten** boşsa uygulanıyor (yoksa tercih her
yenilemede geri gelirdi), budama boşalttıysa varsayılan korunuyor.

**"Düzeni sıfırla" bir süs değil.** Kalıcılık olmadan kötü bir düzenden
çıkmanın yolu sayfayı yenilemekti; düzen kaydedilir hale gelince o yol da
kapanıyor. Sıfırlamayı eklemeden kalıcılığı açmak, kullanıcıyı kendi
kurduğu tuzakta bırakmak olurdu.

**Yazma geciktiriliyor** (400ms). `columnResizeMode: "onChange"` ile tek bir
sürükleme yüzlerce durum değişikliği üretiyor ve `localStorage` **senkron** —
her yazma ana iş parçacığını kilitler.

**Sunucuya kaydetmek:** `storage` üç fonksiyonluk bir arayüz
(`read`/`write`/`remove`) ve `Promise` döndürebiliyor.

```tsx
usePersistedGridLayout(table, {
  key: "kartlar",
  storage: {
    read: (k) => fetch(`/api/layout/${k}`).then((r) => r.text()),
    write: (k, v) => fetch(`/api/layout/${k}`, { method: "PUT", body: v }),
    remove: (k) => fetch(`/api/layout/${k}`, { method: "DELETE" }),
  },
});
```

### Klavye navigasyonu (Faz 7)

Ekstra bir kurulum yok: `DataGrid` `role="grid"` çiziyor ve klavye kancasını
kendisi bağlıyor.

| Tuş | Ne yapar |
| --- | --- |
| `Tab` | Izgaraya **bir kez** girer, bir kez çıkar (gezinen odak) |
| Ok tuşları | Hücreler arası; sınırda **durur**, başa dönmez |
| `Home` / `End` | Satırın başı / sonu |
| `Ctrl+Home` / `Ctrl+End` | Izgaranın ilk / son hücresi |
| `PageUp` / `PageDown` | Sayfa boyu atlar |
| `Enter` / `F2` | Hücrenin **içine** girer (eylem kipi) |
| `Escape` | Eylem kipinden hücreye döner |
| `↑` (en üstte) | Başlığa çıkar — sıralama ve filtre klavyeyle erişilebilir |

**Neden `role="grid"` bugüne kadar yazılmadı?** O rol ekran okuyucuya "burada
hücre hücre gezilebilir bir yapı var" diye **söz veriyor**. Davranışı olmadan
rolü koymak, kullanıcıyı ok tuşlarına basıp hiçbir şey olmayan bir tabloya
hapsetmek olurdu.

**Gezinen odak (roving tabindex).** Tek bir hücre `tabIndex=0`, diğerleri `-1`.
Alternatif her hücreye `0` vermekti: 25 satır × 10 kolon = 250 sekme durağı,
yani klavye kullanıcısı için geçilmez bir duvar.

**İki kip.** Gezinme kipinde odak hücrede, ok tuşları gezer. `Enter`/`F2`
hücrenin içindeki denetime girer; orada ok tuşlarına **karışılmıyor** (metin
girdisinde imleç çalışsın diye). Kipin doğruluğu bir bayrağa değil **DOM'a**
bakıyor: olayın hedefi hücrenin kendisi (`data-cell`) değilse tuşlar içerideki
denetime aittir. Ölçülen iki hata bu kuralı doğurdu — kolon genişliği tutamağı
ok tuşlarını kaybediyordu, ve odak verilip hemen tuşa basıldığında React'in
durumu henüz işlenmediği için gezinme başlıktan başlıyordu.

**Sanallaştırmayla birlikte:** `aria-rowcount` **tüm** listeyi, her satırdaki
`aria-rowindex` gerçek sırayı taşıyor. DOM'da 30 satır varken kullanıcı 640
kayıtlık listede; bu öznitelikler olmadan ekran okuyucu konumu yanlış duyurur.
Görünür alanın dışındaki bir hücreye gidilirse önce kaydırılıp sonra odak
veriliyor.

### Satır işlemleri

```tsx
createRowActionsColumn<Row>([
  { label: "Düzenle", icon: PencilIcon, onSelect: (row) => edit(row.original) },
  {
    label: "Sil",
    icon: Trash2Icon,
    destructive: true,        // kırmızı
    separatorBefore: true,    // üstüne ayırıcı
    disabled: (row) => row.original.locked,  // GİZLENMEZ, devre dışı kalır
    onSelect: (row) => remove(row.original),
  },
])
```

Yan yana ikonlar yerine menü: dört ikon her satırda 112px yer kaplar, "Sil"
"Düzenle"nin 4px yanında durur ve beşinci eylemde tasarım çöker.

### İki kural — ikisi de derleme/çalışma hatası olarak geri döner

**1. `helper.columns([...])` kullanın, düz dizi değil.**
Düz `[a, b, c]` yazarsanız TypeScript diziyi tek bir ortak tipe daraltmaya
çalışır; seçim kolonu (`unknown`) ile `name` kolonu (`string`) bağdaşmaz ve
sayfalarca hata alırsınız. `helper.columns()` demeti olduğu gibi korur.

**2. `data` ve `columns` sabit referans olsun.**
Render içinde `data={rows ?? []}` ya da `columns={[...]}` yazmak her çizimde
yeni referans üretir; TanStack'in tüm satır/kolon modelleri yeniden hesaplanır.
`useMemo`, `useState` ya da modül seviyesi sabit kullanın.

---

## Verilen kararlar

Varsayılanlar TanStack'ten farklı olduğu yerlerde, sebebi kodda yazıyor.
Özet:

| Karar | Neden |
|---|---|
| Tek, geniş özellik kümesi (`gridFeatures`) | Özellikleri seçtirmek `DataGrid`in prop tiplerini kümeye bağlardı; kullanıcı TanStack'in iç tiplerini öğrenmek zorunda kalırdı. Bedeli ~40 KB. |
| `sortDescFirst: false` | TanStack sayısal kolonlarda azalanla başlıyor. Aynı tabloda metin A→Z, sayı 9→0 başlaması öngörülemez. Öngörülebilirlik > tek kolondaki kolaylık. |
| `paginateExpandedRows: false` | Aksi halde ağaç düğümü açınca çocuklar sayfa sınırını aşıp bir sonraki sayfaya taşar; kullanıcı "açtım, yarısı kayboldu" der. |
| `columnResizeMode: "onChange"` | Canlı genişleme. `onEnd` kullanıcıya ne kadar genişlettiğini göstermez. |
| Yanıt derinliği / ağaç girintisi `paddingInlineStart` | RTL'de doğru tarafa gider; iç içe `div` `truncate` ile bozulur. |
| Dondurma `insetInlineStart/End` | v9 konumları `"start"/"end"` (mantıksal). Fiziksel `left` RTL'de ters çalışırdı. |
| Başlıktaki kutu **sayfayı** seçer | Gördüğü 25 satır için tıklayıp 10.000 kaydı silmesin. Tümünü seçmek ayrı, açık bir eylem olacak. |
| Silme ≠ düzenleme yetkisi ayrımı yok (burada) | — bu izgara yetki bilmez; satır bazlı kısıt `enableRowSelection` ile tüketicinin. |
| `role="grid"` **davranışıyla birlikte** geldi | O rol tam klavye navigasyonu taahhüt eder. Faz 7'ye kadar bilinçli olarak yazılmadı: davranışsız bir rol, kullanıcıyı ok tuşlarına basıp hiçbir şey olmayan bir tabloya hapsetmek olurdu. Önce söz verip sonra tutmak değil — önce tutmak. |
| Özet **opt-in** (`meta.aggregate`) | TanStack'in varsayılanı `aggregationFn: "auto"`: sayısal her kolon kendini toplanabilir sanıyor. Ölçüldü — kart **numarası** kolonu grup başlıklarında kimliklerin toplamını gösterdi (91, 72, 78, 84): anlamsız ama anlamlı duracak biçimde biçimlenmiş dört sayı. Sayısal olmak toplanabilir olmak değildir (kimlik, yıl, posta kodu). |
| Grup paneli **sürükle-bırak değil**, açılır liste | Sürükle-bırak bir bağımlılık (~30 KB) demek ve bedeli gruplamayı kullanmayanlar da öder; ayrıca klavyeyle çalışmaz. Aynı yetenek, üçte bir kod, sıfır bağımlılık. |
| Filtreler **varsayılan olarak kaydedilmiyor** | Dün kurduğu filtreyi hatırlamayan kullanıcının gördüğü şey "verilerim kayboldu"dur ve ekranda sebebi söyleyen bir şey yoktur. Kural: **görünümü** değiştiren kaydedilir, **veriyi** değiştiren kaydedilmez. |
| `pageIndex` **hiç** kaydedilmiyor | "7. sayfa" bir tercih değil, geçici bir konum; veri değiştiyse yarın aynı sayfa başka kayıtları gösterir. `pageSize` ise gerçek bir tercih. |
| Sunucu modunda özet **"Bu sayfa"** diye etiketleniyor | İstemcide yalnızca o sayfa var. Sayıyı gizlemek de, "Toplam" deyip yanlış sunmak da kötü; kapsamı yazmak yanıltmıyor. |
| `Subscribe` ile durum okuma | React Compiler, `row.getIsSelected()` gibi metot içi okumaları göremez ve satırı yeniden çizmez. Tüketicinin derleyici kullanıp kullanmadığını bilemeyeceğimiz için her zaman çalışan biçim yazıldı. |
| `"use client"` derleme sonrası ekleniyor | `tsup` banner'ını paketleyici **sessizce atıyor**. Olmadan Next App Router paketi sunucuda çalıştırır ve hata tüketicinin ekranında patlar. |
| Tablo `width:100%` + `min-width:toplam` + **dolgu hücresi** | Yalnızca `width:toplam` ile ızgara dar tabloda sola yapışıyordu. Yalnızca `100%` ile `table-fixed` fazla alanı tüm kolonlara dağıtır ve dondurulmuş kolon ofsetleri kayar. Dolgu hücresi artan alanı yutar, gerçek kolonlar piksel genişliğini korur. |
| `minSize: 60`, `maxSize: 640` | Sınırsız genişletme tabloyu ekrandan taşırıyor, sınırsız daraltma tutamağı yakalanamaz hale getiriyordu. İkisi de kalıcı durum: sayfa yenilemek kurtarmıyor. |
| Faceted filtre için **kendi** `oneOf` fonksiyonumuz | TanStack'in `arr*` ailesi **satır değeri dizi** olduğunda çalışıyor; bizde satır değeri tek, filtre değeri dizi. `arrIncludesSome` her seçimde sessizce "0 kayıt" dönüyordu. |
| Sayı aralığı `inNumberRange`, `between` değil | `between` açık ucu desteklemiyor: kullanıcı yalnızca "min" yazdığında hiç satır dönmüyordu. |
| Devre dışı menü öğesi, gizli öğe değil | Gizlenen öğe satırdan satıra yer değiştirir, kas hafızası bozulur ve eylemin **neden** yok olduğu hiçbir yerde yazmaz. |
| Başlıktaki filtre satırı `<thead>` içinde | Yapışkan başlıkla birlikte kayıyor: bir filtreyi değiştirmek için listenin başına dönmek gerekmiyor. |
| Varsayılan `filterMode: "popup"` | Kalıcı filtre satırı her ekranda bir veri satırı yiyor ve 8 kolonun 8'inde boş kutu bırakıyor; oysa kullanıcı genelde bir kolona göre filtreliyor. `"row"` modu ardışık filtreleme için duruyor. |
| Popup içinde liste **gömülü**, iç içe menü değil | Huniye tıklayıp bir açılır menü daha görmek iki tıklama ve iki katman demekti. Satır modunda tam tersi doğru: liste gömülü olsa filtre satırı devasa olurdu. |
| `ps-*`/`start-*` (mantıksal), `pl-*`/`left-*` değil | `pl-7` ile `px-2` **çakışıyor ve kazananı CSS kaynak sırası belirliyor** — tüketicinin ezmesi bazen çalışır bazen çalışmaz. `ps-7`, `ps-2` ile tam aynı özelliği hedefliyor; `tailwind-merge` çakışmayı görüp öncekini siliyor. RTL de bedava. |

---

## Yol haritası

- [x] **Faz 1 — Çekirdek:** özellik kümesi, `useGridTable`, `DataGrid`,
      başlık (sıralama + çoklu sıralama rozeti + genişletme), dondurulmuş
      kolonlar, seçim kolonu, ağaç hücresi, sayfalama.
- [x] **Faz 2 — Filtreleme + araç çubuğu:** filtre satırı (`meta.filter` ile
      metin / sayı aralığı / tarih aralığı / faceted çoklu seçim), genel arama,
      kolon seçici, satır işlemleri menüsü, genişlik sınırları, tam genişlik
      yerleşimi. 24 test.
- [x] **Faz 2b — Filtre kurucu:** iç içe VE/VEYA grupları, tipe göre işleçler,
      istemci değerlendirmesi ve sunucuya serileştirme.
- [x] **Faz 5 — Sanallaştırma:** dolgu satırlarıyla, dondurulmuş kolonlar ve
      yapışkan başlıkla uyumlu.
- [x] **Faz 6 — Düzenleme:** hücre/toplu kip, doğrulama, kirli takibi,
      kaydet/vazgeç çubuğu.
- [x] **Excel:** bağımlılıksız .xlsx yazma/okuma (ZIP + OOXML).
- [x] **Faz 3 — Ağaç ileri seviye:** tembel çocuk yükleme (`useLazyTree`),
      sunucu taraflı ağaç uç noktası.
- [x] **Faz 4 — Gruplama + özetler:** grup paneli (rozetler), grup başlığı
      satırları, `<tfoot>` genel toplam.
- [x] **Faz 7 — Klavye + a11y:** gezinen odak (roving tabindex), `role="grid"`,
      `aria-rowcount`/`aria-rowindex`, gezinme ve eylem kipleri.
- [x] **Faz 8 — Durum kalıcılığı:** kolon genişliği/sırası/görünürlüğü/
      dondurma, sıralama, gruplama ve sayfa boyutu; `localStorage` ya da
      takılabilir depo (sunucu).
- [ ] **Faz 9 — Paketleme:** sürümleme, değişiklik günlüğü, yayınlama.

---

## Sürüm ve yayınlama (Faz 9)

Sürüm **0.2.0**. 1.0 bilerek bekliyor: "1.0" demek "bu arayüzü kırmayacağım"
sözü vermektir ve Faz 3 hâlâ arayüze dokunacak. 1.0 öncesi **kırıcı
değişiklikler minor'ü artırıyor** (`0.1` → `0.2`).

### Projelerde kullanmak

Bugün en pratik yol yerel tarball; `npm link` **kullanma**, sembolik bağlantı
Turbopack'i çökertiyor.

```bash
npm --prefix ../datagrid run pack:local     # dist üretir + .tgz yazar
npm install ../tudos-datagrid-0.2.0.tgz
```

Tüketici tarafında `scripts/sync-datagrid.mjs` bunu tek komuta indiriyor
(`npm run grid:sync`) çünkü **üç ayrı önbellek** aynı anda yanıltıyor:

| Önbellek | Belirtisi |
| --- | --- |
| npm, aynı sürümü "up to date" sayıp kurulumu atlıyor | yeni dışa aktarımlar "Export X doesn't exist" |
| Turbopack modül grafiği | var olan bir export için "Module not found" |
| Tailwind'in `node_modules` taraması | UI "bozuk" görünüyor, kodda hata yok |

Üçüncüsü bu projede bir **UI hatası olarak rapor edildi** ve kod boşuna
arandı. Script `.next`i siliyor; bu yüzden **çalışan dev sunucusunu
durdurup yeniden başlatmak adımın parçası** — açık bir sunucu `.next`
silindikten sonra paket kurulu olmasına rağmen "Module not found" verir.

### Yayın kapıları

`npm run ci` artık **`verify:package`** ile bitiyor: `npm publish`in
göndereceği şey `dist/` değil, `files` alanının seçtiği şeydir. İkisi
ayrışırsa derleme yeşil, testler yeşil, **tarball bozuk** olur — ve bu hata
bizde hiç görünmez, ancak başka bir projede ortaya çıkar. Kontrol ettikleri:

- `exports`/`main`/`module`/`types` ne gösteriyorsa tarball'da var mı,
- `dist/index.js` ve `.cjs` `"use client"` ile başlıyor mu (postbuild'e ek
  ikinci savunma — direktifin kaybolması tüketicinin ekranında
  "useState only works in Client Components" olarak patlıyor),
- kaynak/test dosyaları sızmış mı,
- akran bağımlılığı aynı anda normal bağımlılık mı (olursa tüketici React'in
  ikinci kopyasını kurar → "Invalid hook call").

`npm publish` öncesi `prepublishOnly` → **`release:check`** çalışıyor. Bu, CI
ile aynı şey değil: CI **kodun** doğruluğuna bakıyor, bu kapı kodun dışında
kalan ve **geri alınamayan** şeylere —

- yayınlanan sürüm numarası bir daha kullanılamaz (npm aynı sürümü ikinci kez
  kabul etmiyor),
- commit edilmemiş değişiklikle yayınlamak, yayındaki kodun hiçbir commit'e
  karşılık gelmemesi demek — geri üretilemez,
- CHANGELOG girdisi olmayan bir sürüm "ne değişti?" sorusuna cevap vermiyor.

Hiçbiri testle yakalanmaz, çünkü hiçbiri kodla ilgili değil.

### Bir sürüm çıkarmak

```bash
# 1. package.json sürümünü artır, CHANGELOG.md'ye "## [x.y.z]" girdisini yaz
# 2. commit et  (kapı kirli çalışma ağacını reddediyor)
npm run release:check
git tag vx.y.z && git push --tags
```

## Geliştirme

```bash
npm run ci        # lint + tsc + test + build
npm run pack:local # ../tudos-datagrid-<sürüm>.tgz üretir
```

Tüketici tarafında **sembolik bağ (`file:../datagrid`) KULLANMAYIN**: Turbopack
proje kökünün dışına çıkan sembolik bağlarda çöküyor. `npm run pack:local` ile
üretilen tarball'ı kurun — üstelik bu, yayınlanmış paketin gerçek halini test eder:

```bash
npm install ../tudos-datagrid-0.1.0.tgz
```

**Yeniden paketledikten sonra dev sunucusunu YENİDEN BAŞLATIN.** Turbopack
`node_modules`u agresif önbelleğe alıyor: tarball değişse bile eski modül
grafiğini kullanmaya devam ediyor ve "Export X doesn't exist in target module"
gibi, aslında var olan bir dışa aktarım için hata veriyor. Bu, paketin değil
önbelleğin hatası — ilk gördüğümde tam bir tur kaybettim.
