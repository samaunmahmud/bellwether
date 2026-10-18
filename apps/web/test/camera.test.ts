import { cameraError, tallyVerdict } from '../src/camera';

describe('camera helpers (v4.2)', () => {
  it.each([
    [80, 80, 'All 80 counted'],
    [78, 80, '2 fewer than recorded'],
    [81, 80, '1 more than recorded'],
  ])('counted %d of %d → %s', (counted, recorded, text) => {
    expect(tallyVerdict(counted, recorded)).toBe(text);
  });

  it.each([
    ['NotAllowedError', /allow the camera/i],
    ['NotFoundError', /no camera/i],
    ['NotReadableError', /another app/i],
    ['Other', /could not start/i],
  ])('explains %s', (name, message) => {
    expect(cameraError(Object.assign(new Error('x'), { name }))).toMatch(message);
  });
});
