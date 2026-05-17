// packages/hxm/src/core.ts

export type HxmName = string; // lowercase a-z only

export interface HxmDocument {
  [key: HxmName]: any;
}

/** Check if a key is a valid hxm name */
export function isValidHxmName(key: string): boolean {
  return /^[a-z]+$/.test(key);
}

/** Validate entire document */
export function validateDocument(doc: any): boolean {
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

/** Simple merge transform: request applied on top of current state */
export function applyTransform(current: HxmDocument, request: HxmDocument): HxmDocument {
  return { ...current, ...request };
}