const { authMiddleware } = require('../../src/middleware/auth');
const { AuthService } = require('../../src/services/authService');
const { config } = require('../../src/config');

describe('authMiddleware', () => {
  it('attaches req.user when a valid JWT cookie is present', () => {
    const spy = jest.spyOn(AuthService, 'verifyJwt').mockReturnValue({ id: 1, email: 't@example.com', roles: ['hr'] });
    const req: any = { headers: { cookie: `${config.auth.cookieName}=abc.def.ghi` } };
    const res: any = {};
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(req.user).toEqual({ id: 1, email: 't@example.com', roles: ['hr'] });
    expect(next).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('leaves req.user undefined when no cookie', () => {
    const req: any = { headers: {} };
    const res: any = {};
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
