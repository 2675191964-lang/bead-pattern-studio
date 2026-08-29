import { describe, expect, it } from 'vitest';
import { ciede2000, rgbToLab } from '../src/core/color/color';

describe('颜色科学', () => {
  it('匹配 CIEDE2000 权威参考样例', () => {
    expect(ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
    expect(ciede2000([50, 3.1571, -77.2803], [50, 0, -82.7485])).toBeCloseTo(2.8615, 4);
    expect(ciede2000([50, 2.8361, -74.02], [50, 0, -82.7485])).toBeCloseTo(3.4412, 4);
  });

  it('按 sRGB D65 生成已知 Lab 参考值', () => {
    expect(rgbToLab([255, 255, 255])).toEqual(expect.arrayContaining([expect.closeTo(100, 3), expect.closeTo(0, 2), expect.closeTo(0, 2)]));
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 4);
    const red = rgbToLab([255, 0, 0]);
    expect(red[0]).toBeCloseTo(53.24, 1);
    expect(red[1]).toBeCloseTo(80.09, 1);
    expect(red[2]).toBeCloseTo(67.2, 1);
  });
});
