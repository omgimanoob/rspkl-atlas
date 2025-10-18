# kimai2_activities_rates Table Schema (Kimai)

Reference of the Kimai table `kimai2_activities_rates`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| user_id | int | YES | MUL | NULL |  |
| activity_id | int | YES | MUL | NULL |  |
| rate | double | NO |  | NULL |  |
| fixed | tinyint(1) | NO |  | NULL |  |
| internal_rate | double | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

