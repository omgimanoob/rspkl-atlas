# kimai2_ext_approval_history Table Schema (Kimai)

Reference of the Kimai table `kimai2_ext_approval_history`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| approval_id | int | NO | MUL | NULL |  |
| user_id | int | NO | MUL | NULL |  |
| status_id | int | NO | MUL | NULL |  |
| date | datetime | NO |  | NULL |  |
| message | text | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

