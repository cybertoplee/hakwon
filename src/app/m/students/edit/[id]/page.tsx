import React from 'react';
import { queryTable } from '@root/egdesk-helpers';
import ClientEditForm from './ClientEditForm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MobileEditPage({ params }: { params: Promise<{ id: string }> }) {
  let student = null;
  let classes = [];
  let customFields = [];
  let error = null;

  try {
    const { id } = await params;
    const studentId = parseInt(id, 10);
    const [studentRes, classRes, fieldRes] = await Promise.all([
      queryTable('students', { filters: { id: studentId } }),
      queryTable('student_classes'),
      queryTable('custom_fields')
    ]);

    if (!studentRes.rows || studentRes.rows.length === 0) {
      return notFound();
    }

    student = studentRes.rows[0];
    classes = classRes.rows || [];
    customFields = fieldRes.rows || [];
  } catch (err: any) {
    console.error('Failed to fetch data for mobile edit page:', err);
    error = '정보를 불러오지 못했습니다.';
  }

  return <ClientEditForm student={student} classes={classes} customFields={customFields} error={error} />;
}
