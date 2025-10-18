# kimai2_ext_approval Table Schema (Kimai)

Reference of the Kimai table `kimai2_ext_approval`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | NO | MUL | NULL |  |
| start_date | date | NO |  | NULL |  |
| end_date | date | NO |  | NULL |  |
| expected_duration | int | NO |  | NULL |  |
| creation_date | datetime | NO |  | NULL |  |
| actual_duration | int | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

