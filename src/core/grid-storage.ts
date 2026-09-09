/**
 * DURUM DEPOSU ARAYUZU.
 *
 * ---
 * NEDEN DOGRUDAN `localStorage` YAZMADIK?
 *
 * Kolon duzeni kisiye ait bir tercih ve iki mesru yeri var:
 *   - TARAYICI (localStorage): kurulum sifir, ama cihaz basina. Kullanici
 *     is bilgisayarindan kurdugu duzeni evde bulamiyor.
 *   - SUNUCU: her cihazda ayni, ama bir uc nokta ve kimlik gerekiyor.
 *
 * Hangisinin dogru oldugu UYGULAMANIN karari, izgaranin degil. Bu yuzden
 * varsayilan `localStorage`, ama arayuz disariya acik: sunucuya yazmak
 * isteyen uc fonksiyon yaziyor.
 *
 * ---
 * NEDEN ASENKRON OLABILIYOR?
 *
 * `localStorage` senkron; bir HTTP ucu degil. Arayuzu `Promise` de kabul
 * eder yapmak, sunucu secenegini SONRADAN eklenen bir sey olmaktan
 * cikariyor. Senkron uygulamalar hicbir sey kaybetmiyor (`await`
 * senkron degeri de bekliyor).
 */
export interface GridStorage {
  read: (key: string) => string | null | Promise<string | null>;
  write: (key: string, value: string) => void | Promise<void>;
  remove: (key: string) => void | Promise<void>;
}

/**
 * Varsayilan depo: `localStorage`.
 *
 * ---
 * HER ERISIM `try/catch` ICINDE -- ve bu asiri temkin DEGIL.
 *
 * `localStorage` GERCEKTEN firlatiyor:
 *   - Safari'nin gizli sekmesinde kota 0'dir; `setItem` `QuotaExceededError`
 *     atiyor.
 *   - Ucuncu taraf cerezleri kapali bir `iframe` icinde `localStorage`a
 *     ERISMEK bile `SecurityError` atiyor -- okumak dahi.
 *   - Kullanici site verilerini engellemis olabilir.
 *
 * Bu durumlarin hicbiri izgarayi cokertmemeli: duzen kaydedilemiyorsa
 * kullanici duzeni yeniden kurar, ama tablo calismaya devam eder.
 * "Kaydedememek" bir kayip, "acilmamak" bir felaket.
 */
export const localStorageAdapter: GridStorage = {
  read: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Sessizce gecmek burada DOGRU: kullaniciya "düzeniniz
      // kaydedilemedi" diye bir uyari gostermek, yapabilecegi bir sey
      // olmadigi icin yalnizca rahatsizlik olurdu.
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Yukaridaki ile ayni gerekce.
    }
  },
};
