'use client';

import { useState } from 'react';
import { Clock, TrendingUp, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { MatkaBetType, MatkaSession, MatkaMarketInfo } from '@/types';

interface MatkaMarketProps {
  market: MatkaMarketInfo;
  userId: string;
  userBalance: number;
}

const BET_TYPES: { type: MatkaBetType; label: string; desc: string }[] = [
  { type: 'SINGLE_ANK', label: 'Single Ank',     desc: 'Single digit (0-9)' },
  { type: 'JODI',        label: 'Jodi',           desc: 'Two digits (00-99)' },
  { type: 'SINGLE_PATTI',label: 'Single Patti',  desc: '3 different digits' },
  { type: 'DOUBLE_PATTI',label: 'Double Patti',  desc: '2 same + 1 different' },
  { type: 'TRIPLE_PATTI',label: 'Triple Patti',  desc: 'All 3 digits same' },
  { type: 'HALF_SANGAM', label: 'Half Sangam',   desc: 'Ank + Patti combo' },
  { type: 'FULL_SANGAM', label: 'Full Sangam',   desc: 'Open + Close Patti' },
];

const DIGITS = Array.from({ length: 10 }, (_, i) => i);

export default function MatkaMarketBoard({ market, userId, userBalance }: MatkaMarketProps) {
  const [betType, setBetType] = useState<MatkaBetType>('SINGLE_ANK');
  const [session, setSession] = useState<MatkaSession>('OPEN');
  const [betValue, setBetValue] = useState('');
  const [amount, setAmount] = useState(10);
  const [isPlacing, setIsPlacing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const currentBetInfo = BET_TYPES.find((b) => b.type === betType)!;

  const payoutMap: Record<MatkaBetType, number> = {
    SINGLE_ANK:    market.payouts.singleAnk,
    JODI:          market.payouts.jodi,
    SINGLE_PATTI:  market.payouts.singlePatti,
    DOUBLE_PATTI:  market.payouts.doublePatti,
    TRIPLE_PATTI:  market.payouts.triplePatti,
    HALF_SANGAM:   market.payouts.halfSangam,
    FULL_SANGAM:   market.payouts.fullSangam,
  };

  const potentialWin = amount * payoutMap[betType];

  const handleDigitClick = (digit: number) => {
    if (betType === 'SINGLE_ANK') {
      setBetValue(String(digit));
    } else if (betType === 'JODI') {
      setBetValue((prev) => (prev.length >= 2 ? String(digit) : prev + String(digit)));
    } else {
      setBetValue((prev) => (prev.length >= 3 ? String(digit) : prev + String(digit)));
    }
  };

  const placeBet = async () => {
    if (!betValue) return toast.warning('Enter a bet value');
    if (amount < 1) return toast.warning('Minimum bet is ₹1');
    if (amount > userBalance) return toast.error('Insufficient coins');

    setIsPlacing(true);
    try {
      const res = await fetch('/api/matka/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          marketId: market.id,
          userId,
          betType,
          betValue,
          session,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(
        `✅ Bet placed! ${betType} "${betValue}" for ${amount} Coins. 
         Potential win: ${data.potentialWin} Coins`
      );
      setBetValue('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bet failed');
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <div className="panel p-0 overflow-hidden">
      {/* ─── Market Header ───────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${market.isOpen ? 'bg-emerald-400 pulse-gold' : 'bg-red-500'}`} />
          <div>
            <h3 className="font-bold text-base">{market.name}</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock size={11} /> Open: {market.openTime}
              </span>
              <span>·</span>
              <span>Close: {market.closeTime}</span>
              <span>·</span>
              <span>Result: {market.resultTime}</span>
            </div>
          </div>
        </div>
        <span className={market.isOpen ? 'badge-success badge' : 'badge-danger badge'}>
          {market.isOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {/* ─── Body ────────────────────────────────────────────────────────── */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT: Bet Type + Value ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Bet Type Selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Bet Type
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {BET_TYPES.map((bt) => (
                <button
                  key={bt.type}
                  onClick={() => { setBetType(bt.type); setBetValue(''); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                    betType === bt.type
                      ? 'border-amber-400 bg-amber-500/15 text-amber-400 border'
                      : 'border border-white/5 text-gray-400 hover:border-white/10'
                  }`}
                >
                  <div className="font-semibold">{bt.label}</div>
                  <div className="opacity-60 text-[10px]">{bt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Session */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Session
            </label>
            <div className="flex gap-2">
              {(['OPEN', 'CLOSE'] as MatkaSession[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSession(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    session === s ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Digit Pad */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              {betType === 'SINGLE_ANK' ? 'Select Digit' : 'Enter Bet Value'}
            </label>

            {/* Quick digit pad */}
            {(betType === 'SINGLE_ANK' || betType === 'JODI') && (
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {DIGITS.map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDigitClick(d)}
                    className="matka-num"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              className="input-field font-mono text-lg text-center font-bold tracking-widest"
              placeholder={currentBetInfo.desc}
              value={betValue}
              onChange={(e) => setBetValue(e.target.value.replace(/[^0-9-]/g, ''))}
              maxLength={betType === 'FULL_SANGAM' ? 7 : betType === 'HALF_SANGAM' ? 5 : betType === 'JODI' ? 2 : 3}
            />
            {betValue && (
              <p className="text-center text-xs text-gray-500 mt-1">
                Bet: <span className="text-amber-400 font-mono font-bold">{betValue}</span>
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: Amount + Summary ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Bet Amount (Coins)
            </label>
            <input
              type="number"
              min={1}
              className="input-field text-lg font-bold"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            />
            <div className="flex gap-1.5 mt-2">
              {[10, 50, 100, 500].map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className="flex-1 py-1.5 text-xs rounded-lg border border-white/5 text-gray-400 hover:border-amber-400/30 hover:text-amber-400 transition-all"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Payout Info */}
          <div className="panel-highlight p-4 rounded-xl">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Bet Summary
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Multiplier</span>
                <span className="font-bold text-amber-400">{payoutMap[betType]}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bet Amount</span>
                <span className="font-bold">{amount} Coins</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-gray-500">Potential Win</span>
                <span className="font-bold text-xl text-emerald-400">{potentialWin.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payout Table */}
          <div className="panel p-4 rounded-xl">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp size={12} /> Payout Rates
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {BET_TYPES.slice(0, 6).map((bt) => (
                <div key={bt.type} className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-gray-500">{bt.label}</span>
                  <span className="text-amber-400 font-bold">{payoutMap[bt.type]}x</span>
                </div>
              ))}
            </div>
          </div>

          {/* Place Bet Button */}
          {market.isOpen ? (
            <button
              onClick={placeBet}
              disabled={isPlacing || !betValue}
              className="btn-primary justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPlacing ? 'Placing…' : `Place Bet — ${amount} Coins`}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle size={16} />
              Market is closed. Next open: {market.openTime}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
