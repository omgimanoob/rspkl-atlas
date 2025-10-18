# kimai2_user_preferences Table Schema (Kimai)

Reference of the Kimai table `kimai2_user_preferences`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | YES | MUL | NULL |  |
| name | varchar(50) | NO |  | NULL |  |
| value | varchar(255) | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

