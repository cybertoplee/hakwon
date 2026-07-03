import { createTable, queryTable, insertRows, deleteTable, listTables } from '../../egdesk-helpers';

export async function setupDatabase() {
  console.log('Starting database setup...');

  // Clean metadata first if they exist to prevent UNIQUE constraint failures
  try {
    const res = await listTables();
    const tablesToReset = ['classes', 'students', 'attendance_logs', 'payment_records', 'student_classes', 'custom_fields', 'tkd_system_settings'];
    for (const tableName of tablesToReset) {
      if (res.tables?.find((t: any) => t.tableName === tableName)) {
        console.log(`Deleting existing metadata for ${tableName} to prevent conflict...`);
        try {
          await deleteTable(tableName);
        } catch (e: any) {
          console.error(`Error deleting ${tableName}:`, e.message);
        }
      }
    }
  } catch (e: any) {
    console.error('Error listing tables for cleanup:', e.message);
  }

  // 1. Classes Table
  try {
    await createTable('수업 정보', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'start_time', type: 'TEXT', notNull: true },
      { name: 'end_time', type: 'TEXT', notNull: true },
    ], { tableName: 'classes', uniqueKeyColumns: ['id'] });
    console.log('Table "classes" created.');
  } catch (e: any) {
    console.error('Error during setup step:', e.message);
  }

  // 2. Students Table
  try {
    await createTable('학생 명단', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'parent_name', type: 'TEXT', notNull: true },
      { name: 'parent_phone', type: 'TEXT', notNull: true },
      { name: 'birth_date', type: 'TEXT' },
      { name: 'rank', type: 'TEXT' },
      { name: 'memo', type: 'TEXT' },
      { name: 'face_vector', type: 'TEXT' }, // JSON string of embeddings
      { name: 'profile_image', type: 'TEXT' },
      { name: 'class_id', type: 'INTEGER' },
    ], { tableName: 'students', uniqueKeyColumns: ['id'] });
    console.log('Table "students" created.');
  } catch (e: any) {
    console.error('Error during setup step:', e.message);
  }

  // 3. Attendance Logs Table
  try {
    await createTable('출결 기록', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'student_id', type: 'INTEGER', notNull: true },
      { name: 'timestamp', type: 'TEXT', notNull: true },
      { name: 'type', type: 'TEXT', notNull: true }, // IN, OUT
      { name: 'status', type: 'TEXT' }, // NORMAL, LATE
      { name: 'sms_status', type: 'TEXT', defaultValue: 'NONE' }, // NONE, SUCCESS, FAILED
    ], { tableName: 'attendance_logs', uniqueKeyColumns: ['id'] });
    console.log('Table "attendance_logs" created.');
  } catch (e: any) {
    console.error('Error during setup step:', e.message);
  }

  // 4. Payment Records Table
  try {
    await createTable('수납 기록', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'student_id', type: 'INTEGER' },
      { name: 'amount', type: 'INTEGER', notNull: true },
      { name: 'payment_date', type: 'DATE', notNull: true },
      { name: 'depositor_name', type: 'TEXT', notNull: true },
      { name: 'status', type: 'TEXT' }, // MATCHED, UNMATCHED
    ], { tableName: 'payment_records', uniqueKeyColumns: ['id'] });
    console.log('Table "payment_records" created.');
  } catch (e: any) {
    console.error('Error during setup step:', e.message);
  }

  // 5. Student Classes Table
  try {
    await createTable('반 관리', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'name', type: 'TEXT', notNull: true },
    ], { tableName: 'student_classes', uniqueKeyColumns: ['id'] });

    // Insert default classes if empty
    const existingClasses = await queryTable('student_classes');
    if (!existingClasses.rows || existingClasses.rows.length === 0) {
      await insertRows('student_classes', [
        { name: '초등부 A반' },
        { name: '초등부 B반' },
        { name: '중고등부' },
        { name: '선수단' },
      ]);
    }
    console.log('Table "student_classes" created and initialized.');
  } catch (e: any) {
    console.error('Error during setup step:', e.message);
  }

  // 6. Custom Fields Table
  try {
    await createTable('사용자 정의 필드', [
      { name: 'id', type: 'INTEGER', notNull: true },
      { name: 'field_name', type: 'TEXT', notNull: true },
      { name: 'display_name', type: 'TEXT', notNull: true },
    ], { tableName: 'custom_fields', uniqueKeyColumns: ['id'] });
    console.log('Table "custom_fields" created.');
  } catch (e: any) {
    console.error('Error during setup step:', e.message);
  }

  // 7. System Settings Table
  try {
    await createTable('태권도 시스템 설정', [
      { name: 'key', type: 'TEXT', notNull: true },
      { name: 'value', type: 'TEXT' }
    ], { tableName: 'tkd_system_settings', uniqueKeyColumns: ['key'], duplicateAction: 'update' });
    
    // Insert default settings if empty
    const existingSettings = await queryTable('tkd_system_settings');
    if (!existingSettings.rows || existingSettings.rows.length === 0) {
      await insertRows('tkd_system_settings', [
        { key: 'attendance_refresh_interval', value: '1' },
        { key: 'attendance_auto_checkout_minutes', value: '10' },
        { key: 'sms_enabled', value: 'false' },
        { key: 'sms_template_in', value: '[EG태권도] {name} 학생이 {time}에 등원하였습니다.' },
        { key: 'sms_template_out', value: '[EG태권도] {name} 학생이 {time}에 하원하였습니다.' }
      ]);
    }
    console.log('Table "tkd_system_settings" created and initialized.');
  } catch (e: any) {
    console.error('Error during setup step:', e.message);
  }

  console.log('Database setup complete.');
}
