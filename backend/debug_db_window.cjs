
const pkg = require('pg');
const { Pool } = pkg;

const pool = new Pool({
    connectionString: "postgres://dpp_admin:secret123@localhost:5432/dpp_db"
});

async function debug() {
    try {
        const res = await pool.query(`
            SELECT e.id, e.did, e.version_id, e.leaf_hash, e.witness_proofs 
            FROM events e
            JOIN identities i ON e.did = i.did
            WHERE i.scid = 'z-demo-window-003'
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

debug();
