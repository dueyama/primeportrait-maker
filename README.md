# PrimePortrait Maker

Turn an uploaded image into a digit portrait, then search for a giant probable-prime candidate by changing only the suffix.
PrimePortrait Maker runs entirely in the browser: image processing, Miller-Rabin plus strong Lucas checks, and PNG export all happen client-side.

Important: results are not formally proven primes. They are Miller-Rabin plus strong Lucas probable-prime candidates and may still be composite.

## Features

- Upload JPG/PNG/WebP images
- Square crop workflow with horizontal/vertical focus and zoom controls
- Convert the crop into an `80x48` digit grid, for a `3,840` digit integer
- Grayscale conversion, luminance normalization, 0-9 quantization, and Floyd-Steinberg style dithering
- Plain-text digit art mode that maps brightness to digit glyph density instead of numeric order
- The first digit is forced to be non-zero so the generated integer keeps its full digit count
- Browser `BigInt` prime search in a Web Worker
- Only the final `16` digits are varied, so the portrait stays visually stable
- Probable prime and Gaussian Prime candidate mode (`n mod 4 = 3`)
- Search progress, stop/retry controls, Miller-Rabin test count, and strong Lucas post-checking
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

No backend service is required for the MVP.

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

## Version History

Version numbers are assigned from the repository history, with the first pushed commit treated as `Ver. 0.0`. Major versions mark product-level changes in workflow or prime-candidate semantics. Minor versions mark feature, UI, and output refinements inside the same product line. `Ver. 2.5` is the current working version in this tree.

- Ver. 2.5 (2026-05-12): Surface the Miller-Rabin -> strong Lucas test pipeline in the app.
- Ver. 2.4 (2026-05-12): Add direct crop preview controls: drag and wheel on desktop, drag and pinch on mobile.
- Ver. 2.3 (2026-05-12): Align plain digit art and tone-follow coloring with practical digit ink density; show white-background black digits when tone is off.
- Ver. 2.2 (2026-05-11, `fbbdb79`): Add WebP upload support and notes about external formal primality proofs.
- Ver. 2.1 (2026-05-01, `1153df1`): Add French localization.
- Ver. 2.0 (2026-05-01, `aa0cf7b`): Add a strong Lucas probable-prime post-check after Miller-Rabin.
- Ver. 1.6 (2026-04-30, `afc4833`): Refine tone display controls.
- Ver. 1.5 (2026-04-30, `ff4b62d`): Add padding around exported PNG images.
- Ver. 1.4 (2026-04-30, `a0d4271`): Show the found candidate grid after search.
- Ver. 1.3 (2026-04-30, `69c2edb`): Clarify that results are probable-prime candidates, not formal proofs.
- Ver. 1.2 (2026-04-30, `2da3b7c`): Improve digit art mapping.
- Ver. 1.0 (2026-04-30, `359c307`): Redesign the PrimePortrait workflow UI.
- Ver. 0.4 (2026-04-30, `a3b2bb6`): Reduce the portrait digit grid size.
- Ver. 0.3 (2026-04-30, `f2109a4`): Stabilize browser-based prime search.
- Ver. 0.2 (2026-04-30, `a3c2c7c`): Polish layout and localization.
- Ver. 0.1 (2026-04-30, `fc393b5`): Refine the digit portrait workflow.
- Ver. 0.0 (2026-04-30, `c3773d6`): Build the PrimePortrait Maker MVP.

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
7. Candidates that pass Miller-Rabin are then checked with a Selfridge-style strong Lucas probable-prime test.
8. Miller-Rabin and Lucas are probabilistic: candidates that fail are definitely composite, but candidates that pass are strong probable primes, not formally proven primes.
9. Gaussian Prime mode adds the condition `n mod 4 = 3`.

For a random `3,840` digit number, prime density is roughly `1 / ln(10^3840)`, so a normal prime often needs a few thousand plausible candidates on average. Gaussian Prime mode accepts about half of those primes, so it can take roughly twice as many candidates.

This is close in spirit to how cryptographic prime generation starts: many systems first use fast probable-prime tests. For cryptographic use, however, implementations use more rounds, stricter standards, and sometimes separate proof or validation steps. PrimePortrait Maker is a math-art app, not a cryptographic prime generator.

## Related Work

PrimePortrait Maker belongs to the same math-art family as earlier prime-portrait projects, but its search strategy is intentionally different: it keeps the visible portrait stable and varies only the final suffix digits.

- Zachary Abel, ["Prime Portraits"](https://archive.bridgesmathart.org/2016/bridges2016-359.html), Bridges 2016. This paper introduces the prime-portrait idea and constructs large primes whose digit grids depict recognizable subjects.
- Roland Meertens, ["Painting by Prime Number"](https://www.pinchofintelligence.com/painting-by-prime-number/). This recreation turns source images into 10-color digit images, perturbs them with small noise, and searches for probable-prime portraits.
- Will Dean, ["Picturesque Primes"](https://willdean.rocks/primes). This later project presents digit-grid images inspired by Abel's work and discusses Miller-Rabin testing and possible ECPP certification.
- Herbie Bradley, [`prime_search.py`](https://gist.github.com/herbiebradley/d31e87ebf1e4c325a2658ed1df21f171). This implementation note explores making rectangular number art prime by searching local digit changes.

For a broader bibliography covering image quantization, probable-prime tests, Gaussian primes, and primality proving, see [References and Related Work](docs/references.md).

## Formal Primality Proofs

PrimePortrait Maker does not prove final primality inside the browser. It produces a strong probable-prime candidate that can be copied as an unwrapped decimal integer and checked with external primality-proving software.

For a formal proof, use an external ECPP/primality-proving tool outside this app. Practical options include:

- [Primo](https://www.ellipsa.eu/pages/primo.html), an ECPP-based primality prover that produces primality certificates.
- PARI/GP's `ecpp`, `ecppisvalid`, and `ecppexport` functions, where available.
- Python-assisted workflows that call an external prover or verify an existing certificate. Libraries such as `gmpy2` are useful for arbitrary-precision arithmetic and probable-prime checks, but they are not a drop-in ECPP proof generator for this browser app.

For the default `3,840` digit candidates, proof time can be long and depends heavily on the prover, hardware, and candidate. Keeping ECPP outside the browser preserves this app's local, client-only workflow while still allowing users to certify interesting results separately.

## Notes

- This is an experimental math-art tool, not a cryptographic prime generator.
- Miller-Rabin and strong Lucas are used as probabilistic primality tests, so app results should be read as probable-prime candidates that may still be composite.
- Image processing and prime search run on the local machine in the browser, so performance depends on the user's CPU, browser, and current system load.
- No backend or serverless function is needed for the current app.
- Uploaded images stay local in the browser and are not sent to a server by this app.

## License

MIT License. See [LICENSE](./LICENSE).
