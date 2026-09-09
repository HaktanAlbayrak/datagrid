# Değişiklik günlüğü

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/), sürümleme
[SemVer](https://semver.org/lang/tr/).

> **1.0 öncesi kural:** kırıcı değişiklikler **minor** sürümü artırır (`0.1` →
> `0.2`), düzeltmeler patch'i. 1.0, API oturana kadar bilerek bekliyor —
> "1.0" demek "bu arayüzü kırmayacağım" sözü vermektir; yol haritası bitti
> ama arayüz henüz tek bir tüketicide sınandı.

## [Yayınlanmadı]

### Eklendi

- **Faz 2b — Gelişmiş filtre (VE/VEYA):** iç içe gruplar, tipe göre işleçler,
  istemci değerlendirmesi (`filterRowsByTree`) ve sunucuya serileştirme
  (`serializeFilterTree`); `useServerGrid` artık `filterTree` taşıyor.
- `GridFilterBuilder`, `GridFilterBuilderButton`, `useFilterBuilder`,
  `describeFilterTree`.
- **Faz 3 — Tembel ağaç:** `useLazyTree` (açılınca yükleme, önbellek,
  eşzamanlı dallar, hata/yeniden deneme, "çocuğu var" deyip boş dönen düğüm).

### Değişti

- `useGridTable` varsayılanı **`autoResetExpanded: false`**. TanStack
  varsayılanı `true` ve veri değişince açık dalları kapatıyordu: tembel
  ağaçta bu, yüklenen dalın anında kapanması demekti; tazelemede ise
  kullanıcının açtığı her dalın kaybolması.

## [0.2.0] — 2026-09-09

Faz 4, 5, 6, 7, 8 ve sunucu taraflı mod. 80 test.

### Eklendi

- **Sunucu taraflı mod** (`useServerGrid`): sıralama/filtreleme/sayfalama
  sunucuda; yarış koşulu koruması (istek kimliği), filtre değişince sayfa
  sıfırlama, yalnızca yazılan alanlarda geciktirme, `refetch()`.
- **Dışa/içe aktarma**: bağımlılıksız `.xlsx` yazma/okuma (kendi ZIP + OOXML
  katmanımız) ve CSV; kapsam seçimi (seçili / bu sayfa / tümü), içe aktarmada
  kolon eşleme önizlemesi.
- **Faz 5 — Sanallaştırma**: dolgu satırlarıyla; dondurulmuş kolonlar ve
  yapışkan başlıkla uyumlu, `virtual="auto"` eşiği.
- **Faz 6 — Düzenleme**: hücre ve toplu kip, doğrulama, kirli satır takibi,
  kaydet/vazgeç çubuğu.
- **Faz 4 — Gruplama + özetler**: grup paneli (rozetler), grup başlığı
  satırları, `<tfoot>` genel toplam, `meta.aggregate`.
- **Faz 7 — Klavye + a11y**: `role="grid"`, gezinen odak (roving tabindex),
  gezinme/eylem kipleri, `aria-rowcount`/`aria-rowindex`.
- **Faz 8 — Düzen kalıcılığı**: `usePersistedGridLayout`, takılabilir depo
  (`localStorage` ya da sunucu), şema sürümü, budama, "Düzeni sıfırla".
- `columnLabel()`, `filterFn_oneOf`, `GridStorage`, `hasAggregate`.

### Değişti

- `exportGridToCsv` → **`exportGrid`** (biçim artık bir seçenek). **Kırıcı.**
- `role="grid"` eklendi. Daha önce bilinçli olarak yoktu: davranışsız bir rol
  ekran okuyucuya tutulmayan bir söz verir.
- Özet **opt-in** oldu (`meta.aggregate`). TanStack'in `aggregationFn: "auto"`
  varsayılanı sayısal her kolonu toplanabilir sayıyordu; kimlik kolonları grup
  başlıklarında anlamsız toplamlar gösteriyordu.

### Düzeltildi

- Yapışkan başlığın altında kalan dondurulmuş hücreler (yığın bağlamı /
  `z-index` katmanları).
- Izgaranın tüm sayfayı yatayda taşırması (`w-0 min-w-full`).
- Faceted filtrenin hiç satır döndürmemesi (`arrIncludesSome` yerine
  `filterFn_oneOf`).
- Aynı hücrenin ikinci kez açılışında bayat başlangıç değeri.
- Kaydettikten sonra ekranda eski değerin kalması (`refetch`).
- Kolon genişliği tutamağının ok tuşlarını klavye gezinmesine kaptırması.

## [0.1.0] — ilk sürüm

Faz 1–2: çekirdek özellik kümesi, `useGridTable`, `DataGrid`, sıralama
(çoklu), ağaç/hiyerarşi, satır seçimi, dondurulmuş kolonlar, kolon genişletme,
filtre satırı, genel arama, kolon seçici, satır işlemleri menüsü, sayfalama.
