
import { executeSQL } from './egdesk-helpers';

async function checkSchema() {
  try {
    const res = await executeSQL("SELECT sql FROM sqlite_master WHERE type='table' AND name='students'");
    console.log('Schema:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

checkSchema();
