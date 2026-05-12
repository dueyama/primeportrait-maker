"use client";

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  TOTAL_DIGITS,
  digitToneColor,
  imageFileToDigitArt,
  renderDigitGridPng,
  type CropFocus,
  type DigitArtResult,
} from "@/lib/imageArt";

type SearchStatus = "idle" | "running" | "found" | "not_found" | "cancelled" | "error";
type LocaleOption = "auto" | "ja" | "en" | "fr" | "zh";
type Locale = Exclude<LocaleOption, "auto">;
type SourceSize = { width: number; height: number };

type WorkerMessage =
  | { type: "progress"; attempts: number; probablePrimeTests: number; progress: number; currentSuffix: string }
  | { type: "found"; prime: string; suffix: string; digits: number; attempts: number; probablePrimeTests: number; gaussian: boolean }
  | { type: "not_found"; attempts: number }
  | { type: "cancelled"; attempts: number; probablePrimeTests: number }
  | { type: "error"; message: string };

const SUFFIX_DIGITS = 16;
const MAX_ATTEMPTS = 100_000;
const TOTAL_DIGITS_LABEL = TOTAL_DIGITS.toLocaleString("en-US");
const APP_VERSION = "Ver. 2.5";
const GITHUB_URL = "https://github.com/dueyama/primeportrait-maker";

