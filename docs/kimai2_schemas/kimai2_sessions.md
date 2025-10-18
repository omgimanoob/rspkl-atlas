# kimai2_sessions Table Schema (Kimai)

Reference of the Kimai table `kimai2_sessions`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(128) | NO | PRI | NULL |  |
| data | blob | NO |  | NULL |  |
| time | int unsigned | NO |  | NULL |  |
| lifetime | int unsigned | NO |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

