path_api = 'src/app/api/admin/history-stats/route.ts'
txt = open(path_api).read()
txt = txt.replace(
    "    prisma.lotteryBet.count({ where: { placedAt: { gte: dayStart, lt: dayEnd } } }),\n    prisma.lotteryBet.count({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' } }),\n    prisma.matkaBet.count({ where: { placedAt: { gte: dayStart, lt: dayEnd } } }),\n    prisma.matkaBet.count({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' } }),\n    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),",
    "    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amountPaid: true } }),\n    prisma.lotteryBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),\n    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd } }, _sum: { amount: true } }),\n    prisma.matkaBet.aggregate({ where: { placedAt: { gte: dayStart, lt: dayEnd }, status: 'WON' }, _sum: { wonAmount: true } }),"
)
txt = txt.replace(
    "    lotteryTickets, lotteryWinners,\n    matkaBets, matkaWinners,\n    matkaWonAgg,",
    "    lotteryBetAgg, lotteryWonAgg,\n    matkaBetAgg, matkaWonAgg,"
)
txt = txt.replace(
    "  const deposit   = depositAgg._sum.coins      ?? 0;\n  const withdraw  = withdrawAgg._sum.coins     ?? 0;\n  const matkaPaid = matkaWonAgg._sum.wonAmount ?? 0;\n  const profit    = deposit - withdraw - matkaPaid;\n\n  return { date: label, deposit, lotteryTickets, matkaBets, lotteryWinners, matkaWinners, withdraw, profit };",
    "  const deposit        = depositAgg._sum.coins         ?? 0;\n  const withdraw       = withdrawAgg._sum.coins        ?? 0;\n  const lotteryTickets = lotteryBetAgg._sum.amountPaid  ?? 0;\n  const lotteryWinners = lotteryWonAgg._sum.wonAmount   ?? 0;\n  const matkaBets      = matkaBetAgg._sum.amount        ?? 0;\n  const matkaPaid      = matkaWonAgg._sum.wonAmount     ?? 0;\n  const profit         = deposit - withdraw - matkaPaid;\n\n  return { date: label, deposit, lotteryTickets, matkaBets, lotteryWinners, matkaWinners: matkaPaid, withdraw, profit };"
)
open(path_api, 'w').write(txt)
print('history-stats/route.ts done')

path2 = 'src/app/admin/page.tsx'
txt2 = open(path2).read()
txt2 = txt2.replace(
    ">{(d.lotteryTickets??d.lotteryBets??0).toLocaleString()}</td>",
    ">₹{(d.lotteryTickets??0).toLocaleString()}</td>"
)
txt2 = txt2.replace(
    ">{(d.matkaBets??d.matkaBets??0).toLocaleString()}</td>",
    ">₹{(d.matkaBets??0).toLocaleString()}</td>"
)
txt2 = txt2.replace(
    ">{(d.lotteryWinners??0).toLocaleString()}</td>",
    ">₹{(d.lotteryWinners??0).toLocaleString()}</td>"
)
txt2 = txt2.replace(
    ">{(d.matkaWinners??0).toLocaleString()}</td>",
    ">₹{(d.matkaWinners??0).toLocaleString()}</td>"
)
txt2 = txt2.replace(
    "}}>{ historyStats.reduce((s:number,d:any)=>s+(d.lotteryTickets??d.lotteryBets??0),0).toLocaleString()}</td>",
    "}}>₹{historyStats.reduce((s:number,d:any)=>s+(d.lotteryTickets??0),0).toLocaleString()}</td>"
)
txt2 = txt2.replace(
    "}}>{ historyStats.reduce((s:number,d:any)=>s+(d.matkaBets??0),0).toLocaleString()}</td>",
    "}}>₹{historyStats.reduce((s:number,d:any)=>s+(d.matkaBets??0),0).toLocaleString()}</td>"
)
txt2 = txt2.replace(
    "}}>{ historyStats.reduce((s:number,d:any)=>s+(d.lotteryWinners??0),0).toLocaleString()}</td>",
    "}}>₹{historyStats.reduce((s:number,d:any)=>s+(d.lotteryWinners??0),0).toLocaleString()}</td>"
)
txt2 = txt2.replace(
    "}}>{ historyStats.reduce((s:number,d:any)=>s+(d.matkaWinners??0),0).toLocaleString()}</td>",
    "}}>₹{historyStats.reduce((s:number,d:any)=>s+(d.matkaWinners??0),0).toLocaleString()}</td>"
)
open(path2, 'w').write(txt2)
print('admin/page.tsx done')
