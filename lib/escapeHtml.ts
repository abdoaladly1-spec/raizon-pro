/**
 * تهريب HTML لأي قيمة تُدرَج داخل قوالب نصية (نوافذ الطباعة/التقارير).
 * يمنع تنفيذ وسوم/سكربتات مرفوعة من إدخال المستخدم.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * تطهير HTML يسمح بعدد محدود من الوسوم الآمنة فقط (لطباعة ملاحظات غنية).
 * يُستخدم عندما يكون محتوى الملاحظة HTML مولَّداً من محرر التطبيق نفسه.
 */
export const sanitizeRichHtml = (html: string): string => {
  const allowed = new Set([
    'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'P', 'DIV', 'SPAN',
    'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'PRE', 'CODE',
    'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'IMG', 'HR', 'A',
  ]);
  const allowedAttrs = new Set(['src', 'alt', 'href', 'style', 'colspan', 'rowspan', 'dir']);

  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!allowed.has(el.tagName)) {
          el.replaceWith(...Array.from(el.childNodes));
          continue;
        }
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value.trim();
          const isUnsafeUrl = /^\s*(javascript|data:text\/html|vbscript):/i.test(value);
          if (!allowedAttrs.has(name) || isUnsafeUrl || name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        }
        if (el.tagName === 'A') {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
        if (el.tagName === 'IMG' && !/^data:image\//i.test(el.getAttribute('src') || '')) {
          el.remove();
          continue;
        }
        walk(el);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
      }
    }
  };

  walk(template.content);
  return template.innerHTML;
};
