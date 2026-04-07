import pg from 'pg';
import { describe, expect, it } from 'vitest';

import './pool.js';

// ensure side-effect type-parser registration runs

describe('pg NUMERIC type parser', () => {
  it('parses NUMERIC OID values into JavaScript number, not string', () => {
    const numericOid = pg.types.builtins.NUMERIC;
    const parser = pg.types.getTypeParser(numericOid);
    expect(parser('150.00')).toBe(150);
    expect(typeof parser('150.00')).toBe('number');
  });

  it('parses NUMERIC null sentinel into 0 only when input is non-null', () => {
    const numericOid = pg.types.builtins.NUMERIC;
    const parser = pg.types.getTypeParser(numericOid);
    expect(parser('0')).toBe(0);
    expect(parser('1234.56')).toBe(1234.56);
  });
});
