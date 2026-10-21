import { type StoreBankConfig, type Order, type Customer } from '../types';
import { formatVND } from './storage';
import { removeVietnameseTones } from './searchHelper';

export interface BankDirectoryItem {
  bin: string;
  code: string;
  shortName: string;
  name: string;
  logo: string;
}

export const VIETNAM_POPULAR_BANKS: BankDirectoryItem[] = [
  {
    bin: '970422',
    code: 'MB',
    shortName: 'MBBank',
    name: 'Ngân hàng Quân Đội',
    logo: 'https://api.vietqr.io/img/MB.png',
  },
  {
    bin: '970436',
    code: 'VCB',
    shortName: 'Vietcombank',
    name: 'Ngoại thương Việt Nam',
    logo: 'https://api.vietqr.io/img/VCB.png',
  },
  {
    bin: '970407',
    code: 'TCB',
    shortName: 'Techcombank',
    name: 'Kỹ thương Việt Nam',
    logo: 'https://api.vietqr.io/img/TCB.png',
  },
  {
    bin: '970415',
    code: 'ICB',
    shortName: 'VietinBank',
    name: 'Công thương Việt Nam',
    logo: 'https://api.vietqr.io/img/ICB.png',
  },
  {
    bin: '970418',
    code: 'BIDV',
    shortName: 'BIDV',
    name: 'Đầu tư & Phát triển Việt Nam',
    logo: 'https://api.vietqr.io/img/BIDV.png',
  },
  {
    bin: '970416',
    code: 'ACB',
    shortName: 'ACB',
    name: 'Á Châu',
    logo: 'https://api.vietqr.io/img/ACB.png',
  },
  {
    bin: '970432',
    code: 'VPB',
    shortName: 'VPBank',
    name: 'Việt Nam Thịnh Vượng',
    logo: 'https://api.vietqr.io/img/VPB.png',
  },
  {
    bin: '970423',
    code: 'TPB',
    shortName: 'TPBank',
    name: 'Tiên Phong',
    logo: 'https://api.vietqr.io/img/TPB.png',
  },
  {
    bin: '970403',
    code: 'STB',
    shortName: 'Sacombank',
    name: 'Sài Gòn Thương Tín',
    logo: 'https://api.vietqr.io/img/STB.png',
  },
  {
    bin: '970441',
    code: 'VIB',
    shortName: 'VIB',
    name: 'Quốc Tế Việt Nam',
    logo: 'https://api.vietqr.io/img/VIB.png',
  },
  {
    bin: '970426',
    code: 'MSB',
    shortName: 'MSB',
    name: 'Hàng Hải',
    logo: 'https://api.vietqr.io/img/MSB.png',
  },
  {
    bin: '970448',
    code: 'OCB',
    shortName: 'OCB',
    name: 'Phương Đông',
    logo: 'https://api.vietqr.io/img/OCB.png',
  },
  {
    bin: '970405',
    code: 'VBA',
    shortName: 'Agribank',
    name: 'Nông nghiệp & PTNT Việt Nam',
    logo: 'https://api.vietqr.io/img/VBA.png',
  },
  {
    bin: '546034',
    code: 'CAKE',
    shortName: 'Cake by VPBank',
    name: 'Ngân hàng số Cake',
    logo: 'https://api.vietqr.io/img/CAKE.png',
  },
];

/**
 * Generates official VietQR / Napas247 payment QR code image URL
 */
export function generateVietQrUrl(params: {
  bankBin: string;
  accountNumber: string;
  accountHolder?: string;
  amount: number;
  memo: string;
  template?: 'compact2' | 'compact' | 'qr_only' | 'print';
}): string {
  const { bankBin, accountNumber, accountHolder, amount, memo, template = 'compact2' } = params;
  const cleanAccount = (accountNumber || '').replace(/[\s\-_.]/g, '');
  const cleanMemo = removeVietnameseTones(memo || '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim();
  const encodedMemo = encodeURIComponent(cleanMemo);
  const roundedAmount = Math.max(0, Math.round(amount || 0));

  let url = `https://img.vietqr.io/image/${bankBin}-${cleanAccount}-${template}.png?amount=${roundedAmount}&addInfo=${encodedMemo}`;
  if (accountHolder) {
    const cleanHolder = removeVietnameseTones(accountHolder)
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .toUpperCase()
      .trim();
    url += `&accountName=${encodeURIComponent(cleanHolder)}`;
  }

  return url;
}

/**
 * Cleans phone number string to Vietnamese standard (e.g. 0901234567)
 */
export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-_().]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Returns direct Zalo 1-tap link
 */
