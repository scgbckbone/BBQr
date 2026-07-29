import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { joinQRs } from '../src/join';

const doc = JSON.parse(
  readFileSync(new URL('../../test_data/bip-test-vectors.json', import.meta.url), 'utf-8')
);

describe('BBQr BIP draft vectors', () => {
  for (const v of doc.vectors) {
    test(`decode ${v.name}`, () => {
      for (const frames of [v.frames, [...v.frames].reverse()]) {
        const { fileType, raw } = joinQRs(frames);

        expect(fileType).toBe(v.file_type);
        expect(raw.length).toBe(v.input_length);
        expect(createHash('sha256').update(raw).digest('hex')).toBe(v.input_sha256);
      }
    });
  }

  for (const c of doc.invalid_cases) {
    test(`reject ${c.name}`, () => {
      expect(() => joinQRs(c.frames)).toThrow();
    });
  }
});

describe('DEFLATE resource limits', () => {
  test('reject back-reference distance beyond the 1k window', () => {
    const frame = readFileSync(
      new URL('../../test_data/deflate-overwide-distance.txt', import.meta.url),
      'utf-8'
    ).trim();

    expect(() => joinQRs([frame])).toThrow(/distance/);
  });

  test('cap decompressed size while inflating', () => {
    const v = doc.vectors.find((v: { name: string }) => v.name === 'deflate-psbt');

    // compressed input fits the cap; decompressed output must not
    expect(() => joinQRs(v.frames, v.input_length - 1)).toThrow(/too large/);
    expect(joinQRs(v.frames).raw.length).toBe(v.input_length);
  });
});
