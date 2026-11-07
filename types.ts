export interface CustomReceiptTemplate {
  id: string;
  name: string;
  desc?: string;
  createdAt: number;
  config: {
    pageSize: '80mm' | '58mm' | 'A4' | 'A5';
    marginMm: number;
    baseFontSize: number;
    titleText?: string;
    footerText?: string;
    enableShading?: boolean;
    showBarcode?: boolean;
    primaryColor?: string;
    accentColor?: string;
    textColor?: string;
    template?: string;
  };
  initialConfig: {
    pageSize: '80mm' | '58mm' | 'A4' | 'A5';
    marginMm: number;
    baseFontSize: number;
    titleText?: string;
    footerText?: string;
    enableShading?: boolean;
    showBarcode?: boolean;
    primaryColor?: string;
    accentColor?: string;
    textColor?: string;
    template?: string;
  };
}

export type Language = 'ar' | 'en';

export type Role = 'admin' | 'cashier' | 'manager' | 'waiter';

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
}

export interface User {
  id: string;
  username: string;
  name: string;
  /** @deprecated كلمة مرور قديمة (نص صريح) — تُرحَّل إلى hash عند أول دخول ثم تُمسح */
  password?: string;
  /** PBKDF2-SHA256 hash (base64) */
  passwordHash?: string;
  passwordSalt?: string;
  /** رمز سريع اختياري لكل مستخدم — hash + salt */
  pinHash?: string;
  pinSalt?: string;
  /** إجبار تغيير كلمة المرور في أول دخول (حساب admin الافتراضي) */
  mustChangePassword?: boolean;
  role: Role;
  permissions: string[];
  active: boolean;
  locationId?: string; // If restricted to one location
  hidden?: boolean;
  /** توقيت آخر تسجيل دخول ناجح على السيستم (timestamp) */
  lastLogin?: number;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  detailsAr?: string;
  user: string;
  timestamp: number;
}

export interface ItemVariant {
  id: string;
  name: string;
  price: number;
  sku?: string;
  quantity: number;
}

export interface ItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface Item {
  id: string;
  nameAr: string;
  nameEn: string;
  categoryId: string;
  price: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  trackStock: boolean;
  quantity: number;
  alertThreshold: number;
  variants: ItemVariant[];
  modifiers: ItemModifier[];
  image?: string;
  type: 'product' | 'service';
  /**
   * هل يقبل هذا الصنف الإرجاع؟ (افتراضي: المنتجات نعم، الخدمات لا).
   * يُلقط وقت البيع في سجل المرتجع حتى لا يتغيّر القرار لاحقاً.
   */
  returnable?: boolean;
  /** تاريخ انتهاء الصلاحية للمنتجات (YYYY-MM-DD) */
  expiryDate?: string;
  /** رقم التشغيلة أو الدفعة (Batch / Lot #) */
  batchNumber?: string;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  color?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalSpent: number;
  lastVisit: string;
  loyaltyPoints?: number;
  tier?: 'Bronze' | 'Silver' | 'Gold' | string;
  notes?: string;
  loyaltyCard?: string;
  /** الحد الائتماني المسموح به للشراء الآجل (ج.م) */
  creditLimit?: number;
  /** الرصيد المدين الحالي / المديونية المستحقة على العميل */
  balance?: number;
  /** مؤهل للشراء الآجل (عميل VIP) */
  isVip?: boolean;
}

export interface CustomerPayment {
  id: string;
  customerId: number;
  customerName?: string;
  amount: number;
  date: string;
  timestamp: number;
  paymentMethod: 'cash' | 'card' | 'wallet' | 'instapay';
  notes?: string;
  recordedBy?: string;
  receiptNumber?: string;
}

export interface InvoiceItem {
  itemId: string;
  variantId?: string;
  name: string;
  price: number;
  cost?: number;
  quantity: number;
  modifiers: ItemModifier[];
  discount?: number;
}

/** جزء من إجمالي الفاتورة مدفوع بطريقة معيّنة (الدفع المختلط) */
export interface PaymentPart {
  method: 'cash' | 'card' | 'wallet' | 'instapay';
  amount: number;
}

