import { generateCode128Svg } from '../lib/barcode';
/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Package, Plus, Trash2, Printer, FileText, 
    AlertCircle, Flask, Search, X, 
    Scissors, Tag, MapPin, Users, Activity, Check, Edit
} from '../components/Icons';
import { Item } from '../types';
import { Card, Button } from '../components/ui';
import { CategoriesPage } from './CategoriesPage';
import { LocationsPage } from './LocationsPage';
import { SuppliersPage } from './SuppliersPage';
import { PurchaseOrdersPage } from './PurchaseOrdersPage';
import { InventoryHistoryPage } from './InventoryHistoryPage';
import { exportToCSV } from '../lib/exportUtils';

export const Inventory = () => {
    const { state, t, addItem, updateItem, deleteItem, addInventoryHistory, addToast, language, formatNumber } = useApp();
    const [subTab, setSubTab] = useState<'items' | 'categories' | 'locations' | 'suppliers' | 'orders' | 'history'>('items');
    const [categoryId, setCategoryId] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service' | 'low_stock' | 'expiring_soon' | 'expired'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Add / Edit Modal State
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [itemForm, setItemForm] = useState<Item>({
        id: '',
        nameAr: '',
        nameEn: '',
        categoryId: '',
        price: 0,
        cost: 0,
        barcode: '',
        trackStock: true,
        quantity: 0,
        alertThreshold: 5,
        variants: [],
        modifiers: [],
        type: 'product'
    });

    // Delete Confirmation Modal State
    const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

    // Waste / Internal Use Modal State
    const [wasteModalOpen, setWasteModalOpen] = useState(false);
    const [wasteItemId, setWasteItemId] = useState('');
    const [wasteQty, setWasteQty] = useState(1);
    const [wasteReason, setWasteReason] = useState('internal_use');
    const [wasteNotes, setWasteNotes] = useState('');

    // Barcode Print Modal State
    const [barcodeModalItem, setBarcodeModalItem] = useState<Item | null>(null);
    const [barcodeLabelCount, setBarcodeLabelCount] = useState(1);

    // Summary calculations
    const stats = useMemo(() => {
        const products = state.items.filter(i => i.type === 'product');
        const services = state.items.filter(i => i.type === 'service');
        const lowStock = products.filter(p => p.trackStock && p.quantity <= p.alertThreshold);
        const totalUnits = products.reduce((acc, p) => acc + (p.trackStock ? Math.max(0, p.quantity) : 0), 0);
        const totalValue = products.reduce((acc, p) => acc + ((p.cost || p.price) * (p.trackStock ? Math.max(0, p.quantity) : 0)), 0);

        const todayMs = new Date().setHours(0, 0, 0, 0);
        const dayMs = 24 * 60 * 60 * 1000;
        const productsWithExpiry = products.filter(p => p.trackStock && p.expiryDate);
        const expired = productsWithExpiry.filter(p => new Date(p.expiryDate!).getTime() < todayMs);
        const expiringSoon60 = productsWithExpiry.filter(p => {
            const diff = new Date(p.expiryDate!).getTime() - todayMs;
            return diff >= 0 && diff <= 60 * dayMs;
        });

        return {
            total: state.items.length,
            productsCount: products.length,
            servicesCount: services.length,
            lowStockCount: lowStock.length,
            totalUnits,
            totalValue,
            expiredCount: expired.length,
            expiringSoonCount: expiringSoon60.length
        };
    }, [state.items]);

    // Filter items
    const filtered = useMemo(() => {
        return state.items.filter(i => {
            // Category filter
            if (categoryId && i.categoryId !== categoryId) return false;

            // Type / Low Stock / Expiry filter
            if (typeFilter === 'product' && i.type !== 'product') return false;
            if (typeFilter === 'service' && i.type !== 'service') return false;
            if (typeFilter === 'low_stock' && (!i.trackStock || i.quantity > i.alertThreshold)) return false;
            if (typeFilter === 'expiring_soon') {
                if (!i.trackStock || !i.expiryDate) return false;
                const diff = new Date(i.expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
                if (diff < 0 || diff > 60 * 24 * 60 * 60 * 1000) return false;
            }
            if (typeFilter === 'expired') {
                if (!i.trackStock || !i.expiryDate) return false;
                const diff = new Date(i.expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
                if (diff >= 0) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = (i.nameAr && i.nameAr.toLowerCase().includes(q)) || 
                                  (i.nameEn && i.nameEn.toLowerCase().includes(q)) ||
                                  (i.barcode && i.barcode.toLowerCase().includes(q)) ||
                                  (i.sku && i.sku.toLowerCase().includes(q));
                if (!matchName) return false;
            }
            return true;
        });
    }, [state.items, categoryId, typeFilter, searchQuery]);

    // Open Add Modal
    const handleOpenAddModal = (defaultType: 'product' | 'service' = 'product') => {
        setEditingItem(null);
        setItemForm({
            id: '',
            nameAr: '',
            nameEn: '',
            categoryId: categoryId || (state.categories[0]?.id || ''),
            price: 0,
            cost: 0,
            barcode: '',
            trackStock: defaultType === 'product',
            quantity: defaultType === 'product' ? 10 : 0,
            alertThreshold: defaultType === 'product' ? 5 : 0,
            variants: [],
            modifiers: [],
            type: defaultType
        });
        setIsItemModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (item: Item) => {
        setEditingItem(item);
        setItemForm({
            ...item,
            cost: item.cost || 0,
            barcode: item.barcode || '',
            quantity: item.quantity || 0,
            alertThreshold: item.alertThreshold || 5,
        });
        setIsItemModalOpen(true);
    };

    // Save Item (Add or Update)
    const handleSaveItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemForm.nameAr.trim()) {
            addToast(language === 'ar' ? 'يرجى إدخال اسم الصنف بالعربية' : 'Please enter item name', 'error');
            return;
        }
        if (itemForm.price < 0) {
            addToast(language === 'ar' ? 'سعر البيع لا يمكن أن يكون سالباً' : 'Price cannot be negative', 'error');
            return;
        }

        const isProduct = itemForm.type === 'product';
        const finalItem: Item = {
            ...itemForm,
            nameAr: itemForm.nameAr.trim(),
            nameEn: (itemForm.nameEn || itemForm.nameAr).trim(),
            price: Math.max(0, Number(itemForm.price) || 0),
            cost: isProduct ? Math.max(0, Number(itemForm.cost) || 0) : 0,
            trackStock: isProduct ? Boolean(itemForm.trackStock) : false,
            quantity: isProduct ? Math.max(0, Number(itemForm.quantity) || 0) : 0,
            alertThreshold: isProduct ? Math.max(0, Number(itemForm.alertThreshold) || 0) : 0,
            barcode: (itemForm.barcode || '').trim(),
            variants: itemForm.variants || [],
            modifiers: itemForm.modifiers || [],
        };

        if (editingItem) {
            updateItem(finalItem);
            // Record audit if stock quantity changed on a product
            if (editingItem.type === 'product' && editingItem.quantity !== finalItem.quantity) {
                const diff = finalItem.quantity - editingItem.quantity;
                addInventoryHistory({
                    itemId: finalItem.id,
                    type: 'adjustment',
                    quantityChange: diff,
                    reason: language === 'ar' ? 'تعديل يدوي لكمية المخزون' : 'Manual stock adjustment',
                    locationId: state.settings.currentLocationId || 'default',
                    unitPrice: finalItem.cost || finalItem.price,
                    totalValue: (finalItem.cost || finalItem.price) * Math.abs(diff)
                });
            }
            addToast(language === 'ar' ? `تم تحديث الصنف "${finalItem.nameAr}" بنجاح` : `Updated "${finalItem.nameAr}" successfully`, 'success');
        } else {
            const newItemId = crypto.randomUUID();
            const createdItem: Item = { ...finalItem, id: newItemId };
            addItem(createdItem);
            if (createdItem.type === 'product' && createdItem.quantity > 0) {
                addInventoryHistory({
                    itemId: newItemId,
                    type: 'adjustment',
                    quantityChange: createdItem.quantity,
                    reason: language === 'ar' ? 'رصيد افتتاحي لصنف جديد' : 'Initial stock for new item',
                    locationId: state.settings.currentLocationId || 'default',
                    unitPrice: createdItem.cost || createdItem.price,
                    totalValue: (createdItem.cost || createdItem.price) * createdItem.quantity
                });
            }
            addToast(language === 'ar' ? `تمت إضافة "${finalItem.nameAr}" إلى المخزون` : `Added "${finalItem.nameAr}" to inventory`, 'success');
        }

        setIsItemModalOpen(false);
    };

    // Confirm Delete Item
    const confirmDeleteItem = () => {
        if (!itemToDelete) return;
        const name = itemToDelete.nameAr || itemToDelete.nameEn;
        deleteItem(itemToDelete.id);
        addToast(language === 'ar' ? `تم حذف "${name}" بنجاح من المخزون والفواتير` : `Deleted "${name}" from inventory`, 'success');
        setItemToDelete(null);
    };

    // Quick inline quantity update for products
    const handleQuickQuantityDelta = (item: Item, delta: number) => {
        if (item.type !== 'product' || !item.trackStock) return;
        const newQty = Math.max(0, item.quantity + delta);
        updateItem({ ...item, quantity: newQty });
        addInventoryHistory({
            itemId: item.id,
            type: 'adjustment',
            quantityChange: delta,
            reason: language === 'ar' ? (delta > 0 ? 'زيادة سريعة (+1)' : 'نقصان سريع (-1)') : 'Quick stock tweak',
            locationId: state.settings.currentLocationId || 'default',
            unitPrice: item.cost || item.price,
            totalValue: (item.cost || item.price) * Math.abs(delta)
        });
    };

    // Generate random barcode
    const handleGenerateBarcode = () => {
        const randomCode = '20' + Math.floor(1000000000 + Math.random() * 9000000000);
        setItemForm(prev => ({ ...prev, barcode: randomCode }));
    };

    // Handle recording internal consumption or waste
    const handleRecordWaste = (e: React.FormEvent) => {
        e.preventDefault();
        const targetItem = state.items.find(i => i.id === wasteItemId);
        if (!targetItem) {
            addToast(t('item_not_found') || 'الصنف غير موجود', 'error');
            return;
        }
        if (wasteQty <= 0) {
            addToast('الكمية يجب أن تكون أكبر من صفر', 'error');
            return;
        }
        if (targetItem.trackStock && targetItem.quantity < wasteQty) {
            addToast(`الكمية المتاحة في المخزن (${targetItem.quantity}) غير كافية`, 'error');
            return;
        }

        const reasonLabels: Record<string, string> = {
            internal_use: 'استهلاك صالون داخلي',
            damaged: 'منتج تالف / مكسور',
            expired: 'منتهي الصلاحية',
            sample: 'عينة تجريبية للعميل',
            other: 'أخرى'
        };
        const fullReason = `${reasonLabels[wasteReason] || wasteReason}${wasteNotes.trim() ? ` - ${wasteNotes.trim()}` : ''}`;

        // Deduct from item stock
        updateItem({
            ...targetItem,
            quantity: Math.max(0, targetItem.quantity - wasteQty)
        });

        // Record in inventory audit history
        addInventoryHistory({
            itemId: targetItem.id,
            type: 'adjustment',
            quantityChange: -wasteQty,
            reason: fullReason,
            locationId: state.settings.currentLocationId || 'default',
            unitPrice: targetItem.cost || targetItem.price || 0,
            totalValue: (targetItem.cost || targetItem.price || 0) * wasteQty
        });

        addToast(language === 'ar' ? 'تم تسجيل الاستهلاك/الهالك وتحديث المخزون' : 'Waste recorded successfully', 'success');
        setWasteModalOpen(false);
        setWasteItemId('');
        setWasteQty(1);
        setWasteNotes('');
    };

    // Export Inventory to CSV
    const handleExportCSV = () => {
        const headers = ['ID', 'Barcode', 'اسم الصنف', 'Item Name', 'التصنيف', 'النوع', 'سعر البيع', 'التكلفة', 'الكمية الحالية', 'حد التنبيه', 'إجمالي القيمة'];
        const rows = filtered.map(item => [
            item.id,
            item.barcode || '-',
            item.nameAr || '',
            item.nameEn || '',
            state.categories.find(c => c.id === item.categoryId)?.nameAr || '-',
            item.type === 'service' ? 'خدمة' : 'منتج',
            item.price,
            item.cost || 0,
            item.trackStock ? item.quantity : '-',
            item.trackStock ? item.alertThreshold : '-',
            item.trackStock ? (item.quantity * item.price) : 0,
        ]);
        exportToCSV(`المخزون_${new Date().toISOString().split('T')[0]}`, headers, rows);
        addToast(language === 'ar' ? 'تم تصدير المخزون بنجاح' : 'Exported inventory successfully', 'success');
    };

    // Print Barcode Label Sheet
    const handlePrintBarcode = (item: Item) => {
        const printWindow = window.open('', '', 'width=450,height=500');
        if (!printWindow) return;

        const shopName = state.settings.shopName || 'ProCashier';
        const itemName = language === 'ar' ? item.nameAr : item.nameEn;
        const code = item.barcode || item.id.slice(0, 8);
        const price = `${item.price} ${language === 'ar' ? 'ج.م' : 'EGP'}`;

        let labelsHtml = '';
        for (let i = 0; i < barcodeLabelCount; i++) {
            labelsHtml += `
                <div class="label-card">
                    <div class="shop-name">${shopName}</div>
                    <div class="item-name">${itemName}</div>
                    <div class="barcode-bars">
                        ${generateCode128Svg(code, { height: 42, moduleWidth: 1.6, showText: true, fontSize: 9 })}
                    </div>
                    <div class="item-price">${price}</div>
                </div>
            `;
        }

        const html = `
            <!DOCTYPE html>
            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <head>
                <meta charset="utf-8">
                <title>Barcode - ${itemName}</title>
                <style>
                    @page {
                        size: 50mm 25mm;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #fff;
                    }
                    .label-card {
                        width: 48mm;
                        height: 24mm;
                        margin: 0 auto;
                        padding: 1.5mm;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        align-items: center;
                        text-align: center;
                        page-break-after: always;
                    }
                    .shop-name {
                        font-size: 8px;
                        font-weight: 600;
                        color: #475569;
                        text-transform: uppercase;
                        white-space: nowrap;
                        overflow: hidden;
                    }
                    .item-name {
                        font-size: 10px;
                        font-weight: 700;
                        color: #0f172a;
                        line-height: 1.1;
                        max-height: 22px;
                        overflow: hidden;
                    }
                    .barcode-bars {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        margin: 1px 0;
                    }
                    .item-price {
                        font-size: 11px;
                        font-weight: 800;
                        color: #000;
                    }
                </style>
            </head>
            <body>
                ${labelsHtml}
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            try { printWindow.focus(); printWindow.print(); } catch { /* ignore */ }
            setTimeout(() => { try { printWindow.close(); } catch { /* ignore */ } }, 500);
        };
        setBarcodeModalItem(null);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Sub-Navigation Tabs */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Package className="text-primary-600 dark:text-primary-400" size={26} />
                            {t('inventory')}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {language === 'ar' ? 'إدارة المنتجات والخدمات والمخزون، وتحديد الكميات والأسعار والتصنيفات' : 'Manage products, services, stock quantities and categories'}
                        </p>
                    </div>

                    {subTab === 'items' && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button 
                                variant="primary" 
                                onClick={() => handleOpenAddModal('product')}
                                className="flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm hover:shadow"
                            >
                                <Plus size={16} />
                                {language === 'ar' ? 'إضافة صنف جديد' : 'New Item'}
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => setWasteModalOpen(true)}
                                className="flex items-center gap-1.5 text-xs py-2 px-3 border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                            >
                                <Flask size={14} />
                                {language === 'ar' ? 'تسجيل استهلاك / هالك' : 'Record Waste'}
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={handleExportCSV}
                                className="flex items-center gap-1.5 text-xs py-2 px-3"
                            >
                                <FileText size={14} />
                                {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Sub-Tabs Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    {[
                        { id: 'items', labelAr: 'المنتجات والخدمات والمخزون', labelEn: 'Items & Stock', icon: Package },
                        { id: 'categories', labelAr: 'التصنيفات', labelEn: 'Categories', icon: Tag },
                        { id: 'locations', labelAr: 'المواقع والمخازن', labelEn: 'Locations', icon: MapPin },
                        { id: 'suppliers', labelAr: 'الموردين', labelEn: 'Suppliers', icon: Users },
                        { id: 'orders', labelAr: 'أوامر الشراء', labelEn: 'Purchase Orders', icon: FileText },
                        { id: 'history', labelAr: 'سجل الحركات', labelEn: 'Stock History', icon: Activity },
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = subTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setSubTab(tab.id as any)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                    active 
                                        ? 'bg-primary-600 text-white shadow-sm' 
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <Icon size={14} />
                                <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-Tab Contents */}
            {subTab === 'categories' && <CategoriesPage />}
            {subTab === 'locations' && <LocationsPage />}
            {subTab === 'suppliers' && <SuppliersPage />}
            {subTab === 'orders' && <PurchaseOrdersPage />}
            {subTab === 'history' && <InventoryHistoryPage />}

            {subTab === 'items' && (
                <div className="space-y-4">
                    {/* Top Stats Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{language === 'ar' ? 'إجمالي الأصناف' : 'Total Items'}</p>
                            <h4 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{stats.total}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{stats.productsCount} منتج • {stats.servicesCount} خدمة</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{language === 'ar' ? 'المنتجات بالمخزن' : 'Products Stock'}</p>
                            <h4 className="text-xl font-black text-primary-600 dark:text-primary-400 mt-1">{stats.totalUnits} <span className="text-xs font-medium text-slate-400">قطعة</span></h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{stats.productsCount} منتج مسجل</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{language === 'ar' ? 'الخدمات المتاحة' : 'Salon Services'}</p>
                            <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.servicesCount}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{language === 'ar' ? 'خدمات صالون بدون مخزون' : 'No stock tracking'}</p>
                        </div>
                        <div className={`rounded-xl p-3.5 border shadow-xs ${stats.lowStockCount > 0 ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60' : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700'}`}>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{language === 'ar' ? 'نواقص المخزون' : 'Low Stock'}</p>
                            <h4 className={`text-xl font-black mt-1 ${stats.lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                {stats.lowStockCount}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{stats.lowStockCount > 0 ? 'تحتاج لتوريد عاجل' : 'المخزون آمن'}</p>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* Type Filters: All, Products, Services, Low Stock */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                            {[
                                { id: 'all', label: language === 'ar' ? `الكل (${stats.total})` : `All (${stats.total})` },
                                { id: 'product', label: language === 'ar' ? `📦 المنتجات (${stats.productsCount})` : `📦 Products (${stats.productsCount})` },
                                { id: 'service', label: language === 'ar' ? `✂️ الخدمات (${stats.servicesCount})` : `✂️ Services (${stats.servicesCount})` },
                                { id: 'low_stock', label: language === 'ar' ? `⚠️ النواقص (${stats.lowStockCount})` : `⚠️ Low Stock (${stats.lowStockCount})` },
                                { id: 'expiring_soon', label: language === 'ar' ? `⏳ أوشك على الانتهاء (${stats.expiringSoonCount})` : `⏳ Expiring (${stats.expiringSoonCount})` },
                                { id: 'expired', label: language === 'ar' ? `🛑 منتهي الصلاحية (${stats.expiredCount})` : `🛑 Expired (${stats.expiredCount})` },
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setTypeFilter(filter.id as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                                        typeFilter === filter.id
                                            ? 'bg-primary-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2.5 flex-1 max-w-md">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder={language === 'ar' ? 'بحث بالاسم، الباركود، الكود...' : 'Search by name or barcode...'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <select 
                                value={categoryId} 
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none shrink-0"
                            >
                                <option value="">{t('all_categories')}</option>
                                {state.categories.map(c => <option key={c.id} value={c.id}>{language === 'ar' ? c.nameAr : c.nameEn}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Stock Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.length === 0 ? (
                            <div className="col-span-full py-16 text-center text-slate-400 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <Package size={40} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                <p className="font-semibold">{t('no_items') || 'لا توجد أصناف مطابقة للبحث'}</p>
                                <Button 
                                    variant="primary" 
                                    onClick={() => handleOpenAddModal('product')}
                                    className="mt-3 text-xs py-1.5 px-4"
                                >
                                    <Plus size={14} /> {language === 'ar' ? 'إضافة صنف جديد الآن' : 'Add Item Now'}
                                </Button>
                            </div>
                        ) : (
                            filtered.map(item => {
                                const isProduct = item.type === 'product';
                                const isLowStock = isProduct && item.trackStock && item.quantity <= item.alertThreshold;
                                const categoryName = state.categories.find(c => c.id === item.categoryId)?.nameAr || state.categories.find(c => c.id === item.categoryId)?.nameEn;

                                return (
                                    <Card 
                                        key={item.id} 
                                        className={`relative flex flex-col justify-between transition-all hover:shadow-md ${
                                            isLowStock ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20 dark:bg-amber-950/10' : ''
                                        }`}
                                    >
                                        <div>
                                            {/* Card Top: Badges & Category */}
                                            <div className="flex justify-between items-start gap-2 mb-2.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {/* Product or Service Badge */}
                                                    {isProduct ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                                                            <Package size={12} />
                                                            {language === 'ar' ? 'منتج' : 'Product'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                                                            <Scissors size={12} />
                                                            {language === 'ar' ? 'خدمة صالون' : 'Service'}
                                                        </span>
                                                    )}

                                                    {categoryName && (
                                                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                                                            {categoryName}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Barcode badge */}
                                                {item.barcode && (
                                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                                        <Tag size={9} /> {item.barcode}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Item Name */}
                                            <h3 className="font-black text-base text-slate-800 dark:text-slate-100 leading-snug">
                                                {language === 'ar' ? item.nameAr : (item.nameEn || item.nameAr)}
                                            </h3>
                                            {item.nameEn && language === 'ar' && (
                                                <p className="text-xs text-slate-400 font-medium">{item.nameEn}</p>
                                            )}

                                            {/* Details & Pricing */}
                                            <div className="space-y-1.5 text-xs my-3 border-t border-slate-100 dark:border-slate-700/60 pt-2.5">
                                                {/* Selling Price */}
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500 dark:text-slate-400">{t('price')}:</span>
                                                    <span className="font-extrabold text-sm text-primary-600 dark:text-primary-400 font-mono">
                                                        {formatNumber(item.price)} {t('egp')}
                                                    </span>
                                                </div>

                                                {/* If Product: Cost & Quantity */}
                                                {isProduct ? (
                                                    <>
                                                        {item.cost !== undefined && item.cost > 0 && (
                                                            <div className="flex justify-between items-center text-slate-400">
                                                                <span>{language === 'ar' ? 'سعر التكلفة:' : 'Cost:'}</span>
                                                                <span className="font-mono">{formatNumber(item.cost)} {t('egp')}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'الكمية في المخزن:' : 'In Stock:'}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`font-black font-mono px-2.5 py-0.5 rounded-lg text-xs ${
                                                                    isLowStock 
                                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300' 
                                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                                                                }`}>
                                                                    {item.quantity} {language === 'ar' ? 'قطعة' : 'pcs'}
                                                                </span>
                                                                {/* Quick +/- buttons */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickQuantityDelta(item, -1)}
                                                                    disabled={item.quantity <= 0}
                                                                    className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center disabled:opacity-40 transition-colors"
                                                                    title={language === 'ar' ? 'خصم 1' : '-1'}
                                                                >
                                                                    -
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickQuantityDelta(item, 1)}
                                                                    className="w-6 h-6 rounded-md bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center transition-colors"
                                                                    title={language === 'ar' ? 'إضافة 1' : '+1'}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex justify-between items-center text-slate-400 italic">
                                                        <span>{language === 'ar' ? 'نوع الصنف:' : 'Type:'}</span>
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                            {language === 'ar' ? 'خدمة صالون (بدون مخزون عددي)' : 'Salon Service'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Low stock alert badge */}
                                            {isLowStock && (
                                                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-bold mb-2 bg-amber-100/60 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg border border-amber-300/60">
                                                    <AlertCircle size={14} />
                                                    <span>{t('low_stock')} ({language === 'ar' ? `المتبقي ${item.quantity} - حد التنبيه ${item.alertThreshold}` : `Remaining ${item.quantity}`})</span>
                                                </div>
                                            )}

                                            {/* Expiry Date & Batch Badges */}
                                            {isProduct && item.expiryDate && (() => {
                                                const todayMs = new Date().setHours(0,0,0,0);
                                                const expMs = new Date(item.expiryDate).getTime();
                                                const diffDays = Math.ceil((expMs - todayMs) / (1000 * 60 * 60 * 24));
                                                return (
                                                    <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-xs">
                                                        {diffDays < 0 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                                                <span>🛑</span>
                                                                <span>منتهي الصلاحية ({item.expiryDate})</span>
                                                            </span>
                                                        ) : diffDays <= 30 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse-slow">
                                                                <span>⏳</span>
                                                                <span>ينتهي خلال {diffDays} يوم ({item.expiryDate})</span>
                                                            </span>
                                                        ) : diffDays <= 60 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                <span>🕒</span>
                                                                <span>ينتهي خلال {diffDays} يوم</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
                                                                صلاحية: {item.expiryDate}
                                                            </span>
                                                        )}
                                                        {item.batchNumber && (
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                                                تشغيلة: {item.batchNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Card Actions Footer: Edit, Barcode, Delete */}
                                        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 mt-2">
                                            {/* Edit Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(item)}
                                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                                            >
                                                <Edit size={13} />
                                                <span>{t('edit')}</span>
                                            </button>

                                            {/* Barcode Print Button (for products) */}
                                            {isProduct && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setBarcodeModalItem(item);
                                                        setBarcodeLabelCount(1);
                                                    }}
                                                    className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                                                    title={language === 'ar' ? 'طباعة ملصق باركود' : 'Print Barcode'}
                                                >
                                                    <Printer size={13} />
                                                </button>
                                            )}

                                            {/* Delete Button */}
                                            <button
                                                type="button"
                                                onClick={() => setItemToDelete(item)}
                                                className="flex items-center justify-center p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
                                                title={language === 'ar' ? 'حذف الصنف' : 'Delete'}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Add / Edit Item Modal */}
            {isItemModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                {itemForm.type === 'service' ? <Scissors size={18} className="text-purple-600" /> : <Package size={18} className="text-primary-600" />}
                                {editingItem 
                                    ? (language === 'ar' ? `تعديل الصنف: ${editingItem.nameAr}` : `Edit: ${editingItem.nameAr}`)
                                    : (language === 'ar' ? 'إضافة صنف جديد (منتج أو خدمة)' : 'Add New Item')}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsItemModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveItem} className="p-5 overflow-y-auto space-y-4">
                            {/* Type Switcher (Product vs Service) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    {language === 'ar' ? 'نوع الصنف *' : 'Item Type *'}
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setItemForm(prev => ({ ...prev, type: 'product', trackStock: true }))}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                                            itemForm.type === 'product'
                                                ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-500 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/20'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Package size={16} />
                                        <span>{language === 'ar' ? '📦 منتج ملموس (له كمية)' : 'Product (Has Stock)'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setItemForm(prev => ({ ...prev, type: 'service', trackStock: false, quantity: 0 }))}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                                            itemForm.type === 'service'
                                                ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Scissors size={16} />
                                        <span>{language === 'ar' ? '✂️ خدمة صالون (بدون مخزون)' : 'Service (No Stock)'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Names */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {language === 'ar' ? 'اسم الصنف بالعربية *' : 'Name (Arabic) *'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder={language === 'ar' ? 'مثال: شامبو كرياتين 500 مل' : 'Item name...'}
                                        value={itemForm.nameAr}
                                        onChange={(e) => setItemForm(prev => ({ ...prev, nameAr: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {language === 'ar' ? 'الاسم بالإنجليزية (اختياري)' : 'Name (English)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Keratin Shampoo..."
                                        value={itemForm.nameEn}
                                        onChange={(e) => setItemForm(prev => ({ ...prev, nameEn: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>

                            {/* Category & Barcode */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {language === 'ar' ? 'التصنيف' : 'Category'}
                                    </label>
                                    <select
                                        value={itemForm.categoryId}
                                        onChange={(e) => setItemForm(prev => ({ ...prev, categoryId: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">{language === 'ar' ? '-- بدون تصنيف --' : '-- No Category --'}</option>
                                        {state.categories.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {language === 'ar' ? c.nameAr : c.nameEn}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex justify-between items-center">
                                        <span>{language === 'ar' ? 'الباركود (Barcode)' : 'Barcode'}</span>
                                        <button
                                            type="button"
                                            onClick={handleGenerateBarcode}
                                            className="text-[11px] text-primary-600 hover:underline font-semibold"
                                        >
                                            {language === 'ar' ? 'توليد تلقائي' : 'Auto Generate'}
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="20xxxxxxxxx"
                                        value={itemForm.barcode}
                                        onChange={(e) => setItemForm(prev => ({ ...prev, barcode: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Pricing & Stock Fields */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {language === 'ar' ? 'سعر البيع (ج.م) *' : 'Sale Price (EGP) *'}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        required
                                        value={itemForm.price || ''}
                                        onChange={(e) => setItemForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono font-bold"
                                    />
                                </div>

                                {itemForm.type === 'product' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {language === 'ar' ? 'سعر التكلفة / الشراء (ج.م)' : 'Cost Price (EGP)'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={itemForm.cost || ''}
                                            onChange={(e) => setItemForm(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <span>✂️ {language === 'ar' ? 'الخدمة تضاف للفاتورة مباشرة بدون حساب تكلفة تخزين' : 'Service goes directly to invoice'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Product-Specific Quantity & Alert Threshold */}
                            {itemForm.type === 'product' && (
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {language === 'ar' ? 'تتبع المخزون والكميات' : 'Track Inventory Stock'}
                                        </span>
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary-600">
                                            <input
                                                type="checkbox"
                                                checked={itemForm.trackStock}
                                                onChange={(e) => setItemForm(prev => ({ ...prev, trackStock: e.target.checked }))}
                                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                            />
                                            <span>{language === 'ar' ? 'تفعيل التتبع' : 'Enable Tracking'}</span>
                                        </label>
                                    </div>

                                    {itemForm.trackStock && (
                                        <>
                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'الكمية الحالية في المخزن *' : 'Stock Quantity *'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    required
                                                    value={itemForm.quantity}
                                                    onChange={(e) => setItemForm(prev => ({ ...prev, quantity: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'حد التنبيه عند نقص الكمية' : 'Alert Threshold'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={itemForm.alertThreshold}
                                                    onChange={(e) => setItemForm(prev => ({ ...prev, alertThreshold: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'تاريخ انتهاء الصلاحية' : 'Expiry Date'}
                                                </label>
                                                <input
                                                    type="date"
                                                    value={itemForm.expiryDate || ''}
                                                    onChange={(e) => setItemForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'رقم التشغيلة / الدفعة (Batch #)' : 'Batch / Lot #'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={itemForm.batchNumber || ''}
                                                    onChange={(e) => setItemForm(prev => ({ ...prev, batchNumber: e.target.value }))}
                                                    placeholder="مثال: BATCH-01"
                                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                                />
                                            </div>
                                        </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <Button type="submit" variant="primary" className="flex-1 justify-center py-2.5 text-sm font-bold shadow-sm">
                                    <Check size={16} />
                                    {language === 'ar' ? 'حفظ الصنف' : 'Save Item'}
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setIsItemModalOpen(false)} className="py-2.5 text-sm">
                                    {t('cancel')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Item Confirmation Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden animate-scale-up p-5 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                            <Trash2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                {language === 'ar' ? 'تأكيد حذف الصنف' : 'Confirm Delete Item'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                                {language === 'ar'
                                    ? `هل أنت متأكد من حذف "${itemToDelete.nameAr || itemToDelete.nameEn}"؟ سيتم حذفه من المخزون وقائمة الفاتورة فوراً.`
                                    : `Are you sure you want to delete "${itemToDelete.nameAr}"? It will be removed from inventory and invoices immediately.`}
                            </p>
                        </div>
                        <div className="flex gap-2.5 pt-2">
                            <Button 
                                type="button" 
                                variant="danger" 
                                onClick={confirmDeleteItem}
                                className="flex-1 justify-center py-2 text-sm font-bold"
                            >
                                {language === 'ar' ? 'نعم، حذف نهائي' : 'Yes, Delete'}
                            </Button>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={() => setItemToDelete(null)}
                                className="py-2 text-sm"
                            >
                                {t('cancel')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Waste / Internal Consumption Modal */}
            {wasteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden animate-scale-up">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Flask size={18} className="text-amber-600" />
                                {language === 'ar' ? 'تسجيل استهلاك صالون / هالك' : 'Record Internal Consumption / Waste'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setWasteModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleRecordWaste} className="p-4 space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    {language === 'ar' ? 'اختر المنتج من المخزون' : 'Select Product'} *
                                </label>
                                <select
                                    required
                                    value={wasteItemId}
                                    onChange={(e) => setWasteItemId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">{language === 'ar' ? '-- اختر منتجاً --' : '-- Select Item --'}</option>
                                    {state.items.filter(i => i.type === 'product').map(item => (
                                        <option key={item.id} value={item.id}>
                                            {language === 'ar' ? item.nameAr : item.nameEn} {item.trackStock ? `(المتاح: ${item.quantity})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                        {language === 'ar' ? 'الكمية المستهلكة' : 'Quantity'} *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={wasteQty}
                                        onChange={(e) => setWasteQty(parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                        {language === 'ar' ? 'السبب' : 'Reason'} *
                                    </label>
                                    <select
                                        value={wasteReason}
                                        onChange={(e) => setWasteReason(e.target.value)}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="internal_use">{language === 'ar' ? 'استهلاك صالون داخلي' : 'Internal Salon Use'}</option>
                                        <option value="damaged">{language === 'ar' ? 'منتج تالف / مكسور' : 'Damaged / Broken'}</option>
                                        <option value="expired">{language === 'ar' ? 'منتهي الصلاحية' : 'Expired'}</option>
                                        <option value="sample">{language === 'ar' ? 'عينة تجريبية' : 'Tester / Sample'}</option>
                                        <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    {language === 'ar' ? 'ملاحظات وتفاصيل إضافية' : 'Additional Notes'}
                                </label>
                                <input
                                    type="text"
                                    placeholder={language === 'ar' ? 'مثال: شامبو غسيل كوافير أو كسر زجاجة...' : 'Notes...'}
                                    value={wasteNotes}
                                    onChange={(e) => setWasteNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="submit" variant="warning" className="flex-1 justify-center py-2 text-sm font-semibold">
                                    {language === 'ar' ? 'خصم من المخزون وتوثيق' : 'Deduct & Log'}
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setWasteModalOpen(false)} className="py-2 text-sm">
                                    {t('cancel')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Barcode Print Setup Modal */}
            {barcodeModalItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden animate-scale-up">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Printer size={18} className="text-primary-500" />
                                {language === 'ar' ? 'طباعة ملصق الباركود' : 'Print Barcode Label'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setBarcodeModalItem(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center space-y-1">
                                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                    {language === 'ar' ? barcodeModalItem.nameAr : barcodeModalItem.nameEn}
                                </div>
                                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                    {barcodeModalItem.barcode || barcodeModalItem.id.slice(0, 8)}
                                </div>
                                <div 
                                    className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-center my-2 overflow-hidden"
                                    dangerouslySetInnerHTML={{ __html: generateCode128Svg(barcodeModalItem.barcode || barcodeModalItem.id.slice(0, 8), { height: 46, moduleWidth: 1.6, showText: true, fontSize: 10 }) }}
                                />
                                <div className="font-bold text-primary-600 dark:text-primary-400 text-sm">
                                    {barcodeModalItem.price} {t('egp')}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    {language === 'ar' ? 'عدد النسخ (الملصقات)' : 'Number of copies'}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={barcodeLabelCount}
                                    onChange={(e) => setBarcodeLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button 
                                    onClick={() => handlePrintBarcode(barcodeModalItem)} 
                                    variant="primary" 
                                    className="flex-1 justify-center py-2 text-sm font-semibold"
                                >
                                    <Printer size={16} className="inline mr-1" />
                                    {language === 'ar' ? 'طباعة الملصقات' : 'Print Labels'}
                                </Button>
                                <Button 
                                    variant="secondary" 
                                    onClick={() => setBarcodeModalItem(null)} 
                                    className="py-2 text-sm"
                                >
                                    {t('cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
