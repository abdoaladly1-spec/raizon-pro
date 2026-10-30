/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ModalShell, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { isCashExpense } from '../lib/payments';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const ExpensesPage = () => {
    const { state, addExpense, deleteExpense, t, addToast, currentUser } = useApp();
    const [showAddModal, setShowAddModal] = useState(false);
    useLiveTick();
    const [newExpense, setNewExpense] = useState({
        title: '',
        amount: 0,
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        method: 'cash'
    } as any);

    const handleAdd = () => {
        if (!newExpense.title || !newExpense.amount || !newExpense.category) {
            addToast(t('fill_required_fields'), 'error');
            return;
        }
        
        const expense: Expense = {
            id: Date.now().toString(),
            locationId: state.settings.currentLocationId || '',
            title: newExpense.title!,
            amount: Number(newExpense.amount),
            category: newExpense.category!,
            date: newExpense.date || new Date().toISOString().split('T')[0],
            description: newExpense.description,
            // طريقة السداد: النقدية فقط تُخصم من درج النقدية عند الإغلاق
            method: (newExpense.method || 'cash') as Expense['method'],
            recordedBy: currentUser?.name || t('unknown_staff')
        };

        addExpense(expense);
        addToast(t('expense_added'), 'success');
        setShowAddModal(false);
        setNewExpense({
            title: '',
            amount: 0,
            category: '',
            date: new Date().toISOString().split('T')[0],
            description: '',
            method: 'cash'
        });
    };

    const handleDelete = (id: string) => {
        if (window.confirm(t('confirm_delete_expense'))) {
            const expenseToDelete = state.expenses.find(e => e.id === id);
            deleteExpense(id);
            addToast(t('expense_deleted'), 'success', {
                label: t('undo_action'),
                onClick: () => {
                    if (expenseToDelete) {
                        addExpense(expenseToDelete);
                        addToast(t('expense_restored'), 'success');
                    }
                }
            });
        }
    };

    const totalExpenses = state.expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const todayExpenses = state.expenses
        .filter(e => e.date === new Date().toISOString().split('T')[0])
        .reduce((acc, curr) => acc + curr.amount, 0);
    // المصروفات النقدية فقط (تلك التي تُخصم من درج النقدية عند الإغلاق)
    const todayCashExpenses = state.expenses
        .filter(e => e.date === new Date().toISOString().split('T')[0] && isCashExpense(e))
        .reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <TrendingUp className="text-red-500" /> {t('expenses')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t('expenses')} {t('management_suffix')}</p>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-500/30"
                    >
                        <Plus size={20} />
                        <span>{t('add_expense')}</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('total_expenses')}</p>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalExpenses.toLocaleString('en-US')} {t('egp')}</h3>
                        </div>
                    </div>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('sold_today')} ({t('expenses')})</p>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{todayExpenses.toLocaleString('en-US')} {t('egp')}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-xl">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('cash_expenses_today')}</p>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{todayCashExpenses.toLocaleString('en-US')} {t('egp')}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expenses List */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-300">
                        <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3">{t('expense_title')}</th>
                                <th className="px-6 py-3">{t('expense_category')}</th>
                                <th className="px-6 py-3">{t('date')}</th>
                                <th className="px-6 py-3">{t('paid_by')}</th>
                                <th className="px-6 py-3">{t('recorded_by')}</th>
                                <th className="px-6 py-3">{t('expense_amount')}</th>
                                <th className="px-6 py-3">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-slate-500">{t('no_data')}</td>
                                </tr>
                            ) : (
                                state.expenses.slice().reverse().map((expense) => (
                                    <tr key={expense.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                            {expense.title}
                                            {expense.description && <div className="text-xs text-slate-500 font-normal">{expense.description}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{expense.date}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                (expense.method || 'cash') === 'cash' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                                {t(expense.method || 'cash')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{expense.recordedBy}</td>
                                        <td className="px-6 py-4 font-bold text-red-600">
                                            {expense.amount.toLocaleString('en-US')} {t('egp')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => handleDelete(expense.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add Expense Modal */}
            {showAddModal && (
                <ModalShell
                    title={t('add_expense')}
                    onClose={() => setShowAddModal(false)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4">
                            <Input 
                                label={t('expense_title')} 
                                value={newExpense.title} 
                                onChange={(e: any) => setNewExpense({...newExpense, title: e.target.value})} 
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label={t('expense_amount')} 
                                    type="number"
                                    value={newExpense.amount} 
                                    onChange={(e: any) => setNewExpense({...newExpense, amount: e.target.value})} 
                                />
                                <Input 
                                    label={t('expense_category')} 
                                    value={newExpense.category} 
                                    onChange={(e: any) => setNewExpense({...newExpense, category: e.target.value})} 
                                    placeholder={t('ph_expense_name')}
                                />
                            </div>
                            <Input 
                                label={t('date')} 
                                type="date"
                                value={newExpense.date} 
                                onChange={(e: any) => setNewExpense({...newExpense, date: e.target.value})} 
                            />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('paid_by')}</label>
                                <select
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={newExpense.method}
                                    onChange={(e) => setNewExpense({...newExpense, method: e.target.value})}
                                >
                                    <option value="cash">{t('cash')} ({t('from_drawer')})</option>
                                    <option value="card">{t('card')}</option>
                                    <option value="transfer">{t('transfer')}</option>
                                    <option value="wallet">{t('wallet')}</option>
                                </select>
                                <p className="text-[11px] text-slate-400 mt-1">{t('expense_method_hint')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('expense_description')}</label>
                                <textarea 
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none h-24"
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button 
                                variant="secondary"
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 justify-center"
                            >
                                {t('cancel')}
                            </Button>
                            <Button 
                                variant="success"
                                onClick={handleAdd}
                                className="flex-1 justify-center"
                            >
                                {t('save')}
                            </Button>
                        </div>
                </ModalShell>
            )}
        </div>
    );
};

