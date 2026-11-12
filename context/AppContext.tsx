import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, Customer, Invoice, Item, Reservation, Language, User, Staff, Expense, ClosingReport, DrawerMovement, Note, Category, Location, Supplier, InventoryHistory, PurchaseOrder, ReturnRecord, PaymentPart, StaffPayment, CustomerPayment } from '../types';
import {
  enqueueInvoice, flushQueue, buildInvoicePayload, buildCustomerPayload, pushCustomer, notifySyncStatus,
  pullInvoices, mapServerInvoice, mergePulledInvoices, newInvoiceUid,
  enqueueReturn, buildReturnPayload, flushReturnQueue, pullReturns, mergePulledReturns, newReturnUid,
  type ServerConfig, type ReturnFlushResult,
} from '../lib/serverSync';
import { validateReturn, reversedPointsFor, commissionReversalPlan } from '../lib/returns';
import { round2, PAYMENT_KINDS } from '../lib/payments';
import {
  pushInvoiceToSupabase, pushCustomerToSupabase, pushBranchToSupabase, deleteBranchFromSupabase,
  subscribeSupabaseRealtime, pullFromSupabase
} from '../lib/supabaseSync';
import { toIsoDate } from '../lib/dates';
import { buildPrintIdentity } from '../lib/printDesign';
import { idbGet, idbSet, idbRemove } from '../lib/idb';
import { makePasswordRecord, makePinRecord, verifySecret } from '../lib/crypto';
import { translateAuditLogToAr } from '../lib/auditLogAr';
import { openCashDrawerDevice } from '../lib/cashDrawer';

interface AppContextType {
  language: Language;
  toggleLanguage: () => void;
  currentUser: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  /** دخول بالرمز السريع (PIN) مع قفل مؤقت بعد 5 محاولات فاشلة */
  loginWithPin: (pin: string) => Promise<{ ok: boolean; error?: 'invalid' | 'locked' }>;
  logout: () => void;
  /** تغيير كلمة مرور المستخدم الحالي (يتحقق من الحالية أولاً) */
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  /** تعيين/مسح الرمز السريع للمستخدم الحالي (null = مسح) */
  setQuickPin: (currentPassword: string, pin: string | null) => Promise<{ ok: boolean; error?: string }>;
  state: AppState;
  // Invoices
  holdInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  restoreInvoice: (id: number) => void;
  deleteHeldInvoice: (id: number) => void;
  addInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  updateInvoice: (invoice: Invoice) => void;
  voidInvoice: (id: number) => boolean;
  // Returns (المرتجعات الجزئية/الكاملة)
  createReturn: (input: {
    invoice: Invoice;
    selections: { itemId: string; quantity: number }[];
    refundParts: PaymentPart[];
    reason: string;
    notes?: string;
  }) => { ok: boolean; error?: string; record?: ReturnRecord };
  cancelReturn: (returnUid: string) => { ok: boolean; error?: string };
  // Items & Categories
  addItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  deleteItem: (id: string) => void;
  addCategory: (category: Category) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  // Customers
  addCustomer: (customer: Omit<Customer, 'id' | 'totalSpent' | 'lastVisit' | 'loyaltyPoints' | 'tier'>) => number;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: number) => void;
  addCustomerPayment: (payment: Omit<CustomerPayment, 'id' | 'timestamp'> & { timestamp?: number }) => void;
  // Staff & Users
  addStaff: (staff: Staff) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
  // Locations
  addLocation: (location: Location) => void;
  updateLocation: (location: Location) => void;
  deleteLocation: (id: string) => void;
  // Findings & Inventory
  addExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  addClosingReport: (report: ClosingReport) => void;
  /** حركة يدوية على الدرج (سحب/إيداع بسبب مسجَّل) */
  addDrawerMovement: (movement: Omit<DrawerMovement, 'id' | 'timestamp' | 'user' | 'date'>) => void;
  deleteDrawerMovement: (id: string) => void;
  /** تسجيل حدث في سجل التدقيق */
  addAuditLog: (action: string, details: string, detailsAr?: string) => void;
  addPurchaseOrder: (po: PurchaseOrder) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  updatePurchaseOrder: (po: PurchaseOrder) => void;
  addInventoryHistory: (entry: Omit<InventoryHistory, 'id' | 'timestamp' | 'userId'>) => void;
  // Reservations
  addReservation: (reservation: Reservation) => void;
  // Notes & Misc
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  addStaffPayment: (payment: any) => void;
  deleteStaffPayment: (id: string) => void;
  resetSystem: () => void;
  restoreState: (next: AppState) => void;
  resetLoyaltyPoints: () => void;
  t: (key: string) => string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  glassNeon: boolean;
  toggleGlassNeon: () => void;
  experimentalMode: boolean;
  toggleExperimentalMode: () => void;
  updateSettings: (settings: Partial<AppState['settings']> | AppState['settings']) => void;
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info'; action?: { label: string, onClick: () => void } }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', action?: { label: string, onClick: () => void }) => void;
  removeToast: (id: string) => void;
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  settingsDirty: boolean;
  setSettingsDirty: (dirty: boolean) => void;
  saveSettingsHandlerRef: React.MutableRefObject<(() => Promise<void> | void) | null>;
  discardSettingsHandlerRef: React.MutableRefObject<(() => void) | null>;
  triggerOpenCashDrawer: (silent?: boolean) => void;
}

