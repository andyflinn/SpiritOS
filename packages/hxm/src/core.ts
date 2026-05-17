// packages/hxm/src/core.ts

function isValidHxmName(key) {
  return /^[a-z]+$/.test(key);
}

function validateDocument(doc) {
  if (typeof doc !== 'object' || doc === null) {
    console.warn("[hxm] Document must be an object");
    return false;
  }

  for (const key in doc) {
    if (!isValidHxmName(key)) {
      console.warn(`[hxm] Invalid key: "${key}" — must contain only lowercase a-z`);
      return false;
    }
  }
  return true;
}

function applyTransform(current, request) {
  return { ...current, ...request };
}

module.exports = {
  isValidHxmName,
  validateDocument,
  applyTransform
};