/**
 * بند داخل سجل مرتجع.
 * المبالغ محسوبة من سعر/خصم/ضريبة **وقت البيع** (لقطة) لا من الأسعار الحالية.
 */
export interface ReturnItem {
  itemId: string;
  name: string;
  /** الكمية المرتجعة في هذه العملية */
  quantity: number;
  /** سعر البيع وقت البيع */
  price: number;
  /** حصة الخصم وقت البيع لهذه الكمية (تناسبية) */
  discountAmount: number;
  /** حصة الضريبة وقت البيع لهذه الكمية */
  taxAmount: number;
  /** المسترد لهذا البند = سعر − خصم + ضريبة (وقت البيع) */
  refundAmount: number;
  /** لقطة: كان الصنف قابل للإرجاع وقت البيع */
  returnable: boolean;
  /** لقطة: كان الصنف يتبع المخزون وقت البيع */
  trackStock: boolean;
  /** لقطة: كان النوع منتجاً (الخدمات لا تُعاد للمخزون أبداً) */
  type: 'product' | 'service';
  /** هل أُعيدت الكمية فعلياً للمخزون عند اعتماد المرتجع */
  restocked: boolean;
}

/** حالة سجل المرتجع */
export type ReturnStatus = 'pending' | 'approved' | 'rejected';

/**
 * سجل مرتجع مستقل (جزئي أو كامل) مرتبط بالفاتورة الأصلية.
 * الفاتورة الأصلية لا تُعدَّل أبداً (تبقى مقفلة بعد البيع).
 */
export interface ReturnRecord {
  /** معرّف ثابت (UUID) — أساس الهوية ومنع التكرار عند المزامنة */
  uid: string;
  /** رقم محلي للعرض فقط (الهوية الحقيقية هي uid) */
  id: number;
  /** uid الفاتورة الأصلية */
  invoiceUid: string;
  /** رقم الفاتورة المحلي وقت البيع */
  invoiceId: number;
  items: ReturnItem[];
  /** إجمالي المسترد (بنود + خصم/ضريبة وقت البيع) */
  refundAmount: number;
  /** توزيع رد المبلغ على الطرق */
  refundParts: PaymentPart[];
  /** الجزء النقدي من المرتجع — يُخصم من درج النقدية فقط */
  cashRefund: number;
  /** 'partial' جزئي أو 'full' كامل (مشتق من تغطية البنود) */
  type: 'partial' | 'full';
  status: ReturnStatus;
  reason: string;
  notes?: string;
  staffId?: string;
  staffName?: string;
  createdBy: string;
  customerId?: number;
  customerName?: string;
  locationId?: string;
  /** النقاط المعكوسة على العميل */
  pointsReversed: number;
  /** العمولة المعكوسة على الموظف (من عمولات مرتبطة بالفاتورة) */
  commissionReversed: number;
  date: string;
  timestamp: number;
  createdAt: string;
  updatedAt: number;
  /** مفتاح السيرفر (للتوافق) */
  serverKey?: string;
  deleted?: number;
  /** رسالة رفض السيرفر إن وُجدت */
  error?: string;
}

export interface Invoice {
  /** معرّف ثابت (UUID) لا يتغيّر — أساس الهوية عند المزامنة بين الأجهزة */
  uid?: string;
  id: number;
  locationId: string;
  branchName?: string;
  customerId: number;
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  discountPercent: number;
  taxPercent: number;
  total: number;
  date: string;
  timestamp: number;
  status: 'paid' | 'pending' | 'void' | 'refunded' | 'held';
  notes?: string;
  /**
   * طريقة/طرق الدفع. القيم القديمة ('visa','split','loyalty') محفوظة للتوافق،
   * و'mixed' تعني دفعاً مختلراً ويجب وجود paymentParts.
   */
  paymentMethod: 'cash' | 'card' | 'split' | 'loyalty' | 'wallet' | 'mixed' | 'visa' | 'credit' | 'instapay';
  /** تقسيم الفاتورة على الطرق (اختياري — الفواتير القديمة بلا تقسيم) */
  paymentParts?: PaymentPart[];
  /** الجزء المخصص من الكاش لسداد الفاتورة (لا يشمل الباقي للعميل) */
  cashPaid?: number;
  /** النقد المستلم فعلياً من العميل */
  received?: number;
  /** الباقي = المستلم − الكاش المخصص */
  change?: number;
  createdBy?: string;
  staffId?: string;
  staffName?: string;
  isDining?: boolean;
  diningOption?: 'dine-in' | 'takeaway' | 'delivery';
  tableNumber?: string;
  /** عدد نقاط الولاء التي استردها العميل كخصم في هذه الفاتورة */
  pointsRedeemed?: number;
  /** هوية الطباعة وقت البيع (اختياري — الفواتير القديمة تُعاد طباعتها بالإعدادات الحية) */
  printSnapshot?: InvoicePrintIdentity;
}

