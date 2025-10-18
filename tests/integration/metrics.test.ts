import request from 'supertest';
import { app } from '../../src/index';

describe('Metrics endpoint', () => {
  it('returns JSON with rbac counters', async () => {
    const res = await request(app).get('/metrics').expect(200);
    expect(res.body).toHaveProperty('rbac');
    expect(res.body.rbac).toHaveProperty('decisions');
    expect(typeof res.body.rbac.decisions.allow).toBe('number');
    expect(typeof res.body.rbac.decisions.deny).toBe('number');
    expect(typeof res.body.rbac.adminMutations).toBe('number');
  });
});

