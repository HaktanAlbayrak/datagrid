import { defineConfig } from "tsup";

/**
 * PAKET DERLEMESI.
 *
 * `"use client"` DIREKTIFI BURADA DEGIL, `scripts/postbuild.mjs`de.
 *
 * Once `banner` ile denedim; paketleyici direktifi SESSIZCE ATTI
 * ("Module level directives cause errors when bundled ... was ignored").
 * Gerekcenin tamami o dosyada. Burada birakilan not, birinin "banner
 * eklesek yeter" diye geri donmesini engellemek icin.
 *
 * Direktif neden zorunlu:
 * Bu paket React Server Components kullanan uygulamalarda (Next App Router)
 * tuketilecek. Bir DataGrid dogasi geregi ISTEMCI bileseni: durum tutuyor,
 * olay dinliyor. Direktif olmazsa Next onu sunucuda calistirmayi dener ve
 * "useState only works in Client Components" hatasi TUKETICININ ekraninda
 * patlar -- bizim degil. Direktifi paketin icine koymak, tuketiciyi her
 * import'un basina `"use client"` yazmaktan kurtariyor.
 *
 * `splitting: false` -- bundler kod bolerse direktif ust parcaya tasinabilir
 * ve bazi parcalar direktifsiz kalir. Tek parca uretmek bu riski bitiriyor.
 *
 * `external` peer bagimliliklari: React'i paketin ICINE gomsek tuketicide
 * IKI React kopyasi olurdu -- hook'lar caliskan calismaz ("Invalid hook call").
 * tsup peerDependencies'i zaten disliyor; burada acikca yazmak niyeti belgeliyor.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["react", "react-dom", "@tanstack/react-table", "@base-ui/react"],
});
