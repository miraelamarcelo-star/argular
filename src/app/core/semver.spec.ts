import { describe, it, expect } from 'vitest';
import { parseSemVer, compareSemVer, satisfiesSemVer } from './semver';

describe('SemVer Engine', () => {
  it('should parse standard semantic versions correctly', () => {
    const v = parseSemVer('1.2.3');
    expect(v.major).toBe(1);
    expect(v.minor).toBe(2);
    expect(v.patch).toBe(3);
    expect(v.prerelease).toBeUndefined();
  });

  it('should parse prerelease semantic versions correctly', () => {
    const v = parseSemVer('2.0.0-beta.1');
    expect(v.major).toBe(2);
    expect(v.minor).toBe(0);
    expect(v.patch).toBe(0);
    expect(v.prerelease).toBe('beta.1');
  });

  it('should compare versions in accordance with SemVer 2.0.0 specification', () => {
    expect(compareSemVer('1.0.0', '0.9.9')).toBe(1);
    expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemVer('1.0.0', '1.0.1')).toBe(-1);
    expect(compareSemVer('2.1.0', '2.0.9')).toBe(1);
    expect(compareSemVer('1.0.0', '1.0.0-rc.1')).toBe(1);
  });

  it('should correctly evaluate caret (^) ranges', () => {
    expect(satisfiesSemVer('1.2.3', '^1.2.0')).toBe(true);
    expect(satisfiesSemVer('1.9.9', '^1.2.0')).toBe(true);
    expect(satisfiesSemVer('2.0.0', '^1.2.0')).toBe(false);
    expect(satisfiesSemVer('1.1.0', '^1.2.0')).toBe(false);
  });

  it('should correctly evaluate tilde (~) ranges', () => {
    expect(satisfiesSemVer('1.2.5', '~1.2.0')).toBe(true);
    expect(satisfiesSemVer('1.3.0', '~1.2.0')).toBe(false);
    expect(satisfiesSemVer('1.1.9', '~1.2.0')).toBe(false);
  });

  it('should correctly evaluate comparison operators (>=, <=, >, <)', () => {
    expect(satisfiesSemVer('2.5.0', '>=2.0.0')).toBe(true);
    expect(satisfiesSemVer('1.9.0', '>=2.0.0')).toBe(false);
    expect(satisfiesSemVer('2.0.0', '<3.0.0')).toBe(true);
    expect(satisfiesSemVer('3.0.0', '<3.0.0')).toBe(false);
  });

  it('should handle wildcards and compound ranges', () => {
    expect(satisfiesSemVer('1.5.2', '*')).toBe(true);
    expect(satisfiesSemVer('1.5.2', 'any')).toBe(true);
    expect(satisfiesSemVer('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
    expect(satisfiesSemVer('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
  });

  it('should strictly evaluate exact versions without range operators', () => {
    expect(satisfiesSemVer('1.0.0', '1.0.0')).toBe(true);
    expect(satisfiesSemVer('1.0.1', '1.0.0')).toBe(false);
    expect(satisfiesSemVer('2.0.0', '1.0.0')).toBe(false);
    expect(satisfiesSemVer('1.0.0', '=1.0.0')).toBe(true);
    expect(satisfiesSemVer('1.0.1', '=1.0.0')).toBe(false);
  });
});
