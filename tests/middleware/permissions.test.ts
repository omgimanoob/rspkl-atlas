import { requirePermission } from '../../src/middleware/permissions';

jest.mock('../../src/services/permissionsService', () => ({
  PermissionsService: {
    hasPermission: jest.fn().mockResolvedValue({ allow: true }),
  },
}));

describe('requirePermission middleware', () => {
  it('sets req.rbacAllowed and calls next when allowed', async () => {
    const mw = requirePermission('project:read');
    const req: any = { user: { id: 1, email: 'u@example.com', roles: ['hr'] } };
    const res: any = {};
    const next = jest.fn();
    await mw(req, res, next);
    expect(req.rbacAllowed).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('responds 401 when unauthenticated', async () => {
    const mw = requirePermission('project:read');
    const req: any = {};
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res: any = { status };
    const next = jest.fn();
    await mw(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized', reason: 'unauthenticated' });
  });

  it('denies without sending response and sets rbacDeniedReason when not permitted', async () => {
    const { PermissionsService } = require('../../src/services/permissionsService');
    (PermissionsService.hasPermission as jest.Mock).mockResolvedValueOnce({ allow: false, reason: 'no_grant' });
    const mw = requirePermission('project:read');
    const req: any = { user: { id: 1, email: 'u@example.com', roles: [] } };
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res: any = { status };
    const next = jest.fn();
    await mw(req, res, next);
    expect(req.rbacDeniedReason).toBe('no_grant');
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
