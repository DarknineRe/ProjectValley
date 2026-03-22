import pool from './server/db.js';

(async () => {
  try {
    // Get the farmer user ID
    const userRes = await pool.query('SELECT id, email, name FROM users WHERE email = $1', ['farmer@example.com']);
    const farmer = userRes.rows[0];
    console.log('Farmer user:', farmer);

    // Get Chanina Jaichuang workspace
    const wsRes = await pool.query('SELECT id, name, owner_id FROM workspaces WHERE name ILIKE $1', ['%Chanin%']);
    const workspace = wsRes.rows[0];
    console.log('Workspace:', workspace);

    if (!farmer) {
      console.error('❌ Farmer user not found');
      process.exit(1);
    }
    if (!workspace) {
      console.error('❌ Workspace not found');
      process.exit(1);
    }

    // Get current owner
    const ownerRes = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [workspace.owner_id]);
    const owner = ownerRes.rows[0];
    console.log('Current owner:', owner);

    // Transfer ownership
    await pool.query('UPDATE workspaces SET owner_id = $1 WHERE id = $2', [farmer.id, workspace.id]);
    console.log('✅ Transferred ownership from', owner ? owner.name : 'unknown', 'to', farmer.name);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
