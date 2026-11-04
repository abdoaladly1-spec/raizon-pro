import sys

def main():
    with open('components/InvoiceReceipt.tsx', 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Update import
    if "import React, { useEffect } from 'react';" in text:
        text = text.replace(
            "import React, { useEffect } from 'react';",
            "import React, { useEffect, useState } from 'react';"
        )

    # 2. Update useApp destructuring
    if "const { state, t, language } = useApp();" in text:
        text = text.replace(
            "const { state, t, language } = useApp();",
            "const { state, t, language, currentUser, updateInvoice } = useApp();"
        )

    # 3. Add state and handlers after shopAddress
    anchor = "state.settings.address ||"
    idx = text.find(anchor)
    if idx != -1:
        # Find the closing ).trim();
        end_idx = text.find(").trim();", idx)
        if end_idx != -1:
            insertion_point = end_idx + len(").trim();")
            extra_state = """

  // حالة إدارة وتعديل ملاحظات الفاتورة من قبل الأدمن
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState(invoice.notes || '');

  useEffect(() => {
    setNotesInput(invoice.notes || '');
  }, [invoice.notes]);

  const handleSaveNotes = () => {
    if (updateInvoice) {
      updateInvoice({ ...invoice, notes: notesInput.trim() });
    }
    setIsEditingNotes(false);
  };

  const handleClearNotes = () => {
    if (updateInvoice) {
      updateInvoice({ ...invoice, notes: '' });
    }
    setNotesInput('');
    setIsEditingNotes(false);
  };

  // بيانات نظام الولاء المرتبطة بالعميل والفاتورة
  const customerObj = state.customers.find(
    (c) => c.id === invoice.customerId || (c.phone && invoice.customerName && c.phone === invoice.customerName)
  );
  const loyaltyPointsEarned = (state.settings.loyaltyEnabled && invoice.total)
    ? Math.floor(Number(invoice.total) / (state.settings.loyaltyMinSpend || 10)) * (state.settings.loyaltyPointsAward || 1)
    : 0;
"""
            text = text[:insertion_point] + extra_state + text[insertion_point:]
            print("Extra state inserted successfully")

    # 4. Insert notes & loyalty block above farewell footer
    footer_anchor = "{/* 8. تذييل الفاتورة: رسالة الوداع والتذييل أسفل جدول الإجمالي مباشرة وبشكل متأقلم */}"
    notes_block = """{/* 7.5 ملاحظات الفاتورة ونظام الولاء (فوق رسالة الوداع مباشرة) */}
                {isLastPage && (
                  <div style={{ marginTop: '6px', marginBottom: '6px' }} className="w-full">
                    {/* عرض نظام الولاء إن كان مفعلاً */}
                    {state.settings.loyaltyEnabled && (
                      <div
                        className="text-center font-bold text-black"
                        style={{
                          fontSize: '10.5px',
                          border: '1px dashed #000000',
                          padding: '3px 5px',
                          marginBottom: '5px',
                          backgroundColor: isShadingEnabled ? '#f1f3f5' : '#ffffff',
                          fontFamily: 'Tahoma, Arial, sans-serif',
                        }}
                      >
                        <span className="inline-block">
                          ⭐ {rtl ? 'برنامج الولاء:' : 'Loyalty Program:'}{' '}
                          {customerObj
                            ? `${rtl ? 'رصيد العميل' : 'Customer Balance'}: ${customerObj.loyaltyPoints} ${rtl ? 'نقطة' : 'pts'}`
                            : (rtl ? 'مفعّل' : 'Active')}
                          {loyaltyPointsEarned > 0 && ` | +${loyaltyPointsEarned} ${rtl ? 'نقطة مكتسبة' : 'pts earned'}`}
                          {invoice.pointsRedeemed && invoice.pointsRedeemed > 0 ? ` | ${rtl ? 'مستبدل' : 'Redeemed'}: ${invoice.pointsRedeemed}` : ''}
                        </span>
                      </div>
                    )}

                    {/* ملاحظات الفاتورة: إمكانية التعديل والإضافة والحذف بواسطة الأدمن */}
                    {(invoice.notes || isEditingNotes || currentUser?.role === 'admin') && (
                      <div
                        style={{
                          border: '1px solid #000000',
                          padding: '4px 6px',
                          marginBottom: '4px',
                          fontFamily: 'Tahoma, Arial, sans-serif',
                          fontSize: '11px',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold underline text-black">
                            📝 {rtl ? 'ملاحظات الفاتورة:' : 'Invoice Notes:'}
                          </span>
                          {/* أزرار الإدارة للأدمن - تظهر على الشاشة فقط وتختفي عند أمر الطباعة */}
                          {currentUser?.role === 'admin' && !demo && (
                            <div className="print:hidden flex items-center gap-1.5 text-[10px]">
                              {!isEditingNotes ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingNotes(true)}
                                    className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] cursor-pointer"
                                    title={rtl ? 'تعديل الملاحظات' : 'Edit notes'}
                                  >
                                    {invoice.notes ? (rtl ? 'تعديل' : 'Edit') : (rtl ? 'إضافة ملاحظة' : 'Add Note')}
                                  </button>
                                  {invoice.notes && (
                                    <button
                                      type="button"
                                      onClick={handleClearNotes}
                                      className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] cursor-pointer"
                                      title={rtl ? 'إلغاء الملاحظة' : 'Delete note'}
                                    >
                                      {rtl ? 'إلغاء/حذف' : 'Delete'}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleSaveNotes}
                                    className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] cursor-pointer font-bold"
                                  >
                                    {rtl ? 'حفظ' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNotesInput(invoice.notes || '');
                                      setIsEditingNotes(false);
                                    }}
                                    className="px-1.5 py-0.5 bg-slate-500 hover:bg-slate-600 text-white rounded text-[10px] cursor-pointer"
                                  >
                                    {rtl ? 'تراجع' : 'Cancel'}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditingNotes && currentUser?.role === 'admin' && !demo ? (
                          <div className="print:hidden mt-1">
                            <textarea
                              value={notesInput}
                              onChange={(e) => setNotesInput(e.target.value)}
                              rows={2}
                              placeholder={rtl ? 'أدخل ملاحظات الفاتورة هنا...' : 'Enter invoice notes here...'}
                              className="w-full p-1.5 text-xs border border-slate-400 rounded bg-white text-black font-normal focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        ) : (
                          invoice.notes ? (
                            <p className="whitespace-pre-line text-black font-semibold text-[11px] leading-tight">
                              {invoice.notes}
                            </p>
                          ) : (
                            currentUser?.role === 'admin' && (
                              <p className="text-slate-400 italic text-[10px] print:hidden">
                                {rtl ? 'لا توجد ملاحظات مسجلة (انقر إضافة ملاحظة)' : 'No notes (click Add Note)'}
                              </p>
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                """

    if footer_anchor in text:
        text = text.replace(footer_anchor, notes_block + footer_anchor)
        print("Notes block inserted successfully")
    else:
        print("Warning: footer_anchor not found")

    with open('components/InvoiceReceipt.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Done!")

if __name__ == '__main__':
    main()
