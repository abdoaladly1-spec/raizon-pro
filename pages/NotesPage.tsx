/* صفحة الملاحظات (نظام ProCashier) - بتصميم مسطر مطابق لتطبيق ملاحظات الآيفون Apple Notes */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Plus, Trash2, Printer, Search, X, Check, Clock, User, Download, RefreshCw, Sparkles } from '../components/Icons';
import { Note } from '../types';
import { escapeHtml, sanitizeRichHtml } from '../lib/escapeHtml';

export const NotesPage: React.FC = () => {
    const { state, t, language, addNote, updateNote, deleteNote, addToast, currentUser, formatDate, formatTime, formatDateTime } = useApp();
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [autoNumbering, setAutoNumbering] = useState(true);
    const [isLinedPaper, setIsLinedPaper] = useState(true); // نمط الورق المسطر مثل ملاحظات الآيفون
    
    // تأكيد الحذف عبر نافذة احترافية
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

    // حالة الحفظ التلقائي
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    // Editor State
    const [editorContent, setEditorContent] = useState('');
    const [noteTitle, setNoteTitle] = useState('');
    const [fontSize, setFontSize] = useState('15px');
    const [fontFamily, setFontFamily] = useState('inherit');
    const [textColor, setTextColor] = useState('#000000');
    
    const editorRef = useRef<HTMLDivElement | null>(null);
    const autoSaveTimerRef = useRef<any>(null);

    // تصفية وترتيب الملاحظات (الأحدث تعديلاً أولاً)
    const filteredNotes = useMemo(() => {
        return (state.notes || [])
            .filter(n => !n.isDeleted && 
                ((n.title || '').toLowerCase().includes(search.toLowerCase()) || 
                 (n.content || '').toLowerCase().includes(search.toLowerCase()))
            )
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [state.notes, search]);

    const selectedNote = useMemo(() => {
        return (state.notes || []).find(n => String(n.id) === String(selectedNoteId));
    }, [state.notes, selectedNoteId]);

    // تحديد أول ملاحظة تلقائياً إذا لم تكن هناك ملاحظة مختارة
    useEffect(() => {
        if (!selectedNoteId && filteredNotes.length > 0) {
            setSelectedNoteId(filteredNotes[0].id);
        }
    }, [filteredNotes.length]);

    // تحميل الملاحظة المختارة في المحرر
    useEffect(() => {
        if (selectedNote) {
            setNoteTitle(selectedNote.title || '');
            setEditorContent(selectedNote.content || '');
            if (editorRef.current) {
                editorRef.current.innerHTML = selectedNote.content || '';
            }
            setSaveStatus('saved');
        } else {
            setNoteTitle('');
            setEditorContent('');
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
            setSaveStatus('saved');
        }
    }, [selectedNoteId]);

    // الحفظ اليدوي والتلقائي
    const handleSave = () => {
        if (!selectedNoteId) return;
        
        // التحقق من أن الملاحظة ما زالت موجودة في النظام
        const exists = (state.notes || []).some(n => String(n.id) === String(selectedNoteId));
        if (!exists) return;

        const content = editorRef.current?.innerHTML || '';
        const titleToSave = noteTitle.trim() || t('note_title') || 'ملاحظة بدون عنوان';
        
        const updatedNote: Note = {
            id: selectedNoteId,
            title: titleToSave,
            content: content,
            createdAt: selectedNote?.createdAt || Date.now(),
            updatedAt: Date.now(),
            createdBy: selectedNote?.createdBy || currentUser?.name || 'كاشير'
        };

        setSaveStatus('saving');
        updateNote(updatedNote);
        setTimeout(() => setSaveStatus('saved'), 400);
    };

    // مراقبة التغييرات للحفظ التلقائي مع تفادي التضارب
    useEffect(() => {
        if (!selectedNoteId) return;
        
        if (selectedNote && (selectedNote.content !== editorContent || selectedNote.title !== noteTitle)) {
            setSaveStatus('unsaved');
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
                handleSave();
            }, 1500); // حفظ تلقائي ذكي بعد 1.5 ثانية من توقف الكتابة
        }

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [editorContent, noteTitle, selectedNoteId]);

    // إنشاء ملاحظة جديدة
    const handleCreateNew = () => {
        const count = (state.notes || []).filter(n => !n.isDeleted).length + 1;
        const newNote: Note = {
            id: crypto.randomUUID(),
            title: autoNumbering ? `ملاحظة رقم ${count}` : 'ملاحظة جديدة',
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: currentUser?.name || 'كاشير'
        };
        addNote(newNote);
        setSelectedNoteId(newNote.id);
        addToast('تم إنشاء ملاحظة جديدة بنجاح', 'success');
    };

    // فتح نافذة تأكيد الحذف
    const handleOpenDeleteModal = (note: Note) => {
        setNoteToDelete(note);
    };

    // تنفيذ الحذف الفعلي بعد ضغط المستخدم على تأكيد
    const handleConfirmDelete = () => {
        if (!noteToDelete) return;
        const targetId = noteToDelete.id;

        // 1. إلغاء أي مؤقت حفظ تلقائي نشط
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        // 2. إذا كانت الملاحظة المحذوفة هي المفتوحة حالياً، تصفير المحرر فوراً
        if (String(selectedNoteId) === String(targetId)) {
            setSelectedNoteId(null);
            setNoteTitle('');
            setEditorContent('');
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
        }

        // 3. حذف الملاحظة من الحالة وتحديث النظام
        deleteNote(targetId);
        setNoteToDelete(null);
        addToast('تم حذف الملاحظة بنجاح', 'success');
    };

    // أوامر تنسيق النص
    const execCmd = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            setEditorContent(editorRef.current.innerHTML);
            editorRef.current.focus();
        }
    };

    // إدراج صورة في الملاحظة
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
                const img = `<img src="${uploadEvent.target?.result}" style="max-width: 100%; height: auto; border-radius: 12px; margin: 12px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />`;
                execCmd('insertHTML', img);
            };
            reader.readAsDataURL(file);
        }
    };

    // طباعة حرارية احترافية 80mm
    const handlePrint = () => {
        if (!selectedNote) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="utf-8">
                    <title>${escapeHtml(selectedNote.title)}</title>
                    <style>
                        @media print {
                            @page { size: 80mm auto; margin: 0; }
                            body { margin: 0; padding: 4px; width: 76mm; }
                        }
                        * { box-sizing: border-box; }
                        body { 
                            font-family: 'Tahoma', 'Segoe UI', Arial, sans-serif; 
                            padding: 8px 4px; 
                            width: 76mm; 
                            margin: 0 auto; 
                            color: #000; 
                            font-size: 11px; 
                            line-height: 1.45;
                        }
                        .header { 
                            text-align: center; 
                            margin-bottom: 8px; 
                            border-bottom: 1.5px dashed #000; 
                            padding-bottom: 6px; 
                        }
                        .header h1 { font-size: 14px; margin: 0 0 4px 0; font-weight: 800; }
                        .header p { font-size: 9.5px; margin: 0; color: #444; font-family: monospace; }
                        .content { 
                            min-height: 120px; 
                            font-size: 11.5px; 
                            word-break: break-word;
                            padding: 6px 0;
                        }
                        .footer { 
                            margin-top: 16px; 
                            border-top: 1px dashed #000; 
                            padding-top: 6px; 
                            font-size: 9px; 
                            color: #444; 
                            display: flex; 
                            justify-content: space-between; 
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${escapeHtml(selectedNote.title)}</h1>
                        <p>${escapeHtml(formatDateTime(selectedNote.updatedAt))}</p>
                    </div>
                    <div class="content">
                        ${sanitizeRichHtml(selectedNote.content || '')}
                    </div>
                    <div class="footer">
                        <span>المسؤول: ${escapeHtml(selectedNote.createdBy)}</span>
                        <span>${escapeHtml(state.settings?.shopName || 'RaiZon Pro')}</span>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 250);
        }
    };

    // تصدير كملف نصي أو وورد
    const handleExport = (format: 'txt' | 'doc') => {
        if (!selectedNote) return;
        let content = selectedNote.content || '';
        let mimeType = 'text/plain;charset=utf-8';
        let extension = 'txt';

        if (format === 'doc') {
            content = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${escapeHtml(selectedNote.title)}</title></head>
                <body dir='rtl' style='font-family: Arial; padding: 20px;'>
                    <h2 style='color: #d97706;'>${escapeHtml(selectedNote.title)}</h2>
                    <p style='color: #666; font-size: 11px;'>${escapeHtml(formatDateTime(selectedNote.updatedAt))} - ${escapeHtml(selectedNote.createdBy)}</p>
                    <hr />
                    <div style='line-height: 1.6; font-size: 14px;'>${selectedNote.content}</div>
                </body></html>
            `;
            mimeType = 'application/msword;charset=utf-8';
            extension = 'doc';
        } else {
            const tmp = document.createElement("DIV");
            tmp.innerHTML = content;
            content = `${selectedNote.title}\n${formatDateTime(selectedNote.updatedAt)}\n${'='.repeat(30)}\n\n` + (tmp.textContent || tmp.innerText || "");
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedNote.title || 'ملاحظة'}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // استخراج نص ملخص للمعاينة في القائمة الجانبية
    const getSnippet = (html: string) => {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        const text = tmp.textContent || tmp.innerText || '';
        return text.trim() || 'ملاحظة فارغة...';
    };

    return (
        <div className="flex h-[calc(100vh-140px)] gap-5 animate-fade-in text-right font-sans" dir="rtl">
            {/* =========================================================================
                1. القائمة الجانبية للملاحظات (Apple Notes Sidebar Style)
               ========================================================================= */}
            <div className="w-80 md:w-88 flex flex-col gap-3 shrink-0">
                {/* رأس الشريط الجانبي */}
                <div className="flex justify-between items-center bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shadow-xs">
                            <FileText size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">الملاحظات</h2>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {filteredNotes.length} ملاحظة مسجلة
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={handleCreateNew} 
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="إنشاء ملاحظة جديدة"
                    >
                        <Plus size={16} />
                        <span>جديدة</span>
                    </button>
                </div>

                {/* حقل البحث والترقيم التلقائي */}
                <div className="space-y-2">
                    <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                            <Search size={16} />
                        </div>
                        <input 
                            type="text" 
                            placeholder="بحث في الملاحظات والمحتوى..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pr-9 pl-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-xs"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={autoNumbering} 
                                onChange={(e) => setAutoNumbering(e.target.checked)} 
                                className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500" 
                            />
                            <span>ترقيم تلقائي للملاحظات الجديدة</span>
                        </label>
                        <span className="font-mono text-[10px]">Apple Ruled</span>
                    </div>
                </div>

                {/* قائمة كروت الملاحظات */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pl-1">
                    {filteredNotes.map(note => {
                        const isSelected = selectedNoteId === note.id;
                        return (
                            <div 
                                key={note.id} 
                                onClick={() => setSelectedNoteId(note.id)}
                                className={`p-3.5 rounded-2xl border cursor-pointer transition-all group relative text-right
                                    ${isSelected 
                                        ? 'bg-amber-50/70 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700/60 shadow-xs' 
                                        : 'bg-white dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800 hover:border-amber-400/50 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className={`font-bold text-xs truncate flex-1 ${isSelected ? 'text-amber-800 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                                        {note.title || 'ملاحظة بدون عنوان'}
                                    </h3>
                                    
                                    {/* زر الحذف على الكارت مع فتح نافذة التأكيد */}
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenDeleteModal(note);
                                        }}
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                                        title="حذف الملاحظة"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>

                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                                    {getSnippet(note.content)}
                                </p>

                                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 font-mono">
                                    <span>{formatDate(new Date(note.updatedAt))}</span>
                                    <span>{formatTime(new Date(note.updatedAt), { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        );
                    })}

                    {filteredNotes.length === 0 && (
                        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-slate-400">
                            <FileText size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
                            <p className="text-xs font-semibold">لا توجد ملاحظات مطابقة</p>
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline"
                            >
                                + إنشاء ملاحظة جديدة الآن
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================================================
                2. مساحة المحرر المسطر كدفتر الآيفون (Apple Notes Ruled View)
               ========================================================================= */}
            <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                {selectedNote ? (
                    <>
                        {/* شريط أدوات التنسيق (Apple Toolbar) */}
                        <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between bg-slate-50 dark:bg-slate-900/90 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {/* تنسيقات الخطوط */}
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl shadow-2xs">
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('bold')} 
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-serif font-black" 
                                        title="عريض (Bold)"
                                    >
                                        B
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('italic')} 
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-serif italic font-bold" 
                                        title="مائل (Italic)"
                                    >
                                        I
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('underline')} 
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 underline font-bold" 
                                        title="تحته خط (Underline)"
                                    >
                                        U
                                    </button>
                                </div>

                                {/* المحاذاة */}
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl shadow-2xs">
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('justifyRight')} 
                                        className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold" 
                                        title="محاذاة لليمين"
                                    >
                                        يمين
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('justifyCenter')} 
                                        className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold" 
                                        title="توسيط"
                                    >
                                        وسط
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('justifyLeft')} 
                                        className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold" 
                                        title="محاذاة لليسار"
                                    >
                                        يسار
                                    </button>
                                </div>

                                {/* القوائم النقطية */}
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl shadow-2xs">
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('insertUnorderedList')} 
                                        className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold" 
                                        title="قائمة نقطية"
                                    >
                                        • قائمة
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => execCmd('insertOrderedList')} 
                                        className="px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold" 
                                        title="قائمة رقمية"
                                    >
                                        1. أرقام
                                    </button>
                                </div>

                                {/* لون النص وإدراج صورة */}
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-xl shadow-2xs">
                                    <input 
                                        type="color" 
                                        value={textColor} 
                                        onChange={(e) => { setTextColor(e.target.value); execCmd('foreColor', e.target.value); }} 
                                        className="w-5 h-5 p-0 border-0 rounded-full cursor-pointer overflow-hidden" 
                                        title="لون الخط" 
                                    />
                                    <label className="cursor-pointer text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500" title="إدراج صورة في الملاحظة">
                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                        <span>+ صورة</span>
                                    </label>
                                </div>

                                {/* زر تبديل التسطير المسطر / عادي */}
                                <button
                                    type="button"
                                    onClick={() => setIsLinedPaper(!isLinedPaper)}
                                    className={`px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1
                                        ${isLinedPaper 
                                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-2xs' 
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'}`}
                                    title="تبديل نمط الورق (مسطر / عادي)"
                                >
                                    <span>{isLinedPaper ? 'مسطر' : 'عادي'}</span>
                                </button>
                            </div>

                            {/* أزرار الإجراءات في الجانب الآخر (طباعة، تصدير، حذف، حفظ) */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono text-slate-400 ml-2 hidden sm:inline">
                                    {saveStatus === 'saving' ? 'جاري الحفظ...' : saveStatus === 'unsaved' ? 'تعديلات غير محفوظة' : 'تم الحفظ تلقائياً'}
                                </span>

                                <button 
                                    onClick={handlePrint} 
                                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs" 
                                    title="طباعة حرارية 80mm أو A4"
                                >
                                    <Printer size={15} />
                                </button>

                                <button 
                                    onClick={() => handleExport('doc')} 
                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-500 font-bold text-xs transition-all cursor-pointer shadow-2xs" 
                                    title="تصدير كملف Word DOC"
                                >
                                    Word
                                </button>

                                <button 
                                    onClick={() => handleExport('txt')} 
                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer shadow-2xs" 
                                    title="تصدير كملف نصي TXT"
                                >
                                    TXT
                                </button>

                                {/* زر الحذف من داخل المحرر */}
                                <button 
                                    type="button"
                                    onClick={() => handleOpenDeleteModal(selectedNote)} 
                                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 font-bold transition-all cursor-pointer shadow-2xs" 
                                    title="حذف هذه الملاحظة"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>

                        {/* =================================================================
                            جسم ورقة الملاحظة المسطرة بتصميم دفاتر الآيفون Apple Notes
                           ================================================================= */}
                        <div className={`flex-1 relative overflow-hidden flex flex-col transition-colors
                            ${isLinedPaper 
                                ? 'bg-[#FCF9F2] dark:bg-[#1C1C1E]' 
                                : 'bg-white dark:bg-slate-900'}`}
                        >
                            {/* ترويسة الملاحظة (العنوان والتاريخ) */}
                            <div className="pt-6 pb-2 px-8 border-b border-amber-200/60 dark:border-amber-900/30">
                                <input 
                                    type="text" 
                                    value={noteTitle} 
                                    onChange={(e) => setNoteTitle(e.target.value)}
                                    className="bg-transparent font-black text-xl md:text-2xl text-slate-900 dark:text-amber-100 outline-none w-full placeholder-slate-400/80 mb-1"
                                    placeholder="عنوان الملاحظة..."
                                />
                                
                                <div className="flex items-center gap-3 text-xs text-amber-700 dark:text-amber-400/80 font-medium font-mono">
                                    <span>{formatDateTime(selectedNote.updatedAt)}</span>
                                    <span>•</span>
                                    <span>المسؤول: {selectedNote.createdBy}</span>
                                </div>
                            </div>

                            {/* مساحة الكتابة المسطرة المتطابقة مع سطور تطبيق الآيفون */}
                            <div 
                                className="flex-1 px-8 py-4 overflow-y-auto custom-scrollbar relative"
                                style={{
                                    ...(isLinedPaper ? {
                                        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(190, 170, 140, 0.32) 31px, rgba(190, 170, 140, 0.32) 32px)',
                                        backgroundSize: '100% 32px',
                                        backgroundAttachment: 'local',
                                    } : {})
                                }}
                            >
                                <div 
                                    ref={editorRef}
                                    contentEditable
                                    className="outline-none min-h-[500px] text-slate-900 dark:text-slate-100 font-medium [&>div]:m-0 [&>p]:m-0"
                                    style={{ 
                                        fontFamily: fontFamily, 
                                        fontSize: fontSize,
                                        color: textColor !== '#000000' ? textColor : undefined,
                                        lineHeight: '32px', // تطابق تام لارتفاع السطر مع السطور المسطرة 32px
                                        marginTop: isLinedPaper ? '-7px' : '0px',
                                    }}
                                    onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                                    data-placeholder="اكتب ملاحظاتك وتفاصيلك هنا..."
                                ></div>
                            </div>

                            {/* تذييل الملاحظة */}
                            <div className="py-2.5 px-8 border-t border-amber-200/50 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between items-center bg-[#F9F5EC] dark:bg-[#18181A] select-none font-mono">
                                <div>
                                    <span>آخر تعديل: {formatTime(new Date(selectedNote.updatedAt))}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span>{selectedNote.title}</span>
                                    <span>•</span>
                                    <span>{state.settings?.shopName || 'RaiZon Pro'}</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* شاشة البدء عند عدم اختيار أي ملاحظة */
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4 shadow-sm">
                            <FileText size={36} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">اختر ملاحظة أو أنشئ ملاحظة جديدة</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                            مساحة ملاحظات مسطرة احترافية لتدوين الاتفاقات والمذكرات الداخلية والتقارير الفورية.
                        </p>
                        <button 
                            onClick={handleCreateNew} 
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                        >
                            <Plus size={16} />
                            <span>إنشاء ملاحظة جديدة الآن</span>
                        </button>
                    </div>
                )}
            </div>

            {/* =========================================================================
                3. نافذة تأكيد حذف الملاحظة (Confirmation Modal)
               ========================================================================= */}
            {noteToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-right" dir="rtl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
                                <Trash2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">تأكيد حذف الملاحظة</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">سيتم حذف الملاحظة نهائياً من السجلات</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 mb-6">
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">الملاحظة المراد حذفها:</span>
                            <h4 className="font-bold text-sm text-rose-500 truncate">{noteToDelete.title || 'ملاحظة بدون عنوان'}</h4>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {getSnippet(noteToDelete.content)}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Trash2 size={16} />
                                <span>تأكيد الحذف</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setNoteToDelete(null)}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default NotesPage;
