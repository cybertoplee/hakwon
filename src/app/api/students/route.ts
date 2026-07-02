import { NextResponse } from 'next/server';
import { queryTable } from '@root/egdesk-helpers';

export async function GET(request: Request) {
  console.log('--- API STUDENTS HIT FROM:', request.headers.get('user-agent'), '---');
  try {
    const result = await queryTable('students', { orderBy: 'id', orderDirection: 'DESC', limit: 1000 });
    return NextResponse.json({
      success: true,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result)
          }
        ]
      }
    });
  } catch (error: any) {
    console.error('Error in students API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
