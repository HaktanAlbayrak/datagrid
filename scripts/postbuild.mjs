import { readFileSync, writeFileSync } from "node:fs";

const dist = (file) => new URL(`../dist/${file}`, import.meta.url);

/**
 * `"use client"` DIREKTIFINI DERLEMEDEN SONRA GERI KOYUYORUZ.
 *
 * OLCULEN PROBLEM: `tsup`in `banner` secenegiyle direktifi ekledim ve
 * paketleyici onu SESSIZCE ATTI:
 *
 *   dist/index.js (1:0): Module level directives cause errors when bundled,
 *   "use client" in "dist/index.js" was ignored.
 *
 * Sebep: rollup, paketlenen dosyalarin icindeki modul seviyesi direktiflerini
 * gecersiz sayip kaldiriyor -- banner ile eklenmis olsa bile.
 *
 * NEDEN ONEMLI: bu paket bir DataGrid, yani dogasi geregi istemci bileseni
 * (durum, olay, ref). Direktif olmadan Next App Router onu sunucuda calistirir
 * ve hata TUKETICININ ekraninda patlar: "useState only works in Client
 * Components". Ustelik hata bizim kodumuzu isaret etmez -- kullanicinin
 * sayfasini gosterir ve sebebini bulmak saatler alir.
 *
 * NEDEN BU COZUM: derleme bittikten SONRA dosyanin basina yazmak, paketleyicinin
 * hic dokunmadigi bir asama. Alternatifler:
 *   - `bundle: false` (dosya basina cikti): direktifi korur ama onlarca dosya
 *     uretir ve `dist` yapisini tuketiciye sizdirir.
 *   - Ayri bir "client entry": iki giris noktasi ve iki kez anlatilacak bir API.
 * Iki satirlik bir son islem, ikisinden de ucuz.
 */
const DIRECTIVE = '"use client";\n';

for (const file of ["index.js", "index.cjs"]) {
  const path = dist(file);
  const source = readFileSync(path, "utf8");

  if (source.startsWith(DIRECTIVE)) continue;

  writeFileSync(path, DIRECTIVE + source);
}

// Direktif GERCEKTEN yerinde mi? Sessizce kaybolmasi tam da yasadigimiz hata.
for (const file of ["index.js", "index.cjs"]) {
  if (!readFileSync(dist(file), "utf8").startsWith(DIRECTIVE)) {
    throw new Error(`"use client" direktifi ${file} dosyasinda yok`);
  }
}

console.log('postbuild: "use client" eklendi');
