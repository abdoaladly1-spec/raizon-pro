// وحدة الطباعة الحرارية الموحدة (Thermal Receipt 80mm) لجميع مطبوعات النظام
// تقارير الإقفال، مسير الرواتب والمستحقات، كشوف حساب العملاء، أوامر الشراء، والديون
// تصميم مطابق للفاتورة الحرارية الأساسية: خط Tahoma، تظليل رمادي خفيف، حدود واضحة وأبيض وأسود

export interface ThermalShopInfo {
  shopName?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

/** فتح نافذة طباعة حرارية 80mm مع التنسيق القياسي الاحترافي */
export const openThermalPrintWindow = (title: string, htmlContent: string) => {
  const printWindow = window.open('', '_blank', 'width=450,height=700');
  if (!printWindow) {
    // في حال حظر النوافذ المنبثقة، ننشئ عنصر طباعة مؤقت
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => document.body.removeChild(frame), 2000);
      }, 300);
    }
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.warn('Print error:', e);
    }
  };
};

/** غلاف صفحة HTML للطباعة الحرارية 80mm */
export const wrapThermalHtml = (title: string, bodyContent: string, shop?: ThermalShopInfo): string => {
  const shopName = (shop?.shopName || 'RaiZon Pro').trim();
  const phone = (shop?.phone || '').trim();
  const address = (shop?.address || '').trim();

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0mm;
      }
      body {
        margin: 0;
        padding: 4px;
        width: 76mm;
      }
      .no-print {
        display: none !important;
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Tahoma', 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #000000;
      background: #ffffff;
      width: 76mm;
      margin: 0 auto;
      padding: 6px 4px;
      font-weight: 600;
    }
    .thermal-header {
      text-align: center;
      border-bottom: 1.5px dashed #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .thermal-shop-name {
      font-size: 15px;
      font-weight: 900;
      margin: 0 0 2px 0;
    }
    .thermal-title-badge {
      font-size: 12px;
      font-weight: 800;
      margin: 4px 0;
      background: #f0f0f0;
      padding: 3px 8px;
      display: inline-block;
      border-radius: 4px;
      border: 1px solid #000;
    }
    .thermal-meta {
      font-size: 9.5px;
      color: #333;
      margin-top: 3px;
      line-height: 1.4;
    }
    .thermal-box {
      border: 1px solid #000;
      padding: 5px 6px;
      margin-bottom: 6px;
      border-radius: 4px;
      background: #fafafa;
    }
    .thermal-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 2.5px 0;
      font-size: 10.5px;
    }
    .thermal-row.bold {
      font-weight: 800;
    }
    .thermal-row.highlight {
      background: #f0f0f0;
      padding: 3px 4px;
      border-radius: 3px;
      font-weight: 800;
    }
    .thermal-divider {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .thermal-divider-double {
      border-top: 2px solid #000;
      margin: 6px 0;
    }
    table.thermal-table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
      font-size: 10px;
      font-family: 'Tahoma', Arial, sans-serif;
    }
    table.thermal-table th {
      border: 1px solid #000;
      background-color: #f0f0f0;
      padding: 4px 2px;
      font-weight: 800;
      text-align: center;
      font-size: 10px;
    }
    table.thermal-table td {
      border: 1px solid #000;
      padding: 3px 2px;
      text-align: center;
      font-size: 9.5px;
      font-weight: 600;
    }
    .thermal-total-banner {
      border: 2px solid #000;
      background: #f0f0f0;
      padding: 6px 8px;
      margin: 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      font-size: 12px;
    }
    .thermal-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      padding-top: 4px;
      font-size: 9.5px;
      font-weight: 700;
      text-align: center;
    }
    .thermal-sign-line {
      width: 46%;
      border-top: 1px dashed #000;
      padding-top: 4px;
      margin-top: 22px;
    }
    .thermal-footer {
      text-align: center;
      font-size: 9px;
      margin-top: 10px;
      border-top: 1px dashed #000;
      padding-top: 5px;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="thermal-header">
    <div class="thermal-shop-name">${shopName}</div>
    ${phone ? `<div class="thermal-meta">هاتف: ${phone}</div>` : ''}
    ${address ? `<div class="thermal-meta">${address}</div>` : ''}
    <div class="thermal-title-badge">${title}</div>
  </div>

  ${bodyContent}

  <div class="thermal-footer">
    نظام برو كاشير لإدارة نقاط البيع • ProCashier
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;
};

