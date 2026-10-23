export interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export function parseSemVer(v: string): ParsedSemVer {
  if (!v || typeof v !== 'string') {
    return { major: 0, minor: 0, patch: 0 };
  }
  const clean = v.trim().replace(/^[~^><=v\s]+/, '');
  const [core, prerelease] = clean.split('-');
  const parts = (core || '').split('.').map(n => parseInt(n, 10) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    prerelease: prerelease ? prerelease.trim() : undefined
  };
}

/**
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 == v2
 */
export function compareSemVer(v1: string, v2: string): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  if (p1.major > p2.major) return 1;
  if (p1.major < p2.major) return -1;

  if (p1.minor > p2.minor) return 1;
  if (p1.minor < p2.minor) return -1;

  if (p1.patch > p2.patch) return 1;
  if (p1.patch < p2.patch) return -1;

  // Prerelease comparison: non-prerelease > prerelease
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && !p2.prerelease) return -1;
  if (p1.prerelease && p2.prerelease) {
    const cmp = p1.prerelease.localeCompare(p2.prerelease);
    if (cmp > 0) return 1;
    if (cmp < 0) return -1;
  }

  return 0;
}

/**
 * Evaluates whether a version satisfies a SemVer range or requirement.
 * Supports: '*', 'any', '^1.2.3', '~1.2.3', '>=1.0.0', '<=2.0.0', '>1.0.0', '<2.0.0', '=1.0.0', '1.0.0'
 */
export function satisfiesSemVer(version: string, range: string): boolean {
  if (!range || range === '*' || range.toLowerCase() === 'any') {
    return true;
  }

  const trimmed = range.trim();

  // Space-separated compound ranges (e.g. ">=1.0.0 <2.0.0")
  if (trimmed.includes(' ')) {
    const subRanges = trimmed.split(/\s+/);
    return subRanges.every(sub => satisfiesSemVer(version, sub));
  }

  // Caret ranges (^1.2.3)
  if (trimmed.startsWith('^')) {
    const req = trimmed.slice(1);
    const pReq = parseSemVer(req);
    const pVer = parseSemVer(version);

    if (compareSemVer(version, req) < 0) return false;

    if (pReq.major > 0) {
      return pVer.major === pReq.major;
    } else if (pReq.minor > 0) {
      return pVer.major === 0 && pVer.minor === pReq.minor;
    } else {
      return pVer.major === 0 && pVer.minor === 0 && pVer.patch === pReq.patch;
    }
  }

  // Tilde ranges (~1.2.3)
  if (trimmed.startsWith('~')) {
    const req = trimmed.slice(1);
    const pReq = parseSemVer(req);
    const pVer = parseSemVer(version);

    if (compareSemVer(version, req) < 0) return false;
    return pVer.major === pReq.major && pVer.minor === pReq.minor;
  }

  // Greater than or equal (>=)
  if (trimmed.startsWith('>=')) {
    return compareSemVer(version, trimmed.slice(2)) >= 0;
  }

  // Less than or equal (<=)
  if (trimmed.startsWith('<=')) {
    return compareSemVer(version, trimmed.slice(2)) <= 0;
  }

  // Greater than (>)
  if (trimmed.startsWith('>')) {
    return compareSemVer(version, trimmed.slice(1)) > 0;
  }

  // Less than (<)
  if (trimmed.startsWith('<')) {
    return compareSemVer(version, trimmed.slice(1)) < 0;
  }

  // Exact match (= or plain version)
  const target = trimmed.startsWith('=') ? trimmed.slice(1) : trimmed;
  return compareSemVer(version, target) === 0;
}
