"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  TOTAL_DIGITS,
  imageFileToDigitArt,
  renderDigitGridPng,
  type CropFocus,
  type DigitArtResult,
} from "@/lib/imageArt";

type SearchStatus = "idle" | "running" | "found" | "not_found" | "error";
type LocaleOption = "auto" | "ja" | "en" | "zh";
type Locale = Exclude<LocaleOption, "auto">;

type WorkerMessage =
  | { type: "progress"; attempts: number; probablePrimeTests: number; progress: number; currentSuffix: string }
  | { type: "found"; prime: string; suffix: string; digits: number; attempts: number; probablePrimeTests: number; gaussian: boolean }
  | { type: "not_found"; attempts: number }
  | { type: "error"; message: string };

const SUFFIX_DIGITS = 16;
const MAX_ATTEMPTS = 100_000;

const translations = {
  ja: {
    appTitle: "PrimePortrait Maker",
    title: "画像を6,000桁の素数肖像へ",
    subtitle: `写真を正方形に切り抜いて、コピペ後も正方形に近く見える${GRID_WIDTH}x${GRID_HEIGHT}の数字グリッドに変換します。`,
    language: "言語",
    auto: "自動",
    japanese: "日本語",
    english: "英語",
    chinese: "中国語",
    upload: "画像アップロード",
    crop: "切り抜き",
    cropPosition: "切り抜き位置",
    horizontal: "左右",
    vertical: "上下",
    generateCrop: "この切り抜きで数値化",
    gaussian: "Gaussian Prime",
    gaussianHelp: "ONの場合、通常の素数に加えて n mod 4 = 3 を要求します。",
    digitTone: "数字の濃淡",
    digitToneHelp: "ONでは画面表示と素数PNGで0を暗く、9を明るく描画します。コピー内容は数字だけです。",
    start: "素数探索を開始",
    retry: "再探索",
    grid: "数字グリッド",
    result: "完成した巨大整数",
    copyPlain: "改行なしコピー",
    copyWrapped: "改行付きコピー",
    savePng: "素数PNG保存",
    waiting: "待機中",
    running: "探索中",
    found: "発見",
    notFound: "未発見",
    error: "エラー",
    noImage: "画像をアップロードすると、100x60の数字ポートレートを生成します。",
    pickImageFirst: "先に画像をアップロードしてください。",
    generating: "切り抜き範囲から数字ポートレートを生成しています。",
    generated: (width: number, height: number, digits: number) => `${width}x${height} = ${digits.toLocaleString()}桁の数字ポートレートを生成しました。`,
    searchingGaussian: "Gaussian Prime条件で探索しています。",
    searchingPrime: "素数を探索しています。",
    preparing: "探索準備中: 小素数ふるいを初期化しています。",
    progress: (suffix: string, tests: number) => `探索中: suffix ${suffix} / MR ${tests.toLocaleString()}回`,
    foundGaussian: (digits: number, tests: number) => `この数は${digits.toLocaleString()}桁のGaussian Prime候補です。MR ${tests.toLocaleString()}回で見つかりました。`,
    foundPrime: (digits: number, tests: number) => `この数は${digits.toLocaleString()}桁の素数候補です。MR ${tests.toLocaleString()}回で見つかりました。`,
    reachedLimit: "探索上限に到達しました。再探索で別の候補範囲を試せます。",
    workerError: "Workerでエラーが発生しました。",
    copied: (label: string) => `${label}をクリップボードにコピーしました。`,
    plainPrime: "改行なしの巨大素数",
    wrappedPrime: "改行付きの巨大素数",
    pngSaved: "素数になった数字画像PNGを保存しました。",
    gridPlaceholder: "数値化すると数字グリッドを表示します。",
    resultPlaceholder: (digits: number) => `素数が見つかると、改行なしの${digits.toLocaleString()}桁整数がここに表示されます。`,
    wrappedPlaceholder: "同じ素数を画像グリッドと同じ幅で改行した版です。",
    mr: "Miller-Rabin",
    suffix: "Suffix",
    digits: "Digits",
  },
  en: {
    appTitle: "PrimePortrait Maker",
    title: "Turn an image into a 6,000-digit prime portrait",
    subtitle: `Crop a photo to a square and convert it into a ${GRID_WIDTH}x${GRID_HEIGHT} digit grid that stays close to square when pasted as text.`,
    language: "Language",
    auto: "Auto",
    japanese: "Japanese",
    english: "English",
    chinese: "Chinese",
    upload: "Upload image",
    crop: "Crop",
    cropPosition: "Crop position",
    horizontal: "Horizontal",
    vertical: "Vertical",
    generateCrop: "Generate from this crop",
    gaussian: "Gaussian Prime",
    gaussianHelp: "When on, the result must also satisfy n mod 4 = 3.",
    digitTone: "Digit tone",
    digitToneHelp: "When on, 0 is dark and 9 is bright in the grid and prime PNG. Copy output remains digits only.",
    start: "Start prime search",
    retry: "Search again",
    grid: "Digit grid",
    result: "Prime result",
    copyPlain: "Copy unwrapped",
    copyWrapped: "Copy wrapped",
    savePng: "Save prime PNG",
    waiting: "Idle",
    running: "Searching",
    found: "Found",
    notFound: "Not found",
    error: "Error",
    noImage: "Upload an image to generate a 100x60 digit portrait.",
    pickImageFirst: "Upload an image first.",
    generating: "Generating a digit portrait from the crop.",
    generated: (width: number, height: number, digits: number) => `Generated a ${width}x${height} digit portrait with ${digits.toLocaleString()} digits.`,
    searchingGaussian: "Searching with the Gaussian Prime condition.",
    searchingPrime: "Searching for a prime.",
    preparing: "Preparing: initializing the small-prime sieve.",
    progress: (suffix: string, tests: number) => `Searching: suffix ${suffix} / MR ${tests.toLocaleString()} tests`,
    foundGaussian: (digits: number, tests: number) => `Found a ${digits.toLocaleString()}-digit Gaussian Prime candidate after ${tests.toLocaleString()} MR tests.`,
    foundPrime: (digits: number, tests: number) => `Found a ${digits.toLocaleString()}-digit prime candidate after ${tests.toLocaleString()} MR tests.`,
    reachedLimit: "Reached the search limit. Try another range with Search again.",
    workerError: "The worker encountered an error.",
    copied: (label: string) => `Copied ${label} to the clipboard.`,
    plainPrime: "unwrapped prime",
    wrappedPrime: "wrapped prime",
    pngSaved: "Saved the prime digit PNG.",
    gridPlaceholder: "The digit grid will appear after generation.",
    resultPlaceholder: (digits: number) => `When a prime is found, the unwrapped ${digits.toLocaleString()}-digit integer appears here.`,
    wrappedPlaceholder: "The same prime wrapped to the digit grid width.",
    mr: "Miller-Rabin",
    suffix: "Suffix",
    digits: "Digits",
  },
  zh: {
    appTitle: "PrimePortrait Maker",
    title: "把图像变成6,000位素数肖像",
    subtitle: `先把照片裁成正方形，再转换成${GRID_WIDTH}x${GRID_HEIGHT}数字网格，复制粘贴后也尽量接近正方形。`,
    language: "语言",
    auto: "自动",
    japanese: "日语",
    english: "英语",
    chinese: "中文",
    upload: "上传图片",
    crop: "裁剪",
    cropPosition: "裁剪位置",
    horizontal: "左右",
    vertical: "上下",
    generateCrop: "用此裁剪生成",
    gaussian: "Gaussian Prime",
    gaussianHelp: "开启时，除了是素数，还要求 n mod 4 = 3。",
    digitTone: "数字明暗",
    digitToneHelp: "开启时，0较暗、9较亮。复制内容仍然只是数字。",
    start: "开始素数搜索",
    retry: "重新搜索",
    grid: "数字网格",
    result: "生成的巨大整数",
    copyPlain: "复制无换行",
    copyWrapped: "复制有换行",
    savePng: "保存素数PNG",
    waiting: "待机",
    running: "搜索中",
    found: "已找到",
    notFound: "未找到",
    error: "错误",
    noImage: "上传图片后会生成100x60数字肖像。",
    pickImageFirst: "请先上传图片。",
    generating: "正在从裁剪区域生成数字肖像。",
    generated: (width: number, height: number, digits: number) => `已生成${width}x${height}，共${digits.toLocaleString()}位的数字肖像。`,
    searchingGaussian: "正在按Gaussian Prime条件搜索。",
    searchingPrime: "正在搜索素数。",
    preparing: "准备中：正在初始化小素数筛。",
    progress: (suffix: string, tests: number) => `搜索中: suffix ${suffix} / MR ${tests.toLocaleString()}次`,
    foundGaussian: (digits: number, tests: number) => `找到${digits.toLocaleString()}位Gaussian Prime候选，MR测试${tests.toLocaleString()}次。`,
    foundPrime: (digits: number, tests: number) => `找到${digits.toLocaleString()}位素数候选，MR测试${tests.toLocaleString()}次。`,
    reachedLimit: "已达到搜索上限。可重新搜索其他候选范围。",
    workerError: "Worker发生错误。",
    copied: (label: string) => `已复制${label}。`,
    plainPrime: "无换行巨大素数",
    wrappedPrime: "有换行巨大素数",
    pngSaved: "已保存素数数字PNG。",
    gridPlaceholder: "生成后会显示数字网格。",
    resultPlaceholder: (digits: number) => `找到素数后，无换行的${digits.toLocaleString()}位整数会显示在这里。`,
    wrappedPlaceholder: "同一个素数，按数字网格宽度换行显示。",
    mr: "Miller-Rabin",
    suffix: "Suffix",
    digits: "Digits",
  },
} as const;

