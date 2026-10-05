path = 'src/app/admin/page.tsx'
lines = open(path).readlines()
changed = 0

for i, line in enumerate(lines):
    # Only touch lines inside the daily report table (around lotteryTickets/matkaBets display)
    if "(d.lotteryTickets??d.lotteryBets??0).toLocaleString()" in line and "reduce" not in line:
        lines[i] = line.replace(">{(d.lotteryTickets??d.lotteryBets??0).toLocaleString()}</td>", ">₹{(d.lotteryTickets??0).toLocaleString()}</td>")
        changed += 1
    elif "(d.matkaBets??d.matkaBets??0).toLocaleString()" in line and "reduce" not in line:
        lines[i] = line.replace(">{(d.matkaBets??d.matkaBets??0).toLocaleString()}</td>", ">₹{(d.matkaBets??0).toLocaleString()}</td>")
        changed += 1
    elif "(d.lotteryWinners??0).toLocaleString()" in line and "reduce" not in line:
        lines[i] = line.replace(">{(d.lotteryWinners??0).toLocaleString()}", ">₹{(d.lotteryWinners??0).toLocaleString()}")
        changed += 1
    elif "(d.matkaWinners??0).toLocaleString()" in line and "reduce" not in line:
        lines[i] = line.replace(">{(d.matkaWinners??0).toLocaleString()}", ">₹{(d.matkaWinners??0).toLocaleString()}")
        changed += 1
    # Footer totals - only lines with both 'reduce' and these specific fields
    elif "lotteryTickets??d.lotteryBets" in line and "reduce" in line:
        lines[i] = line.replace("s+(d.lotteryTickets??d.lotteryBets??0),0).toLocaleString()}", "s+(d.lotteryTickets??0),0).toLocaleString()}").replace("}>{", "}}>₹{")
        changed += 1
    elif "s+(d.matkaBets??0),0).toLocaleString()}" in line and "reduce" in line and "color:'#9B59B6'" in line:
        lines[i] = line.replace("}>{historyStats", "}}>₹{historyStats").replace("}}>₹{historyStats" if "}}}>" in line else "", "}}>₹{historyStats")
        # Safe: just prepend ₹ 
        lines[i] = lines[i].replace("}>{historyStats", "}}>₹{historyStats")
        changed += 1
    elif "s+(d.lotteryWinners??0),0).toLocaleString()}" in line and "reduce" in line:
        lines[i] = line.replace("}>{historyStats", "}}>₹{historyStats")
        changed += 1
    elif "s+(d.matkaWinners??0),0).toLocaleString()}" in line and "reduce" in line:
        lines[i] = line.replace("}>{historyStats", "}}>₹{historyStats")
        changed += 1

open(path, 'w').writelines(lines)
print(f'Changed {changed} lines')
