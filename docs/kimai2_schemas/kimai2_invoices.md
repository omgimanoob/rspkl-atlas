# kimai2_invoices Table Schema (Kimai)

Reference of the Kimai table `kimai2_invoices`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| customer_id | int | NO | MUL | NULL |  |
| user_id | int | NO | MUL | NULL |  |
| invoice_number | varchar(50) | NO | UNI | NULL |  |
| created_at | datetime | NO |  | NULL |  |
| timezone | varchar(64) | NO |  | NULL |  |
| total | double | NO |  | NULL |  |
| tax | double | NO |  | NULL |  |
| currency | varchar(3) | NO |  | NULL |  |
| status | varchar(20) | NO |  | NULL |  |
| due_days | int | NO |  | NULL |  |
| vat | double | NO |  | NULL |  |
| invoice_filename | varchar(150) | NO | UNI | NULL |  |
| payment_date | date | YES |  | NULL |  |
| comment | longtext | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

