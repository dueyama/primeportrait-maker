# References and Related Work

This page collects background references for PrimePortrait Maker. The README keeps a short related-work section; this file keeps the broader bibliography without making the project introduction too heavy.

PrimePortrait Maker turns an image crop into an `80x48` decimal digit grid, treats the grid as a `3,840` digit integer, and searches for a probable-prime candidate by varying only the final suffix digits. The current browser worker uses a small-prime sieve, Miller-Rabin bases `2, 3, 5, 7`, and a Selfridge-style strong Lucas probable-prime test. The app should therefore be described as producing probable-prime candidates, not formal primality proofs, and it should not be described as a full Baillie-PSW implementation.

## Prime Portraits and Related Projects

- Zachary Abel, ["Prime Portraits"](https://archive.bridgesmathart.org/2016/bridges2016-359.html), Proceedings of Bridges 2016, pp. 359-362, 2016. This is the direct conceptual predecessor: it arranges digits in visual grids, uses digit values as shades, and searches for large primes that depict recognizable subjects.
- Roland Meertens, ["Painting by Prime Number"](https://www.pinchofintelligence.com/painting-by-prime-number/), 2018. A recreation and extension of Abel's idea that converts source images into digit images, perturbs them, and searches for probable-prime portraits.
- Will Dean, ["Picturesque Primes"](https://willdean.rocks/primes), 2023. A student project inspired by Abel's work; it presents digit-grid images whose full left-to-right, top-to-bottom readings are prime numbers and discusses Miller-Rabin testing.
- Herbie Bradley, [`prime_search.py`](https://gist.github.com/herbiebradley/d31e87ebf1e4c325a2658ed1df21f171), 2018. A compact implementation note for turning rectangular number art into probable-prime number art by searching local digit substitutions.
- Geovane Fedrecheski, [`primg`](https://github.com/geonnave/primg). A related browser project that generates primes whose binary representation looks like an image. It is not a decimal digit-portrait method, but it sits close to the same image-as-prime idea.

## Image Quantization and Digit Art

- Robert W. Floyd and Louis Steinberg, ["An Adaptive Algorithm for Spatial Grey Scale"](https://cir.nii.ac.jp/crid/1573105974148265216?lang=en), Proceedings of the Society for Information Display, 17, pp. 75-77, 1976. The classic error-diffusion dithering reference, also cited by Abel.
- Robert Ulichney, [*Digital Halftoning*](https://mitpress.mit.edu/9780262526470/digital-halftoning/), MIT Press, 1987. A broader reference for halftoning and the visual approximation of continuous-tone images with limited output elements.
- Xuemiao Xu, Linling Zhang, and Tien-Tsin Wong, ["Structure-based ASCII Art"](https://doi.org/10.1145/1778765.1778789), ACM Transactions on Graphics, 29(4), Article 52, 2010. Not a prime-number paper, but useful background for image representation with text glyphs and character shapes.

## Probable-Prime Testing

- Gary L. Miller, ["Riemann's Hypothesis and Tests for Primality"](https://doi.org/10.1016/S0022-0000(76)80043-8), Journal of Computer and System Sciences, 13(3), pp. 300-317, 1976. One root of what became the Miller-Rabin primality test.
- Michael O. Rabin, ["Probabilistic Algorithm for Testing Primality"](https://doi.org/10.1016/0022-314X(80)90084-0), Journal of Number Theory, 12(1), pp. 128-138, 1980. The probabilistic primality-testing reference cited by Abel and directly relevant to probable-prime wording.
- Robert Baillie and Samuel S. Wagstaff Jr., ["Lucas Pseudoprimes"](https://www.ams.org/mcom/1980-35-152/S0025-5718-1980-0583518-6/), Mathematics of Computation, 35(152), pp. 1391-1417, 1980. A standard Lucas pseudoprime reference for the strong Lucas side of the app's test pipeline.
- Carl Pomerance, J. L. Selfridge, and Samuel S. Wagstaff Jr., ["The Pseudoprimes to `25 * 10^9`"](https://www.ams.org/mcom/1980-35-151/S0025-5718-1980-0572872-7/), Mathematics of Computation, 35(151), pp. 1003-1026, 1980. Useful background for combined pseudoprime tests and the historical path toward Baillie-PSW-style testing.
- Robert Baillie, Andrew Fiori, and Samuel S. Wagstaff Jr., ["Strengthening the Baillie-PSW Primality Test"](https://arxiv.org/abs/2006.14425), Mathematics of Computation, 90(330), pp. 1931-1955, 2021. A modern reference for Baillie-PSW-style tests. It is background only; PrimePortrait Maker currently runs a fixed-base Miller-Rabin check plus a strong Lucas check, not a named full BPSW implementation.

## Prime Density and Gaussian Primes

- Tom M. Apostol, [*Introduction to Analytic Number Theory*](https://link.springer.com/book/10.1007/978-1-4757-5579-4), Springer, 1976. A standard reference for the prime number theorem and the `1 / log N` density heuristic used to estimate search effort.
- G. H. Hardy and E. M. Wright, [*An Introduction to the Theory of Numbers*](https://academic.oup.com/book/54489), Oxford University Press. A broad classical number-theory reference for prime distribution and elementary number theory.
- Kenneth Ireland and Michael Rosen, [*A Classical Introduction to Modern Number Theory*](https://link.springer.com/book/10.1007/978-1-4757-2103-4), Springer, 2nd ed., 1990. Useful background for congruences, quadratic reciprocity, and Gaussian integers.

PrimePortrait Maker's Gaussian Prime mode applies the condition `n mod 4 = 3` to the ordinary integer represented by the digit portrait. This is related to the standard fact that a rational prime `p` remains prime in the Gaussian integers exactly when `p = 3 mod 4`. Abel's Gaussian-prime example is broader because it forms a complex Gaussian integer `A + iB` from two digit-grid numbers.

## Formal Primality Proving

- A. O. L. Atkin and Francois Morain, ["Elliptic Curves and Primality Proving"](https://www.ams.org/mcom/1993-61-203/S0025-5718-1993-1199989-X/), Mathematics of Computation, 61(203), pp. 29-68, 1993. The classic ECPP reference for formal primality proving.
- Marcel Martin, [Primo](https://www.ellipsa.eu/public/primo/primo.html). ECPP-based primality-proving software that can produce primality certificates for positive odd integers.
- [PARI/GP arithmetic functions documentation](https://pari.math.u-bordeaux.fr/dochtml/html-stable/Arithmetic_functions.html). Practical reference for the distinction between fast probable-prime tests such as `ispseudoprime` and proof-oriented functions such as `isprime` and `primecert`.
