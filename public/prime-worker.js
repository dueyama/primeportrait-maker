const PROGRESS_INTERVAL_MS = 250;
const YIELD_INTERVAL_MS = 35;
const SIEVE_PRIMES = makeSmallPrimes(997).filter((value) => value !== 2 && value !== 5);
const SIEVE_PRIME_BIGINTS = SIEVE_PRIMES.map((value) => BigInt(value));
const MILLER_RABIN_BASES = [2n, 3n, 5n, 7n];
let activeSearch = null;

self.onmessage = (event) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.type === "cancel") {
    if (activeSearch) {
      activeSearch.cancelled = true;
    }
    return;
  }

  if (message.type !== "search") {
    return;
  }

  const token = { cancelled: false };
  if (activeSearch) {
    activeSearch.cancelled = true;
  }
  activeSearch = token;

  searchPrime(message, token).catch((error) => {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  });
};

async function searchPrime({ digits, suffixDigits, maxAttempts, gaussian, seed }, token) {
  if (typeof digits !== "string" || digits.length <= suffixDigits) {
    throw new Error("Digit string is too short for the requested suffix size.");
  }

  const prefix = digits.slice(0, -suffixDigits);
  const originalSuffix = digits.slice(-suffixDigits);
  const suffixLimit = 10n ** BigInt(suffixDigits);
  let cursor = normalizeSuffix(BigInt(originalSuffix) + BigInt(seed || 0), suffixLimit);
  self.postMessage({
    type: "progress",
    attempts: 0,
    probablePrimeTests: 0,
    progress: 0,
    currentSuffix: originalSuffix,
  });
  const prefixTerms = buildPrefixTerms(prefix, suffixDigits);
  const suffixResidues = buildSuffixResidues(cursor);
  let probablePrimeTests = 0;
  let nextProgressAt = performance.now() + PROGRESS_INTERVAL_MS;
  let nextYieldAt = performance.now() + YIELD_INTERVAL_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (token.cancelled) {
      self.postMessage({
        type: "cancelled",
        attempts: attempt - 1,
        probablePrimeTests,
      });
      if (activeSearch === token) {
        activeSearch = null;
      }
      return;
    }

    const previous = cursor;
    cursor = nextCandidateSuffix(cursor, suffixLimit);
    updateSuffixResidues(suffixResidues, cursor - previous);
    const suffix = cursor.toString().padStart(suffixDigits, "0");

    if (passesSmallPrimeSieve(prefixTerms, suffixResidues)) {
      const candidateText = prefix + suffix;
      const candidate = BigInt(candidateText);
      probablePrimeTests += 1;

      if ((!gaussian || candidate % 4n === 3n) && isProbablePrime(candidate)) {
        self.postMessage({
          type: "found",
          prime: candidateText,
          suffix,
          digits: candidateText.length,
          attempts: attempt,
          probablePrimeTests,
          gaussian,
        });
        if (activeSearch === token) {
          activeSearch = null;
        }
        return;
      }
    }

    const now = performance.now();
    if (now >= nextProgressAt || attempt === maxAttempts) {
      self.postMessage({
        type: "progress",
        attempts: attempt,
        probablePrimeTests,
        progress: attempt / maxAttempts,
        currentSuffix: suffix,
      });
      nextProgressAt = now + PROGRESS_INTERVAL_MS;
    }

    if (now >= nextYieldAt) {
      await sleep(0);
      nextYieldAt = performance.now() + YIELD_INTERVAL_MS;
    }
  }

  self.postMessage({
    type: "not_found",
    attempts: maxAttempts,
  });
  if (activeSearch === token) {
    activeSearch = null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSuffix(value, limit) {
  let normalized = value % limit;
  if (normalized < 0n) {
    normalized += limit;
  }
  return normalized;
}

function nextCandidateSuffix(value, limit) {
  let next = normalizeSuffix(value + 1n, limit);
  while (true) {
    const lastDigit = next % 10n;
    if (lastDigit !== 0n && lastDigit !== 2n && lastDigit !== 4n && lastDigit !== 5n && lastDigit !== 6n && lastDigit !== 8n) {
      return next;
    }
    next = normalizeSuffix(next + 1n, limit);
  }
}

function isProbablePrime(n) {
  if (n < 2n) {
    return false;
  }
  if (n === 2n || n === 3n || n === 5n) {
    return true;
  }
  if (n % 2n === 0n || n % 5n === 0n) {
    return false;
  }

  let d = n - 1n;
  let s = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    s += 1;
  }

  for (const base of MILLER_RABIN_BASES) {
    if (base >= n - 2n) {
      continue;
    }
    let x = modPow(base, d, n);
    if (x === 1n || x === n - 1n) {
      continue;
    }
    let passed = false;
    for (let r = 1; r < s; r += 1) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) {
        passed = true;
        break;
      }
    }
    if (!passed) {
      return false;
    }
  }

  return isStrongLucasProbablePrime(n);
}

function isStrongLucasProbablePrime(n) {
  if (isPerfectSquare(n)) {
    return false;
  }

  let dParameter = 5n;
  while (true) {
    const jacobiValue = jacobi(dParameter, n);
    if (jacobiValue === -1) {
      break;
    }
    if (jacobiValue === 0) {
      if (absBigInt(dParameter) === n) {
        dParameter = dParameter > 0n ? -(dParameter + 2n) : -dParameter + 2n;
        continue;
      }
      return false;
    }
    dParameter = dParameter > 0n ? -(dParameter + 2n) : -dParameter + 2n;
  }

  const pParameter = 1n;
  const qParameter = (1n - dParameter) / 4n;
  let lucasExponent = n + 1n;
  let shiftCount = 0;
  while (lucasExponent % 2n === 0n) {
    lucasExponent /= 2n;
    shiftCount += 1;
  }

  let { u, v, qPower } = lucasSequenceMod(n, pParameter, qParameter, lucasExponent);
  if (u === 0n || v === 0n) {
    return true;
  }

  for (let index = 1; index < shiftCount; index += 1) {
    v = positiveBigIntMod((v * v) - (2n * qPower), n);
    qPower = positiveBigIntMod(qPower * qPower, n);
    if (v === 0n) {
      return true;
    }
  }

  return false;
}

