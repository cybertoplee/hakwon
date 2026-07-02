import { NextResponse } from 'next/server';
import { queryTable } from '@root/egdesk-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await queryTable('students');
    return NextResponse.json({ success: true, res });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack });
  }
}
