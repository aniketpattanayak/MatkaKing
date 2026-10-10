import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

// Indian festivals with typical dates
const UPCOMING_FESTIVALS = [
  { name: 'Dussehra',        date: '2026-10-12', emoji: '🏹' },
  { name: 'Karva Chauth',    date: '2026-10-28', emoji: '🌕' },
  { name: 'Dhanteras',       date: '2026-11-07', emoji: '💰' },
  { name: 'Diwali',          date: '2026-11-08', emoji: '🪔' },
  { name: 'Christmas',       date: '2026-12-25', emoji: '🎄' },
  { name: 'New Year',        date: '2027-01-01', emoji: '🎆' },
  { name: 'Makar Sankranti', date: '2027-01-14', emoji: '🪁' },
  { name: 'Republic Day',    date: '2027-01-26', emoji: '🇮🇳' },
  { name: 'Holi',            date: '2027-03-03', emoji: '🎨' },
  { name: 'Eid ul-Fitr',     date: '2027-03-20', emoji: '🌙' },
  { name: 'Independence Day', date: '2027-08-15', emoji: '🇮🇳' },
  { name: 'Ganesh Chaturthi', date: '2027-08-17', emoji: '🐘' },
];

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const now = new Date();
  const upcoming = UPCOMING_FESTIVALS
    .map(f => ({ ...f, daysLeft: Math.ceil((new Date(f.date).getTime() - now.getTime()) / 86400000) }))
    .filter(f => f.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);
  return NextResponse.json({ festivals: upcoming });
}
