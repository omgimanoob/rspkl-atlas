# kimai2_users_teams Table Schema (Kimai)

Reference of the Kimai table `kimai2_users_teams`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| user_id | int | NO | MUL | NULL |  |
| team_id | int | NO | MUL | NULL |  |
| id | int | NO | PRI | NULL | auto_increment |
| teamlead | tinyint(1) | NO |  | 0 |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

