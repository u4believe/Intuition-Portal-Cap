const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:jMvvYPKX58F0WYM8@db.vetavihuwozieomcmuna.supabase.co:5432/postgres?sslmode=require'
});

async function main() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database connected successfully:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
}

main();
