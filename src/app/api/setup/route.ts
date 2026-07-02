import { NextResponse } from 'next/server';
import { setupDatabase } from '@/lib/setup-db';

export async function GET() {
  try {
    await setupDatabase();
    return NextResponse.json({ success: true, message: 'Database setup successful' });
  } catch (error: any) {
    console.error('Setup failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
