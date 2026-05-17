// ─── Core Domain Types ────────────────────────────────────────────────────────

export type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
export type TxnType = 'DEPOSIT' | 'WITHDRAWAL' | 'BET_DEBIT' | 'WIN_CREDIT' | 'REFUND' | 'BONUS' | 'SPIN_WIN';
export type TxnStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING' | 'REVERSED';
export type BetStatus = 'ACTIVE' | 'WON' | 'LOST' | 'REFUNDED';
export type LotteryStatus = 'OPEN' | 'CLOSED' | 'DRAWN' | 'CANCELLED';
export type MatkaBetType = 'SINGLE_ANK' | 'JODI' | 'SINGLE_PATTI' | 'DOUBLE_PATTI' | 'TRIPLE_PATTI' | 'HALF_SANGAM' | 'FULL_SANGAM';
export type MatkaSession = 'OPEN' | 'CLOSE';

// ─── UPI Pool ────────────────────────────────────────────────────────────────

export interface UpiPoolEntry {
  id: string;
  upiId: string;
  label: string;
  transactionLimit: number;
  currentTxnCount: number;
  isActive: boolean;
  priority: number;
  successCount: number;
  failedCount: number;
}

export interface ActiveUpiResult {
  upiId: string;
  poolId: string;
  qrDataUrl?: string;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export interface PaymentInitiateRequest {
  userId: string;
  amountInr: number; // integer, in INR
}

export interface PaymentInitiateResponse {
  orderId: string;
  upiId: string;
  amount: number;
  qrString: string; // UPI deep-link URI
  expiresAt: string;
}

export interface UpiWebhookPayload {
  orderId: string;
  upiRef: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  amount: number;
  paidAt?: string;
  signature: string; // HMAC-SHA256 of orderId+amount+status
}

// ─── Lottery ──────────────────────────────────────────────────────────────────

export interface TicketSearchResult {
  ticketCode: string;
  ticketId: string;
  isSold: boolean;
  seriesId: string;
  seriesName: string;
  price: number;
}

export interface BulkBuyRequest {
  userId: string;
  seriesId: string;
  quantity: 10 | 20 | 50;
  filter?: TicketFilter;
}

export interface TicketFilter {
  prefix?: string;    // prefix match
  suffix?: string;    // suffix match
  contains?: string;  // substring match (the smart search)
  luckyNumber?: string; // number appears anywhere
}

// ─── Matka King ───────────────────────────────────────────────────────────────

export interface MatkaMarketInfo {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  resultTime: string;
  isOpen: boolean;
  payouts: MatkaPayouts;
}

export interface MatkaPayouts {
  singleAnk: number;
  jodi: number;
  singlePatti: number;
  doublePatti: number;
  triplePatti: number;
  halfSangam: number;
  fullSangam: number;
}

export interface PattiResult {
  patti: string;   // "1-2-3"
  ank: number;     // 6
  display: string; // "123-6"
}

export interface PlaceBetRequest {
  userId: string;
  marketId: string;
  betType: MatkaBetType;
  betValue: string;
  session: MatkaSession;
  amount: number; // Coins
}

// ─── God-Mode Profit Guard ────────────────────────────────────────────────────

export interface LiabilityMap {
  [possibleResult: string]: {
    totalExposure: number;
    betCount: number;
  };
}

export interface ProfitGuardResult {
  selectedResult: string;
  totalBetsAmount: number;
  selectedPayout: number;
  houseProfitPct: number;
  isDummyResult: boolean;
  allExposures: LiabilityMap;
}

// ─── Spin Wheel ───────────────────────────────────────────────────────────────

export interface SpinWheelSegment {
  id: string;
  label: string;
  coinsReward: number;
  probability: number;
  color: string;
  icon?: string;
}

export interface SpinResultPayload {
  userId: string;
  spinConfigId: string;
  useFreeSpins?: boolean;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers24h: number;
  totalRevenue: number;      // Coins deposited
  totalPayout: number;       // Coins paid out
  netProfit: number;
  pendingDeposits: number;
  liveMatkaExposure: number; // real-time max liability
}