function lucasSequenceMod(modulus, pParameter, qParameter, exponent) {
  const dParameter = (pParameter * pParameter) - (4n * qParameter);
  let u = 0n;
  let v = 2n;
  let qPower = 1n;

  for (const bit of exponent.toString(2)) {
    u = positiveBigIntMod(u * v, modulus);
    v = positiveBigIntMod((v * v) - (2n * qPower), modulus);
    qPower = positiveBigIntMod(qPower * qPower, modulus);

    if (bit === "1") {
      const nextU = div2Mod((pParameter * u) + v, modulus);
      const nextV = div2Mod((dParameter * u) + (pParameter * v), modulus);
      u = nextU;
      v = nextV;
      qPower = positiveBigIntMod(qPower * qParameter, modulus);
    }
  }

  return { u, v, qPower };
}

function div2Mod(value, modulus) {
  let adjusted = value;
  if (adjusted % 2n !== 0n) {
    adjusted += modulus;
  }
  return positiveBigIntMod(adjusted / 2n, modulus);
}

function jacobi(value, modulus) {
  let a = positiveBigIntMod(value, modulus);
  let n = modulus;
  let result = 1;

  while (a !== 0n) {
    while (a % 2n === 0n) {
      a /= 2n;
      const nMod8 = n % 8n;
      if (nMod8 === 3n || nMod8 === 5n) {
        result = -result;
      }
    }

    const previousA = a;
    a = n;
    n = previousA;

    if (a % 4n === 3n && n % 4n === 3n) {
      result = -result;
    }
    a %= n;
  }

  return n === 1n ? result : 0;
}

function isPerfectSquare(value) {
  if (value < 0n) {
    return false;
  }
  if (value < 2n) {
    return true;
  }

  const residue = value % 16n;
  if (residue !== 0n && residue !== 1n && residue !== 4n && residue !== 9n) {
    return false;
  }

  let root = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  let next = (root + (value / root)) / 2n;
  while (next < root) {
    root = next;
    next = (root + (value / root)) / 2n;
  }

  return root * root === value;
}

function buildPrefixTerms(prefix, suffixDigits) {
  const residues = new Array(SIEVE_PRIMES.length).fill(0);

  for (let charIndex = 0; charIndex < prefix.length; charIndex += 1) {
    const digit = prefix.charCodeAt(charIndex) - 48;
    for (let i = 0; i < SIEVE_PRIMES.length; i += 1) {
      const prime = SIEVE_PRIMES[i];
      residues[i] = ((residues[i] * 10) + digit) % prime;
    }
  }

  for (let i = 0; i < SIEVE_PRIMES.length; i += 1) {
    const prime = SIEVE_PRIMES[i];
    let pow10 = 1;
    for (let power = 0; power < suffixDigits; power += 1) {
      pow10 = (pow10 * 10) % prime;
    }
    residues[i] = (residues[i] * pow10) % prime;
  }

  return residues;
}

function buildSuffixResidues(suffix) {
  return SIEVE_PRIME_BIGINTS.map((prime) => Number(suffix % prime));
}

function updateSuffixResidues(residues, delta) {
  if (delta > -1000n && delta < 1000n) {
    const deltaNumber = Number(delta);
    for (let i = 0; i < residues.length; i += 1) {
      residues[i] = positiveMod(residues[i] + deltaNumber, SIEVE_PRIMES[i]);
    }
    return;
  }

  for (let i = 0; i < residues.length; i += 1) {
    const prime = SIEVE_PRIMES[i];
    const deltaResidue = Number(delta % SIEVE_PRIME_BIGINTS[i]);
    residues[i] = positiveMod(residues[i] + deltaResidue, prime);
  }
}

function passesSmallPrimeSieve(prefixTerms, suffixResidues) {
  for (let i = 0; i < SIEVE_PRIMES.length; i += 1) {
    if ((prefixTerms[i] + suffixResidues[i]) % SIEVE_PRIMES[i] === 0) {
      return false;
    }
  }
  return true;
}

function positiveMod(value, modulus) {
  const result = value % modulus;
  return result < 0 ? result + modulus : result;
}

function positiveBigIntMod(value, modulus) {
  const result = value % modulus;
  return result < 0n ? result + modulus : result;
}

function absBigInt(value) {
  return value < 0n ? -value : value;
}

function makeSmallPrimes(limit) {
  const primes = [];
  for (let candidate = 3; candidate <= limit; candidate += 2) {
    let prime = true;
    for (const divisor of primes) {
      if (divisor * divisor > candidate) {
        break;
      }
      if (candidate % divisor === 0) {
        prime = false;
        break;
      }
    }
    if (prime) {
      primes.push(candidate);
    }
  }
  return primes.filter((value) => value !== 5);
}

function modPow(base, exponent, modulus) {
  if (modulus === 1n) {
    return 0n;
  }
  let result = 1n;
  let value = base % modulus;
  let power = exponent;

  while (power > 0n) {
    if (power % 2n === 1n) {
      result = (result * value) % modulus;
    }
    value = (value * value) % modulus;
    power /= 2n;
  }

  return result;
}
