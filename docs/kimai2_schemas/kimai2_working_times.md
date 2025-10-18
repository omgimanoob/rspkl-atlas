# kimai2_working_times Table Schema (Kimai)

Reference of the Kimai table `kimai2_working_times`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO | MUL | NULL |  |
| approved_by | int | YES | MUL | NULL |  |
| date | date | NO |  | NULL |  |
| expected | int | NO |  | NULL |  |
| actual | int | NO |  | NULL |  |
| approved_at | datetime | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

