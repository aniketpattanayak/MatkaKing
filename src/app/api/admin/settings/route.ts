
import { NextRequest, NextResponse } from 'next/server';
import { isAdminToken } from '@/lib/api-helper';
import * as fs from 'fs';
import * as path from 'path';

const SETTINGS_FILE = '/tmp/kismathub-settings.json';
const DEFAULTS: Record<string,string> = {
  minWithdraw: '100', maxWithdraw: '50000', withdrawPerDay: '1',
};

function readSettings(): Record<string,string> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8'));
  } catch {}
  return { ...DEFAULTS };
}

function writeSettings(data: Record<string,string>) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data)); } catch {}
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const settings = readSettings();
  const value = key ? (settings[key] ?? DEFAULTS[key] ?? null) : null;
  return NextResponse.json({ key, value });
}

export async function POST(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error:'Forbidden' },{ status:403 });
  const { key, value } = await req.json();
  const settings = readSettings();
  settings[key] = String(value);
  writeSettings(settings);
  return NextResponse.json({ ok:true, key, value });
}
