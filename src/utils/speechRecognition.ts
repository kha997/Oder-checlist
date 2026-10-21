import { type Product, type CondoLocation } from '../types';
import { removeVietnameseTones } from './searchHelper';

// TypeScript declarations for Web Speech API
export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * Checks if the browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Creates a SpeechRecognition instance with safe browser fallbacks
 */
export function createSpeechRecognition(options?: {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}): ISpeechRecognition | null {
  if (!isSpeechRecognitionSupported()) return null;

  try {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) return null;
    const recognition = new SpeechClass();
    recognition.lang = options?.lang || 'vi-VN';
    recognition.continuous = options?.continuous ?? true;
    recognition.interimResults = options?.interimResults ?? true;
    recognition.maxAlternatives = 1;
    return recognition;
  } catch (err) {
    console.error('Error creating SpeechRecognition instance:', err);
    return null;
  }
}

/**
 * Translates speech recognition error codes to Vietnamese user-friendly messages
 */
export function getSpeechErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Trình duyệt chưa được cấp quyền sử dụng Microphone. Vui lòng bấm vào biểu tượng ổ khóa/micro trên thanh địa chỉ để Cho phép (Allow).';
    case 'no-speech':
      return 'Không nhận thấy âm thanh nào. Vui lòng nói to hoặc để micro gần hơn.';
    case 'audio-capture':
      return 'Không tìm thấy thiết bị Microphone trên máy hoặc micro đang bị ứng dụng khác sử dụng.';
    case 'network':
      return 'Không thể kết nối đến máy chủ nhận diện giọng nói. Vui lòng kiểm tra lại mạng Internet.';
    case 'aborted':
      return 'Đã dừng thu âm giọng nói.';
    default:
      return `Lỗi nhận diện giọng nói: ${error}. Bạn có thể thử lại hoặc dùng văn bản mẫu.`;
  }
}

// Convert Vietnamese spoken words for digits into numeric values
const VIETNAMESE_NUMBER_WORDS: Record<string, number> = {
  'không': 0,
  'khong': 0,
  'một': 1,
  'mot': 1,
  'mốt': 1,
  'hai': 2,
  'đôi': 2,
  'doi': 2,
  'ba': 3,
  'bốn': 4,
  'bon': 4,
  'tư': 4,
  'tu': 4,
  'năm': 5,
  'nam': 5,
  'lăm': 5,
  'sáu': 6,
  'sau': 6,
  'bảy': 7,
  'bay': 7,
  'tám': 8,
  'tam': 8,
  'chín': 9,
  'chin': 9,
  'mười': 10,
  'muoi': 10,
};

/**
 * Parsed Order Structure from Voice
 */
export interface ParsedVoiceOrder {
  rawTranscript: string;
  matchedItems: {
    productId: string;
    productName: string;
    unitPrice: number;
    unit: string;
    quantity: number;
  }[];
  detectedLocation?: {
    type: 'condo' | 'external';
    condoId?: string;
    condoName?: string;
    block?: string;
    floor?: string;
    unit?: string;
    externalAddress?: string;
  };
  detectedCustomer?: {
    name?: string;
    phone?: string;
  };
  detectedNotes: string;
  confidenceScore: number;
}

/**
 * Extracts a phone number from spoken text
 * e.g. "0901234567" or "09 01 23 45 67" or "số điện thoại không chín không một..."
 */
function extractPhoneNumber(text: string): string | undefined {
  // Direct digit sequences
  const digitMatch = text.replace(/[\s.-]/g, '').match(/(0[3|5|7|8|9][0-9]{8})/);
  if (digitMatch) {
    return digitMatch[1];
  }

  // Spoken numbers translation (e.g. "không chín không một hai ba bốn năm sáu bảy")
  const tokens = text.toLowerCase().split(/\s+/);
  let digitBuf = '';
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      digitBuf += token;
    } else if (VIETNAMESE_NUMBER_WORDS[token] !== undefined) {
      digitBuf += VIETNAMESE_NUMBER_WORDS[token].toString();
    } else {
      if (digitBuf.length >= 10 && digitBuf.startsWith('0')) {
        return digitBuf.slice(0, 10);
      }
      digitBuf = '';
    }
  }

  if (digitBuf.length >= 10 && digitBuf.startsWith('0')) {
    return digitBuf.slice(0, 10);
  }

  return undefined;
}

