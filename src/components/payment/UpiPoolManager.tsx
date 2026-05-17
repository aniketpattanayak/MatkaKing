'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Power, Trash2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import type { UpiPoolEntry } from '@/types';

export default function UpiPoolManager() {
  const [pool, setPool] = useState<UpiPoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    upiId: '',
    label: '',
    transactionLimit: 50,
    priority: 0,
  });

  const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

  const fetchPool = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/upi', {
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      const data = await res.json();
      setPool(data.pool ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPool(); }, []);

  const addEntry = async () => {
    if (!form.upiId || !form.label) return toast.warning('All fields required');
    try {
      const res = await fetch('/api/admin/upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`UPI ${form.upiId} added to pool`);
      setForm({ upiId: '', label: '', transactionLimit: 50, priority: 0 });
      setAdding(false);
      fetchPool();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const resetEntry = async (id: string, upiId: string) => {
    await fetch('/api/admin/upi', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ id, action: 'reset' }),
    });
    toast.success(`Reset: ${upiId}`);
    fetchPool();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch('/api/admin/upi', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchPool();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this UPI entry?')) return;
    await fetch(`/api/admin/upi?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    toast.success('Deleted');
    fetchPool();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">UPI Pool Manager</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-rotation: switch UPI after limit reached to prevent bank flagging
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPool} className="btn-secondary py-2 text-xs">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setAdding(true)} className="btn-primary py-2 text-xs">
            <Plus size={13} /> Add UPI
          </button>
        </div>
      </div>

      {/* ─── Add Form ──────────────────────────────────────────────────────── */}
      {adding && (
        <div className="panel-highlight p-5 fade-in-up">
          <h3 className="font-semibold text-sm mb-4">Add New UPI</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">UPI ID</label>
              <input
                className="input-field"
                placeholder="merchant@upi"
                value={form.upiId}
                onChange={(e) => setForm({ ...form, upiId: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Label</label>
              <input
                className="input-field"
                placeholder="Primary / Backup 1"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Transaction Limit <span className="text-amber-400">(auto-rotate after)</span>
              </label>
              <input
                type="number"
                className="input-field"
                value={form.transactionLimit}
                onChange={(e) => setForm({ ...form, transactionLimit: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priority (0 = highest)</label>
              <input
                type="number"
                className="input-field"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addEntry} className="btn-primary text-xs py-2">Add to Pool</button>
            <button onClick={() => setAdding(false)} className="btn-secondary text-xs py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* ─── Pool Table ────────────────────────────────────────────────────── */}
      <div className="panel overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>UPI ID</th>
              <th>Label</th>
              <th>Used / Limit</th>
              <th>Status</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">Loading…</td></tr>
            ) : pool.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">No UPI entries. Add one above.</td></tr>
            ) : (
              pool.map((entry) => {
                const usagePct = (entry.currentTxnCount / entry.transactionLimit) * 100;
                return (
                  <tr key={entry.id}>
                    <td className="font-mono text-sm text-amber-400">#{entry.priority}</td>
                    <td className="font-mono text-sm font-bold">{entry.upiId}</td>
                    <td className="text-sm text-gray-400">{entry.label}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {entry.currentTxnCount}/{entry.transactionLimit}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={entry.isActive ? 'badge-success badge' : 'badge-danger badge'}>
                        {entry.isActive ? 'Active' : 'Rotated Out'}
                      </span>
                    </td>
                    <td className="text-emerald-400 font-semibold">{entry.successCount}</td>
                    <td className="text-red-400 font-semibold">{entry.failedCount}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => resetEntry(entry.id, entry.upiId)}
                          className="p-1.5 rounded hover:bg-white/5 text-blue-400 hover:text-blue-300 transition-colors"
                          title="Reset count"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => toggleActive(entry.id, entry.isActive)}
                          className={`p-1.5 rounded transition-colors ${
                            entry.isActive
                              ? 'text-amber-400 hover:text-red-400 hover:bg-red-500/10'
                              : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={entry.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Auto-Rotation Info ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 text-xs text-gray-500 panel p-4">
        <Activity size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <strong className="text-amber-400">Auto-Rotation Logic:</strong> When a UPI ID reaches its
          transaction limit, the system automatically deactivates it and routes new payments to the next
          highest-priority active UPI. Reset the count (⟳) after a bank cooldown period to re-enable.
        </div>
      </div>
    </div>
  );
}
