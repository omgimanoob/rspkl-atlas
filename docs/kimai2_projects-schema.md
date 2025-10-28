# Kimai `kimai2_projects` Table Schema (Reference)

This is a reference of the Kimai database table `kimai2_projects` as observed. Use for integration mapping only; do not modify Kimai data from Atlas.

| Field             | Type           | Null | Key | Default | Extra          |
|-------------------|----------------|------|-----|---------|----------------|
| id                | int            | NO   | PRI | NULL    | auto_increment |
| customer_id       | int            | NO   | MUL | NULL    |                |
| name              | varchar(150)   | NO   |     | NULL    |                |
| order_number      | tinytext       | YES  |     | NULL    |                |
| comment           | text           | YES  |     | NULL    |                |
| visible           | tinyint(1)     | NO   |     | NULL    |                |
| budget            | double         | NO   |     | 0       |                |
| color             | varchar(7)     | YES  |     | NULL    |                |
| time_budget       | int            | NO   |     | 0       |                |
| order_date        | datetime       | YES  |     | NULL    |                |
| start             | datetime       | YES  |     | NULL    |                |
| end               | datetime       | YES  |     | NULL    |                |
| timezone          | varchar(64)    | YES  |     | NULL    |                |
| budget_type       | varchar(10)    | YES  |     | NULL    |                |
| billable          | tinyint(1)     | NO   |     | 1       |                |
| invoice_text      | longtext       | YES  |     | NULL    |                |
| global_activities | tinyint(1)     | NO   |     | 1       |                |

Notes:
- Keys reflect Kimai's indexing (e.g., `PRI` = primary key, `MUL` = indexed).
- Defaults and nullability are shown as in the provided structure.
- Atlas should treat this as read-only and overlay additional data via `project_overrides` as needed.
