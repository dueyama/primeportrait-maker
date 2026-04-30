# PrimePortrait Maker

Turn an uploaded image into a digit portrait, then search for a giant prime by changing only the suffix.  
PrimePortrait Maker runs entirely in the browser: image processing, Miller-Rabin checks, and PNG export all happen client-side.

## Features

- Upload JPG/PNG images
- Square crop workflow with horizontal/vertical focus controls
- Convert the crop into an `80x48` digit grid, for a `3,840` digit integer
- Grayscale conversion, luminance normalization, 0-9 quantization, and Floyd-Steinberg style dithering
- Browser `BigInt` prime search in a Web Worker
- Only the final `16` digits are varied, so the portrait stays visually stable
- Normal prime and Gaussian Prime mode (`n mod 4 = 3`)
- Search progress, stop/retry controls, and Miller-Rabin test count
- Copy the final prime as one line or wrapped to the portrait width
- Save the prime digit portrait as a PNG
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

## Notes

- This is an experimental math-art tool, not a cryptographic prime generator.
- Miller-Rabin is used as a probabilistic primality test.
- Uploaded images stay local in the browser and are not sent to a server by this app.