export interface InventoryHistory {
  id: string;
  itemId: string;
  variantId?: string;
  type: 'sale' | 'purchase' | 'adjustment' | 'transfer' | 'refund';
  quantityChange: number;
  reason: string;
  timestamp: number;
  userId: string;
  locationId: string;
  unitPrice?: number;
  totalValue?: number;
  invoiceId?: string;
  purchaseOrderId?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: { itemId: string; variantId?: string; quantity: number; cost: number }[];
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total: number;
  date: string;
  locationId: string;
  expectedDelivery?: string;
  notes?: string;
  createdBy?: string;
  deliveredDate?: string;
  uid?: string;
  timestamp?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  paymentTerms?: string;
  isActive?: boolean;
  uid?: string;
  timestamp?: number;
}

export interface ClosingReport {
  id: string;
  locationId: string;
  date: string;
  timestamp: number;
  totalSales: number;
  totalExpenses: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes: string;
  performedBy: string;
  status: 'matched' | 'shortage' | 'surplus';
  /** مكوّنات حساب النقدية (اختيارية للتقارير القديمة) */
  cashSales?: number;
  openingBalance?: number;
  withdrawals?: number;
  deposits?: number;
  /** دفعات الموظفين النقدية لليوم (سلف/مرتب/مكافآت) المخصومة من الدرج */
  staffCashPayouts?: number;
  retainedInDrawer?: number;
  transferredToSafe?: number;
}

/** حركة يدوية على درج النقدية (سحب/إيداع) مع سبب مسجَّل */
export interface DrawerMovement {
  id: string;
  type: 'withdrawal' | 'deposit';
  amount: number;
  reason: string;
  date: string;
  timestamp: number;
  user: string;
}

export interface Reservation {
  id: string;
  customerId: number;
  customerName: string;
  date: string;
  time: string;
  notes: string;
  serviceName?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  staffId?: string;
  locationId: string;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: string;
  active: boolean;
  locationIds: string[];
  services?: string[];
  commissionType?: 'percent' | 'fixed';
  commissionValue?: number;
  nationalId?: string;
  address?: string;
  baseSalary?: number;
}

export interface Expense {
  id: string;
  locationId: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  recordedBy: string;
  /** كيف دُفعت المصروفة — 'cash' فقط يُخصم من درج النقدية (افتراضي نقدي للتوافق) */
  method?: 'cash' | 'card' | 'transfer' | 'wallet';
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  isDeleted?: boolean;
}

export interface StaffPayment {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  type: 'salary' | 'commission' | 'commission_reversal' | 'bonus' | 'advance' | 'deduction';
  method: 'cash' | 'transfer' | 'card';
  notes?: string;
  date: string;
  timestamp: number;
  createdBy: string;
  /** ربط العمولة بفاتورة حتى يمكن عكس جزئها عند المرتجع */
  invoiceUid?: string;
  /** المبلغ المعكوس من هذه الدفعة بسبب المرتجعات */
  reversedAmount?: number;
  /** uid آخر مرتجع عكس هذه الدفعة */
  reversedBy?: string;
}

