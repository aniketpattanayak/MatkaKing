path = 'src/app/api/auth/register/route.ts'
txt = open(path).read()
txt = txt.replace(
    'const initialBalance = SIGNUP_BONUS_COINS + (referrer ? REFEREE_EXTRA_COINS : 0);',
    'const initialBalance = SIGNUP_BONUS_COINS;'
)
old_ref = """          if (referrer) {
            await tx.wallet.update({ where: { userId: referrer.id }, data: { balance: { increment: REFERRER_BONUS_COINS } } });
            await tx.transaction.create({ data: { userId: referrer.id, type: 'WIN_CREDIT', status: 'SUCCESS', coins: REFERRER_BONUS_COINS, amount: 0, orderId: `REF-${u.id.slice(-6)}-${Date.now()}` } });
            await tx.transaction.create({ data: { userId: u.id, type: 'WIN_CREDIT', status: 'SUCCESS', coins: REFEREE_EXTRA_COINS, amount: 0, orderId: `REF-NEW-${u.id.slice(-6)}-${Date.now()}` } });
          }"""
new_ref = """          if (referrer) {
            const referrerBonus = REFERRER_BONUS_COINS + REFEREE_EXTRA_COINS;
            await tx.wallet.update({ where: { userId: referrer.id }, data: { balance: { increment: referrerBonus } } });
            await tx.transaction.create({ data: { userId: referrer.id, type: 'REFERRAL', status: 'SUCCESS', coins: referrerBonus, amount: 0, orderId: `REF-${u.id.slice(-6)}-${Date.now()}` } });
          }"""
txt = txt.replace(old_ref, new_ref)
open(path, 'w').write(txt)
print('register/route.ts done' if old_ref in open(path).read() == False else 'register/route.ts done')

path2 = 'src/app/dashboard/wallet/page.tsx'
txt2 = open(path2).read()
txt2 = txt2.replace(
    "  const txnColor = (t: string) => ['DEPOSIT','WIN_CREDIT','BONUS','SPIN_WIN'].includes(t) ? '#2ECC71' : '#ef4444';\n  const txnSign  = (t: string) => ['DEPOSIT','WIN_CREDIT','BONUS','SPIN_WIN'].includes(t) ? '+' : '-';",
    "  const txnLabel = (t: any) => {\n    if ((t.type === 'WIN_CREDIT' || t.type === 'REFERRAL') && t.orderId?.startsWith('REF-')) return 'REFERRAL';\n    return t.type.replace(/_/g,' ');\n  };\n  const txnColorType = (t: any) => ['DEPOSIT','WIN CREDIT','BONUS','SPIN WIN','REFERRAL'].includes(txnLabel(t)) ? '#2ECC71' : '#ef4444';\n  const txnSignType  = (t: any) => ['DEPOSIT','WIN CREDIT','BONUS','SPIN WIN','REFERRAL'].includes(txnLabel(t)) ? '+' : '-';\n  const txnColor = (t: string) => ['DEPOSIT','WIN_CREDIT','BONUS','SPIN_WIN','REFERRAL'].includes(t) ? '#2ECC71' : '#ef4444';\n  const txnSign  = (t: string) => ['DEPOSIT','WIN_CREDIT','BONUS','SPIN_WIN','REFERRAL'].includes(t) ? '+' : '-';"
)
txt2 = txt2.replace(
    "                        <td style={{ padding:'14px 20px', fontWeight:600, fontSize:14 }}>{t.type.replace(/_/g,' ')}</td>",
    "                        <td style={{ padding:'14px 20px', fontWeight:600, fontSize:14 }}>{txnLabel(t)}</td>"
)
txt2 = txt2.replace("color:txnColor(t.type)", "color:txnColorType(t)")
txt2 = txt2.replace("{txnSign(t.type)}", "{txnSignType(t)}")
open(path2, 'w').write(txt2)
print('wallet/page.tsx done')
