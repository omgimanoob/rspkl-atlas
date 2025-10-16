import { PermissionsService, type ResourceContext } from '../services/permissionsService';

type Extractor = (req: any) => ResourceContext | undefined;

export function requirePermission(permission: string, opts?: { resourceExtractor?: Extractor }) {
  return async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Unauthorized', reason: 'unauthenticated' });
      const resource = opts?.resourceExtractor ? opts.resourceExtractor(req) : undefined;
      const decision = await PermissionsService.hasPermission(user, permission, resource);
      if (decision.allow) {
        (req as any).rbacAllowed = true;
        return next();
      }
      // Do not respond yet; allow follow-up middlewares (e.g., role-based) to grant access (dual-gate).
      (req as any).rbacDeniedReason = decision.reason || 'no_grant';
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

export function extractProjectResourceFromBody(req: any): ResourceContext | undefined {
  const id = req?.body?.id ?? req?.body?.kimai_project_id;
  if (typeof id === 'number') return { resource_type: 'project', resource_id: id };
  return undefined;
}

