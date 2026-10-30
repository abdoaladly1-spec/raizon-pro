// اختبارات منطق المرتجعات (نقية، بلا سيرفر وبلا مساس بأي قاعدة):
//   node server/returns_logic_test.ts
// تغطي: المبالغ وقت البيع، المتبقي بعد المرتجعات السابقة، التحقق الكامل،
// رد المبلغ لكل طريقة، عكس النقاط/العمولات، ومرتجعات الدرج.

import {
  isReturnable,
  saleLineAmounts,
  remainingRefundable,
  paidForMethod,
  buildReturnItems,
  validateReturn,
  cashReturnsFor,
  reversedPointsFor,
  commissionReversalPlan,
} from '../lib/returns.ts';

let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} ${detail}`);
  if (ok) passed++;
  else failed++;
};
const approx = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

const catalog: any[] = [
  // السعر الحالي 200 — لا يجوز أن يدخل في حساب المرتجع (البيع كان بـ100)
  { id: 'a', name: 'منتج أ', price: 200, trackStock: true, type: 'product', returnable: true, quantity: 40 },
  { id: 'b', name: 'منتج ب', price: 90, trackStock: true, type: 'product', returnable: true, quantity: 40 },
  { id: 's', name: 'خدمة', price: 50, trackStock: false, type: 'service', quantity: 0 },
  { id: 'n', name: 'غير قابل', price: 50, trackStock: true, type: 'product', returnable: false, quantity: 40 },
];

const invoice: any = {
  id: 101,
  uid: 'inv-101',
  customerId: 7,
  customerName: 'زبون الاختبار',
  items: [
    { itemId: 'a', name: 'منتج أ', price: 100, quantity: 5 },
    { itemId: 'b', name: 'منتج ب', price: 50, quantity: 4 },
    { itemId: 's', name: 'خدمة', price: 50, quantity: 1 },
    { itemId: 'n', name: 'غير قابل', price: 50, quantity: 2 },
  ],
  // إجمالي البيع: 500+200+50+100 = 850 − خصم10% = 765 + ضريبة5% = 803.25
  subtotal: 850,
  discountPercent: 10,
  taxPercent: 5,
  total: 803.25,
  paymentParts: [
    { method: 'cash', amount: 300 },
    { method: 'card', amount: 503.25 },
  ],
  paymentMethod: 'split',
  date: '2026-09-30',
  timestamp: 1790000000000,
  status: 'paid',
};

// مرتجع سابق معتمد: قطعة واحدة من الصنف أ
const priorReturn: any = {
  uid: 'ret-prior',
  id: 1,
  invoiceUid: 'inv-101',
  invoiceId: 101,
  items: [
    {
      itemId: 'a', name: 'منتج أ', quantity: 1, price: 100,
      discountAmount: 10, taxAmount: 4.5, refundAmount: 94.5,
      returnable: true, trackStock: true, type: 'product', restocked: true,
    },
  ],
  refundAmount: 94.5,
  refundParts: [{ method: 'cash', amount: 94.5 }],
  cashRefund: 94.5,
  type: 'partial',
  status: 'approved',
  reason: 'عيب',
  createdBy: 'admin',
  pointsReversed: 0,
  commissionReversed: 0,
  date: '2026-09-30',
  timestamp: 1790000000000,
  createdAt: '',
  updatedAt: 1790000000000,
};

// --- 1) مبالغ وقت البيع ----------------------------------------------------
const lineA = invoice.items[0];
const amountsA = saleLineAmounts(invoice, lineA, 4);
check(
  'sale-time amounts (itemA ×4)',
  approx(amountsA.gross, 400) && approx(amountsA.discountAmount, 40)
    && approx(amountsA.taxAmount, 18) && approx(amountsA.refundAmount, 378),
  JSON.stringify(amountsA),
);
const amountsB = saleLineAmounts(invoice, invoice.items[1], 4);
check(
  'sale-time amounts (itemB ×4)',
  approx(amountsB.refundAmount, 189),
  JSON.stringify(amountsB),
);

// --- 2) المتبقي بعد المرتجع السابق ----------------------------------------
const remaining = remainingRefundable(invoice, [priorReturn]);
const remA = remaining.items.find(i => i.itemId === 'a')!;
check(
  'remaining qty after prior return',
  remA.quantity === 4 && remA.returnedQuantity === 1 && remA.invoiceQuantity === 5,
  JSON.stringify(remA),
);
check(
  'remaining amount is sale-time',
  approx(remA.amount, 378),
  String(remA.amount),
);
check('prior returned amount counted', approx(remaining.returnedAmount, 94.5), String(remaining.returnedAmount));
check('not all returned yet', remaining.allReturned === false);

// --- 3) التحقق الكامل ------------------------------------------------------
const noInvoice = validateReturn({ invoice: null, returns: [], selections: [{ itemId: 'a', quantity: 1 }], refundParts: [], catalog });
check('no invoice rejected', noInvoice.ok === false && noInvoice.error === 'return_no_invoice', String(noInvoice.error));

const noItems = validateReturn({ invoice, returns: [priorReturn], selections: [], refundParts: [], catalog });
check('no items rejected', noItems.ok === false && noItems.error === 'return_no_items', String(noItems.error));

const qtyExceeded = validateReturn({
  invoice, returns: [priorReturn],
  selections: [{ itemId: 'a', quantity: 5 }],
  refundParts: [{ method: 'cash', amount: 472.5 }], catalog,
});
check('qty above remaining rejected', qtyExceeded.ok === false && qtyExceeded.error === 'return_qty_exceeded', String(qtyExceeded.error));

const partsMismatch = validateReturn({
  invoice, returns: [priorReturn],
  selections: [{ itemId: 'a', quantity: 4 }],
  refundParts: [{ method: 'cash', amount: 100 }], catalog,
});
check('parts mismatch rejected', partsMismatch.ok === false && partsMismatch.error === 'return_parts_mismatch', String(partsMismatch.error));

const cashTooMuch = validateReturn({
  invoice, returns: [priorReturn],
  selections: [{ itemId: 'a', quantity: 4 }],
  // دُفع كاش 300 ورُدَّ 94.5 => المسموح كاش 205.5 فقط — إعادة 350 مرفوضة
  refundParts: [{ method: 'cash', amount: 350 }, { method: 'card', amount: 28 }],
  catalog,
});
check('cash above paid rejected', cashTooMuch.ok === false && cashTooMuch.error === 'return_cash_exceeds_paid', String(cashTooMuch.error));

const cashCumulative = validateReturn({
  invoice, returns: [priorReturn],
  selections: [{ itemId: 'a', quantity: 4 }],
  // مطابقة للمدفوع كاشاً (300) لكنها تتجاوز المتبقي بعد المرتجع السابق
  refundParts: [{ method: 'cash', amount: 206 }, { method: 'card', amount: 172 }],
  catalog,
});
check('cumulative cash cap rejected', cashCumulative.ok === false && cashCumulative.error === 'return_cash_exceeds_paid', String(cashCumulative.error));

const okPartial = validateReturn({
  invoice, returns: [priorReturn],
  selections: [{ itemId: 'a', quantity: 4 }],
  refundParts: [{ method: 'cash', amount: 205.5 }, { method: 'card', amount: 172.5 }],
  catalog,
});
check(
  'valid partial return',
  okPartial.ok && approx(okPartial.refundAmount, 378) && approx(okPartial.cashRefund, 205.5) && okPartial.type === 'partial',
  JSON.stringify({ ok: okPartial.ok, refund: okPartial.refundAmount, cash: okPartial.cashRefund, type: okPartial.type, error: okPartial.error }),
);

const okFull = validateReturn({
  invoice, returns: [priorReturn],
  selections: [{ itemId: 'a', quantity: 4 }, { itemId: 'b', quantity: 4 }, { itemId: 's', quantity: 1 }, { itemId: 'n', quantity: 2 }],
  // المتبقي بعد المرتجع السابق = 708.75 (من إجمالي 803.25)؛ كاش مسموح 205.5
  refundParts: [{ method: 'cash', amount: 205.5 }, { method: 'card', amount: 503.25 }],
  catalog,
});
check(
  'full return when everything returned',
  okFull.ok && okFull.type === 'full' && approx(okFull.refundAmount, 708.75),
  JSON.stringify({ ok: okFull.ok, refund: okFull.refundAmount, type: okFull.type, error: okFull.error }),
);

// بنود قابلة للإرجاع فقط تدخل المرتجع (الخدمة والغير قابل مستبعدان من buildReturnItems؟
// buildReturnItems تبني من اختيار المستخدم: الصنف غير القابل يدخل البنود لكن restocked=false)
const built = buildReturnItems(invoice, [{ itemId: 'n', quantity: 1 }, { itemId: 's', quantity: 1 }], [priorReturn], catalog);
check(
  'service/non-returnable snapshots',
  built.length === 2
    && built.find(i => i.itemId === 's')!.restocked === false
    && built.find(i => i.itemId === 'n')!.restocked === false
    && built.find(i => i.itemId === 'n')!.returnable === false,
  JSON.stringify(built.map(b => ({ id: b.itemId, returnable: b.returnable, restocked: b.restocked }))),
);
check('service never restocked (isReturnable)', isReturnable(catalog[2]) === false && isReturnable(catalog[0]) === true);

// السعر لا يتأثر بتغيّر الكتالوج بعد البيع
check('catalog price ignored', approx(built[0].refundAmount, saleLineAmounts(invoice, invoice.items[3], 1).refundAmount), String(built[0].refundAmount));

// --- 4) طرق الدفع ----------------------------------------------------------
check('paid cash part', approx(paidForMethod(invoice, 'cash'), 300), String(paidForMethod(invoice, 'cash')));
const legacyCash: any = { ...invoice, paymentParts: undefined, paymentMethod: 'cash' };
check('legacy cash invoice', approx(paidForMethod(legacyCash, 'cash'), 803.25), String(paidForMethod(legacyCash, 'cash')));
const legacyVisa: any = { ...invoice, paymentParts: undefined, paymentMethod: 'visa' };
check('legacy visa -> card', approx(paidForMethod(legacyVisa, 'card'), 803.25) && paidForMethod(legacyVisa, 'cash') === 0);

// --- 5) مرتجعات الدرج ------------------------------------------------------
const rejected: any = { ...priorReturn, uid: 'ret-rej', status: 'rejected', cashRefund: 50 };
const otherDay: any = { ...priorReturn, uid: 'ret-other', date: '2020-01-01', cashRefund: 25, timestamp: 1 };
const pendingRet: any = { ...priorReturn, uid: 'ret-pend', status: 'pending', cashRefund: 75 };
const sameDay = (r: any) => r.date === '2026-09-30';
const cash = cashReturnsFor([priorReturn, rejected, otherDay, pendingRet], sameDay);
check('drawer cash counts approved same-day only', approx(cash, 94.5), String(cash));

// --- 6) عكس النقاط ---------------------------------------------------------
check('points floor', reversedPointsFor(94.5, true, 0.1) === 9, String(reversedPointsFor(94.5, true, 0.1)));
check('points disabled', reversedPointsFor(94.5, false, 1) === 0);
check('points zero-award', reversedPointsFor(94.5, true, 0) === 0);

// --- 7) عكس العمولة --------------------------------------------------------
const staffPayments = [
  { id: 'p1', type: 'commission', amount: 80.33, invoiceUid: 'inv-101', reversedAmount: 0 },
  { id: 'p2', type: 'commission', amount: 50, invoiceUid: 'inv-other', reversedAmount: 0 },
  { id: 'p3', type: 'salary', amount: 1000, invoiceUid: 'inv-101', reversedAmount: 0 },
  { id: 'p4', type: 'commission', amount: 60, invoiceUid: 'inv-101', reversedAmount: 55, reversedBy: 'ret-old' },
];
const plan = commissionReversalPlan(invoice, 80.325, staffPayments as any);
check(
  'commission plan links invoice only + caps already reversed',
  plan.length === 2
    && approx(plan.find(p => p.paymentId === 'p1')!.amount, 8.03)
    && approx(plan.find(p => p.paymentId === 'p4')!.amount, 5),
  JSON.stringify(plan),
);
const planShare = commissionReversalPlan(invoice, 803.25 / 2, staffPayments as any);
check('commission proportional', approx(planShare.find(p => p.paymentId === 'p1')!.amount, 40.17, 0.011), JSON.stringify(planShare));
const planCap = commissionReversalPlan(invoice, 803.25, staffPayments as any);
const p4 = planCap.find(p => p.paymentId === 'p4');
check('commission capped by un-reversed', !!p4 && approx(p4!.amount, 5, 0.01), JSON.stringify(planCap));
check('no commission plan without invoice', commissionReversalPlan(null, 100, staffPayments as any).length === 0);

console.log('-'.repeat(60));
console.log(`${passed}/${passed + failed} اختبارات ناجحة`);
if (failed > 0) console.log(`${failed} اختبار فاشل`);
process.exitCode = failed > 0 ? 1 : 0;
