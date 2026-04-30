const PROGRESS_EVERY = 250;
const SMALL_PRIMES = makeSmallPrimes(997).map((value) => BigInt(value));
const MILLER_RABIN_BASES = [2n, 3n, 5n, 7n, 11n, 13n];

self.onmessage = (event) => {
  const message = event.data;
  if (!message || message.type !== "search") {
    return;
  }

  try {
    searchPrime(message);
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

function searchPrime({ digits, suffixDigits, maxAttempts, gaussian, seed }) {
  if (typeof digits !== "string" || digits.length <= suffixDigits) {
    throw new Error("Digit string is too short for the requested suffix size.");
  }

  const prefix = digits.slice(0, -suffixDigits);
  const originalSuffix = digits.slice(-suffixDigits);
  const suffixLimit = 10n ** BigInt(suffixDigits);
  let cursor = normalizeSuffix(BigInt(originalSuffix) + BigInt(seed || 0), suffixLimit);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    cursor = nextCandidateSuffix(cursor, suffixLimit);
    const suffix = cursor.toString().padStart(suffixDigits, "0");
    const candidateText = prefix + suffix;

    if (candidateText[0] === "0") {
      continue;
    }

    const candidate = BigInt(candidateText);
    if ((!gaussian || candidate % 4n === 3n) && isProbablePrime(candidate)) {
      self.postMessage({
        type: "found",
        prime: candidateText,
        suffix,
        digits: candidateText.length,
        attempts: attempt,
        gaussian,
      });
      return;
    }

    if (attempt % PROGRESS_EVERY === 0) {
      self.postMessage({
        type: "progress",
        attempts: attempt,
        progress: attempt / maxAttempts,
        currentSuffix: suffix,
      });
    }
  }

  self.postMessage({
    type: "not_found",
    attempts: maxAttempts,
  });
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

  for (const prime of SMALL_PRIMES) {
    if (n === prime) {
      return true;
    }
    if (n % prime === 0n) {
      return false;
    }
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

  return true;
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
