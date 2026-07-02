#!/usr/bin/env tsx
/**
 * Automated TDD scaffolder (Matt Pocock + Hybrid Flows style)
 * Usage: npx tsx scripts/scaffold-tdd.ts "my-feature-name"
 *
 * Creates:
 * - tests/flows/my-feature-name.test.ts (with shoehorn + failing test skeleton)
 * - Optionally a src/lib/flows/my-feature-name.ts skeleton
 */

import fs from 'fs';
import path from 'path';

const feature = process.argv[2];
if (!feature) {
  console.error('Usage: npx tsx scripts/scaffold-tdd.ts "feature-name"');
  process.exit(1);
}

const kebab = feature.toLowerCase().replace(/\s+/g, '-');
const camel = kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const testDir = 'tests/flows';
const testFile = path.join(testDir, `${kebab}.test.ts`);

const testContent = `import { describe, it, expect, beforeEach } from 'vitest';
import { fromPartial } from '@total-typescript/shoehorn';

// TODO: import the thing you're testing
// import { ${camel} } from '@/lib/flows/${kebab}';

describe('${feature}', () => {
  beforeEach(() => {
    // setup with shoehorn factories
  });

  it('should [describe the smallest behavior]', () => {
    // RED: Write the assertion that will fail first
    // const result = ${camel}(fromPartial({ ... }));
    // expect(result).toBe(...);
    expect(true).toBe(false); // ← delete this line when real test is written
  });

  // Add type test example:
  // import { expectTypeOf } from 'vitest';
  // it('types are correct', () => {
  //   expectTypeOf<Something>().toMatchTypeOf<Expected>();
  // });
});
`;

fs.mkdirSync(testDir, { recursive: true });
fs.writeFileSync(testFile, testContent);

console.log(`✅ Created failing test: ${testFile}`);
console.log('Now run `npm run tdd`, make it red, then implement (green).');
console.log('Remember: Types first (discriminated unions), exhaustive checks, shoehorn for data.');