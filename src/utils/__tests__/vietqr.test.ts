import { describe, expect, it } from 'vitest';
import { cleanPhoneNumber, getTelUrl, getZaloChatUrl } from '../vietqr';

describe('cleanPhoneNumber', () => {
  it('strips spaces, dashes, dots, brackets and underscores', () => {
    expect(cleanPhoneNumber('(090) 123-45.67_')).toBe('0901234567');
  });

  it('normalises the international +84 prefix to a leading 0', () => {
    expect(cleanPhoneNumber('+84 901 234 567')).toBe('0901234567');
  });

  it('normalises a bare 84 prefix when the number is long enough', () => {
    expect(cleanPhoneNumber('84 901 234 567')).toBe('0901234567');
  });

  it('leaves a local number untouched', () => {
    expect(cleanPhoneNumber('0901234567')).toBe('0901234567');
  });

  it('returns an empty string for missing input', () => {
    expect(cleanPhoneNumber()).toBe('');
    expect(cleanPhoneNumber('')).toBe('');
  });
});

describe('getZaloChatUrl', () => {
  it('builds a zalo.me deep link from the cleaned number', () => {
    expect(getZaloChatUrl('0901 234 567')).toBe('https://zalo.me/0901234567');
    expect(getZaloChatUrl('+84 901 234 567')).toBe('https://zalo.me/0901234567');
  });

  it('returns an empty string when there is no phone number', () => {
    expect(getZaloChatUrl()).toBe('');
  });
});

describe('getTelUrl', () => {
  it('builds a tel: link from the cleaned number', () => {
    expect(getTelUrl('0901 234 567')).toBe('tel:0901234567');
  });

  it('returns an empty string when there is no phone number', () => {
    expect(getTelUrl(undefined)).toBe('');
  });
});