export interface AppState {
  locations: Location[];
  categories: Category[];
  items: Item[];
  customers: Customer[];
  invoices: Invoice[];
  /** سجل المرتجعات (جزئية/كاملة) — مستقل عن الفواتير */
  returns: ReturnRecord[];
  heldInvoices: Invoice[];
  reservations: Reservation[];
  staff: Staff[];
  staffPayments: StaffPayment[];
  users: User[];
  auditLogs: AuditLog[];
  expenses: Expense[];
  closingReports: ClosingReport[];
  drawerMovements: DrawerMovement[];
  notes: Note[];
  suppliers: Supplier[];
  inventoryHistory: InventoryHistory[];
  purchaseOrders: PurchaseOrder[];
  customerPayments?: CustomerPayment[];
  settings: {
    firstAdminSetupDone?: boolean;
    shopName: string;
    phone: string;
    address: string;
    currentLocationId: string;
    printerName: string;
    defaultDiscountPercent: number;
    defaultTaxPercent: number;
    autoApplyDiscount: boolean;
    autoApplyTax: boolean;
    enableSound: boolean;
    enableScreenSaver: boolean;
    touchMode: boolean;
    themeColor: 'blue' | 'ocean' | 'sunset' | 'forest' | 'midnight' | 'luxury';
    loyaltyEnabled: boolean;
    loyaltyMinSpend: number;
    loyaltyPointsAward: number;
    loyaltyRedeemRate: number;
    enableBiometricLogin: boolean;
    offlineMode: boolean;
    serverUrl?: string;
    serverApiKey?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
    enableSupabaseSync?: boolean;
    /** الرصيد النقدي في الدرج عند بداية اليوم (أساس حساب الخزنة المتوقعة) */
    cashDrawerOpening?: number;
    manualOpeningDate?: string;
    /** تم بذر خدمات الصالون في هذه القاعدة (مرة واحدة، إضافة فقط دون حذف) */
    salonServicesSeeded?: boolean;
    timeFormat?: '12h' | '24h';
    autoBackupOnClosing?: boolean;
    /** تفعيل النسخ الاحتياطي التلقائي (محلي كل 6 ساعات + سحابي بالبريد 12:00 منتصف الليل) */
    autoBackupEnabled?: boolean;
    /** توقيت آخر نسخة محلية تمت */
    lastLocalBackupTime?: number;
    /** تاريخ آخر نسخة أرسلت على البريد (YYYY-MM-DD) */
    lastEmailBackupDate?: string;
    managerEmail?: string;
    emailConfig?: {
      emailTo: string;
      notifyOnInvoice?: boolean;
      notifyOnClosing?: boolean;
      notifyOnReturn?: boolean;
      notifyOnExpense?: boolean;
      smtpUser?: string;
    };
    githubRepo?: string;
    autoCheckUpdates?: boolean;
    autoUpdate?: boolean;
    githubToken?: string;
    activeTemplateId?: string;
    customReceiptTemplates?: CustomReceiptTemplate[];
    printDesign: {
      pageSize: 'A4' | 'A5' | '80mm' | '58mm';
      marginMm: number;
      primaryColor: string;
      accentColor: string;
      textColor: string;
      titleText: string;
      footerText: string;
      greetingText?: string;
      baseFontSize: number;
      logoFrontDataUrl?: string;
      logoBackDataUrl?: string;
      logoSizePx: number;
      template: 'classic' | 'professional' | 'thermal' | 'luxury' | 'modern' | 'minimal' | 'custom' | 'template1' | 'template2';
      logoFrontAlign: 'left' | 'center' | 'right';
      logoBackAlign: 'left' | 'center' | 'right';
      showBarcode: boolean;
      maxItemsPerPage?: number;
      elements?: string[];
      enableShading?: boolean;
      visibleElements?: Record<string, boolean>;
    };
  };
}

/**
 * هوية الطباعة التاريخية — تُلتقط لحظة البيع وتُخزَّن داخل الفاتورة
 * حتى يظل إيصال الفاتورة القديمة مطابقاً لتوقيع الصالون وقت البيع
 * (بدون بيانات الشعار الثنائية حتى لا تُثقّل الفاتورة — الشعار يُقرأ من الإعدادات الحية).
 */
export interface InvoicePrintIdentity {
  shopName: string;
  phone: string;
  address: string;
  template: string;
  pageSize: string;
  marginMm: number;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  titleText: string;
  footerText: string;
  greetingText?: string;
  baseFontSize: number;
  logoSizePx: number;
  logoFrontAlign: string;
  logoBackAlign: string;
  elements: string[];
  /** وقت التقاط الهوية (timestamp) */
  capturedAt: number;
}

