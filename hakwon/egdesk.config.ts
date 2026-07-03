/**
 * EGDesk User Data Configuration
 * Generated at: 2026-07-03T01:58:51.316Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '7e708c6b-333b-4442-a13c-6bfe50f3389b',
} as const;

export interface TableDefinition {
  name: string;
  displayName: string;
  description?: string;
  /** Omitted or unknown until synced / counted */
  rowCount?: number;
  columnCount: number;
  columns: string[];
}

export const TABLES = {
  table1: {
    name: 'tkd_system_settings',
    displayName: '태권도 시스템 설정',
    rowCount: 5,
    columnCount: 3,
    columns: ['id', 'key', 'value']
  } as TableDefinition,
  table2: {
    name: 'custom_fields',
    displayName: '사용자 정의 필드',
    rowCount: 0,
    columnCount: 3,
    columns: ['id', 'field_name', 'display_name']
  } as TableDefinition,
  table3: {
    name: 'student_classes',
    displayName: '반 관리',
    rowCount: 4,
    columnCount: 2,
    columns: ['id', 'name']
  } as TableDefinition,
  table4: {
    name: 'payment_records',
    displayName: '수납 기록',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'student_id', 'amount', 'payment_date', 'depositor_name', 'status']
  } as TableDefinition,
  table5: {
    name: 'attendance_logs',
    displayName: '출결 기록',
    rowCount: 1,
    columnCount: 5,
    columns: ['id', 'student_id', 'timestamp', 'type', 'status']
  } as TableDefinition,
  table6: {
    name: 'students',
    displayName: '학생 명단',
    rowCount: 1,
    columnCount: 10,
    columns: ['id', 'name', 'parent_name', 'parent_phone', 'birth_date', 'rank', 'memo', 'face_vector', 'profile_image', 'class_id']
  } as TableDefinition,
  table7: {
    name: 'classes',
    displayName: '수업 정보',
    rowCount: 0,
    columnCount: 4,
    columns: ['id', 'name', 'start_time', 'end_time']
  } as TableDefinition,
  table8: {
    name: 'tkd_usage_logs',
    displayName: '사용량 통계 로그',
    rowCount: 0,
    columnCount: 4,
    columns: ['id', 'type', 'timestamp', 'student_id']
  } as TableDefinition,
  table9: {
    name: 'example_table',
    displayName: 'Example Table',
    rowCount: 0,
    columnCount: 3,
    columns: ['id', 'name', 'created_at']
  } as TableDefinition
} as const;


// Main table (first table by default)
export const MAIN_TABLE = TABLES.table1;


// Helper to get table by name
export function getTableByName(tableName: string): TableDefinition | undefined {
  return Object.values(TABLES).find(t => t.name === tableName);
}

// Export table names for easy access
export const TABLE_NAMES = {
  table1: 'tkd_system_settings',
  table2: 'custom_fields',
  table3: 'student_classes',
  table4: 'payment_records',
  table5: 'attendance_logs',
  table6: 'students',
  table7: 'classes',
  table8: 'tkd_usage_logs',
  table9: 'example_table'
} as const;