// =========================================================================
// 1. تقرير إقفال الوردية والخزينة (Shift Closing Report)
// =========================================================================
export interface ClosingReportData {
  reportId?: string;
  date?: string;
  openingBalance: number;
  cashSales: number;
  deposits: number;
  withdrawals: number;
  totalExpenses: number;
  expectedCash: number;
  walletSales: number;
  cardSales: number;
  creditSales: number;
  includeDebts?: boolean;
  totalClosingAmount: number;
  actualCash: number;
  difference: number;
  status: string;
  retainedInDrawer?: number;
  transferredToSafe?: number;
  cashierName?: string;
}

export const printClosingReportThermal = (
  report: ClosingReportData,
  shop?: ThermalShopInfo,
  cashierName?: string
) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const cashier = cashierName || report.cashierName || 'كاشير رئيسي';
  const diff = report.difference;
  const diffLabel = diff === 0 ? 'متطابق تماماً (لا عجز أو زيادة)' : diff < 0 ? `عجز بمقدار ${Math.abs(diff).toLocaleString('en-US')} ج.م` : `زيادة بمقدار ${diff.toLocaleString('en-US')} ج.م`;

  const bodyHtml = `
    <!-- بيانات الوردية -->
    <table class="thermal-table">
      <tr>
        <th style="width: 30%;">التاريخ / الوقت</th>
        <td dir="ltr" style="font-family: monospace; font-weight: bold;">${dateStr} | ${timeStr}</td>
      </tr>
      <tr>
        <th>الكاشير المسؤول</th>
        <td>${cashier}</td>
      </tr>
      <tr>
        <th>حالة الجرد</th>
        <td style="font-weight: 800;">${diffLabel}</td>
      </tr>
    </table>

    <!-- تفاصيل حركة درج النقدية -->
    <div class="thermal-box">
      <div style="font-weight: 800; text-align: center; margin-bottom: 4px; font-size: 10px; background: #eee; padding: 2px;">حركة درج النقدية (الكاش)</div>
      
      <div class="thermal-row">
        <span>الرصيد الافتتاحي (أمس):</span>
        <span style="font-family: monospace; font-weight: bold;">${Number(report.openingBalance || 0).toLocaleString('en-US')} ج.م</span>
      </div>

      <div class="thermal-row">
        <span>إجمالي الإيرادات النقدية:</span>
        <span style="font-family: monospace; font-weight: bold;">+${Number(report.cashSales || 0).toLocaleString('en-US')} ج.م</span>
      </div>

      <div class="thermal-row">
        <span>إيداعات نقدية للدرج:</span>
        <span style="font-family: monospace; font-weight: bold;">+${Number(report.deposits || 0).toLocaleString('en-US')} ج.م</span>
      </div>

      <div class="thermal-row">
        <span>مسحوبات من الدرج:</span>
        <span style="font-family: monospace; font-weight: bold;">-${Number(report.withdrawals || 0).toLocaleString('en-US')} ج.م</span>
      </div>

      <div class="thermal-row">
        <span>المصروفات والمرتجعات:</span>
        <span style="font-family: monospace; font-weight: bold;">-${Number(report.totalExpenses || 0).toLocaleString('en-US')} ج.م</span>
      </div>

      <div class="thermal-divider"></div>

      <div class="thermal-row highlight">
        <span>رصيد الدرج المتوقع:</span>
        <span style="font-family: monospace; font-size: 11px;">${Number(report.expectedCash || 0).toLocaleString('en-US')} ج.م</span>
      </div>
    </div>

    <!-- باقي وسائل الدفع والتقفيل الشامل -->
    <div class="thermal-box">
      <div style="font-weight: 800; text-align: center; margin-bottom: 4px; font-size: 10px; background: #eee; padding: 2px;">الأرصدة غير النقدية والتقفيل</div>
      
      <div class="thermal-row">
        <span>رصيد المحافظ الإلكترونية:</span>
        <span style="font-family: monospace; font-weight: bold;">+${Number(report.walletSales || 0).toLocaleString('en-US')} ج.م</span>
      </div>

      ${report.cardSales ? `
      <div class="thermal-row">
        <span>رصيد البطاقات (فيزا):</span>
        <span style="font-family: monospace; font-weight: bold;">+${Number(report.cardSales || 0).toLocaleString('en-US')} ج.م</span>
      </div>` : ''}

      <div class="thermal-row">
        <span>المديونيات (المدة كاملة):</span>
        <span style="font-family: monospace; font-weight: bold;">${report.includeDebts === false ? '(مستبعدة) ' : '+'}${Number(report.creditSales || 0).toLocaleString('en-US')} ج.م</span>
      </div>
    </div>

    <!-- إجمالي التقفيل الشامل -->
    <div class="thermal-total-banner">
      <span>إجمالي التقفيل الشامل:</span>
      <span style="font-family: monospace; font-size: 13px;">${Number(report.totalClosingAmount || (report.actualCash + report.walletSales + (report.cardSales || 0) + (report.creditSales || 0))).toLocaleString('en-US')} ج.م</span>
    </div>

    <!-- الجرد الفعلي والفارق -->
    <div class="thermal-box">
      <div class="thermal-row bold">
        <span>المبلغ الفعلي المستلم (الجرد):</span>
        <span style="font-family: monospace; font-size: 11.5px;">${Number(report.actualCash || 0).toLocaleString('en-US')} ج.م</span>
      </div>

      <div class="thermal-row bold" style="border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px;">
        <span>فارق الجرد والمطابقة:</span>
        <span style="font-family: monospace;">${diff > 0 ? '+' : ''}${diff.toLocaleString('en-US')} ج.م</span>
      </div>

      ${typeof report.retainedInDrawer === 'number' ? `
      <div class="thermal-row" style="color: #000; margin-top: 4px;">
        <span>المتبقي بالدرج للوردية القادمة:</span>
        <span style="font-family: monospace; font-weight: bold;">${report.retainedInDrawer.toLocaleString('en-US')} ج.م</span>
      </div>` : ''}

      ${typeof report.transferredToSafe === 'number' ? `
      <div class="thermal-row" style="color: #000;">
        <span>المبلغ المورّد للخزينة/الإدارة:</span>
        <span style="font-family: monospace; font-weight: bold;">${report.transferredToSafe.toLocaleString('en-US')} ج.م</span>
      </div>` : ''}
    </div>

    <!-- التوقيعات -->
    <div class="thermal-signatures">
      <div class="thermal-sign-line">توقيع الكاشير المسؤول</div>
      <div class="thermal-sign-line">توقيع واعتماد المدير</div>
    </div>
  `;

  const html = wrapThermalHtml('تقرير إقفال الوردية والخزينة', bodyHtml, shop);
  openThermalPrintWindow('Shift Closing Report', html);
};