/**
 * Extracts condo, block, floor, unit or room numbers from spoken text
 */
function extractCondoLocation(
  text: string,
  condos: CondoLocation[]
): ParsedVoiceOrder['detectedLocation'] | undefined {
  const clean = text.toLowerCase();
  const tonesRemoved = removeVietnameseTones(text);

  // 1. Detect Condo if mentioned
  let matchedCondo = condos[0];
  for (const c of condos) {
    const cClean = removeVietnameseTones(c.name);
    if (tonesRemoved.includes(cClean) || clean.includes(c.name.toLowerCase())) {
      matchedCondo = c;
      break;
    }
  }

  // 2. Detect Block (e.g. "toà B", "tòa S2", "block A", "khối B")
  let detectedBlock: string | undefined;
  const blockRegex = /(?:toa|toà|tòa|block|thap|tháp|khoi|khối)\s+([a-zA-Z0-9.]+)/i;
  const blockMatch = text.match(blockRegex);
  if (blockMatch) {
    const candidate = blockMatch[1].toUpperCase();
    if (matchedCondo?.blocks?.includes(candidate) || candidate.length <= 4) {
      detectedBlock = candidate;
    }
  }

  // 3. Detect Unit / Room / Floor (e.g. "phòng 1205", "phong 15.02", "căn 2010", "căn B-1205", "tầng 12 phòng 05")
  let detectedFloor: string | undefined;
  let detectedUnit: string | undefined;

  // Pattern: "tầng X căn/phòng Y"
  const floorAndUnitMatch = text.match(
    /(?:tang|tầng|lau|lầu)\s+(\d{1,2})\s+(?:can|căn|phong|phòng|so|số)\s+([0-9a-zA-Z]+)/i
  );
  if (floorAndUnitMatch) {
    detectedFloor = floorAndUnitMatch[1];
    detectedUnit = floorAndUnitMatch[2];
  } else {
    // Pattern: "phòng/căn 1205" or "phòng 12.05"
    const roomMatch = text.match(/(?:phong|phòng|can|căn|p\.)\s*([a-zA-Z0-9._-]+)/i);
    if (roomMatch) {
      const roomStr = roomMatch[1].replace(/[^0-9]/g, '');
      if (roomStr.length === 4) {
        // e.g. 1205 -> floor 12, unit 05
        detectedFloor = roomStr.slice(0, 2);
        detectedUnit = roomStr.slice(2);
      } else if (roomStr.length === 3) {
        // e.g. 805 -> floor 8, unit 05
        detectedFloor = roomStr.slice(0, 1);
        detectedUnit = roomStr.slice(1);
      } else if (roomStr.length > 0) {
        detectedUnit = roomStr;
      }
    }
  }

  // Fallback: look for 3-4 digit standalone numbers like 1502 or 2010
  if (!detectedFloor && !detectedUnit) {
    const standaloneMatch = text.match(/\b([1-3][0-9][0-9]{2})\b/);
    if (standaloneMatch) {
      const num = standaloneMatch[1];
      detectedFloor = num.slice(0, 2);
      detectedUnit = num.slice(2);
    }
  }

  // If we found any condo details, return condo location
  if (detectedBlock || detectedFloor || detectedUnit || matchedCondo) {
    return {
      type: 'condo',
      condoId: matchedCondo?.id,
      condoName: matchedCondo?.name,
      block: detectedBlock || matchedCondo?.blocks?.[0] || 'B',
      floor: detectedFloor || '',
      unit: detectedUnit || '',
    };
  }

  return undefined;
}

/**
 * Extracts customer name if spoken with polite honorifics or explicit keywords
 * e.g. "khách anh Tuấn", "chị Lan", "bác Hùng", "cho anh Minh"
 */
function extractCustomerName(text: string): string | undefined {
  const namePatterns = [
    /(?:khach|khách|cho)\s+(?:ten|tên|la|là)?\s*(?:anh|chị|chi|em|bác|bac|cô|co|chú|chu)?\s*([A-ZÀ-Ỹa-zà-ỹ]+(?:\s+[A-ZÀ-Ỹa-zà-ỹ]+)?)/i,
    /(?:anh|chị|chi|bác|bac|cô|co|chú|chu)\s+([A-ZÀ-Ỹa-zà-ỹ]+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const raw = match[1].trim();
      const lower = raw.toLowerCase();
      // Exclude common non-name words
      const excluded = ['it', 'khong', 'giao', 'nho', 'nhanh', 'tang', 'phong', 'toa', 'can', 'so', 'ca', 'tra', 'banh'];
      if (!excluded.includes(removeVietnameseTones(lower))) {
        // Capitalize first letter
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      }
    }
  }
  return undefined;
}

