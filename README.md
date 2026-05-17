# Supreme Dynamic Gaming Engine

> Next.js 14 · App Router · TypeScript · Tailwind CSS · Prisma (PostgreSQL)  
> High-density industrial UI — converted from Lotex template

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout (dark theme)
│   ├── globals.css           # Design tokens, components
│   ├── api/
│   │   ├── webhook/upi/      # ✅ UPI payment webhook (HMAC-verified)
│   │   ├── lottery/search/   # ✅ Smart ticket search + bulk buy
│   │   ├── matka/result/     # ✅ Matka bets + result declaration
│   │   ├── admin/upi/        # ✅ UPI pool CRUD
│   │   └── spin/rewards/     # ✅ Spin wheel execution
│   ├── (games)/
│   │   ├── lottery/          # Lottery board page
│   │   ├── matka/            # Matka King page
│   │   └── spin/             # Spin wheel page
│   ├── (dashboard)/
│   │   ├── dashboard/        # User dashboard
│   │   └── wallet/           # Wallet + deposits
│   └── (admin)/admin/        # Admin panel
├── components/
│   ├── lottery/LotteryBoard.tsx    # ✅ Contact-style search + grid
│   ├── matka/MatkaMarket.tsx       # ✅ Full bet UI + patti selector
│   ├── matka/ProfitGuardDashboard  # ✅ God-Mode result declaration
│   ├── spin/SpinWheel.tsx          # ✅ Canvas spin animation
│   └── payment/UpiPoolManager.tsx  # ✅ Multi-UPI admin UI
├── lib/
│   ├── upi-pool.ts           # ✅ Auto-rotation logic
│   ├── ticket-search.ts      # ✅ High-performance filtering
│   ├── matka-engine.ts       # ✅ All Matka math (patti/ank/jodi)
│   └── profit-guard.ts       # ✅ God-Mode 30% margin algorithm
└── types/index.ts             # ✅ Complete TypeScript definitions
```

---

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Fill in DATABASE_URL, WEBHOOK_SECRET, ADMIN_SECRET
```

### 3. Set up database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to DB (dev)
npm run db:push

# Or run migrations (production)
npm run db:migrate
```

### 4. Run development server
```bash
npm run dev
# → http://localhost:3000
```

---

## 🎮 Feature Reference

### 1. Multi-UPI Gateway (`/api/admin/upi` + `/lib/upi-pool.ts`)
- **Admin adds** UPI IDs with transaction limits (e.g., limit=50)
- **Auto-rotation**: when limit hit → deactivate → next priority UPI takes over
- **Webhook** (`/api/webhook/upi`): HMAC-SHA256 verified, credits 1 Coin = 1 INR
- **Statuses**: PENDING → SUCCESS/FAILED (coins only credited on SUCCESS)

### 2. Smart Lottery Search (`/api/lottery/search`)
```
GET /api/lottery/search?seriesId=xxx&q=98
→ Returns AH0098, LI9821, etc. (real-time, debounced 200ms)

GET /api/lottery/search?seriesId=xxx&prefix=AH&suffix=99&lucky=7
→ Advanced filter

POST /api/lottery/search { userId, seriesId, quantity: 10|20|50, filter }
→ Bulk purchase with atomic wallet deduction
```

### 3. Matka King Engine (`/lib/matka-engine.ts`)
```
Patti: "1-2-3" → Ank: (1+2+3) % 10 = 6 → Display: "123-6"
Jodi:  openAnk=6, closeAnk=7 → "67"

Bet types: SINGLE_ANK, JODI, SINGLE_PATTI, DOUBLE_PATTI, 
           TRIPLE_PATTI, HALF_SANGAM, FULL_SANGAM

POST /api/matka/result { action: "place_bet", ... }
POST /api/matka/result { action: "declare_result", adminKey, marketId }
```

### 4. God-Mode Profit Guard (`/lib/profit-guard.ts`)
```
At draw time:
1. Load all active bets
2. Enumerate ALL possible results (10³ × 10³ = 1M combinations)
3. Compute payout for each result
4. Select result with MINIMUM payout
5. If house margin < 30% → inject dummy zero-bet result
6. Settle bets, credit winners, mark losers
```

### 5. Spin Wheel (`/api/spin/rewards`)
```
Config: pricePerSpin, buyXGetY_buy/get, rewards with probabilities
POST /api/spin/rewards { userId, spinConfigId }
→ Weighted random, credits coins, handles free spins
```

---

## 🗃 Database Schema Highlights

| Table | Key Columns |
|-------|------------|
| `User` | id, email, role, referralCode, referredBy |
| `Wallet` | balance (Coins), totalWon, totalDeposit |
| `UpiPool` | upiId, transactionLimit, currentTxnCount, priority |
| `Transaction` | orderId, type, status, amount, coins, webhookPayload |
| `LotterySeries` | prefix, startNumber, endNumber, ticketPrice, drawAt |
| `LotteryTicket` | ticketCode (indexed for LIKE search), isSold |
| `MatkaMarket` | openTime, closeTime, payoutMultipliers |
| `MatkaResult` | isDummyResult, houseProfitPct, totalBetAmount |
| `MatkaBet` | betType, betValue, session, potentialWin |
| `BetLiability` | possibleResult, totalExposure (real-time monitoring) |
| `SpinConfig` | pricePerSpin, buyXGetY |
| `SpinReward` | probability, coinsReward |

---

## 🔐 Security

- Webhook: HMAC-SHA256 signature verification
- Admin routes: `x-admin-key` header check
- Wallet operations: Prisma `$transaction` (atomic, no double-spend)
- Bet placement: balance check before deduction
- UPI pool: no UPI ID exposed to frontend without active transaction

---

## 🛠 Production Checklist

- [ ] Move `ADMIN_SECRET` to server-only env (remove `NEXT_PUBLIC_`)
- [ ] Add proper NextAuth session middleware to admin routes
- [ ] Enable Prisma connection pooling (PgBouncer / Neon)
- [ ] Add rate limiting on `/api/webhook/upi` and `/api/lottery/search`
- [ ] Set up background job (cron) for auto market open/close
- [ ] Configure SSL for database connection
- [ ] Enable Prisma Accelerate for edge caching (ticket search)
# MatkaKing
