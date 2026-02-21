const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Utility script to export market data from SQLite to a JSON file.
 * This helps in creating persistent daily snapshots that can be committed to the repo.
 */

function exportData() {
    const dbPath = path.resolve(__dirname, '../sqlite.db');
    if (!fs.existsSync(dbPath)) {
        console.error('SQLite database not found at:', dbPath);
        return;
    }

    const db = new Database(dbPath);
    try {
        const rows = db.prepare('SELECT * FROM market_data ORDER BY id ASC').all();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportPath = path.resolve(__dirname, `../public/data-export-${timestamp}.json`);

        fs.writeFileSync(exportPath, JSON.stringify(rows, null, 2));
        console.log(`Successfully exported ${rows.length} rows to ${exportPath}`);
    } catch (err) {
        console.error('Export failed:', err);
    } finally {
        db.close();
    }
}

exportData();
