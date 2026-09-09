import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Tembel agac secenekleri.
 *
 * Kancanin tuketicinin veri TIPI hakkinda bildigi hicbir sey yok; ihtiyaci
 * olan uc sey de FONKSIYON olarak disaridan geliyor. Kimlik alaninin adini
 * dayatmak (`id` diye) tuketiciyi veri modelini degistirmeye zorlardi.
 */
export interface UseLazyTreeOptions<TData> {
  /**
   * Bir dugumun cocuklarini getirir. Kok icin `null` geliyor.
   *
   * `Promise` reddederse satir "yukleniyor" durumunda BIRAKILMIYOR --
   * hata isaretleniyor ve ok yeniden denenebilir hale geliyor.
   */
  loadChildren: (parent: TData | null) => Promise<TData[]>;
  getRowId: (row: TData) => string;
  /**
   * Bu dugumun cocugu VAR MI? (yuklenmeden once bilinmesi gereken sey)
   *
   * ---
   * NEDEN SUNUCUDAN GELMEK ZORUNDA?
   *
   * Tembel agacta cocuklar yuklenene kadar `subRows` bos. "Bos ise ok
   * cizme" deseydik hicbir dugum acilamazdi -- ok yok, tiklama yok,
   * yukleme yok. Kilitlenme.
   *
   * Bu yuzden "cocugu var mi" bilgisi VERIYLE gelmeli: sunucu sayimi
   * zaten biliyor (`_count`), istemcinin tahmin etmesi imkansiz.
   */
  hasChildren: (row: TData) => boolean;
  onError?: (error: unknown, parent: TData | null) => void;
}

interface TreeState<TData> {
  /** Kok satirlar. */
  rows: TData[];
  /** `parentId -> cocuklar`. Yuklenmis dugumler burada. */
  childrenById: Record<string, TData[]>;
}

/**
 * TEMBEL AGAC: cocuklar ACILDIGINDA yukleniyor (Faz 3).
 *
 * ---
 * NEDEN GEREKLI?
 *
 * Bir agac izgarasinda tum agaci bastan cekmek, kullanicinin ACMADIGI her
 * dali da indirmek demek. 200 panonun her birinde 8 kolon ve kolon basina
 * 300 kart varsa ilk istek yarim milyon kayit doner -- kullanici belki
 * ikisine bakacakken.
 *
 * Tembel yukleme her dali yalnizca ilk acilista getiriyor.
 *
 * ---
 * BIR KEZ YUKLENIYOR, KAPATIP ACMAK YENIDEN CEKMIYOR.
 *
 * Onbellek olmasaydi kullanici bir dali kapatip actiginda ayni istek
 * tekrar giderdi. Agacta gezinmek dogal olarak "ac-kapa-ac" bicimindedir;
 * her acilista ag turu, hem yavas hem gereksiz. Tazelemek isteyen
 * `invalidate()` cagiriyor.
 */
