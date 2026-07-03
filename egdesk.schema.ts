/**
 * egdesk.schema.ts — committed seed schema
 *
 * COMMIT THIS FILE TO GIT.
 *
 * When someone opens this project in their EGDesk, these tables are created
 * automatically in their dev database on first server start.
 *
 * Unlike egdesk.config.ts (auto-generated, gitignored), this file is the
 * portable source of truth for your app's database structure.
 *
 * Edit this file when you add/remove tables or columns. Do NOT edit
 * egdesk.config.ts — EGDesk regenerates it from the live database.
 */

export const TABLES = {
  classes: {
    name: 'classes',
    displayName: '수업 정보',
    columns: ['id', 'name', 'start_time', 'end_time'],
    columnCount: 4,
    rowCount: 0,
  },
  students: {
    name: 'students',
    displayName: '학생 명단',
    columns: ['id', 'name', 'parent_name', 'parent_phone', 'birth_date', 'rank', 'memo', 'face_vector', 'profile_image', 'class_id'],
    columnCount: 10,
    rowCount: 0,
  },
  attendance_logs: {
    name: 'attendance_logs',
    displayName: '출결 기록',
    columns: ['id', 'student_id', 'timestamp', 'type', 'status'],
    columnCount: 5,
    rowCount: 0,
  },
  payment_records: {
    name: 'payment_records',
    displayName: '수납 기록',
    columns: ['id', 'student_id', 'amount', 'payment_date', 'depositor_name', 'status'],
    columnCount: 6,
    rowCount: 0,
  },
  student_classes: {
    name: 'student_classes',
    displayName: '반 관리',
    columns: ['id', 'name'],
    columnCount: 2,
    rowCount: 0,
  },
  custom_fields: {
    name: 'custom_fields',
    displayName: '사용자 정의 필드',
    columns: ['id', 'field_name', 'display_name'],
    columnCount: 3,
    rowCount: 0,
  },
  tkd_system_settings: {
    name: 'tkd_system_settings',
    displayName: '태권도 시스템 설정',
    columns: ['key', 'value'],
    columnCount: 2,
    rowCount: 0,
  },
} as const;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
