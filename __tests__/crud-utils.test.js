import {
  API_PAGINATION, parsePagination, parseSort, totalCountFromRes,
  makePick, enforceTierLimit,
} from '../pages/api/helpers/crud-utils';

// ─── helpers ──────────────────────────────────────────────────────────────────
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');
const makeToken = (payload) => `header.${b64(payload)}.sig`;

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const cfg = { url: 'http://supabase.test', anonKey: 'anon', serviceKey: 'service' };

// ─── parsePagination ───────────────────────────────────────────────────────────
describe('parsePagination', () => {
  it('uses defaults when params are missing', () => {
    expect(parsePagination({})).toEqual({
      limit: API_PAGINATION.DEFAULT_LIMIT, page: 1, offset: 0,
    });
  });

  it('computes offset from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '20' })).toEqual({ limit: 20, page: 3, offset: 40 });
  });

  it('clamps non-positive values and caps the limit', () => {
    expect(parsePagination({ page: '0', limit: '-5' }).page).toBe(1);
    expect(parsePagination({ limit: '0' }).limit).toBe(API_PAGINATION.DEFAULT_LIMIT);
    expect(parsePagination({ limit: '999999' }).limit).toBe(API_PAGINATION.MAX_LIMIT);
  });
});

// ─── parseSort ──────────────────────────────────────────────────────────────────
describe('parseSort', () => {
  const valid = ['created_at', 'name'];

  it('falls back to the default sort for unknown columns', () => {
    expect(parseSort({ sort_by: 'evil; drop table' }, valid)).toMatchObject({
      sortBy: 'created_at', sortOrder: 'desc', clause: 'created_at.desc',
    });
  });

  it('honours an allowed column and asc order', () => {
    expect(parseSort({ sort_by: 'name', sort_order: 'asc' }, valid).clause).toBe('name.asc');
  });
});

// ─── totalCountFromRes ───────────────────────────────────────────────────────────
describe('totalCountFromRes', () => {
  it('parses the total from a content-range header', () => {
    const res = { headers: { get: () => 'items 0-9/42' } };
    expect(totalCountFromRes(res, [])).toBe(42);
  });

  it('falls back to the item count when the header is absent', () => {
    const res = { headers: { get: () => null } };
    expect(totalCountFromRes(res, [1, 2, 3])).toBe(3);
  });
});

// ─── makePick ────────────────────────────────────────────────────────────────────
describe('makePick', () => {
  it('keeps only allowed fields', () => {
    const pick = makePick(['name', 'color']);
    expect(pick({ name: 'A', color: 'red', hacker: 1 })).toEqual({ name: 'A', color: 'red' });
  });

  it('runs the transform for validation/coercion', () => {
    const pick = makePick(['status', 'progress'], (r) => {
      if (r.status && !['ok'].includes(r.status)) delete r.status;
      if (r.progress !== undefined) r.progress = Math.max(0, Math.min(100, parseInt(r.progress, 10) || 0));
      return r;
    });
    expect(pick({ status: 'bad', progress: '150' })).toEqual({ progress: 100 });
  });
});

// ─── enforceTierLimit ─────────────────────────────────────────────────────────────
describe('enforceTierLimit', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('skips the count query and allows writes on unlimited tiers', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const res = mockRes();
    const blocked = await enforceTierLimit({
      cfg, token: makeToken({ user_metadata: { tier: 'promax' } }), res,
      table: 'courses', limitKey: 'courses', label: 'Course',
    });
    expect(blocked).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a 403 with an upgrade hint when the limit is reached', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => Array.from({ length: 100 }, (_, i) => ({ id: String(i) })),
    });
    const res = mockRes();
    const blocked = await enforceTierLimit({
      cfg, token: makeToken({ sub: 'u1' }), res,
      table: 'courses', limitKey: 'courses', label: 'Course',
    });
    expect(blocked).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Course limit reached \(100\/100\)/);
    expect(res.body.error).toMatch(/Upgrade to/);
  });

  it('allows the write when under the limit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1' }, { id: '2' }],
    });
    const res = mockRes();
    const blocked = await enforceTierLimit({
      cfg, token: makeToken({ sub: 'u1' }), res,
      table: 'courses', limitKey: 'courses', label: 'Course',
    });
    expect(blocked).toBe(false);
    expect(res.statusCode).toBeNull();
  });
});
