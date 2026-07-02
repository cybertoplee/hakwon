import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');

export async function GET() {
  try {
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ exists: false });
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const exists = content.includes('GOOGLE_GENERATIVE_AI_API_KEY=');
    return NextResponse.json({ exists });
  } catch (err) {
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }

    const keyLine = `GOOGLE_GENERATIVE_AI_API_KEY=${apiKey}`;
    
    if (content.includes('GOOGLE_GENERATIVE_AI_API_KEY=')) {
      content = content.replace(/GOOGLE_GENERATIVE_AI_API_KEY=.*/, keyLine);
    } else {
      content += `\n${keyLine}`;
    }

    fs.writeFileSync(envPath, content, 'utf8');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Failed to save API key:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
