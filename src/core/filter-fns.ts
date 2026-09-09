import { constructFilterFn } from "@tanstack/react-table";

/**
 * "DEGER SU KUMEDE MI?" filtresi -- baslik filtresinin (faceted) motoru.
 *
 * ---
 * NEDEN TANSTACK'IN HAZIRLARINDAN BIRI OLMADI?
 *
 * Once `arrIncludesSome` bagladim ve baslik filtresi HER SECIMDE "0 kayıt"
 * dondu. Sebep, adlarin yanilticiligi: `arr*` ailesinin tamami SATIR DEGERI
 * BIR DIZI oldugunda calisiyor ("etiketler" gibi bir alan icin). Bizim
 * durumumuz tersi -- satir degeri TEK bir deger ("İzinde"), filtre degeri
 * bir liste (`["İzinde", "Uzaktan"]`).
 *
 * `arrIncludesSome` ilk satirda `Array.isArray(dataValue)` kontrolunden
 * dusuyor ve `false` donuyordu. Hata sessiz: filtre "calisiyor" gibi
 * gorunuyor, sonuc bos geliyor.
 *
 * `equals` de olmazdi: o tek bir degerle karsilastirir, coklu secim yapilamaz.
 *
 * ---
 * KARSILASTIRMA DIZE UZERINDEN.
 *
 * Yuzeyleme (faceting) listesi degerleri ekranda gostermek icin `String()`e
 * ceviriyor; secilen sey o dize. Satir degeri sayi ya da tarih olabilir.
 * Iki tarafi da dizeye cevirmeseydik `2024` (sayi) ile `"2024"` (secim)
 * eslesmezdi -- ve bu, listede gorunen bir degeri secip hicbir satir
 * gelmemesi demek olurdu.
 */
export const filterFn_oneOf = constructFilterFn({
  filter: (dataValue, filterValue) => {
    if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
    return filterValue.includes(String(dataValue));
  },
  /**
   * Bos liste = filtre YOK.
   *
   * `autoRemove` olmasaydi kullanici son secimi kaldirdiginda `[]` degeri
   * durumda kalir; TanStack onu ETKIN bir filtre sayar, arac cubugundaki
   * rozet "1" gosterir ve "Temizle" dugmesi kaybolmaz. Kullanici neyi
   * temizleyecegini bulamaz.
   */
  autoRemove: (value) => !Array.isArray(value) || value.length === 0,
});
