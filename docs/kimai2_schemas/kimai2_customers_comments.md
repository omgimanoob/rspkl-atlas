# kimai2_customers_comments Table Schema (Kimai)

Reference of the Kimai table `kimai2_customers_comments`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| customer_id | int | NO | MUL | NULL |  |
| created_by_id | int | NO | MUL | NULL |  |
| message | longtext | NO |  | NULL |  |
| created_at | datetime | NO |  | NULL |  |
| pinned | tinyint(1) | NO |  | 0 |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

