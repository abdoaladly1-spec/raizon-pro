/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const NotesPage = () => {
    const { state, t, addNote, updateNote, deleteNote, currentUser, formatDate, formatTime, formatDateTime } = useApp();
    const [selectedNoteId, setSelectedNoteId] = useState(null as string | null);
    const [search, setSearch] = useState('');
    const [autoNumbering, setAutoNumbering] = useState(true);
    
    // Editor State
    const [editorContent, setEditorContent] = useState('');
    const [noteTitle, setNoteTitle] = useState('');
    const [fontSize, setFontSize] = useState('14px');
    const [fontFamily, setFontFamily] = useState('Arial');
    const [textColor, setTextColor] = useState('#000000');
    
    const editorRef = useRef(null as HTMLDivElement | null);

    // Filter notes
    const filteredNotes = state.notes.filter(n => 
        !n.isDeleted && 
        (n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => b.updatedAt - a.updatedAt);

    const selectedNote = state.notes.find(n => n.id === selectedNoteId);

    // Auto-save effect
    useEffect(() => {
        if (!selectedNoteId) return;
        
        const timer = setTimeout(() => {
            if (selectedNote && (selectedNote.content !== editorContent || selectedNote.title !== noteTitle)) {
                handleSave();
            }
        }, 5000); // Auto save every 5 seconds of inactivity or change

        return () => clearTimeout(timer);
    }, [editorContent, noteTitle, selectedNoteId]);

    // Load note into editor
    useEffect(() => {
        if (selectedNote) {
            setNoteTitle(selectedNote.title);
            setEditorContent(selectedNote.content);
            if (editorRef.current) {
                editorRef.current.innerHTML = selectedNote.content;
            }
        } else {
            setNoteTitle('');
            setEditorContent('');
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
        }
    }, [selectedNoteId]);

    const handleCreateNew = () => {
        const newNote: Note = {
            id: crypto.randomUUID(),
            title: autoNumbering ? `${t('new_note')} ${state.notes.length + 1}` : t('new_note'),
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: currentUser?.name || t('system')
        };
        addNote(newNote);
        setSelectedNoteId(newNote.id);
    };

    const handleSave = () => {
        if (!selectedNoteId) return;
        
        const content = editorRef.current?.innerHTML || '';
        const updatedNote: Note = {
            id: selectedNoteId,
            title: noteTitle,
            content: content,
            createdAt: selectedNote?.createdAt || Date.now(),
            updatedAt: Date.now(),
            createdBy: selectedNote?.createdBy || currentUser?.name || 'System'
        };
        updateNote(updatedNote);
    };

    const handleDelete = (id: string) => {
        if (confirm(t('confirm_delete_note'))) {
            deleteNote(id);
            if (selectedNoteId === id) setSelectedNoteId(null);
        }
    };

    const execCmd = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            setEditorContent(editorRef.current.innerHTML);
            editorRef.current.focus();
        }
    };

    const handleImageUpload = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = `<img src="${e.target?.result}" style="max-width: 100%; height: auto; margin: 10px 0;" />`;
                execCmd('insertHTML', img);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePrint = () => {
        if (!selectedNote) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>${selectedNote.title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
                        .content { line-height: 1.6; min-height: 600px; }
                        .footer { margin-top: 50px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 12px; color: #666; display: flex; justify-content: space-between; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${selectedNote.title}</h1>
                        <p>${formatDateTime(selectedNote.updatedAt)}</p>
                    </div>
                    <div class="content">
                        ${selectedNote.content}
                    </div>
                    <div class="footer">
                        <span>${t('created_by')}: ${selectedNote.createdBy}</span>
                        <span>${t('page')} 1 ${t('of')} 1</span>
                        <span>© ${t('copyright_footer')}</span>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleExport = (format: 'txt' | 'doc') => {
        if (!selectedNote) return;
        let content = selectedNote.content;
        let mimeType = 'text/plain';
        let extension = 'txt';

        if (format === 'doc') {
            content = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${selectedNote.title}</title></head><body>${selectedNote.content}</body></html>
            `;
            mimeType = 'application/msword';
            extension = 'doc';
        } else {
            // Strip HTML for TXT
            const tmp = document.createElement("DIV");
            tmp.innerHTML = content;
            content = tmp.textContent || tmp.innerText || "";
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedNote.title}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6 animate-fade-in">
            {/* Sidebar List */}
            <div className="w-80 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="text-primary-600" /> {t('notes')}
                    </h2>
                    <button onClick={handleCreateNew} className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20">
                        <Plus size={20} />
                    </button>
                </div>
                
                <div className="flex items-center gap-2 px-1">
                     <input type="checkbox" id="autoNum" checked={autoNumbering} onChange={(e) => setAutoNumbering(e.target.checked)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                     <label htmlFor="autoNum" className="text-xs text-slate-500 cursor-pointer">{t('auto_numbering')}</label>
                </div>
                
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder={t('search_notes')} 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {filteredNotes.map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => setSelectedNoteId(note.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group relative
                                ${selectedNoteId === note.id 
                                    ? 'bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800' 
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary-300'}`}
                        >
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate pr-6">{note.title}</h3>
                            <p className="text-xs text-slate-500 mt-1 flex justify-between">
                                <span>{formatDate(note.updatedAt)}</span>
                                <span>{formatTime(note.updatedAt, {hour: '2-digit', minute:'2-digit'})}</span>
                            </p>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                                className="absolute top-4 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {filteredNotes.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            <FileText size={48} className="mx-auto mb-2 opacity-20" />
                            <p>{t('no_data')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {selectedNoteId ? (
                    <>
                        {/* Toolbar */}
                        <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 items-center bg-slate-50 dark:bg-slate-900/50">
                            <input 
                                type="text" 
                                value={noteTitle} 
                                onChange={(e) => setNoteTitle(e.target.value)}
                                className="bg-transparent font-bold text-lg px-2 py-1 outline-none border-b border-transparent focus:border-primary-500 w-full md:w-64 mr-4"
                                placeholder={t('note_title')}
                            />
                            
                            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-2"></div>

                            <select onChange={(e) => { setFontFamily(e.target.value); execCmd('fontName', e.target.value); }} className="p-1 rounded border border-slate-300 text-sm w-32">
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Tahoma">Tahoma</option>
                                <option value="Verdana">Verdana</option>
                                <option value="Courier New">Courier New</option>
                            </select>

                            <select onChange={(e) => { setFontSize(e.target.value); execCmd('fontSize', '3'); /* execCmd fontSize is 1-7, mapping is tricky, simpler to use styleWithCSS or just standard sizes */ }} className="p-1 rounded border border-slate-300 text-sm w-20">
                                <option value="10pt">10pt</option>
                                <option value="12pt">12pt</option>
                                <option value="14pt">14pt</option>
                                <option value="18pt">18pt</option>
                                <option value="24pt">24pt</option>
                            </select>

                            <div className="flex gap-1 border border-slate-300 rounded p-1 bg-white">
                                <button onClick={() => execCmd('bold')} className="p-1 hover:bg-slate-100 rounded" title={t('bold')}><b className="font-serif">B</b></button>
                                <button onClick={() => execCmd('italic')} className="p-1 hover:bg-slate-100 rounded" title={t('italic')}><i className="font-serif">I</i></button>
                                <button onClick={() => execCmd('underline')} className="p-1 hover:bg-slate-100 rounded" title={t('underline')}><u className="font-serif">U</u></button>
                            </div>

                            <div className="flex gap-1 border border-slate-300 rounded p-1 bg-white">
                                <button onClick={() => execCmd('justifyLeft')} className="p-1 hover:bg-slate-100 rounded" title={t('align_left')}>L</button>
                                <button onClick={() => execCmd('justifyCenter')} className="p-1 hover:bg-slate-100 rounded" title={t('align_center')}>C</button>
                                <button onClick={() => execCmd('justifyRight')} className="p-1 hover:bg-slate-100 rounded" title={t('align_right')}>R</button>
                            </div>

                            <input type="color" value={textColor} onChange={(e) => { setTextColor(e.target.value); execCmd('foreColor', e.target.value); }} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" title={t('text_color')} />

                            <label className="cursor-pointer p-1 hover:bg-slate-200 rounded border border-slate-300 bg-white" title={t('insert_image')}>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                <span className="text-xs">IMG</span>
                            </label>

                            <div className="flex-1"></div>

                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="p-2 hover:bg-slate-200 rounded text-slate-600" title={t('print_note')}><Printer size={18}/></button>
                                <button onClick={() => handleExport('doc')} className="p-2 hover:bg-slate-200 rounded text-blue-600" title={t('export_doc')}>DOC</button>
                                <button onClick={() => handleExport('txt')} className="p-2 hover:bg-slate-200 rounded text-slate-600" title={t('export_txt')}>TXT</button>
                                <button onClick={handlePrint} className="p-2 hover:bg-slate-200 rounded text-red-600 font-bold text-xs" title={t('export_pdf')}>PDF</button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 relative overflow-hidden flex flex-col">
                            <div 
                                ref={editorRef}
                                contentEditable
                                className="flex-1 p-8 outline-none overflow-y-auto custom-scrollbar focus:bg-slate-50/50 transition-colors"
                                style={{ 
                                    fontFamily: fontFamily, 
                                    fontSize: fontSize,
                                    color: textColor,
                                    minHeight: '600px'
                                }}
                                onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                            ></div>
                            
                            {/* Footer */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex justify-between bg-slate-50 dark:bg-slate-900/50 select-none">
                                <div>
                                    <span className="font-bold">{t('created_by')}:</span> {selectedNote.createdBy}
                                </div>
                                <div className="flex gap-4">
                                    <span>{t('page')} 1 {t('of')} 1</span>
                                    <span>{formatDateTime(selectedNote.updatedAt)}</span>
                                </div>
                                <div>
                                    © {t('copyright_footer')}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <FileText size={64} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium">{t('select_note_start')}</p>
                        <button onClick={handleCreateNew} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                            {t('new_note')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

