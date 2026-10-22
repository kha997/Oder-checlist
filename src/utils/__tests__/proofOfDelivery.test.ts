import { describe, expect, it } from 'vitest';
import { FIRESTORE_DOC_LIMIT_BYTES, dataUrlByteSize } from '../../components/ProofOfDeliveryCameraModal';

/**
 * These guard the number that made POD uploads fail: a phone-camera frame
 * (3024x4032) encoded at JPEG q=0.85 produced a ~9 MB data URL, which Firestore
 * rejects outright because a document may not exceed 1,048,576 bytes.
 *
 * The sizing itself lives in `encodePodPhoto`, which needs a real canvas and so
 * is exercised in the browser; this file pins the two pure pieces it relies on —
 * the byte accounting and the limit constant.
 */
describe('dataUrlByteSize', () => {
  it('matches the hard limit Firestore documents', () => {
    // Firebase documents: "1,048,576 bytes ... the maximum size of a document".
    expect(FIRESTORE_DOC_LIMIT_BYTES).toBe(1_048_576);
    expect(FIRESTORE_DOC_LIMIT_BYTES).toBe(1024 * 1024);
  });

  it('counts an un-padded base64 payload', () => {
    // "AAAA" -> 3 bytes, no padding.
    expect(dataUrlByteSize('data:image/jpeg;base64,AAAA')).toBe(3);
  });

  it('subtracts a single "=" of padding', () => {
    // "AAA=" -> 2 bytes.
    expect(dataUrlByteSize('data:image/jpeg;base64,AAA=')).toBe(2);
  });

  it('subtracts both "==" of padding', () => {
    // "AA==" -> 1 byte.
    expect(dataUrlByteSize('data:image/jpeg;base64,AA==')).toBe(1);
  });

  it('ignores the media type in the header', () => {
    expect(dataUrlByteSize('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlByteSize('data:;base64,AAAA')).toBe(3);
  });

  it('measures the 9 MB frame that used to break the upload', () => {
    // A base64 string of this length is what a 12 MP high-entropy frame produced,
    // and it must be reported as far beyond the limit.
    const nineMegabytesBase64 = 'A'.repeat(Math.ceil((9_000_000 * 4) / 3));
    const size = dataUrlByteSize(`data:image/jpeg;base64,${nineMegabytesBase64}`);
    expect(size).toBeGreaterThanOrEqual(9_000_000);
    expect(size).toBeGreaterThan(FIRESTORE_DOC_LIMIT_BYTES);
  });

  it('reports a 400 kB photo as safely inside the limit', () => {
    const fourHundredKilobytesBase64 = 'A'.repeat(Math.ceil((400_000 * 4) / 3));
    const size = dataUrlByteSize(`data:image/jpeg;base64,${fourHundredKilobytesBase64}`);
    expect(size).toBeLessThan(FIRESTORE_DOC_LIMIT_BYTES);
  });
});
