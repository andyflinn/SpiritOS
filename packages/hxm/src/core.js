// packages/hxm/src/core.js

function isValidHxmName(key) {
  return /^[a-z]+$/.test(key);
}

const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxy"; // index 0=z, 1=a, ..., 25=y

/** Integer → custom base-26 string (z=0, a=1, ..., y=25) */
function numberToBase26(n) {
  if (n < 0) return null;
  if (n === 0) return "z";

  let result = "";
  let num = n;

  while (num > 0) {
    const remainder = num % 26;                    // 0 to 25
    result = BASE26_DIGITS[remainder] + result;
    num = Math.floor(num / 26);
  }

  return result;
}

/** base-26 string → integer */
function base26ToNumber(str) {
  if (!/^[a-z]+$/.test(str)) return null;

  let num = 0;
  for (let char of str) {
    const digit = BASE26_DIGITS.indexOf(char);
    if (digit === -1) return null;
    num = num * 26 + digit;
  }
  return num;
}

/** Transform function with null = delete */
function applyTransform(current, request, path = '') {
  if (typeof current !== 'object' || current === null) current = {};

  const result = { ...current };

  for (const key in request) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!isValidHxmName(key)) {
      return {
        success: false,
        error: `Invalid key "${key}" at path "${currentPath}" — must be lowercase a-z only`
      };
    }

    const value = request[key];

    if (value === null) {
      delete result[key];
    } else if (typeof value === 'object' && value !== null) {
      const nested = applyTransform(result[key] || {}, value, currentPath);
      if (!nested.success) return nested;
      result[key] = nested.state;
    } else {
      result[key] = value;
    }
  }

  return { success: true, state: result };
}

module.exports = {
  isValidHxmName,
  applyTransform,
  numberToBase26,
  base26ToNumber
};