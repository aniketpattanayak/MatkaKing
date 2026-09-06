import { NextRequest, NextResponse } from 'next/server';
import { prisma, isAdminToken, json } from '@/lib/api-helper';

export const maxDuration = 60;

// All valid Single Patti numbers (digits sum to same ank)
// SP = all different digits, DP = 2 same + 1 diff, TP = all same
function getPattis() {
  const sp: string[] = [], dp: string[] = [], tp: string[] = [];
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      for (let k = 0; k <= 9; k++) {
        const p = `${i}${j}${k}`;
        const digits = [i,j,k];
        const unique = new Set(digits).size;
        if (unique === 3) sp.push(p);
        else if (unique === 2) dp.push(p);
        else tp.push(p);
      }
    }
  }
  return { sp: [...new Set(sp)], dp: [...new Set(dp)], tp: [...new Set(tp)] };
}

export async function GET(req: NextRequest) {
  if (!isAdminToken(req)) return NextResponse.json({ error:'Forbidden' },{ status:403 });
  
  const { searchParams } = new URL(req.url);
  const marketId = searchParams.get('marketId');
  const step = searchParams.get('step') ?? 'open'; // 'open' or 'close'
  const openPatti = searchParams.get('openPatti') ?? ''; // for close step

  if (!marketId) return json({ error:'marketId required' }, 400);

  try {
    const market = await prisma.matkaMarket.findUnique({ where: { id: marketId } });
    if (!market) return json({ error:'Market not found' }, 404);

    const PAYOUT: Record<string,number> = {
      SINGLE_ANK: market.payoutSingle, ANK: market.payoutSingle,
      JODI: market.payoutJodi,
      SINGLE_PATTI: market.payoutSP, SP: market.payoutSP,
      DOUBLE_PATTI: market.payoutDP, DP: market.payoutDP,
      TRIPLE_PATTI: market.payoutTP, TP: market.payoutTP,
      HALF_SANGAM: market.payoutHalfSangam,
      FULL_SANGAM: market.payoutFullSangam,
    };

    // Get all active bets
    const bets = await prisma.matkaBet.findMany({
      where: { marketId, status: 'ACTIVE' },
      select: { betType:true, betValue:true, session:true, amount:true },
    });

    const totalCollected = bets.reduce((s,b) => s + b.amount, 0);

    const ank = (p: string) => p.split('').reduce((s,d) => s+parseInt(d), 0) % 10;
    const { sp, dp, tp } = getPattis();

    // Try all patti combinations and find minimum payout
    const results: any[] = [];

    if (step === 'open') {
      // Try each possible open patti
      const allPattis = [...sp, ...dp, ...tp];
      const sample = allPattis.filter((_,i) => i % 3 === 0); // sample for speed

      for (const openP of sample) {
        const openAnk = ank(openP);
        let payout = 0;

        for (const bet of bets) {
          const bt = bet.betType?.toUpperCase();
          const bv = bet.betValue;
          const rate = PAYOUT[bet.betType??''] ?? 0;
          let won = false;

          if ((bt==='ANK'||bt==='SINGLE_ANK') && bet.session==='OPEN' && bv===String(openAnk)) won=true;
          if ((bt==='SINGLE_PATTI'||bt==='SP') && bet.session==='OPEN' && bv===openP) won=true;
          if ((bt==='DOUBLE_PATTI'||bt==='DP') && bet.session==='OPEN' && bv===openP) won=true;
          if ((bt==='TRIPLE_PATTI'||bt==='TP') && bet.session==='OPEN' && bv===openP) won=true;

          if (won) payout += bet.amount * rate;
        }

        results.push({ patti: openP, ank: openAnk, payout, profit: totalCollected - payout });
      }
    } else {
      // Close step - need openPatti to compute jodi
      if (!openPatti || openPatti.length !== 3) return json({ error:'openPatti required for close step' }, 400);
      const openAnk = ank(openPatti);

      const allPattis = [...sp, ...dp, ...tp];
      const sample = allPattis.filter((_,i) => i % 3 === 0);

      for (const closeP of sample) {
        const closeAnk = ank(closeP);
        const jodi = `${openAnk}${closeAnk}`;
        let payout = 0;

        for (const bet of bets) {
          const bt = bet.betType?.toUpperCase();
          const bv = bet.betValue;
          const rate = PAYOUT[bet.betType??''] ?? 0;
          let won = false;

          if ((bt==='ANK'||bt==='SINGLE_ANK') && bet.session==='CLOSE' && bv===String(closeAnk)) won=true;
          if (bt==='JODI' && bv===jodi) won=true;
          if ((bt==='SINGLE_PATTI'||bt==='SP') && bet.session==='CLOSE' && bv===closeP) won=true;
          if ((bt==='DOUBLE_PATTI'||bt==='DP') && bet.session==='CLOSE' && bv===closeP) won=true;
          if ((bt==='TRIPLE_PATTI'||bt==='TP') && bet.session==='CLOSE' && bv===closeP) won=true;
          if (bt==='HALF_SANGAM') {
            const parts = bv.split('-');
            if (parts.length===2) {
              if (parts[0]===String(openAnk) && parts[1]===closeP) won=true;
              if (parts[0]===openPatti && parts[1]===String(closeAnk)) won=true;
            }
          }
          if (bt==='FULL_SANGAM') {
            const parts = bv.split('-');
            if (parts[0]===openPatti && parts[1]===closeP) won=true;
          }

          if (won) payout += bet.amount * rate;
        }

        results.push({ patti: closeP, ank: closeAnk, jodi, payout, profit: totalCollected - payout });
      }
    }

    // Sort by payout ascending (safest = lowest payout = most profit)
    results.sort((a,b) => a.payout - b.payout);

    return NextResponse.json({
      ok: true,
      totalCollected,
      totalBets: bets.length,
      step,
      suggestions: results.slice(0, 10), // top 10 safest
      worstCase: results[results.length-1], // highest payout
    });
  } catch(e:any) {
    return NextResponse.json({ error:e.message },{ status:500 });
  }
}
