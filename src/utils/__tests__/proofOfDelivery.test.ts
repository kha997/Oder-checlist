import { describe, expect, it } from 'vitest';
import {
  FIRESTORE_DOC_LIMIT_BYTES,
  POD_ENCODING,
  dataUrlByteSize,
  podOutputScales,
} from '../../components/ProofOfDeliveryCameraModal';

/**
 * These guard the numbers that made POD uploads fail: a phone-camera frame
 * (3024x4032) encoded at JPEG q=0.85 produced a ~9 MB data URL, which Firestore
 * rejects outright because a document may not exceed 1,048,576 bytes.
 *
 * The pixel resizing itself needs a real canvas and so is exercised in the
 * browser; what is pinned here is the plan it follows — which output sizes are
 * tried, in what order, and the guaranteed final size.
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

describe('POD_ENCODING', () => {
  it('keeps the budget below Firestore\'s hard limit, with room for the rest of the document', () => {
    expect(POD_ENCODING.maxBytes).toBeLessThan(FIRESTORE_DOC_LIMIT_BYTES);
    // The order carries items, notes and amounts besides the photo.
    expect(FIRESTORE_DOC_LIMIT_BYTES - POD_ENCODING.maxBytes).toBeGreaterThan(300_000);
  });

  it('tries quality steps in descending order', () => {
    const steps = [...POD_ENCODING.qualitySteps];
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
    expect(steps[0]).toBeLessThanOrEqual(1);
    expect(steps[steps.length - 1]).toBeGreaterThan(0);
  });

  it('tries fallback scales in descending order, all shrinking', () => {
    const scales = [...POD_ENCODING.fallbackScales];
    expect(scales).toEqual([...scales].sort((a, b) => b - a));
    expect(scales.every((s) => s > 0 && s < 1)).toBe(true);
  });

  it('caps the long edge at 1600 px, the size that was measured to fit', () => {
    expect(POD_ENCODING.maxEdge).toBe(1600);
  });
});

describe('podOutputScales', () => {
  const sizes = (w: number, h: number) =>
    podOutputScales(w, h).map((s) => `${Math.round(w * s)}x${Math.round(h * s)}`);

  it('caps a 12 MP photo at 1600 px on the long edge', () => {
    expect(sizes(3024, 4032)[0]).toBe('1200x1600');
    expect(sizes(4032, 3024)[0]).toBe('1600x1200');
  });

  it('never upscales a source smaller than the cap', () => {
    // A 640x480 frame must not be stretched to 1600 px; that would invent detail
    // and inflate the file for nothing.
    expect(sizes(640, 480)[0]).toBe('640x480');
  });

  it('tries sizes in descending order, so the first fit wins at the best quality', () => {
    const raw = podOutputScales(3024, 4032);
    expect(raw).toEqual([...raw].sort((a, b) => b - a));
  });

  it('always ends with a size small enough to be bounded regardless of content', () => {
    // The last resort pins the long edge to hardMinEdge. Its area is what makes
    // the byte budget provable: an sRGB JPEG cannot exceed ~3 bytes per pixel.
    const scales = podOutputScales(3024, 4032);
    const last = scales[scales.length - 1];
    const pixels = Math.round(3024 * last) * Math.round(4032 * last);
    expect(Math.round(4032 * last)).toBe(POD_ENCODING.hardMinEdge);
    expect(pixels * 3).toBeLessThan(POD_ENCODING.maxBytes);
  });

  it('guarantees a final step even for an absurdly large source', () => {
    // 40 MP: the fallback list alone would stop well above the cap.
    const scales = podOutputScales(6000, 7000);
    const last = scales[scales.length - 1];
    expect(podOutputScales(6000, 7000)).toEqual([...scales].sort((a, b) => b - a));
    expect(Math.round(7000 * last)).toBeLessThanOrEqual(POD_ENCODING.hardMinEdge);
  });

  it('returns no plan for a corrupt image instead of producing NaN dimensions', () => {
    // A not-yet-decoded or broken image reports NaN/0; drawing that onto a canvas
    // throws, so the encoder must decline rather than guess.
    expect(podOutputScales(Number.NaN, 400)).toEqual([]);
    expect(podOutputScales(0, 400)).toEqual([]);
    expect(podOutputScales(400, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('does not duplicate the hard-minimum step when it coincides with a fallback', () => {
    const scales = podOutputScales(3024, 4032);
    expect(new Set(scales).size).toBe(scales.length);
  });
});
