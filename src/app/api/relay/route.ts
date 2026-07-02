import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('--- API RELAY HIT FROM:', request.headers.get('user-agent'), '---');
  try {
    const body = await request.text();
    const apiUrl = process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080';
    const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['X-Api-Key'] = apiKey;
    }

    const response = await fetch(`${apiUrl}/user-data/tools/call`, {
      method: 'POST',
      headers,
      body,
    });

    const result = await response.json();
    console.log('--- API RELAY SUCCESS ---');
    return NextResponse.json(result, { status: response.status });
  } catch (error: any) {
    console.error('--- API RELAY ERROR ---', error);
    return NextResponse.json(
      { error: 'API Relay Error', message: error.message },
      { status: 500 }
    );
  }
}
