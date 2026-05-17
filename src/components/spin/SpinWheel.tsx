'use client';

import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { SpinWheelSegment } from '@/types';

interface SpinWheelProps {
  segments: SpinWheelSegment[];
  spinConfigId: string;
  userId: string;
  pricePerSpin: number;
  buyXGetY?: { buy: number; get: number } | null;
  userBalance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

export default function SpinWheel({
  segments,
  spinConfigId,
  userId,
  pricePerSpin,
  buyXGetY,
  userBalance,
  onBalanceUpdate,
}: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<{ label: string; coinsWon: number } | null>(null);
  const [currentAngle, setCurrentAngle] = useState(0);
  const animRef = useRef<number>();

  const WHEEL_SIZE = 320;
  const CENTER = WHEEL_SIZE / 2;
  const RADIUS = CENTER - 10;

  // ─── Draw Wheel ────────────────────────────────────────────────────────────
  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);

    const sliceAngle = (2 * Math.PI) / segments.length;

    segments.forEach((seg, i) => {
      const startAngle = angle + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER);
      ctx.arc(CENTER, CENTER, RADIUS, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(CENTER, CENTER);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(seg.label, RADIUS - 10, 4);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 28, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1d27';
    ctx.fill();
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center icon
    ctx.fillStyle = '#f5a623';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', CENTER, CENTER);
  };

  useEffect(() => {
    drawWheel(currentAngle);
  }, [segments, currentAngle]);

  // ─── Spin Logic ────────────────────────────────────────────────────────────
  const spin = async () => {
    if (isSpinning) return;
    if (pricePerSpin > userBalance) {
      toast.error(`Insufficient coins. Need ${pricePerSpin} coins.`);
      return;
    }

    setIsSpinning(true);
    setResult(null);

    try {
      // Call API first to get the result
      const res = await fetch('/api/spin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, spinConfigId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Find winning segment index
      const winningSegIdx = segments.findIndex((s) => s.label === data.reward.label);
      const sliceAngle = (2 * Math.PI) / segments.length;

      // Target angle: spin 5+ full rotations + land on winner
      const targetSegAngle = -winningSegIdx * sliceAngle - sliceAngle / 2;
      const totalRotation = Math.PI * 2 * (5 + Math.random() * 3) + targetSegAngle;
      const targetAngle = currentAngle + totalRotation;

      const duration = 4500;
      const startTime = performance.now();
      const startAngle = currentAngle;

      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Cubic ease-out
        const eased = 1 - Math.pow(1 - progress, 3);
        const angle = startAngle + (targetAngle - startAngle) * eased;

        drawWheel(angle);
        setCurrentAngle(angle);

        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          setIsSpinning(false);
          setResult(data.reward);
          onBalanceUpdate(data.newBalance);

          if (data.reward.coinsWon > 0) {
            toast.success(`🎉 ${data.reward.label} — You won ${data.reward.coinsWon} Coins!`);
          } else {
            toast.info(`🎰 ${data.reward.label}. Better luck next time!`);
          }
        }
      };

      animRef.current = requestAnimationFrame(animate);
    } catch (e: unknown) {
      setIsSpinning(false);
      toast.error(e instanceof Error ? e.message : 'Spin failed');
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Buy X Get Y banner */}
      {buyXGetY && (
        <div className="panel-highlight px-4 py-2 text-sm text-center">
          🎁 <strong>Buy {buyXGetY.buy}</strong> spins, get <strong>{buyXGetY.get} FREE</strong>!
        </div>
      )}

      {/* Wheel */}
      <div className="relative">
        {/* Pointer */}
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1 z-10"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
        >
          <div
            style={{
              width: 0, height: 0,
              borderTop: '14px solid transparent',
              borderBottom: '14px solid transparent',
              borderRight: '28px solid #f5a623',
            }}
          />
        </div>

        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: isSpinning
              ? '0 0 40px rgba(245,166,35,0.6), 0 0 80px rgba(245,166,35,0.3)'
              : '0 0 20px rgba(245,166,35,0.2)',
            transition: 'box-shadow 0.3s',
          }}
        />

        <canvas
          ref={canvasRef}
          width={WHEEL_SIZE}
          height={WHEEL_SIZE}
          className="rounded-full cursor-pointer"
          onClick={spin}
        />
      </div>

      {/* Spin Button */}
      <button
        onClick={spin}
        disabled={isSpinning || pricePerSpin > userBalance}
        className="btn-primary px-10 py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ minWidth: 200 }}
      >
        {isSpinning
          ? '⏳ Spinning…'
          : pricePerSpin === 0
          ? '🎰 Free Spin!'
          : `🎰 Spin for ${pricePerSpin} Coins`}
      </button>

      {/* Result Display */}
      {result && (
        <div
          className={`panel-highlight px-8 py-4 text-center fade-in-up ${
            result.coinsWon > 0 ? 'border-emerald-400/40' : ''
          }`}
        >
          <div className="text-3xl font-bold mb-1">
            {result.coinsWon > 0 ? '🎉' : '😔'} {result.label}
          </div>
          {result.coinsWon > 0 && (
            <div className="text-emerald-400 font-bold text-xl">
              +{result.coinsWon} Coins credited!
            </div>
          )}
        </div>
      )}

      {/* Rewards Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-sm">
        {segments.map((seg) => (
          <div key={seg.id} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-gray-400">{seg.label}</span>
            <span className="ml-auto text-gray-600 text-[10px]">
              {(seg.probability * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
