import { requireRoleUnlessPermitted } from '../../src/middleware/auth';

describe('requireRoleUnlessPermitted', () => {
  it('skips role check when rbacAllowed is true', () => {
    const mw = requireRoleUnlessPermitted('hr');
    const req: any = { rbacAllowed: true, user: { roles: [] } };
    const res: any = {};
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user lacks roles and rbacAllowed not set', () => {
    const mw = requireRoleUnlessPermitted('hr');
    const req: any = { user: { roles: ['basic'] } };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res: any = { status };
    const next = jest.fn();
    mw(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });
});

