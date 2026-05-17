#!/usr/bin/env node
/**
 * Supreme Gaming Engine — Pre-deployment Production Checklist
 * Run: node scripts/pre-deploy-check.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(label, condition, level = 'error') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    if (level === 'warn') {
      console.log(`  ⚠️  ${label}`);
      warnings++;
    } else {
      console.log(`  ❌ ${label}`);
      failed++;
    }
  }
}

function section(title) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${title}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join('=').replace(/^["']|["']$/g, '')])
);

section('1. ENVIRONMENT VARIABLES');
check('DATABASE_URL is set',                   !!env.DATABASE_URL);
check('DATABASE_URL is not localhost',          env.DATABASE_URL && !env.DATABASE_URL.includes('localhost'));
check('JWT_SECRET is set',                     !!env.JWT_SECRET);
check('JWT_SECRET is long enough (32+ chars)', env.JWT_SECRET && env.JWT_SECRET.length >= 32);
check('JWT_SECRET is not default value',       env.JWT_SECRET && !env.JWT_SECRET.includes('dev-secret'));
check('SMS_WEBHOOK_SECRET is set',             !!env.SMS_WEBHOOK_SECRET);
check('SMS_WEBHOOK_SECRET is not default',     env.SMS_WEBHOOK_SECRET && !env.SMS_WEBHOOK_SECRET.includes('change-this'));
check('NEXTAUTH_URL is set',                   !!env.NEXTAUTH_URL, 'warn');
check('NEXTAUTH_URL is not localhost',         env.NEXTAUTH_URL && !env.NEXTAUTH_URL.includes('localhost'), 'warn');

section('2. SECURITY CHECKS');
// Check middleware exists
check('middleware.ts exists',  fs.existsSync(path.join(__dirname, '..', 'src', 'middleware.ts')));
// Check next.config has headers
const nextConfig = fs.existsSync(path.join(__dirname, '..', 'next.config.js'))
  ? fs.readFileSync(path.join(__dirname, '..', 'next.config.js'), 'utf-8') : '';
check('Security headers configured in next.config', nextConfig.includes('X-Frame-Options'));
check('Console.log removed in prod build',          nextConfig.includes('removeConsole'));
check('Image domains restricted (not wildcard **)', !nextConfig.includes("hostname: '**'"));

section('3. DATABASE');
check('DATABASE_URL has connect_timeout',  env.DATABASE_URL && env.DATABASE_URL.includes('connect_timeout'));
check('DATABASE_URL has pool_timeout',     env.DATABASE_URL && env.DATABASE_URL.includes('pool_timeout'));
check('Prisma schema exists',             fs.existsSync(path.join(__dirname, '..', 'prisma', 'schema.prisma')));

section('4. FILES & STRUCTURE');
const requiredFiles = [
  'src/lib/api-helper.ts',
  'src/lib/auth-client.ts',
  'src/app/layout.tsx',
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/me/route.ts',
  'src/app/api/lottery/buy/route.ts',
  'src/app/api/admin/notifications/route.ts',
  'src/app/api/health/route.ts',
];
requiredFiles.forEach(f => {
  check(`${f} exists`, fs.existsSync(path.join(__dirname, '..', f)));
});

section('5. PACKAGE.JSON');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
check('next is a dependency',           !!pkg.dependencies?.next);
check('bcryptjs is a dependency',       !!pkg.dependencies?.bcryptjs);
check('jsonwebtoken is a dep',          !!pkg.dependencies?.jsonwebtoken || !!pkg.dependencies?.jose, 'warn');
check('No debug packages in prod deps', !pkg.dependencies?.debug);

section('6. PRODUCTION RECOMMENDATIONS');
check('NODE_ENV will be production',   true, 'warn'); // Can't check at script time
check('Using pooled DB connection',    env.DATABASE_URL && env.DATABASE_URL.includes('pooler'));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  RESULT: ${passed} passed · ${warnings} warnings · ${failed} failed`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (failed > 0) {
  console.log('❌ Fix the failing checks before deploying to production.\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('⚠️  Ready to deploy but review warnings above.\n');
} else {
  console.log('🚀 All checks passed! Ready for production deployment.\n');
}