export function getZaloChatUrl(phone?: string): string {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return '';
  return `https://zalo.me/${clean}`;
}

/**
 * Returns standard phone call link
 */
export function getTelUrl(phone?: string): string {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return '';
  return `tel:${clean}`;
}

/**
 * Returns SMS link with optional pre-filled body
 */
export function getSmsUrl(phone?: string, body?: string): string {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return '';
  if (!body) return `sms:${clean}`;
  return `sms:${clean}?body=${encodeURIComponent(body)}`;
}

export type ReminderTone = 'GENTLE' | 'STATEMENT' | 'URGENT' | 'SMS_SHORT';

export interface OverdueReminderTemplate {
  id: ReminderTone;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  channel: 'ZALO' | 'SMS' | 'BOTH';
  content: string;
}

/**
 * Generates automated pre-filled reminder messages (Zalo or SMS) for customers with overdue/unpaid balances
 */
export function getOverdueReminderTemplates(
  customer: Customer,
  unpaidOrders: Order[],
  bankConfig?: StoreBankConfig,
  daysOverdue: number = 0
): OverdueReminderTemplate[] {
  const customerName = customer.name || 'Quý khách';
  const cleanPhone = cleanPhoneNumber(customer.phone);
  const totalDebt = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalStr = formatVND(totalDebt);
  const count = unpaidOrders.length;
  const storeName = bankConfig?.accountHolder ? `Bếp / Quán ăn` : 'Quán';

  const transferMemo = cleanPhone
    ? `NO ${cleanPhone}`
    : `NO ${customer.unit || customer.name.replace(/\s+/g, '')}`;

  const bankInfoText = bankConfig
    ? `\n💳 TK Chuyển khoản VietQR: ${bankConfig.bankCode || bankConfig.bankName} - STK: ${bankConfig.accountNumber} (${bankConfig.accountHolder || ''}) - Cú pháp: ${transferMemo}`
    : '';

  // 1. Gentle Reminder (Nhắc khéo, nhã nhặn - Tone 1)
  const gentleMsg = `Dạ em chào anh/chị ${customerName} ạ! 🌸\n\nEm bên ${storeName} xin phép gửi tin nhắn để đối soát tiền các đơn hàng anh/chị đã đặt bên em gần đây ạ:\n• Số đơn chưa thanh toán: ${count} đơn\n• Tổng số tiền nợ: ${totalStr}${bankInfoText}\n\nKhi nào tiện anh/chị chuyển khoản hoặc thanh toán giúp quán với nhé ạ. Em cảm ơn anh/chị nhiều và chúc anh/chị một ngày thật vui vẻ! 🙏`;

  // 2. Official Statement (Đối soát định kỳ cuối tuần / cuối kỳ - Tone 2)
  const ordersSummary = unpaidOrders
    .slice(0, 3)
    .map((o) => `• Đơn #${o.id} (${new Date(o.createdAt).toLocaleDateString('vi-VN')}): ${formatVND(o.totalAmount)}`)
    .join('\n');
  const moreText = count > 3 ? `\n... và thêm ${count - 3} đơn khác` : '';

  const statementMsg = `📋 THÔNG BÁO ĐỐI SOÁT CÔNG NỢ ĐỊNH KỲ\nKính gửi: Anh/Chị ${customerName} (${customer.phone || 'Quý khách'})\n\nBếp xin gửi bảng tổng hợp công nợ tính đến hôm nay:\n${ordersSummary}${moreText}\n━━━━━━━━━━━━━━━━━━━━\n👉 TỔNG TIỀN CẦN THANH TOÁN: ${totalStr}${bankInfoText}\n\nAnh/chị vui lòng kiểm tra lại đơn và thanh toán để bếp chốt sổ công nợ kỳ này nhé ạ. Nếu có bất kỳ khoản nào cần đối chiếu lại, anh/chị cứ nhắn lại để bên em kiểm tra ngay ạ. Cảm ơn anh/chị rất nhiều! 🙏`;

  // 3. Urgent Overdue Reminder (Cảnh báo quá hạn >7 ngày - Tone 3)
  const urgentPrefix = daysOverdue >= 7 ? ` (đã quá hạn ${daysOverdue} ngày)` : '';
  const urgentMsg = `⚠️ THÔNG BÁO CÔNG NỢ QUÁ HẠN CẦN THANH TOÁN\nKính gửi: Anh/Chị ${customerName}!\n\nHiện tại tài khoản của anh/chị đang có ${count} đơn hàng với tổng công nợ là ${totalStr}${urgentPrefix} chưa được thanh toán trên hệ thống.${bankInfoText}\n\nDo quy định giới hạn công nợ của quán, kính nhờ anh/chị vui lòng thanh toán sớm trong hôm nay để quán tiếp tục hỗ trợ giao các đơn tiếp theo tốt nhất ạ.\n\nTrường hợp anh/chị đã thanh toán rồi, xin chụp lại bill chuyển khoản gửi vào Zalo này để bên em kiểm tra và gạch nợ ngay ạ. Em cảm ơn anh/chị!`;

  // 4. SMS Short Text (Bản rút gọn chuẩn tin nhắn SMS tiếng Việt không dấu / có dấu ngắn gọn)
  const bankShort = bankConfig
    ? ` STK: ${bankConfig.bankCode} ${bankConfig.accountNumber} (${transferMemo})`
    : '';
  const smsMsg = `[Nhac no] Chao anh/chi ${customerName}, don hang tai quan con ${count} don chua thanh toan, tong: ${totalStr}.${bankShort}. Vui long thanh toan giup quan. Xin cam on!`;

  return [
    {
      id: 'GENTLE',
      title: 'Nhắc Khéo Nhã Nhặn (Tone 1)',
      subtitle: 'Thân thiện, lịch sự, thích hợp gửi nhắc lần đầu',
      badge: 'Thân thiện',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      channel: 'ZALO',
      content: gentleMsg,
    },
    {
      id: 'STATEMENT',
      title: 'Đối Soát Chi Tiết Cuối Kỳ (Tone 2)',
      subtitle: 'Bảng kê danh sách đơn và tài khoản VietQR',
      badge: 'Chuẩn đối soát',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      channel: 'ZALO',
      content: statementMsg,
    },
    {
      id: 'URGENT',
      title: 'Nhắc Nợ Quá Hạn Gấp (Tone 3)',
      subtitle: daysOverdue >= 7 ? `Cảnh báo quá hạn ${daysOverdue} ngày` : 'Nhắc thanh toán khẩn',
      badge: daysOverdue >= 7 ? `Quá hạn ${daysOverdue} ngày` : 'Khẩn',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      channel: 'ZALO',
      content: urgentMsg,
    },
    {
      id: 'SMS_SHORT',
      title: 'Tin Nhắn SMS Ngắn Gọn (SMS)',
      subtitle: 'Tối ưu độ dài ký tự SMS, gửi trực tiếp qua ứng dụng Tin nhắn',
      badge: 'SMS Trực tiếp',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      channel: 'SMS',
      content: smsMsg,
    },
  ];
}

