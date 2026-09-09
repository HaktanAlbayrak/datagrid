import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind sinifi birlestirici.
 *
 * `twMerge` sart, duz `clsx` YETMEZ: tuketici `className="p-4"` gecerse ve
 * bizim varsayilanimiz `p-2` ise ikisi de HTML'e yazilir ve kazanani CSS
 * dosyasindaki SIRA belirler -- yani tuketici kendi degerinin gecerli olacagini
 * garanti edemez. `twMerge` catisan yardimci siniflari cozup sonuncuyu birakiyor.
 *
 * Bir KUTUPHANEDE bu daha da kritik: tuketicinin her stil ezmesi calismak
 * zorunda, yoksa bilesen "kapali kutu" olur ve ilk ozel istekte atilir.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
