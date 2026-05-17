import { NextRequest } from 'next/server';
import { prisma, isAdminToken, json } from '@/lib/api-helper';

function toCSV(rows: Record<string, any>[], headers: string[]): string {
  const escape = (v: any) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const header = headers.join(',');
  const body   = rows.map(r => headers.map(h => escape(r[h])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return json({ error: 'Forbidden' }, 403);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'transactions'; // transactions | users | bets
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const dateFilter = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to)   } : {}),
  };

  try {
    let csv = '';
    let filename = '';

    if (type === 'transactions') {
      const rows = await prisma.transaction.findMany({
        where:   Object.keys(dateFilter).length ? { createdAt: dateFilter } : {},
        orderBy: { createdAt: 'desc' },
        take:    5000,
        include: { user: { select: { name: true, email: true } } },
      });
      const data = rows.map(r => ({
        ID:         r.id,
        User:       r.user?.name ?? '',
        Email:      r.user?.email ?? '',
        Type:       r.type,
        Status:     r.status,
        Coins:      r.coins,
        Amount_INR: r.amount,
        Order_ID:   r.orderId ?? '',
        Date:       new Date(r.createdAt).toLocaleString('en-IN'),
      }));
      csv      = toCSV(data, ['ID','User','Email','Type','Status','Coins','Amount_INR','Order_ID','Date']);
      filename = `transactions_${Date.now()}.csv`;
    }

    if (type === 'users') {
      const rows = await prisma.user.findMany({
        where:   Object.keys(dateFilter).length ? { createdAt: dateFilter } : {},
        orderBy: { createdAt: 'desc' },
        take:    5000,
        include: { wallet: { select: { balance: true, totalDeposit: true, totalWon: true } } },
      });
      const data = rows.map(r => ({
        ID:             r.id,
        Name:           r.name ?? '',
        Email:          r.email,
        Role:           r.role,
        Balance:        r.wallet?.balance ?? 0,
        Total_Deposit:  r.wallet?.totalDeposit ?? 0,
        Total_Won:      r.wallet?.totalWon ?? 0,
        Active:         r.isActive,
        Joined:         new Date(r.createdAt).toLocaleString('en-IN'),
      }));
      csv      = toCSV(data, ['ID','Name','Email','Role','Balance','Total_Deposit','Total_Won','Active','Joined']);
      filename = `users_${Date.now()}.csv`;
    }

    if (type === 'matka_bets') {
      const rows = await prisma.matkaBet.findMany({
        where:   Object.keys(dateFilter).length ? { placedAt: dateFilter } : {},
        orderBy: { placedAt: 'desc' },
        take:    5000,
        include: {
          user:   { select: { name: true, email: true } },
          market: { select: { name: true } },
        },
      });
      const data = rows.map(r => ({
        ID:           r.id,
        User:         r.user?.name ?? '',
        Email:        r.user?.email ?? '',
        Market:       r.market?.name ?? '',
        Bet_Type:     r.betType,
        Bet_Value:    r.betValue,
        Session:      r.session,
        Amount:       r.amount,
        Potential_Win: r.potentialWin,
        Won_Amount:   r.wonAmount,
        Status:       r.status,
        Date:         new Date(r.placedAt).toLocaleString('en-IN'),
      }));
      csv      = toCSV(data, ['ID','User','Email','Market','Bet_Type','Bet_Value','Session','Amount','Potential_Win','Won_Amount','Status','Date']);
      filename = `matka_bets_${Date.now()}.csv`;
    }

    if (type === 'lottery_bets') {
      const rows = await prisma.lotteryBet.findMany({
        where:   Object.keys(dateFilter).length ? { placedAt: dateFilter } : {},
        orderBy: { placedAt: 'desc' },
        take:    5000,
        include: {
          user:   { select: { name: true, email: true } },
          series: { select: { name: true } },
          ticket: { select: { ticketCode: true, isWinner: true } },
        },
      });
      const data = rows.map(r => ({
        ID:          r.id,
        User:        r.user?.name ?? '',
        Email:       r.user?.email ?? '',
        Series:      r.series?.name ?? '',
        Ticket_Code: r.ticket?.ticketCode ?? '',
        Amount_Paid: r.amountPaid,
        Won_Amount:  r.wonAmount,
        Is_Winner:   r.ticket?.isWinner ? 'YES' : 'NO',
        Status:      r.status,
        Date:        new Date(r.placedAt).toLocaleString('en-IN'),
      }));
      csv      = toCSV(data, ['ID','User','Email','Series','Ticket_Code','Amount_Paid','Won_Amount','Is_Winner','Status','Date']);
      filename = `lottery_bets_${Date.now()}.csv`;
    }

    if (!csv) return json({ error: 'Invalid export type' }, 400);

    return new Response(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}