/**
 * Prepares quick message templates for shippers to send to customers via Zalo or SMS
 */
export function getShipperMessageTemplates(
  order: Order,
  bankConfig?: StoreBankConfig
): { id: string; title: string; content: string }[] {
  const address = order.location.formattedAddress || 'địa chỉ của bạn';
  const orderId = order.id;
  const amountStr = formatVND(order.totalAmount);
  const condoName = order.location.condoName ? ` (${order.location.condoName})` : '';

  const bankNote = bankConfig
    ? `\n💳 Chuyển khoản VietQR: ${bankConfig.bankCode} - STK: ${bankConfig.accountNumber} (${bankConfig.accountHolder || ''}) - Nội dung: ${orderId}`
    : '';

  return [
    {
      id: 'arriving',
      title: '🚚 Sắp tới nơi / Đang ở sảnh',
      content: `Dạ em chào anh/chị, em là Shipper đang giao đơn ${orderId} đến sảnh ${address}${condoName} rồi ạ. Nhờ anh/chị xuống sảnh nhận hàng giúp em với nhé! Em cảm ơn anh/chị.`,
    },
    {
      id: 'left_reception',
      title: '🏢 Đã gửi sảnh lễ tân',
      content: `Dạ em chào anh/chị, em đã gửi gói hàng đơn ${orderId} của anh/chị tại quầy lễ tân sảnh ${address}${condoName} theo lời dặn rồi ạ. Anh/chị ghé lấy giúp em nhé, chúc anh/chị ngon miệng!`,
    },
    {
      id: 'payment_reminder',
      title: '💰 Báo số tiền & VietQR',
      content: `Dạ đơn hàng ${orderId} của anh/chị tổng cộng là ${amountStr}. Anh/chị có thể thanh toán tiền mặt hoặc quét mã VietQR giúp em nhé!${bankNote}\nEm cảm ơn anh/chị nhiều ạ.`,
    },
  ];
}

