// Usage: node scripts/createAdmin.js admin@library.com admin123
// Creates or updates an admin account using a bcrypt password hash.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password || password.length < 8) {
    console.error('Usage: node scripts/createAdmin.js <email> <password-at-least-8-characters>');
    process.exitCode = 1;
    return;
  }
  const username = (email.split('@')[0] || 'admin').slice(0, 50);
  const hash = await bcrypt.hash(password, 10);
  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) {
    await pool.execute('UPDATE users SET password = ?, role = ? WHERE id = ?', [hash, 'admin', existing[0].id]);
    console.log(`Admin password updated for ${email}`);
  } else {
    await pool.execute('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)', [username, email, hash, 'admin']);
    console.log(`Admin account created for ${email}`);
  }
}
main().catch(err => { console.error('Could not create admin:', err.message); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
