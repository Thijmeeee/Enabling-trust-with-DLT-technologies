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
        const res = await pool.query("SELECT did, event_type, payload, leaf_hash FROM events WHERE did LIKE '%zddR7zHr8lpQjdIAP9bMVzA%'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
