import React from 'react';
import { queryTable } from '@root/egdesk-helpers';
import ClientRegisterForm from './ClientRegisterForm';

export const dynamic = 'force-dynamic';

export default async function MobileRegisterPage() {
  let classes = [];
  let customFields = [];
  let error = null;

  try {
    const [classRes, fieldRes] = await Promise.all([
      queryTable('student_classes'),
      queryTable('custom_fields')
    ]);
    classes = classRes.rows || [];
    customFields = fieldRes.rows || [];
  } catch (err: any) {
    console.error('Failed to fetch data for mobile register page:', err);
    error = '필요한 정보를 불러오지 못했습니다. 일부 기능이 제한될 수 있습니다.';
  }

  return <ClientRegisterForm classes={classes} customFields={customFields} error={error} />;
}
