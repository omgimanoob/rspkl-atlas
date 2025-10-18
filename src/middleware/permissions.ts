import { PermissionsService, type ResourceContext } from '../services/permissionsService';
import { recordRbacDecision } from '../services/audit';
import { incRbacDecision } from '../services/metrics';
import { config } from '../config';
import { normalizeResourceId } from '../rbac/resources';

type Extractor = (req: any) => ResourceContext | undefined;

export function requirePermission(permission: string, opts?: { resourceExtractor?: Extractor }) {
  return async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (!user) {
        await recordRbacDecision(req, permission, opts?.resourceExtractor?.(req), 'deny', 'unauthenticated');
        return res.status(401).json({ error: 'Unauthorized', reason: 'unauthenticated' });
      }
      const resource = opts?.resourceExtractor ? opts.resourceExtractor(req) : undefined;
      const decision = await PermissionsService.hasPermission(user, permission, resource);
      if (decision.allow) {
        await recordRbacDecision(req, permission, resource, 'allow');
        incRbacDecision('allow');
        (req as any).rbacAllowed = true;
        return next();
      }
      // Do not respond yet; allow follow-up middlewares (e.g., role-based) to grant access (dual-gate).
      await recordRbacDecision(req, permission, resource, 'deny', decision.reason);
      incRbacDecision('deny');
      (req as any).rbacDeniedReason = decision.reason || 'no_grant';
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

export function extractProjectResourceFromBody(req: any): ResourceContext | undefined {
  const raw = req?.body?.id ?? req?.body?.kimai_project_id;
  const id = normalizeResourceId('project', raw);
  if (id !== null) return { resource_type: 'project', resource_id: id };
  return undefined;
}

export function enforcePermission(req, res, next) {
  if ((req as any).rbacAllowed) return next();
  const reason = (req as any).rbacDeniedReason || 'forbidden';
  return res.status(403).json({ error: 'Forbidden', reason });
}

export function enforceIfEnabled(kind: 'read' | 'write') {
  return (req, res, next) => {
    const enabled = kind === 'read' ? config.rbac.enforceReads : config.rbac.enforceWrites;
    if (!enabled) return next();
    if ((req as any).rbacAllowed) return next();
    const reason = (req as any).rbacDeniedReason || 'forbidden';
    return res.status(403).json({ error: 'Forbidden', reason });
  };
}

// Convenience helper to compose permission check + enforcement for routes
export function permit(
  permission: string,
  kind: 'read' | 'write',
  opts?: { resourceExtractor?: Extractor }
) {
  return [requirePermission(permission, opts), enforceIfEnabled(kind)];
}
