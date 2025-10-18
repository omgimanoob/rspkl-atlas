# kimai2_activities_meta Table Schema (Kimai)

Reference of the Kimai table `kimai2_activities_meta`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| activity_id | int | NO | MUL | NULL |  |
| name | varchar(50) | NO |  | NULL |  |
| value | text | YES |  | NULL |  |
| visible | tinyint(1) | NO |  | 0 |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

