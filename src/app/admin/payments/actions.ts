'use server';

import { queryBankTransactions, queryTable, updateRows, deleteRows } from '../../../../egdesk-helpers';

/**
 * 은행 거래 내역을 가져오는 서버 액션
 */
export async function getBankTransactionsAction() {
  try {
    const res = await queryBankTransactions({ 
      limit: 100, 
      orderBy: 'date', 
      orderDir: 'desc' 
    });
    return { success: true, rows: res.rows || [] };
  } catch (err: any) {
    console.error('getBankTransactionsAction error:', err);
    return { success: false, error: err.message || '은행 데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * 테이블 데이터를 쿼리하는 서버 액션
 */
export async function queryTableAction(tableName: string, options: any = {}) {
  try {
    const res = await queryTable(tableName, options);
    return { success: true, rows: res.rows || [] };
  } catch (err: any) {
    console.error(`queryTableAction(${tableName}) error:`, err);
    return { success: false, error: err.message || '데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * 테이블 데이터를 업데이트하는 서버 액션
 */
export async function updateRowsAction(tableName: string, updates: any, options: any) {
  try {
    const res = await updateRows(tableName, updates, options);
    return { success: true, result: res };
  } catch (err: any) {
    console.error(`updateRowsAction(${tableName}) error:`, err);
    return { success: false, error: err.message || '업데이트 중 오류가 발생했습니다.' };
  }
}

/**
 * 테이블 데이터를 삭제하는 서버 액션
 */
export async function deleteRowsAction(tableName: string, options: any) {
  try {
    const res = await deleteRows(tableName, options);
    return { success: true, result: res };
  } catch (err: any) {
    console.error(`deleteRowsAction(${tableName}) error:`, err);
    return { success: false, error: err.message || '삭제 중 오류가 발생했습니다.' };
  }
}
