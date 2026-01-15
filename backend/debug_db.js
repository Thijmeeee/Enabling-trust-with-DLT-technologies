import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: 'localhost',
    user: 'dpp_admin',
    password: 'secret123',
    database: 'dpp_db',
    port: 5432
});

async function run() {
    try {
        console.log("--- Watcher Alerts ---");
        const alerts = await pool.query("SELECT did, reason, details FROM watcher_alerts");
        console.table(alerts.rows);
        
        console.log("--- Identities ---");
        const ids = await pool.query("SELECT did, scid FROM identities LIMIT 10");
        console.table(ids.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
