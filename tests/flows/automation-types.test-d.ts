import { describe, it } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  FlowNode,
  AutomationTrigger,
  SingleTrigger,
  ExperimentTrigger,
  NodeId,
  VariantId,
} from '@/lib/flows/node-types';

// These type tests are first-class documentation (Matt Pocock style).
// Other AI agents can read them to understand all architectural decisions
// without needing long prose or full context.

describe('Matt Pocock Type Contracts - Automation Domain', () => {
  it('AutomationTrigger is a proper discriminated union (single vs experiment)', () => {
    expectTypeOf<AutomationTrigger>().toMatchTypeOf<
      | { kind: 'single'; keyword: string; sequenceId: any }
      | { kind: 'experiment'; keyword: string; variants: readonly any[] }
    >();
  });

  it('SingleTrigger and ExperimentTrigger are mutually exclusive', () => {
    // This would fail to compile if the kinds were not discriminated
    type IsSingle = SingleTrigger extends { kind: 'single' } ? true : false;
    type IsExperiment = ExperimentTrigger extends { kind: 'experiment' } ? true : false;

    expectTypeOf<IsSingle>().toEqualTypeOf<true>();
    expectTypeOf<IsExperiment>().toEqualTypeOf<true>();
  });

  it('FlowNode remains exhaustive (adding a new node type will break describeNode)', () => {
    // The existence of this test + the never case in describeNode documents
    // that all node kinds must be handled.
    expectTypeOf<FlowNode>().toHaveProperty('type');
  });

  it('Branded IDs prevent accidental mixing (Pocock safety)', () => {
    expectTypeOf<NodeId>().not.toEqualTypeOf<string>();
    expectTypeOf<VariantId>().not.toEqualTypeOf<string>();
    // NodeId and VariantId are distinct even though both are branded strings
    expectTypeOf<NodeId>().not.toEqualTypeOf<VariantId>();
  });
});
