import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken } from '@/lib/api-helper';

// Indian festivals with typical dates
const UPCOMING_FESTIVALS = [
  { name: 'Diwali',        date: '2025-10-20', emoji: '🪔' },
  { name: 'Holi',          date: '2026-03-14', emoji: '🎨' },
  { name: 'Navratri',      date: '2025-10-02', emoji: '💃' },
  { name: 'Durga Puja',    date: '2025-10-02', emoji: '🙏' },
  { name: 'Ganesh Chaturthi', date: '2025-08-27', emoji: '🐘' },
  { name: 'Eid ul-Fitr',   date: '2026-03-30', emoji: '🌙' },
  { name: 'Christmas',     date: '2025-12-25', emoji: '🎄' },
  { name: 'New Year',      date: '2026-01-01', emoji: '🎆' },
  { name: 'Makar Sankranti', date: '2026-01-14', emoji: '🪁' },
  { name: 'Republic Day',  date: '2026-01-26', emoji: '🇮🇳' },
  { name: 'Independence Day', date: '2025-08-15', emoji: '🇮🇳' },
  { name: 'Raksha Bandhan', date: '2025-08-09', emoji: '🎀' },
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
