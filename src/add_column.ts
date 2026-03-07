import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  const { error } = await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'pending\';'
  });
  console.log('Result:', error ? error.message : 'Success');
}

addColumn();