const translations = {
  ar: {
    // General
    welcome: 'مرحباً بك',
    dashboard: 'لوحة التحكم',
    settings: 'الإعدادات',
    logout: 'خروج',
    active: 'نشط',
    inactive: 'غير نشط',
    actions: 'إجراءات',
    total: 'الإجمالي',
    date: 'التاريخ',
    time: 'الوقت',
    status: 'الحالة',
    phone: 'رقم الهاتف',
    address: 'العنوان',
    name: 'الاسم',
    egp: 'ج.م',
    // POS Fedtures
    new_invoice: 'فاتورة جديدة',
    invoices: 'المبيعات',
    payment_method: 'طريقة الدفع',
    cash: 'نقداً',
    card: 'انستا',
    credit: 'على الحساب',
    split: 'مقسم',
    loyalty: 'نقاط الولاء',
    discount: 'الخصم',
    tax: 'الضريبة',
    subtotal: 'المجموع الفرعي',
    refund: 'إسترداد الأموال',
    // المرتجعات
    returns: 'المرتجعات',
    returns_title: 'سجل المرتجعات',
    returns_subtitle: 'مرتجع جزئي أو كامل مرتبط بفاتورة أصلية مقفلة',
    return_search: 'ابحث برقم الفاتورة أو اسم العميل...',
    return_select_invoice: 'اختر فاتورة لبدء مرتجع',
    return_no_match: 'لا توجد فاتورة مطابقة',
    return_reason: 'سبب المرتجع',
    return_reason_hint: 'مثال: عيب مصنعي / رغبة العميل',
    return_refund_to: 'رد المبلغ إلى',
    return_remaining_amount: 'المتبقي للاسترجاع',
    return_already: 'المرتجع سابقاً',
    return_qty: 'الكمية',
    return_refund_amount: 'المبلغ المسترد',
    return_execute: 'تنفيذ المرتجع',
    return_partial: 'جزئي',
    return_full: 'كامل',
    return_status_pending: 'معلّق',
    return_status_approved: 'معتمد',
    return_status_cancelled: 'ملغي',
    return_cancelled: 'تم إلغاء المرتجع وإعادة الأصناف للفاتورة بنجاح',
    return_status_rejected: 'مرفوض',
    return_rejected: 'رفض السيرفر المرتجع',
    return_wait_confirm: 'الاعتماد وصرف المبلغ يتطلبان تأكيد السيرفر',
    return_created: 'تم إنشاء المرتجع',
    return_no_returns: 'لا توجد مرتجعات بعد',
    return_restocked: 'أُعيدت الكميات للمخزون',
    return_points: 'نقاط معكوسة',
    return_commission: 'عمولة معكوسة',
    return_invoice_no: 'فاتورة رقم',
    return_receipt: 'إيصال مرتجع',
    returns_total: 'إجمالي المرتجعات',
    returns_today_total: 'إجمالي المرتجعات اليوم',
    returns_today_count: 'عدد المرتجعات اليوم',
    add_return: 'إضافة مرتجع',
    discard: 'تجاهل',
    discard_confirm_title: 'تأكيد التجاهل',
    discard_confirm_msg: 'هل أنت متأكد من تجاهل المرتجع؟ لن يتم حفظ أي بيانات.',
    keep_editing: 'العودة للتحرير',
    return_reason_required: 'السبب مطلوب',
    return_suggestions: 'اقتراحات الأسباب',
    delete_suggestion: 'حذف الاقتراح',
    delete_suggestion_confirm: 'هل تريد حذف هذا الاقتراح؟',
    sort_newest: 'الأحدث',
    sort_oldest: 'الأقدم',
    sort_lowest_count: 'أقل عدد مرتجعات',
    sort_highest_count: 'أعلى عدد مرتجعات',
    sort_lowest_price: 'أقل سعر مرتجع',
    sort_highest_price: 'أعلى سعر مرتجع',
    filter_sort: 'الترتيب',
    search_returns_log: 'بحث في سجل المرتجعات',
    return_search_hint: 'رقم / عميل / تاريخ / مبلغ / حالة / سبب',
    net_sales: 'صافي المبيعات',
    cash_refunds: 'مرتجعات نقدية (من الدرج)',
    return_error: 'تعذّر إتمام المرتجع',
    return_no_invoice: 'الفاتورة غير موجودة',
    return_no_items: 'اختر كميات للإرجاع',
    return_qty_exceeded: 'الكمية تتجاوز المتبقي بعد المرتجعات السابقة',
    return_amount_exceeded: 'المبلغ لا يطابق المتبقي للاسترجاع وقت البيع',
    return_parts_mismatch: 'مجموع أجزاء الرد لا يساوي المبلغ المسترد',
    return_cash_exceeds_paid: 'المبلغ يتجاوز ما دفعه العميل بهذه الطريقة',
    return_negative: 'قيمة غير صالحة (سالبة أو صفر)',
    all: 'الكل',
    filter_all: 'الكل',
    products: 'المنتجات',
    open_tickets: 'التذاكر المفتوحة',
    variants: 'المتغيرات',
    modifiers: 'المعدلات',
    barcode_scan: 'مسح الباركود',
    customer_display: 'عرض العميل',
    // Inventory
    inventory: 'المخزون',
    items: 'العناصر',
    categories: 'الفئات',
    stock_tracking: 'تتبع المخزون',
    low_stock: 'مخزون منخفض',
    purchase_orders: 'طلبات الشراء',
    suppliers: 'الموردين',
    add_supplier: 'إضافة مورد',
    edit_supplier: 'تعديل مورد',
    supplier_name: 'اسم المورد',
    contact: 'جهة الاتصال',
    payment_terms: 'شروط الدفع',
    last_order: 'آخر أمر شراء',
    no_suppliers: 'لا يوجد موردون',
    add_order: 'إضافة أمر',
    order_status: 'حالة الأمر',
    draft: 'مسودة',
    ordered: 'مرسل',
    received: 'مستلم',
    expected_delivery: 'التسليم المتوقع',
    mark_received: 'تأكيد الاستلام',
    order_items: 'بنود الأمر',
    unit_price: 'سعر الوحدة',
    total_amount: 'الإجمالي',
    no_orders: 'لا توجد أوامر',
    select_supplier: 'اختر المورد',
    select_item: 'اختر الصنف',
    order_details: 'تفاصيل الأمر',
    purchase: 'شراء',
    sale: 'بيع',
    adjustment: 'تسوية',
    total_value: 'القيمة الإجمالية',
    stock_trend: 'اتجاه المخزون',
    no_history: 'لا توجد حركات',
    total_inbound: 'إجمالي الوارد',
    total_outbound: 'إجمالي الصادر',
    net_movement: 'صافي الحركة',
    all_items: 'كل الأصناف',
    email: 'البريد الإلكتروني',
    item: 'الصنف',
    supplier: 'المورد',
    view: 'عرض',
    stock_adjustments: 'تسويات المخزون',
    transfer_orders: 'طلبات التحويل',
    inventory_history: 'تاريخ المخزون',
    valuation_report: 'تقرير التقييم',
    csv_import: 'استيراد CSV',
    // Employees
    staff: 'الموظفين',
    users: 'المستخدمين',
    permissions: 'الصلاحيات',
    time_clock: 'تسجيل الوقت',
    sales_by_staff: 'المبيعات حسب الموظف',
    // Customers
    customers: 'العملاء',
    loyalty_program: 'برنامج الولاء',
    loyalty_rule_desc: 'كل 20 جنيه = 1 نقطة. استبدل نقاطك بخصومات مميزة!',
    points_earned: 'النقاط المكتسبة: +',
    points: 'نقاط',
    purchase_history: 'تاريخ الشراء',
    loyalty_cards: 'بطاقات الولاء',
    // Analytics
    analytics: 'التحليلات والتقارير',
    sales_trends: 'اتجاه المبيعات',
    popular_items: 'الأكثر شعبية',
    tax_report: 'تقرير الضريبة',
    export_reports: 'تصدير التقارير',
    shifts: 'المناوبات',
    // Multi-location
    locations: 'المواقع والفروع',
    all_locations: 'جميع المواقع',
    switch_location: 'تبديل الموقع',
    // Restaurant
    kitchen_printer: 'طابعة المطبخ',
    kds: 'عرض المطبخ',
    dining_options: 'خيارات التناول',
    dine_in: 'في المحل',
    takeaway: 'سفري',
    delivery: 'توصيل',
    tables: 'الطاولات',
    // Hardware & System
    hardware: 'المعدات',
    printers: 'الطابعات',
    scanners: 'الماسحات',
    offline_mode: 'العمل بدون إنترنت',
    dark_mode: 'المظهر الداكن',
    light_mode: 'المظهر الفاتح',
    experimental: 'تجريبي',
    // Intro Screen
    intro_loading: 'جاري التحميل',
    intro_checking: 'جاري الفحص',
    intro_ready: 'جاهز',
    intro_system: 'النظام',
    intro_tagline_1: 'منصة إدارة متكاملة للمحترفين',
    intro_tagline_2: 'تحكم كامل على مبيعاتك وعملائك وعملياتك',
    intro_tagline_3: 'تجربة احترافية مع واجهة ملونة وسهلة',
    secure_protected: 'بيئة آمنة • محمي',
    // Login Screen
    login_title: 'تسجيل الدخول للنظام',
    login_btn: 'تسجيل الدخول',
    login_error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    remember_me: 'تذكرني',
    forgot_password: 'نسيت كلمة المرور؟',
    quick_pin: 'رمز سريع',
    developed_by: 'برمجة وتصميم: م/ عبد الرحمن فتحي العادلي • ت/ 01026695879',
    no_saved_user_biometric: 'لا يوجد مستخدم محفوظ للدخول الحيوي. يرجى تسجيل الدخول يدوياً أولاً.',
    contact_admin_reset_pwd: 'يرجى التواصل مع إبراهيم نوّار لإعادة ضبط كلمة المرور',
    // Dashboard & Stats
    total_revenue: 'إجمالي الإيرادات',
    todays_reservations: 'حجوزات اليوم',
    total_invoices_count: 'إجمالي الفواتير',
    low_stock_alert: 'تنبيه المخزون المنخفض',
    top_staff: 'أفضل موظف',
    top_staff_today: 'أفضل موظف اليوم',
    no_data: 'لا توجد بيانات',
    expenses_month: 'مصروفات الشهر',
    last_closing: 'آخر إغلاق',
    last_closings: 'آخر التقفيلات',
    view_more: 'عرض المزيد',
    no_reports: 'لا توجد تقارير',
    sales: 'المبيعات',
    recent_invoices: 'الفواتير الأخيرة',
    quick_access: 'الوصول السريع',
    closing_report: 'تاريخ الإغلاقات',
    expected_cash: 'الخزنة المتوقعة',
    actual_cash: 'الخزنة الفعلية',
    difference: 'الفرق',
    recorded_by: 'مسجل بواسطة',
    matched: 'متطابق',
    shortage: 'عجز',
    surplus: 'زيادة',
    day: 'يوم',
    week: 'أسبوع',
    month: 'شهر',
    year: 'سنة',
    top: 'الأفضل',
    // Invoices & Billing
    item_added: 'تمت إضافة العنصر',
    customer_name: 'اسم العميل',
    real_name: 'الاسم الفعلي',
    held: 'معلق',
    customer_id: 'كود العميل',
    last_visit: 'آخر زيارة',
    billing: 'الفوترة',
    discount_percent: 'نسبة الخصم %',
    tax_percent: 'نسبة الضريبة %',
    select_barber: 'اختر الموظف / مقدم الخدمة',
    notes: 'ملاحظات',
    invoice: 'فاتورة',
    clear: 'مسح الكل',
    no_items: 'لا توجد عناصر',
    select_payment_method: 'اختر طريقة الدفع',
    confirm: 'تأكيد',
    restore: 'استرجاع',
    add_service: 'إضافة خدمة سريعة',
    name_ar: 'الاسم بالعربية',
    name_en: 'الاسم بالإنجليزية',
    price: 'السعر',
    search_placeholder: 'بحث...',
    filter: 'تصفية',
    created_by: 'أنشئ بواسطة',
    save_print: 'طباعة / حفظ PDF',
    add_items_first: 'يرجى إضافة عناصر أولاً',
    // Loyalty & Points
    available_points: 'النقاط المتاحة',
    points_per_egp: 'نقاط لكل جنيه',
    min_points: 'أقل عدد نقاط',
    enter_points_redeem: 'أدخل عدد النقاط للاسترداد',
    loyalty_min_points_error: 'الحد الأدنى 50 نقطة للاسترداد',
    loyalty_insufficient_points: 'النقاط غير كافية',
    points_redeemed_success: 'تم استرداد النقاط بنجاح',
    redeem_points_btn: 'استرداد النقاط',
    // Audit & Users
    audit_logs: 'سجلات النظام',
    new_user: 'مستخدم جديد',
    role: 'الصلاحية',
    role_admin: 'مدير النظام',
    role_cashier: 'كاشير',
    role_manager: 'مدير',
    role_waiter: 'نادل',
    confirm_delete: 'هل أنت متأكد من الحذف؟',
    invalid_phone_format: 'رقم الهاتف يجب أن يبدأ بـ 01 ويتكون من 11 رقماً',
    invalid_name_format: 'الاسم يجب أن يكون 3 أجزاء على الأقل',
    // Print Design Settings
    logo_front_align: 'محاذاة شعار الوجه الأمامي',
    logo_back_align: 'محاذاة شعار الوجه الخلفي',
    left: 'يسار',
    center: 'وسط',
    right: 'يمين',
    quantity: 'الكمية',
    all_categories: 'كل الفئات',
    service: 'خدمة',
    product: 'منتج',
    // Tiers & Loyalty
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني',
    diamond: 'دايموند',
    held_invoices: 'الفواتير المعلقة',
    confirm_closing: 'هل أنت متأكد من إجراء الإغلاق الآن؟',
    confirm_delete_note: 'هل أنت متأكد من حذف هذه الملاحظة؟',
    confirm_delete_expense: 'هل أنت متأكد من حذف هذا المصروف؟',
    confirm_reset: 'هل أنت متأكد من إعادة ضبط النظام؟ سيتم حذف جميع البيانات.',
    confirm_system_reset: 'هل أنت متأكد من تصفير النظام بالكامل؟ سيتم فقدان كل البيانات.',
    confirm_reset_loyalty: 'هل أنت متأكد من تصفير جميع نقاط الولاء؟',
    search: 'بحث',
    delete: 'حذف',
    edit: 'تعديل',
    add: 'إضافة',
    save: 'حفظ',
    cancel: 'إلغاء',
    close: 'إغلاق',
    create: 'إنشاء',
    update: 'تحديث',
    remove: 'إزالة',
    back: 'رجوع',
    next: 'التالي',
    apply: 'تطبيق',
    reset: 'إعادة ضبط',
    export_pdf: 'تصدير PDF',
    hold_invoice: 'تعليق الفاتورة',
    no_items_to_hold: 'لا توجد عناصر للتعليق',
    fill_all_fields: 'يرجى ملء جميع الحقول المطلوبة',
    table_not_found: 'لم يتم العثور على الجدول',
    enter_actual_cash: 'يرجى إدخال مبلغ الخزنة الفعلية',
    fill_required_fields: 'يرجى ملء الحقول المطلوبة',
    invoice_restored: 'تمت استعادة الفاتورة',
    expense_restored: 'تمت استعادة المصروف',
    expense_added: 'تمت إضافة المصروف بنجاح',
    expense_deleted: 'تم حذف المصروف بنجاح',
    backup_created: 'تم إنشاء النسخة الاحتياطية بنجاح',
    backup_data: 'نسخ احتياطي للبيانات',
    backup_to_server: 'رفع نسخة للسيرفر',
    restore_from_server: 'استعادة من السيرفر',
    confirm_restore_server: 'سيتم استبدال كل البيانات الحالية بآخر نسخة احتياطية محفوظة على السيرفر. هل أنت متأكد؟',
    restore_done: 'تمت استعادة البيانات بنجاح',
    restore_defaults: 'استعادة الإعدادات الافتراضية',
    reset_loyalty_btn: 'تصفير نقاط الولاء',
    settings_saved: 'تم حفظ الإعدادات بنجاح',
    unknown: 'غير معروف',
    guest: 'زائر',
    system: 'النظام',
    invalid_format: 'تنسيق غير صالح',
    // Sidebar / Settings ldbels (كانت ناقصة => تظهر فارغة في القائمة)
    clients: 'العملاء',
    debts: 'الديون والآجل',
    debts_management: 'إدارة الديون والعملاء الآجل',
    instapay: 'إنستا باي',
    commission_type: 'نوع النسبة',
    commission_value: 'قيمة النسبة / المبلغ',
    commission_percent: 'نسبة مئوية (%) من الخدمات',
    commission_fixed: 'مبلغ ثابت (ج.م) على كل عميل',
    national_id: 'الرقم القومي',
    debt_collected: 'تم تسجيل تحصيل المديونية بنجاح',
    expenses: 'المصروفات',
    reservations: 'الحجوزات',
    general: 'عام',
    shop_name: 'اسم النشاط',
    print_settings: 'إعدادات الطباعة',
    auto_apply_tax: 'تطبيق الضريبة تلقائياً',
    default_tax_percent: 'الضريبة الافتراضية %',
    auto_apply_discount: 'تطبيق الخصم تلقائياً',
    default_discount_percent: 'الخصم الافتراضي %',
    category: 'الفئة',
    loyalty_points: 'نقاط الولاء',
    loyalty_min_spend: 'أقل إنفاق لكسب نقاط',
    loyalty_points_award: 'نقاط مقابل الوحدة المنفق عليها',
    loyalty_redeem_rate: 'قيمة نقطة الولاء',
    loyalty_settings: 'برنامج الولاء',
    tier: 'المستوى',
    // مجموعات القائمة الجانبية
    nav_group_overview: 'الرئيسية',
    nav_group_daily: 'العمليات اليومية',
    nav_group_inventory: 'المخزون والموظفون',
    nav_group_system: 'النظام',
    // Filter Modals & Tables
    filter_search: 'تصفية وبحث',
    clear_filters: 'مسح الفلاتر',
    apply_filters: 'تطبيق الفلاتر',
    search_customer: 'بحث بالاسم أو الهاتف...',
    date_range: 'فترة التاريخ',
    start_date: 'بداية',
    end_date: 'نهاية',
    all_staff: 'كل الموظفين',
    all_tiers: 'كل المستويات',
    // Control Panel Titles
    control_panel: 'لوحة التحكم',
    active_customers: 'العملاء النشطون',
    occupancy_rate: 'نسبة الإشغال',
    employee_of_month: 'موظف الشهر',
    revenue_by_service: 'الإيرادات حسب الخدمة',
    staff_performance: 'أداء الموظفين',
    rating: 'التقييم',
    recent_reservations: 'الحجوزات الأخيرة',
    view_all: 'عرض الكل',
    payroll: 'الرواتب والمدفوعات',
    reports: 'التقارير',
    /* --- التحليلات والتقارير: الأقسام والفلاتر --- */
    section_analytics: 'التحليلات',
    welcome_user: 'مرحباً يا',
    period_today: 'اليوم',
    period_yesterday: 'أمس',
    period_this_week: 'هذا الأسبوع',
    period_last_week: 'الأسبوع السابق',
    period_this_month: 'هذا الشهر',
    period_last_month: 'الشهر السابق',
    period_this_year: 'هذا العام',
    period_custom: 'فترة مخصصة',
    from_date: 'من تاريخ',
    to_date: 'إلى تاريخ',
    /* --- التحليلات --- */
    invoice_count: 'عدد الفواتير',
    customer_count: 'عدد العملاء',
    visit_count: 'عدد الزيارات',
    visits: 'الزيارات',
    net_profit: 'صافي الأرباح',
    net_revenue: 'صافي الإيرادات',
    avg_invoice: 'متوسط قيمة الفاتورة',
    top_services: 'الخدمات الأكثر طلباً',
    bottom_services: 'الخدمات الأقل طلباً',
    staff_revenue: 'إيرادات الحلاقين',
    staff_services_count: 'عدد الخدمات لكل حلاق',
    revenue_by_day: 'الإيرادات اليومية',
    revenue_by_week: 'الإيرادات الأسبوعية',
    revenue_by_month: 'الإيرادات الشهرية',
    revenue_by_year: 'الإيرادات السنوية',
    revenue_by_hour: 'الإيرادات حسب الساعة',
    period_performance: 'أداء الفترات',
    expenses_by_category: 'المصروفات حسب النوع',
    staff_costs: 'أجور وعمولات الموظفين',
    discounts_given: 'الخصومات الممنوحة',
    payment_breakdown: 'توزيع طرق الدفع',
    top_customers: 'العملاء الأكثر إنفاقاً',
    /* --- التقارير (16 تقرير) --- */
    report_sales: 'تقرير المبيعات',
    report_invoices: 'تقرير الفواتير التفصيلي',
    report_services: 'تقرير الخدمات المباعة',
    report_customers: 'تقرير العملاء',
    report_staff: 'تقرير أداء الحلاقين',
    report_staff_revenue: 'تقرير إيرادات كل حلاق',
    report_top_services: 'تقرير الخدمات الأكثر طلباً',
    report_bottom_services: 'تقرير الخدمات الأقل طلباً',
    report_discounts: 'تقرير الخصومات',
    report_returns: 'تقرير المرتجعات والإلغاءات',
    report_expenses: 'تقرير المصروفات',
    report_net_profit: 'تقرير صافي الأرباح',
    report_payments: 'تقرير طرق الدفع',
    report_reservations: 'تقرير الحجوزات والمواعيد',
    report_top_customers: 'تقرير العملاء الأكثر زيارة',
    report_revenue_periods: 'تقرير الإيرادات (يوم/أسبوع/شهر)',
    /* --- عمليات التقارير --- */
    preview: 'معاينة وطباعة',
    select_staff: 'اختر الموظف',
    select_service: 'اختر خدمة',
    select_customer: 'اختر عميلاً',
    invoice_status: 'حالة الفاتورة',
    all_statuses: 'كل الحالات',
    report_filter_hint: 'الفلاتر الحالية تنطبق على المعاينة والطباعة معاً',
    pdf_hint: 'في نافذة الطباعة اختر "حفظ كـ PDF" للتصدير',
    report_rows: 'عدد السطور',
    items_count: 'عدد البنود',
    total_advances: 'إجمالي السلف',
    salary_paid: 'المرتب المدفوع',
    salary: 'مرتب',
    commission: 'عمولة',
    commission_reversal: 'عكس عمولة',
    bonus: 'مكافأة',
    advance: 'سلفة',
    transfer: 'تحويل',
    recent_payments: 'المدفوعات الأخيرة',
    custody: 'أدوات الحضانة',
    add_tool: 'إضافة أداة للحضانة',
    tool_name: 'اسم الأداة',
    condition: 'الحالة',
    condition_new: 'جديدة',
    condition_used: 'مستخدمة',
    condition_damaged: 'تالفة',
    all_reservations: 'كل الحجوزات',
    all_invoices: 'كل الفواتير',
    payroll_reports: 'تقارير الرواتب',
    check_in: 'حضور',
    check_out: 'انصراف',
    profile: 'الملف الشخصي',
    auto_numbering: 'ترقيم تلقائي',
    select_note_start: 'اختر ملاحظة لبدء التعديل',
    color: 'اللون',
    appearance: 'المظهر',
    theme_color: 'لون الثيم',
    touch_mode: 'وضع اللمس (واجهة أكبر)',
    data_management: 'إدارة البيانات',
    edit_item: 'تعديل عنصر',
    add_item: 'إضافة عنصر',
    select_category: 'اختر الفئة',
    track_stock: 'تتبع المخزون',
    alert_threshold: 'حد التنبيه',
    // Notes Editor
    search_notes: 'بحث في الملاحظات',
    note_title: 'عنوان الملاحظة',
    bold: 'عريض',
    italic: 'مائل',
    underline: 'تسطير',
    align_left: 'محاذاة لليسار',
    align_center: 'محاذاة للوسط',
    align_right: 'محاذاة لليمين',
    text_color: 'لون النص',
    insert_image: 'إدراج صورة',
    print_note: 'طباعة الملاحظة',
    export_doc: 'تصدير DOC',
    export_txt: 'تصدير TXT',
    // Placeholders
    ph_invoice_id: 'الكود',
    ph_phone: '01xxxxxxxxx',
    ph_invoice_notes: 'أضف ملاحظات للفاتورة هنا...',
    ph_closing_notes: 'أضف أي ملاحظات حول الفروقات هنا...',
    ph_amount: '0.00',
    ph_license_key: 'XXXX-XXXX-XXXX-XXXX',
    ph_username_login: 'admin',
    ph_password_login: '••••••',
    ph_expense_name: 'مثال: إيجار، فواتير',
    ph_service_ar: 'مثال: قص شعر',
    ph_service_en: 'Example: Haircut',
    // Online status
    online: 'متصل',
    offline: 'غير متصل',
    shortcuts: 'اختصارات لوحة المفاتيح',
    // Total Spent / Transactions
    total_spent: 'إجمالي الإنفاق',
    transaction_history: 'سجل المعاملات',
    // UI Labels
    no_closing_reports: 'لا توجد تقارير إغلاق',
    no_held_invoices: 'لا توجد فواتير معلقة',
    select_barber_alert: 'يرجى اختيار الحلاق',
    cannot_redeem_less_50: 'لا يمكن استرداد أقل من 50 نقطة',
    payment_added: 'تمت إضافة الدفعة بنجاح',
    action_successful: 'تم بنجاح',
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    paid: 'مدفوع',
    void: 'ملغى نهائياً',
    refunded: 'مسترد',
    reservations_list: 'قائمة الحجوزات',
    new_reservation: 'حجز جديد',
    invoice_no: 'رقم الفاتورة',
    services: 'الخدمات',
    type: 'النوع',
    method: 'طريقة الدفع',
    amount: 'المبلغ',
    add_payment: 'إضافة دفعة',
    draw_advance: 'سحب سلفة',
    advance_drawn: 'تم تسجيل السلفة بنجاح',
    staff_payouts: 'دفعات الموظفين النقدية',
    customer_added: 'تم حفظ العميل تلقائياً',
    thermal_80: 'حراري 80mm',
    thermal_58: 'حراري 58mm',
    total_payments: 'إجمالي المدفوعات',
    print_report: 'طباعة التقرير',
    staff_management: 'إدارة الموظفين',
    active_staff: 'الموظفون النشطون',
    add_staff: 'إضافة موظف',
    edit_staff: 'تعديل بيانات موظف',
    total_staff: 'إجمالي الموظفين',
    today_reservations: 'حجوزات اليوم',
    receptionist: 'موظف الاستقبال',
    manager: 'مدير',
    barber: 'حلاق',
    total_sales: 'إجمالي المبيعات',
    total_expenses: 'إجمالي المصاريف',
    print: 'طباعة',
    logout_system: 'تسجيل الخروج',
    closing: 'الإقفال',
    closing_done: 'تم إقفال الدرج',
    // درج النقدية والإغلاق اليومي
    opening_balance: 'الرصيد الافتتاحي',
    opening_balance_hint: 'مبلغ النقد الموجود في الدرج قبل بداية مبيعات اليوم',
    cash_sales: 'مبيعات نقدية',
    withdrawal: 'سحب',
    deposit: 'إيداع',
    reason: 'السبب',
    reason_placeholder: 'مثال: تحويل للبنك / مصروفات تشغيل',
    movement_type: 'نوع الحركة',
    add_movement: 'تسجيل',
    today_movements: 'حركات الدرج اليوم',
    movement_hint: 'كل سحب أو إيداع يُسجَّل بسبب واضح ويُخصم/يُضاف من الخزنة المتوقعة',
    amount_required: 'أدخل مبلغاً أكبر من صفر',
    reason_required: 'اكتب سبب الحركة',
    already_closed_today: 'تم إغلاق الدرج لهذا اليوم مسبقاً — تسجيل إغلاق جديد سيُضاف للسجل',
    already_closed_confirm: 'تم إغلاق الدرج لهذا اليوم مسبقاً. هل تريد تسجيل إغلاق جديد؟',
    all_actions: 'كل الإجراءات',
    leave_blank_to_keep: 'اتركه فارغاً للإبقاء على كلمة المرور',
    username_exists: 'اسم المستخدم موجود مسبقاً',
    required_fields: 'املأ الحقول المطلوبة',
    password_required: 'كلمة المرور مطلوبة',
    reset_password: 'إعادة تعيين كلمة المرور',
    enter_new_password: 'أدخل كلمة المرور الجديدة',
    password_changed: 'تم تغيير كلمة المرور بنجاح',
    password_short: 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)',
    security_section: 'الأمان والحماية',
    change_password: 'تغيير كلمة المرور',
    current_password: 'كلمة المرور الحالية',
    new_password: 'كلمة المرور الجديدة',
    confirm_password: 'تأكيد كلمة المرور',
    quick_pin_new: 'رمز سريع جديد (4-6 أرقام)',
    quick_pin_active: 'رمز سريع مُفعّل لهذا المستخدم',
    quick_pin_none: 'لا يوجد رمز سريع',
    clear_quick_pin: 'مسح الرمز السريع',
    pin_invalid: 'الرمز يجب أن يكون من 4 إلى 6 أرقام',
    pin_locked: 'محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة',
    biometric_unavailable: 'الدخول بالبصمة غير مفعّل — استخدم كلمة المرور',
    pin_not_set: 'لا يوجد رمز سريع لأي مستخدم — عيّنه من الإعدادات بعد الدخول',
    wrong_password: 'كلمة المرور الحالية غير صحيحة',
    password_changed_ok: 'تم تحديث كلمة المرور',
    pin_saved: 'تم حفظ الرمز السريع',
    pin_cleared: 'تم مسح الرمز السريع',
    force_password_title: 'يجب تغيير كلمة المرور الافتراضية',
    force_password_hint: 'حساب admin ما زال يستخدم كلمة مرور افتراضية معروفة. عيّن كلمة مرور قوية للمتابعة.',
    machine_id: 'معرّف الجهاز',
    license_machine_hint: 'أرسل هذا المعرّف إلى المطوّر للحصول على مفتاح ترخيص خاص بهذا الجهاز.',
    license_expired: 'انتهت صلاحية الترخيص',
    license_wrong_machine: 'هذا الترخيص غير مرتبط بهذا الجهاز',
    storage_full: 'تعذّر حفظ البيانات: مساحة التخزين ممتلئة',
    storage_trimmed: 'تم تقليم السجلات القديمة لتوفير مساحة',
    cannot_change_self: 'لا يمكنك تعطيل حسابك الحالي أو تغيير آخر مدير نشط',
    cannot_delete_last_admin: 'لا يمكن حذف آخر مدير نشط أو حسابك الحالي',
    enable_user: 'تفعيل المستخدم',
    disable_user: 'تعطيل المستخدم',
    // الدفع المختلط (كاش / بطاقة / محفظة)
    payment_details: 'تفاصيل الدفع',
    payment_remaining: 'المتبقي على الإجمالي',
    paid_total: 'إجمالي المسدد',
    change_due: 'الباقي للعميل',
    cash_received: 'المستلم نقداً',
    cash_for_invoice: 'الكاش المخصص للفاتورة',
    drawer_increase: 'زيادة الدرج',
    exact_amount: 'بالضبط',
    all_on_method: 'الباقي هنا',
    mixed: 'مختلط',
    wallet: 'محفظة',
    visa: 'فيزا',
    payment_no_parts: 'أدخل مبلغاً مدفوعاً على الأقل',
    payment_sum_mismatch: 'مجموع أجزاء السداد لا يساوي إجمالي الفاتورة',
    payment_received_short: 'المستلم نقداً أقل من الجزء الكاش المخصص',
    payment_negative: 'المبالغ يجب أن تكون صفر أو أكبر',
    paid_by: 'دفع بواسطة',
    from_drawer: 'من الدرج',
    expense_method_hint: 'النقدية فقط تُخصم من درج النقدية عند الإغلاق — البطاقة والتحويل لا',
    cash_expenses_today: 'مصروفات نقدية اليوم (من الدرج)',
    non_cash: 'غير نقدي',
    today_revenue: 'إيرادات اليوم',
    drawer_closing: 'إقفال الدرج',
    close_drawer: 'إغلاق الدرج',
    new_note: 'ملاحظة جديدة',
    page: 'صفحة',
    of: 'من',
    general_shortcuts: 'عام',
    invoice_shortcuts: 'الفاتورة',
    global_search: 'البحث الشامل',
    show_shortcuts: 'إظهار الاختصارات',
    print_invoice: 'طباعة الفاتورة',
    save_print_short: 'حفظ وطباعة',
    new_invoice_shortcut: 'فاتورة جديدة',
    cancel_shortcut: 'إلغاء',
    system_activation: 'تفعيل النظام',
    product_key: 'مفتاح المنتج',
    invalid_license: 'مفتاح ترخيص غير صالح',
    electron_env_required: 'بيئة إلكترون غير متاحة. استخدم DEV-KEY للتجربة',
    activation_failed: 'فشل التفعيل. تواصل مع الدعم الفني',
    activate_system: 'تفعيل النظام',
    activation_welcome: 'مرحباً بك في ProCashier. يرجى إدخال مفتاح المنتج لتفعيل الجهاز.',
    secure_license: 'محمي بمحرك الترخيص الآمن',
    touch_resume: 'المس الشاشة للاستئناف',
    offline_status: 'غير متصل',
    management_suffix: 'إدارة',
    expense_description: 'وصف المصروف',
    add_expense: 'إضافة مصروف',
    expense_title: 'عنوان المصروف',
    expense_category: 'تصنيف المصروف',
    expense_amount: 'قيمة المصروف',
    sold_today: 'مبيعات اليوم',
    copyright_footer: 'جميع الحقوق محفوظة - المبرمج عبد الرحمن فتحي العادلي - ت. 01026695879',
    brand_header_text: 'RaiZon Pro',
    invoice_footer_greeting: 'نورت الصالون.. شرفتونا!',
    invoice_print_title: 'فاتورة',
    time_label: 'الوقت',
    date_label: 'التاريخ',
    customer_label: 'العميل',
    phone_label: 'الهاتف',
    cashier_label: 'الكاشير',
    branch_label: 'الفرع',
    items_table_header: 'الصنف',
    qty_table_header: 'الكمية',
    price_table_header: 'السعر',
    total_table_header: 'الإجمالي',
    subtotal_label: 'المجموع الفرعي',
    discount_label: 'الخصم',
    tax_label: 'الضريبة',
    total_label: 'الإجمالي',
    thank_you_label: 'شكراً لاختياركم',
    invoices_list_title: 'قائمة الفواتير',
    any_option: 'الكل',
    details_header: 'التفاصيل',
    action_header: 'الإجراء',
    user_header: 'المستخدم',
    unknown_staff: 'غير معروف',
    undo_action: 'تراجع',
    edit_product: 'تعديل المنتج',
    add_product: 'إضافة منتج',
    admin: 'مدير النظام',
    cashier: 'كاشير',
    waiter: 'نادل',
    login: 'تسجيل الدخول',
    drawer: 'الدرج',
    customer: 'العميل',
    user: 'المستخدم',
    expense: 'المصروف',
    wa_einvoice_title: 'فاتورة إلكترونية',
    wa_welcome: 'أهلاً بك',
    wa_visit_thanks: 'سعدنا بزيارتك. إليك تفاصيل فاتورتك:',
    wa_invoice_details: 'بيانات الفاتورة',
    wa_prev_points: 'رصيد النقاط السابق',
    wa_earned_points: 'نقاط مكتسبة الآن',
    wa_total_points: 'المجموع الكلي للنقاط',
    wa_points_unit: 'نقطة',
    wa_services_details: 'تفاصيل الخدمات',
    wa_final_total: 'المجموع النهائي',
    wa_thanks_trust: 'شكراً لثقتكم في',
    wa_contact_booking: 'للحجز والاستفسار',
    am: 'ص',
    pm: 'م',
    server_sync: 'ربط السيرفر المركزي',
    server_sync_hint: 'إرسال الفواتير تلقائياً للسيرفر (تخزين + إيميل إشعار لصاحب المشروع)',
    server_url: 'رابط السيرفر',
    server_api_key: 'مفتاح API',
    test_connection: 'اختبار الاتصال',
    server_connected: 'متصل بالسيرفر',
    server_failed: 'فشل الاتصال بالسيرفر',
    pending_sync: 'فواتير بانتظار المزامنة',
  sync_retry: 'إعادة المحاولة',
  last_sync_at: 'آخر مزامنة ناجحة',
    ph_server_url: 'http://192.168.1.10:8087',
    server_suggested_urls: 'روابط مقترحة لتطبيق الهاتف على نفس الشبكة',
    server_phone_hint: 'انقر الرابط لنسخه ثم الصقه في تطبيق الهاتف (الإعدادات > رابط السيرفر)',
    server_qr_title: 'رمز QR للهاتف',
    server_qr_hint: 'امسح الرمز من تطبيق الهاتف لتعبئة رابط السيرفر ومفتاح تلقائياً',
    copy: 'نسخ',
    copied: 'تم النسخ',
    sync_now: 'مزامنة الآن',
    sync_done: 'لا توجد فواتير بانتظار المزامنة',
    // تخصيص الطباعة والهوية
    print_branding: 'تخصيص الطباعة',
    identity_section: 'هوية الصالون في الإيصال',
    identity_hint: 'تظهر هذه البيانات في ترويسة إيصال الفاتورة',
    logo_section: 'الشعار',
    logo_hint: 'يُحفظ الشعار في مخزن الأصول ويُطبع في أعلى/أسفل الإيصال (PNG/JPG/WEBP حتى 1.5MB)',
    logo_front: 'شعار أمامي',
    logo_back: 'شعار خلفي',
    no_logo: 'بدون شعار',
    remove_logo: 'إزالة الشعار',
    logo_saved: 'تم حفظ الشعار في مخزن الأصول',
    logo_removed: 'تم حذف الشعار من مخزن الأصول',
    logo_invalid_type: 'نوع الملف غير مدعوم — استخدم PNG أو JPG أو WEBP',
    logo_too_big: 'حجم الشعار أكبر من 1.5MB',
    logo_invalid: 'ملف شعار غير صالح',
    logo_size: 'حجم الشعار',
    template_section: 'القالب والمقاس',
    template_hint: '3 قوالب جاهزة × 4 مقاسات ورق — اختر قالباً ثم عدّل بحرية',
    template_applied: 'تم تطبيق القالب',
    template_classic: 'كلاسيك',
    template_professional: 'احترافي',
    template_thermal: 'حراري',
    template_classic_desc: 'A4 بهوامش واسعة وألوان فاتحة',
    template_professional_desc: 'A4 بتخطيط رشيق وألوان رسمية',
    template_thermal_desc: 'بون حراري 80/58 مم للكاشير بتنسيق شبكي قياسي (أبيض وأسود)',
    template_luxury: 'الملكي الفاخر',
    template_luxury_desc: 'إطار خارجي مزدوج مع فواصل زخرفية ملكية (أبيض وأسود)',
    template_modern: 'العصري الأنيق',
    template_modern_desc: 'حواف ناعمة وتخطيط حديث عالي التباين (أبيض وأسود)',
    template_minimal: 'التبسيطي الراقي',
    template_minimal_desc: 'فواصل منقطة أنيقة وموفرة لورق البكرات (أبيض وأسود)',
    template_custom: 'المصمم الذكي المخصص',
    template_custom_desc: 'تخصيص كامل للأبعاد والخطوط وهوامش الطباعة',
    greeting_text: 'رسالة الوداع والترحيب (أسفل الفاتورة)',
    time_format: 'نظام عرض الوقت',
    time_format_12h: '12 ساعة (02:47PM)',
    time_format_24h: '24 ساعة (14:47)',
    average_invoice: 'متوسط الفاتورة',
    peak_hour: 'ساعة الذروة',
    ph_greeting_text: 'نورتوا الصالون.. شرفتونا وننتظر زيارتكم القادمة!',
    paper_size: 'مقاس الورق',
    paper_a4: 'A4 (210×297 مم)',
    paper_a5: 'A5 (148×210 مم)',
    paper_80mm: 'بون 80 مم',
    paper_58mm: 'بون 58 مم',
    margin_mm: 'الهامش',
    font_size: 'حجم الخط',
    style_section: 'الألوان والنصوص',
    primary_color: 'اللون الأساسي',
    accent_color: 'لون التمييز',
    title_text: 'عنوان الإيصال',
    footer_text: 'نص أسفل الإيصال',
    items_per_page: 'عناصر لكل صفحة',
    fields_section: 'الحقول الظاهرة',
    element_header: 'الترويسة (الشعار/الاسم)',
    element_info: 'بيانات الفاتورة',
    element_items: 'العناصر',
    element_notes: 'الملاحظات والنقاط',
    element_totals: 'الإجماليات والدفع',
    element_footer: 'التذييل',
    printer_section: 'الطابعة',
    printer_hint: 'اختر طابعة النظام أو اكتب اسمها — تُستخدم عند زر الطباعة',
    select_printer: 'اختر الطابعة',
    printer_default: 'الافتراضية',
    printer_unavailable: 'تعذر جلب قائمة الطابعات — اكتب اسم الطابعة يدوياً',
    preview_section: 'معاينة تجريبية',
    preview_hint: 'معاينة حية للفاتورة بالإعدادات الحالية — لا تُطبع مع الطباعة',
    save_pdf: 'حفظ PDF',
    pdf_saved: 'تم حفظ ملف PDF',
    pdf_failed: 'تعذر إنشاء ملف PDF',
    print_failed: 'تعذرت الطباعة',
    reprint_title: 'معاينة وطباعة الفاتورة',
    reprint_denied: 'ليست لديك صلاحية إعادة طباعة الفواتير',
  },
  en: {
    // General
    welcome: 'Welcome',
    dashboard: 'Dashboard',
    settings: 'Settings',
    logout: 'Logout',
    active: 'Active',
    inactive: 'Inactive',
    actions: 'Actions',
    total: 'Total',
    date: 'Date',
    time: 'Time',
    status: 'Status',
    phone: 'Phone',
    address: 'Address',
    name: 'Name',
    egp: 'EGP',
    // POS Fedtures
    new_invoice: 'New Invoice',
    invoices: 'Sales',
    payment_method: 'Payment Method',
    cash: 'Cash',
    card: 'InstaPay',
    credit: 'On Account / Credit',
    split: 'Split',
    loyalty: 'Loyalty Points',
    discount: 'Discount',
    tax: 'Tax',
    subtotal: 'Subtotal',
    refund: 'Refund',
    // Returns
    returns: 'Returns',
    returns_title: 'Returns Log',
    returns_subtitle: 'Partial or full return linked to a locked original invoice',
    return_search: 'Search by invoice number or customer...',
    return_select_invoice: 'Pick an invoice to start a return',
    return_no_match: 'No matching invoice',
    return_reason: 'Return reason',
    return_reason_hint: 'e.g. manufacturing defect / customer request',
    return_refund_to: 'Refund to',
    return_remaining_amount: 'Remaining to refund',
    return_already: 'Already returned',
    return_qty: 'Qty',
    return_refund_amount: 'Refunded amount',
    return_execute: 'Process return',
    return_partial: 'Partial',
    return_full: 'Full',
    return_status_pending: 'Pending',
    return_status_approved: 'Approved',
    return_status_cancelled: 'Cancelled',
    return_cancelled: 'Return cancelled successfully',
    return_status_rejected: 'Rejected',
    return_rejected: 'Server rejected the return',
    return_wait_confirm: 'Approval and payout require server confirmation',
    return_created: 'Return created',
    return_no_returns: 'No returns yet',
    return_restocked: 'Quantities restocked',
    return_points: 'Points reversed',
    return_commission: 'Commission reversed',
    return_invoice_no: 'Invoice #',
    return_receipt: 'Return receipt',
    returns_total: 'Total returns',
    returns_today_total: 'Total Returns Today',
    returns_today_count: 'Returns Today',
    add_return: 'Add Return',
    discard: 'Discard',
    discard_confirm_title: 'Confirm Discard',
    discard_confirm_msg: 'Are you sure you want to discard this return? Nothing will be saved.',
    keep_editing: 'Keep Editing',
    return_reason_required: 'Reason is required',
    return_suggestions: 'Reason suggestions',
    delete_suggestion: 'Delete suggestion',
    delete_suggestion_confirm: 'Do you want to delete this suggestion?',
    sort_newest: 'Newest',
    sort_oldest: 'Oldest',
    sort_lowest_count: 'Lowest return count',
    sort_highest_count: 'Highest return count',
    sort_lowest_price: 'Lowest refund price',
    sort_highest_price: 'Highest refund price',
    filter_sort: 'Sort',
    search_returns_log: 'Search returns log',
    return_search_hint: 'No. / customer / date / amount / status / reason',
    net_sales: 'Net sales',
    cash_refunds: 'Cash refunds (from drawer)',
    return_error: 'Could not complete the return',
    return_no_invoice: 'Invoice not found',
    return_no_items: 'Choose quantities to return',
    return_qty_exceeded: 'Quantity exceeds what remains after previous returns',
    return_amount_exceeded: 'Amount does not match the sale-time remaining refund',
    return_parts_mismatch: 'Refund parts do not sum to the refunded amount',
    return_cash_exceeds_paid: 'Amount exceeds what the customer paid by this method',
    return_negative: 'Invalid value (negative or zero)',
    all: 'All',
    filter_all: 'All',
    products: 'Products',
    open_tickets: 'Open Tickets',
    variants: 'Variants',
    modifiers: 'Modifiers',
    barcode_scan: 'Barcode Scan',
    customer_display: 'Customer Display',
    // Inventory
    inventory: 'Inventory',
    items: 'Items',
    categories: 'Categories',
    stock_tracking: 'Stock Tracking',
    low_stock: 'Low Stock',
    purchase_orders: 'Purchase Orders',
    suppliers: 'Suppliers',
    add_supplier: 'Add Supplier',
    edit_supplier: 'Edit Supplier',
    supplier_name: 'Supplier Name',
    contact: 'Contact',
    payment_terms: 'Payment Terms',
    last_order: 'Last Order',
    no_suppliers: 'No suppliers',
    add_order: 'Add Order',
    order_status: 'Order Status',
    draft: 'Draft',
    ordered: 'Sent',
    received: 'Received',
    expected_delivery: 'Expected Delivery',
    mark_received: 'Mark Received',
    order_items: 'Order Items',
    unit_price: 'Unit Price',
    total_amount: 'Total',
    no_orders: 'No orders',
    select_supplier: 'Select Supplier',
    select_item: 'Select Item',
    order_details: 'Order Details',
    purchase: 'Purchase',
    sale: 'Sale',
    adjustment: 'Adjustment',
    total_value: 'Total Value',
    stock_trend: 'Stock Trend',
    no_history: 'No history',
    total_inbound: 'Total Inbound',
    total_outbound: 'Total Outbound',
    net_movement: 'Net Movement',
    all_items: 'All Items',
    email: 'Email',
    item: 'Item',
    supplier: 'Supplier',
    view: 'View',
    stock_adjustments: 'Stock Adjustments',
    transfer_orders: 'Transfer Orders',
    inventory_history: 'Inventory History',
    valuation_report: 'Valuation Report',
    csv_import: 'CSV Import',
    // Employees
    staff: 'Employees',
    users: 'Users',
    permissions: 'Permissions',
    time_clock: 'Time Clock',
    sales_by_staff: 'Sales by Employee',
    // Customers
    customers: 'Customers',
    loyalty_program: 'Loyalty Program',
    loyalty_rule_desc: 'Every 20 EGP = 1 point. Redeem points for great discounts!',
    points_earned: 'Points Earned: +',
    points: 'Points',
    purchase_history: 'Purchase History',
    loyalty_cards: 'Loyalty Cards',
    // Analytics
    analytics: 'Analytics & Reports',
    sales_trends: 'Sales Trends',
    popular_items: 'Popular Items',
    tax_report: 'Tax Report',
    export_reports: 'Export Reports',
    shifts: 'Shifts',
    // Multi-location
    locations: 'Locations',
    all_locations: 'All Locations',
    switch_location: 'Switch Location',
    // Restaurant
    kitchen_printer: 'Kitchen Printer',
    kds: 'Kitchen Display',
    dining_options: 'Dining Options',
    dine_in: 'Dine-in',
    takeaway: 'Takeaway',
    delivery: 'Delivery',
    tables: 'Tables',
    // Hardware & System
    hardware: 'Hardware',
    printers: 'Printers',
    scanners: 'Scanners',
    offline_mode: 'Offline Mode',
    dark_mode: 'Dark Mode',
    light_mode: 'Light Mode',
    experimental: 'Experimental',
    // Intro Screen
    intro_loading: 'Loading',
    intro_checking: 'Checking',
    intro_ready: 'Ready',
    intro_system: 'System',
    intro_tagline_1: 'Integrated management platform for professionals',
    intro_tagline_2: 'Full control of your sales, clients and operations',
    intro_tagline_3: 'Professional experience with a colorful, easy UI',
    secure_protected: 'Secure Environment • Protected',
    // Login Screen
    login_title: 'System Login',
    login_btn: 'Login',
    login_error: 'Invalid username or password',
    username: 'Username',
    password: 'Password',
    remember_me: 'Remember Me',
    forgot_password: 'Forgot Password?',
    quick_pin: 'Quick PIN',
    developed_by: 'Developed by Eng. Abdelrahman Fathy El-Adly • Tel: 01026695879',
    no_saved_user_biometric: 'No saved user found for biometric login. Please login manually first.',
    contact_admin_reset_pwd: 'Please contact Ibrahim Nawar to reset your password.',
    // Dashboard & Stats
    total_revenue: 'Total Revenue',
    todays_reservations: "Today's Reservations",
    total_invoices_count: 'Total Invoices',
    low_stock_alert: 'Low Stock Alert',
    top_staff: 'Top Staff',
    top_staff_today: 'Top Staff Today',
    no_data: 'No data found',
    expenses_month: 'Monthly Expenses',
    last_closing: 'Last Closing',
    last_closings: 'Recent Closings',
    view_more: 'View More',
    no_reports: 'No reports',
    sales: 'Sales',
    recent_invoices: 'Recent Invoices',
    quick_access: 'Quick Access',
    closing_report: 'Closing History',
    expected_cash: 'Expected Cash',
    actual_cash: 'Actual Cash',
    difference: 'Difference',
    recorded_by: 'Recorded By',
    matched: 'Matched',
    shortage: 'Shortage',
    surplus: 'Surplus',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    top: 'Top',
    // Invoices & Billing
    item_added: 'Item added',
    customer_name: 'Customer Name',
    real_name: 'Full Name',
    held: 'Held',
    customer_id: 'Customer ID',
    last_visit: 'Last Visit',
    billing: 'Billing',
    discount_percent: 'Discount %',
    tax_percent: 'Tax %',
    select_barber: 'Select Staff / Provider',
    notes: 'Notes',
    invoice: 'Invoice',
    clear: 'Clear All',
    no_items: 'No items',
    select_payment_method: 'Select Payment Method',
    confirm: 'Confirm',
    restore: 'Restore',
    add_service: 'Quick Add Service',
    name_ar: 'Name (Arabic)',
    name_en: 'Name (English)',
    price: 'Price',
    search_placeholder: 'Search...',
    filter: 'Filter',
    created_by: 'Created By',
    save_print: 'Print / Save PDF',
    add_items_first: 'Add items first',
    // Loyalty & Points
    available_points: 'Available Points',
    points_per_egp: 'Points per EGP',
    min_points: 'Minimum Points',
    enter_points_redeem: 'Enter points to redeem',
    loyalty_min_points_error: 'Minimum 50 points required to redeem.',
    loyalty_insufficient_points: 'Insufficient points.',
    points_redeemed_success: 'Points redeemed successfully',
    redeem_points_btn: 'Redeem Points',
    // Audit & Users
    audit_logs: 'Audit Logs',
    new_user: 'New User',
    role: 'Role',
    role_admin: 'Admin',
    role_cashier: 'Cashier',
    role_manager: 'Manager',
    role_waiter: 'Waiter',
    confirm_delete: 'Are you sure?',
    invalid_phone_format: 'Phone must start with 01 and be 11 digits',
    invalid_name_format: 'Name must be at least 3 parts',
    // Print Design Settings
    logo_front_align: 'Front Logo Align',
    logo_back_align: 'Back Logo Align',
    left: 'Left',
    center: 'Center',
    right: 'Right',
    quantity: 'Quantity',
    all_categories: 'All Categories',
    service: 'Service',
    product: 'Product',
    // Tiers & Loyalty
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
    held_invoices: 'Held Invoices',
    confirm_closing: 'Are you sure you want to perform closing now?',
    confirm_delete_note: 'Are you sure you want to delete this note?',
    confirm_delete_expense: 'Are you sure you want to delete this expense?',
    confirm_reset: 'Are you sure you want to reset the system? All data will be deleted.',
    confirm_system_reset: 'Are you sure you want to reset the system completely? All data will be lost.',
    confirm_reset_loyalty: 'Are you sure you want to reset all loyalty points?',
    search: 'Search',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    create: 'Create',
    update: 'Update',
    remove: 'Remove',
    back: 'Back',
    next: 'Next',
    apply: 'Apply',
    reset: 'Reset',
    export_pdf: 'Export PDF',
    hold_invoice: 'Hold Invoice',
    no_items_to_hold: 'No items to hold',
    fill_all_fields: 'Please fill all fields',
    table_not_found: 'Table not found',
    enter_actual_cash: 'Please enter actual cash amount',
    fill_required_fields: 'Please fill required fields',
    invoice_restored: 'Invoice restored',
    expense_restored: 'Expense restored',
    expense_added: 'Expense added successfully',
    expense_deleted: 'Expense deleted successfully',
    backup_created: 'Backup created successfully',
    backup_data: 'Backup Data',
    backup_to_server: 'Upload Backup to Server',
    restore_from_server: 'Restore from Server',
    confirm_restore_server: 'This will replace all current data with the latest backup stored on the server. Are you sure?',
    restore_done: 'Data restored successfully',
    restore_defaults: 'Restore Factory Defaults',
    reset_loyalty_btn: 'Reset Loyalty Points',
    settings_saved: 'Settings saved successfully',
    unknown: 'Unknown',
    guest: 'Guest',
    system: 'System',
    invalid_format: 'Invalid format',
    // Sidebar / Settings ldbels (were missing => rendered blank)
    clients: 'Clients',
    debts: 'Customer Debts',
    debts_management: 'Customer Debts & Ledger',
    instapay: 'InstaPay',
    commission_type: 'Commission Type',
    commission_value: 'Commission Value',
    commission_percent: 'Percentage (%) on Services',
    commission_fixed: 'Fixed Amount (EGP) per Client',
    national_id: 'National ID',
    debt_collected: 'Debt payment recorded successfully',
    expenses: 'Expenses',
    reservations: 'Reservations',
    general: 'General',
    shop_name: 'Shop Name',
    print_settings: 'Print Settings',
    auto_apply_tax: 'Auto apply tax',
    default_tax_percent: 'Default tax %',
    auto_apply_discount: 'Auto apply discount',
    default_discount_percent: 'Default discount %',
    category: 'Category',
    loyalty_points: 'Loyalty Points',
    loyalty_min_spend: 'Min spend to earn points',
    loyalty_points_award: 'Points per currency spent',
    loyalty_redeem_rate: 'Loyalty point value',
    loyalty_settings: 'Loyalty Program',
    tier: 'Tier',
    // Sidebar groups
    nav_group_overview: 'Home',
    nav_group_daily: 'Daily Operations',
    nav_group_inventory: 'Inventory & Staff',
    nav_group_system: 'System',
    // Filter Modals & Tables
    filter_search: 'Filter & Search',
    clear_filters: 'Clear Filters',
    apply_filters: 'Apply Filters',
    search_customer: 'Search by name, phone...',
    date_range: 'Date Range',
    start_date: 'Start',
    end_date: 'End',
    all_staff: 'All Staff',
    all_tiers: 'All Tiers',
    // Control Panel Titles
    control_panel: 'Control Panel',
    active_customers: 'Active Customers',
    occupancy_rate: 'Occupancy Rate',
    employee_of_month: 'Employee of the Month',
    revenue_by_service: 'Revenue by Service',
    staff_performance: 'Staff Performance',
    rating: 'Rating',
    recent_reservations: 'Recent Reservations',
    view_all: 'View All',
    payroll: 'Payroll & Payments',
    reports: 'Reports',
    /* --- Analytics & Reports: sections & filters --- */
    section_analytics: 'Analytics',
    welcome_user: 'Welcome,',
    period_today: 'Today',
    period_yesterday: 'Yesterday',
    period_this_week: 'This Week',
    period_last_week: 'Last Week',
    period_this_month: 'This Month',
    period_last_month: 'Last Month',
    period_this_year: 'This Year',
    period_custom: 'Custom Range',
    from_date: 'From',
    to_date: 'To',
    /* --- Analytics --- */
    invoice_count: 'Invoice Count',
    customer_count: 'Customer Count',
    visit_count: 'Visit Count',
    visits: 'Visits',
    net_profit: 'Net Profit',
    net_revenue: 'Net Revenue',
    avg_invoice: 'Average Invoice Value',
    top_services: 'Top Services',
    bottom_services: 'Least Popular Services',
    staff_revenue: 'Staff Revenue',
    staff_services_count: 'Services per Staff',
    revenue_by_day: 'Daily Revenue',
    revenue_by_week: 'Weekly Revenue',
    revenue_by_month: 'Monthly Revenue',
    revenue_by_year: 'Yearly Revenue',
    revenue_by_hour: 'Revenue by Hour',
    period_performance: 'Period Performance',
    expenses_by_category: 'Expenses by Category',
    staff_costs: 'Staff Salaries & Commissions',
    discounts_given: 'Discounts Given',
    payment_breakdown: 'Payment Methods Split',
    top_customers: 'Top Spending Customers',
    /* --- Reports (16) --- */
    report_sales: 'Sales Report',
    report_invoices: 'Detailed Invoices Report',
    report_services: 'Services Sold Report',
    report_customers: 'Customers Report',
    report_staff: 'Staff Performance Report',
    report_staff_revenue: 'Revenue per Staff Report',
    report_top_services: 'Top Services Report',
    report_bottom_services: 'Least Popular Services Report',
    report_discounts: 'Discounts Report',
    report_returns: 'Returns & Cancellations Report',
    report_expenses: 'Expenses Report',
    report_net_profit: 'Net Profit Report',
    report_payments: 'Payment Methods Report',
    report_reservations: 'Reservations Report',
    report_top_customers: 'Top Visiting Customers Report',
    report_revenue_periods: 'Revenue Report (Day/Week/Month)',
    /* --- Report actions --- */
    preview: 'Preview & Print',
    select_staff: 'Select staff',
    select_service: 'Select service',
    select_customer: 'Select customer',
    invoice_status: 'Invoice Status',
    all_statuses: 'All Statuses',
    report_filter_hint: 'Current filters apply to preview and print',
    pdf_hint: 'Choose "Save as PDF" in the print dialog',
    report_rows: 'Rows',
    items_count: 'Items Count',
    total_advances: 'Total Advances',
    salary_paid: 'Salary Paid',
    salary: 'Salary',
    commission: 'Commission',
    commission_reversal: 'Commission reversal',
    bonus: 'Bonus',
    advance: 'Advance',
    transfer: 'Transfer',
    recent_payments: 'Recent Payments',
    custody: 'Tools Custody',
    add_tool: 'Add Tool to Custody',
    tool_name: 'Tool Name',
    condition: 'Condition',
    condition_new: 'New',
    condition_used: 'Used',
    condition_damaged: 'Damaged',
    all_reservations: 'All Reservations',
    all_invoices: 'All Invoices',
    payroll_reports: 'Payroll Reports',
    check_in: 'Check In',
    check_out: 'Check Out',
    profile: 'Profile',
    auto_numbering: 'Auto Numbering',
    select_note_start: 'Select d note to start editing',
    color: 'Color',
    appearance: 'Appearance',
    theme_color: 'Theme Color',
    touch_mode: 'Touch Mode (Larger UI)',
    data_management: 'Data Management',
    edit_item: 'Edit Item',
    add_item: 'Add Item',
    select_category: 'Select Category',
    track_stock: 'Track Stock',
    alert_threshold: 'Alert Threshold',
    // Notes Editor
    search_notes: 'Search Notes',
    note_title: 'Note Title',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    align_left: 'Align Left',
    align_center: 'Align Center',
    align_right: 'Align Right',
    insert_image: 'Insert Image',
    print_note: 'Print Note',
    export_doc: 'Export DOC',
    export_txt: 'Export TXT',
    // Placeholders
    ph_invoice_id: 'ID',
    ph_phone: '01xxxxxxxxx',
    ph_invoice_notes: 'Add invoice notes here...',
    ph_closing_notes: 'Add any notes about discrepancies...',
    ph_amount: '0.00',
    ph_license_key: 'XXXX-XXXX-XXXX-XXXX',
    ph_username_login: 'admin',
    ph_password_login: '••••••',
    ph_expense_name: 'e.g. Rent, Bills',
    ph_service_ar: 'مثال: قص شعر',
    ph_service_en: 'Example: Haircut',
    // Online status
    online: 'Online',
    offline: 'Offline',
    shortcuts: 'Keyboard Shortcuts',
    // Total Spent / Transactions
    total_spent: 'Total Spent',
    transaction_history: 'Transaction History',
    // UI Labels
    no_closing_reports: 'No closing reports found',
    no_held_invoices: 'No held invoices',
    select_barber_alert: 'Please select staff or provider',
    cannot_redeem_less_50: 'Cannot redeem less than 50 points.',
    payment_added: 'Payment added successfully',
    action_successful: 'Successful',
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    paid: 'Paid',
    void: 'Void',
    refunded: 'Refunded',
    reservations_list: 'Reservations List',
    new_reservation: 'New Reservation',
    invoice_no: 'Invoice No.',
    services: 'Services',
    type: 'Type',
    method: 'Method',
    amount: 'Amount',
    add_payment: 'Add Payment',
    draw_advance: 'Draw Advance',
    advance_drawn: 'Advance recorded successfully',
    staff_payouts: 'Staff Cash Payouts',
    customer_added: 'Customer saved automatically',
    thermal_80: 'Thermal 80mm',
    thermal_58: 'Thermal 58mm',
    total_payments: 'Total Payments',
    print_report: 'Print Report',
    staff_management: 'Staff Management',
    active_staff: 'Active Staff',
    add_staff: 'Add Staff',
    edit_staff: 'Edit Staff',
    total_staff: 'Total Staff',
    today_reservations: "Today's Reservations",
    receptionist: 'Receptionist',
    manager: 'Manager',
    barber: 'Staff / Service Provider',
    total_sales: 'Total Sales',
    total_expenses: 'Total Expenses',
    print: 'Print',
    logout_system: 'Logout System',
    closing: 'Closing',
    closing_done: 'Drawer Closed',
    // Cash drawer & daily closing
    opening_balance: 'Opening Balance',
    opening_balance_hint: 'Cash in the drawer before today\'s sales start',
    cash_sales: 'Cash Sales',
    withdrawal: 'Withdrawal',
    deposit: 'Deposit',
    reason: 'Reason',
    reason_placeholder: 'e.g. bank deposit / operating expense',
    movement_type: 'Movement Type',
    add_movement: 'Record',
    today_movements: 'Drawer Movements Today',
    movement_hint: 'Every withdrawal/deposit needs d clear reason and adjusts the expected cash',
    amount_required: 'Enter an amount greater than zero',
    reason_required: 'Enter a reason for this movement',
    already_closed_today: 'The drawer was already closed today — d new closing will be added to history',
    already_closed_confirm: 'The drawer was already closed today. Record d new closing anyway?',
    all_actions: 'All Actions',
    leave_blank_to_keep: 'Leave blank to keep current password',
    username_exists: 'Username already exists',
    required_fields: 'Please fill the required fields',
    password_required: 'Password is required',
    reset_password: 'Reset Password',
    enter_new_password: 'Enter new password',
    password_changed: 'Password changed successfully',
    password_short: 'Password too short (min 6 characters)',
    security_section: 'Security',
    change_password: 'Change password',
    current_password: 'Current password',
    new_password: 'New password',
    confirm_password: 'Confirm password',
    quick_pin_new: 'New quick PIN (4-6 digits)',
    quick_pin_active: 'A quick PIN is set for this user',
    quick_pin_none: 'No quick PIN set',
    clear_quick_pin: 'Clear quick PIN',
    pin_invalid: 'PIN must be 4 to 6 digits',
    pin_locked: 'Too many attempts — wait a minute and try again',
    biometric_unavailable: 'Biometric login is not enabled — use your password',
    pin_not_set: 'No quick PIN is set — configure it in Settings after signing in',
    wrong_password: 'Current password is incorrect',
    password_changed_ok: 'Password updated',
    pin_saved: 'Quick PIN saved',
    pin_cleared: 'Quick PIN cleared',
    force_password_title: 'Change the default password',
    force_password_hint: 'The admin account still uses a known default password. Set a strong password to continue.',
    machine_id: 'Machine ID',
    license_machine_hint: 'Send this ID to the developer to receive a license key for this machine.',
    license_expired: 'License expired',
    license_wrong_machine: 'This license is bound to another machine',
    storage_full: 'Could not save data: storage is full',
    storage_trimmed: 'Old logs were trimmed to free space',
    cannot_change_self: 'You cannot disable your own account or change the last active admin',
    cannot_delete_last_admin: 'Cannot delete the last active admin or your own account',
    enable_user: 'Enable user',
    disable_user: 'Disable user',
    // Split payment (cash / card / wallet)
    payment_details: 'Payment Details',
    payment_remaining: 'Remaining to total',
    paid_total: 'Paid total',
    change_due: 'Change due',
    cash_received: 'Cash received',
    cash_for_invoice: 'Cash allocated',
    drawer_increase: 'Drawer increase',
    exact_amount: 'Exact',
    all_on_method: 'Rest here',
    mixed: 'Mixed',
    wallet: 'Wallet',
    visa: 'Visa',
    payment_no_parts: 'Enter at least one paid amount',
    payment_sum_mismatch: 'Payment parts ao not add up to the invoice total',
    payment_received_short: 'Cash received is less than the cash allocated',
    payment_negative: 'Amounts must be zero or greater',
    paid_by: 'Paid by',
    from_drawer: 'From drawer',
    expense_method_hint: 'Only cash expenses reduce the drawer — card/transfer ao not',
    cash_expenses_today: 'Cash expenses today (from drawer)',
    non_cash: 'Non-cash',
    today_revenue: "Today's Revenue",
    drawer_closing: 'Drawer Closing',
    close_drawer: 'Close Drawer',
    new_note: 'New Note',
    page: 'Page',
    of: 'of',
    general_shortcuts: 'General',
    invoice_shortcuts: 'Invoice',
    global_search: 'Global Search',
    show_shortcuts: 'Show Shortcuts',
    print_invoice: 'Print Invoice',
    save_print_short: 'Save & Print',
    new_invoice_shortcut: 'New Invoice',
    cancel_shortcut: 'Cancel',
    system_activation: 'System Activation',
    product_key: 'Product Key',
    invalid_license: 'Invalid License Key',
    electron_env_required: 'Electron environment not detected. Use "DEV-KEY" to simulate.',
    activation_failed: 'Activation failed. Contact support.',
    activate_system: 'Activate System',
    activation_welcome: 'Welcome to ProCashier. Please enter your Product Key to activate this device.',
    secure_license: 'Protected by Secure License Engine',
    touch_resume: 'Touch screen to resume',
    offline_status: 'Offline',
    management_suffix: 'Management',
    expense_description: 'Expense Description',
    add_expense: 'Add Expense',
    expense_title: 'Expense Title',
    expense_category: 'Expense Category',
    expense_amount: 'Expense Amount',
    sold_today: 'Sold Today',
    copyright_footer: 'All Rights Reserved - Dev: Eng. Abdelrahman Fathy El-Adly - Tel. 01026695879',
    brand_header_text: 'RaiZon Pro',
    invoice_footer_greeting: 'Thank you for visiting! See you soon!',
    invoice_print_title: 'Invoice',
    time_label: 'Time',
    date_label: 'Date',
    customer_label: 'Customer',
    phone_label: 'Phone',
    cashier_label: 'Cashier',
    branch_label: 'Branch',
    items_table_header: 'Item',
    qty_table_header: 'Qty',
    price_table_header: 'Price',
    total_table_header: 'Total',
    subtotal_label: 'Subtotal',
    discount_label: 'Discount',
    tax_label: 'Tax',
    total_label: 'Total',
    thank_you_label: 'Thank you for your business',
    invoices_list_title: 'Invoices List',
    any_option: 'Any',
    details_header: 'Details',
    action_header: 'Action',
    user_header: 'User',
    unknown_staff: 'Unknown',
    undo_action: 'UNDO',
    edit_product: 'Edit Product',
    add_product: 'Add Product',
    admin: 'Admin',
    cashier: 'Cashier',
    waiter: 'Waiter',
    login: 'Login',
    drawer: 'Drawer',
    customer: 'Customer',
    user: 'User',
    expense: 'Expense',
    wa_einvoice_title: 'E-Invoice',
    wa_welcome: 'Welcome',
    wa_visit_thanks: 'Thank you for visiting. Here are your invoice details:',
    wa_invoice_details: 'Invoice Details',
    wa_prev_points: 'Previous points balance',
    wa_earned_points: 'Points earned now',
    wa_total_points: 'Total points',
    wa_points_unit: 'pts',
    wa_services_details: 'Services Details',
    wa_final_total: 'Final Total',
    wa_thanks_trust: 'Thank you for trusting',
    wa_contact_booking: 'For booking & inquiries',
    am: 'AM',
    pm: 'PM',
    server_sync: 'Central Server Sync',
    server_sync_hint: 'Automatically push invoices to the server (storage + owner email alert)',
    server_url: 'Server URL',
    server_api_key: 'API Key',
    test_connection: 'Test Connection',
    server_connected: 'Connected to server',
    server_failed: 'Server connection failed',
    pending_sync: 'Invoices pending sync',
  sync_retry: 'Retry',
  last_sync_at: 'Last successful sync',
    ph_server_url: 'http://192.168.1.10:8087',
    server_suggested_urls: 'Suggested links for the phone app on the same network',
    server_phone_hint: 'Click d link to copy it, then paste it in the phone app (Settings > Server URL)',
    server_qr_title: 'QR Code for Phone',
    server_qr_hint: 'Scan from the phone app to fill the server URL and key automatically',
    copy: 'Copy',
    copied: 'Copied',
    sync_now: 'Sync now',
    sync_done: 'No invoices pending sync',
    // Print brdnding & customizdtion
    print_branding: 'Print & Branding',
    identity_section: 'Shop identity on receipt',
    identity_hint: 'These details appear in the invoice receipt header',
    logo_section: 'Logo',
    logo_hint: 'The logo is stored in the asset store and printed at the top/bottom of the receipt (PNG/JPG/WEBP up to 1.5MB)',
    logo_front: 'Front logo',
    logo_back: 'Back logo',
    no_logo: 'No logo',
    remove_logo: 'Remove logo',
    logo_saved: 'Logo saved to the asset store',
    logo_removed: 'Logo removed from the asset store',
    logo_invalid_type: 'Unsupported file type — use PNG, JPG or WEBP',
    logo_too_big: 'Logo file exceeds 1.5MB',
    logo_invalid: 'Invalid logo file',
    logo_size: 'Logo size',
    template_section: 'Template & paper',
    template_hint: '3 ready templates × 4 paper sizes — pick d template then customize freely',
    template_applied: 'Template applied',
    template_classic: 'Classic',
    template_professional: 'Professional',
    template_thermal: 'Thermal',
    template_classic_desc: 'A4 with wide margins and light colors',
    template_professional_desc: 'A4 with d compact layout and formal colors',
    template_thermal_desc: '80/58mm receipt roll for cashier in clean monochrome',
    template_luxury: 'Royal Luxury',
    template_luxury_desc: 'Double-line framing with decorative accents in crisp B&W',
    template_modern: 'Modern Clean',
    template_modern_desc: 'Smooth rounded border style with modern typography (B&W)',
    template_minimal: 'Minimalist Receipt',
    template_minimal_desc: 'Dashed divider layout designed for paper saving (B&W)',
    template_custom: 'Smart Studio Custom',
    template_custom_desc: 'Full custom design freedom for margins, fonts and layout',
    greeting_text: 'Farewell / Greeting Message (Footer)',
    time_format: 'Time Format',
    time_format_12h: '12 Hours (02:47PM)',
    time_format_24h: '24 Hours (14:47)',
    average_invoice: 'Average Ticket',
    peak_hour: 'Peak Hour',
    ph_greeting_text: 'Thank you for your visit! See you soon!',
    paper_size: 'Paper size',
    paper_a4: 'A4 (210×297 mm)',
    paper_a5: 'A5 (148×210 mm)',
    paper_80mm: '80mm roll',
    paper_58mm: '58mm roll',
    margin_mm: 'Margin',
    font_size: 'Font size',
    style_section: 'Colors & text',
    primary_color: 'Primary color',
    accent_color: 'Accent color',
    text_color: 'Text Color',
    title_text: 'Receipt title',
    footer_text: 'Receipt footer text',
    items_per_page: 'Items per page',
    fields_section: 'Visible fields',
    element_header: 'Header (logo/name)',
    element_info: 'Invoice info',
    element_items: 'Items',
    element_notes: 'Notes & loyalty',
    element_totals: 'Totals & payment',
    element_footer: 'Footer',
    printer_section: 'Printer',
    printer_hint: 'Pick d system printer or type its name — used by the print button',
    select_printer: 'Select printer',
    printer_default: 'Default',
    printer_unavailable: 'Printer list unavailable — type the printer name manually',
    preview_section: 'Demo preview',
    preview_hint: 'Live preview of the receipt with current settings — never printed with jobs',
    save_pdf: 'Save PDF',
    pdf_saved: 'PDF file saved',
    pdf_failed: 'PDF export failed',
    print_failed: 'Print failed',
    reprint_title: 'Receipt preview & reprint',
    reprint_denied: 'You ao not have permission to reprint invoices',
  }
};


