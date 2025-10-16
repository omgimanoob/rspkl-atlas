import { PermissionsService } from '../../src/services/permissionsService';

describe('PermissionsService wildcard', () => {
  it("allows any permission when global '*' is present", async () => {
    const spy = jest
      .spyOn(PermissionsService as any, 'getUserPermissions')
      .mockResolvedValue({ global: new Set<string>(['*']), scoped: [] });

    const decisionA = await PermissionsService.hasPermission({ id: 1, email: 'a@b.com', roles: [] }, 'project:read');
    const decisionB = await PermissionsService.hasPermission({ id: 1, email: 'a@b.com', roles: [] }, 'nonexistent:perm');

    expect(decisionA.allow).toBe(true);
    expect(decisionB.allow).toBe(true);
    spy.mockRestore();
  });
});

