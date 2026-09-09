import { defineConfig } from "vitest/config";

/**
 * TEK ORTAM: jsdom.
 *
 * Once dosya desenine gore ikiye bolmustum (`.test.ts` -> node, `.test.tsx`
 * -> jsdom) ama `environmentMatchGlobs` Vitest 5'te KALDIRILDI; karsiligi
 * `projects` ile iki ayri proje tanimlamak. Bu paketin testlerinin cogu
 * bilesen testi oldugu icin o ek yapiyi tasimak kazandirdigindan pahali --
 * hepsi jsdom'da kosuyor.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
