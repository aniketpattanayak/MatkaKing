path = 'src/app/admin/page.tsx'
txt = open(path).read()

txt = txt.replace(
    ">{(d.lotteryTickets??d.lotteryBets??0).toLocaleString()}</td>",
    ">₹{(d.lotteryTickets??0).toLocaleString()}</td>"
)
txt = txt.replace(
    ">{(d.matkaBets??d.matkaBets??0).toLocaleString()}</td>",
    ">₹{(d.matkaBets??0).toLocaleString()}</td>"
)
txt = txt.replace(
    ">{(d.lotteryWinners??0).toLocaleString()}</td>",
    ">₹{(d.lotteryWinners??0).toLocaleString()}</td>"
)
txt = txt.replace(
    ">{(d.matkaWinners??0).toLocaleString()}</td>",
    ">₹{(d.matkaWinners??0).toLocaleString()}</td>"
)
txt = txt.replace(
    "}}>{ historyStats.reduce((s:number,d:any)=>s+(d.lotteryTickets??d.lotteryBets??0),0).toLocaleString()}</td>",
    "}}>₹{historyStats.reduce((s:number,d:any)=>s+(d.lotteryTickets??0),0).toLocaleString()}</td>"
)
txt = txt.replace(
    "s+(d.lotteryTickets??d.lotteryBets??0),0).toLocaleString()}</td>",
    "s+(d.lotteryTickets??0),0).toLocaleString()}</td>"
)
txt = txt.replace(
    "}>{historyStats.reduce((s:number,d:any)=>s+(d.matkaBets??0),0).toLocaleString()}</td>",
    "}}>₹{historyStats.reduce((s:number,d:any)=>s+(d.matkaBets??0),0).toLocaleString()}</td>"
)

open(path, 'w').write(txt)

# Verify
result = open(path).read()
checks = [
    '₹{(d.lotteryTickets??0)' in result,
    '₹{(d.matkaBets??0)' in result,
    '₹{(d.lotteryWinners??0)' in result,
    '₹{(d.matkaWinners??0)' in result,
]
print('Checks:', checks)
print('Done!' if all(checks) else 'Some replacements may have missed')
