const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });


const pool = new Pool({
    user: 'dpp_admin',
    host: 'localhost',
    database: 'dpp_db',
    password: 'secret123',
    port: 5432,
});

async function reset() {
    console.log('🔄 Starting Data Reset...');
    try {
        // 1. Reset Database
        const seedPath = path.join(__dirname, '../db/seed.sql');
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await pool.query(seedSql);
        console.log('✅ Database reset with seed.sql');

        // 2. Clear DID Logs (optional but good for clean slate)
        const logDir = path.join(__dirname, '../did-logs');
        if (fs.existsSync(logDir)) {
            // Simple recursive delete
            fs.rmSync(logDir, { recursive: true, force: true });
            console.log('✅ Cleared did-logs directory');
        }

    } catch (err) {
        console.error('❌ Error during reset:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

reset();
