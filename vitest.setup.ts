import "@testing-library/jest-dom/vitest";

/**
 * `scrollIntoView` POLYFILL -- jsdom'da YOK.
 *
 * jsdom bir YERLESIM (layout) motoru calistirmiyor: hicbir seyin gercek
 * konumu ya da boyutu yok, dolayisiyla "gorunur alana kaydir" tanimsiz bir
 * istek. jsdom bu yuzden metodu hic tanimlamiyor, `undefined` birakiyor.
 *
 * Klavye gezinmesi her odak degisiminde bunu cagirdigi icin testler
 * `cell.scrollIntoView is not a function` ile patliyordu.
 *
 * Cozum ureti koda `typeof ... === "function"` korumasi koymak DEGIL:
 * tarayicida her zaman var olan bir seyi her cagrida sorgulamak, uretim
 * kodunu test ortaminin eksigine gore sekillendirmek olurdu. Eksik olan
 * ortam; yamayi ortam alir.
 */
Element.prototype.scrollIntoView ??= () => {};
