import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * YAYIN KAPISI -- `prepublishOnly` bunu calistiriyor.
 *
 * ---
 * NEDEN AYRI BIR KAPI? `npm run ci` ZATEN VAR.
 *
 * `ci` KODUN dogru oldugunu soyluyor. Yayin ise kodun disinda kalan ve
 * geri alinamayan seylerle ilgili:
 *
 *   - Yayinlanan surum numarasi bir daha KULLANILAMAZ. npm ayni surumu
 *     ikinci kez kabul etmiyor; yanlis surumle cikan bir paket ancak yeni
 *     bir surumle duzeltilebiliyor.
 *   - Commit edilmemis degisikliklerle yayinlamak, yayindaki kodun HICBIR
 *     commit'e karsilik gelmedigi anlamina geliyor. O paketi geri
 *     uretebilmenin yolu kalmiyor.
 *   - Degisiklik gunlugu olmayan bir surum, tuketiciye "ne degisti?"
 *     sorusunun cevabini vermiyor -- ve o soru her zaman soruluyor.
 *
 * Bunlarin hicbiri testle yakalanmaz, cunku hicbiri kodla ilgili degil.
 *
 * ---
 * NEDEN `prepublishOnly`? (`prepublish` ya da `prepare` DEGIL)
 *
 * `prepare` `npm install`da da calisiyor -- tuketicinin kurulumunda yayin
 * kontrolu calistirmak sacma olurdu. `prepublishOnly` YALNIZCA `npm publish`
 * oncesi calisiyor; tam olarak istenen an.
 */

const root = new URL("..", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const git = (command) =>
  execSync(`git ${command}`, { cwd: root, encoding: "utf8" }).trim();

const pkg = JSON.parse(read("package.json"));
const errors = [];

/** 1. Calisma agaci TEMIZ olmali. */
try {
  if (git("status --porcelain") !== "") {
    errors.push(
      "Commit edilmemis degisiklikler var. Yayinlanan paket bir commit'e " +
        "karsilik gelmezse geri uretilemez.",
    );
  }
} catch {
  errors.push("git deposu bulunamadi (yayin icin surum kontrolu sart).");
}

/** 2. Bu surum icin bir degisiklik gunlugu girdisi olmali. */
const changelog = read("CHANGELOG.md");
if (!changelog.includes(`## [${pkg.version}]`)) {
  errors.push(
    `CHANGELOG.md icinde "## [${pkg.version}]" basligi yok. ` +
      "Surumu artirip gunlugu yazmayi unutmak en sik yapilan sey.",
  );
}

/** 3. Bu surum icin bir etiket ZATEN varsa, surum artirilmamis demektir. */
try {
  const tags = git("tag --list").split("\n");
  if (tags.includes(`v${pkg.version}`)) {
    errors.push(
      `v${pkg.version} etiketi zaten var. Surum artirilmadan yayin, npm'de ` +
        "reddedilir ve etiket ile yayin birbirini tutmaz.",
    );
  }
} catch {
  // Etiket okunamadiysa (1. maddede zaten hata verildi) burada susuyoruz.
}

/** 4. Yayinlanacak alanlar dolu olmali. */
for (const field of ["license", "repository", "description", "files"]) {
  if (pkg[field] === undefined) errors.push(`package.json "${field}" eksik.`);
}

if (errors.length > 0) {
  console.error("\nYAYIN KAPISI KAPALI:\n");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("");
  process.exit(1);
}

/**
 * Kapi acildiktan SONRA tam CI. Sirasi bilincli: ucuz kontroller once,
 * dakikalar suren derleme sonra. Surum numarasini artirmayi unutan biri
 * testlerin bitmesini beklemek zorunda kalmasin.
 */
execSync("npm run ci", { cwd: root, stdio: "inherit" });

console.log(`\nrelease-check: ${pkg.name}@${pkg.version} yayina hazir.`);
