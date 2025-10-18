# kimai2_configuration Table Schema (Kimai)

Reference of the Kimai table `kimai2_configuration`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| name | varchar(100) | NO | UNI | NULL |  |
| value | text | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

