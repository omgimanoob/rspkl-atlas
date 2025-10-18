# kimai2_tags Table Schema (Kimai)

Reference of the Kimai table `kimai2_tags`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| name | varchar(100) | NO | UNI | NULL |  |
| color | varchar(7) | YES |  | NULL |  |
| visible | tinyint(1) | YES |  | 1 |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

