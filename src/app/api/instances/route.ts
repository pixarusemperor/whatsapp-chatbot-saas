import { NextResponse } from 'next/server';
import { getWasenderPat, getWasenderSessions } from '@/lib/wasender';

export async function GET() {
  try {
    const pat = await getWasenderPat();
    if (!pat) {
      return NextResponse.json({ error: 'Wasender PAT is not configured' }, { status: 400 });
    }

    const devices = await getWasenderSessions(pat);
    return NextResponse.json(devices);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch instances' }, { status: 500 });
  }
}
