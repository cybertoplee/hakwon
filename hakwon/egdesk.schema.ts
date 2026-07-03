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
  tkd_system_settings: {
    name: 'tkd_system_settings',
    displayName: '태권도 시스템 설정',
    columns: ['key', 'value'],
    columnCount: 2,
    rowCount: 0,
  },
  custom_fields: {
    name: 'custom_fields',
    displayName: '사용자 정의 필드',
    columns: ['field_name', 'display_name'],
    columnCount: 2,
    rowCount: 0,
  },
  student_classes: {
    name: 'student_classes',
    displayName: '반 관리',
    columns: ['name'],
    columnCount: 1,
    rowCount: 0,
  },
  payment_records: {
    name: 'payment_records',
    displayName: '수납 기록',
    columns: ['student_id', 'amount', 'payment_date', 'depositor_name', 'status'],
    columnCount: 5,
    rowCount: 0,
  },
  attendance_logs: {
    name: 'attendance_logs',
    displayName: '출결 기록',
    columns: ['student_id', 'timestamp', 'type', 'status'],
    columnCount: 4,
    rowCount: 0,
  },
  students: {
    name: 'students',
    displayName: '학생 명단',
    columns: ['name', 'parent_name', 'parent_phone', 'birth_date', 'rank', 'memo', 'face_vector', 'profile_image', 'class_id'],
    columnCount: 9,
    rowCount: 0,
  },
  classes: {
    name: 'classes',
    displayName: '수업 정보',
    columns: ['name', 'start_time', 'end_time'],
    columnCount: 3,
    rowCount: 0,
  },
  tkd_usage_logs: {
    name: 'tkd_usage_logs',
    displayName: '사용량 통계 로그',
    columns: ['type', 'timestamp', 'student_id'],
    columnCount: 3,
    rowCount: 0,
  },
  example_table: {
    name: 'example_table',
    displayName: 'Example Table',
    columns: ['name', 'created_at'],
    columnCount: 2,
    rowCount: 0,
  }
} as const;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
