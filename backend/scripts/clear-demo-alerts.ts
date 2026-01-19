
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

async function clearDemoAlerts() {
    try {
        console.log('Cleaning up false positive alerts for demo products...');
        
        // Clear alerts for Frame and Window-002 which should be clean now
        const result = await pool.query(
            "DELETE FROM watcher_alerts WHERE did LIKE '%z-demo-frame-001%' OR did LIKE '%z-demo-window-002%'"
        );
        
        console.log(`Deleted ${result.rowCount} false positive alerts.`);
        
        // Also ensure their status is 'active'
        await pool.query(
            "UPDATE identities SET status = 'active' WHERE (scid = 'z-demo-frame-001' OR scid = 'z-demo-window-002') AND status = 'tampered'"
        );
        
        console.log('Product statuses restored to active.');
        process.exit(0);
    } catch (err) {
        console.error('Failed to clear alerts:', err);
        process.exit(1);
    }
}

clearDemoAlerts();
