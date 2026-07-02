import { NextResponse } from 'next/server';
import { queryTable, insertRows } from '@root/egdesk-helpers';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const name = formData.get('name') as string;
    if (!name) {
      return NextResponse.redirect(new URL('/m/students/register?error=이름은 필수입니다.', request.url));
    }

    const rowData: any = {};
    formData.forEach((value, key) => {
      if (key === 'class_id') {
        rowData[key] = parseInt(value as string, 10);
      } else {
        rowData[key] = value as string;
      }
    });

    // Ensure defaults for essential fields if missing
    if (!rowData.birth_date) rowData.birth_date = '';
    if (!rowData.rank) rowData.rank = '';
    if (!rowData.memo) rowData.memo = '';
    if (!rowData.receive_sms_in) rowData.receive_sms_in = 'true';
    if (!rowData.receive_sms_out) rowData.receive_sms_out = 'true';
    if (!rowData.status) rowData.status = 'ACTIVE';

    // 1. Duplicate check (Name + Birthdate)
    const checkRes = await queryTable('students', {
      filters: {
        name: rowData.name,
        birth_date: rowData.birth_date
      }
    });

    if (checkRes.rows && checkRes.rows.length > 0) {
      const birthInfo = rowData.birth_date ? `(생일: ${rowData.birth_date})` : '';
      throw new Error(`이미 '${rowData.name}' ${birthInfo} 학생이 등록되어 있습니다.`);
    }

    // 2. Insert if not duplicate
    await insertRows('students', [rowData]);

    // Success! Redirect back to the mobile students list.
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const redirectTarget = new URL('/m/students?registered=true', `${protocol}://${host}`);
    
    return NextResponse.redirect(redirectTarget, 303);
  } catch (error: any) {
    console.error('Mobile registration POST error:', error);
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const errorTarget = new URL(`/m/students/register?error=${encodeURIComponent(error.message || '알 수 없는 오류')}`, `${protocol}://${host}`);
    
    return NextResponse.redirect(errorTarget, 303);
  }
}
