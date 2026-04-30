# PrimePortrait Maker

画像を80x48の数字グリッドに変換し、最後の16桁だけを変えて3,840桁の巨大素数を探すNext.jsアプリです。

## 特徴

- JPG/PNGアップロード
- 1:1切り抜き位置調整UI
- Canvas APIによる正方形クロップ、グレースケール化、0〜9量子化、Floyd-Steinberg系ディザリング
- 小素数ふるい + ブラウザ `BigInt` + Web WorkerによるMiller-Rabin確率素数判定
- 通常素数 / Gaussian Prime `n mod 4 = 3` モード
- 数字グリッドPNGダウンロード
- 完成した巨大整数の改行なし/改行付きコピー

## ローカル起動

Finderから起動する場合は `OpenPrimePortrait.command` をダブルクリックします。

ターミナルから起動する場合:

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## Vercel公開

1. このディレクトリをGitHubリポジトリとしてpushします。
2. Vercelで `Add New Project` からGitHubリポジトリをImportします。
3. Framework Presetは `Next.js` のままでDeployします。

このMVPはPython APIやVercel Functionsを使いません。画像処理と素数探索はブラウザ側で完結するため、Vercel HobbyのFunction実行時間制限を避けられます。

## 探索パラメータ

- Grid: `80x48`
- Total digits: `3,840`
- Variable suffix: `16` digits
- Max attempts: `100,000`

探索上限に到達した場合は、再探索で別のsuffix候補範囲を試してください。
