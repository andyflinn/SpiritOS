#!/usr/bin/env node
// packages/hxm/src/cli.ts

import fs from 'fs';
import { validateDocument, applyTransform } from './core.js';

const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error("Usage: hxm <server-state.json> <request.json>");
  console.error("Example: hxm state.json request.json");
  process.exit(1);
}

const [stateFile, requestFile] = args;

try {
  const stateRaw = fs.readFileSync(stateFile, 'utf-8');
  const requestRaw = fs.readFileSync(requestFile, 'utf-8');

  const current = JSON.parse(stateRaw);
  const request = JSON.parse(requestRaw);

  console.log("=== Current Server State ===");
  console.dir(current, { depth: null });

  if (!validateDocument(current)) {
    console.error("❌ Current state validation failed");
    process.exit(1);
  }

  if (!validateDocument(request)) {
    console.error("❌ Request validation failed");
    process.exit(1);
  }

  console.log("\n=== Incoming Request ===");
  console.dir(request, { depth: null });

  const newState = applyTransform(current, request);

  console.log("\n=== New State After Transform ===");
  console.dir(newState, { depth: null });

  console.log("\n✅ hxm transform completed successfully.");

} catch (err: any) {
  console.error("Error:", err.message);
  process.exit(1);
}