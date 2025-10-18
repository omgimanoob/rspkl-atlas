import { UsersService } from '../services/usersService';
import { recordAudit, recordRbacAdmin } from '../services/audit';
import { incAdminMutation } from '../services/metrics';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createUserHandler(req, res) {
  try {
    const { email, password, display_name, is_active } = req.body || {};
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Bad Request', reason: 'invalid_email' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Bad Request', reason: 'invalid_password' });
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Bad Request', reason: 'invalid_is_active' });
    }
    try {
      const user = await UsersService.createUser({
        email,
        password,
        displayName: display_name ?? null,
        isActive: typeof is_active === 'boolean' ? is_active : true,
      });
      await recordRbacAdmin(req, 'users:create', 'user', user.id);
      incAdminMutation();
      await recordAudit(req, 201);
      return res.status(201).json(user);
    } catch (e: any) {
      const code = e?.cause?.code || e?.code;
      if (code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Conflict', reason: 'email_exists' });
      }
      throw e;
    }
  } catch (e) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function listUsersHandler(req, res) {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const active = req.query.active === undefined ? undefined : String(req.query.active).toLowerCase() === 'true';
    const result = await UsersService.listUsers({ page, pageSize, search, active });
    return res.json({ items: result.data, total: result.total, page: result.page, pageSize: result.pageSize });
  } catch (e) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function getUserByIdHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
    const user = await UsersService.getUserById(id);
    if (!user) return res.status(404).json({ error: 'Not Found' });
    return res.json(user);
  } catch (e) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updateUserHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
    const { display_name, is_active, password } = req.body || {};
    if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
      return res.status(400).json({ error: 'Bad Request', reason: 'invalid_password' });
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Bad Request', reason: 'invalid_is_active' });
    }
    const updated = await UsersService.updateUser(id, {
      displayName: display_name,
      isActive: typeof is_active === 'boolean' ? is_active : undefined,
      password: password ?? undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Not Found' });
    await recordRbacAdmin(req, 'users:update', 'user', id);
    incAdminMutation();
    await recordAudit(req, 200);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function activateUserHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
    const updated = await UsersService.setActive(id, true);
    if (!updated) return res.status(404).json({ error: 'Not Found' });
    await recordRbacAdmin(req, 'users:activate', 'user', id);
    incAdminMutation();
    await recordAudit(req, 200);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deactivateUserHandler(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
    const updated = await UsersService.setActive(id, false);
    if (!updated) return res.status(404).json({ error: 'Not Found' });
    await recordRbacAdmin(req, 'users:deactivate', 'user', id);
    incAdminMutation();
    await recordAudit(req, 200);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function deleteUserHandler(req, res) {
  // Soft-delete via deactivate; do not remove row
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Bad Request', reason: 'invalid_id' });
    const updated = await UsersService.setActive(id, false);
    if (!updated) return res.status(404).json({ error: 'Not Found' });
    await recordRbacAdmin(req, 'users:delete_soft', 'user', id);
    incAdminMutation();
    await recordAudit(req, 200);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
