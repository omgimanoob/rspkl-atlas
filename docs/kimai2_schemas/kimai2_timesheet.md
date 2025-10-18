# kimai2_timesheet Table Schema (Kimai)

Reference of the Kimai table `kimai2_timesheet`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| user | int | NO | MUL | NULL |  |
| activity_id | int | NO | MUL | NULL |  |
| project_id | int | NO | MUL | NULL |  |
| start_time | datetime | NO | MUL | NULL |  |
| end_time | datetime | YES | MUL | NULL |  |
| duration | int | YES |  | NULL |  |
| description | text | YES |  | NULL |  |
| rate | double | NO |  | NULL |  |
| fixed_rate | double | YES |  | NULL |  |
| hourly_rate | double | YES |  | NULL |  |
| exported | tinyint(1) | NO |  | 0 |  |
| timezone | varchar(64) | NO |  | NULL |  |
| internal_rate | double | YES |  | NULL |  |
| billable | tinyint(1) | YES |  | 1 |  |
| category | varchar(10) | NO |  | work |  |
| modified_at | datetime | YES |  | NULL |  |
| date_tz | date | NO | MUL | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

