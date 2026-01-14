
const pkg = require('pg');
const { Pool } = pkg;

const pool = new Pool({
    connectionString: "postgres://dpp_admin:secret123@localhost:5432/dpp_db"
});

async function fix() {
    try {
        console.log('Fixing leaf_hashes and clearing proof for demo products...');
        
        await pool.query(`
            UPDATE events SET leaf_hash = '0x1111111111111111111111111111111111111111111111111111111111111111', witness_proofs = NULL 
            WHERE did = 'did:webvh:localhost:3000:z-demo-window-001'
        `);
        await pool.query(`
            UPDATE events SET leaf_hash = '0x2222222222222222222222222222222222222222222222222222222222222222', witness_proofs = NULL 
            WHERE did = 'did:webvh:localhost:3000:z-demo-window-002'
        `);
        await pool.query(`
            UPDATE events SET leaf_hash = '0x3333333333333333333333333333333333333333333333333333333333333333', witness_proofs = NULL 
            WHERE did = 'did:webvh:localhost:3000:z-demo-window-003'
        `);
        
        console.log('Successfully updated DB. Witness service should pick them up shortly.');
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

fix();