const translations = {
  ja: {
    appTitle: "PrimePortrait Maker",
    title: `画像を${TOTAL_DIGITS_LABEL}桁の確率的素数肖像へ`,
    subtitle: `写真を正方形に切り抜いて、コピペ後も正方形に近く見える${GRID_WIDTH}x${GRID_HEIGHT}の数字グリッドに変換します。`,
    language: "言語",
    auto: "自動",
    japanese: "日本語",
    english: "英語",
    chinese: "中国語",
    stepImage: "画像",
    stepDigits: "数字",
    stepPrime: "素数探索",
    outputTitle: "デジタルポートレート",
    outputMeta: "数字の濃淡: 0-9",
    howItWorksTitle: "仕組み",
    howItWorksBody: `画像はこのブラウザ内で正方形に切り抜き、${GRID_WIDTH}x${GRID_HEIGHT}個の明度を数字に変換します。先頭は桁数維持のため必ず0以外にし、探索では上位桁を固定して最後の${SUFFIX_DIGITS}桁だけを変えます。結果は証明済み素数ではなく、Miller-Rabinとstrong Lucasを通った確率的素数候補です。まれに本当は素数でない場合があります。`,
    localProcessingTitle: "素数探索の仕組み",
    localProcessingBody: `上位桁を固定し、最後の${SUFFIX_DIGITS}桁だけを変えて素数候補を探します。候補はMiller-Rabinを通った後、Selfridge型strong Lucas probable prime testを1回追加で通します。処理はこの端末のブラウザ内で実行します。`,
    primeTestPipeline: "判定: 小素数ふるい -> Miller-Rabin bases 2,3,5,7 -> strong Lucas後段チェック。LucasはMRを通った候補だけに実行します。",
    moreDetails: "詳しくは",
    close: "閉じる",
    versionHistoryTitle: "バージョン遍歴",
    versionHistoryIntro: "メジャー番号はワークフローや素数候補の意味が変わった節目、マイナー番号は同じ流れの中での機能・表示・出力の改善を表します。",
    primeDetailTitle: "素数探索の詳しい仕組み",
    primeDetailIntro: "画像から作った数字列を改行なしの巨大整数として扱い、画像として重要な上位桁は固定したまま、末尾だけを差し替えて素数になる候補を探します。",
    primeDetailSteps: [
      "数字グリッドを1本の10進文字列に連結し、ブラウザのBigIntで扱います。",
      `画像の見た目を崩さないため、上位桁は固定し、最後の${SUFFIX_DIGITS}桁だけを変更します。`,
      "探索開始位置は元の末尾にランダムseedを足した周辺から始めます。再探索すると別の範囲を試します。",
      "偶数終端と5終端は素数にならないので即座に飛ばします。",
      "さらに997以下の小素数で割り切れる候補をふるい落とします。",
      "残った候補だけをMiller-Rabinで判定します。現在の基数は2, 3, 5, 7です。",
      "Miller-Rabinを通った候補だけに、Selfridge型のstrong Lucas probable prime testを追加で実行します。",
      "Miller-RabinとLucasは確率的判定です。落ちた候補は確実に合成数ですが、通った候補は数学的に証明済みの素数ではなく、強い素数候補です。つまり、素数でない場合があります。",
      "Gaussian Primeモードでは、確率的素数候補であることに加えて n mod 4 = 3 も要求します。",
    ],
    primeDetailEstimate: "3,840桁のランダムな整数では、通常素数なら数千候補に1個程度が目安です。Gaussian Primeはその約半分だけを採用するので、候補数はおおよそ2倍になります。",
    primeDetailLocal: "画像処理も素数判定もサーバーには送らず、この端末のブラウザ上で動きます。実時間はCPU、ブラウザ、ほかのアプリの負荷、生成された数字列、探索の運で変わります。",
    probablePrimeWarning: "注意: このアプリの結果はMiller-Rabinとstrong Lucasによる確率的素数候補です。証明済み素数ではなく、素数でない場合があります。",
    fileMeta: "入力画像",
    noCrop: "画像を選択すると切り抜きが表示されます。",
    cropRatio: "正方形切り抜き",
    fixedResolution: "解像度（固定）",
    searchControls: "探索設定",
    statusStrip: "探索ステータス",
    attemptCount: "試行回数",
    currentSuffix: "現在の接尾辞",
    noPrimeYet: "確率的素数候補が見つかるとコピーとPNG保存が使えます。",
    primeUnwrapped: "確率的素数候補（改行なし）",
    primeWrapped: "確率的素数候補（改行付き）",
    upload: "画像アップロード",
    crop: "切り抜き",
    cropPosition: "切り抜き位置",
    horizontal: "左右",
    vertical: "上下",
    zoom: "拡大",
    generateCrop: "この切り抜きで数値化",
    gaussian: "Gaussian Prime",
    gaussianHelp: "ONの場合、通常の素数に加えて n mod 4 = 3 を要求します。",
    digitTone: "数字の濃淡",
    digitToneHelp: "ONでは元画像から取った濃淡で色を付けます。候補化で末尾の数字が変わっても色は元画像のままです。OFFは単色表示にするだけで、探索や数字列は変えません。",
    followDigitTone: "濃淡を数字に追従",
    followDigitToneHelp: "ONでは候補化で変わった数字に合わせて色も変えます。OFFでは元画像の濃淡を固定します。",
    start: "素数探索を開始",
    stop: "停止",
    retry: "再探索",
    grid: "数字グリッド",
    result: "完成した巨大整数",
    copyPlain: "改行なしコピー",
    copyWrapped: "改行付きコピー",
    savePng: "候補PNG保存",
    waiting: "待機中",
    running: "探索中",
    found: "発見",
    notFound: "未発見",
    cancelled: "停止済み",
    error: "エラー",
    noImage: `画像をアップロードすると、${GRID_WIDTH}x${GRID_HEIGHT}の数字ポートレートを生成します。`,
    pickImageFirst: "先に画像をアップロードしてください。",
    generating: "切り抜き範囲から数字ポートレートを生成しています。",
    generated: (width: number, height: number, digits: number) => `${width}x${height} = ${digits.toLocaleString()}桁の数字ポートレートを生成しました。`,
    searchingGaussian: "Gaussian Prime条件で探索しています。",
    searchingPrime: "確率的素数候補を探索しています。",
    preparing: "探索準備中: 小素数ふるいを初期化しています。",
    progress: (suffix: string, tests: number) => `探索中: suffix ${suffix} / MR ${tests.toLocaleString()}回`,
    foundGaussian: (digits: number, tests: number) => `この数は${digits.toLocaleString()}桁のGaussian Prime候補です。証明済みではなく、素数でない場合があります。MR ${tests.toLocaleString()}回とLucas後段チェックで見つかりました。`,
    foundPrime: (digits: number, tests: number) => `この数は${digits.toLocaleString()}桁の確率的素数候補です。証明済みではなく、素数でない場合があります。MR ${tests.toLocaleString()}回とLucas後段チェックで見つかりました。`,
    reachedLimit: "探索上限に到達しました。再探索で別の候補範囲を試せます。",
    cancelledMessage: "素数探索を停止しました。",
    workerError: "Workerでエラーが発生しました。",
    copied: (label: string) => `${label}をクリップボードにコピーしました。`,
    plainPrime: "改行なしの巨大な確率的素数候補",
    wrappedPrime: "改行付きの巨大な確率的素数候補",
    pngSaved: "確率的素数候補になった数字画像PNGを保存しました。",
    gridPlaceholder: "数値化すると数字グリッドを表示します。",
    resultPlaceholder: (digits: number) => `確率的素数候補が見つかると、改行なしの${digits.toLocaleString()}桁整数がここに表示されます。`,
    wrappedPlaceholder: "同じ候補を画像グリッドと同じ幅で改行した版です。",
    mr: "Miller-Rabin",
    suffix: "Suffix",
    digits: "Digits",
  },
  en: {
    appTitle: "PrimePortrait Maker",
    title: `Turn an image into a ${TOTAL_DIGITS_LABEL}-digit probable-prime portrait`,
    subtitle: `Crop a photo to a square and convert it into a ${GRID_WIDTH}x${GRID_HEIGHT} digit grid that stays close to square when pasted as text.`,
    language: "Language",
    auto: "Auto",
    japanese: "Japanese",
    english: "English",
    chinese: "Chinese",
    stepImage: "Image",
    stepDigits: "Digits",
    stepPrime: "Prime search",
    outputTitle: "Digital portrait",
    outputMeta: "Digit tone: 0-9",
    howItWorksTitle: "How it works",
    howItWorksBody: `The image is cropped to a square in this browser, then ${GRID_WIDTH}x${GRID_HEIGHT} luminance samples are mapped to digits. The first digit is forced to be non-zero to preserve the digit count. Search keeps the upper digits fixed and varies only the final ${SUFFIX_DIGITS} digits. The result is not a proven prime; it is a probable-prime candidate that passed Miller-Rabin and strong Lucas tests, and may still be composite.`,
    localProcessingTitle: "How prime search works",
    localProcessingBody: `The upper digits stay fixed and only the final ${SUFFIX_DIGITS} digits are varied. Candidates that pass Miller-Rabin also run one Selfridge-style strong Lucas probable-prime post-check. The search runs locally in this browser.`,
    primeTestPipeline: "Test pipeline: small-prime sieve -> Miller-Rabin bases 2,3,5,7 -> strong Lucas post-check. Lucas only runs for candidates that pass MR.",
    moreDetails: "Details",
    close: "Close",
    versionHistoryTitle: "Version History",
    versionHistoryIntro: "Major versions mark changes to the workflow or the meaning of prime candidates. Minor versions mark feature, display, and output refinements within the same line.",
    primeDetailTitle: "Prime Search Details",
    primeDetailIntro: "The digit portrait is joined into one unwrapped integer. To preserve the visible portrait, the important upper digits stay fixed while only the suffix is replaced until a prime candidate is found.",
    primeDetailSteps: [
      "The digit grid is joined into one decimal string and handled with browser BigInt.",
      `The upper digits stay fixed, and only the final ${SUFFIX_DIGITS} digits are changed.`,
      "The starting point is the original suffix plus a random seed. Search again tries another range.",
      "Candidates ending in an even digit or 5 are skipped immediately.",
      "Candidates divisible by small primes up to 997 are filtered before expensive tests.",
      "Only survivors are checked with Miller-Rabin. The current bases are 2, 3, 5, and 7.",
      "Candidates that pass Miller-Rabin are then checked with a Selfridge-style strong Lucas probable prime test.",
      "Miller-Rabin and Lucas are probabilistic: a rejected candidate is definitely composite, but a passing candidate is a strong probable prime, not a formal proof of primality. It may still be composite.",
      "Gaussian Prime mode also requires n mod 4 = 3.",
    ],
    primeDetailEstimate: "For a random 3,840-digit integer, a normal prime is expected after a few thousand plausible candidates on average. Gaussian Prime accepts about half of those primes, so it can take roughly twice as many candidates.",
    primeDetailLocal: "Image processing and primality checks are not sent to a server. They run in this browser, so wall-clock time depends on CPU, browser, other local workload, the generated digit string, and search luck.",
    probablePrimeWarning: "Note: results are Miller-Rabin plus strong Lucas probable-prime candidates. They are not proven primes and may still be composite.",
    fileMeta: "Input image",
    noCrop: "Choose an image to show the crop.",
    cropRatio: "Square crop",
    fixedResolution: "Fixed resolution",
    searchControls: "Search settings",
    statusStrip: "Search status",
    attemptCount: "Attempts",
    currentSuffix: "Current suffix",
    noPrimeYet: "Copy and PNG actions appear after a probable prime is found.",
    primeUnwrapped: "Probable prime, unwrapped",
    primeWrapped: "Probable prime, wrapped",
    upload: "Upload image",
    crop: "Crop",
    cropPosition: "Crop position",
    horizontal: "Horizontal",
    vertical: "Vertical",
    zoom: "Zoom",
    generateCrop: "Generate from this crop",
    gaussian: "Gaussian Prime",
    gaussianHelp: "When on, the result must also satisfy n mod 4 = 3.",
    digitTone: "Digit tone",
    digitToneHelp: "When on, color tone comes from the source image and stays fixed even if the candidate suffix digits change. Turning it off only changes display color; it does not affect search or the digit string.",
    followDigitTone: "Follow candidate digits",
    followDigitToneHelp: "When on, changed candidate digits also change their color tone. When off, color tone stays locked to the source image.",
    start: "Start prime search",
    stop: "Stop",
    retry: "Search again",
    grid: "Digit grid",
    result: "Prime result",
    copyPlain: "Copy unwrapped",
    copyWrapped: "Copy wrapped",
    savePng: "Save candidate PNG",
    waiting: "Idle",
    running: "Searching",
    found: "Found",
    notFound: "Not found",
    cancelled: "Stopped",
    error: "Error",
    noImage: `Upload an image to generate a ${GRID_WIDTH}x${GRID_HEIGHT} digit portrait.`,
    pickImageFirst: "Upload an image first.",
    generating: "Generating a digit portrait from the crop.",
    generated: (width: number, height: number, digits: number) => `Generated a ${width}x${height} digit portrait with ${digits.toLocaleString()} digits.`,
    searchingGaussian: "Searching with the Gaussian Prime condition.",
    searchingPrime: "Searching for a probable prime.",
    preparing: "Preparing: initializing the small-prime sieve.",
    progress: (suffix: string, tests: number) => `Searching: suffix ${suffix} / MR ${tests.toLocaleString()} tests`,
    foundGaussian: (digits: number, tests: number) => `Found a ${digits.toLocaleString()}-digit Gaussian Prime candidate after ${tests.toLocaleString()} MR tests plus a Lucas post-check. It is not proven and may still be composite.`,
    foundPrime: (digits: number, tests: number) => `Found a ${digits.toLocaleString()}-digit probable-prime candidate after ${tests.toLocaleString()} MR tests plus a Lucas post-check. It is not proven and may still be composite.`,
    reachedLimit: "Reached the search limit. Try another range with Search again.",
    cancelledMessage: "Prime search stopped.",
    workerError: "The worker encountered an error.",
    copied: (label: string) => `Copied ${label} to the clipboard.`,
    plainPrime: "unwrapped probable prime",
    wrappedPrime: "wrapped probable prime",
    pngSaved: "Saved the probable-prime digit PNG.",
    gridPlaceholder: "The digit grid will appear after generation.",
    resultPlaceholder: (digits: number) => `When a probable prime is found, the unwrapped ${digits.toLocaleString()}-digit integer appears here.`,
    wrappedPlaceholder: "The same candidate wrapped to the digit grid width.",
    mr: "Miller-Rabin",
    suffix: "Suffix",
    digits: "Digits",
  },
  fr: {
    appTitle: "PrimePortrait Maker",
    title: `Transformer une image en portrait de ${TOTAL_DIGITS_LABEL} chiffres probablement premier`,
    subtitle: `Recadrez une photo en carré et convertissez-la en grille de chiffres ${GRID_WIDTH}x${GRID_HEIGHT}, qui reste presque carrée une fois collée comme texte.`,
    language: "Langue",
    auto: "Auto",
    japanese: "Japonais",
    english: "Anglais",
    chinese: "Chinois",
    stepImage: "Image",
    stepDigits: "Chiffres",
    stepPrime: "Recherche de premier",
    outputTitle: "Portrait numérique",
    outputMeta: "Tonalité des chiffres : 0-9",
    howItWorksTitle: "Fonctionnement",
    howItWorksBody: `L'image est recadrée en carré dans ce navigateur, puis ${GRID_WIDTH}x${GRID_HEIGHT} échantillons de luminance sont convertis en chiffres. Le premier chiffre est forcé à être non nul pour conserver le nombre de chiffres. La recherche garde les chiffres de tête fixes et ne varie que les ${SUFFIX_DIGITS} derniers chiffres. Le résultat n'est pas un nombre premier prouvé : c'est un candidat probablement premier ayant passé Miller-Rabin et strong Lucas, et il peut encore être composé.`,
    localProcessingTitle: "Fonctionnement de la recherche",
    localProcessingBody: `Les chiffres de tête restent fixes et seuls les ${SUFFIX_DIGITS} derniers chiffres varient. Les candidats qui passent Miller-Rabin passent aussi un post-controle strong Lucas probable prime de type Selfridge. La recherche s'exécute localement dans ce navigateur.`,
    primeTestPipeline: "Pipeline de test : crible de petits premiers -> Miller-Rabin bases 2,3,5,7 -> post-controle strong Lucas. Lucas ne s'applique qu'aux candidats qui passent MR.",
    moreDetails: "Détails",
    close: "Fermer",
    versionHistoryTitle: "Historique des versions",
    versionHistoryIntro: "Les versions majeures marquent les changements de flux de travail ou de signification des candidats premiers. Les versions mineures regroupent les améliorations de fonctions, d'affichage et de sortie dans la même ligne.",
    primeDetailTitle: "Détails de la recherche de premier",
    primeDetailIntro: "Le portrait de chiffres est concaténé en un très grand entier sans retour à la ligne. Pour préserver le portrait visible, les chiffres importants de tête restent fixes, et seul le suffixe est remplacé jusqu'à trouver un candidat premier.",
    primeDetailSteps: [
      "La grille de chiffres est concaténée en une chaîne décimale et traitée avec BigInt dans le navigateur.",
      `Les chiffres de tête restent fixes, et seuls les ${SUFFIX_DIGITS} derniers chiffres changent.`,
      "Le point de départ est le suffixe original augmenté d'une graine aléatoire. Une nouvelle recherche essaie une autre zone.",
      "Les candidats finissant par un chiffre pair ou par 5 sont ignorés immédiatement.",
      "Les candidats divisibles par les petits nombres premiers jusqu'à 997 sont filtrés avant les tests coûteux.",
      "Seuls les survivants sont testés avec Miller-Rabin. Les bases actuelles sont 2, 3, 5 et 7.",
      "Les candidats qui passent Miller-Rabin sont ensuite testés avec un strong Lucas probable prime test de type Selfridge.",
      "Miller-Rabin et Lucas sont probabilistes : un candidat rejeté est certainement composé, mais un candidat accepté reste un fort probable premier, pas une preuve formelle de primalité. Il peut encore être composé.",
      "Le mode Gaussian Prime exige aussi n mod 4 = 3.",
    ],
    primeDetailEstimate: "Pour un entier aléatoire de 3 840 chiffres, on s'attend en général à trouver un nombre premier après quelques milliers de candidats plausibles. Gaussian Prime n'accepte qu'environ la moitié de ces premiers, donc il peut falloir environ deux fois plus de candidats.",
    primeDetailLocal: "Le traitement de l'image et les tests de primalité ne sont pas envoyés à un serveur. Ils s'exécutent dans ce navigateur ; le temps réel dépend du processeur, du navigateur, de la charge locale, de la chaîne générée et de la chance de recherche.",
    probablePrimeWarning: "Attention : les résultats sont des candidats probablement premiers selon Miller-Rabin et strong Lucas. Ce ne sont pas des nombres premiers prouvés et ils peuvent encore être composés.",
    fileMeta: "Image d'entrée",
    noCrop: "Choisissez une image pour afficher le recadrage.",
    cropRatio: "Recadrage carré",
    fixedResolution: "Résolution fixe",
    searchControls: "Paramètres de recherche",
    statusStrip: "État de la recherche",
    attemptCount: "Tentatives",
    currentSuffix: "Suffixe actuel",
    noPrimeYet: "Les actions de copie et d'enregistrement PNG apparaissent après la découverte d'un candidat probablement premier.",
    primeUnwrapped: "Probable premier, sans retour",
    primeWrapped: "Probable premier, avec retours",
    upload: "Importer une image",
    crop: "Recadrage",
    cropPosition: "Position du recadrage",
    horizontal: "Horizontal",
    vertical: "Vertical",
    zoom: "Zoom",
    generateCrop: "Générer depuis ce recadrage",
    gaussian: "Gaussian Prime",
    gaussianHelp: "Si activé, le résultat doit aussi satisfaire n mod 4 = 3.",
    digitTone: "Tonalité",
    digitToneHelp: "Si activé, la tonalité de couleur vient de l'image source et reste fixe même si les chiffres du suffixe changent. La désactivation ne change que l'affichage ; elle n'affecte ni la recherche ni la chaîne de chiffres.",
    followDigitTone: "Suivre les chiffres",
    followDigitToneHelp: "Si activé, les chiffres modifiés du candidat changent aussi leur tonalité. Sinon, la tonalité reste verrouillée sur l'image source.",
    start: "Lancer la recherche",
    stop: "Arrêter",
    retry: "Relancer",
    grid: "Grille de chiffres",
    result: "Grand entier généré",
    copyPlain: "Copier sans retour",
    copyWrapped: "Copier avec retours",
    savePng: "Enregistrer le PNG",
    waiting: "En attente",
    running: "Recherche",
    found: "Trouvé",
    notFound: "Non trouvé",
    cancelled: "Arrêté",
    error: "Erreur",
    noImage: `Importez une image pour générer un portrait de chiffres ${GRID_WIDTH}x${GRID_HEIGHT}.`,
    pickImageFirst: "Importez d'abord une image.",
    generating: "Génération du portrait de chiffres depuis le recadrage.",
    generated: (width: number, height: number, digits: number) => `Portrait de chiffres généré : ${width}x${height}, soit ${digits.toLocaleString("fr-FR")} chiffres.`,
    searchingGaussian: "Recherche avec la condition Gaussian Prime.",
    searchingPrime: "Recherche d'un candidat probablement premier.",
    preparing: "Préparation : initialisation du crible de petits nombres premiers.",
    progress: (suffix: string, tests: number) => `Recherche : suffix ${suffix} / ${tests.toLocaleString("fr-FR")} tests MR`,
    foundGaussian: (digits: number, tests: number) => `Candidat Gaussian Prime de ${digits.toLocaleString("fr-FR")} chiffres trouvé après ${tests.toLocaleString("fr-FR")} tests MR et un post-contrôle Lucas. Il n'est pas prouvé et peut encore être composé.`,
    foundPrime: (digits: number, tests: number) => `Candidat probablement premier de ${digits.toLocaleString("fr-FR")} chiffres trouvé après ${tests.toLocaleString("fr-FR")} tests MR et un post-contrôle Lucas. Il n'est pas prouvé et peut encore être composé.`,
    reachedLimit: "Limite de recherche atteinte. Relancez pour essayer une autre plage de candidats.",
    cancelledMessage: "Recherche de premier arrêtée.",
    workerError: "Le worker a rencontré une erreur.",
    copied: (label: string) => `${label} copié dans le presse-papiers.`,
    plainPrime: "probable premier géant sans retour",
    wrappedPrime: "probable premier géant avec retours",
    pngSaved: "PNG du candidat probablement premier enregistré.",
    gridPlaceholder: "La grille de chiffres apparaîtra après génération.",
    resultPlaceholder: (digits: number) => `Lorsqu'un candidat probablement premier est trouvé, l'entier de ${digits.toLocaleString("fr-FR")} chiffres sans retour apparaît ici.`,
    wrappedPlaceholder: "Le même candidat, avec retours à la largeur de la grille.",
    mr: "Miller-Rabin",
    suffix: "Suffixe",
    digits: "Chiffres",
  },
  zh: {
    appTitle: "PrimePortrait Maker",
    title: `把图像变成${TOTAL_DIGITS_LABEL}位概率素数肖像`,
    subtitle: `先把照片裁成正方形，再转换成${GRID_WIDTH}x${GRID_HEIGHT}数字网格，复制粘贴后也尽量接近正方形。`,
    language: "语言",
    auto: "自动",
    japanese: "日语",
    english: "英语",
    chinese: "中文",
    stepImage: "图像",
    stepDigits: "数字",
    stepPrime: "素数搜索",
    outputTitle: "数字肖像",
    outputMeta: "数字明暗: 0-9",
    howItWorksTitle: "工作原理",
    howItWorksBody: `图片会在此浏览器内裁剪为正方形，然后把${GRID_WIDTH}x${GRID_HEIGHT}个亮度采样映射为数字。首位会强制为非0以保持位数。搜索会固定高位数字，只改变最后${SUFFIX_DIGITS}位。结果不是已证明的素数，而是通过Miller-Rabin和strong Lucas测试的概率素数候选，仍有可能不是素数。`,
    localProcessingTitle: "素数搜索原理",
    localProcessingBody: `高位数字固定，只改变最后${SUFFIX_DIGITS}位来寻找素数候选。通过Miller-Rabin的候选还会再执行一次Selfridge型strong Lucas概率素数后段检查。搜索在本机浏览器内运行。`,
    primeTestPipeline: "判定流程：小素数筛 -> Miller-Rabin基数2,3,5,7 -> strong Lucas后段检查。Lucas只对通过MR的候选执行。",
    moreDetails: "详细说明",
    close: "关闭",
    versionHistoryTitle: "版本历程",
    versionHistoryIntro: "主版本表示工作流或素数候选含义发生变化的节点；次版本表示同一产品线内的功能、显示和输出改进。",
    primeDetailTitle: "素数搜索的详细原理",
    primeDetailIntro: "数字肖像会被连成一个无换行的巨大整数。为了保持可见的肖像，高位数字固定，只替换末尾数字，直到找到素数候选。",
    primeDetailSteps: [
      "数字网格会被连成一个十进制字符串，并用浏览器BigInt处理。",
      `高位数字固定，只改变最后${SUFFIX_DIGITS}位。`,
      "起点是原始后缀加上随机seed。重新搜索会尝试另一个范围。",
      "偶数或5结尾的候选会立即跳过。",
      "先筛掉能被997以下小素数整除的候选。",
      "剩下的候选才用Miller-Rabin测试。当前基数为2、3、5、7。",
      "通过Miller-Rabin的候选会再进行Selfridge型strong Lucas概率素数测试。",
      "Miller-Rabin和Lucas是概率判定：未通过的候选一定是合数，通过的候选是强概率素数，并不是形式化证明过的素数，仍有可能不是素数。",
      "Gaussian Prime模式还要求 n mod 4 = 3。",
    ],
    primeDetailEstimate: "对于随机的3,840位整数，普通素数平均大约每数千个有效候选出现一次。Gaussian Prime只接受其中约一半，因此候选数量大约会翻倍。",
    primeDetailLocal: "图像处理和素数判定不会发送到服务器，全部在本机浏览器内运行。实际时间取决于CPU、浏览器、其他本地负载、生成的数字串和搜索运气。",
    probablePrimeWarning: "注意：结果是Miller-Rabin加strong Lucas概率素数候选，不是已证明的素数，仍有可能不是素数。",
    fileMeta: "输入图像",
    noCrop: "选择图片后会显示裁剪。",
    cropRatio: "正方形裁剪",
    fixedResolution: "固定分辨率",
    searchControls: "搜索设置",
    statusStrip: "搜索状态",
    attemptCount: "试行次数",
    currentSuffix: "当前后缀",
    noPrimeYet: "找到概率素数候选后可复制并保存PNG。",
    primeUnwrapped: "概率素数候选（无换行）",
    primeWrapped: "概率素数候选（有换行）",
    upload: "上传图片",
    crop: "裁剪",
    cropPosition: "裁剪位置",
    horizontal: "左右",
    vertical: "上下",
    zoom: "缩放",
    generateCrop: "用此裁剪生成",
    gaussian: "Gaussian Prime",
    gaussianHelp: "开启时，除了是素数，还要求 n mod 4 = 3。",
    digitTone: "数字明暗",
    digitToneHelp: "开启时颜色明暗来自原图，即使候选末尾数字改变，颜色也保持原图明暗。关闭只会切换为单色显示，不会影响搜索或数字串。",
    followDigitTone: "明暗跟随数字",
    followDigitToneHelp: "开启时，候选数字改变后颜色明暗也会改变。关闭时，颜色明暗固定为原图。",
    start: "开始素数搜索",
    stop: "停止",
    retry: "重新搜索",
    grid: "数字网格",
    result: "生成的巨大整数",
    copyPlain: "复制无换行",
    copyWrapped: "复制有换行",
    savePng: "保存候选PNG",
    waiting: "待机",
    running: "搜索中",
    found: "已找到",
    notFound: "未找到",
    cancelled: "已停止",
    error: "错误",
    noImage: `上传图片后会生成${GRID_WIDTH}x${GRID_HEIGHT}数字肖像。`,
    pickImageFirst: "请先上传图片。",
    generating: "正在从裁剪区域生成数字肖像。",
    generated: (width: number, height: number, digits: number) => `已生成${width}x${height}，共${digits.toLocaleString()}位的数字肖像。`,
    searchingGaussian: "正在按Gaussian Prime条件搜索。",
    searchingPrime: "正在搜索概率素数候选。",
    preparing: "准备中：正在初始化小素数筛。",
    progress: (suffix: string, tests: number) => `搜索中: suffix ${suffix} / MR ${tests.toLocaleString()}次`,
    foundGaussian: (digits: number, tests: number) => `找到${digits.toLocaleString()}位Gaussian Prime候选，MR测试${tests.toLocaleString()}次并通过Lucas后段检查。它不是已证明的素数，仍有可能不是素数。`,
    foundPrime: (digits: number, tests: number) => `找到${digits.toLocaleString()}位概率素数候选，MR测试${tests.toLocaleString()}次并通过Lucas后段检查。它不是已证明的素数，仍有可能不是素数。`,
    reachedLimit: "已达到搜索上限。可重新搜索其他候选范围。",
    cancelledMessage: "已停止素数搜索。",
    workerError: "Worker发生错误。",
    copied: (label: string) => `已复制${label}。`,
    plainPrime: "无换行巨大概率素数候选",
    wrappedPrime: "有换行巨大概率素数候选",
    pngSaved: "已保存概率素数候选数字PNG。",
    gridPlaceholder: "生成后会显示数字网格。",
    resultPlaceholder: (digits: number) => `找到概率素数候选后，无换行的${digits.toLocaleString()}位整数会显示在这里。`,
    wrappedPlaceholder: "同一个候选，按数字网格宽度换行显示。",
    mr: "Miller-Rabin",
    suffix: "Suffix",
    digits: "Digits",
  },
} as const;