/**
 * Common special instruction phrases for food delivery & restaurants
 */
const COMMON_SPECIAL_INSTRUCTIONS = [
  'ít ngọt',
  'it ngot',
  'không đường',
  'khong duong',
  'ít đá',
  'it da',
  'nhiều đá',
  'nhieu da',
  'không đá',
  'khong da',
  'không ớt',
  'khong ot',
  'ít cay',
  'it cay',
  'cay nhiều',
  'không hành',
  'khong hanh',
  'nhiều sốt',
  'nhieu sot',
  'ít sốt',
  'it sot',
  'để riêng sốt',
  'tách riêng',
  'tach rieng',
  'gọi trước 5 phút',
  'goi truoc 5 phut',
  'gọi trước 10 phút',
  'gọi trước khi đến',
  'giao sảnh bảo vệ',
  'giao bao ve',
  'giao sảnh lễ tân',
  'gửi lễ tân',
  'gui le tan',
  'bấm chuông',
  'bam chuong',
  'treo trước cửa',
  'treo truoc cua',
  'để trước cửa',
  'nhà có em bé ngủ',
  'em bé ngủ',
  'đóng gói làm quà',
  'đóng gói cẩn thận',
  'thêm muỗng đũa',
  'them muong dua',
  'không lấy muỗng đũa',
  'giao trước 12h',
  'giao gap',
  'giao gấp',
];

/**
 * Extracts special instructions and delivery notes
 */
function extractSpecialInstructions(text: string): string[] {
  const cleanLower = text.toLowerCase();
  const tonesClean = removeVietnameseTones(text);
  const matchedNotes: string[] = [];

  for (const phrase of COMMON_SPECIAL_INSTRUCTIONS) {
    const phraseTones = removeVietnameseTones(phrase);
    if (cleanLower.includes(phrase) || tonesClean.includes(phraseTones)) {
      // Find clean Vietnamese display text
      const prettyPhrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
      if (!matchedNotes.some((n) => removeVietnameseTones(n) === phraseTones)) {
        matchedNotes.push(prettyPhrase);
      }
    }
  }

  return matchedNotes;
}

/**
 * Intelligent Parser for Spoken Vietnamese Order Dictation
 */
