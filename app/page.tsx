"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { imageFileToDigitArt, renderDigitGridPng, type DigitArtResult } from "@/lib/imageArt";

type SearchStatus = "idle" | "running" | "found" | "not_found" | "error";

type WorkerMessage =
  | { type: "progress"; attempts: number; progress: number; currentSuffix: string }
  | { type: "found"; prime: string; suffix: string; digits: number; attempts: number; gaussian: boolean }
  | { type: "not_found"; attempts: number }
  | { type: "error"; message: string };

const GRID_SIZE = 100;
const SUFFIX_DIGITS = 16;
const MAX_ATTEMPTS = 100_000;

export default function Home() {
  const workerRef = useRef<Worker | null>(null);
  const [art, setArt] = useState<DigitArtResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [gaussian, setGaussian] = useState(false);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [attempts, setAttempts] = useState(0);
  const [progress, setProgress] = useState(0);
  const [prime, setPrime] = useState("");
  const [message, setMessage] = useState("画像をアップロードすると、100x100の数字ポートレートを生成します。");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9_000_000));
  const [pngUrl, setPngUrl] = useState("");

  const gridText = useMemo(() => art?.grid.join("\n") ?? "", [art]);
  const canSearch = Boolean(art) && status !== "running";

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  async function handleFile(file: File | null): Promise<void> {
    if (!file) {
      return;
    }

    setStatus("idle");
    setPrime("");
    setProgress(0);
    setAttempts(0);
    setPngUrl("");
    setFileName(file.name);
    setMessage("画像を解析しています。");

    try {
      const result = await imageFileToDigitArt(file);
      setArt(result);
      setPngUrl(renderDigitGridPng(result.grid));
      setMessage(`${GRID_SIZE}x${GRID_SIZE} = ${result.flatDigits.length.toLocaleString()}桁の数字ポートレートを生成しました。`);
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
    setMessage(gaussian ? "Gaussian Prime条件で探索しています。" : "素数を探索しています。");

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      if (data.type === "progress") {
        setAttempts(data.attempts);
        setProgress(data.progress);
        setMessage(`探索中: suffix ${data.currentSuffix}`);
      }
      if (data.type === "found") {
        setStatus("found");
        setAttempts(data.attempts);
        setProgress(1);
        setPrime(data.prime);
        setMessage(
          data.gaussian
            ? `この数は${data.digits.toLocaleString()}桁のGaussian Prime候補です。`
            : `この数は${data.digits.toLocaleString()}桁の素数です。`,
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

  async function copyPrime(): Promise<void> {
    if (!prime) {
      return;
    }
    await navigator.clipboard.writeText(prime);
    setMessage("巨大素数をクリップボードにコピーしました。");
  }

  return (
    <main className="min-h-screen px-4 py-5 text-stone-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="mb-5">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-300">PrimePortrait Maker</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-stone-50">画像を10,000桁の素数肖像へ</h1>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              正方形に切り出した画像を100x100の数字グリッドに変換し、右下の16桁だけを動かして巨大素数を探します。
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

          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Metric label="Grid" value="100x100" />
            <Metric label="Suffix" value="16桁" />
            <Metric label="Limit" value="100k" />
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
              <div className="h-full rounded-full bg-teal-300 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-3 min-h-10 text-sm leading-5 text-stone-300">{message}</p>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
              <h2 className="text-sm font-semibold text-stone-100">入力プレビュー</h2>
              <div className="mt-3 aspect-square overflow-hidden rounded-md border border-white/10 bg-black/30">
                {art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="h-full w-full object-cover" src={art.previewUrl} alt="Uploaded image preview" />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center text-sm text-stone-500">JPG/PNGを選択</div>
                )}
              </div>
              {pngUrl ? (
                <a
                  href={pngUrl}
                  download="primeportrait-digits.png"
                  className="mt-3 block rounded-md border border-white/10 px-3 py-2 text-center text-sm font-semibold text-stone-100 transition hover:border-teal-300/70"
                >
                  PNGをダウンロード
                </a>
              ) : null}
            </div>

            <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-stone-100">数字グリッド</h2>
                <span className="font-mono text-xs text-stone-500">{art ? "10,000 digits" : "waiting"}</span>
              </div>
              <textarea
                className="digit-grid h-[360px] w-full rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[7px] leading-[1.05] text-amber-100 outline-none focus:border-teal-300/70"
                value={gridText}
                readOnly
                spellCheck={false}
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-100">完成した巨大整数</h2>
              <button
                type="button"
                disabled={!prime}
                onClick={() => void copyPrime()}
                className="rounded-md bg-stone-100 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
              >
                コピー
              </button>
            </div>
            <textarea
              className="digit-grid h-44 w-full rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-5 text-teal-100 outline-none focus:border-teal-300/70"
              value={prime}
              readOnly
              placeholder="素数が見つかると、改行なしの10,000桁整数がここに表示されます。"
              spellCheck={false}
            />
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

function statusLabel(status: SearchStatus): string {
  if (status === "running") return "探索中";
  if (status === "found") return "発見";
  if (status === "not_found") return "未発見";
  if (status === "error") return "エラー";
  return "待機中";
}
