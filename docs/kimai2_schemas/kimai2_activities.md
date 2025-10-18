# kimai2_activities Table Schema (Kimai)

Reference of the Kimai table `kimai2_activities`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| project_id | int | YES | MUL | NULL |  |
| name | varchar(150) | NO |  | NULL |  |
| comment | text | YES |  | NULL |  |
| visible | tinyint(1) | NO | MUL | NULL |  |
| color | varchar(7) | YES |  | NULL |  |
| time_budget | int | NO |  | 0 |  |
| budget | double | NO |  | 0 |  |
| budget_type | varchar(10) | YES |  | NULL |  |
| billable | tinyint(1) | NO |  | 1 |  |
| invoice_text | longtext | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

