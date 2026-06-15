import { NextResponse } from 'next/server';
import { engineTick, queueTick } from '@/lib/campaign-engine';

export async function POST(req: Request) {
  try {
    const engineSecret = process.env.ENGINE_SECRET;
    if (engineSecret) {
      const headerSecret = req.headers.get('x-engine-secret') || req.headers.get('Authorization')?.replace('Bearer ', '');
      if (headerSecret !== engineSecret) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const engineResult = await engineTick();
    const queueResult = await queueTick();
    
    return NextResponse.json({
      processed: engineResult.processed + queueResult.processed,
      engine: engineResult,
      queue: queueResult
    });
  } catch (err: any) {
    console.error('Engine endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Engine tick failed' }, { status: 500 });
  }
}
