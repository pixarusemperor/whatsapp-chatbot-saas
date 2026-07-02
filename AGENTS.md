<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hybrid Flows Upgrade Rules (Matt Pocock + Automated TDD)

This project is executing a **hybrid visual flows upgrade** (visual editor like approach #9 + state-ready architecture like #5) using the unofficial WasenderApi.

**Goal of Pocock rigor**: The types themselves are the living documentation of all architectural decisions. Other AI agents (or humans) should be able to understand the entire system — unification, variants, rotation, response tracking, flows — simply by reading the type definitions and letting the compiler reveal exhaustiveness, constraints, and impossible states. No hidden decisions in comments or prose.

## Mandatory Process for EVERY Feature Addition

You **MUST** follow this automated TDD loop. Never write implementation code before a failing test exists.

### The Loop (Red → Green → Refactor)
1. **Red**: Write the smallest failing test first (Vitest + @total-typescript/shoehorn for type-safe mocks/factories).
   - Also write type tests using `expectTypeOf` when types are involved (these document decisions).
2. **Confirm red** by running the test.
3. **Design types first** (Matt Pocock / Total TypeScript style):
   - Use discriminated unions for **everything** that can vary: nodes, steps, triggers, variants, experiments, responses.
   - Branded/nominal types for safety (NodeId, VariantId, TriggerId, etc.).
   - Exhaustive switches + `never` checks everywhere.
   - Make types encode decisions (e.g. `type AutomationTrigger = { kind: 'single'; sequenceId: ... } | { kind: 'experiment'; variants: readonly Variant[] }`).
   - Add JSDoc on types explaining *why* the shape was chosen (visible to agents).
4. **Green**: Implement the *minimal* code to make the test pass.
5. **Refactor**: Improve using types. Make switches exhaustive. Remove casts. Widen only when the compiler forces you.
6. Run full relevant tests + `npm run typecheck`.
7. Verify with integration (webhook simulation scripts).

### Automation
- Use `npm run tdd` (starts vitest watch + typecheck).
- Use `npx tsx scripts/scaffold-tdd.ts "my-feature"` to bootstrap test + skeleton.
- **All code** touching automations, triggers, sequences, variants, flows, or chatbot execution **must** follow Pocock style — even outside `src/lib/flows/`. This is how other agents will understand decisions without context bloat.

## Matt Pocock / Total TypeScript Principles (Mandatory)
- Types first, implementation second. The compiler is your pair programmer and living spec.
- Discriminated unions + exhaustive checking **everywhere** (FlowNode, Trigger, Variant, Step, etc.).
- Branded types for identifiers and domain concepts.
- Shoehorn for all test data (never `as any` or loose casts in production code).
- Type tests (`expectTypeOf`) are first-class documentation of contracts and decisions.
- Prefer narrow, precise types. Use `satisfies`, template literal types, and utility types to make impossible states unrepresentable.
- Exhaustive functions + `const _exhaustive: never = ...` to force handling of all cases (reveals architecture).

Any code that violates this (loose types, skipped exhaustive checks, implementation before types) will be rejected. Other agents rely on these types to "see" what has been decided and what is still linear vs. stateful.

## Current Hybrid Goal
Deliver beautiful visual canvas for sequences fast (preserving current linear execution), while the model and types are designed so full stateful branching (flow_runs, conditions, memory, variant experiments) can be turned on later with low cost.

**How other agents understand progress**:
- Read the types in `src/lib/flows/` and `src/lib/automations/` (once created).
- Exhaustive switches and branded types make decisions visible at compile time.
- Type tests document "this shape must be possible / impossible".
- Start every session by re-reading this file + the hybrid section in plan.md + running `npm run typecheck`.

Violating these rules is not allowed.
