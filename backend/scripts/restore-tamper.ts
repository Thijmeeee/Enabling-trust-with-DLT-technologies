
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dpp_admin',
    password: process.env.DB_PASS || 'secret123',
    database: process.env.DB_NAME || 'dpp_db',
    port: parseInt(process.env.DB_PORT || '5432')
});

async function restoreTampered() {
    try {
        console.log('Restoring intended tampered state for z-demo-window-003...');
        await pool.query(
            "UPDATE identities SET status = 'tampered' WHERE scid = 'z-demo-window-003'"
        );
        console.log('Done.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

restoreTampered();
