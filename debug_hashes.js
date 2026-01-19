import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import path from 'path';

async function debug() {
    const scid = 'z-demo-window-001';
    const logPath = `backend/did-logs/${scid}/did.jsonl`;
    
    console.log(`Checking ${logPath}`);
    const content = await fs.readFile(logPath, 'utf8');
    
    // Check for different line endings
    console.log(`Content length: ${content.length}`);
    console.log(`Has \\r: ${content.includes('\r')}`);
    
    const lines = content.split('\n').filter(line => line.trim() !== '');
    console.log(`Found ${lines.length} lines`);

    for (let i = 1; i < lines.length; i++) {
        const current = JSON.parse(lines[i]);
        const prevRaw = lines[i - 1];
        const prevTrim = lines[i - 1].trim();
        const prevObj = JSON.parse(lines[i - 1]);
        
        const expected = current.parameters?.prevVersionHash;
        const hashRaw = crypto.createHash('sha256').update(prevRaw).digest('hex');
        const hashTrim = crypto.createHash('sha256').update(prevTrim).digest('hex');
        const hashObj = crypto.createHash('sha256').update(JSON.stringify(prevObj)).digest('hex');
        
        console.log(`Line ${i}:`);
        console.log(`  Expected: ${expected}`);
        console.log(`  HashRaw:  ${hashRaw}`);
        console.log(`  HashTrim: ${hashTrim}`);
        console.log(`  HashObj:  ${hashObj}`);
        
        if (expected === hashRaw) console.log('  MATCH: Raw');
        if (expected === hashTrim) console.log('  MATCH: Trim');
        if (expected === hashObj) console.log('  MATCH: Obj');
    }
}

debug().catch(console.error);
