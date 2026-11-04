import { useEffect, useRef } from 'react';

// Code 128 Patterns (ISO/IEC 15417 standard)
const CODE128_PATTERNS = ['11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100', '10011001000', '10011000100', '10001100100', '11001001000', '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', '10111001100', '10011101100', '10011100110', '11001110010', '11001011100', '11001001110', '11011100100', '11001110100', '11101101110', '11101001100', '11100101100', '11100100110', '11101100100', '11100110100', '11100110010', '11011011000', '11011000110', '11000110110', '10100011000', '10001011000', '10001000110', '10110001000', '10001101000', '10001100010', '11010001000', '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110', '11101110110', '11010001110', '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', '11101000110', '11100010110', '11101101000', '11101100010', '11100011010', '11101111010', '11001000010', '11110001010', '10100110000', '10100001100', '10010110000', '10010000110', '10000101100', '10000100110', '10110010000', '10110000100', '10011010000', '10011000010', '10000110100', '10000110010', '11000010010', '11001010000', '11110111010', '11000010100', '10001111010', '10100111100', '10010111100', '10010011110', '10111100100', '10011110100', '10011110010', '11110100100', '11110010100', '11110010010', '11011011110', '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', '10111101000', '10111100010', '11110101000', '11110100010', '10111011110', '10111101110', '11101011110', '11110101110', '11010000100', '11010010000', '11010011100', '1100011101011'];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * خريطة تحويل أرقام لوحة المفاتيح العربية إلى أرقام إنجليزية
 */
const ARABIC_INDIC_DIGITS: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

/**
 * خريطة تحويل لوحة المفاتيح العربية للإنجليزية (عند مسح الباركود واللغة عربي على ويندوز)
 */
const ARABIC_TO_ENGLISH_MAP: Record<string, string> = {
    'ض': 'q', 'ص': 'w', 'ث': 'e', 'ق': 'r', 'ف': 't', 'غ': 'y', 'ع': 'u', 'ه': 'i', 'خ': 'o', 'ح': 'p', 'ج': '[', 'د': ']',
    'ش': 'a', 'س': 's', 'ي': 'd', 'ب': 'f', 'ل': 'g', 'ا': 'h', 'ت': 'j', 'ن': 'k', 'م': 'l', 'ك': ';', 'ط': "'",
    'ئ': 'z', 'ء': 'x', 'ؤ': 'c', 'ر': 'v', 'ى': 'n', 'ة': 'm', 'و': ',', 'ز': '.', 'ظ': '/',
    'Q': 'Q', 'W': 'W', 'E': 'E', 'R': 'R', 'T': 'T', 'Y': 'Y', 'U': 'U', 'I': 'I', 'O': 'O', 'P': 'P',
    'A': 'A', 'S': 'S', 'D': 'D', 'F': 'F', 'G': 'G', 'H': 'H', 'J': 'J', 'K': 'K', 'L': 'L',
    'Z': 'Z', 'X': 'X', 'C': 'C', 'V': 'V', 'B': 'B', 'N': 'N', 'M': 'M'
};

/**
 * تنظيف وتطبيع الباركود:
 * 1. تحويل الأرقام العربية (٠١٢٣٤٥٦٧٨٩) إلى أرقام إنجليزية (0123456789)
 * 2. تحويل حروف الكيبورد العربية إلى إنجليزية إذا تم المسح واللغة عربية
 * 3. إزالة المسافات والأحرف غير القابلة للطباعة
 */
export const normalizeBarcode = (input: string): string => {
    if (!input) return '';
    let result = '';
    const cleaned = input.trim();

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (ARABIC_INDIC_DIGITS[char] !== undefined) {
            result += ARABIC_INDIC_DIGITS[char];
        } else if (ARABIC_TO_ENGLISH_MAP[char] !== undefined) {
            result += ARABIC_TO_ENGLISH_MAP[char];
        } else {
            result += char;
        }
    }
    return result.replace(/\s+/g, '');
};

/**
 * توليد باركود فريد عشوائي مكون من 12 رقماً للمنتجات التي لا تملك باركود مصنعي
 */
