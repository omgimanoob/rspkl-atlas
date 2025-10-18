# kimai2_bookmarks Table Schema (Kimai)

Reference of the Kimai table `kimai2_bookmarks`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO | MUL | NULL |  |
| type | varchar(20) | NO |  | NULL |  |
| name | varchar(50) | NO |  | NULL |  |
| content | longtext | NO |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

