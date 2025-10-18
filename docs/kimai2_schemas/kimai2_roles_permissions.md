# kimai2_roles_permissions Table Schema (Kimai)

Reference of the Kimai table `kimai2_roles_permissions`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| role_id | int | NO | MUL | NULL |  |
| permission | varchar(50) | NO |  | NULL |  |
| allowed | tinyint(1) | NO |  | 0 |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

