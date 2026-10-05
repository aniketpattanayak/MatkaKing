const fs = require('fs');
const p = 'node_modules/@libsql/client/lib-esm/migrations.js';
try {
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('TURSO_400_PATCHED')) { console.log('Already patched'); process.exit(0); }
  const target = 'throw new Error("Unexpected status code while fetching migration jobs: "';
  if (!c.includes(target)) { console.log('ERROR: target not found'); process.exit(1); }
  c = c.replace(target, '/* TURSO_400_PATCHED */ if(result.status===400){return undefined;} ' + target);
  fs.writeFileSync(p, c);
  console.log('✓ Patched migrations.js');
} catch(e) { console.log('Patch skip:', e.message); process.exit(1); }
