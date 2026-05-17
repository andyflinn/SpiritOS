const fs = require('fs');

const current = JSON.parse(fs.readFileSync('test/state.json', 'utf-8'));
const request = JSON.parse(fs.readFileSync('test/request.json', 'utf-8'));

console.log("=== Current ===");
console.dir(current, { depth: null });

console.log("\n=== Request ===");
console.dir(request, { depth: null });

const newState = { ...current, ...request };

console.log("\n=== New State ===");
console.dir(newState, { depth: null });

console.log("\n✅ Simple merge test successful.");