/**
 * Generates an official, polite Vietnamese debt reconciliation statement for Zalo
 */
export function generateCustomerDebtZaloStatement(
  customer: Customer,
  unpaidOrders: Order[],
  bankConfig?: StoreBankConfig
): string {
  const customerName = customer.name || 'Quý khách';
  const addressInfo =
    customer.defaultLocationType === 'condo'
      ? `${customer.block || ''}${customer.floor ? '-' + customer.floor : ''}${customer.unit ? '-' + customer.unit : ''} ${customer.condoName ? `(${customer.condoName})` : ''}`.trim()
      : customer.externalAddress || 'Địa chỉ đăng ký';

  const totalDebt = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const nowStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const ordersListText = unpaidOrders
    .map((o, index) => {
      const orderDate = new Date(o.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      });
      const itemsSummary = o.items
        .map((it) => `${it.productName} (x${it.quantity})`)
        .slice(0, 2)
        .join(', ');
      const moreItems = o.items.length > 2 ? ` +${o.items.length - 2} món` : '';
      return `${index + 1}. [${o.id}] Ngày ${orderDate}: ${formatVND(o.totalAmount)}\n   • Món: ${itemsSummary}${moreItems}`;
    })
    .join('\n');

  const transferMemo = customer.phone
    ? `NO ${cleanPhoneNumber(customer.phone)}`
    : `NO ${customer.unit || customer.name.replace(/\s+/g, '')}`;

  const bankSection = bankConfig
    ? `\n━━━━━━━━━━━━━━━━━━━━\n💳 THÔNG TIN CHUYỂN KHOẢN VIETQR:\n• Ngân hàng: ${bankConfig.bankName}\n• Số tài khoản: ${bankConfig.accountNumber}\n• Chủ tài khoản: ${bankConfig.accountHolder}\n• Số tiền: ${formatVND(totalDebt)}\n• Nội dung chuyển khoản: ${transferMemo}`
    : '';

  return `📋 BẢNG ĐỐI SOÁT CÔNG NỢ ĐƠN HÀNG (${nowStr})\nKính gửi: Anh/Chị ${customerName}\nCăn hộ/Địa chỉ: ${addressInfo || 'Quý khách'}\nSố điện thoại: ${customer.phone || 'Chưa cập nhật'}\n\nQuán xin gửi anh/chị bảng kê ${unpaidOrders.length} đơn hàng chưa thanh toán tính đến hiện tại:\n\n${ordersListText}\n\n━━━━━━━━━━━━━━━━━━━━\n👉 TỔNG CỘNG CÔNG NỢ CẦN THANH TOÁN: ${formatVND(totalDebt)}${bankSection}\n\nAnh/chị kiểm tra lại giúp quán nhé. Nếu có thắc mắc xin cứ nhắn lại để quán đối soát ngay. Chân thành cảm ơn anh/chị đã luôn ủng hộ quán ạ! 🙏`;
}

/**
 * Generates dynamic VietQR URL for customer's total aggregated debt
 */
export function generateCustomerDebtVietQrUrl(
  customer: Customer,
  totalDebtAmount: number,
  bankConfig: StoreBankConfig
): string {
  const transferMemo = customer.phone
    ? `NO ${cleanPhoneNumber(customer.phone)}`
    : `NO ${customer.unit || customer.name.replace(/\s+/g, '')}`;

  return generateVietQrUrl({
    bankBin: bankConfig.bankBin,
    accountNumber: bankConfig.accountNumber,
    accountHolder: bankConfig.accountHolder,
    amount: totalDebtAmount,
    memo: transferMemo,
    template: bankConfig.qrTemplate || 'compact2',
  });
}

