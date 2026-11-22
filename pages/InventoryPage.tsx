const getItemBranchStock = (item: Item, locId?: string): number => {
    if (!item) return 0;
    if (locId && item.locationQuantities && typeof item.locationQuantities[locId] === 'number') {
        return item.locationQuantities[locId];
    }
    return item.quantity;
};
import { generateCode128Svg } from '../lib/barcode';
/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
    Package, Plus, Trash2, Printer, FileText, 
    AlertCircle, Flask, Search, X, 
    Scissors, Tag, MapPin, Users, Activity, Check, Edit,
    Settings, History, BarChart2, TrendingUp, Layers, CheckCircle2, ChevronRight, Copy, Info, Clock, AlertTriangle
} from '../components/Icons';
import { Item } from '../types';
import { Card, Button, EmptyState } from '../components/ui';
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

    // View Mode (Default is 'table' as requested by user)
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

    // Comprehensive Item Settings Modal State (Window with all appropriate item settings)
    const [selectedItemSettings, setSelectedItemSettings] = useState<Item | null>(null);
    const [settingsTab, setSettingsTab] = useState<'general' | 'stock' | 'tools' | 'history'>('general');
    const [settingsForm, setSettingsForm] = useState<Item | null>(null);
    const [quickWasteQty, setQuickWasteQty] = useState(1);
    const [quickWasteReason, setQuickWasteReason] = useState('internal_use');
    const [quickWasteNotes, setQuickWasteNotes] = useState('');
    const [quickBarcodeCopies, setQuickBarcodeCopies] = useState(1);

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

    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;

    useEffect(() => {
        setCurrentPage(1);
    }, [categoryId, typeFilter, searchQuery]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, currentPage, PAGE_SIZE]);

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

    // Open Comprehensive Item Settings & Details Window
    const handleOpenItemSettings = (item: Item, initialTab: 'general' | 'stock' | 'tools' | 'history' = 'general') => {
        const curLocId = state.settings.currentLocationId || '1';
        setSelectedItemSettings(item);
        setSettingsTab(initialTab);
        setSettingsForm({
            ...item,
            cost: item.cost || 0,
            barcode: item.barcode || '',
            quantity: getItemBranchStock(item, curLocId),
            alertThreshold: item.alertThreshold || 5,
            locationQuantities: item.locationQuantities ? { ...item.locationQuantities } : {}
        });
        setQuickWasteQty(1);
        setQuickWasteReason('internal_use');
        setQuickWasteNotes('');
        setQuickBarcodeCopies(1);
    };

    // Save All Item Settings from Comprehensive Window
    const handleSaveItemSettings = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!settingsForm || !selectedItemSettings) return;

        if (!settingsForm.nameAr.trim()) {
            addToast(language === 'ar' ? 'يرجى إدخال اسم الصنف بالعربية' : 'Please enter item name', 'error');
            return;
        }
        if (settingsForm.price < 0) {
            addToast(language === 'ar' ? 'سعر البيع لا يمكن أن يكون سالباً' : 'Price cannot be negative', 'error');
            return;
        }

        const isProduct = settingsForm.type === 'product';
        const curLocId = state.settings.currentLocationId || '1';
        const updatedLocQuantities = { ...(settingsForm.locationQuantities || {}) };
        if (isProduct && settingsForm.trackStock) {
            updatedLocQuantities[curLocId] = Math.max(0, Number(settingsForm.quantity) || 0);
        }

        const finalItem: Item = {
            ...settingsForm,
            nameAr: settingsForm.nameAr.trim(),
            nameEn: (settingsForm.nameEn || settingsForm.nameAr).trim(),
            price: Math.max(0, Number(settingsForm.price) || 0),
            cost: Math.max(0, Number(settingsForm.cost) || 0),
            trackStock: isProduct ? Boolean(settingsForm.trackStock) : false,
            quantity: isProduct ? Math.max(0, Number(settingsForm.quantity) || 0) : 0,
            alertThreshold: isProduct ? Math.max(0, Number(settingsForm.alertThreshold) || 0) : 0,
            barcode: (settingsForm.barcode || '').trim(),
            locationQuantities: updatedLocQuantities,
            variants: settingsForm.variants || [],
            modifiers: settingsForm.modifiers || [],
        };

        updateItem(finalItem);

        const oldQty = getItemBranchStock(selectedItemSettings, curLocId);
        if (isProduct && oldQty !== finalItem.quantity) {
            const diff = finalItem.quantity - oldQty;
            addInventoryHistory({
                itemId: finalItem.id,
                type: 'adjustment',
                quantityChange: diff,
                reason: language === 'ar' ? 'تعديل كمية المخزون عبر نافذة الإعدادات' : 'Stock adjusted via item settings window',
                locationId: curLocId,
                unitPrice: finalItem.cost || finalItem.price,
                totalValue: (finalItem.cost || finalItem.price) * Math.abs(diff)
            });
        }

        addToast(language === 'ar' ? `تم حفظ كافة إعدادات "${finalItem.nameAr}" بنجاح` : `Saved settings for "${finalItem.nameAr}"`, 'success');
        setSelectedItemSettings(null);
        setSettingsForm(null);
    };

    // Quick Waste Record inside Item Settings Modal
    const handleModalQuickWaste = () => {
        if (!settingsForm) return;
        if (quickWasteQty <= 0) {
            addToast(language === 'ar' ? 'يرجى إدخال كمية صحيحة أكبر من صفر' : 'Invalid quantity', 'error');
            return;
        }
        const curQty = settingsForm.quantity;
        if (curQty < quickWasteQty) {
            addToast(language === 'ar' ? 'الكمية المطلوب خصمها أكبر من الرصيد المتوفر' : 'Quantity exceeds current stock', 'warning');
        }

        const reasonLabels: Record<string, string> = {
            internal_use: 'استهلاك صالون داخلي',
            damaged: 'منتج تالف / مكسور',
            expired: 'منتهي الصلاحية',
            sample: 'عينة تجريبية للعميل',
            other: 'أخرى'
        };
        const fullReason = `${reasonLabels[quickWasteReason] || quickWasteReason}${quickWasteNotes.trim() ? ` - ${quickWasteNotes.trim()}` : ''}`;
        const newQty = Math.max(0, curQty - quickWasteQty);
        const curLocId = state.settings.currentLocationId || '1';
        const updatedLocQuantities = { ...(settingsForm.locationQuantities || {}) };
        updatedLocQuantities[curLocId] = newQty;

        const updatedItem: Item = {
            ...settingsForm,
            quantity: newQty,
            locationQuantities: updatedLocQuantities
        };

        updateItem(updatedItem);
        setSettingsForm(updatedItem);

        addInventoryHistory({
            itemId: settingsForm.id,
            type: 'adjustment',
            quantityChange: -quickWasteQty,
            reason: fullReason,
            locationId: curLocId,
            unitPrice: settingsForm.cost || settingsForm.price || 0,
            totalValue: (settingsForm.cost || settingsForm.price || 0) * quickWasteQty
        });

        addToast(language === 'ar' ? `تم خصم ${quickWasteQty} وتوثيق الهالك بنجاح` : 'Waste recorded successfully', 'success');
        setQuickWasteNotes('');
        setQuickWasteQty(1);
    };

    // Open Edit Modal (opens comprehensive Item Settings Window)
    const handleOpenEditModal = (item: Item) => {
        handleOpenItemSettings(item, 'general');
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
            cost: Math.max(0, Number(itemForm.cost) || 0),
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
        const curBranchId = state.settings.currentLocationId || '1';
        const currentLocQty = getItemBranchStock(item, curBranchId);
        const newLocQty = Math.max(0, currentLocQty + delta);
        const newQty = Math.max(0, item.quantity + delta);
        updateItem({ 
            ...item, 
            quantity: newQty,
            locationQuantities: {
                ...(item.locationQuantities || {}),
                [curBranchId]: newLocQty
            }
        });
        addInventoryHistory({
            itemId: item.id,
            type: 'adjustment',
            quantityChange: delta,
            reason: language === 'ar' ? (delta > 0 ? 'زيادة سريعة (+1)' : 'نقصان سريع (-1)') : 'Quick stock tweak',
            locationId: curBranchId,
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
                        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                                <span>{language === 'ar' ? 'إجمالي الأصناف' : 'Total Items'}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800/40">الكتالوج</span>
                            </div>
                            <h4 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">{stats.total}</h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">{stats.productsCount} منتج • {stats.servicesCount} خدمة</p>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                                <span>{language === 'ar' ? 'المنتجات بالمخزن' : 'Products Stock'}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 font-bold border border-primary-200 dark:border-primary-800/40">رصيد</span>
                            </div>
                            <h4 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                                {stats.totalUnits} <span className="text-xs font-bold text-slate-400">قطعة</span>
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">{stats.productsCount} منتج مسجل</p>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                                <span>{language === 'ar' ? 'الخدمات المتاحة' : 'Salon Services'}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/40">خدمات</span>
                            </div>
                            <h4 className="text-2xl font-extrabold text-emerald-500 font-mono tracking-tight">{stats.servicesCount}</h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">{language === 'ar' ? 'خدمات بدون مخزون' : 'No stock tracking'}</p>
                        </div>

                        <div className={`relative overflow-hidden rounded-2xl p-4 border  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${
                            stats.lowStockCount > 0 
                                ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60' 
                                : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80'
                        }`}>
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                                <span className={stats.lowStockCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}>
                                    {language === 'ar' ? 'نواقص المخزون' : 'Low Stock'}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                    stats.lowStockCount > 0 
                                        ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' 
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                                }`}>
                                    {stats.lowStockCount > 0 ? 'تنبيه' : 'متوفر'}
                                </span>
                            </div>
                            <h4 className={`text-2xl font-extrabold font-mono tracking-tight ${stats.lowStockCount > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-white'}`}>
                                {stats.lowStockCount}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">{stats.lowStockCount > 0 ? 'تحتاج لتوريد عاجل' : 'المخزون متوفر بالكامل'}</p>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* Type Filters: All, Products, Services, Low Stock */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                            {[
                                { id: 'all', label: language === 'ar' ? `الكل (${stats.total})` : `All (${stats.total})` },
                                { id: 'product', label: language === 'ar' ? `المنتجات (${stats.productsCount})` : `Products (${stats.productsCount})` },
                                { id: 'service', label: language === 'ar' ? `الخدمات (${stats.servicesCount})` : `Services (${stats.servicesCount})` },
                                { id: 'low_stock', label: language === 'ar' ? `النواقص (${stats.lowStockCount})` : `Low Stock (${stats.lowStockCount})` },
                                { id: 'expiring_soon', label: language === 'ar' ? `أوشك على الانتهاء (${stats.expiringSoonCount})` : `Expiring Soon (${stats.expiringSoonCount})` },
                                { id: 'expired', label: language === 'ar' ? `منتهي الصلاحية (${stats.expiredCount})` : `Expired (${stats.expiredCount})` },
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

                        <div className="flex items-center gap-2.5 flex-1 max-w-lg justify-end">
                            <div className="relative flex-1 max-w-xs">
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

                            {/* View Mode Switcher: Table (Default) / Cards */}
                            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl shrink-0 border border-slate-200 dark:border-slate-600">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('table')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        viewMode === 'table'
                                            ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                    title={language === 'ar' ? 'عرض جدول بيانات' : 'Table View'}
                                >
                                    <Layers size={13} />
                                    <span>{language === 'ar' ? 'جدول' : 'Table'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('cards')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        viewMode === 'cards'
                                            ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                    title={language === 'ar' ? 'عرض كروت' : 'Cards View'}
                                >
                                    <Tag size={13} />
                                    <span>{language === 'ar' ? 'كروت' : 'Cards'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Interactive Notice */}
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                            <Info size={14} className="text-primary-600 dark:text-primary-400 shrink-0" />
                            <span className="font-medium">
                                {language === 'ar' 
                                    ? 'انقر على أي سطر في الجدول لفتح نافذة إعدادات وتفاصيل الصنف الشاملة (تعديل الأسعار، رصيد الفروع، الباركود، وسجل الحركات).' 
                                    : 'Click on any row to open the complete item settings window (pricing, branch stock, barcode, and history).'}
                            </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                            {language === 'ar' ? `${filtered.length} صنف` : `${filtered.length} items`}
                        </span>
                    </div>

                    {/* Empty State */}
                    {filtered.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState 
                                icon={Package}
                                title={t('no_items') || (language === 'ar' ? 'المخزون فارغ حالياً' : 'No items found')}
                                description={language === 'ar' ? 'لم تقم بإضافة أي أصناف أو منتجات بعد. أضف أول منتج للبدء بالبيع عبر الكاشير.' : 'You have not added any items yet. Add your first item to start selling.'}
                                action={
                                    <Button 
                                        variant="primary" 
                                        onClick={() => handleOpenAddModal('product')}
                                        className="text-xs py-2 px-5 shadow-sm font-bold"
                                    >
                                        <Plus size={15} /> {language === 'ar' ? 'إضافة أول صنف بالمخزون' : 'Add First Item'}
                                    </Button>
                                }
                            />
                        </div>
                    ) : viewMode === 'table' ? (
                        /* ================== TABLE VIEW (Default) ================== */
                        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                                        <tr>
                                            <th className="py-3 px-3.5 w-10 text-center">#</th>
                                            <th className="py-3 px-4 min-w-[210px]">{language === 'ar' ? 'اسم الصنف / الباركود' : 'Item / Barcode'}</th>
                                            <th className="py-3 px-3.5 min-w-[125px]">{language === 'ar' ? 'التصنيف والنوع' : 'Category & Type'}</th>
                                            <th className="py-3 px-3.5 text-center min-w-[95px]">{language === 'ar' ? 'سعر البيع' : 'Sale Price'}</th>
                                            <th className="py-3 px-3.5 text-center min-w-[110px]">{language === 'ar' ? 'التكلفة والربح' : 'Cost & Margin'}</th>
                                            <th className="py-3 px-3.5 text-center min-w-[165px]">{language === 'ar' ? 'المخزون والحالة' : 'Stock & Health'}</th>
                                            <th className="py-3 px-3.5 text-center min-w-[120px]">{language === 'ar' ? 'الصلاحية والتشغيلة' : 'Expiry & Batch'}</th>
                                            <th className="py-3 px-4 text-center w-36">{language === 'ar' ? 'الإعدادات' : 'Actions'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                        {paginatedItems.map((item, index) => {
                                            const isProduct = item.type === 'product';
                                            const curBranchQty = getItemBranchStock(item, state.settings.currentLocationId || '1');
                                            const isLowStock = isProduct && item.trackStock && curBranchQty <= item.alertThreshold;
                                            const isOutOfStock = isProduct && item.trackStock && curBranchQty <= 0;
                                            const categoryName = state.categories.find(c => c.id === item.categoryId)?.nameAr || state.categories.find(c => c.id === item.categoryId)?.nameEn;
                                            const profitPerUnit = item.cost ? (item.price - item.cost) : 0;
                                            const markupPct = item.cost && item.cost > 0 ? Math.round(((item.price - item.cost) / item.cost) * 100) : 0;

                                            return (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => handleOpenItemSettings(item)}
                                                    className="group cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-all duration-150"
                                                    title={language === 'ar' ? 'انقر لفتح نافذة إعدادات وتفاصيل الصنف' : 'Click to open item settings'}
                                                >
                                                    {/* Row Index */}
                                                    <td className="py-3.5 px-3.5 text-center font-mono text-[11px] text-slate-400 group-hover:text-primary-600 font-bold">
                                                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                                                    </td>

                                                    {/* Item Name & Barcode */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                                    {language === 'ar' ? item.nameAr : (item.nameEn || item.nameAr)}
                                                                </span>
                                                                {item.returnable === false && (
                                                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                                                                        {language === 'ar' ? 'لا يرد' : 'No Return'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {item.nameEn && language === 'ar' && (
                                                                <span className="text-[11px] text-slate-400 font-normal">{item.nameEn}</span>
                                                            )}
                                                            {item.barcode && (
                                                                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mt-0.5">
                                                                    <Tag size={10} />
                                                                    <span>{item.barcode}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Category & Type */}
                                                    <td className="py-3.5 px-3.5">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {categoryName ? (
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                                    <Tag size={10} className="text-slate-400" />
                                                                    {categoryName}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] text-slate-400 italic">بدون تصنيف</span>
                                                            )}
                                                            {isProduct ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50">
                                                                    <Package size={10} />
                                                                    {language === 'ar' ? 'منتج ملموس' : 'Product'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/50">
                                                                    <Scissors size={10} />
                                                                    {language === 'ar' ? 'خدمة صالون' : 'Service'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Sale Price */}
                                                    <td className="py-3.5 px-3.5 text-center">
                                                        <span className="font-extrabold text-sm font-mono text-primary-600 dark:text-primary-400">
                                                            {formatNumber(item.price)} {t('egp')}
                                                        </span>
                                                    </td>

                                                    {/* Cost & Margin */}
                                                    <td className="py-3.5 px-3.5 text-center">
                                                        {isProduct && item.cost !== undefined && item.cost > 0 ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                                                    {formatNumber(item.cost)} {t('egp')}
                                                                </span>
                                                                {item.price > item.cost && (
                                                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full mt-0.5 border border-emerald-200/60 dark:border-emerald-800/60 font-mono">
                                                                        +{markupPct}% ({formatNumber(profitPerUnit)})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 font-mono text-xs">-</span>
                                                        )}
                                                    </td>

                                                    {/* Stock Quantity & Health */}
                                                    <td className="py-3.5 px-3.5 text-center">
                                                        {isProduct ? (
                                                            <div className="flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border ${
                                                                        isOutOfStock
                                                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                                                                            : isLowStock
                                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                                                            : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                                                                    }`}>
                                                                        {curBranchQty} {language === 'ar' ? 'قطعة' : 'pcs'}
                                                                    </span>
                                                                    <div className="flex items-center gap-0.5">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleQuickQuantityDelta(item, -1)}
                                                                            disabled={curBranchQty <= 0}
                                                                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center disabled:opacity-30 transition-colors"
                                                                            title="-1"
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleQuickQuantityDelta(item, 1)}
                                                                            className="w-5 h-5 rounded bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center transition-colors"
                                                                            title="+1"
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {/* Mini stock health bar */}
                                                                {item.trackStock && (
                                                                    <div className="w-24 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                                isOutOfStock ? 'bg-rose-500 w-full' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                                                                            }`}
                                                                            style={{
                                                                                width: isOutOfStock ? '100%' : `${Math.min(100, Math.max(10, (curBranchQty / Math.max((item.alertThreshold || 5) * 3, 10)) * 100))}%`
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-200/50 dark:border-purple-800/40">
                                                                <Scissors size={11} />
                                                                <span>{language === 'ar' ? 'خدمة صالون' : 'Service'}</span>
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Expiry & Batch */}
                                                    <td className="py-3.5 px-3.5 text-center">
                                                        {isProduct && item.expiryDate ? (
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 font-medium">
                                                                    {item.expiryDate}
                                                                </span>
                                                                {item.batchNumber && (
                                                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                                                                        #{item.batchNumber}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">-</span>
                                                        )}
                                                    </td>

                                                    {/* Settings & Actions */}
                                                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenItemSettings(item)}
                                                                className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/80 dark:border-primary-800/70 hover:bg-primary-100 hover:shadow-xs transition-all"
                                                                title={language === 'ar' ? 'فتح كافة إعدادات وتفاصيل الصنف' : 'Open Item Settings'}
                                                            >
                                                                <Settings size={13} className="text-primary-600 dark:text-primary-400" />
                                                                <span>{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
                                                            </button>

                                                            {isProduct && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setBarcodeModalItem(item);
                                                                        setBarcodeLabelCount(1);
                                                                    }}
                                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                    title={language === 'ar' ? 'طباعة ملصق باركود' : 'Print Barcode'}
                                                                >
                                                                    <Printer size={13} />
                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => setItemToDelete(item)}
                                                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                                title={language === 'ar' ? 'حذف الصنف' : 'Delete'}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* ================== CARDS VIEW ================== */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paginatedItems.map(item => {
                                const isProduct = item.type === 'product';
                                const curBranchQty = getItemBranchStock(item, state.settings.currentLocationId || '1');
                                const isLowStock = isProduct && item.trackStock && curBranchQty <= item.alertThreshold;
                                const categoryName = state.categories.find(c => c.id === item.categoryId)?.nameAr || state.categories.find(c => c.id === item.categoryId)?.nameEn;

                                return (
                                    <Card 
                                        key={item.id} 
                                        onClick={() => handleOpenItemSettings(item)}
                                        className={`relative flex flex-col justify-between transition-all hover:shadow-md cursor-pointer ${
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
                                            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 leading-snug">
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
                                                                <div className="flex items-center gap-1.5 font-mono">
                                                                    <span>{formatNumber(item.cost)} {t('egp')}</span>
                                                                    {item.price > item.cost && (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                            +{Math.round(((item.price - item.cost) / item.cost) * 100)}%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                                                            <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'الكمية في المخزن:' : 'In Stock:'}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`font-bold font-mono px-2.5 py-0.5 rounded-lg text-xs ${
                                                                    curBranchQty <= 0
                                                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300'
                                                                        : isLowStock 
                                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300' 
                                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                                                                }`}>
                                                                    {curBranchQty} {language === 'ar' ? 'قطعة' : 'pcs'}
                                                                </span>
                                                                {/* Quick +/- buttons */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickQuantityDelta(item, -1)}
                                                                    disabled={curBranchQty <= 0}
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

                                                        {/* مؤشر سلامة المخزون البصري */}
                                                        {item.trackStock && (
                                                            <div className="pt-1.5">
                                                                <div className="flex justify-between items-center text-[10px] mb-1 font-medium">
                                                                    <span className={curBranchQty <= 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : isLowStock ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                                                                        {curBranchQty <= 0 
                                                                            ? (language === 'ar' ? 'نفد المخزون تماماً' : 'Out of stock')
                                                                            : isLowStock 
                                                                            ? (language === 'ar' ? 'مخزون حرج (يحتاج توريد)' : 'Low stock warning')
                                                                            : (language === 'ar' ? 'متوفر بالمستودع' : 'In stock (Safe)')}
                                                                    </span>
                                                                    <span className="text-slate-400 font-mono text-[9px]">
                                                                        {language === 'ar' ? `حد الطلب: ${item.alertThreshold || 5}` : `Reorder: ${item.alertThreshold || 5}`}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                                            curBranchQty <= 0 
                                                                                ? 'bg-rose-500 w-full' 
                                                                                : isLowStock 
                                                                                ? 'bg-amber-500' 
                                                                                : 'bg-emerald-500'
                                                                        }`}
                                                                        style={{ 
                                                                            width: curBranchQty <= 0 ? '100%' : `${Math.min(100, Math.max(8, (curBranchQty / Math.max((item.alertThreshold || 5) * 3, 10)) * 100))}%` 
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
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
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                                                <span>منتهي الصلاحية ({item.expiryDate})</span>
                                                            </span>
                                                        ) : diffDays <= 30 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                                                <Clock size={11} />
                                                                <span>ينتهي خلال {diffDays} يوم ({item.expiryDate})</span>
                                                            </span>
                                                        ) : diffDays <= 60 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
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

                                        {/* Card Actions Footer: Settings, Barcode, Delete */}
                                        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 mt-2" onClick={(e) => e.stopPropagation()}>
                                            {/* Settings Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleOpenItemSettings(item)}
                                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60 hover:bg-primary-100 transition-colors"
                                            >
                                                <Settings size={13} />
                                                <span>{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
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
                            })}
                        </div>
                    )}

                    {/* شريط ترقيم الصفحات وسرعة التصفح لكتالوج الأصناف الضخم */}
                    {filtered.length > PAGE_SIZE && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 mt-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-bold shadow-xs">
                            <div className="text-slate-500 dark:text-slate-400">
                                {language === 'ar' ? (
                                    <span>عرض <strong className="text-slate-900 dark:text-slate-100 font-mono">{(currentPage - 1) * PAGE_SIZE + 1}</strong> إلى <strong className="text-slate-900 dark:text-slate-100 font-mono">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> من إجمالي <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{filtered.length}</strong> صنف</span>
                                ) : (
                                    <span>Showing <strong>{(currentPage - 1) * PAGE_SIZE + 1}</strong> to <strong>{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> items</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    {language === 'ar' ? 'السابق' : 'Previous'}
                                </button>
                                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono border border-emerald-500/20">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    {language === 'ar' ? 'التالي' : 'Next'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Comprehensive Item Settings & Details Window */}
            {selectedItemSettings && settingsForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    settingsForm.type === 'service' 
                                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400' 
                                        : 'bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'
                                }`}>
                                    {settingsForm.type === 'service' ? <Scissors size={20} /> : <Package size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-extrabold text-base sm:text-lg text-slate-800 dark:text-slate-100">
                                            {language === 'ar' ? settingsForm.nameAr : (settingsForm.nameEn || settingsForm.nameAr)}
                                        </h3>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                            settingsForm.type === 'service'
                                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                                : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                        }`}>
                                            {settingsForm.type === 'service' ? (language === 'ar' ? 'خدمة صالون' : 'Service') : (language === 'ar' ? 'منتج ملموس' : 'Product')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                        <span>{language === 'ar' ? 'نافذة الإعدادات الشاملة والكميات' : 'Item Settings & Control Hub'}</span>
                                        {settingsForm.barcode && (
                                            <span className="font-mono text-[11px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                                #{settingsForm.barcode}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedItemSettings(null);
                                    setSettingsForm(null);
                                }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Navigation Tabs inside Settings Window */}
                        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setSettingsTab('general')}
                                className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                                    settingsTab === 'general'
                                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                            >
                                <Settings size={15} />
                                <span>{language === 'ar' ? 'البيانات والأسعار' : 'General & Pricing'}</span>
                            </button>

                            {settingsForm.type === 'product' && (
                                <button
                                    type="button"
                                    onClick={() => setSettingsTab('stock')}
                                    className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                                        settingsTab === 'stock'
                                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Package size={15} />
                                    <span>{language === 'ar' ? 'المخزون والفروع' : 'Stock & Branches'}</span>
                                </button>
                            )}

                            {settingsForm.type === 'product' && (
                                <button
                                    type="button"
                                    onClick={() => setSettingsTab('tools')}
                                    className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                                        settingsTab === 'tools'
                                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Printer size={15} />
                                    <span>{language === 'ar' ? 'طباعة وهالك' : 'Print & Waste'}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setSettingsTab('history')}
                                className={`flex items-center gap-1.5 py-2.5 px-3.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${
                                    settingsTab === 'history'
                                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                            >
                                <History size={15} />
                                <span>{language === 'ar' ? 'سجل الحركات' : 'Audit History'}</span>
                            </button>
                        </div>

                        {/* Modal Body / Tab Content */}
                        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                            {/* TAB 1: General & Pricing */}
                            {settingsTab === 'general' && (
                                <div className="space-y-4 animate-fade-in">
                                    {/* Type switch */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            {language === 'ar' ? 'نوع الصنف' : 'Item Type'}
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setSettingsForm(prev => prev ? ({ ...prev, type: 'product', trackStock: true }) : null)}
                                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                                    settingsForm.type === 'product'
                                                        ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-500 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500/20'
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                                <Package size={15} />
                                                <span>{language === 'ar' ? 'منتج ملموس (له كمية)' : 'Product (Has Stock)'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSettingsForm(prev => prev ? ({ ...prev, type: 'service', trackStock: false, quantity: 0 }) : null)}
                                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                                    settingsForm.type === 'service'
                                                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                                <Scissors size={15} />
                                                <span>{language === 'ar' ? 'خدمة صالون (بدون مخزون)' : 'Service (No Stock)'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Names */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                {language === 'ar' ? 'اسم الصنف بالعربية *' : 'Name (Arabic) *'}
                                            </label>
                                            <input
                                                type="text"
                                                value={settingsForm.nameAr}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, nameAr: e.target.value }) : null)}
                                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                {language === 'ar' ? 'الاسم بالإنجليزية' : 'Name (English)'}
                                            </label>
                                            <input
                                                type="text"
                                                value={settingsForm.nameEn || ''}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, nameEn: e.target.value }) : null)}
                                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Category & Barcode */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                {language === 'ar' ? 'التصنيف' : 'Category'}
                                            </label>
                                            <select
                                                value={settingsForm.categoryId}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, categoryId: e.target.value }) : null)}
                                                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
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
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {language === 'ar' ? 'الباركود (Barcode)' : 'Barcode'}
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const randomCode = '20' + Math.floor(1000000000 + Math.random() * 9000000000);
                                                        setSettingsForm(prev => prev ? ({ ...prev, barcode: randomCode }) : null);
                                                    }}
                                                    className="text-[11px] text-primary-600 hover:underline font-semibold"
                                                >
                                                    {language === 'ar' ? 'توليد تلقائي' : 'Auto Generate'}
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={settingsForm.barcode || ''}
                                                    onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, barcode: e.target.value }) : null)}
                                                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                                />
                                                {settingsForm.barcode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(settingsForm.barcode || '');
                                                            addToast(language === 'ar' ? 'تم نسخ الباركود' : 'Copied barcode', 'info');
                                                        }}
                                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                                        title="نسخ"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pricing & Margins */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                {language === 'ar' ? 'سعر البيع (ج.م) *' : 'Sale Price (EGP) *'}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                value={settingsForm.price || ''}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, price: parseFloat(e.target.value) || 0 }) : null)}
                                                className="w-full px-3 py-2 text-base font-extrabold font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                {language === 'ar' ? 'سعر التكلفة / الشراء (ج.م)' : 'Cost Price (EGP)'}
                                            </label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                value={settingsForm.cost || ''}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, cost: parseFloat(e.target.value) || 0 }) : null)}
                                                className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Visual Profit & Markup Calculator Card */}
                                    {settingsForm.price > 0 && (
                                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between text-xs mb-2">
                                                <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                    <TrendingUp size={15} className="text-emerald-500" />
                                                    <span>{language === 'ar' ? 'حاسبة هامش الربح المتوقع لكل قطعة:' : 'Unit Profit & Markup Calculation:'}</span>
                                                </span>
                                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                    {settingsForm.cost && settingsForm.cost > 0
                                                        ? `+${Math.round(((settingsForm.price - settingsForm.cost) / settingsForm.cost) * 100)}% هامش ربح`
                                                        : (language === 'ar' ? 'هامش 100%' : '100% Margin')}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                <div className="p-2 rounded-lg bg-white dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600">
                                                    <div className="text-[10px] text-slate-400">{language === 'ar' ? 'التكلفة' : 'Cost'}</div>
                                                    <div className="font-bold font-mono text-slate-700 dark:text-slate-200 mt-0.5">{formatNumber(settingsForm.cost || 0)} ج.م</div>
                                                </div>
                                                <div className="p-2 rounded-lg bg-white dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600">
                                                    <div className="text-[10px] text-slate-400">{language === 'ar' ? 'سعر البيع' : 'Sale'}</div>
                                                    <div className="font-bold font-mono text-primary-600 dark:text-primary-400 mt-0.5">{formatNumber(settingsForm.price)} ج.م</div>
                                                </div>
                                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{language === 'ar' ? 'صافي الربح' : 'Net Profit'}</div>
                                                    <div className="font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                                                        +{formatNumber(Math.max(0, settingsForm.price - (settingsForm.cost || 0)))} ج.م
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Returnable toggle */}
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                {language === 'ar' ? 'السماح بإرجاع هذا الصنف في المرتجعات' : 'Allow Return for this Item'}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {language === 'ar' ? 'في حال التعطيل يمنع الكاشير من استرجاع هذا الصنف بالفاتورة' : 'Disables return of this item on POS invoices'}
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.returnable !== false}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, returnable: e.target.checked }) : null)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Stock & Branches */}
                            {settingsTab === 'stock' && settingsForm.type === 'product' && (
                                <div className="space-y-4 animate-fade-in">
                                    {/* Enable stock tracking */}
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                                        <div>
                                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                {language === 'ar' ? 'تتبع المخزون والكميات' : 'Track Inventory Stock'}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {language === 'ar' ? 'خصم الكمية تلقائياً مع كل عملية بيع وإظهار التنبيهات' : 'Auto-deduct stock on sales and trigger alerts'}
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.trackStock}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, trackStock: e.target.checked }) : null)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                        </label>
                                    </div>

                                    {/* Quantity & Threshold */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'الكمية في المخزن الحالي *' : 'Current Branch Stock *'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={settingsForm.quantity}
                                                    onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, quantity: Math.max(0, parseInt(e.target.value) || 0) }) : null)}
                                                    className="w-full px-3 py-2 text-base font-extrabold font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'حد التنبيه عند نقص المخزون' : 'Alert Threshold (Reorder)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={settingsForm.alertThreshold}
                                                    onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, alertThreshold: Math.max(0, parseInt(e.target.value) || 0) }) : null)}
                                                    className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                        </div>

                                        {/* Quick delta buttons */}
                                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200 dark:border-slate-700">
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{language === 'ar' ? 'تعديل سريع للرصيد:' : 'Quick adjust:'}</span>
                                            {[-10, -5, -1, 1, 5, 10, 50].map(delta => (
                                                <button
                                                    key={delta}
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = Number(settingsForm.quantity) || 0;
                                                        const nextVal = Math.max(0, cur + delta);
                                                        setSettingsForm(prev => prev ? ({ ...prev, quantity: nextVal }) : null);
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                                                        delta < 0
                                                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                    }`}
                                                >
                                                    {delta > 0 ? `+${delta}` : delta}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Expiry & Batch */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                {language === 'ar' ? 'تاريخ انتهاء الصلاحية' : 'Expiry Date'}
                                            </label>
                                            <input
                                                type="date"
                                                value={settingsForm.expiryDate || ''}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, expiryDate: e.target.value }) : null)}
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                {language === 'ar' ? 'رقم التشغيلة / الدفعة (Batch #)' : 'Batch Number'}
                                            </label>
                                            <input
                                                type="text"
                                                value={settingsForm.batchNumber || ''}
                                                onChange={(e) => setSettingsForm(prev => prev ? ({ ...prev, batchNumber: e.target.value }) : null)}
                                                placeholder="BATCH-001"
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Multi-Location Quantities Breakdown (if multiple branches exist) */}
                                    {state.locations && state.locations.length > 0 && (
                                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                                                <MapPin size={14} className="text-primary-600" />
                                                <span>{language === 'ar' ? 'رصيد الصنف في فروع المؤسسة:' : 'Stock Distribution Across Branches:'}</span>
                                            </h5>
                                            <div className="space-y-2">
                                                {state.locations.map(loc => {
                                                    const isCur = loc.id === (state.settings.currentLocationId || '1');
                                                    const locQty = settingsForm.locationQuantities && typeof settingsForm.locationQuantities[loc.id] === 'number'
                                                        ? settingsForm.locationQuantities[loc.id]
                                                        : (isCur ? settingsForm.quantity : 0);
                                                    return (
                                                        <div key={loc.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                                            isCur 
                                                                ? 'bg-primary-50/50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800' 
                                                                : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                                                        }`}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{loc.name}</span>
                                                                {isCur && (
                                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold">
                                                                        {language === 'ar' ? 'الفرع الحالي' : 'Current'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={locQty}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                                                        setSettingsForm(prev => {
                                                                            if (!prev) return null;
                                                                            const newLocQ = { ...(prev.locationQuantities || {}), [loc.id]: val };
                                                                            return {
                                                                                ...prev,
                                                                                quantity: isCur ? val : prev.quantity,
                                                                                locationQuantities: newLocQ
                                                                            };
                                                                        });
                                                                    }}
                                                                    className="w-20 px-2 py-1 text-center font-mono text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                                                />
                                                                <span className="text-[11px] text-slate-400 font-medium">{language === 'ar' ? 'قطعة' : 'pcs'}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: Quick Operations & Barcode Printing */}
                            {settingsTab === 'tools' && settingsForm.type === 'product' && (
                                <div className="space-y-4 animate-fade-in">
                                    {/* Barcode Print Tool */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                <Printer size={15} className="text-primary-600" />
                                                <span>{language === 'ar' ? 'طباعة ملصقات الباركود لهذا الصنف' : 'Print Barcode Labels'}</span>
                                            </h5>
                                            <span className="font-mono text-xs text-slate-400">#{settingsForm.barcode || settingsForm.id.slice(0,8)}</span>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                                            <div 
                                                className="overflow-hidden max-w-full"
                                                dangerouslySetInnerHTML={{ __html: generateCode128Svg(settingsForm.barcode || settingsForm.id.slice(0, 8), { height: 42, moduleWidth: 1.5, showText: true, fontSize: 10 }) }}
                                            />
                                            <div className="text-xs font-extrabold text-primary-600 dark:text-primary-400 mt-1">
                                                {formatNumber(settingsForm.price)} {t('egp')}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{language === 'ar' ? 'عدد النسخ:' : 'Copies:'}</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="200"
                                                    value={quickBarcodeCopies}
                                                    onChange={(e) => setQuickBarcodeCopies(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-16 px-2 py-1.5 text-center font-mono text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="primary"
                                                onClick={() => {
                                                    setBarcodeLabelCount(quickBarcodeCopies);
                                                    handlePrintBarcode(settingsForm);
                                                }}
                                                className="flex-1 justify-center py-2 text-xs font-bold shadow-xs"
                                            >
                                                <Printer size={15} />
                                                <span>{language === 'ar' ? 'طباعة الملصقات الآن' : 'Print Labels Now'}</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Quick Waste / Internal Use Tool */}
                                    <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-3">
                                        <h5 className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                            <Flask size={15} className="text-amber-600" />
                                            <span>{language === 'ar' ? 'تسجيل هالك أو استهلاك صالون فوري' : 'Record Waste or Internal Consumption'}</span>
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'الكمية المستهلكة *' : 'Quantity *'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={settingsForm.quantity}
                                                    value={quickWasteQty}
                                                    onChange={(e) => setQuickWasteQty(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-full px-3 py-1.5 text-sm font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'السبب *' : 'Reason *'}
                                                </label>
                                                <select
                                                    value={quickWasteReason}
                                                    onChange={(e) => setQuickWasteReason(e.target.value)}
                                                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
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
                                            <input
                                                type="text"
                                                placeholder={language === 'ar' ? 'ملاحظة إضافية (اختياري)...' : 'Notes...'}
                                                value={quickWasteNotes}
                                                onChange={(e) => setQuickWasteNotes(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="warning"
                                            onClick={handleModalQuickWaste}
                                            className="w-full justify-center py-2 text-xs font-bold"
                                        >
                                            <Flask size={14} />
                                            <span>{language === 'ar' ? 'خصم من المخزون وتوثيق الهالك' : 'Deduct & Record Waste'}</span>
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: Audit & Movement History */}
                            {settingsTab === 'history' && (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        <span className="font-bold">{language === 'ar' ? 'سجل حركات المخزون والمبيعات المسجلة لهذا الصنف:' : 'Recent Inventory Movements:'}</span>
                                        <span className="font-mono">
                                            {state.inventoryHistory.filter(h => h.itemId === settingsForm.id).length} {language === 'ar' ? 'حركة' : 'logs'}
                                        </span>
                                    </div>
                                    {(() => {
                                        const itemHistories = state.inventoryHistory
                                            .filter(h => h.itemId === settingsForm.id)
                                            .sort((a, b) => b.timestamp - a.timestamp)
                                            .slice(0, 20);

                                        if (itemHistories.length === 0) {
                                            return (
                                                <div className="text-center py-10 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                    <Activity size={32} className="mx-auto mb-2 opacity-40" />
                                                    <p className="text-xs font-medium">{language === 'ar' ? 'لم تُسجل أي حركات جردية أو مبيعات لهذا الصنف حتى الآن' : 'No inventory movements recorded yet'}</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                                                {itemHistories.map(h => {
                                                    const typeLabels: Record<string, { label: string; color: string }> = {
                                                        sale: { label: language === 'ar' ? 'مبيعات' : 'Sale', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
                                                        purchase: { label: language === 'ar' ? 'شراء وتوريد' : 'Purchase', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
                                                        adjustment: { label: language === 'ar' ? 'تسوية جردية' : 'Adjustment', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
                                                        refund: { label: language === 'ar' ? 'مرتجع' : 'Refund', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
                                                        transfer: { label: language === 'ar' ? 'تحويل فروع' : 'Transfer', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
                                                    };
                                                    const conf = typeLabels[h.type] || { label: h.type, color: 'bg-slate-100 text-slate-700' };
                                                    return (
                                                        <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${conf.color}`}>
                                                                    {conf.label}
                                                                </span>
                                                                <div>
                                                                    <div className="font-semibold text-slate-800 dark:text-slate-100">{h.reason}</div>
                                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                        {new Date(h.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-left font-mono">
                                                                <div className={`font-bold ${h.quantityChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                    {h.quantityChange > 0 ? `+${h.quantityChange}` : h.quantityChange} {language === 'ar' ? 'قطعة' : 'pcs'}
                                                                </div>
                                                                {h.totalValue ? (
                                                                    <div className="text-[10px] text-slate-400">
                                                                        {formatNumber(h.totalValue)} {t('egp')}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    const itm = state.items.find(i => i.id === settingsForm.id);
                                    if (itm) setItemToDelete(itm);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                            >
                                <Trash2 size={15} />
                                <span>{language === 'ar' ? 'حذف الصنف' : 'Delete'}</span>
                            </button>

                            <div className="flex items-center gap-2.5">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setSelectedItemSettings(null);
                                        setSettingsForm(null);
                                    }}
                                    className="py-2 px-4 text-xs font-semibold"
                                >
                                    {t('cancel')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    onClick={() => handleSaveItemSettings()}
                                    className="flex items-center gap-1.5 py-2 px-5 text-xs font-bold shadow-sm"
                                >
                                    <Check size={16} />
                                    <span>{language === 'ar' ? 'حفظ كافة التعديلات' : 'Save Changes'}</span>
                                </Button>
                            </div>
                        </div>
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
                                        <span>{language === 'ar' ? 'منتج ملموس (له كمية)' : 'Product (Has Stock)'}</span>
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
                                        <span>{language === 'ar' ? 'خدمة صالون (بدون مخزون)' : 'Service (No Stock)'}</span>
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

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        {itemForm.type === 'product'
                                            ? (language === 'ar' ? 'سعر التكلفة / الشراء (ج.م)' : 'Cost Price (EGP)')
                                            : (language === 'ar' ? 'المبلغ التجاري / تكلفة الخدمة (ج.م)' : 'Commercial Cost (EGP)')
                                        }
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        placeholder={itemForm.type === 'service' ? (language === 'ar' ? 'اختياري لحساب صافي الأرباح بدقة' : 'Optional for profit') : '0'}
                                        value={itemForm.cost || ''}
                                        onChange={(e) => setItemForm(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                                    />
                                    {itemForm.type === 'service' && (
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {language === 'ar' ? 'المبلغ التجاري للخدمة يُخصم تلقائياً لحساب صافي الأرباح بدقة 100%' : 'Direct service cost used for 100% accurate net profit'}
                                        </p>
                                    )}
                                </div>
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