const versionHistory: Array<{
  version: string;
  date: string;
  hash?: string;
  major?: boolean;
  summary: Record<Locale, string>;
}> = [
  {
    version: "Ver. 2.5",
    date: "2026-05-12",
    summary: {
      ja: "素数探索パネルに、Miller-Rabin後のstrong Lucas後段チェックを常時表示。",
      en: "Surfaced the strong Lucas post-check after Miller-Rabin in the prime-search panel.",
      fr: "Affichage du post-controle strong Lucas apres Miller-Rabin dans le panneau de recherche.",
      zh: "在素数搜索面板中明确显示Miller-Rabin之后的strong Lucas后段检查。",
    },
  },
  {
    version: "Ver. 2.4",
    date: "2026-05-12",
    summary: {
      ja: "切り抜きプレビューをマウス/タッチで直接操作可能に。PCではドラッグとホイール、スマホではドラッグとピンチで位置と拡大率を調整できます。",
      en: "Made the crop preview directly interactive: drag and wheel on desktop, drag and pinch on mobile.",
      fr: "Le recadrage devient interactif : glisser et molette sur ordinateur, glisser et pincement sur mobile.",
      zh: "裁剪预览可直接交互：桌面端支持拖拽和滚轮，移动端支持拖拽和双指缩放。",
    },
  },
  {
    version: "Ver. 2.3",
    date: "2026-05-12",
    summary: {
      ja: "数字だけの再現性を上げるため、字形の実インク量に合わせて数字割り当てと濃淡追従を調整。濃淡OFFは白地に黒数字へ変更。",
      en: "Adjusted plain digit art and tone-follow coloring to match practical digit ink density; tone-off display now uses black digits on white.",
      fr: "Ajustement de l'art en chiffres et du suivi de tonalité selon la densité réelle d'encre des chiffres ; l'affichage sans tonalité utilise maintenant des chiffres noirs sur fond blanc.",
      zh: "按数字字形的实际墨量调整纯数字肖像和明暗跟随；关闭明暗时改为白底黑字。",
    },
  },
  {
    version: "Ver. 2.2",
    date: "2026-05-11",
    hash: "fbbdb79",
    summary: {
      ja: "WebPアップロード対応と、外部ツールによる形式的な素数証明についての説明を追加。",
      en: "Added WebP upload support and notes about external formal primality proofs.",
      fr: "Ajout de la prise en charge WebP et de notes sur les preuves formelles externes de primalité.",
      zh: "加入WebP上传支持，并补充外部形式化素数证明的说明。",
    },
  },
  {
    version: "Ver. 2.1",
    date: "2026-05-01",
    hash: "1153df1",
    summary: {
      ja: "フランス語ローカライズを追加。",
      en: "Added French localization.",
      fr: "Ajout de la localisation française.",
      zh: "加入法语本地化。",
    },
  },
  {
    version: "Ver. 2.0",
    date: "2026-05-01",
    hash: "aa0cf7b",
    major: true,
    summary: {
      ja: "Miller-Rabin通過後にstrong Lucas probable prime testを追加し、素数候補の判定品質を変更。",
      en: "Added a strong Lucas probable-prime post-check after Miller-Rabin, changing the quality bar for prime candidates.",
      fr: "Ajout d'un post-controle strong Lucas apres Miller-Rabin, ce qui change le niveau d'exigence des candidats premiers.",
      zh: "在Miller-Rabin之后加入strong Lucas概率素数后段检查，改变了素数候选的判定门槛。",
    },
  },
  {
    version: "Ver. 1.6",
    date: "2026-04-30",
    hash: "afc4833",
    summary: {
      ja: "数字の濃淡表示と追従コントロールを調整。",
      en: "Refined digit tone display controls.",
      fr: "Affinage des controles d'affichage de tonalite des chiffres.",
      zh: "调整数字明暗显示控制。",
    },
  },
  {
    version: "Ver. 1.5",
    date: "2026-04-30",
    hash: "ff4b62d",
    summary: {
      ja: "保存PNGの周囲に余白を追加。",
      en: "Added padding around exported PNG images.",
      fr: "Ajout de marges autour des PNG exportes.",
      zh: "为导出的PNG图像增加边距。",
    },
  },
  {
    version: "Ver. 1.4",
    date: "2026-04-30",
    hash: "a0d4271",
    summary: {
      ja: "探索で見つかった候補を数字グリッドとして表示。",
      en: "Showed the found candidate as a digit grid after search.",
      fr: "Affichage du candidat trouve sous forme de grille de chiffres apres la recherche.",
      zh: "搜索后把找到的候选显示为数字网格。",
    },
  },
  {
    version: "Ver. 1.3",
    date: "2026-04-30",
    hash: "69c2edb",
    summary: {
      ja: "結果が証明済み素数ではなく確率的素数候補であることを明確化。",
      en: "Clarified that results are probable-prime candidates, not formal proofs.",
      fr: "Clarification : les resultats sont des candidats probablement premiers, pas des preuves formelles.",
      zh: "明确结果是概率素数候选，而不是形式化证明。",
    },
  },
  {
    version: "Ver. 1.2",
    date: "2026-04-30",
    hash: "2da3b7c",
    summary: {
      ja: "数字アートへの変換マッピングを改善。",
      en: "Improved digit art mapping.",
      fr: "Amelioration du mappage vers l'art en chiffres.",
      zh: "改进数字肖像映射。",
    },
  },
  {
    version: "Ver. 1.0",
    date: "2026-04-30",
    hash: "359c307",
    major: true,
    summary: {
      ja: "PrimePortraitの操作フローと画面構成を大きく再設計。",
      en: "Redesigned the PrimePortrait workflow UI.",
      fr: "Refonte importante du flux et de l'interface PrimePortrait.",
      zh: "大幅重新设计PrimePortrait的工作流界面。",
    },
  },
  {
    version: "Ver. 0.4",
    date: "2026-04-30",
    hash: "a3b2bb6",
    summary: {
      ja: "肖像の数字グリッドサイズを縮小。",
      en: "Reduced the portrait digit grid size.",
      fr: "Reduction de la taille de la grille de chiffres.",
      zh: "缩小数字肖像网格尺寸。",
    },
  },
  {
    version: "Ver. 0.3",
    date: "2026-04-30",
    hash: "f2109a4",
    summary: {
      ja: "ブラウザ内の素数探索を安定化。",
      en: "Stabilized browser-based prime search.",
      fr: "Stabilisation de la recherche de premier dans le navigateur.",
      zh: "稳定浏览器内素数搜索。",
    },
  },
  {
    version: "Ver. 0.2",
    date: "2026-04-30",
    hash: "a3c2c7c",
    summary: {
      ja: "レイアウトとローカライズを調整。",
      en: "Polished layout and localization.",
      fr: "Polissage de la mise en page et de la localisation.",
      zh: "优化布局和本地化。",
    },
  },
  {
    version: "Ver. 0.1",
    date: "2026-04-30",
    hash: "fc393b5",
    summary: {
      ja: "数字ポートレート生成のワークフローを改良。",
      en: "Refined the digit portrait workflow.",
      fr: "Affinage du flux de portrait en chiffres.",
      zh: "改进数字肖像生成流程。",
    },
  },
  {
    version: "Ver. 0.0",
    date: "2026-04-30",
    hash: "c3773d6",
    major: true,
    summary: {
      ja: "PrimePortrait MakerのMVPを作成。",
      en: "Built the PrimePortrait Maker MVP.",
      fr: "Creation du MVP de PrimePortrait Maker.",
      zh: "创建PrimePortrait Maker的MVP。",
    },
  },
];

