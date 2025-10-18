# kimai2_projects Table Schema (Kimai)

Reference of the Kimai table `kimai2_projects`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| customer_id | int | NO | MUL | NULL |  |
| name | varchar(150) | NO |  | NULL |  |
| order_number | tinytext | YES |  | NULL |  |
| comment | text | YES |  | NULL |  |
| visible | tinyint(1) | NO |  | NULL |  |
| budget | double | NO |  | 0 |  |
| color | varchar(7) | YES |  | NULL |  |
| time_budget | int | NO |  | 0 |  |
| order_date | datetime | YES |  | NULL |  |
| start | datetime | YES |  | NULL |  |
| end | datetime | YES |  | NULL |  |
| timezone | varchar(64) | YES |  | NULL |  |
| budget_type | varchar(10) | YES |  | NULL |  |
| billable | tinyint(1) | NO |  | 1 |  |
| invoice_text | longtext | YES |  | NULL |  |
| global_activities | tinyint(1) | NO |  | 1 |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

