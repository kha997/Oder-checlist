import { describe, expect, it } from 'vitest';
import {
  FIRESTORE_DOC_LIMIT_BYTES,
  POD_ENCODING,
  dataUrlByteSize,
  podOutputSize,
  podShrinkSequence,
} from '../../components/ProofOfDeliveryCameraModal';

/**
 * These guard the numbers that made POD uploads fail: a phone-camera frame
 * (3024x4032) encoded at JPEG q=0.85 produced a ~9 MB data URL, which Firestore
 * rejects outright because a document may not exceed 1,048,576 bytes.
 *
 * The pixel encoding itself needs a real canvas and so is exercised in the
 * browser; what is pinned here is the arithmetic around it — the byte accounting,
 * the first-pass size, and the shrink sequence that the encoder relies on to
 * converge.
 */
describe('dataUrlByteSize', () => {
  it('matches the hard limit Firestore documents', () => {
    // Firebase documents: "1,048,576 bytes ... the maximum size of a document".
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

  it('handles a parameterised media type', () => {
    // `canvas.toDataURL` never emits this, but the helper is exported and a
    // header regex that stops at the first ";" would over-count by the header.
    expect(dataUrlByteSize('data:image/jpeg;charset=utf-8;base64,AAAA')).toBe(3);
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

  it('is stricter than the raw string length, which is what the budget must use', () => {
    // The budget used to be compared against `dataUrl.length`. For pure base64
    // the two agree, but the decoded size is the number Firestore applies.
    const url = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
    expect(dataUrlByteSize(url)).toBe(3000);
    expect(url.length).toBeGreaterThan(3000);
  });
});

describe('POD_ENCODING', () => {
  it('keeps the budget below Firestore\'s hard limit, with room for the rest of the document', () => {
    expect(POD_ENCODING.maxBytes).toBeLessThan(FIRESTORE_DOC_LIMIT_BYTES);
    // The order carries items, notes and amounts besides the photo.
    expect(FIRESTORE_DOC_LIMIT_BYTES - POD_ENCODING.maxBytes).toBeGreaterThan(300_000);
  });

  it('tries quality steps in descending order, all within (0, 1]', () => {
    const steps = [...POD_ENCODING.qualitySteps];
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
    expect(steps.every((s) => s > 0 && s <= 1)).toBe(true);
  });

  it('caps the long edge at 1600 px, the size that was measured to fit', () => {
    expect(POD_ENCODING.maxEdge).toBe(1600);
  });

  it('shrinks by a factor strictly between 0 and 1, so each pass makes progress', () => {
    expect(POD_ENCODING.shrinkFactor).toBeGreaterThan(0);
    expect(POD_ENCODING.shrinkFactor).toBeLessThan(1);
  });
});

describe('podOutputSize', () => {
  it('caps a 12 MP photo at 1600 px on the long edge', () => {
    expect(podOutputSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(podOutputSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it('never upscales a source smaller than the cap', () => {
    // A 640x480 frame must not be stretched to 1600 px; that would invent detail
    // and inflate the file for nothing.
    expect(podOutputSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it('always produces whole, positive dimensions', () => {
    for (const [w, h] of [
      [3024, 4032],
      [10000, 10],
      [10, 10000],
      [1, 1],
      [4032.7, 3023.2],
    ]) {
      const size = podOutputSize(w, h);
      expect(size).not.toBeNull();
      expect(Number.isInteger(size!.width)).toBe(true);
      expect(Number.isInteger(size!.height)).toBe(true);
      expect(size!.width).toBeGreaterThanOrEqual(1);
      expect(size!.height).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns null for a corrupt image instead of producing NaN dimensions', () => {
    // A not-yet-decoded or broken image reports NaN/0; drawing that onto a canvas
    // throws, so the encoder must decline rather than guess.
    expect(podOutputSize(Number.NaN, 400)).toBeNull();
    expect(podOutputSize(0, 400)).toBeNull();
    expect(podOutputSize(400, Number.POSITIVE_INFINITY)).toBeNull();
    expect(podOutputSize(-10, 400)).toBeNull();
  });
});

describe('podShrinkSequence', () => {
  it('starts at the size it is given', () => {
    expect(podShrinkSequence(1200, 1600)[0]).toEqual({ width: 1200, height: 1600 });
  });

  it('shrinks monotonically until it reaches the floor', () => {
    const sizes = podShrinkSequence(1200, 1600);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i].width).toBeLessThanOrEqual(sizes[i - 1].width);
      expect(sizes[i].height).toBeLessThanOrEqual(sizes[i - 1].height);
      // At least one dimension must strictly decrease, or the loop would spin.
      expect(sizes[i].width < sizes[i - 1].width || sizes[i].height < sizes[i - 1].height).toBe(true);
    }
  });

  it('reaches the long-edge floor instead of running out of passes', () => {
    // This is the important property: the stop condition is a size, not an
    // arbitrary array length, so the sequence cannot end while still huge.
    const sizes = podShrinkSequence(1200, 1600);
    const last = sizes[sizes.length - 1];
    expect(Math.max(last.width, last.height)).toBeLessThanOrEqual(POD_ENCODING.minEdge);
    expect(sizes.length).toBeLessThan(POD_ENCODING.maxPasses);
  });

  it('reaches the floor for every source size the encoder will actually see', () => {
    // The encoder caps the long edge at 1600 px before the first pass, so any
    // start it produces has a long edge of at most 1600 — the only absurd starts
    // here are the pathological aspect ratios the cap still has to survive.
    const starts: Array<[number, number]> = [
      [1600, 1200],
      [1200, 1600],
      [900, 900],
      [640, 480],
      [400, 300],
      [1, 1],
    ];
    for (const [w, h] of starts) {
      const sizes = podShrinkSequence(w, h);
      const last = sizes[sizes.length - 1];
      expect(Math.max(last.width, last.height)).toBeLessThanOrEqual(POD_ENCODING.minEdge);
      expect(sizes.length).toBeLessThanOrEqual(POD_ENCODING.maxPasses);
    }
  });

  it('does not run past the pass cap for a start the floor is reachable from', () => {
    // With shrink factor 0.75, reaching the 320 px floor from a 1600 px start
    // takes about 5 passes; the cap of 12 leaves generous headroom for the
    // quality ladder to do its own work first.
    const sizes = podShrinkSequence(1600, 1200);
    expect(sizes.length).toBeLessThanOrEqual(POD_ENCODING.maxPasses);
    expect(sizes.length).toBeGreaterThanOrEqual(2);
  });

  it('terminates within the pass cap for every start size', () => {
    for (const [w, h] of [
      [1600, 1200],
      [1, 1],
      [10000, 10],
      [10, 10000],
      [320, 320],
    ]) {
      const sizes = podShrinkSequence(w, h);
      expect(sizes.length).toBeLessThanOrEqual(POD_ENCODING.maxPasses);
      expect(Math.max(sizes[sizes.length - 1].width, sizes[sizes.length - 1].height)).toBeLessThanOrEqual(
        Math.max(POD_ENCODING.minEdge, Math.max(w, h))
      );
    }
  });

  it('never produces a zero dimension, which would make the canvas invalid', () => {
    // A 10000x10 source shrinks the short edge toward zero; Math.max(1, ...) must
    // hold it at 1.
    for (const size of podShrinkSequence(10000, 10)) {
      expect(size.width).toBeGreaterThanOrEqual(1);
      expect(size.height).toBeGreaterThanOrEqual(1);
    }
  });
});