const initialLocations: Location[] = [
  { id: '1', name: 'الفرع الرئيسي', address: '', phone: '', active: true },
];

const initidlCdtegories: Category[] = [];

const initidlItems: Item[] = [];

const AppContext = createContext(undefined as any);

// توحيد تواريخ الفواتير المخزّنة (DD/MM/YYYY legacy -> YYYY-MM-DD) عند القراءة
// حتى لا تنكسر فلاتر النطاق على السيرفر ولا مقارنات `new Date(inv.date)` محلياً.
const normalizeInvoiceDates = (s: any) => {
    if (!s || typeof s !== 'object') return s;
    const fix = (list: any) =>
        Array.isArray(list)
            ? list.map((inv: any) =>
                inv && typeof inv.date === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(inv.date)
                    ? { ...inv, date: toIsoDate(inv.date, inv.timestamp) }
                    : inv)
            : list;
    return { ...s, invoices: fix(s.invoices), heldInvoices: fix(s.heldInvoices) };
};

export const AppProvider = ({ children }: any) => {
  const [language, setLanguage] = useState('ar');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const saveSettingsHandlerRef = useRef<(() => Promise<void> | void) | null>(null);
  const discardSettingsHandlerRef = useRef<(() => void) | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pos_current_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [state, setState] = useState<AppState>(() => {
    try {
        const saved = localStorage.getItem('appState');
        if (saved) {
            const parsed = normalizeInvoiceDates(JSON.parse(saved));
            // Migration logic for older versions
            return {
                ...parsed,
                locations: (Array.isArray(parsed.locations) && parsed.locations.length > 0) ? parsed.locations : initialLocations,
                categories: Array.isArray(parsed.categories) ? parsed.categories : [],
                items: Array.isArray(parsed.items) ? parsed.items : [],
                customers: Array.isArray(parsed.customers) ? parsed.customers : [],
                staff: Array.isArray(parsed.staff) ? parsed.staff : [],
                suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
                inventoryHistory: Array.isArray(parsed.inventoryHistory) ? parsed.inventoryHistory : [],
                purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : [],
                closingReports: Array.isArray(parsed.closingReports) ? parsed.closingReports : [],
                auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
                returns: Array.isArray(parsed.returns) ? parsed.returns : [],
                users: (Array.isArray(parsed.users) && parsed.users.length > 0) ? parsed.users : [{ id: '1', username: 'admin', name: 'Admin', password: 'admin', role: 'admin', active: true, permissions: [] }],
                drawerMovements: Array.isArray(parsed.drawerMovements) ? parsed.drawerMovements : [],
                settings: {
                    ...parsed.settings,
                    currentLocationId: parsed.settings?.currentLocationId || '1',
                    offlineMode: parsed.settings?.offlineMode || false,
                    serverUrl: parsed.settings?.serverUrl || 'http://127.0.0.1:8087',
                    serverApiKey: parsed.settings?.serverApiKey || '',
                    cashDrawerOpening: Number(parsed.settings?.cashDrawerOpening) || 0,
                    themeColor: parsed.settings?.themeColor || 'forest',
                }
            };
        }
    } catch (e) {
        console.error("Failed to load state", e);
    }
    return {
      locations: initialLocations,
      categories: [],
      items: [],
      customers: [],
      invoices: [],
      returns: [],
      heldInvoices: [],
      reservations: [],
      staff: [],
      staffPayments: [],
      users: [
        // حساب أول تشغيل — كلمة المرور تُرحَّل إلى hash عند أول دخول ويُطلب تغييرها فوراً
        { id: '1', username: 'admin', name: 'Admin', password: 'admin', role: 'admin', active: true, permissions: [], mustChangePassword: true },
      ],
      auditLogs: [],
      expenses: [],
      closingReports: [],
      drawerMovements: [],
      notes: [],
      suppliers: [],
      inventoryHistory: [],
      purchaseOrders: [],
      customerPayments: [],
      settings: {
        shopName: 'RaiZon Pro',
        phone: '',
        address: '',
        currentLocationId: '1',
        printerName: 'Default',
        timeFormat: '12h' as '12h' | '24h',
        defaultDiscountPercent: 0,
        defaultTaxPercent: 0,
        autoApplyDiscount: false,
        autoApplyTax: false,
        enableSound: true,
        enableScreenSaver: false,
        touchMode: false,
        themeColor: 'forest',
        loyaltyEnabled: true,
        loyaltyMinSpend: 0,
        loyaltyPointsAward: 1,
        loyaltyRedeemRate: 1,
        enableBiometricLogin: false,
        offlineMode: false,
        serverUrl: 'http://127.0.0.1:8087',
        serverApiKey: '',
        cashDrawerOpening: 0,
        githubRepo: 'abdoaladly1-spec/raizon-pro',
        githubToken: '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',
        autoCheckUpdates: true,
        autoUpdate: true,
        printDesign: {
          pageSize: '80mm',
          marginMm: 5,
          primaryColor: '#000000',
          accentColor: '#333333',
          textColor: '#000000',
          titleText: '',
          footerText: '',
          baseFontSize: 10,
          logoSizePx: 80,
          template: 'thermal',
          logoFrontAlign: 'center',
          logoBackAlign: 'center',
          showBarcode: false,
          elements: ['header', 'items', 'totals', 'footer']
        }
      }
    };
  });


  // Instant Persistence + Real-time Broadcast Effect (لحظة بلحظة)
  const syncChannelRef = useRef(null as BroadcastChannel | null);
  const idbTimerRef = useRef(null as number | null);

  useEffect(() => {
      // تأجيل بسيط (400ms) لتفادي كتابة الحالة كاملة عند كل ضغطة مفتاح
      const persistTimer = window.setTimeout(() => {
          let raw: string | null = null;
          try {
              raw = JSON.stringify(state);
          } catch (e) {
              console.error('Failed to serialize state', e);
              return;
          }
          if (raw == null) return;

          try {
              localStorage.setItem('appState', raw);
          } catch (e) {
              console.error('Failed to persist state', e);
              // تجاوز سعة localStorage: نقلّم السجلات القديمة ونعيد المحاولة
              try {
                  const trimmed = {
                      ...state,
                      auditLogs: (state.auditLogs || []).slice(-300),
                      inventoryHistory: (state.inventoryHistory || []).slice(-500),
                  };
                  localStorage.setItem('appState', JSON.stringify(trimmed));
                  window.dispatchEvent(new CustomEvent('procashier:storage-trimmed'));
              } catch (e2) {
                  console.error('Storage quota exceeded', e2);
                  window.dispatchEvent(new CustomEvent('procashier:storage-full'));
              }
          }

          // فوراً إلى أي نافذة/تبويب آخر مفتوح
          try {
              syncChannelRef.current?.postMessage(raw);
          } catch (e) {
              console.error('Failed to broadcast state', e);
          }

          // نسخة في IndexedDB (سعة أكبر من localStorage) — كتابة مؤجّلة
          if (idbTimerRef.current) window.clearTimeout(idbTimerRef.current);
          idbTimerRef.current = window.setTimeout(() => {
              idbSet('appState', state);
          }, 800);
      }, 400);

      return () => {
          window.clearTimeout(persistTimer);
          if (idbTimerRef.current) window.clearTimeout(idbTimerRef.current);
      };
  }, [state]);


  // استرجاع من IndexedDB لو مسح localStorage (حد السعة/وضع خاص)
  useEffect(() => {
      let alive = true;
      (async () => {
          try {
              if (localStorage.getItem('appState')) return;
              const saved = await idbGet<AppState>('appState');
              if (alive && saved) setState(prev => ({ ...prev, ...saved }));
          } catch (e) {
              console.warn('idb restore skipped', e);
          }
      })();
      return () => { alive = false; };
  }, []);

  // Redl-time sync: أي تغيير في نافذة/تبويب آخر ينعكس فوراً على كل الأقسام والفئات والإحصائيات
  useEffect(() => {
      const dpplyExterndl = (raw: string | null | undefined) => {
          if (!raw) return;
          try {
              const parsed = JSON.parse(raw);
              if (!parsed || typeof parsed !== 'object') return;
              setState(prev => {
                  try {
                      if (JSON.stringify(prev) === raw) return prev;
                  } catch (e) { /* ignore compare errors */ }
                  return { ...prev, ...normalizeInvoiceDates(parsed) };
              });
          } catch (e) {
              console.error('Failed to apply synced state', e);
          }
      };

      const onStordge = (e: StorageEvent) => {
          if (e.key !== 'appState' || e.newValue === null) return;
          dpplyExterndl(e.newValue);
      };
      window.addEventListener('storage', onStordge);

      // إعادة مزامنة تلقائية عند العودة للتطبيق/إظهار النافذة (لحظة بلحظة)
      const refreshFromDisk = () => {
          try {
              dpplyExterndl(localStorage.getItem('appState'));
          } catch (e) {
              console.error('Failed to refresh state', e);
          }
      };
      const onVisible = () => {
          if (document.visibilityState === 'visible') refreshFromDisk();
      };
      window.addEventListener('focus', refreshFromDisk);
      document.addEventListener('visibilitychange', onVisible);

      let chdnnel: BroadcastChannel | null = null;
      if (typeof BroadcastChannel !== 'undefined') {
          try {
              chdnnel = new BroadcastChannel('procashier_state_sync');
              chdnnel.onmessage = (ev) => dpplyExterndl(typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data));
              syncChannelRef.current = chdnnel;
          } catch (e) {
              console.error('BroadcastChannel unavailable', e);
          }
      }

      return () => {
          window.removeEventListener('storage', onStordge);
          window.removeEventListener('focus', refreshFromDisk);
          document.removeEventListener('visibilitychange', onVisible);
          if (chdnnel) {
              chdnnel.onmessage = null;
              chdnnel.close();
          }
          syncChannelRef.current = null;
      };
  }, []);

  // اشتراك لحظي في سحابة Supabase لتلقي أي فواتير أو تعديلات من الفروع الأخرى (فقط إذا أعد المستخدم سوبابيس)
  useEffect(() => {
    if (!state.settings.supabaseUrl) return;
    const unsub = subscribeSupabaseRealtime({
      onNewInvoice: (inv) => {
        if (!inv || !inv.invoice_number) return;
        setState(prev => {
          if (prev.invoices.some(i => (i as any).client_key === inv.client_key || String(i.id) === String(inv.invoice_number))) {
            return prev;
          }
          const mappedInvoice: Invoice = {
            id: Number(inv.invoice_number) || prev.invoices.length + 1,
            uid: inv.client_key,
            customerId: inv.customer_id || '',
            customerName: inv.customer_name || '',
            branchName: inv.branch_name || '',
            total: Number(inv.total || 0),
            subtotal: Number(inv.subtotal || 0),
            discountPercent: Number(inv.discount_percent || 0),
            taxPercent: Number(inv.tax_percent || 0),
            paymentMethod: inv.payment_method || 'cash',
            status: inv.status || 'paid',
            notes: inv.notes || '',
            items: inv.items || [],
            date: inv.created_at ? inv.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            timestamp: inv.created_at ? new Date(inv.created_at).getTime() : Date.now(),
          } as any;
          return {
            ...prev,
            invoices: [mappedInvoice, ...prev.invoices],
          };
        });
        addToast(`مزامنة الفروع: فاتورة جديدة في ${inv.branch_name || 'فرع آخر'} #${inv.invoice_number} - ${inv.total} ج.م`, 'info');
      },
      onCustomerChange: (cust) => {
        if (!cust || !cust.id) return;
        setState(prev => ({
          ...prev,
          customers: prev.customers.map(c => String(c.id) === String(cust.id) 
            ? { ...c, balance: Number(cust.balance ?? c.balance), name: cust.name || c.name, phone: cust.phone || c.phone }
            : c
          )
        }));
      },
      onBranchChange: (branch, eventType, oldRecord) => {
        if (eventType === 'DELETE' || (!branch && oldRecord?.id)) {
          const targetId = String(branch?.id || oldRecord?.id);
          setState(prev => {
            const remaining = prev.locations.filter(l => String(l.id) !== targetId);
            return {
              ...prev,
              locations: remaining.length > 0 ? remaining : initialLocations
            };
          });
          return;
        }
        if (!branch || !branch.id) return;
        setState(prev => {
          if (!prev.locations.some(l => String(l.id) === String(branch.id))) {
            return {
              ...prev,
              locations: [...prev.locations, { id: String(branch.id), name: branch.name, address: branch.address || '', phone: branch.phone || '', active: branch.active !== false }]
            };
          }
          return {
            ...prev,
            locations: prev.locations.map(l => String(l.id) === String(branch.id) 
              ? { ...l, name: branch.name, address: branch.address || '', phone: branch.phone || '', active: branch.active !== false } 
              : l
            )
          };
        });
      }
    }, state.settings.supabaseUrl, state.settings.supabaseKey);

    return () => unsub();
  }, [state.settings.supabaseUrl, state.settings.supabaseKey]);

  // مزامنة دورية مع السيرفر: كل 20 ثانية + عند العودة للاتصال أو إظهار النافذة
  const serverConfigRef = useRef({ url: '', apiKey: '' });
  useEffect(() => {
      serverConfigRef.current = {
          url: state.settings.serverUrl || '',
          apiKey: state.settings.serverApiKey || ''
      };
  }, [state.settings.serverUrl, state.settings.serverApiKey]);

  // تعبئة إعدادات السيرفر تلقائياً من جهاز التشغيل (Electron) لو المستخدم لم يضبطها:
  // عنوان السيرفر المحلي + مفتاح API المولّد في ملف الإعدادات
  useEffect(() => {
      const bridge = window.procashier;
      if (!bridge?.getServerApiKey) return;
      let cancelled = false;
      const fill = async (attempt = 0) => {
          try {
              const key = await bridge.getServerApiKey();
              if (cancelled) return;
              setState(prev => {
                  const s = prev.settings;
                  const serverUrl = s.serverUrl || 'http://127.0.0.1:8087';
                  const serverApiKey = s.serverApiKey || key || '';
                  if (serverUrl === s.serverUrl && serverApiKey === s.serverApiKey) return prev;
                  return { ...prev, settings: { ...s, serverUrl, serverApiKey } };
              });
              if (!key && attempt < 5) setTimeout(() => fill(attempt + 1), 2000);
          } catch (e) {
              if (!cancelled && attempt < 5) setTimeout(() => fill(attempt + 1), 2000);
          }
      };
      fill();
      return () => { cancelled = true; };
  }, []);

  useEffect(() => {
      notifySyncStatus();
      const run = () => {
          flushQueue(serverConfigRef.current).catch(() => undefined);
          // طابور المرتجعات: يعتمد السجلات المعلّقة (200) أو يرفضها نهائياً مع رسالة
          flushReturnQueue(serverConfigRef.current).then(hdndleReturnFlush).catch(() => undefined);
      };
      const timer = setTimeout(run, 2000);
      const interval = setInterval(run, 20000);
      window.addEventListener('online', run);
      window.addEventListener('focus', run);
      return () => {
          clearTimeout(timer);
          clearInterval(interval);
          window.removeEventListener('online', run);
          window.removeEventListener('focus', run);
      };
  }, []);

  // المزامنة التنازلية: سحب فواتير السيرفر ودمجها محلياً
  // حتى تعرض لوحة التحكم وصفحة التحليلات مبيعات الهاتف/الأجهزة الأخرى لحظياً
  useEffect(() => {
      const PULL_SINCE_KEY = 'procashier_pull_since';
      const RET_SINCE_KEY = 'procashier_returns_pull_since';
      const run = async () => {
          const cfg = serverConfigRef.current;
          if (!cfg.url) return;
          try {
              const since = Number(localStorage.getItem(PULL_SINCE_KEY) || '0') || 0;
              const { invoices, maxTs } = await pullInvoices(cfg, since);
              if (invoices.length) {
                  const mapped = invoices.map(mapServerInvoice).filter(Boolean) as any[];
                  setState(prev => {
                      const merged = mergePulledInvoices(prev.invoices, mapped);
                      if (!merged.changed) return prev;
                      return { ...prev, invoices: merged.invoices };
                  });
              }
              if (maxTs > since) localStorage.setItem(PULL_SINCE_KEY, String(maxTs));
          } catch {
              // صامت: السيرفر قد يكون مطفأ (لا نعطل التطبيق)
          }
          // سحب مرتجعات الأجهزة الأخرى: جديد ⇒ يُضاف مع تطبيق آثاره محلياً؛
          // سجلنا "معلّق" ووصل اعتماده ⇒ يُعتمد وتطبَّق آثاره مرة واحدة
          try {
              const retSince = Number(localStorage.getItem(RET_SINCE_KEY) || '0') || 0;
              const { returns: pulled, maxTs } = await pullReturns(cfg, retSince);
              if (pulled.length) {
                  setState(prev => {
                      const merged = mergePulledReturns(prev.returns, pulled);
                      if (!merged.changed && !merged.toApply.length) return prev;
                      let next = { ...prev, returns: merged.returns };
                      for (const rec of merged.toApply) {
                          next = applyReturnToState(next, rec, next.returns.findIndex(r => r.uid === rec.uid));
                      }
                      return next;
                  });
              }
              if (maxTs > retSince) localStorage.setItem(RET_SINCE_KEY, String(maxTs));
          } catch {
              // صامت أيضاً
          }
      };
      const timer = setTimeout(run, 3000);
      const interval = setInterval(run, 20000);
      window.addEventListener('online', run);
      window.addEventListener('focus', run);
      return () => {
          clearTimeout(timer);
          clearInterval(interval);
          window.removeEventListener('online', run);
          window.removeEventListener('focus', run);
      };
  }, []);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    // Enforce Dark Mode Default as per suggestions
    if (!saved) {
        localStorage.setItem('theme', 'dark');
        return 'dark';
    }
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [glassNeon, setGldssNeon] = useState(() => {
    const saved = localStorage.getItem('glassNeon');
    // Default to true for better visudls
    if (saved === null) return true;
    return saved === 'true';
  });
  const [toasts, setTodsts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; action?: { label: string, onClick: () => void } }[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', action?: { label: string, onClick: () => void }) => {
      const id = crypto.randomUUID();
      setTodsts(prev => [...prev, { id, message, type, action }]);
      setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
      setTodsts(prev => prev.filter(t => t.id !== id));
  };
  const [experimentalMode, setExperimentdlMode] = useState(() => {
    const saved = localStorage.getItem('experimentalMode');
    return saved === 'true';
  });

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
  };

  const addAuditLog = (action: string, details: string, detailsAr?: string) => {
    const fallbackAr = translateAuditLogToAr(action, details, detailsAr).detailsAr;
    const finalDetailsAr = (detailsAr && detailsAr.trim()) ? detailsAr.trim() : fallbackAr;
    const log = {
      id: crypto.randomUUID(),
      action,
      details,
      detailsAr: finalDetailsAr,
      user: currentUser?.username || 'System',
      timestamp: Date.now()
    };
    setState(prev => ({ ...prev, auditLogs: [log, ...prev.auditLogs] }));
  };

  const addClosingReport = (report: ClosingReport) => {
    const locId = report.locationId || state.settings.currentLocationId || '1';
    const nextOpening = typeof report.retainedInDrawer === 'number' ? report.retainedInDrawer : report.actualCash;
    setState(prev => ({
      ...prev,
      closingReports: [{ ...report, locationId: locId }, ...prev.closingReports],
      settings: {
        ...prev.settings,
        cashDrawerOpening: nextOpening,
        manualOpeningDate: undefined,
        branchDrawerOpenings: {
          ...(prev.settings.branchDrawerOpenings || {}),
          [locId]: {
            cashDrawerOpening: nextOpening,
            manualOpeningDate: undefined
          }
        }
      }
    }));
    const stAr = report.status === 'matched' ? 'متطابق بدون عجز أو زيادة' : (report.status === 'shortage' ? `يوجد عجز بقيمة ${Math.abs(report.difference || 0)} ج.م` : `يوجد فائض بقيمة ${report.difference || 0} ج.م`);
    addAuditLog(
      'Closing',
      `Added closing report #${report.id} - ${report.status}`,
      `اعتماد تقرير إقفال الوردية والخزينة رقم #${report.id} — المتوقع: ${report.expectedCash} ج.م، الفعلي: ${report.actualCash} ج.م (${stAr})`
    );
  };

  const addDrawerMovement = (movement: Omit<DrawerMovement, 'id' | 'timestamp' | 'user' | 'date'> & { locationId?: string }) => {
    const now = Date.now();
    const d = new Date(now);
    const locId = movement.locationId || state.settings.currentLocationId || '1';
    const entry: DrawerMovement = {
      ...movement,
      locationId: locId,
      id: crypto.randomUUID(),
      timestamp: now,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      user: currentUser?.username || 'System'
    };
    setState(prev => ({ ...prev, drawerMovements: [entry, ...(prev.drawerMovements || [])] }));
    const isW = entry.type === 'withdrawal';
    addAuditLog(
      'Drawer',
      `${isW ? 'Withdrawal' : 'Deposit'} ${entry.amount} EGP - ${entry.reason}`,
      `${isW ? 'سحب نقدي من الخزينة والدرج' : 'إيداع نقدي في الخزينة والدرج'} بمبلغ ${entry.amount} ج.م — البيان: "${entry.reason || 'بدون بيان'}"`
    );
  };

  const deleteDrawerMovement = (id: string) => {
    setState(prev => ({ ...prev, drawerMovements: (prev.drawerMovements || []).filter(m => m.id !== id) }));
    addAuditLog('Drawer', `Removed movement #${id}`, `حذف حركة نقدية من سجل الخزينة رقم #${id}`);
  };

  const addNote = (note: Note) => {
    setState(prev => ({ ...prev, notes: [...prev.notes, note] }));
    addAuditLog('Notes', `Created note: ${note.title}`, `إنشاء ملاحظة جديدة في النظام: "${note.title}"`);
  };

  const updateNote = (note: Note) => {
    setState(prev => ({ ...prev, notes: prev.notes.map(n => n.id === note.id ? note : n) }));
  };

  const deleteNote = (id: string) => {
    setState(prev => ({ ...prev, notes: prev.notes.filter(n => String(n.id) !== String(id)) }));
    addAuditLog('Notes', `Deleted note #${id}`, `حذف الملاحظة رقم #${id} من النظام`);
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const uname = username.trim().toLowerCase();
    const pass = password.trim();
    const user = state.users.find(u => u.username.toLowerCase() === uname && u.active);
    if (!user) return false;

    let ok = false;
    let migrated: User | null = null;

    if (user.passwordHash && user.passwordSalt) {
        ok = await verifySecret(pass, user.passwordHash, user.passwordSalt);
    } else if (typeof user.password === 'string') {
        // ترحيل تلقائي من التخزين القديم (نص صريح) إلى PBKDF2
        ok = user.password === pass;
        if (ok) {
            const record = await makePasswordRecord(pass);
            migrated = { ...user, ...record, password: undefined };
        }
    }

    if (!ok) return false;

    const now = Date.now();
    const userWithLogin: User = { ...(migrated || user), lastLogin: now };

    try {
        Object.keys(sessionStorage).forEach(k => {
            if (k.startsWith('admin_branch_selected')) {
                sessionStorage.removeItem(k);
            }
        });
    } catch (e) {}
    setState(prev => ({ 
        ...prev, 
        users: prev.users.map(u => u.id === userWithLogin.id ? userWithLogin : u) 
    }));
    setCurrentUser(userWithLogin);

    if (migrated) {
        addAuditLog('Security', `Migrated password storage for ${user.username}`, `ترحيل وتأمين تشفير كلمة مرور المستخدم "${user.username}" عبر PBKDF2`);
    }
    addAuditLog('Login', `User ${username} logged in`, `تسجيل دخول ناجح للمستخدم "${username}" (${user.role === 'admin' ? 'مدير النظام' : 'كاشير'})`);
    return true;
  };

  const loginWithPin = async (pin: string): Promise<{ ok: boolean; error?: 'invalid' | 'locked' }> => {
    const LOCK_KEY = 'procashier_pin_lock';
    const FAIL_KEY = 'procashier_pin_fails';

    try {
      const lock = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
      if (lock && Number(lock.until) > Date.now()) return { ok: false, error: 'locked' };
    } catch { /* ignore malformed lock */ }

    const users = state.users.filter(u => u.active && !u.hidden && u.pinHash && u.pinSalt);
    for (const u of users) {
      if (await verifySecret(pin, u.pinHash as string, u.pinSalt as string)) {
        localStorage.removeItem(FAIL_KEY);
        localStorage.removeItem(LOCK_KEY);
        const now = Date.now();
        const userWithLogin: User = { ...u, lastLogin: now };
        try {
            Object.keys(sessionStorage).forEach(k => {
                if (k.startsWith('admin_branch_selected')) {
                    sessionStorage.removeItem(k);
                }
            });
        } catch (e) {}
        setState(prev => ({
            ...prev,
            users: prev.users.map(usr => usr.id === userWithLogin.id ? userWithLogin : usr)
        }));
        setCurrentUser(userWithLogin);
        addAuditLog('Login', `User ${u.username} logged in (PIN)`, `تسجيل دخول سريع بالرمز (PIN) للمستخدم "${u.username}"`);
        return { ok: true };
      }
    }

    const fails = Number(localStorage.getItem(FAIL_KEY) || '0') + 1;
    if (fails >= 5) {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ until: Date.now() + 60_000 }));
      localStorage.setItem(FAIL_KEY, '0');
      addAuditLog('Security', 'PIN lockout triggered', 'قفل أمني مؤقت لرمز الدخول السريع (PIN) لمدة 60 ثانية بعد 5 محاولات خاطئة');
      return { ok: false, error: 'locked' };
    }
    localStorage.setItem(FAIL_KEY, String(fails));
    return { ok: false, error: 'invalid' };
  };

  /** يتحقق من كلمة مرور المستخدم الحالي (يدعم الحسابات القديمة قبل الترحيل) */
  const checkOwnPassword = async (currentPassword: string): Promise<boolean> => {
    if (!currentUser) return false;
    const stored = state.users.find(u => u.id === currentUser.id) || currentUser;
    const pass = currentPassword.trim();
    if (stored.passwordHash && stored.passwordSalt) {
        return verifySecret(pass, stored.passwordHash, stored.passwordSalt);
    }
    return typeof stored.password === 'string' && stored.password === pass;
  };

  const changeOwnPassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser) return { ok: false, error: 'no_user' };
    if (newPassword.trim().length < 6) return { ok: false, error: 'password_short' };
    if (!(await checkOwnPassword(currentPassword))) return { ok: false, error: 'wrong_password' };

    const stored = state.users.find(u => u.id === currentUser.id) || currentUser;
    const record = await makePasswordRecord(newPassword.trim());
    const next: User = { ...stored, ...record, password: undefined, mustChangePassword: false };

    setState(prev => ({ ...prev, users: prev.users.map(u => u.id === next.id ? next : u) }));
    setCurrentUser(next);
    addAuditLog('Security', `Password changed for ${next.username}`, `تم تغيير كلمة المرور بنجاح للمستخدم "${next.username}"`);
    return { ok: true };
  };

  const setQuickPin = async (currentPassword: string, pin: string | null) => {
    if (!currentUser) return { ok: false, error: 'no_user' };
    if (!(await checkOwnPassword(currentPassword))) return { ok: false, error: 'wrong_password' };

    const stored = state.users.find(u => u.id === currentUser.id) || currentUser;
    let next: User;
    if (pin == null || pin === '') {
        next = { ...stored, pinHash: undefined, pinSalt: undefined };
    } else {
        if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: 'pin_invalid' };
        const record = await makePinRecord(pin);
        next = { ...stored, ...record };
    }

    setState(prev => ({ ...prev, users: prev.users.map(u => u.id === next.id ? next : u) }));
    setCurrentUser(next);
    addAuditLog('Security', pin ? `Quick PIN set for ${next.username}` : `Quick PIN cleared for ${next.username}`, pin ? `تعيين رمز دخول سريع (PIN) جديد للمستخدم "${next.username}"` : `إلغاء وحذف رمز الدخول السريع للمستخدم "${next.username}"`);
    return { ok: true };
  };

  const logout = () => {
      addAuditLog('Logout', `User ${currentUser?.username} logged out`, `تسجيل خروج المستخدم "${currentUser?.username || 'غير محدد'}" من النظام`);
      try {
          Object.keys(sessionStorage).forEach(k => {
              if (k.startsWith('admin_branch_selected')) {
                  sessionStorage.removeItem(k);
              }
          });
      } catch (e) {}
      setCurrentUser(null);
  };

  const t = (key: string) => {
    const dictionaries = translations as Record<string, Record<string, string>>;
    return dictionaries[language]?.[key] ?? dictionaries.en?.[key] ?? '';
  };

  const locale = language === 'ar' ? 'ar-u-nu-latn' : 'en-US';

  const formatNumber = (n: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(locale, options).format(n);
  };

  const formatDate = (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString(locale, options);
  };

  const formatTime = (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'number' ? new Date(date) : date;
    const is24h = state?.settings?.timeFormat === '24h';
    return d.toLocaleTimeString(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !is24h,
      ...options
    });
  };

  const formatDateTime = (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'number' ? new Date(date) : date;
    const is24h = state?.settings?.timeFormat === '24h';
    const datePart = d.toLocaleDateString(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const timePart = d.toLocaleTimeString(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !is24h,
      ...options
    });
    return `${datePart} ${timePart}`.replace(/^[,\u060C\s]+/, '').trim();
  };

  // Logic to simulate persistence would go here in d real app
  useEffect(() => {
    document.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => {
    // تفعيل الزجاج والنيون تلقائياً عند تفعيل الوضع الداكن
    setGldssNeon(theme === 'dark');
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('glassNeon', glassNeon ? 'true' : 'false');
  }, [glassNeon]);
  useEffect(() => {
    localStorage.setItem('experimentalMode', experimentalMode ? 'true' : 'false');
  }, [experimentalMode]);

  // حفظ واسترجاع المستخدم الحالي ومزامنته دائماً مع بيانات المستخدمين في النظام
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pos_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('pos_current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const matched = state.users.find(u => u.id === currentUser.id || u.username === currentUser.username);
      if (matched && (matched.name !== currentUser.name || matched.username !== currentUser.username || matched.role !== currentUser.role || matched.locationId !== currentUser.locationId)) {
        setCurrentUser(matched);
      }
    }
  }, [state.users]);

  useEffect(() => {
    // توحيد الألوان وحصرها في 3 ثيمات فاخرة: زمردي أخضر (forest - الافتراضي)، ذهبي فاخر (luxury)، أزرق محيطي (ocean)
    let normalizedTheme = state.settings.themeColor || 'forest';
    if (normalizedTheme === 'blue' || normalizedTheme === 'ocean') {
      normalizedTheme = 'ocean';
    } else if (normalizedTheme === 'luxury') {
      normalizedTheme = 'luxury';
    } else {
      normalizedTheme = 'forest'; // الافتراضي: الثيم الأخضر الزمردي
    }
    const classList = document.documentElement.classList;
    // إزالة أي ثيمات قديمة
    classList.remove('theme-ocean', 'theme-sunset', 'theme-forest', 'theme-midnight', 'theme-luxury');
    classList.add(`theme-${normalizedTheme}`);
    
    // Apply Touch Mode
    if (state.settings.touchMode) {
      document.documentElement.classList.add('touch-mode');
    } else {
      document.documentElement.classList.remove('touch-mode');
    }
  }, [state.settings.themeColor, state.settings.touchMode]);

  const addItem = (item: Item) => {
    setState(prev => ({ ...prev, items: [...prev.items, item] }));
    const itemName = item.nameAr || item.nameEn || 'صنف';
    addAuditLog('Inventory', `Added item: ${item.nameEn || item.nameAr}`, `إضافة صنف جديد للمخزون: "${itemName}" (السعر: ${item.price} ج.م، التكلفة: ${item.costPrice || 0} ج.م، المخزون الأولي: ${item.stock || 0})`);
  };

  const updateItem = (item: Item) => {
    setState(prev => ({ ...prev, items: prev.items.map(i => i.id === item.id ? item : i) }));
    const itemName = item.nameAr || item.nameEn || 'صنف';
    addAuditLog('Inventory', `Updated item: ${item.nameEn || item.nameAr}`, `تعديل بيانات الصنف: "${itemName}" (السعر: ${item.price} ج.م، المخزون الحالي: ${item.stock})`);
  };

  const deleteItem = (id: string) => {
    const existing = state.items.find(i => i.id === id);
    const itemName = existing ? (existing.nameAr || existing.nameEn) : id;
    setState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
    addAuditLog('Inventory', `Deleted item: ${id}`, `حذف الصنف من المخزون: "${itemName}" (معرف: #${id})`);
  };

  const addCategory = (category: Category) => {
    setState(prev => ({ ...prev, categories: [...prev.categories, category] }));
  };

  const updateCategory = (category: Category) => {
    setState(prev => ({ ...prev, categories: prev.categories.map(c => c.id === category.id ? category : c) }));
  };

  const deleteCategory = (id: string) => {
    setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
  };

  const addLocation = (location: Location) => {
    setState(prev => ({ ...prev, locations: [...prev.locations, location] }));
    void pushBranchToSupabase(location, state.settings.supabaseUrl, state.settings.supabaseKey);
  };

  const updateLocation = (location: Location) => {
    setState(prev => ({ ...prev, locations: prev.locations.map(l => l.id === location.id ? location : l) }));
    void pushBranchToSupabase(location, state.settings.supabaseUrl, state.settings.supabaseKey);
  };

  const deleteLocation = (id: string) => {
    setState(prev => {
      const remaining = prev.locations.filter(l => l.id !== id);
      const newLocations = remaining.length > 0 ? remaining : initialLocations;
      const newCurrent = prev.settings.currentLocationId === id ? (newLocations[0]?.id || '1') : prev.settings.currentLocationId;
      return {
        ...prev,
        locations: newLocations,
        settings: {
          ...prev.settings,
          currentLocationId: newCurrent,
        }
      };
    });
    void deleteBranchFromSupabase(id, state.settings.supabaseUrl, state.settings.supabaseKey);
  };

  const addSupplier = (supplier: Supplier) => {
    setState(prev => ({ ...prev, suppliers: [...prev.suppliers, supplier] }));
  };

  const addPurchaseOrder = (po: PurchaseOrder) => {
    setState(prev => ({ ...prev, purchaseOrders: [...prev.purchaseOrders, po] }));
    // Update inventory if received
    if (po.status === 'received') {
      const updatedItems = state.items.map(item => {
        const poItem = po.items.find(pi => pi.itemId === item.id);
        if (poItem) {
          return { ...item, quantity: item.quantity + poItem.quantity };
        }
        return item;
      });
      setState(prev => ({ ...prev, items: updatedItems }));
    }
  };

  const updateSupplier = (supplier: Supplier) => {
    setState(prev => ({ ...prev, suppliers: prev.suppliers.map(s => s.id === supplier.id ? supplier : s) }));
  };

  const deleteSupplier = (id: string) => {
    setState(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== id) }));
  };

  const updatePurchaseOrder = (po: PurchaseOrder) => {
    setState(prev => {
      const existing = prev.purchaseOrders.find(p => p.id === po.id);
      const wasReceived = existing?.status === 'received';
      const isReceived = po.status === 'received';
      let items = prev.items;
      let inventoryHistory = prev.inventoryHistory;
      // عند الاستلام: أضف الكميات للمخزون + سجل حركة
      if (!wasReceived && isReceived) {
        items = items.map(item => {
          const poItem = po.items.find(pi => pi.itemId === item.id);
          if (poItem) {
            const qty = poItem.quantity;
            const unitPrice = poItem.cost;
            inventoryHistory = [...inventoryHistory, {
              id: crypto.randomUUID(),
              itemId: item.id,
              type: 'purchase' as const,
              quantityChange: qty,
              reason: `أمر شراء ${po.id}`,
              timestamp: Date.now(),
              userId: currentUser?.username || '',
              locationId: po.locationId,
              unitPrice,
              totalValue: qty * unitPrice,
              purchaseOrderId: po.id,
            }];
            return { ...item, quantity: item.quantity + qty };
          }
          return item;
        });
      }
      return {
        ...prev,
        items,
        inventoryHistory,
        purchaseOrders: prev.purchaseOrders.map(p => p.id === po.id ? po : p),
      };
    });
  };

  const addInventoryHistory = (entry: Omit<InventoryHistory, 'id' | 'timestamp' | 'userId'>) => {
    setState(prev => ({
      ...prev,
      inventoryHistory: [...prev.inventoryHistory, {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        userId: currentUser?.username || '',
      }],
    }));
  };

  const addInvoice = (invoiceData: Omit<Invoice, 'id'>) => {
    const newId = state.invoices.length + 1;
    const newInvoice: Invoice = { 
      ...invoiceData, 
      id: newId,
      // هوية ثابتة (UUID) لا تعتمد على الترتيب حتى لا تتطابق فاتورتان من جهازين
      uid: invoiceData.uid || newInvoiceUid(),
      locationId: state.settings.currentLocationId,
      status: invoiceData.status || 'paid',
      createdBy: currentUser?.username || 'Unknown',
      // هوية الطباعة التاريخية: توقيع الإيصال وقت البيع (يبقى محلياً ولا يُزامَن)
      printSnapshot: buildPrintIdentity(state.settings)
    };
    
    // Update inventory and customer loyalty
    // ملاحظة: تُحسب داخل setState على prev لعدم محو أي تحديث سابق في نفس الدفّة
    // (مثل العميل الذي أنشأه addCustomer قبل استدعائنا هنا مباشرة)
    setState(prev => {
      const updatedItems = prev.items.map(item => {
        const invoiceItem = invoiceData.items.find(ii => ii.itemId === item.id);
        if (invoiceItem && item.trackStock) {
          return { ...item, quantity: item.quantity - invoiceItem.quantity };
        }
        return item;
      });

      // سجل حركة المخزون (الجرد): قيد بيع سالب لكل صنف مُتتبَّع تُخصم كميته
      // بمعرّف حتمي sale:{uid}:{itemId} لمنع التكرار عند أي إعادة استدعاء
      const historyIds = new Set(prev.inventoryHistory.map(h => h.id));
      let inventoryHistory = prev.inventoryHistory;
      const saleLoc = state.settings.currentLocationId || '1';
      for (const item of prev.items) {
        const invoiceItem = invoiceData.items.find(ii => ii.itemId === item.id);
        if (!invoiceItem || !item.trackStock || !invoiceItem.quantity || invoiceItem.quantity <= 0) continue;
        const hid = `sale:${newInvoice.uid}:${item.id}`;
        if (historyIds.has(hid)) continue;
        historyIds.add(hid);
        inventoryHistory = [...inventoryHistory, {
          id: hid,
          itemId: item.id,
          variantId: invoiceItem.variantId,
          type: 'sale' as const,
          quantityChange: -invoiceItem.quantity,
          reason: `فاتورة #${newInvoice.id}`,
          timestamp: newInvoice.timestamp || Date.now(),
          userId: newInvoice.createdBy || currentUser?.username || '',
          locationId: saleLoc,
          unitPrice: invoiceItem.price,
          totalValue: invoiceItem.price * invoiceItem.quantity,
          invoiceId: newInvoice.uid,
        }];
      }

      const updatedCustomers = prev.customers.map(c => {
        if (c.id === invoiceData.customerId) {
          const newTotalSpent = c.totalSpent + invoiceData.total;

          const creditPart = round2(
            (invoiceData.paymentParts || [])
              .filter((p: any) => p.method === 'credit')
              .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
          ) || (invoiceData.paymentMethod === 'credit' ? invoiceData.total : 0);
          const newBalance = round2((c.balance || 0) + creditPart);

          return {
            ...c,
            totalSpent: newTotalSpent,
            lastVisit: new Date().toISOString(),
            balance: newBalance,
            loyaltyPoints: 0
          };
        }
        return c;
      });

      // احتساب وتسجيل عمولة الموظف تلقائياً عن الفاتورة (نسبة مئوية أو مبلغ ثابت)
      let nextStaffPayments = prev.staffPayments || [];
      if (newInvoice.staffId) {
        const staffMember = prev.staff.find(s => s.id === newInvoice.staffId);
        if (staffMember && Number(staffMember.commissionValue) > 0 && staffMember.commissionType !== 'none' && staffMember.commissionType !== 'daily') {
          const val = Number(staffMember.commissionValue);
          const commissionAmt = staffMember.commissionType === 'fixed'
            ? round2(val)
            : round2((Number(newInvoice.total || 0) * val) / 100);

          if (commissionAmt > 0) {
            const commPayment: StaffPayment = {
              id: crypto.randomUUID(),
              staffId: staffMember.id,
              staffName: staffMember.name,
              amount: commissionAmt,
              type: 'commission',
              method: 'cash',
              notes: `عمولة تلقائية عن فاتورة #${newInvoice.id} (${staffMember.commissionType === 'fixed' ? `${val} ج.م ثابت` : `${val}%`})`,
              date: toIsoDate(new Date(newInvoice.timestamp || Date.now())),
              timestamp: newInvoice.timestamp || Date.now(),
              createdBy: newInvoice.createdBy || 'System',
              invoiceUid: newInvoice.uid,
              locationId: newInvoice.locationId || state.settings.currentLocationId || '1'
            };
            nextStaffPayments = [commPayment, ...nextStaffPayments];
          }
        }
      }

      return {
        ...prev,
        invoices: [newInvoice, ...prev.invoices],
        items: updatedItems,
        customers: updatedCustomers,
        inventoryHistory,
        staffPayments: nextStaffPayments
      };
    });
    const cName = invoiceData.customerName || state.customers.find(c => c.id === invoiceData.customerId)?.name;
    const cText = cName ? ` — العميل: ${cName}` : '';
    const pMethod = invoiceData.paymentMethod === 'cash' ? 'نقداً' : invoiceData.paymentMethod === 'card' ? 'بطاقة/فيزا' : invoiceData.paymentMethod === 'credit' ? 'آجل' : (invoiceData.paymentMethod || 'نقداً');
    addAuditLog(
      'Invoice',
      `Created invoice #${newId} for ${invoiceData.total} EGP`,
      `إنشاء فاتورة مبيعات جديدة رقم #${newId} بقيمة ${invoiceData.total} ج.م (عدد الأصناف: ${invoiceData.items?.length || 0}) — طريقة الدفع: ${pMethod}${cText}`
    );

    // مزامنة الفاتورة مع السيرفر المركزي (تخزين + إيميل تلقائي لصاحب المشروع)
    try {
      const targetServerUrl = state.settings.serverUrl || 'http://127.0.0.1:8087';
      const customer = state.customers.find(c => c.id === invoiceData.customerId);
      enqueueInvoice(buildInvoicePayload(newInvoice, customer, state.settings));
      void flushQueue({ url: targetServerUrl, apiKey: state.settings.serverApiKey || '' });
      // مزامنة فورية مع Supabase السحابي لحظياً
      void pushInvoiceToSupabase(newInvoice, state.settings.supabaseUrl, state.settings.supabaseKey);
    } catch (e) {
      console.error('sync enqueue failed', e);
    }
  };

  const updateInvoice = (invoice: Invoice) => {
    setState(prev => ({
      ...prev,
      invoices: prev.invoices.map(i => i.id === invoice.id ? invoice : i)
    }));
    addAuditLog(
      'Invoice',
      `Updated invoice #${invoice.id}`,
      `تعديل بيانات الفاتورة رقم #${invoice.id} بقيمة ${invoice.total} ج.م وحفظ التغييرات`
    );
  };

  const voidInvoice = (id: number): boolean => {
    const target = state.invoices.find(i => i.id === id);
    if (!target) return false;

    setState(prev => {
      // 1) Restore inventory stock
      const updatedItems = prev.items.map(item => {
        const invItem = target.items.find(ii => ii.itemId === item.id);
        if (invItem && item.trackStock) {
          return { ...item, quantity: (Number(item.quantity) || 0) + (Number(invItem.quantity) || 0) };
        }
        return item;
      });

      // 2) Remove sales inventory history
      const updatedHistory = prev.inventoryHistory.filter(h => h.invoiceId !== target.uid && h.id !== `sale:${target.uid}`);

      // 3) Restore customer balance & loyalty
      const updatedCustomers = prev.customers.map(c => {
        if (c.id === target.customerId) {
          const creditPart = round2(
            (target.paymentParts || [])
              .filter((p: any) => p.method === 'credit')
              .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
          );
          const earnedPts = Math.floor((target.total || 0) * (prev.settings.loyaltyPointsAward || 0));
          return {
            ...c,
            totalSpent: Math.max(0, (Number(c.totalSpent) || 0) - (Number(target.total) || 0)),
            balance: Math.max(0, (Number(c.balance) || 0) - creditPart),
            loyaltyPoints: Math.max(0, (Number(c.loyaltyPoints) || 0) - earnedPts)
          };
        }
        return c;
      });

      // 4) Remove staff commission payments linked to this invoice
      const updatedStaffPayments = (prev.staffPayments || []).filter(sp => sp.invoiceUid !== target.uid);

      // 5) Remove invoice
      return {
        ...prev,
        items: updatedItems,
        inventoryHistory: updatedHistory,
        customers: updatedCustomers,
        staffPayments: updatedStaffPayments,
        invoices: prev.invoices.filter(i => i.id !== id)
      };
    });

    addAuditLog(
      'Invoice',
      `Voided invoice #${id}`,
      `إلغاء والتراجع عن فاتورة المبيعات #${id} واستعادة الكميات للسلة والمخزون`
    );
    return true;
  };

  // ============================================================
  // المرتجعات: تُطبَّق الآثار (مخزون/نقاط/عمولة) مرة واحدة فقط
  // عند الاعتماد — سجل pending لا يلمس المخزون ولا يصرف مبلغاً.
  // ============================================================
  const applyReturnToState = (prev: AppState, source: ReturnRecord, index: number): AppState => {
    const base = index >= 0 && prev.returns[index] ? prev.returns[index] : source;
    const rec: ReturnRecord = { ...base, status: 'approved' };
    const invoice = prev.invoices.find(
      i => (rec.invoiceUid && i.uid === rec.invoiceUid) || String(i.id) === String(rec.invoiceId)
    );

    // 1) إعادة للمخزون وفق لقطة returnable/trackStock/type وقت البيع (الخدمات لا تُعاد)
    const restock = new Map<string, number>();
    for (const it of rec.items || []) {
      if (it.restocked || !it.itemId) continue;
      if (!it.returnable || !it.trackStock || it.type === 'service') continue;
      restock.set(it.itemId, (restock.get(it.itemId) || 0) + (Number(it.quantity) || 0));
    }
    const existingIds = new Set(prev.items.map(i => i.id));
    const items = prev.items.map(i =>
      restock.has(i.id) ? { ...i, quantity: (Number(i.quantity) || 0) + (restock.get(i.id) || 0) } : i
    );
    const history: InventoryHistory[] = [...prev.inventoryHistory];
    const historyIds = new Set(prev.inventoryHistory.map(h => h.id));
    for (const [itemId, qty] of restock) {
      if (!existingIds.has(itemId)) continue;
      const hid = `ret:${rec.uid}:${itemId}`;
      if (historyIds.has(hid)) continue;
      history.push({
        id: hid,
        itemId,
        type: 'refund',
        quantityChange: qty,
        reason: `مرتجع فاتورة #${rec.invoiceId}`,
        timestamp: rec.timestamp || Date.now(),
        userId: rec.staffName || rec.createdBy || 'system',
        locationId: rec.locationId || prev.settings.currentLocationId || '1',
      });
    }
    const stdmpedItems = (rec.items || []).map(it =>
      !it.restocked && restock.has(it.itemId) && existingIds.has(it.itemId) ? { ...it, restocked: true } : it
    );

    // 2) عكس الولاء: خصم النقاط + خصم الإنفاق + إعادة تقييم المستوى
    let customers = prev.customers;
    if (rec.customerId && Number(rec.refundAmount) > 0) {
      const reversed = Number(rec.pointsReversed) || 0;
      customers = prev.customers.map(c => {
        if (c.id !== rec.customerId) return c;
        const newTotalSpent = Math.max(0, (Number(c.totalSpent) || 0) - (Number(rec.refundAmount) || 0));
        return {
          ...c,
          totalSpent: newTotalSpent,
          loyaltyPoints: Math.max(0, (Number(c.loyaltyPoints) || 0) - reversed),
        };
      });
    }

    // 3) عكس العمولات المرتبطة بالفاتورة (بنِسبتها، ومحدود بما تبقى غير معكوس)
    let staffPayments = prev.staffPayments;
    let commissionApplied = 0;
    if (invoice) {
      const plan = commissionReversalPlan(invoice, rec.refundAmount, prev.staffPayments);
      const reversdls: StaffPayment[] = [];
      const nextPdyments = prev.staffPayments.map(p => {
        const line = plan.find(x => x.paymentId === p.id);
        if (!line) return p;
        const revId = `${rec.uid}:${p.id}`;
        if (prev.staffPayments.some(x => x.id === revId)) return p;
        reversdls.push({
          id: revId,
          staffId: p.staffId,
          staffName: p.staffName,
          amount: round2(line.amount),
          type: 'commission_reversal',
          method: p.method,
          notes: `عكس عمولة مرتجع فاتورة #${rec.invoiceId}`,
          date: rec.date,
          timestamp: rec.timestamp || Date.now(),
          createdBy: rec.staffName || rec.createdBy || 'system',
          invoiceUid: rec.invoiceUid,
          reversedBy: rec.uid,
        });
        commissionApplied = round2(commissionApplied + line.amount);
        return {
          ...p,
          reversedAmount: round2((Number(p.reversedAmount) || 0) + line.amount),
          reversedBy: rec.uid,
        };
      });
      staffPayments = reversdls.length ? [...nextPdyments, ...reversdls] : nextPdyments;
    }

    const record: ReturnRecord = {
      ...rec,
      items: stdmpedItems,
      commissionReversed: Number(rec.commissionReversed) > 0 ? rec.commissionReversed : commissionApplied,
    };
    const returns = index >= 0
      ? prev.returns.map((r, i) => (i === index ? record : r))
      : [...prev.returns, record];
    return { ...prev, items, inventoryHistory: history, customers, staffPayments, returns };
  };

  /** اعتماد سجل معلّق بعد رد السيرفر 200 — يطبّق الآثار مرة واحدة */
  const promoteReturn = (prev: AppState, uid: string): AppState => {
    const index = prev.returns.findIndex(r => r.uid === uid);
    if (index < 0) return prev;
    const rec = prev.returns[index];
    if (rec.status !== 'pending') return prev;
    return applyReturnToState(prev, rec, index);
  };

  /** رفض نهائي من السيرفر (400/404/409) — بلا آثار ودون إعادة محاولة */
  const rejectReturn = (prev: AppState, uid: string, detail: string): AppState => {
    const index = prev.returns.findIndex(r => r.uid === uid);
    if (index < 0 || prev.returns[index].status !== 'pending') return prev;
    return {
      ...prev,
      returns: prev.returns.map((r, i) => (i === index ? { ...r, status: 'rejected', error: detail } : r)),
    };
  };

  const hdndleReturnFlush = (res?: ReturnFlushResult) => {
    if (!res || (!res.approved?.length && !res.rejected?.length)) return;
    setState(prev => {
      let next = prev;
      for (const uid of res.approved) next = promoteReturn(next, uid);
      for (const r of res.rejected) next = rejectReturn(next, r.uid, r.detail);
      return next;
    });
    for (const r of res.rejected || []) {
      addToast(`${t('return_rejected')}: ${r.detail}`, 'error');
    }
  };

  /**
   * إنشاء مرتجع (جزئي/كامل) بعد تحقّق كامل:
   * الكمية ≤ المتبقي، المبلغ من سعر/خصم/ضريبة وقت البيع،
   * مجموع الأجزاء = المسترد، ولا يتجاوز كل جزء ما دُفع فعلياً.
   */
  const createReturn = (input: {
    invoice: Invoice;
    selections: { itemId: string; quantity: number }[];
    refundParts: PaymentPart[];
    reason: string;
    notes?: string;
  }): { ok: boolean; error?: string; record?: ReturnRecord } => {
    const invoice = input.invoice;
    if (!invoice) return { ok: false, error: 'return_no_invoice' };

    const validation = validateReturn({
      invoice,
      returns: state.returns,
      selections: input.selections,
      refundParts: input.refundParts,
      catalog: state.items,
    });
    if (!validation.ok) return { ok: false, error: validation.error };

    const now = Date.now();
    const uid = newReturnUid();
    const plan = commissionReversalPlan(invoice, validation.refundAmount, state.staffPayments);
    const refundParts = (input.refundParts || [])
      .map(p => ({ method: p.method, amount: round2(Number(p.amount) || 0) }))
      .filter(p => PAYMENT_KINDS.includes(p.method) && p.amount > 0) as PaymentPart[];
    const record: ReturnRecord = {
      uid,
      id: state.returns.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1,
      invoiceUid: invoice.uid || String(invoice.id),
      invoiceId: invoice.id,
      items: validation.items,
      refundAmount: validation.refundAmount,
      refundParts,
      cashRefund: validation.cashRefund,
      type: validation.type,
      // مع سيرفر مُهيّأ: معلّق حتى يرد السيرفر 200؛ بدونه: تأكيد محلي فوري
      status: 'approved', // اعتماد فوري لكافة المرتجعات دون تعليق
      reason: input.reason || '',
      notes: input.notes,
      staffId: currentUser?.username || '',
      staffName: currentUser?.name || currentUser?.username || '',
      createdBy: currentUser?.username || 'Unknown',
      customerId: invoice.customerId || 0,
      customerName: invoice.customerName || '',
      locationId: state.settings.currentLocationId,
      pointsReversed: reversedPointsFor(
        validation.refundAmount,
        !!state.settings.loyaltyEnabled,
        state.settings.loyaltyPointsAward
      ),
      commissionReversed: round2(plan.reduce((d, l) => d + l.amount, 0)),
      date: toIsoDate(null, now),
      timestamp: now,
      createdAt: new Date(now).toISOString(),
      updatedAt: now,
      serverKey: uid,
      deleted: 0,
    };

    // تطبيق آثار المرتجع المعتمد فورياً في حالة النظام
    setState(prev => applyReturnToState(prev, record, -1));

    if (state.settings.serverUrl) {
      try {
        enqueueReturn(buildReturnPayload(record, invoice, state.settings));
        void flushReturnQueue({
          url: state.settings.serverUrl || 'http://127.0.0.1:8087',
          apiKey: state.settings.serverApiKey || '',
        }).then(hdndleReturnFlush);
      } catch (e) {
        console.error('return sync enqueue failed', e);
      }
    }

    addAuditLog(
      'Return',
      `Return ${record.type} on invoice #${invoice.id}: ${record.refundAmount} EGP (${record.status})`,
      `مرتجع مالي ${record.type === 'full' ? 'كامل' : 'جزئي'} للفاتورة #${invoice.id} بقيمة ${record.refundAmount} ج.م — السبب: "${record.reason || 'بدون سبب'}"`
    );
    return { ok: true, record };
  };
  /**
   * إلغاء مرتجع معتمد وإعادة الأصناف إلى فاتورة العميل:
   * - يتم رفع الإيرادات مجدداً تلقائياً (لأن المرتجع لم يعد معتمداً)
   * - إعادة المنتجات المسترجعة إلى العميل وخصمها من المخزون
   * - استعادة نقاط الولاء والإنفاق للعميل
   * - استعادة عمولات الموظف
   * - تسجيل العمليتين في سجل النظام (Audit Log)
   */
  const cancelReturn = (returnUid: string): { ok: boolean; error?: string } => {
    const returnIndex = state.returns.findIndex(r => r.uid === returnUid || String(r.id) === String(returnUid));
    if (returnIndex < 0) return { ok: false, error: 'return_not_found' };
    const rec = state.returns[returnIndex];
    if (rec.status === 'cancelled') return { ok: false, error: 'return_already_cancelled' };

    setState(prev => {
      const idx = prev.returns.findIndex(r => r.uid === rec.uid);
      if (idx < 0) return prev;
      const target = prev.returns[idx];

      // 1) إعادة المنتجات المرتجعة للعميل (خصمها من المخزون بعد أن كانت قد أُعيدت إليه)
      const restockToRevert = new Map<string, number>();
      for (const it of target.items || []) {
        if (it.restocked && it.itemId && it.returnable && it.trackStock && it.type !== 'service') {
          restockToRevert.set(it.itemId, (restockToRevert.get(it.itemId) || 0) + (Number(it.quantity) || 0));
        }
      }

      const items = prev.items.map(i =>
        restockToRevert.has(i.id)
          ? { ...i, quantity: Math.max(0, (Number(i.quantity) || 0) - (restockToRevert.get(i.id) || 0)) }
          : i
      );

      const history = [...prev.inventoryHistory];
      for (const [itemId, qty] of restockToRevert) {
        history.push({
          id: `unret:${target.uid}:${itemId}:${Date.now()}`,
          itemId,
          type: 'adjustment',
          quantityChange: -qty,
          reason: `إلغاء مرتجع وإعادة الصنف لفاتورة العميل #${target.invoiceId}`,
          timestamp: Date.now(),
          userId: currentUser?.name || currentUser?.username || 'system',
          locationId: target.locationId || prev.settings.currentLocationId || '1',
        });
      }

      // 2) استعادة نقاط الولاء والإنفاق للعميل
      let customers = prev.customers;
      if (target.customerId && Number(target.refundAmount) > 0) {
        const reversed = Number(target.pointsReversed) || 0;
        customers = prev.customers.map(c => {
          if (c.id !== target.customerId) return c;
          return {
            ...c,
            totalSpent: (Number(c.totalSpent) || 0) + (Number(target.refundAmount) || 0),
            loyaltyPoints: (Number(c.loyaltyPoints) || 0) + reversed,
          };
        });
      }

      // 3) استعادة العمولات للموظف (حذف عكس العمولة)
      let staffPayments = prev.staffPayments.filter(p => p.reversedBy !== target.uid && !p.id.startsWith(`${target.uid}:`));
      staffPayments = staffPayments.map(p => {
        if (p.reversedBy === target.uid || (p.reversedAmount && p.reversedAmount > 0)) {
          return {
            ...p,
            reversedAmount: 0,
            reversedBy: undefined,
          };
        }
        return p;
      });

      // 4) تحديث حالة المرتجع إلى 'cancelled'
      const updatedReturn: ReturnRecord = {
        ...target,
        status: 'cancelled',
        updatedAt: Date.now(),
      };

      const returns = prev.returns.map((r, i) => (i === idx ? updatedReturn : r));

      return {
        ...prev,
        items,
        inventoryHistory: history,
        customers,
        staffPayments,
        returns,
      };
    });

    // 5) تسجيل العمليتين في سجل النظام
    // العملية الأولى: إلغاء المرتجع المالي ورفع الإيرادات مجدداً بقيمة المرتجع
    addAuditLog(
      'Return',
      `Cancel Return #${rec.id} for invoice #${rec.invoiceId}: +${rec.refundAmount} EGP restored to revenue`,
      `إلغاء المرتجع المالي رقم #${rec.id} ورفع الإيرادات مجدداً بمقدار ${rec.refundAmount} ج.م للفاتورة #${rec.invoiceId}`
    );

    // العملية الثانية: إعادة إضافة المنتج أو الخدمة مجدداً لفاتورة العميل
    const itemsList = (rec.items || []).map(it => `${it.name} (${it.quantity})`).join('، ');
    addAuditLog(
      'Invoice',
      `Restored returned items to customer invoice #${rec.invoiceId}`,
      `إعادة الأصناف والخدمات (${itemsList || 'بنود الفاتورة'}) مجدداً إلى فاتورة العميل #${rec.invoiceId} (${rec.customerName || 'عميل'})`
    );

    return { ok: true };
  };


  const holdInvoice = (invoice: Omit<Invoice, 'id'>) => {
    const newId = state.heldInvoices.length + 1;
    const heldInvoice: Invoice = {
      ...invoice,
      id: newId,
      uid: invoice.uid || newInvoiceUid(),
      locationId: state.settings.currentLocationId,
      status: 'held',
      createdBy: currentUser?.username || 'Unknown'
    };
    setState(prev => ({
      ...prev,
      heldInvoices: [...prev.heldInvoices, heldInvoice]
    }));
    addAuditLog(
      'Invoice',
      `Held invoice #${newId}`,
      `تعليق فاتورة مبيعات برقم #${newId} بقيمة ${heldInvoice.total} ج.م في قائمة المعلقات`
    );
  };

  const restoreInvoice = (id: number) => {
    const heldInvoice = state.heldInvoices.find(h => h.id === id);
    if (heldInvoice) {
      setState(prev => ({
        ...prev,
        heldInvoices: prev.heldInvoices.filter(h => h.id !== id)
      }));
    }
    addAuditLog(
      'Invoice',
      `Restored held invoice #${id}`,
      `استرجاع الفاتورة المعلقة رقم #${id} لاستكمال عملية البيع والدفع`
    );
  };

  const deleteHeldInvoice = (id: number) => {
    setState(prev => ({
      ...prev,
      heldInvoices: prev.heldInvoices.filter(h => h.id !== id)
    }));
    addAuditLog(
      'Invoice',
      `Deleted held invoice #${id}`,
      `حذف الفاتورة المعلقة رقم #${id} نهائياً من قائمة المعلقات`
    );
  };

  const addCustomer = (customerDdtd: Omit<Customer, 'id' | 'totalSpent' | 'lastVisit' | 'loyaltyPoints' | 'tier'>) => {
    // منع التكرار: لو نفس الرقم مسجَّل مسبقاً نعيد المعرّف القديم (ونحدّث الاسم إن تغيّر)
    const phone = (customerDdtd as any).phone || '';
    const existing = phone ? state.customers.find(c => c.phone === phone) : undefined;
    if (existing) {
      if (customerDdtd.name && customerDdtd.name !== existing.name) {
        const updated: Customer = { ...existing, name: customerDdtd.name, lastVisit: new Date().toISOString() };
        setState(prev => ({
          ...prev,
          customers: prev.customers.map(c => c.id === existing.id ? updated : c)
        }));
        pushCustomer(serverConfigRef.current, buildCustomerPayload(updated));
      }
      return existing.id;
    }
    const newId = state.customers.length + 1;
    const newCustomer: Customer = {
      ...customerDdtd,
      id: newId,
      totalSpent: 0,
      lastVisit: new Date().toISOString(),
      loyaltyPoints: 0
    };
    setState(prev => ({
      ...prev,
      customers: [...prev.customers, newCustomer]
    }));
    addAuditLog(
      'Customer',
      `Added customer: ${customerDdtd.name}`,
      `إضافة عميل جديد: "${customerDdtd.name}" (الهاتف: ${phone || 'غير مسجل'})`
    );
    pushCustomer(serverConfigRef.current, buildCustomerPayload(newCustomer));
    void pushCustomerToSupabase(newCustomer, state.settings.supabaseUrl, state.settings.supabaseKey);
    return newId;
  };

  const updateCustomer = (customer: Customer) => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.map(c => c.id === customer.id ? customer : c)
    }));
    addAuditLog(
      'Customer',
      `Updated customer: ${customer.name}`,
      `تحديث وتعديل بيانات العميل: "${customer.name}" (الهاتف: ${customer.phone || '—'})`
    );
    pushCustomer(serverConfigRef.current, buildCustomerPayload(customer));
    void pushCustomerToSupabase(customer, state.settings.supabaseUrl, state.settings.supabaseKey);
  };

  const deleteCustomer = (id: number) => {
    const cust = state.customers.find(c => c.id === id);
    const cName = cust?.name || `#${id}`;
    setState(prev => ({
      ...prev,
      customers: prev.customers.filter(c => c.id !== id)
    }));
    addAuditLog(
      'Customer',
      `Deleted customer #${id}`,
      `حذف العميل "${cName}" (معرف: #${id}) من قاعدة البيانات`
    );
  };

  const addCustomerPayment = (paymentData: Omit<CustomerPayment, 'id' | 'timestamp'> & { timestamp?: number; locationId?: string }) => {
    const payTimestamp = (paymentData as any).timestamp || (paymentData.date ? new Date(paymentData.date).getTime() : Date.now());
    const locId = paymentData.locationId || state.settings.currentLocationId || '1';
    const newPayment: CustomerPayment = {
      ...paymentData,
      locationId: locId,
      id: crypto.randomUUID(),
      timestamp: payTimestamp,
    };
    setState(prev => ({
      ...prev,
      customerPayments: [...(prev.customerPayments || []), newPayment],
      customers: prev.customers.map(c => {
        if (c.id === paymentData.customerId) {
          const newBal = Math.max(0, (c.balance || 0) - paymentData.amount);
          return { ...c, balance: newBal };
        }
        return c;
      }),
      drawerMovements: paymentData.paymentMethod === 'cash' ? [
        ...(prev.drawerMovements || []),
        {
          id: crypto.randomUUID(),
          locationId: locId,
          type: 'deposit',
          amount: paymentData.amount,
          reason: `سداد آجل: ${paymentData.customerName || `عميل #${paymentData.customerId}`}`,
          date: paymentData.date,
          timestamp: payTimestamp,
          user: currentUser?.name || 'كاشير'
        }
      ] : (prev.drawerMovements || [])
    }));
    const pMethod = paymentData.paymentMethod === 'cash' ? 'نقداً' : paymentData.paymentMethod === 'card' ? 'بطاقة/فيزا' : (paymentData.paymentMethod || 'نقداً');
    addAuditLog(
      'Payment',
      `Customer credit payment: ${paymentData.customerName || ''} - ${paymentData.amount} EGP (${paymentData.paymentMethod})`,
      `سداد مديونية عميل: "${paymentData.customerName || 'عميل'}" — المبلغ: ${paymentData.amount} ج.م — طريقة الدفع: ${pMethod}`
    );
  };

  const addUser = (user: User) => {
    setState(prev => ({
      ...prev,
      users: [...prev.users, user]
    }));
    addAuditLog(
      'User',
      `Added user: ${user.username}`,
      `إضافة مستخدم جديد للنظام: "${user.username}" (الاسم: ${user.name}، الدور: ${user.role === 'admin' ? 'مدير' : 'كاشير'})`
    );
  };

  const updateUser = (user: User) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === user.id ? user : u)
    }));
    if (currentUser && (currentUser.id === user.id || currentUser.username === user.username)) {
      setCurrentUser(user);
    }
    addAuditLog(
      'User',
      `Updated user: ${user.username}`,
      `تحديث بيانات وصلاحيات المستخدم: "${user.username}"`
    );
  };

  const deleteUser = (id: string) => {
    const u = state.users.find(x => x.id === id);
    setState(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== id)
    }));
    addAuditLog(
      'User',
      `Deleted user #${id}`,
      `حذف المستخدم "${u?.username || id}" من النظام`
    );
  };

  const updateSettings = (settings: Partial<AppState['settings']> | AppState['settings']) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...settings } }));
    addAuditLog(
      'Settings',
      'Updated system settings',
      'تحديث وتعديل الإعدادات العامة للنظام'
    );
  };

  const resetSystem = () => {
    // حذف أي فروع إضافية من السحابة إذا كانت متصلة وإرجاعها للفرع الرئيسي فقط
    try {
      const extraBranches = (state?.locations || []).filter(l => String(l.id) !== '1');
      for (const b of extraBranches) {
        void deleteBranchFromSupabase(b.id, state?.settings?.supabaseUrl, state?.settings?.supabaseKey);
      }
    } catch {}

    localStorage.removeItem('appState');
    localStorage.removeItem('procashier_sync_status');
    localStorage.removeItem('procashier_sync_queue');
    localStorage.removeItem('procashier_returns_queue');
    localStorage.removeItem('raizon_closing_events');
    localStorage.removeItem('procashier_active_invoice_draft_v1');
    localStorage.removeItem('raizon_dashboard_kpi_cards_v1');
    localStorage.removeItem('pro_staff_tools_v1');
    localStorage.removeItem('closing_include_debts');
    localStorage.removeItem('report_print_size');

    // مسح مفاتيح الجلسة الخاصة باختيار الفروع
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('admin_branch_selected_') || k.includes('branch'))) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}

    // مسح شامل لأي مفاتيح مسودات أو فواتير مؤقتة متبقية في المتصفح
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('procashier_') || k.startsWith('raizon_') || k === 'appState')) {
          localStorage.removeItem(k);
        }
      }
    } catch {}

    // نحذف نسخة IndexedDB أيضاً حتى لا تُستعاد الحالة القديمة بعد إعادة التشغيل
    idbRemove('appState').finally(() => window.location.reload());
  };

  // استعادة الحالة كاملة (من ملف خارجي أو نسخة سحابية/محلية) مع دمج وحماية شاملة
  const restoreState = (rawInput: any) => {
    if (!rawInput || typeof rawInput !== 'object') return;
    const raw = rawInput.state || rawInput.appState || rawInput.data || rawInput;
    if (!raw || typeof raw !== 'object') return;

    // مسح أي مسودة فاتورة حالية لضمان تفريغ السلة وعدم تعليق أصناف قديمة
    try {
      localStorage.removeItem('procashier_active_invoice_draft_v1');
    } catch {}

    const parsed = normalizeInvoiceDates(raw);

    setState(prev => {
      const merged: AppState = {
        ...prev,
        ...parsed,
        locations: (Array.isArray(parsed.locations) && parsed.locations.length > 0) ? parsed.locations : (prev?.locations?.length ? prev.locations : initialLocations),
        categories: Array.isArray(parsed.categories) ? parsed.categories : (prev?.categories || []),
        items: Array.isArray(parsed.items) ? parsed.items : (Array.isArray(parsed.products) ? parsed.products : (prev?.items || [])),
        invoices: Array.isArray(parsed.invoices) ? parsed.invoices : (prev?.invoices || []),
        customers: Array.isArray(parsed.customers) ? parsed.customers : (prev?.customers || []),
        suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : (prev?.suppliers || []),
        inventoryHistory: Array.isArray(parsed.inventoryHistory) ? parsed.inventoryHistory : (prev?.inventoryHistory || []),
        purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : (prev?.purchaseOrders || []),
        closingReports: Array.isArray(parsed.closingReports) ? parsed.closingReports : (prev?.closingReports || []),
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : (prev?.auditLogs || []),
        returns: Array.isArray(parsed.returns) ? parsed.returns : (prev?.returns || []),
        users: (Array.isArray(parsed.users) && parsed.users.length > 0) ? parsed.users : (prev?.users || [{ id: '1', username: 'admin', name: 'Admin', password: 'admin', role: 'admin', active: true, permissions: [] }]),
        drawerMovements: Array.isArray(parsed.drawerMovements) ? parsed.drawerMovements : (prev?.drawerMovements || []),
        heldInvoices: Array.isArray(parsed.heldInvoices) ? parsed.heldInvoices : (prev?.heldInvoices || []),
        reservations: Array.isArray(parsed.reservations) ? parsed.reservations : (prev?.reservations || []),
        staff: Array.isArray(parsed.staff) ? parsed.staff : (prev?.staff || []),
        staffPayments: Array.isArray(parsed.staffPayments) ? parsed.staffPayments : (prev?.staffPayments || []),
        notes: Array.isArray(parsed.notes) ? parsed.notes : (prev?.notes || []),
        settings: {
          ...prev.settings,
          ...(parsed.settings || {}),
          currentLocationId: parsed.settings?.currentLocationId || prev.settings?.currentLocationId || '1',
          offlineMode: parsed.settings?.offlineMode ?? prev.settings?.offlineMode ?? false,
          serverUrl: parsed.settings?.serverUrl || prev.settings?.serverUrl || 'http://127.0.0.1:8087',
          serverApiKey: parsed.settings?.serverApiKey || prev.settings?.serverApiKey || '',
          cashDrawerOpening: Number(parsed.settings?.cashDrawerOpening ?? prev.settings?.cashDrawerOpening) || 0,
          managerEmail: parsed.settings?.emailConfig?.emailTo || parsed.settings?.managerEmail || parsed.emailConfig?.emailTo || parsed.managerEmail || prev.settings?.managerEmail || '',
          emailConfig: parsed.settings?.emailConfig || parsed.emailConfig || (
            (parsed.settings?.managerEmail || parsed.managerEmail) ? {
              emailTo: parsed.settings?.managerEmail || parsed.managerEmail,
              notifyOnInvoice: true,
              notifyOnClosing: true,
              notifyOnReturn: true,
              notifyOnExpense: true,
              smtpUser: 'rizon.pro.app@gmail.com'
            } : prev.settings?.emailConfig
          )
        }
      };

      // إذا وُجد بريد مدير في النسخة الاحتياطية المستعادة نفعله فوراً على السيرفر
      const restoredEmail = merged.settings.managerEmail || merged.settings.emailConfig?.emailTo;
      if (restoredEmail) {
        try {
          const sUrl = (merged.settings.serverUrl || 'http://127.0.0.1:8087').trim().replace(/\/+$/, '');
          fetch(`${sUrl}/api/email/config`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(merged.settings.serverApiKey ? { 'X-API-Key': merged.settings.serverApiKey } : {})
            },
            body: JSON.stringify({
              email_to: restoredEmail,
              notify_on_invoice: merged.settings.emailConfig?.notifyOnInvoice ?? true,
              notify_on_closing: merged.settings.emailConfig?.notifyOnClosing ?? true,
              notify_on_return: merged.settings.emailConfig?.notifyOnReturn ?? true,
              notify_on_expense: merged.settings.emailConfig?.notifyOnExpense ?? true,
            })
          }).catch(err => console.warn('[RESTORE_EMAIL] Server sync error:', err));
        } catch (e) {
          console.warn('[RESTORE_EMAIL] Push error:', e);
        }
      }

      try {
        localStorage.setItem('appState', JSON.stringify(merged));
        idbSet('appState', merged);
      } catch (err) {
        console.error('Failed to immediately save restored state', err);
      }

      return merged;
    });

    addAuditLog('System', 'Restored state from backup');
  };

  const resetLoyaltyPoints = () => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.map(c => ({ ...c, loyaltyPoints: 0 }))
    }));
    addAuditLog('Loyalty', 'Reset all loyalty points', 'تصفير وإعادة تعيين نقاط الولاء لكافة العملاء');
  };

  const addStaffPayment = (payment: any) => {
    setState(prev => ({ ...prev, staffPayments: [payment, ...prev.staffPayments] }));
  };

  const deleteStaffPayment = (id: string) => {
    setState(prev => ({ ...prev, staffPayments: prev.staffPayments.filter(p => p.id !== id) }));
  };

  const addReservation = (reservation: Reservation) => {
    setState(prev => ({ ...prev, reservations: [...prev.reservations, reservation] }));
  };

  const addStaff = (staff: Staff) => {
    setState(prev => ({ ...prev, staff: [...prev.staff, staff] }));
  };

  const updateStaff = (staff: Staff) => {
    setState(prev => ({
      ...prev,
      staff: prev.staff.map(s => s.id === staff.id ? staff : s)
    }));
  };

  const deleteStaff = (id: string) => {
    setState(prev => ({ ...prev, staff: prev.staff.filter(s => s.id !== id) }));
  };

  const addExpense = (expense: Expense) => {
      const locId = expense.locationId || state.settings.currentLocationId || '1';
      const expenseWithLoc: Expense = { ...expense, locationId: locId };
      try {
        const sUrl = (state.settings.serverUrl || 'http://127.0.0.1:8087').trim().replace(/\/+$/, '');
        if (sUrl) {
          fetch(`${sUrl}/api/expenses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(state.settings.serverApiKey ? { 'X-API-Key': state.settings.serverApiKey } : {})
            },
            body: JSON.stringify({
              id: expense.id,
              title: expense.title,
              amount: expense.amount,
              category: expense.category,
              date: expense.date,
              notes: expense.description || '',
              created_by: expense.recordedBy || currentUser?.name || 'كاشير المحل'
            })
          }).catch(err => console.warn('[EXPENSE] Server push failed:', err));
        }
      } catch (err) {
        console.warn('[EXPENSE] Push error:', err);
      }
      setState(prev => ({ ...prev, expenses: [...prev.expenses, expenseWithLoc] }));
      addAuditLog(
        'Expense',
        `Added expense: ${expense.title} (${expense.amount})`,
        `تسجيل مصروف تشغيلي جديد: "${expense.title}" بقيمة ${expense.amount} ج.م (التصنيف: ${expense.category || 'عام'}${expense.description ? ` — البيان: ${expense.description}` : ''})`
      );
  };

  const deleteExpense = (id: string) => {
      setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
      addAuditLog(
        'Expense',
        `Deleted expense #${id}`,
        `حذف بند مصروف تشغيلي برقم المعرف #${id}`
      );
  };

  const triggerOpenCashDrawer = (silent: boolean = false) => {
    openCashDrawerDevice();
    addAuditLog('Drawer', 'Cash drawer opened (F7 / Direct Button)', `فتح درج النقدية بواسطة: ${currentUser?.name || 'كاشير'}`);
    if (!silent) {
      addToast('تم إرسال أمر فتح درج النقدية (F7) 💰', 'success');
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  const toggleGlassNeon = () => {
    setGldssNeon(prev => !prev);
  };
  const toggleExperimentalMode = () => {
    // وضع تجريبي بصري فقط — لا يمنح أي صلاحيات ولا يتجاوز تسجيل الدخول
    setExperimentdlMode(prev => !prev);
  };

  return (
    <AppContext.Provider value={{
      language, toggleLanguage, currentUser, login, loginWithPin, logout, changeOwnPassword, setQuickPin, state,
      addInvoice, updateInvoice, voidInvoice, createReturn, cancelReturn, addCustomer, updateCustomer, deleteCustomer,
      holdInvoice, restoreInvoice, deleteHeldInvoice,
      addItem, updateItem, deleteItem,
      addCategory, updateCategory, deleteCategory,
      addLocation, updateLocation, deleteLocation,
      addReservation, addStaff, updateStaff, deleteStaff,
      addUser, updateUser, deleteUser,
      addExpense, deleteExpense, addClosingReport,
      addDrawerMovement, deleteDrawerMovement, addAuditLog,
      addPurchaseOrder, addSupplier, updateSupplier, deleteSupplier, updatePurchaseOrder, addInventoryHistory,
      addNote,
      updateNote,
      deleteNote,
      addStaffPayment, deleteStaffPayment, resetSystem, restoreState, resetLoyaltyPoints,
      addCustomerPayment,
      t, formatNumber, formatDate, formatTime, formatDateTime,
      theme, toggleTheme, glassNeon, toggleGlassNeon, experimentalMode, toggleExperimentalMode,
      updateSettings, toasts, addToast, removeToast,
      settingsDirty, setSettingsDirty, saveSettingsHandlerRef, discardSettingsHandlerRef,
      triggerOpenCashDrawer
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext) as AppContextType | undefined;
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