export function parseVoiceOrder(
  transcript: string,
  products: Product[],
  condos: CondoLocation[]
): ParsedVoiceOrder {
  const rawTranscript = transcript.trim();
  const lowerTranscript = rawTranscript.toLowerCase();
  const cleanTranscript = removeVietnameseTones(rawTranscript);

  const matchedItems: ParsedVoiceOrder['matchedItems'] = [];
  const detectedInstructions = extractSpecialInstructions(rawTranscript);

  // 1. Detect Products & Quantities
  for (const prod of products) {
    // Generate clean keywords from product name
    const prodClean = removeVietnameseTones(prod.name);
    // Also remove parenthesis English e.g. "Cà phê Muối (Salt Coffee)" -> "ca phe muoi"
    const simpleClean = prodClean.split('(')[0].trim();
    const parts = simpleClean.split(/\s+/);

    // Look for occurrences of product name in transcript
    let hasMatch = false;
    let matchIndex = cleanTranscript.indexOf(simpleClean);
    if (matchIndex !== -1) {
      hasMatch = true;
    } else if (parts.length >= 2) {
      // Match significant keywords e.g. "ca phe muoi" or "tra dao" or "banh mi chao"
      const subKey = parts.slice(0, 2).join(' ');
      matchIndex = cleanTranscript.indexOf(subKey);
      if (matchIndex !== -1) {
        hasMatch = true;
      }
    }

    if (hasMatch) {
      // Look for quantity word or number directly preceding or nearby the product mention
      const precedingText = cleanTranscript.slice(Math.max(0, matchIndex - 25), matchIndex).trim();
      const precedingTokens = precedingText.split(/\s+/);
      const lastToken = precedingTokens[precedingTokens.length - 1];
      const secondLastToken = precedingTokens[precedingTokens.length - 2];

      let qty = 1;

      // Check numeric digit e.g. "2" or "3"
      if (lastToken && /^\d+$/.test(lastToken)) {
        qty = parseInt(lastToken, 10);
      } else if (secondLastToken && /^\d+$/.test(secondLastToken)) {
        qty = parseInt(secondLastToken, 10);
      } else if (lastToken && VIETNAMESE_NUMBER_WORDS[lastToken]) {
        qty = VIETNAMESE_NUMBER_WORDS[lastToken];
      } else if (secondLastToken && VIETNAMESE_NUMBER_WORDS[secondLastToken]) {
        qty = VIETNAMESE_NUMBER_WORDS[secondLastToken];
      }

      // Check after product name (e.g. "cà phê muối 2 ly")
      const followingText = cleanTranscript.slice(matchIndex + simpleClean.length, matchIndex + simpleClean.length + 20).trim();
      const followingTokens = followingText.split(/\s+/);
      if (followingTokens[0] && /^\d+$/.test(followingTokens[0])) {
        qty = parseInt(followingTokens[0], 10);
      }

      if (qty > 0 && !matchedItems.some((item) => item.productId === prod.id)) {
        matchedItems.push({
          productId: prod.id,
          productName: prod.name,
          unitPrice: prod.price,
          unit: prod.unit,
          quantity: Math.min(qty, 99),
        });
      }
    }
  }

  // 2. Extract Customer details
  const phone = extractPhoneNumber(rawTranscript);
  const name = extractCustomerName(rawTranscript);
  const detectedCustomer = phone || name ? { name, phone } : undefined;

  // 3. Extract Location
  const detectedLocation = extractCondoLocation(rawTranscript, condos);

  // 4. Assemble final notes
  let finalNotes = detectedInstructions.join(', ');

  // If there are explicit note keywords like "ghi chú [xyz]" or "dặn [xyz]"
  const explicitNoteMatch = rawTranscript.match(/(?:ghi chu|ghi chú|dặn|dặn dò|yêu cầu)\s*:\s*(.+)/i);
  if (explicitNoteMatch && explicitNoteMatch[1]) {
    const extra = explicitNoteMatch[1].trim();
    if (finalNotes && !finalNotes.toLowerCase().includes(extra.toLowerCase())) {
      finalNotes = `${finalNotes}, ${extra}`;
    } else if (!finalNotes) {
      finalNotes = extra;
    }
  }

  // Calculate rough confidence
  let confidenceScore = 0.5;
  if (matchedItems.length > 0) confidenceScore += 0.25;
  if (detectedLocation?.unit || detectedLocation?.floor) confidenceScore += 0.15;
  if (detectedCustomer?.phone) confidenceScore += 0.1;

  return {
    rawTranscript,
    matchedItems,
    detectedLocation,
    detectedCustomer,
    detectedNotes: finalNotes,
    confidenceScore: Math.min(confidenceScore, 1.0),
  };
}

/**
 * Built-in Sample Voice Phrases for rapid testing / offline demos
 */
export const VOICE_ORDER_SAMPLE_PHRASES = [
  {
    label: 'Cà phê & Bánh mì',
    description: '2 Cà phê muối, 1 Bánh mì chảo, phòng 1205 toà B, ít ngọt không ớt',
    text: 'Cho 2 cà phê muối, 1 bánh mì chảo đặc biệt, giao phòng 1205 tòa B, ít ngọt, không ớt, khách anh Tuấn 0901234567, gọi trước 5 phút',
  },
  {
    label: 'Trà đào & Sữa chua',
    description: '2 Trà đào cam sả, 1 Sữa chua trân châu, toà S2 căn 1501',
    text: 'Lấy 2 trà đào cam sả, 1 sữa chua trân châu, giao toà B tầng 15 căn 01, ít đá, nhiều đào, để trước cửa giúp em',
  },
  {
    label: 'Đơn gấp giao sảnh',
    description: '1 Cà phê muối, giao sảnh bảo vệ toà B, khách chị Lan',
    text: '1 cà phê muối ít đường, giao sảnh bảo vệ tòa B, bấm chuông, chị Lan 0933445566',
  },
  {
    label: 'Dặn dò đặc biệt',
    description: 'Giao trước 12h, nhà có em bé ngủ, không bấm chuông',
    text: 'Giao sảnh bảo vệ, gọi trước 5 phút, nhà có em bé ngủ đừng bấm chuông, đóng gói cẩn thận',
  },
];
