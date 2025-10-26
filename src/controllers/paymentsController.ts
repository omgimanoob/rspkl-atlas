import { Request, Response } from 'express'
import { atlasPool } from '../../db'

export async function listPaymentsHandler(req: Request, res: Response) {
  try {
    const q = String((req.query as any)?.q || '').trim().toLowerCase()
    const kimaiFilter = (req.query as any)?.kimai
    const kimaiId = kimaiFilter == null ? null : Number(kimaiFilter)
    const page = Math.max(1, Number((req.query as any)?.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize) || 20))
    const sortRaw = String((req.query as any)?.sort || '').trim() // e.g., payment_date:desc
    let orderBy = 'payment_date DESC, id DESC'
    if (sortRaw) {
      const [k, d] = sortRaw.split(':')
      const dir = (d || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      if (k === 'amount') orderBy = `amount ${dir}, id DESC`
      else if (k === 'payment_date') orderBy = `payment_date ${dir}, id DESC`
      else if (k === 'created_at') orderBy = `created_at ${dir}, id DESC`
      else if (k === 'project_name') orderBy = `project_name ${dir}, id DESC`
    }
    // Total
    const [totRows]: any = await atlasPool.query(
      `SELECT COUNT(*) AS cnt
         FROM project_payments pp
         LEFT JOIN replica_kimai_projects p ON p.id = pp.kimai_project_id
         LEFT JOIN project_overrides o ON o.kimai_project_id = pp.kimai_project_id
        WHERE (? = ''
               OR LOWER(IFNULL(p.comment, '')) LIKE CONCAT('%', ?, '%')
               OR LOWER(IFNULL(o.notes, '')) LIKE CONCAT('%', ?, '%')
               OR LOWER(IFNULL(p.name, '')) LIKE CONCAT('%', ?, '%')
        )
          AND (? IS NULL OR pp.kimai_project_id = ?)`,
      [q, q, q, q, kimaiId, kimaiId]
    )
    const total = Number(totRows?.[0]?.cnt || 0)
    const offset = (page - 1) * pageSize
    // Page rows
    const [rows]: any = await atlasPool.query(
      `SELECT
          pp.id,
          pp.kimai_project_id,
          pp.amount,
          pp.notes,
          pp.payment_date,
          pp.created_at,
          pp.created_by,
          p.name AS project_name,
          p.comment AS project_comment,
          o.notes AS override_notes,
          COALESCE(u.display_name, u.email) AS created_by_display
         FROM project_payments pp
         LEFT JOIN replica_kimai_projects p ON p.id = pp.kimai_project_id
         LEFT JOIN project_overrides o ON o.kimai_project_id = pp.kimai_project_id
         LEFT JOIN users u ON u.id = pp.created_by
        WHERE (? = ''
               OR LOWER(IFNULL(p.comment, '')) LIKE CONCAT('%', ?, '%')
               OR LOWER(IFNULL(o.notes, '')) LIKE CONCAT('%', ?, '%')
               OR LOWER(IFNULL(p.name, '')) LIKE CONCAT('%', ?, '%')
        )
          AND (? IS NULL OR pp.kimai_project_id = ?)
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
      [q, q, q, q, kimaiId, kimaiId, pageSize, offset]
    )
    res.json({ items: rows || [], total, page, pageSize })
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to list payments' })
  }
}

export async function recalcPaymentTotalsHandler(req: Request, res: Response) {
  try {
    const kimaiId = Number(req.params?.kimaiId)
    if (!Number.isFinite(kimaiId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_kimai_project_id' }); return }
    const conn = await (atlasPool as any).getConnection()
    try {
      await conn.beginTransaction()
      const [sumRows]: any = await conn.query('SELECT COALESCE(SUM(amount), 0) AS total FROM project_payments WHERE kimai_project_id = ?', [kimaiId])
      const total = Number(sumRows?.[0]?.total || 0)
      await conn.query('UPDATE project_overrides SET money_collected = ? WHERE kimai_project_id = ?', [total, kimaiId])
      await conn.commit()
      res.json({ ok: true, kimai_project_id: kimaiId, money_collected: total })
    } catch (err) {
      try { await conn.rollback() } catch {}
      throw err
    } finally { try { conn.release() } catch {} }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to recalculate' })
  }
}

export async function createPaymentHandler(req: Request, res: Response) {
  try {
    const { kimai_project_id, amount, payment_date, notes } = req.body || {}
    const kimaiId = Number(kimai_project_id)
    const amt = Number(amount)
    const dateStr = String(payment_date || '')
    if (!Number.isFinite(kimaiId)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_kimai_project_id' }); return }
    if (!Number.isFinite(amt)) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_amount' }); return }
    if (!dateStr || isNaN(Date.parse(dateStr))) { res.status(400).json({ error: 'Bad Request', reason: 'invalid_payment_date' }); return }
    // Pre-insert: must have an override row
    const [exists]: any = await atlasPool.query('SELECT 1 FROM project_overrides WHERE kimai_project_id = ? LIMIT 1', [kimaiId])
    if (!exists || !exists.length) { res.status(400).json({ error: 'Bad Request', reason: 'override_missing' }); return }
    const createdBy = (req as any)?.user?.id || null
    const conn = await (atlasPool as any).getConnection()
    try {
      await conn.beginTransaction()
      const [ins]: any = await conn.query(
        `INSERT INTO project_payments (kimai_project_id, amount, notes, payment_date, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [kimaiId, amt, notes ?? null, dateStr, createdBy]
      )
      // Recalculate aggregate and update overrides
      const [sumRows]: any = await conn.query('SELECT COALESCE(SUM(amount), 0) AS total FROM project_payments WHERE kimai_project_id = ?', [kimaiId])
      const total = Number(sumRows?.[0]?.total || 0)
      await conn.query('UPDATE project_overrides SET money_collected = ? WHERE kimai_project_id = ?', [total, kimaiId])
      await conn.commit()
      res.status(201).json({ id: Number(ins.insertId), kimai_project_id: kimaiId, amount: amt, payment_date: dateStr, notes: notes ?? null, created_by: createdBy, money_collected: total })
    } catch (err) {
      try { await conn.rollback() } catch {}
      throw err
    } finally {
      try { conn.release() } catch {}
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create payment' })
  }
}
