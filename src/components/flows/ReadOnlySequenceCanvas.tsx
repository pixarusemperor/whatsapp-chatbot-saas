'use client';

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { wfStepToFlowNode } from '@/lib/flows/mappers';
import type { WfStep } from '@/lib/flows/mappers';
import { isSendText } from '@/lib/flows/node-types';

/**
 * Read-only visual canvas for a sequence.
 * Takes raw wf_steps from DB and renders them as a vertical flow.
 * Executes via the unified wf_* + variants path (new path preferred).
 */
interface ReadOnlySequenceCanvasProps {
  steps: WfStep[];
  sequenceName?: string;
  variantName?: string; // for experiment display
}

export default function ReadOnlySequenceCanvas({ steps, sequenceName, variantName }: ReadOnlySequenceCanvasProps) {
  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = steps.map((step, index) => {
      const node = wfStepToFlowNode(step);
      let labelText: string;
      if (isSendText(node)) {
        labelText = `${index + 1}. ${node.data.message} (delay: ${node.data.delaySeconds || 0}s)`;
      } else {
        labelText = `${index + 1}. Media (delay: ${(node as any).data?.delaySeconds || 0}s)`;
      }
      return {
        id: node.id,
        type: 'default',
        position: { x: 100, y: index * 120 },
        data: {
          label: labelText,
        },
        style: {
          width: 280,
          padding: 8,
          fontSize: 13,
        },
      };
    });

    const flowEdges: Edge[] = steps.slice(0, -1).map((_, idx) => ({
      id: `e-${idx}`,
      source: flowNodes[idx].id,
      target: flowNodes[idx + 1].id,
      animated: true,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [steps]);

  if (!steps || steps.length === 0) {
    return <div className="p-4 text-sm text-gray-500">No steps to visualize.</div>;
  }

  return (
    <div style={{ height: Math.max(300, steps.length * 110) }}>
      <div className="mb-2 text-sm font-medium text-gray-700">
        {sequenceName ? `Visual: ${sequenceName}` : 'Sequence Flow (read-only)'}
        {variantName && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded">Variant: {variantName}</span>}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <div className="mt-1 text-[10px] text-gray-400">
        Read-only preview. Execution uses the unified wf_* + variants path.
      </div>
    </div>
  );
}
