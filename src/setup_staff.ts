import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStaffTable() {
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS staff (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'cook', 'waiter')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Insert default admin if not exists
      INSERT INTO staff (name, username, password, role)
      VALUES ('Administrador', 'admin', 'admin', 'admin')
      ON CONFLICT (username) DO NOTHING;
    `
  });
  console.log('Setup staff table result:', error ? error.message : 'Success');
}

setupStaffTable();
