import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    user: 'dpp_admin',
    password: 'secret123',
    database: 'dpp_db',
    port: 5432
});

async function debug() {
    try {
        const alerts = await pool.query('SELECT did, COUNT(*) FROM watcher_alerts GROUP BY did');
        console.log('--- Alerts Distribution ---');
        console.table(alerts.rows);
        
        const sampleIdentities = await pool.query('SELECT did, scid FROM identities LIMIT 5');
        console.log('--- Sample Identities ---');
        console.table(sampleIdentities.rows);
        
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