export default function Home() {
  const workerRef = useRef<Worker | null>(null);
  const [art, setArt] = useState<DigitArtResult | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [cropFocus, setCropFocus] = useState<CropFocus>({ x: 0.5, y: 0.5 });
  const [localeOption, setLocaleOption] = useState<LocaleOption>("auto");
  const [gaussian, setGaussian] = useState(false);
  const [digitTone, setDigitTone] = useState(true);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [attempts, setAttempts] = useState(0);
  const [probablePrimeTests, setProbablePrimeTests] = useState(0);
  const [progress, setProgress] = useState(0);
  const [prime, setPrime] = useState("");
  const [message, setMessage] = useState("");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9_000_000));

  const locale = useMemo(() => resolveLocale(localeOption), [localeOption]);
  const t = translations[locale];
  const gridText = useMemo(() => art?.grid.join("\n") ?? "", [art]);
  const wrappedPrime = useMemo(() => (prime ? wrapDigits(prime, GRID_WIDTH) : ""), [prime]);
  const canSearch = Boolean(art) && status !== "running";
  const displayMessage = message || t.noImage;

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  async function handleFile(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    setStatus("idle");
    setPrime("");
    setProgress(0);
    setAttempts(0);
    setProbablePrimeTests(0);
    setFileName(file.name);
    setCropFocus({ x: 0.5, y: 0.5 });
    setSourceFile(file);
    setSourceUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });

    await generateDigitArt(file, { x: 0.5, y: 0.5 });
  }

  async function generateDigitArt(file = sourceFile, focus = cropFocus): Promise<void> {
    if (!file) {
      setMessage(t.pickImageFirst);
      return;
    }

    setStatus("idle");
    setPrime("");
    setProgress(0);
    setAttempts(0);
    setProbablePrimeTests(0);
    setMessage(t.generating);

    try {
      const result = await imageFileToDigitArt(file, focus);
      setArt(result);
      setMessage(t.generated(GRID_WIDTH, GRID_HEIGHT, result.flatDigits.length));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.error);
    }
  }

  function startSearch(nextSeed = seed): void {
    if (!art) {
      setMessage(t.pickImageFirst);
      return;
    }

    workerRef.current?.terminate();
    const worker = new Worker("/prime-worker.js", { type: "module" });
    workerRef.current = worker;

    setStatus("running");
    setPrime("");
    setProgress(0);
    setAttempts(0);
    setProbablePrimeTests(0);
    setMessage(gaussian ? t.searchingGaussian : t.searchingPrime);

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      if (data.type === "progress") {
        setAttempts(data.attempts);
        setProbablePrimeTests(data.probablePrimeTests);
        setProgress(data.progress);
        setMessage(
          data.attempts === 0
            ? t.preparing
            : t.progress(data.currentSuffix, data.probablePrimeTests),
        );
      }
      if (data.type === "found") {
        setStatus("found");
        setAttempts(data.attempts);
        setProbablePrimeTests(data.probablePrimeTests);
        setProgress(1);
        setPrime(data.prime);
        setMessage(
          data.gaussian
            ? t.foundGaussian(data.digits, data.probablePrimeTests)
            : t.foundPrime(data.digits, data.probablePrimeTests),
        );
        worker.terminate();
      }
      if (data.type === "not_found") {
        setStatus("not_found");
        setAttempts(data.attempts);
        setProgress(1);
        setMessage(t.reachedLimit);
        worker.terminate();
      }
      if (data.type === "error") {
        setStatus("error");
        setMessage(data.message);
        worker.terminate();
      }
    };

    worker.onerror = (event) => {
      setStatus("error");
      setMessage(event.message || t.workerError);
      worker.terminate();
    };

    worker.postMessage({
      type: "search",
      digits: art.flatDigits,
      suffixDigits: SUFFIX_DIGITS,
      maxAttempts: MAX_ATTEMPTS,
      gaussian,
      seed: nextSeed,
    });
  }

  function retrySearch(): void {
    const nextSeed = Math.floor(Math.random() * 9_000_000_000);
    setSeed(nextSeed);
    startSearch(nextSeed);
  }

  async function copyText(text: string, label: string): Promise<void> {
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setMessage(t.copied(label));
  }

  function downloadPrimePng(): void {
    if (!wrappedPrime) {
      return;
    }

    const png = renderDigitGridPng(wrappedPrime.split("\n"), digitTone);
    const link = document.createElement("a");
    link.href = png;
    link.download = digitTone ? "primeportrait-prime-tone.png" : "primeportrait-prime-plain.png";
    link.click();
    setMessage(t.pngSaved);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-stone-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-4 shadow-2xl shadow-black/20 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-300">PrimePortrait Maker</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-stone-50 sm:text-3xl">{t.title}</h1>
            <p className="mt-2 text-sm leading-5 text-stone-300">{t.subtitle}</p>
          </div>
          <LanguageSwitch localeOption={localeOption} setLocaleOption={setLocaleOption} t={t} />
        </header>

        <div className="grid justify-center gap-5 lg:grid-cols-[300px_minmax(0,760px)]">
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 shadow-2xl shadow-black/30 backdrop-blur">

          <label className="block">
            <span className="text-sm font-medium text-stone-200">{t.upload}</span>
            <input
              className="mt-2 block w-full cursor-pointer rounded-md border border-white/10 bg-stone-900 text-sm text-stone-200 file:mr-3 file:border-0 file:bg-teal-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-950"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {fileName ? <p className="mt-2 truncate text-xs text-stone-400">{fileName}</p> : null}

          {sourceUrl ? (
            <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-stone-200">{t.cropPosition}</span>
                <span className="font-mono text-xs text-stone-500">1:1</span>
              </div>
              <div className="mt-3 mx-auto aspect-square max-h-44 overflow-hidden rounded-md border border-teal-300/30 bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-full w-full object-cover"
                  src={sourceUrl}
                  alt="Crop preview"
                  style={{ objectPosition: `${cropFocus.x * 100}% ${cropFocus.y * 100}%` }}
                />
              </div>
              <label className="mt-3 block text-xs text-stone-400">
                {t.horizontal}
                <input
                  className="mt-2 w-full accent-teal-300"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(cropFocus.x * 100)}
                  onChange={(event) => setCropFocus((focus) => ({ ...focus, x: Number(event.target.value) / 100 }))}
                />
              </label>
              <label className="mt-2 block text-xs text-stone-400">
                {t.vertical}
                <input
                  className="mt-2 w-full accent-teal-300"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(cropFocus.y * 100)}
                  onChange={(event) => setCropFocus((focus) => ({ ...focus, y: Number(event.target.value) / 100 }))}
                />
              </label>
              <button
                type="button"
                disabled={status === "running"}
                onClick={() => void generateDigitArt()}
                className="mt-3 w-full rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-stone-100 transition hover:border-teal-300/70 disabled:cursor-not-allowed disabled:text-stone-500"
              >
                {t.generateCrop}
              </button>
            </div>
          ) : null}

          <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-stone-200">{t.gaussian}</span>
              <button
                type="button"
                onClick={() => setGaussian((value) => !value)}
                className={`h-7 w-14 rounded-full border p-1 transition ${
                  gaussian ? "border-teal-300 bg-teal-300" : "border-white/15 bg-stone-800"
                }`}
                aria-pressed={gaussian}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition ${gaussian ? "translate-x-7" : "translate-x-0"}`}
                />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">{t.gaussianHelp}</p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <span className="text-sm font-medium text-stone-200">{t.digitTone}</span>
              <button
                type="button"
                onClick={() => setDigitTone((value) => !value)}
                className={`h-7 w-14 rounded-full border p-1 transition ${
                  digitTone ? "border-amber-300 bg-amber-300" : "border-white/15 bg-stone-800"
                }`}
                aria-pressed={digitTone}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition ${digitTone ? "translate-x-7" : "translate-x-0"}`}
                />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-400">{t.digitToneHelp}</p>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Metric label="Grid" value={`${GRID_WIDTH}x${GRID_HEIGHT}`} />
            <Metric label={t.suffix} value="16" />
            <Metric label={t.digits} value={TOTAL_DIGITS.toLocaleString()} />
          </dl>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button
              type="button"
              disabled={!canSearch}
              onClick={() => startSearch()}
              className="rounded-md bg-teal-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
            >
              {t.start}
            </button>
            <button
              type="button"
              disabled={!art || status === "running"}
              onClick={retrySearch}
              className="rounded-md border border-white/10 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:border-teal-300/70 disabled:cursor-not-allowed disabled:text-stone-500"
            >
              {t.retry}
            </button>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-stone-400">
              <span>{statusLabel(status, t)}</span>
              <span>{attempts.toLocaleString()} / {MAX_ATTEMPTS.toLocaleString()}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full rounded-full bg-teal-300 transition-all"
                style={{ width: `${status === "running" ? Math.max(1, progress * 100) : Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-3 min-h-10 text-sm leading-5 text-stone-300">{displayMessage}</p>
            <p className="font-mono text-xs text-stone-500">{t.mr}: {probablePrimeTests.toLocaleString()}</p>
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-100">{t.grid}</h2>
              <span className="font-mono text-xs text-stone-500">{art ? `${TOTAL_DIGITS.toLocaleString()} digits` : "waiting"}</span>
            </div>
            <DigitGrid value={gridText} tone={digitTone} heightClass="h-[420px]" placeholder={t.gridPlaceholder} />
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-100">{t.result}</h2>
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                <button
                  type="button"
                  disabled={!prime}
                  onClick={() => void copyText(prime, t.plainPrime)}
                  className="rounded-md bg-stone-100 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
                >
                  {t.copyPlain}
                </button>
                <button
                  type="button"
                  disabled={!wrappedPrime}
                  onClick={() => void copyText(wrappedPrime, t.wrappedPrime)}
                  className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-stone-100 transition hover:border-teal-300/70 disabled:cursor-not-allowed disabled:text-stone-500"
                >
                  {t.copyWrapped}
                </button>
                <button
                  type="button"
                  disabled={!wrappedPrime}
                  onClick={downloadPrimePng}
                  className="rounded-md border border-amber-300/40 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-stone-500"
                >
                  {t.savePng}
                </button>
              </div>
            </div>
            <textarea
              className="digit-grid h-44 w-full rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-5 text-teal-100 outline-none focus:border-teal-300/70"
              value={prime}
              readOnly
              placeholder={t.resultPlaceholder(TOTAL_DIGITS)}
              spellCheck={false}
            />
            <div className="mt-3">
              <DigitGrid value={wrappedPrime} tone={digitTone} heightClass="h-52" placeholder={t.wrappedPlaceholder} />
            </div>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-2 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-stone-100">{value}</dd>
    </div>
  );
}

function LanguageSwitch({
  localeOption,
  setLocaleOption,
  t,
}: {
  localeOption: LocaleOption;
  setLocaleOption: (value: LocaleOption) => void;
  t: (typeof translations)[Locale];
}) {
  const options: Array<{ value: LocaleOption; label: string }> = [
    { value: "auto", label: t.auto },
    { value: "ja", label: "日本語" },
    { value: "en", label: "EN" },
    { value: "zh", label: "中文" },
  ];

  return (
    <div className="w-full shrink-0 sm:w-auto">
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-stone-500 sm:text-right">{t.language}</div>
      <div className="grid grid-cols-4 overflow-hidden rounded-md border border-white/10 bg-black/30 sm:flex">
        {options.map((option) => {
          const active = localeOption === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLocaleOption(option.value)}
              className={`min-h-9 px-2 text-xs font-semibold transition sm:px-3 ${
                active ? "bg-teal-300 text-zinc-950" : "text-stone-300 hover:bg-white/10 hover:text-stone-50"
              }`}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DigitGrid({
  value,
  tone,
  heightClass,
  placeholder,
}: {
  value: string;
  tone: boolean;
  heightClass: string;
  placeholder: string;
}) {
  const rows = value.split("\n");

  return (
    <div
      className={`digit-grid ${heightClass} w-full overflow-auto rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[7px] leading-[1.05]`}
      aria-label={placeholder}
    >
      {value ? (
        <pre className="m-0 select-text whitespace-pre font-mono">
          {rows.map((row, rowIndex) => (
            <span key={rowIndex}>
              {Array.from(row).map((digit, digitIndex) => (
                <span key={`${rowIndex}-${digitIndex}`} style={{ color: tone ? digitColor(digit) : "#fef3c7" }}>
                  {digit}
                </span>
              ))}
              {rowIndex < rows.length - 1 ? "\n" : null}
            </span>
          ))}
        </pre>
      ) : (
        <div className="grid h-full place-items-center text-sm text-stone-500">{placeholder}</div>
      )}
    </div>
  );
}

function statusLabel(status: SearchStatus, t: (typeof translations)[Locale]): string {
  if (status === "running") return t.running;
  if (status === "found") return t.found;
  if (status === "not_found") return t.notFound;
  if (status === "error") return t.error;
  return t.waiting;
}

function wrapDigits(value: string, width: number): string {
  const rows: string[] = [];
  for (let index = 0; index < value.length; index += width) {
    rows.push(value.slice(index, index + width));
  }
  return rows.join("\n");
}

function digitColor(digit: string): string {
  const value = Number(digit);
  if (!Number.isFinite(value)) {
    return "#fef3c7";
  }
  return `hsl(42 72% ${18 + value * 7}%)`;
}

function resolveLocale(option: LocaleOption): Locale {
  if (option !== "auto") {
    return option;
  }

  if (typeof navigator === "undefined") {
    return "ja";
  }

  const language = navigator.language.toLowerCase();
  if (language.startsWith("zh")) {
    return "zh";
  }
  if (language.startsWith("en")) {
    return "en";
  }
  return "ja";
}
