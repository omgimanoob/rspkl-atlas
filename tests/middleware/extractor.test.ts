import { extractProjectResourceFromBody } from '../../src/middleware/permissions';

describe('extractProjectResourceFromBody', () => {
  it('extracts id when present', () => {
    const out = extractProjectResourceFromBody({ body: { id: 123, status: 'active' } });
    expect(out).toEqual({ resource_type: 'project', resource_id: 123 });
  });

  it('extracts kimai_project_id when id missing', () => {
    const out = extractProjectResourceFromBody({ body: { kimai_project_id: 456, status: 'paused' } });
    expect(out).toEqual({ resource_type: 'project', resource_id: 456 });
  });

  it('returns undefined when neither present', () => {
    const out = extractProjectResourceFromBody({ body: { status: 'active' } });
    expect(out).toBeUndefined();
  });

  it('normalizes string id', () => {
    const out = extractProjectResourceFromBody({ body: { id: '123' } });
    expect(out).toEqual({ resource_type: 'project', resource_id: 123 });
  });
});
