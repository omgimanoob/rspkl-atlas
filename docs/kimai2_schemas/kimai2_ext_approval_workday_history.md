# kimai2_ext_approval_workday_history Table Schema (Kimai)

Reference of the Kimai table `kimai2_ext_approval_workday_history`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO | MUL | NULL |  |
| monday | int | NO |  | NULL |  |
| tuesday | int | NO |  | NULL |  |
| wednesday | int | NO |  | NULL |  |
| thursday | int | NO |  | NULL |  |
| friday | int | NO |  | NULL |  |
| saturday | int | NO |  | NULL |  |
| sunday | int | NO |  | NULL |  |
| valid_till | date | NO |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

