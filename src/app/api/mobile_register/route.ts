import { NextResponse } from 'next/server';
import { insertRows } from '@root/egdesk-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    const parent_name = url.searchParams.get('parent_name') || '';
    const parent_phone = url.searchParams.get('parent_phone') || '';
    const class_id = url.searchParams.get('class_id') || '0';
    const receive_sms_in = url.searchParams.get('receive_sms_in') || 'true';
    const receive_sms_out = url.searchParams.get('receive_sms_out') || 'true';

    if (!name) {
      return NextResponse.redirect(new URL('/m/students/register?error=이름은 필수입니다.', request.url));
    }

    const rowData = {
      name,
      parent_name,
      parent_phone,
      class_id: parseInt(class_id, 10),
      face_vector: '', // Mobile doesn't support face scanning
      custom_data: '{}',
      receive_sms_in,
      receive_sms_out,
    };

    await insertRows('students', [rowData]);

    // Success! Redirect back to the mobile students list
    return NextResponse.redirect(new URL('/m/students?registered=true', request.url));
  } catch (error: any) {
    console.error('Mobile registration error:', error);
    return NextResponse.redirect(new URL('/m/students/register?error=등록 중 오류가 발생했습니다.', request.url));
  }
}