export function useLazyTree<TData>({
  loadChildren,
  getRowId,
  hasChildren,
  onError,
}: UseLazyTreeOptions<TData>) {
  const [state, setState] = useState<TreeState<TData>>({
    rows: [],
    childrenById: {},
  });
  const [isLoadingRoot, setIsLoadingRoot] = useState(true);

  /** Su an yuklenen dugumler -- ok yerine donen halka. */
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** Yuklemesi BASARISIZ olan dugumler. */
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  /*
    `loadChildren` ve `onError` REF'te.

    Tuketici bunlari cogu zaman render icinde tanimliyor (satir ici ok
    fonksiyonu). Bagimlilik listesine koysaydik her render yeni bir
    referans olur ve kok yukleme sonsuz donerdi.
  */
  const loadRef = useRef(loadChildren);
  loadRef.current = loadChildren;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const idRef = useRef(getRowId);
  idRef.current = getRowId;
  /*
    `hasChildren` de REF'te ve sebebi ayni: tuketici bunu neredeyse her
    zaman satir ici ok fonksiyonu olarak yaziyor. Bagimlilik listesinde
    olsaydi asagidaki `ensureLoaded` her render'da yeni bir referans olur,
    onu izleyen etki de her render'da kosardi.
  */
  const hasChildrenRef = useRef(hasChildren);
  hasChildrenRef.current = hasChildren;

  /** Kok satirlari getiriyor. */
  const loadRoot = useCallback(async () => {
    setIsLoadingRoot(true);
    try {
      const rows = await loadRef.current(null);
      setState({ rows, childrenById: {} });
    } catch (error) {
      errorRef.current?.(error, null);
    } finally {
      setIsLoadingRoot(false);
    }
  }, []);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  /**
   * Bir dugumun cocuklarini yukler.
   *
   * ---
   * AYNI ANDA ACILAN DUGUMLER BIRBIRINI EZMIYOR.
   *
   * Kullanici uc dali hizla acabiliyor ve uc istek paralel donuyor.
   * Durumu `childrenById` sozlugunde ANAHTARLA tuttugumuz icin her cevap
   * yalnizca kendi anahtarini yaziyor. Agaci derin kopyalayip yerinde
   * degistirseydik, gec donen cevap erken donenin yazdigini silerdi --
   * belirtisi "bazen acilan dal bos kaliyor" olurdu ve yeniden uretmesi
   * neredeyse imkansiz.
   */
  const loadNode = useCallback(async (row: TData) => {
    const id = idRef.current(row);

    setFailedIds((old) => {
      if (!old.has(id)) return old;
      const next = new Set(old);
      next.delete(id);
      return next;
    });
    setLoadingIds((old) => new Set(old).add(id));

    try {
      const children = await loadRef.current(row);
      setState((old) => ({
        ...old,
        childrenById: { ...old.childrenById, [id]: children },
      }));
    } catch (error) {
      /*
        HATA "SONSUZ YUKLENIYOR" DEGIL, ISARETLI BIR DURUM.

        Bayragi temizlemeseydik ok kalici olarak donen halka olarak kalir
        ve kullanici ne oldugunu anlamadan bekler. Isaretli dugum `retry()`
        ile yeniden denenebiliyor.
      */
      setFailedIds((old) => new Set(old).add(id));
      errorRef.current?.(error, row);
    } finally {
      setLoadingIds((old) => {
        const next = new Set(old);
        next.delete(id);
        return next;
      });
    }
  }, []);

  /**
   * "Su anda ACIK olan satirlar bunlar" -- eksik olanlari yukler.
   *
   * ---
   * NEDEN "acildi" OLAYI DEGIL DE "acik olanlarin listesi"?
   *
   * Olay dinlemek daha dogal gorunuyor ama kirilgan: bir satir programatik
   * olarak (durum geri yuklenerek, `expandAll` ile, ya da bir baglantidan
   * gelinerek) acilabiliyor ve o yollarin hicbiri "tiklama" olayi
   * uretmiyor. O durumlarda dal acik gorunur ama BOS kalirdi.
   *
   * Mevcut durumu bildirmek bu yollarin HEPSINI kapsiyor. Fonksiyon
   * fikirsiz (idempotent): yuklenmis, yuklenmekte olan ve cocugu olmayan
   * dugumleri atliyor, dolayisiyla her genisletme degisikliginde
   * cagirilabiliyor.
   *
   * `expanded` durumunun sahibi TABLO; bu kanca onu yonetmiyor, yalnizca
   * izliyor. Aksi halde iki yerde iki ayri "acik mi?" gercegi olurdu.
   */
  const ensureLoaded = useCallback(
    (expandedRows: TData[]) => {
      for (const row of expandedRows) {
        const id = idRef.current(row);
        if (state.childrenById[id] !== undefined) continue;
        if (loadingIds.has(id)) continue;
        /*
          BASARISIZ DUGUM OTOMATIK YENIDEN DENENMIYOR.

          Denenseydi sunucu hatasi surerken dongu olusurdu: dal acik ->
          yukle -> hata -> durum degisti -> `ensureLoaded` yeniden kostu ->
          yukle... Saniyede onlarca istek, ustelik zaten hata veren bir uca.

          Yeniden deneme ACIK bir eylem: `retry(row)`.
        */
        if (failedIds.has(id)) continue;
        if (!hasChildrenRef.current(row)) continue;
        void loadNode(row);
      }
    },
    [state.childrenById, loadingIds, failedIds, loadNode],
  );

  /** Basarisiz bir dugumu yeniden dener. */
  const retry = useCallback(
    (row: TData) => {
      void loadNode(row);
    },
    [loadNode],
  );

  /** Bir dugumun onbellegini atar; sonraki acilista yeniden yukleniyor. */
  const invalidate = useCallback((row?: TData) => {
    if (row === undefined) {
      setState((old) => ({ ...old, childrenById: {} }));
      return;
    }
    const id = idRef.current(row);
    setState((old) => {
      const { [id]: _dropped, ...rest } = old.childrenById;
      return { ...old, childrenById: rest };
    });
  }, []);

  /**
   * TanStack'in `getSubRows`una verilecek fonksiyon.
   *
   * Yuklenmemis dugum icin `undefined` donuyor -- BOS DIZI DEGIL. Fark
   * onemli: bos dizi "cocugu yok" demek ve TanStack satiri yaprak sayar.
   */
  const getSubRows = useCallback(
    (row: TData): TData[] | undefined => state.childrenById[idRef.current(row)],
    [state.childrenById],
  );

  /**
   * TanStack'in `getRowCanExpand`ina DOGRUDAN verilebilen fonksiyon.
   *
   * ---
   * PARAMETRE `TData` DEGIL, TanStack SATIRI -- ve bu bilincli.
   *
   * OLCULEN TUZAK: once `(row: TData)` yazmistim. TanStack bu geri cagirimi
   * `Row` nesnesiyle cagiriyor; `Row`un da bir `.id` alani oldugu icin
   * kimlik okumasi CALISIYOR gorunuyordu, ama `hasChildren(row)` icindeki
   * `row.childCount` `undefined` donuyordu. Sonuc: HICBIR dugumde acma oku
   * cizilmiyordu ve hicbir hata da yoktu.
   *
   * Tipin `TData` olmasi cagiran tarafa `(row) => lazy.getRowCanExpand(
   * row.original)` yazdirirdi -- ve unutuldugu gun ayni sessiz hata.
   * Sarmalamayi kancanin icine almak o kapiyi kapatiyor.
   *
   * ---
   * "COCUGU VAR" DEDI AMA BOS DONDU -- BU DURUM DA ELE ALINIYOR.
   *
   * Sunucunun sayimi bayat olabiliyor (arada silinmis olabilir) ya da
   * erisim kisiti yuzunden gorunur cocuk kalmamis olabilir. Yuklendikten
   * SONRA hala ok cizseydik kullanici tiklar, hicbir sey acilmaz ve tekrar
   * tiklar -- calismayan bir dugme. Ok KAYBOLUYOR: dugum artik yaprak.
   */
  const getRowCanExpand = useCallback(
    (row: { original: TData }): boolean => {
      const data = row.original;
      const loaded = state.childrenById[idRef.current(data)];
      if (loaded !== undefined) return loaded.length > 0;
      return hasChildrenRef.current(data);
    },
    [state.childrenById],
  );

  /*
    COCUKLAR YUKLENINCE `rows` YENI BIR REFERANS OLUYOR.

    OLCULEN HATA: cocuklar geliyordu, `getSubRows` dogru diziyi donduruyordu
    ama EKRANDA hicbir sey degismiyordu. Sebep: TanStack'in cekirdek satir
    modeli `data` REFERANSINA gore onbellekleniyor. Kok dizi ayni kaldigi
    icin model yeniden hesaplanmiyor ve `getSubRows` hic yeniden
    cagirilmiyordu.

    Cocuklari `data`nin icine gomup agaci elle kurmak da bir cozumdu ama
    tuketicinin veri tipini degistirmeyi gerektirirdi (`children` alani).
    Yeni bir dizi referansi uretmek, ayni sonucu tipe dokunmadan veriyor:
    "veri degisti" sinyali dogru sinyal, cunku gercekten degisti.
  */
  // `childrenById` govdede OKUNMUYOR ama bagimlilikta olmak ZORUNDA: amaci
  // deger uretmek degil, "veri degisti" sinyalini tetiklemek. Linter
  // kullanimini goremedigi icin "gereksiz" diyor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: childrenById bir tetikleyici; kaldırılırsa yüklenen çocuklar ekrana hiç gelmez
  const rows = useMemo(() => [...state.rows], [state.rows, state.childrenById]);

  return {
    rows,
    isLoadingRoot,
    getSubRows,
    getRowCanExpand,
    ensureLoaded,
    retry,
    invalidate,
    reloadRoot: loadRoot,
    isLoadingNode: useCallback(
      (row: TData) => loadingIds.has(idRef.current(row)),
      [loadingIds],
    ),
    hasFailed: useCallback(
      (row: TData) => failedIds.has(idRef.current(row)),
      [failedIds],
    ),
  };
}