export default function Home() {
  const workerRef = useRef<Worker | null>(null);
  const cropFocusRef = useRef<CropFocus>({ x: 0.5, y: 0.5, zoom: 1 });
  const cropPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const cropGestureRef = useRef<{ focus: CropFocus; center: { x: number; y: number }; distance: number } | null>(null);
  const [art, setArt] = useState<DigitArtResult | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSize, setSourceSize] = useState<SourceSize | null>(null);
  const [fileName, setFileName] = useState("");
  const [cropFocus, setCropFocus] = useState<CropFocus>({ x: 0.5, y: 0.5, zoom: 1 });
  const [localeOption, setLocaleOption] = useState<LocaleOption>("auto");
  const [autoLocale, setAutoLocale] = useState<Locale>("ja");
  const [gaussian, setGaussian] = useState(false);
  const [digitTone, setDigitTone] = useState(true);
  const [toneFollowsDigits, setToneFollowsDigits] = useState(false);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [attempts, setAttempts] = useState(0);
  const [probablePrimeTests, setProbablePrimeTests] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentSuffix, setCurrentSuffix] = useState("");
  const [prime, setPrime] = useState("");
  const [message, setMessage] = useState("");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9_000_000));
  const [showPrimeDetails, setShowPrimeDetails] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const locale = useMemo(() => resolveLocale(localeOption, autoLocale), [autoLocale, localeOption]);
  const t = translations[locale];
  const wrappedPrime = useMemo(() => (prime ? wrapDigits(prime, GRID_WIDTH) : ""), [prime]);
  const gridText = useMemo(() => wrappedPrime || art?.grid.join("\n") || "", [art, wrappedPrime]);
  const toneGridText = useMemo(() => art?.toneGrid.join("\n") ?? "", [art]);
  const displayToneGridText = toneFollowsDigits ? "" : toneGridText;
  const canSearch = Boolean(art) && status !== "running";
  const canAdjustCrop = Boolean(sourceUrl) && status !== "running";
  const cropMovement = useMemo(() => cropMovementFor(sourceSize, cropFocus.zoom), [cropFocus.zoom, sourceSize]);
  const displayMessage = message || t.noImage;

  useEffect(() => {
    setAutoLocale(detectBrowserLocale());
  }, []);

  useEffect(() => {
    cropFocusRef.current = cropFocus;
  }, [cropFocus]);

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
    setCurrentSuffix("");
    setAttempts(0);
    setProbablePrimeTests(0);
    setFileName(file.name);
    setSourceSize(null);
    cropFocusRef.current = { x: 0.5, y: 0.5, zoom: 1 };
    setCropFocus({ x: 0.5, y: 0.5, zoom: 1 });
    setSourceFile(file);
    setSourceUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });

    await generateDigitArt(file, { x: 0.5, y: 0.5, zoom: 1 });
  }

  async function generateDigitArt(file = sourceFile, focus = cropFocus): Promise<void> {
    if (!file) {
      setMessage(t.pickImageFirst);
      return;
    }

    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus("idle");
    setPrime("");
    setProgress(0);
    setCurrentSuffix("");
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

  function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!canAdjustCrop) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    cropPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    cropGestureRef.current = makeCropGesture(cropPointersRef.current, cropFocusRef.current);
  }

  function handleCropPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!canAdjustCrop || !cropPointersRef.current.has(event.pointerId)) {
      return;
    }

    cropPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = cropGestureRef.current;
    if (!gesture) {
      return;
    }

    const next = normalizeCropFocus(
      nextCropFocusFromGesture(gesture, cropPointersRef.current, event.currentTarget.getBoundingClientRect()),
      sourceSize,
    );
    cropFocusRef.current = next;
    setCropFocus(next);
  }

  function handleCropPointerEnd(event: ReactPointerEvent<HTMLDivElement>): void {
    cropPointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cropGestureRef.current = makeCropGesture(cropPointersRef.current, cropFocusRef.current);
  }

  function handleCropWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    if (!canAdjustCrop) {
      return;
    }

    event.preventDefault();
    const nextZoom = clampNumber(cropFocusRef.current.zoom * Math.exp(-event.deltaY * 0.001), 1, 3);
    const next = normalizeCropFocus({ ...cropFocusRef.current, zoom: nextZoom }, sourceSize);
    cropFocusRef.current = next;
    setCropFocus(next);
  }

  function setNormalizedCropFocus(next: CropFocus): void {
    const normalized = normalizeCropFocus(next, sourceSize);
    cropFocusRef.current = normalized;
    setCropFocus(normalized);
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
    setCurrentSuffix("");
    setAttempts(0);
    setProbablePrimeTests(0);
    setMessage(gaussian ? t.searchingGaussian : t.searchingPrime);

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;
      if (data.type === "progress") {
        setAttempts(data.attempts);
        setProbablePrimeTests(data.probablePrimeTests);
        setProgress(data.progress);
        setCurrentSuffix(data.currentSuffix);
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
        setCurrentSuffix(data.suffix);
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
      if (data.type === "cancelled") {
        setStatus("cancelled");
        setAttempts(data.attempts);
        setProbablePrimeTests(data.probablePrimeTests);
        setMessage(t.cancelledMessage);
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

  function stopSearch(): void {
    if (status !== "running") {
      return;
    }

    workerRef.current?.postMessage({ type: "cancel" });
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus("cancelled");
    setMessage(t.cancelledMessage);
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

    const png = renderDigitGridPng(wrappedPrime.split("\n"), digitTone, toneFollowsDigits ? undefined : art?.toneGrid);
    const link = document.createElement("a");
    link.href = png;
    link.download = digitTone ? "primeportrait-prime-tone.png" : "primeportrait-prime-plain.png";
    link.click();
    setMessage(t.pngSaved);
  }

  return (
    <main className="min-h-screen px-3 py-3 text-stone-100 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1540px] flex-col gap-3">
        <header className="relative z-40 flex flex-col gap-3 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 shadow-2xl shadow-black/25 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded border border-teal-300/50 bg-teal-300/10 font-mono text-lg text-teal-200">P</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-mono text-base font-semibold tracking-wide text-stone-50 sm:text-lg">{t.appTitle}</p>
                <button
                  type="button"
                  onClick={() => setShowVersionHistory(true)}
                  className="rounded border border-teal-300/30 px-1.5 py-0.5 font-mono text-[10px] text-teal-200 transition hover:border-teal-300 hover:bg-teal-300/10"
                >
                  {APP_VERSION}
                </button>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-stone-300 transition hover:border-teal-300/70 hover:text-teal-100"
                >
                  GitHub
                </a>
                <HelpButton title={t.howItWorksTitle} body={t.howItWorksBody} />
              </div>
              <h1 className="truncate text-sm leading-5 text-stone-400">{t.title}</h1>
            </div>
          </div>
          <LanguageSwitch localeOption={localeOption} setLocaleOption={setLocaleOption} t={t} />
        </header>

        <div className="relative z-10 grid gap-3 lg:grid-cols-[76px_470px_minmax(0,1fr)] 2xl:grid-cols-[84px_500px_minmax(0,1fr)]">
          <StepRail
            steps={[
              { index: 1, label: t.stepImage, complete: Boolean(sourceFile), active: !sourceFile },
              { index: 2, label: t.stepDigits, complete: Boolean(art), active: Boolean(sourceFile) && !art },
              { index: 3, label: t.stepPrime, complete: Boolean(prime), active: Boolean(art) },
            ]}
          />

          <section className="relative rounded-lg border border-white/10 bg-zinc-950/75 shadow-2xl shadow-black/30 backdrop-blur">
            <WorkflowBlock index={1} title={t.stepImage} active={!sourceFile}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-teal-300/50 bg-teal-300/10 px-3 text-sm font-semibold text-teal-100 transition hover:bg-teal-300/20">
                  <span>{t.upload}</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="min-w-0 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500">{t.fileMeta}</p>
                  <p className="truncate text-xs text-stone-300">{fileName || "-"}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                <div
                  className={`aspect-square overflow-hidden rounded-md border border-teal-300/25 bg-black/30 ${
                    canAdjustCrop ? "cursor-grab touch-none active:cursor-grabbing" : ""
                  }`}
                  onPointerDown={handleCropPointerDown}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerEnd}
                  onPointerCancel={handleCropPointerEnd}
                  onWheel={handleCropWheel}
                >
                  {sourceUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="h-full w-full select-none object-cover transition-transform duration-150"
                      src={sourceUrl}
                      alt="Crop preview"
                      draggable={false}
                      onLoad={(event) => {
                        const nextSize = {
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        };
                        setSourceSize(nextSize);
                        const normalized = normalizeCropFocus(cropFocusRef.current, nextSize);
                        cropFocusRef.current = normalized;
                        setCropFocus(normalized);
                      }}
                      style={{
                        objectPosition: `${cropFocus.x * 100}% ${cropFocus.y * 100}%`,
                        transform: `scale(${cropFocus.zoom})`,
                        transformOrigin: `${cropFocus.x * 100}% ${cropFocus.y * 100}%`,
                      }}
                    />
                  ) : (
                    <div className="grid h-full place-items-center px-5 text-center text-sm text-stone-500">{t.noCrop}</div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-3">
                  <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-300">{t.cropRatio}</span>
                      <span className="font-mono text-xs text-teal-300">1:1</span>
                    </div>
                  </div>
                  <RangeControl
                    label={t.horizontal}
                    value={Math.round(cropFocus.x * 100)}
                    disabled={!canAdjustCrop || !cropMovement.x}
                    onChange={(value) => setNormalizedCropFocus({ ...cropFocusRef.current, x: value / 100 })}
                  />
                  <RangeControl
                    label={t.vertical}
                    value={Math.round(cropFocus.y * 100)}
                    disabled={!canAdjustCrop || !cropMovement.y}
                    onChange={(value) => setNormalizedCropFocus({ ...cropFocusRef.current, y: value / 100 })}
                  />
                  <RangeControl
                    label={t.zoom}
                    value={Math.round(cropFocus.zoom * 100)}
                    min={100}
                    max={300}
                    disabled={!canAdjustCrop}
                    onChange={(value) => setNormalizedCropFocus({ ...cropFocusRef.current, zoom: value / 100 })}
                  />
                  <button
                    type="button"
                    disabled={!sourceFile || status === "running"}
                    onClick={() => void generateDigitArt()}
                    className="min-h-10 rounded-md border border-white/10 px-3 text-sm font-semibold text-stone-100 transition hover:border-teal-300/70 disabled:cursor-not-allowed disabled:text-stone-500"
                  >
                    {t.generateCrop}
                  </button>
                </div>
              </div>
            </WorkflowBlock>

            <WorkflowBlock index={2} title={t.stepDigits} active={Boolean(sourceFile) && !art}>
              <div className="grid gap-3">
                <div>
                  <p className="mb-2 text-xs font-medium text-stone-400">{t.fixedResolution}</p>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <Metric label="Grid" value={`${GRID_WIDTH}x${GRID_HEIGHT}`} />
                    <Metric label={t.suffix} value={`${SUFFIX_DIGITS}`} />
                    <Metric label={t.digits} value={TOTAL_DIGITS.toLocaleString()} />
                  </dl>
                </div>
                <ToneControls
                  toneLabel={t.digitTone}
                  toneHelp={t.digitToneHelp}
                  toneEnabled={digitTone}
                  onToneToggle={() => setDigitTone((value) => !value)}
                  followLabel={t.followDigitTone}
                  followHelp={t.followDigitToneHelp}
                  followEnabled={toneFollowsDigits}
                  onFollowToggle={() => setToneFollowsDigits((value) => !value)}
                />
              </div>
            </WorkflowBlock>

            <WorkflowBlock index={3} title={t.stepPrime} active={Boolean(art)}>
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-stone-400">{t.searchControls}</span>
                  <HelpButton
                    title={t.localProcessingTitle}
                    body={t.localProcessingBody}
                    align="right"
                    detailsLabel={t.moreDetails}
                    onDetails={() => setShowPrimeDetails(true)}
                  />
                </div>
                <ToggleRow
                  label={t.gaussian}
                  help={t.gaussianHelp}
                  enabled={gaussian}
                  tone="teal"
                  onToggle={() => setGaussian((value) => !value)}
                />
                <p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-stone-400">{t.primeTestPipeline}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={!canSearch}
                    onClick={() => startSearch()}
                    className="min-h-11 rounded-md bg-teal-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
                  >
                    {t.start}
                  </button>
                  <button
                    type="button"
                    disabled={status !== "running"}
                    onClick={stopSearch}
                    className="min-h-11 rounded-md border border-rose-300/40 px-4 text-sm font-semibold text-rose-100 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-stone-500"
                  >
                    {t.stop}
                  </button>
                  <button
                    type="button"
                    disabled={!art || status === "running"}
                    onClick={retrySearch}
                    className="min-h-11 rounded-md border border-white/10 px-4 text-sm font-semibold text-stone-100 transition hover:border-teal-300/70 disabled:cursor-not-allowed disabled:text-stone-500"
                  >
                    {t.retry}
                  </button>
                </div>
              </div>
            </WorkflowBlock>
          </section>

          <section className="relative min-w-0 rounded-lg border border-white/10 bg-zinc-950/75 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-50">{t.outputTitle} <span className="font-mono text-sm text-stone-500">({GRID_WIDTH}x{GRID_HEIGHT})</span></h2>
                <p className="text-xs text-stone-500">{t.outputMeta}</p>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs text-stone-500">
                <span>{t.gaussian}: <span className={gaussian ? "text-teal-300" : "text-stone-400"}>{gaussian ? "ON" : "OFF"}</span></span>
                <span>{art ? `${TOTAL_DIGITS.toLocaleString()} digits` : statusLabel(status, t)}</span>
              </div>
            </div>

            <div className="flex justify-center p-3">
              <DigitGrid value={gridText} toneValue={displayToneGridText} tone={digitTone} placeholder={t.gridPlaceholder} />
            </div>

            <div className="border-t border-white/10 px-4 py-4">
              {prime ? (
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="grid gap-3">
                    <p className="rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">{t.probablePrimeWarning}</p>
                    <ResultField label={t.primeUnwrapped} value={prime} placeholder={t.resultPlaceholder(TOTAL_DIGITS)} />
                    <ResultField label={t.primeWrapped} value={wrappedPrime} placeholder={t.wrappedPlaceholder} />
                  </div>
                  <div className="grid content-start gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(prime, t.plainPrime)}
                      className="min-h-10 rounded-md bg-stone-100 px-3 text-xs font-semibold text-zinc-950 transition hover:bg-white"
                    >
                      {t.copyPlain}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(wrappedPrime, t.wrappedPrime)}
                      className="min-h-10 rounded-md border border-white/10 px-3 text-xs font-semibold text-stone-100 transition hover:border-teal-300/70"
                    >
                      {t.copyWrapped}
                    </button>
                    <button
                      type="button"
                      onClick={downloadPrimePng}
                      className="min-h-10 rounded-md border border-amber-300/40 px-3 text-xs font-semibold text-amber-100 transition hover:border-amber-300"
                    >
                      {t.savePng}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-stone-500">{t.noPrimeYet}</div>
              )}
            </div>
          </section>
        </div>

        <StatusStrip
          label={t.statusStrip}
          status={statusLabel(status, t)}
          attempts={`${attempts.toLocaleString()} / ${MAX_ATTEMPTS.toLocaleString()}`}
          tests={probablePrimeTests.toLocaleString()}
          suffix={currentSuffix || "-"}
          progress={progress}
          message={displayMessage}
          t={t}
        />
      </div>
      {showPrimeDetails ? (
        <PrimeDetailsModal
          title={t.primeDetailTitle}
          intro={t.primeDetailIntro}
          steps={t.primeDetailSteps}
          estimate={t.primeDetailEstimate}
          localNote={t.primeDetailLocal}
          closeLabel={t.close}
          onClose={() => setShowPrimeDetails(false)}
        />
      ) : null}
      {showVersionHistory ? (
        <VersionHistoryModal
          title={t.versionHistoryTitle}
          intro={t.versionHistoryIntro}
          closeLabel={t.close}
          locale={locale}
          onClose={() => setShowVersionHistory(false)}
        />
      ) : null}
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

function makeCropGesture(pointers: Map<number, { x: number; y: number }>, focus: CropFocus): { focus: CropFocus; center: { x: number; y: number }; distance: number } | null {
  const points = Array.from(pointers.values());
  if (points.length === 0) {
    return null;
  }

  return {
    focus,
    center: centerOfPoints(points),
    distance: distanceBetweenFirstTwo(points),
  };
}

function nextCropFocusFromGesture(
  gesture: { focus: CropFocus; center: { x: number; y: number }; distance: number },
  pointers: Map<number, { x: number; y: number }>,
  rect: DOMRect,
): CropFocus {
  const points = Array.from(pointers.values());
  const center = centerOfPoints(points);
  const distance = distanceBetweenFirstTwo(points);
  const zoom = gesture.distance > 0 && distance > 0 ? clampNumber(gesture.focus.zoom * (distance / gesture.distance), 1, 3) : gesture.focus.zoom;
  const deltaX = rect.width > 0 ? (center.x - gesture.center.x) / rect.width : 0;
  const deltaY = rect.height > 0 ? (center.y - gesture.center.y) / rect.height : 0;

  return {
    x: clampNumber(gesture.focus.x - deltaX / zoom, 0, 1),
    y: clampNumber(gesture.focus.y - deltaY / zoom, 0, 1),
    zoom,
  };
}

function normalizeCropFocus(focus: CropFocus, sourceSize: SourceSize | null): CropFocus {
  const zoom = clampNumber(focus.zoom, 1, 3);
  const movement = cropMovementFor(sourceSize, zoom);

  return {
    x: movement.x ? clampNumber(focus.x, 0, 1) : 0.5,
    y: movement.y ? clampNumber(focus.y, 0, 1) : 0.5,
    zoom,
  };
}

function cropMovementFor(sourceSize: SourceSize | null, zoom: number): { x: boolean; y: boolean } {
  if (!sourceSize || sourceSize.width <= 0 || sourceSize.height <= 0) {
    return { x: true, y: true };
  }

  const sourceAspect = sourceSize.width / sourceSize.height;
  const baseWidth = sourceAspect > 1 ? sourceSize.height : sourceSize.width;
  const baseHeight = sourceAspect > 1 ? sourceSize.height : sourceSize.width;
  const cropWidth = baseWidth / clampNumber(zoom, 1, 3);
  const cropHeight = baseHeight / clampNumber(zoom, 1, 3);
  const epsilon = 0.5;

  return {
    x: sourceSize.width - cropWidth > epsilon,
    y: sourceSize.height - cropHeight > epsilon,
  };
}

function centerOfPoints(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );
  const count = Math.max(1, points.length);

  return {
    x: total.x / count,
    y: total.y / count,
  };
}

function distanceBetweenFirstTwo(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) {
    return 0;
  }

  const first = points[0];
  const second = points[1];
  return Math.hypot((second?.x ?? 0) - (first?.x ?? 0), (second?.y ?? 0) - (first?.y ?? 0));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function HelpButton({
  title,
  body,
  align = "left",
  detailsLabel,
  onDetails,
}: {
  title: string;
  body: string;
  align?: "left" | "right";
  detailsLabel?: string;
  onDetails?: () => void;
}) {
  return (
    <details className="group relative z-50 inline-block">
      <summary className="help-trigger grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-white/15 bg-black/30 text-xs font-semibold text-stone-300 transition hover:border-teal-300/70 hover:text-teal-100">
        ?
      </summary>
      <div
        className={`absolute z-50 mt-2 w-72 rounded-md border border-teal-300/30 bg-zinc-950 p-3 text-left shadow-2xl shadow-black/50 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        <p className="text-sm font-semibold text-stone-100">{title}</p>
        <p className="mt-2 text-xs leading-5 text-stone-400">{body}</p>
        {detailsLabel && onDetails ? (
          <button
            type="button"
            onClick={onDetails}
            className="mt-3 min-h-8 rounded-md border border-teal-300/40 px-3 text-xs font-semibold text-teal-100 transition hover:border-teal-300 hover:bg-teal-300/10"
          >
            {detailsLabel}
          </button>
        ) : null}
      </div>
    </details>
  );
}

function PrimeDetailsModal({
  title,
  intro,
  steps,
  estimate,
  localNote,
  closeLabel,
  onClose,
}: {
  title: string;
  intro: string;
  steps: readonly string[];
  estimate: string;
  localNote: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="prime-details-title">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg border border-teal-300/25 bg-zinc-950 p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-300">Prime Search</p>
            <h2 id="prime-details-title" className="mt-1 text-lg font-semibold text-stone-50">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-md border border-white/10 px-3 text-xs font-semibold text-stone-200 transition hover:border-teal-300/70"
          >
            {closeLabel}
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-stone-300">{intro}</p>
        <ol className="mt-4 grid gap-2">
          {steps.map((step, index) => (
            <li key={step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-stone-300">
              <span className="font-mono text-xs text-teal-300">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <p className="rounded-md border border-amber-300/20 bg-amber-300/5 px-3 py-3 text-xs leading-5 text-amber-100">{estimate}</p>
          <p className="rounded-md border border-teal-300/20 bg-teal-300/5 px-3 py-3 text-xs leading-5 text-teal-100">{localNote}</p>
        </div>
      </div>
    </div>
  );
}

function VersionHistoryModal({
  title,
  intro,
  closeLabel,
  locale,
  onClose,
}: {
  title: string;
  intro: string;
  closeLabel: string;
  locale: Locale;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="version-history-title">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg border border-teal-300/25 bg-zinc-950 p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-300">{APP_VERSION}</p>
            <h2 id="version-history-title" className="mt-1 text-lg font-semibold text-stone-50">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-md border border-white/10 px-3 text-xs font-semibold text-stone-200 transition hover:border-teal-300/70"
          >
            {closeLabel}
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-stone-300">{intro}</p>
        <ol className="mt-4 grid gap-2">
          {versionHistory.map((entry) => (
            <li key={entry.version} className={`rounded-md border px-3 py-2 ${entry.major ? "border-teal-300/30 bg-teal-300/10" : "border-white/10 bg-black/20"}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-xs font-semibold text-teal-200">{entry.version}</span>
                <span className="font-mono text-[10px] text-stone-500">{entry.date}</span>
                {entry.hash ? <span className="font-mono text-[10px] text-stone-600">{entry.hash}</span> : null}
              </div>
              <p className="mt-1 text-sm leading-5 text-stone-300">{entry.summary[locale]}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StepRail({
  steps,
}: {
  steps: Array<{ index: number; label: string; complete: boolean; active: boolean }>;
}) {
  return (
    <nav className="rounded-lg border border-white/10 bg-zinc-950/75 px-3 py-3 backdrop-blur lg:min-h-[760px]">
      <ol className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-0">
        {steps.map((step, index) => (
          <li key={step.index} className="relative flex items-center gap-2 lg:flex-col lg:gap-2">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border font-mono text-sm transition ${
                step.complete
                  ? "border-teal-300 bg-teal-300 text-zinc-950"
                  : step.active
                    ? "border-teal-300 text-teal-200"
                    : "border-white/15 text-stone-500"
              }`}
            >
              {step.index}
            </div>
            <span className={`text-xs font-semibold ${step.active || step.complete ? "text-teal-200" : "text-stone-500"}`}>{step.label}</span>
            {index < steps.length - 1 ? <span className="hidden h-20 border-l border-dashed border-teal-300/30 lg:block" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function WorkflowBlock({
  index,
  title,
  active,
  children,
}: {
  index: number;
  title: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/10 px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`grid h-7 w-7 place-items-center rounded-full border font-mono text-xs ${
            active ? "border-teal-300 text-teal-200" : "border-white/15 text-stone-500"
          }`}
        >
          {index}
        </span>
        <h2 className="text-base font-semibold text-stone-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  help,
  enabled,
  tone,
  onToggle,
}: {
  label: string;
  help: string;
  enabled: boolean;
  tone: "teal" | "amber";
  onToggle: () => void;
}) {
  const activeClass = tone === "amber" ? "border-amber-300 bg-amber-300" : "border-teal-300 bg-teal-300";

  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-stone-200">{label}</span>
        <button
          type="button"
          onClick={onToggle}
          className={`h-7 w-14 rounded-full border p-1 transition ${enabled ? activeClass : "border-white/15 bg-stone-800"}`}
          aria-pressed={enabled}
        >
          <span className={`block h-5 w-5 rounded-full bg-zinc-950 transition ${enabled ? "translate-x-7" : "translate-x-0"}`} />
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-500">{help}</p>
    </div>
  );
}

function ToneControls({
  toneLabel,
  toneHelp,
  toneEnabled,
  onToneToggle,
  followLabel,
  followHelp,
  followEnabled,
  onFollowToggle,
}: {
  toneLabel: string;
  toneHelp: string;
  toneEnabled: boolean;
  onToneToggle: () => void;
  followLabel: string;
  followHelp: string;
  followEnabled: boolean;
  onFollowToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-2">
      <span className="hidden shrink-0 px-1 text-xs font-semibold text-stone-400 sm:block">{toneLabel}</span>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        <CompactSwitch label={toneLabel} enabled={toneEnabled} onToggle={onToneToggle} />
        <CompactSwitch label={followLabel} enabled={followEnabled} onToggle={onFollowToggle} />
      </div>
      <HelpButton title={toneLabel} body={`${toneHelp} ${followHelp}`} align="right" />
    </div>
  );
}

function CompactSwitch({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex min-h-7 items-center justify-center gap-2 rounded-md border px-2 text-center text-[11px] font-semibold transition ${
        enabled
          ? "border-amber-300/60 bg-amber-300/12 text-amber-100"
          : "border-white/10 bg-stone-900/70 text-stone-400 hover:border-white/20"
      }`}
      aria-pressed={enabled}
    >
      <span>{label}</span>
      <span className={`h-2 w-2 shrink-0 rounded-full ${enabled ? "bg-amber-300" : "bg-stone-600"}`} />
    </button>
  );
}

function RangeControl({
  label,
  value,
  min = 0,
  max = 100,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs text-stone-400">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-stone-500">{value}%</span>
      </span>
      <input
        className="mt-2 w-full accent-teal-300 disabled:opacity-40"
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ResultField({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-400">{label}</span>
      <textarea
        className="digit-grid h-24 w-full rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-5 text-teal-100 outline-none focus:border-teal-300/70"
        value={value}
        readOnly
        placeholder={placeholder}
        spellCheck={false}
      />
    </label>
  );
}

function StatusStrip({
  label,
  status,
  attempts,
  tests,
  suffix,
  progress,
  message,
  t,
}: {
  label: string;
  status: string;
  attempts: string;
  tests: string;
  suffix: string;
  progress: number;
  message: string;
  t: (typeof translations)[Locale];
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/75 px-4 py-3 backdrop-blur">
      <div className="grid gap-3 lg:grid-cols-[150px_140px_190px_220px_minmax(0,1fr)] lg:items-center">
        <StatusMetric label={label} value={status} />
        <StatusMetric label={t.mr} value={tests} />
        <StatusMetric label={t.attemptCount} value={attempts} />
        <StatusMetric label={t.currentSuffix} value={suffix} />
        <div className="min-w-0">
          <div className="mb-2 flex justify-between gap-3 text-xs text-stone-400">
            <span className="truncate">{message}</span>
            <span className="font-mono">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-800">
            <div className="h-full rounded-full bg-teal-300 transition-all" style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-white/10 lg:border-r lg:pr-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="truncate font-mono text-sm text-stone-100">{value}</p>
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
    { value: "fr", label: "FR" },
    { value: "zh", label: "中文" },
  ];

  return (
    <div className="w-full shrink-0 sm:w-auto">
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-stone-500 sm:text-right">{t.language}</div>
      <div className="grid grid-cols-5 overflow-hidden rounded-md border border-white/10 bg-black/30 sm:flex">
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

const DigitGrid = memo(function DigitGrid({
  value,
  toneValue,
  tone,
  placeholder,
}: {
  value: string;
  toneValue: string;
  tone: boolean;
  placeholder: string;
}) {
  const rows = useMemo(() => value.split("\n"), [value]);
  const toneRows = useMemo(() => toneValue.split("\n"), [toneValue]);

  return (
    <div
      className={`digit-grid inline-block max-w-full overflow-hidden rounded-md border p-2 font-mono text-[6px] leading-[1.04] sm:p-3 sm:text-[8px] ${
        tone ? "border-white/10 bg-black/40" : "border-zinc-300 bg-stone-50"
      }`}
      aria-label={placeholder}
    >
      {value ? (
        <pre className="m-0 inline-block select-text whitespace-pre font-mono">
          {rows.map((row, rowIndex) => (
            <span key={rowIndex}>
              {Array.from(row).map((digit, digitIndex) => (
                <span
                  key={`${rowIndex}-${digitIndex}`}
                  style={{
                    color: tone
                      ? digitToneColor(toneRows[rowIndex]?.[digitIndex] ?? digit, Boolean(toneRows[rowIndex]?.[digitIndex]))
                      : "#0f172a",
                  }}
                >
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
});

function statusLabel(status: SearchStatus, t: (typeof translations)[Locale]): string {
  if (status === "running") return t.running;
  if (status === "found") return t.found;
  if (status === "not_found") return t.notFound;
  if (status === "cancelled") return t.cancelled;
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

function resolveLocale(option: LocaleOption, autoLocale: Locale): Locale {
  if (option !== "auto") {
    return option;
  }
  return autoLocale;
}

function detectBrowserLocale(): Locale {
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
  if (language.startsWith("fr")) {
    return "fr";
  }
  return "ja";
}
