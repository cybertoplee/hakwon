import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080';
    const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    const t0 = Date.now();
    const response = await fetch(`${apiUrl}/user-data/tools/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: 'user_data_query',
        arguments: { tableName: 'students', limit: 1 }
      }),
      signal: AbortSignal.timeout(5000) // 5초 타임아웃
    });
    
    const t1 = Date.now();
    const result = await response.json();

    return NextResponse.json({
      success: true,
      timeMs: t1 - t0,
      clientIp: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent'),
      data: result
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
