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

type WorkerMessage =
  | { type: "progress"; attempts: number; probablePrimeTests: number; progress: number; currentSuffix: string }
  | { type: "found"; prime: string; suffix: string; digits: number; attempts: number; probablePrimeTests: number; gaussian: boolean }
  | { type: "not_found"; attempts: number }
  | { type: "error"; message: string };

const SUFFIX_DIGITS = 16;
const MAX_ATTEMPTS = 100_000;

export default function Home() {
  const workerRef = useRef<Worker | null>(null);
  const [art, setArt] = useState<DigitArtResult | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [cropFocus, setCropFocus] = useState<CropFocus>({ x: 0.5, y: 0.5 });
  const [gaussian, setGaussian] = useState(false);
  const [digitTone, setDigitTone] = useState(true);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [attempts, setAttempts] = useState(0);
  const [probablePrimeTests, setProbablePrimeTests] = useState(0);
  const [progress, setProgress] = useState(0);
  const [prime, setPrime] = useState("");
  const [message, setMessage] = useState("画像をアップロードすると、100x60の数字ポートレートを生成します。");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9_000_000));

  const gridText = useMemo(() => art?.grid.join("\n") ?? "", [art]);
  const wrappedPrime = useMemo(() => (prime ? wrapDigits(prime, GRID_WIDTH) : ""), [prime]);
  const canSearch = Boolean(art) && status !== "running";

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
      setMessage("先に画像をアップロードしてください。");
      return;
    }

    setStatus("idle");
    setPrime("");
    setProgress(0);
    setAttempts(0);
    setProbablePrimeTests(0);
    setMessage("切り抜き範囲から数字ポートレートを生成しています。");

    try {
      const result = await imageFileToDigitArt(file, focus);
      setArt(result);
      setMessage(`${GRID_WIDTH}x${GRID_HEIGHT} = ${result.flatDigits.length.toLocaleString()}桁の数字ポートレートを生成しました。`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "画像処理に失敗しました。");
    }
  }

  function startSearch(nextSeed = seed): void {
    if (!art) {
      setMessage("先に画像をアップロードしてください。");
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
    setMessage(gaussian ? "Gaussian Prime条件で探索しています。" : "素数を探索しています。");

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      if (data.type === "progress") {
        setAttempts(data.attempts);
        setProbablePrimeTests(data.probablePrimeTests);
        setProgress(data.progress);
        setMessage(
          data.attempts === 0
            ? "探索準備中: 小素数ふるいを初期化しています。"
            : `探索中: suffix ${data.currentSuffix} / MR ${data.probablePrimeTests.toLocaleString()}回`,
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
            ? `この数は${data.digits.toLocaleString()}桁のGaussian Prime候補です。MR ${data.probablePrimeTests.toLocaleString()}回で見つかりました。`
            : `この数は${data.digits.toLocaleString()}桁の素数候補です。MR ${data.probablePrimeTests.toLocaleString()}回で見つかりました。`,
        );
        worker.terminate();
      }
      if (data.type === "not_found") {
        setStatus("not_found");
        setAttempts(data.attempts);
        setProgress(1);
        setMessage("探索上限に到達しました。再探索で別の候補範囲を試せます。");
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
      setMessage(event.message || "Workerでエラーが発生しました。");
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
    setMessage(`${label}をクリップボードにコピーしました。`);
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
    setMessage("素数になった数字画像PNGを保存しました。");
  }

  return (
    <main className="min-h-screen px-4 py-5 text-stone-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="mb-5">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-300">PrimePortrait Maker</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-stone-50">画像を6,000桁の素数肖像へ</h1>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              写真を正方形に切り抜いて、コピペ後も正方形に近く見える{GRID_WIDTH}x{GRID_HEIGHT}の数字グリッドに変換します。
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-stone-200">画像アップロード</span>
            <input
              className="mt-2 block w-full cursor-pointer rounded-md border border-white/10 bg-stone-900 text-sm text-stone-200 file:mr-3 file:border-0 file:bg-teal-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-950"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {fileName ? <p className="mt-2 truncate text-xs text-stone-400">{fileName}</p> : null}

          {sourceUrl ? (
            <div className="mt-5 rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-stone-200">切り抜き位置</span>
                <span className="font-mono text-xs text-stone-500">1:1</span>
              </div>
              <div className="mt-3 mx-auto aspect-square max-h-72 overflow-hidden rounded-md border border-teal-300/30 bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-full w-full object-cover"
                  src={sourceUrl}
                  alt="Crop preview"
                  style={{ objectPosition: `${cropFocus.x * 100}% ${cropFocus.y * 100}%` }}
                />
              </div>
              <label className="mt-3 block text-xs text-stone-400">
                左右
                <input
                  className="mt-2 w-full accent-teal-300"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(cropFocus.x * 100)}
                  onChange={(event) => setCropFocus((focus) => ({ ...focus, x: Number(event.target.value) / 100 }))}
                />
              </label>
              <label className="mt-3 block text-xs text-stone-400">
                上下
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
                この切り抜きで数値化
              </button>
            </div>
          ) : null}

          <div className="mt-5 rounded-md border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-stone-200">Gaussian Prime</span>
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
            <p className="mt-2 text-xs leading-5 text-stone-400">ONの場合、通常の素数に加えて n mod 4 = 3 を要求します。</p>
          </div>

          <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-stone-200">数字の濃淡</span>
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
            <p className="mt-2 text-xs leading-5 text-stone-400">ONでは画面表示と素数PNGで0を暗く、9を明るく描画します。コピー内容は数字だけです。</p>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Metric label="Grid" value={`${GRID_WIDTH}x${GRID_HEIGHT}`} />
            <Metric label="Suffix" value="16桁" />
            <Metric label="Digits" value={TOTAL_DIGITS.toLocaleString()} />
          </dl>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              disabled={!canSearch}
              onClick={() => startSearch()}
              className="rounded-md bg-teal-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
            >
              素数探索を開始
            </button>
            <button
              type="button"
              disabled={!art || status === "running"}
              onClick={retrySearch}
              className="rounded-md border border-white/10 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:border-teal-300/70 disabled:cursor-not-allowed disabled:text-stone-500"
            >
              再探索
            </button>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-stone-400">
              <span>{statusLabel(status)}</span>
              <span>{attempts.toLocaleString()} / {MAX_ATTEMPTS.toLocaleString()}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full rounded-full bg-teal-300 transition-all"
                style={{ width: `${status === "running" ? Math.max(1, progress * 100) : Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-3 min-h-10 text-sm leading-5 text-stone-300">{message}</p>
            <p className="font-mono text-xs text-stone-500">Miller-Rabin: {probablePrimeTests.toLocaleString()}回</p>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-100">数字グリッド</h2>
              <span className="font-mono text-xs text-stone-500">{art ? `${TOTAL_DIGITS.toLocaleString()} digits` : "waiting"}</span>
            </div>
            <DigitGrid value={gridText} tone={digitTone} heightClass="h-[460px]" placeholder="数値化すると数字グリッドを表示します。" />
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-100">完成した巨大整数</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!prime}
                  onClick={() => void copyText(prime, "改行なしの巨大素数")}
                  className="rounded-md bg-stone-100 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
                >
                  改行なしコピー
                </button>
                <button
                  type="button"
                  disabled={!wrappedPrime}
                  onClick={() => void copyText(wrappedPrime, "改行付きの巨大素数")}
                  className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-stone-100 transition hover:border-teal-300/70 disabled:cursor-not-allowed disabled:text-stone-500"
                >
                  改行付きコピー
                </button>
                <button
                  type="button"
                  disabled={!wrappedPrime}
                  onClick={downloadPrimePng}
                  className="rounded-md border border-amber-300/40 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-stone-500"
                >
                  素数PNG保存
                </button>
              </div>
            </div>
            <textarea
              className="digit-grid h-44 w-full rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-5 text-teal-100 outline-none focus:border-teal-300/70"
              value={prime}
              readOnly
              placeholder={`素数が見つかると、改行なしの${TOTAL_DIGITS.toLocaleString()}桁整数がここに表示されます。`}
              spellCheck={false}
            />
            <div className="mt-3">
              <DigitGrid value={wrappedPrime} tone={digitTone} heightClass="h-56" placeholder="同じ素数を画像グリッドと同じ幅で改行した版です。" />
            </div>
          </div>
        </section>
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

function statusLabel(status: SearchStatus): string {
  if (status === "running") return "探索中";
  if (status === "found") return "発見";
  if (status === "not_found") return "未発見";
  if (status === "error") return "エラー";
  return "待機中";
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
