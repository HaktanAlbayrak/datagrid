import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * PAKETIN GERCEKTEN NE ICERDIGINI DOGRULAR.
 *
 * ---
 * NEDEN? -- CUNKU BURASI SESSIZ HATANIN EN SEVDIGI YER.
 *
 * `npm publish`in gonderdigi sey `dist/` degil, `files` alaninin SECTIGI
 * seydir. Ikisi ayrisirsa derleme yesil, testler yesil, tarball BOZUK olur:
 * tuketici `Cannot find module '@tudos/datagrid'` ya da
 * `ERR_MODULE_NOT_FOUND: ./dist/index.js` gorur.
 *
 * Ve bu hata BIZDE hic gorunmez -- yerelde `dist` zaten yerinde. Ancak
 * yayindan SONRA, baska bir projede ortaya cikar. Bu yuzden kontrol
 * `npm run ci`nin parcasi: her derlemede calisiyor.
 *
 * ---
 * NEDEN GERCEK BIR KURULUM DENEMESI DEGIL?
 *
 * "Tarball'i gecici bir dizine kurup `import` et" daha guclu bir sinama
 * olurdu ama akran bagimliliklarini da (react, react-dom, @tanstack,
 * @base-ui) oraya kurmayi gerektiriyor: her `npm run ci` calismasina bir
 * dakika ekler. Yakaladigi ekstra hata sinifi (calisma zamani cozumleme)
 * ise burada zaten `exports` haritasi uzerinden kontrol ediliyor.
 *
 * Hizli ve her seferinde calisan bir kontrol, yavas oldugu icin atlanan
 * mukemmel bir kontrolden iyidir.
 */

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

/**
 * `--dry-run`: tarball YAZILMIYOR, yalnizca ne icerecegi soyleniyor.
 * Kontrolun yan etkisi olmamali -- yoksa `ci` her calistiginda kok dizine
 * bir `.tgz` birakirdi.
 */
/*
  `execFileSync` DEGIL `execSync` -- yani KABUK uzerinden.

  Windows'ta `npm` bir `.cmd` sarmalayici ve Node 20 ile gelen bir guvenlik
  degisikligi `.cmd`/`.bat` dosyalarini kabuk olmadan calistirmayi
  engelliyor: `spawnSync npm.cmd EINVAL`. (Olculdu: once
  `platform === "win32" ? "npm.cmd" : "npm"` yaziyordu ve tam bu hatayi
  verdi.) `execFileSync` + `shell: true` ise Node'un kendi uyarisini
  aliyor -- arguman dizisi kabukta kacislanmadan birlestiriliyor.

  Tek bir komut dizesi ikisini de cozuyor ve burada guvenli: komutta hicbir
  degisken yok, hepsi bu dosyada sabit.
*/
const output = execSync("npm pack --dry-run --json", {
  encoding: "utf8",
  cwd: new URL("..", import.meta.url),
});

const [result] = JSON.parse(output);
const packed = new Set(
  result.files.map((file) => file.path.replace(/\\/g, "/")),
);

const errors = [];

/** `exports`/`main`/`module`/`types` NE GOSTERIYORSA tarball'da OLMALI. */
const referenced = new Set();
const collect = (value) => {
  if (typeof value === "string" && value.startsWith("./")) {
    referenced.add(value.slice(2));
  } else if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) collect(entry);
  }
};
collect(pkg.exports);
collect(pkg.main);
collect(pkg.module);
collect(pkg.types);

for (const path of referenced) {
  if (!packed.has(path)) {
    errors.push(
      `package.json "${path}" dosyasini gosteriyor ama tarball'da YOK. ` +
        `("files" alanini kontrol et.)`,
    );
  }
}

/** Yasal ve okunur olmasi gereken dosyalar. */
for (const path of ["README.md", "CHANGELOG.md", "LICENSE"]) {
  if (!packed.has(path)) errors.push(`${path} tarball'a girmemis.`);
}

/**
 * `"use client"` KONTROLU BURADA DA VAR -- postbuild'de de var, bilerek.
 *
 * postbuild `dist`i kontrol ediyor; burasi TARBALL'A GIREN dosyayi. Ikisi
 * ayni sey oldugu surece tekrar gibi gorunuyor ama ayni olmadigi gun
 * (paketleme adimi degisirse) fark eden tek yer burasi olur. Direktifin
 * kaybolmasi, tuketicinin ekraninda "useState only works in Client
 * Components" olarak patliyor.
 */
const DIRECTIVE = '"use client";';
for (const file of ["dist/index.js", "dist/index.cjs"]) {
  if (!packed.has(file)) continue;
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (!source.startsWith(DIRECTIVE)) {
    errors.push(`${file} "use client" ile baslamiyor.`);
  }
}

/**
 * KAYNAK VE TEST DOSYALARI SIZMAMALI.
 *
 * `src/` ve testleri gondermek paketi buyutuyor ve daha kotusu: tuketicinin
 * paketleyicisi bazen onlari tarayip TypeScript hatalari uretiyor.
 */
for (const path of packed) {
  if (path.startsWith("src/") || path.includes(".test.")) {
    errors.push(`Kaynak/test dosyasi tarball'a sizmis: ${path}`);
  }
}

/**
 * AKRAN BAGIMLILIGI AYNI ANDA NORMAL BAGIMLILIK OLAMAZ.
 *
 * Olursa tuketici React'in IKINCI bir kopyasini kurar ve "Invalid hook call"
 * alir -- kanca cagrisi baska bir React ornegine gider. Teshisi zor, sebebi
 * bu satirlik bir yanlislik.
 */
for (const name of Object.keys(pkg.peerDependencies ?? {})) {
  if (pkg.dependencies?.[name] !== undefined) {
    errors.push(`${name} hem "peerDependencies" hem "dependencies" icinde.`);
  }
}

if (errors.length > 0) {
  console.error("\nPaket dogrulamasi BASARISIZ:\n");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("");
  process.exit(1);
}

console.log(
  `verify:package: ${packed.size} dosya, ${(result.size / 1024).toFixed(0)} KB ` +
    `(acilmis ${(result.unpackedSize / 1024).toFixed(0)} KB) -- tamam`,
);
