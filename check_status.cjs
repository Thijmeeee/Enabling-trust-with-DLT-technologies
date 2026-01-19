const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/identity_db'
});

async function check() {
    try {
        const { rows } = await pool.query("SELECT did, status FROM identities WHERE did LIKE '%z-demo-window-003%';");
        console.log('--- DATABASE STATUS ---');
        console.table(rows);
        
        const { rows: alerts } = await pool.query("SELECT * FROM watcher_alerts WHERE did LIKE '%z-demo-window-003%';");
        console.log('--- ALERTS ---');
        console.table(alerts);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
