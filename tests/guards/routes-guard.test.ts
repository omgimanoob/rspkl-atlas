import fs from 'fs';
import path from 'path';

// Ensures that every route defined in src/index.ts uses requirePermission middleware
// except for known public routes.

function extractRouteBlocks(source: string) {
  const blocks: { method: string; block: string }[] = [];
  const regex = /(app\.(get|post|put|delete)\s*\([\s\S]*?\);)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source))) {
    const full = m[1];
    const method = m[2];
    blocks.push({ method, block: full });
  }
  return blocks;
}

describe('Route guard: requirePermission on protected routes', () => {
  it('all routes are guarded or explicitly public', () => {
    const file = path.join(process.cwd(), 'src', 'index.ts');
    const src = fs.readFileSync(file, 'utf8');
    const blocks = extractRouteBlocks(src);
    const allowlist = new Set<string>([
      "'/api/auth/login'",
      '"/api/auth/login"',
      "'/api/auth/logout'",
      '"/api/auth/logout"',
      "'/api/me'",
      '"/api/me"',
      "'/api/me/password'",
      '"/api/me/password"',
      "'/api/auth/password-reset/request'",
      '"/api/auth/password-reset/request"',
      "'/api/auth/password-reset/confirm'",
      '"/api/auth/password-reset/confirm"',
      "'/api/healthz'",
      '"/api/healthz"',
      "'/api/metrics'",
      '"/api/metrics"',
    ]);

    const failures: string[] = [];
    for (const { block } of blocks) {
      // Extract the route path (first argument)
      const pathMatch = block.match(/\(\s*(["']\/[\w\-\/:]+["'])/);
      const routePath = pathMatch?.[1];
      const isPublic = routePath && allowlist.has(routePath);
      const hasPermission = block.includes('requirePermission(') || block.includes('permit(');
      if (!isPublic && !hasPermission) {
        failures.push(`Route ${routePath || '<unknown>'} missing requirePermission`);
      }
    }
    if (failures.length) {
      throw new Error('Route guard failures:\n' + failures.join('\n'));
    }
  });
});
