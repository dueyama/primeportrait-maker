# PrimePortrait Maker

Turn an uploaded image into a digit portrait, then search for a giant probable-prime candidate by changing only the suffix.
PrimePortrait Maker runs entirely in the browser: image processing, Miller-Rabin checks, and PNG export all happen client-side.

Important: results are not formally proven primes. They are Miller-Rabin probable-prime candidates and may still be composite.

## Features

- Upload JPG/PNG images
- Square crop workflow with horizontal/vertical focus and zoom controls
- Convert the crop into an `80x48` digit grid, for a `3,840` digit integer
- Grayscale conversion, luminance normalization, 0-9 quantization, and Floyd-Steinberg style dithering
- Plain-text digit art mode that maps brightness to digit glyph density instead of numeric order
- The first digit is forced to be non-zero so the generated integer keeps its full digit count
- Browser `BigInt` prime search in a Web Worker
- Only the final `16` digits are varied, so the portrait stays visually stable
- Probable prime and Gaussian Prime candidate mode (`n mod 4 = 3`)
- Search progress, stop/retry controls, and Miller-Rabin test count
- Copy the final probable-prime candidate as one line or wrapped to the portrait width
- Save the candidate digit portrait as a PNG
- Japanese, English, Chinese, and automatic language selection

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Canvas API
- Web Worker
- BigInt

No Python backend or Vercel Functions are required for the MVP.

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

On macOS, you can also double-click:

```text
OpenPrimePortrait.command
```

## Build

```bash
npm run typecheck
npm run build
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository from Vercel.
3. Keep the framework preset as `Next.js`.
4. Deploy.

Because the prime search runs in the browser, the app avoids serverless function time limits on Vercel Hobby.

## Search Parameters

Current MVP defaults:

```text
Grid: 80x48
Total digits: 3,840
Variable suffix: 16 digits
Max attempts: 100,000
```

Prime search time depends heavily on the browser, CPU, selected image, and luck. If the search reaches the attempt limit, use retry to try another suffix range.

## How Prime Search Works

1. The digit grid is joined into one decimal string and treated as a browser `BigInt`.
2. To keep the portrait stable, all upper digits are fixed and only the final `16` digits are changed.
3. The worker starts near the original suffix plus a random seed, then scans candidate suffixes.
4. Suffixes ending in an even digit or `5` are skipped immediately.
5. Candidates divisible by small primes up to `997` are filtered before expensive testing.
6. Remaining candidates are checked with Miller-Rabin bases `2, 3, 5, 7`.
7. Miller-Rabin is probabilistic: candidates that fail are definitely composite, but candidates that pass are strong probable primes, not formally proven primes.
8. Gaussian Prime mode adds the condition `n mod 4 = 3`.

For a random `3,840` digit number, prime density is roughly `1 / ln(10^3840)`, so a normal prime often needs a few thousand plausible candidates on average. Gaussian Prime mode accepts about half of those primes, so it can take roughly twice as many candidates.

This is close in spirit to how cryptographic prime generation starts: many systems first use fast probable-prime tests. For cryptographic use, however, implementations use more rounds, stricter standards, and sometimes separate proof or validation steps. PrimePortrait Maker is a math-art app, not a cryptographic prime generator.

## Notes

- This is an experimental math-art tool, not a cryptographic prime generator.
- Miller-Rabin is used as a probabilistic primality test, so app results should be read as probable-prime candidates that may still be composite.
- Image processing and prime search run on the local machine in the browser, so performance depends on the user's CPU, browser, and current system load.
- Uploaded images stay local in the browser and are not sent to a server by this app.
