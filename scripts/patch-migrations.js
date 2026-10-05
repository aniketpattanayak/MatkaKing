const fs = require('fs');
const p = 'node_modules/@libsql/client/lib-esm/migrations.js';
try {
  let c = fs.readFileSync(p, 'utf8');

  // Patch 1: skip migration check when Turso returns 400
  const t1 = 'throw new Error("Unexpected status code while fetching migration jobs: "';
  if (c.includes(t1) && !c.includes('TURSO_P1')) {
    c = c.replace(t1, '/* TURSO_P1 */ if(result.status===400){return undefined;} ' + t1);
    console.log('✓ Patch 1 applied');
  } else { console.log('- Patch 1 skipped (already applied or not found)'); }

  // Patch 2: handle undefined lastMigrationJob safely
  const t2 = 'if (lastMigrationJob.status !== "RunSuccess") {';
  if (c.includes(t2) && !c.includes('TURSO_P2')) {
    c = c.replace(t2, '/* TURSO_P2 */ if (!lastMigrationJob) { return; } if (lastMigrationJob.status !== "RunSuccess") {');
    console.log('✓ Patch 2 applied');
  } else { console.log('- Patch 2 skipped (already applied or not found)'); }

  fs.writeFileSync(p, c);
  console.log('Done');
} catch(e) { console.log('ERROR:', e.message); process.exit(1); }
