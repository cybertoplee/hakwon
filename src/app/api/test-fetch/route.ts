import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    const res = await fetch('http://127.0.0.1:8080/user-data/tools/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': 'a67ddc0f-7e2b-4997-9a0b-9667a74c89d0'
      },
      body: JSON.stringify({ tool: 'user_data_query', arguments: { tableName: 'students' } }),
      cache: 'no-store'
    });
    const text = await res.text();
    const end = Date.now();
    return NextResponse.json({ success: true, time: end - start, length: text.length });
  } catch (err: any) {
    const end = Date.now();
    return NextResponse.json({ success: false, time: end - start, error: err.message });
  }
}
