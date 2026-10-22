import { describe, expect, it } from 'vitest';
import { buildCsvString, escapeCsvCell } from '../csvExport';

describe('escapeCsvCell', () => {
  it('passes plain values through unchanged', () => {
    expect(escapeCsvCell('Nguyen Van A')).toBe('Nguyen Van A');
    expect(escapeCsvCell(150000)).toBe('150000');
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes cells containing a comma', () => {
    expect(escapeCsvCell('Ha Noi, Vietnam')).toBe('"Ha Noi, Vietnam"');
  });

  it('doubles embedded quotes per RFC 4180', () => {
    expect(escapeCsvCell('She said "hi"')).toBe('"She said ""hi"""');
  });

  it('quotes cells containing newlines', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('leaves numeric 0 intact rather than treating it as empty', () => {
    expect(escapeCsvCell(0)).toBe('0');
  });
});

describe('buildCsvString', () => {
  it('joins cells with commas and rows with CRLF', () => {
    expect(buildCsvString([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('escapes every cell before joining', () => {
    const csv = buildCsvString([
      ['Tên', 'Ghi chú'],
      ['Hoa', 'giao nhanh, gọi trước'],
    ]);
    expect(csv).toBe('Tên,Ghi chú\r\nHoa,"giao nhanh, gọi trước"');
  });

  it('returns an empty string for no rows', () => {
    expect(buildCsvString([])).toBe('');
  });

  it('keeps column count stable even when a cell has a comma', () => {
    const rows = buildCsvString([['a', 'x,y'], ['b', 'z']]);
    const lines = rows.split('\r\n');
    expect(lines).toHaveLength(2);
    // Each line must parse back to exactly 2 logical cells.
    for (const line of lines) {
      const logicalCells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      expect(logicalCells).toHaveLength(2);
    }
  });
});