// =========================================================================
// 2. فاتورة / سند مسير الراتب والمستحقات (Staff Salary Slip / Payslip)
// =========================================================================
export interface StaffPayslipData {
  staff: {
    id: string;
    name: string;
    role?: string;
    phone?: string;
    nationalId?: string;
    commissionValue?: number;
    commissionType?: string;
  };
  totalSalaries: number;
  totalCommissions: number;
  totalAdvances: number;
  totalDeductions: number;
  netDue: number;
  invoicesCount?: number;
  advancesList?: Array<{ amount: number; notes?: string; date: string }>;
  deductionsList?: Array<{ amount: number; notes?: string; date: string }>;
}

export const printStaffPayslipThermal = (
  data: StaffPayslipData,
  shop?: ThermalShopInfo
) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const slipId = `PAY-${data.staff.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  const totalGross = data.totalSalaries + data.totalCommissions;
  const totalCuts = data.totalAdvances + data.totalDeductions;

  const advancesRows = (data.advancesList || []).map(a => `
    <tr>
      <td style="text-align: right; padding: 2px 4px;">سلفة: ${a.notes || 'سلفة نقدية'} (${a.date})</td>
      <td style="font-family: monospace; font-weight: bold;">-${Number(a.amount).toLocaleString('en-US')}</td>
    </tr>
  `).join('');

  const deductionsRows = (data.deductionsList || []).map(d => `
    <tr>
      <td style="text-align: right; padding: 2px 4px;">خصم: ${d.notes || 'جزاء إداري'} (${d.date})</td>
      <td style="font-family: monospace; font-weight: bold;">-${Number(d.amount).toLocaleString('en-US')}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <!-- بيانات السند والموظف -->
    <table class="thermal-table">
      <tr>
        <th style="width: 32%;">رقم السند</th>
        <td dir="ltr" style="font-family: monospace; font-weight: bold;">${slipId}</td>
      </tr>
      <tr>
        <th>التاريخ</th>
        <td dir="ltr" style="font-family: monospace;">${dateStr}</td>
      </tr>
      <tr>
        <th>اسم الموظف</th>
        <td style="font-weight: 800;">${data.staff.name}</td>
      </tr>
      ${data.staff.role ? `
      <tr>
        <th>الوظيفة / الدور</th>
        <td>${data.staff.role}</td>
      </tr>` : ''}
      ${data.staff.phone ? `
      <tr>
        <th>رقم الهاتف</th>
        <td dir="ltr" style="font-family: monospace;">${data.staff.phone}</td>
      </tr>` : ''}
    </table>

    <!-- الاستحقاقات والمكتسبات -->
    <div style="font-weight: 800; font-size: 10px; margin: 4px 0 2px 0;">(+) الاستحقاقات والمكتسبات:</div>
    <table class="thermal-table">
      <thead>
        <tr>
          <th>البند</th>
          <th style="width: 35%;">المبلغ (ج.م)</th>
        </tr>
      </thead>
      <tbody>
        ${data.totalSalaries > 0 ? `
        <tr>
          <td style="text-align: right; padding: 2px 4px;">الراتب الأساسي / المكافآت</td>
          <td style="font-family: monospace; font-weight: bold;">${data.totalSalaries.toLocaleString('en-US')}</td>
        </tr>` : ''}
        <tr>
          <td style="text-align: right; padding: 2px 4px;">العمولات المكتسبة (${data.invoicesCount || 0} فاتورة)</td>
          <td style="font-family: monospace; font-weight: bold;">${data.totalCommissions.toLocaleString('en-US')}</td>
        </tr>
        <tr style="background: #f0f0f0; font-weight: 800;">
          <td style="text-align: right; padding: 3px 4px;">إجمالي الاستحقاقات</td>
          <td style="font-family: monospace;">${totalGross.toLocaleString('en-US')}</td>
        </tr>
      </tbody>
    </table>

    <!-- الاستقطاعات والخصومات -->
    <div style="font-weight: 800; font-size: 10px; margin: 6px 0 2px 0;">(-) الاستقطاعات والمسحوبات:</div>
    <table class="thermal-table">
      <thead>
        <tr>
          <th>البند</th>
          <th style="width: 35%;">المبلغ (ج.م)</th>
        </tr>
      </thead>
      <tbody>
        ${advancesRows || ''}
        ${deductionsRows || ''}
        ${!advancesRows && !deductionsRows ? '<tr><td colspan="2" style="color: #666;">لا توجد سلف أو استقطاعات مسجلة</td></tr>' : ''}
        <tr style="background: #f0f0f0; font-weight: 800;">
          <td style="text-align: right; padding: 3px 4px;">إجمالي الاستقطاعات</td>
          <td style="font-family: monospace;">-${totalCuts.toLocaleString('en-US')}</td>
        </tr>
      </tbody>
    </table>

    <!-- صافي المستحق -->
    <div class="thermal-total-banner">
      <span>صافي الراتب المستحق:</span>
      <span style="font-family: monospace; font-size: 13px;">${data.netDue.toLocaleString('en-US')} ج.م</span>
    </div>

    <!-- التوقيعات -->
    <div class="thermal-signatures">
      <div class="thermal-sign-line">توقيع واستلام الموظف</div>
      <div class="thermal-sign-line">توقيع واعتماد الإدارة</div>
    </div>
  `;

  const html = wrapThermalHtml('سند مفردات الراتب والمستحقات', bodyHtml, shop);
  openThermalPrintWindow('Staff Payslip', html);
};

// =========================================================================
// 3. كشف حساب الموظف (Staff Statement)
// =========================================================================
export const printStaffStatementThermal = (
  staff: { name: string; role?: string; phone?: string },
  fin: { invoicesTotal: number; totalCommissions: number; totalAdvances: number; totalDeductions: number; netDue: number },
  shop?: ThermalShopInfo
) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });

  const bodyHtml = `
    <table class="thermal-table">
      <tr>
        <th style="width: 32%;">التاريخ</th>
        <td dir="ltr" style="font-family: monospace;">${dateStr}</td>
      </tr>
      <tr>
        <th>الموظف</th>
        <td style="font-weight: 800;">${staff.name}</td>
      </tr>
      ${staff.role ? `
      <tr>
        <th>الوظيفة</th>
        <td>${staff.role}</td>
      </tr>` : ''}
    </table>

    <div class="thermal-box">
      <div class="thermal-row">
        <span>إجمالي المبيعات المنفذة:</span>
        <span style="font-family: monospace; font-weight: bold;">${(fin.invoicesTotal || 0).toLocaleString('en-US')} ج.م</span>
      </div>
      <div class="thermal-row">
        <span>(+) إجمالي العمولات المكتسبة:</span>
        <span style="font-family: monospace; font-weight: bold;">+${(fin.totalCommissions || 0).toLocaleString('en-US')} ج.م</span>
      </div>
      <div class="thermal-row">
        <span>(-) إجمالي السلف والمسحوبات:</span>
        <span style="font-family: monospace; font-weight: bold;">-${(fin.totalAdvances || 0).toLocaleString('en-US')} ج.م</span>
      </div>
      <div class="thermal-row">
        <span>(-) إجمالي الجزاءات والخصومات:</span>
        <span style="font-family: monospace; font-weight: bold;">-${(fin.totalDeductions || 0).toLocaleString('en-US')} ج.م</span>
      </div>
    </div>

    <div class="thermal-total-banner">
      <span>صافي المستحق للصرف:</span>
      <span style="font-family: monospace; font-size: 13px;">${(fin.netDue || 0).toLocaleString('en-US')} ج.م</span>
    </div>

    <div class="thermal-signatures">
      <div class="thermal-sign-line">توقيع واستلام الموظف</div>
      <div class="thermal-sign-line">توقيع واعتماد الإدارة</div>
    </div>
  `;

  const html = wrapThermalHtml('كشف حساب ومستحقات موظف', bodyHtml, shop);
  openThermalPrintWindow('Staff Statement', html);
};

// =========================================================================
// 4. كشف حساب العميل (Customer Account Statement)
// =========================================================================
export interface CustomerStatementRow {
  date: string;
  desc: string;
  debit: number;  // مدين (عليه)
  credit: number; // دائن (له/سدد)
  balance: number;
}

export const printCustomerStatementThermal = (
  customer: { name: string; phone?: string; totalDebt?: number },
  rows: CustomerStatementRow[],
  shop?: ThermalShopInfo
) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });

  const tableRows = rows.map(r => `
    <tr>
      <td style="font-size: 8.5px; padding: 2px;">${r.date}</td>
      <td style="text-align: right; font-size: 9px; padding: 2px 3px;">${r.desc}</td>
      <td style="font-family: monospace; font-size: 9px;">${r.debit > 0 ? r.debit.toLocaleString('en-US') : '-'}</td>
      <td style="font-family: monospace; font-size: 9px;">${r.credit > 0 ? r.credit.toLocaleString('en-US') : '-'}</td>
      <td style="font-family: monospace; font-weight: bold; font-size: 9px;">${r.balance.toLocaleString('en-US')}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <table class="thermal-table">
      <tr>
        <th style="width: 30%;">تاريخ الكشف</th>
        <td dir="ltr" style="font-family: monospace;">${dateStr}</td>
      </tr>
      <tr>
        <th>اسم العميل</th>
        <td style="font-weight: 800;">${customer.name}</td>
      </tr>
      ${customer.phone ? `
      <tr>
        <th>رقم الهاتف</th>
        <td dir="ltr" style="font-family: monospace;">${customer.phone}</td>
      </tr>` : ''}
    </table>

    <table class="thermal-table">
      <thead>
        <tr>
          <th style="width: 18%;">التاريخ</th>
          <th>البيان</th>
          <th style="width: 17%;">مدين (+)</th>
          <th style="width: 17%;">دائن (-)</th>
          <th style="width: 18%;">الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || '<tr><td colspan="5" style="color: #666; padding: 6px;">لا توجد حركات مسجلة</td></tr>'}
      </tbody>
    </table>

    <div class="thermal-total-banner">
      <span>الرصيد المتبقي المستحق:</span>
      <span style="font-family: monospace; font-size: 13px;">${Number(customer.totalDebt || 0).toLocaleString('en-US')} ج.م</span>
    </div>

    <div class="thermal-signatures">
      <div class="thermal-sign-line">توقيع العميل</div>
      <div class="thermal-sign-line">توقيع المحاسب / الإدارة</div>
    </div>
  `;

  const html = wrapThermalHtml('كشف حساب عميل', bodyHtml, shop);
  openThermalPrintWindow('Customer Statement', html);
};

// =========================================================================
// 5. كشف الديون العام (Debts List / Report)
// =========================================================================
export const printDebtsListThermal = (
  customers: Array<{ name: string; phone?: string; totalDebt: number }>,
  shop?: ThermalShopInfo
) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const debtors = customers.filter(c => (c.totalDebt || 0) > 0);
  const totalDebts = debtors.reduce((sum, c) => sum + (c.totalDebt || 0), 0);

  const rowsHtml = debtors.map((c, i) => `
    <tr>
      <td style="width: 10%;">${i + 1}</td>
      <td style="text-align: right; padding: 2px 4px;">
        <div style="font-weight: bold;">${c.name}</div>
        ${c.phone ? `<div style="font-size: 8px; color: #555;" dir="ltr">${c.phone}</div>` : ''}
      </td>
      <td style="font-family: monospace; font-weight: bold; width: 30%;">${Number(c.totalDebt).toLocaleString('en-US')} ج.م</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <table class="thermal-table">
      <tr>
        <th style="width: 32%;">تاريخ الكشف</th>
        <td dir="ltr" style="font-family: monospace;">${dateStr}</td>
      </tr>
      <tr>
        <th>عدد المدينين</th>
        <td style="font-weight: bold;">${debtors.length} عميل</td>
      </tr>
    </table>

    <table class="thermal-table">
      <thead>
        <tr>
          <th>#</th>
          <th>اسم العميل</th>
          <th>المبلغ المستحق</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="3" style="color: #666; padding: 6px;">لا توجد أي مديونيات مسجلة</td></tr>'}
      </tbody>
    </table>

    <div class="thermal-total-banner">
      <span>إجمالي الديون المستحقة:</span>
      <span style="font-family: monospace; font-size: 13px;">${totalDebts.toLocaleString('en-US')} ج.م</span>
    </div>

    <div class="thermal-signatures">
      <div class="thermal-sign-line">توقيع المسؤول</div>
      <div class="thermal-sign-line">اعتماد المدير</div>
    </div>
  `;

  const html = wrapThermalHtml('كشف المديونيات والآجل', bodyHtml, shop);
  openThermalPrintWindow('Debts List', html);
};

// =========================================================================
// 6. أمر شراء / فاتورة مشتريات (Purchase Order)
// =========================================================================
export interface PurchaseOrderItemRow {
  name: string;
  quantity: number;
  cost: number;
  total: number;
}

export const printPurchaseOrderThermal = (
  order: { id: string; date: string; supplierName?: string; total: number; notes?: string },
  items: PurchaseOrderItemRow[],
  shop?: ThermalShopInfo
) => {
  const itemsHtml = items.map(i => `
    <tr>
      <td style="text-align: right; padding: 2px 3px;">${i.name}</td>
      <td style="font-family: monospace;">${i.quantity}</td>
      <td style="font-family: monospace;">${i.cost.toLocaleString('en-US')}</td>
      <td style="font-family: monospace; font-weight: bold;">${i.total.toLocaleString('en-US')}</td>
    </tr>
  `).join('');

  const bodyHtml = `
    <table class="thermal-table">
      <tr>
        <th style="width: 30%;">رقم الطلب</th>
        <td dir="ltr" style="font-family: monospace; font-weight: bold;">#${order.id}</td>
      </tr>
      <tr>
        <th>التاريخ</th>
        <td dir="ltr" style="font-family: monospace;">${order.date}</td>
      </tr>
      ${order.supplierName ? `
      <tr>
        <th>المورّد</th>
        <td style="font-weight: 800;">${order.supplierName}</td>
      </tr>` : ''}
    </table>

    <table class="thermal-table">
      <thead>
        <tr>
          <th>الصنف</th>
          <th style="width: 14%;">الكمية</th>
          <th style="width: 20%;">السعر</th>
          <th style="width: 24%;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="thermal-total-banner">
      <span>إجمالي أمر الشراء:</span>
      <span style="font-family: monospace; font-size: 13px;">${Number(order.total).toLocaleString('en-US')} ج.م</span>
    </div>

    ${order.notes ? `
    <div class="thermal-box" style="font-size: 9.5px;">
      <b>ملاحظات:</b> ${order.notes}
    </div>` : ''}

    <div class="thermal-signatures">
      <div class="thermal-sign-line">توقيع المستلم / أمين المخزن</div>
      <div class="thermal-sign-line">توقيع واعتماد الإدارة</div>
    </div>
  `;

  const html = wrapThermalHtml('أمر توريد وشراء بضاعة', bodyHtml, shop);
  openThermalPrintWindow('Purchase Order', html);
};