export const generateUniqueBarcode = (): string => {
    // يبدأ بـ 200 (نطاق الباركود الداخلي للمحلات EAN-13 In-store)
    const random8 = Math.floor(10000000 + Math.random() * 90000000).toString();
    const base = '200' + random8; // 11 digits
    
    // حساب رقم التحقق Modulo 10
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
        const digit = parseInt(base[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return base + checksum.toString();
};

/**
 * توليد باركود Code 128 قياسي ومقروء 100% بصيغة SVG حقيقية
 */
export const generateCode128Svg = (
    text: string,
    options: {
        height?: number;
        moduleWidth?: number;
        showText?: boolean;
        fontSize?: number;
    } = {}
): string => {
    const safeText = normalizeBarcode(text) || '000000';
    const height = options.height || 48;
    const moduleWidth = options.moduleWidth || 1.8;
    const showText = options.showText !== false;
    const fontSize = options.fontSize || 10;

    // تشفير نصوص Code 128B
    const codes: number[] = [START_CODE_B];
    let checksum = START_CODE_B;

    for (let i = 0; i < safeText.length; i++) {
        const charCode = safeText.charCodeAt(i);
        const codeValue = charCode - 32; // Code 128B mapping
        if (codeValue >= 0 && codeValue <= 95) {
            codes.push(codeValue);
            checksum += codeValue * (i + 1);
        }
    }

    codes.push(checksum % 103);
    codes.push(STOP_CODE);

    // تحويل الرموز إلى سلاسل خطوط سوداء وبيضاء
    let binary = '';
    for (const code of codes) {
        binary += CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    }

    // رسم الخطوط كـ SVG
    const totalModules = binary.length;
    const totalWidth = Math.ceil(totalModules * moduleWidth) + 16; // quiet zones
    const barHeight = showText ? height - fontSize - 4 : height;

    let rects = '';
    let currentX = 8; // quiet zone start

    for (let i = 0; i < binary.length; i++) {
        if (binary[i] === '1') {
            // حساب عرض الخط المتتالي
            let widthModules = 1;
            while (i + 1 < binary.length && binary[i + 1] === '1') {
                widthModules++;
                i++;
            }
            const w = widthModules * moduleWidth;
            rects += `<rect x="${currentX.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="#000000" />`;
            currentX += w;
        } else {
            currentX += moduleWidth;
        }
    }

    const textSvg = showText ? `
        <text x="${(totalWidth / 2).toFixed(2)}" y="${height - 2}" font-family="monospace, Courier" font-size="${fontSize}" font-weight="bold" fill="#000000" text-anchor="middle" letter-spacing="1">
            ${safeText}
        </text>
    ` : '';

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" preserveAspectRatio="xMidYMid meet">
            <rect width="100%" height="100%" fill="#ffffff" />
            ${rects}
            ${textSvg}
        </svg>
    `.trim();
};

/**
 * تحويل SVG الباركود إلى Data URL لوضعه مباشرة في src للصور أو الطباعة
 */
export const code128ToDataUrl = (text: string, options?: Parameters<typeof generateCode128Svg>[1]): string => {
    const svg = generateCode128Svg(text, options);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Hook لمسح الباركود بجهاز المسح الضوئي (Barcode Scanner Gun) في أي مكان بالصفحة
 * يلتقط سرعة الكتابة السريعة الناتجة عن قارئ الباركود (< 50ms بين الأحرف)
 */
export const useBarcodeScanner = (
    onScan: (barcode: string) => void,
    options: { enabled?: boolean; minLength?: number } = {}
) => {
    const enabled = options.enabled !== false;
    const minLength = options.minLength || 3;
    const bufferRef = useRef<string>('');
    const lastKeyTimeRef = useRef<number>(0);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // تجاهل أزرار التحكم الخاصة
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const now = Date.now();
            const timeDiff = now - lastKeyTimeRef.current;
            lastKeyTimeRef.current = now;

            // إذا انتهى المسح بزر Enter
            if (e.key === 'Enter') {
                const buffer = bufferRef.current.trim();
                bufferRef.current = '';

                // لو الإدخال كان سريعاً وبطول باركود صالح
                if (buffer.length >= minLength) {
                    const cleanBarcode = normalizeBarcode(buffer);
                    if (cleanBarcode) {
                        e.preventDefault();
                        e.stopPropagation();
                        onScanRef.current(cleanBarcode);
                    }
                }
                return;
            }

            // جهاز الباركود يرسل الحروف بفاصل زمني صغير جداً (< 50ms)
            // إذا كان الفارق الزمني كبيراً (> 80ms) فهو إدخال يدوي بشري فنفرغ المخزن المؤقت
            if (timeDiff > 80 && bufferRef.current.length > 0) {
                bufferRef.current = '';
            }

            // إضافة الحرف الصالح إلى البافر
            if (e.key.length === 1) {
                bufferRef.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, minLength]);
};
