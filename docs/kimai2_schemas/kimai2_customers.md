# kimai2_customers Table Schema (Kimai)

Reference of the Kimai table `kimai2_customers`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| name | varchar(150) | NO |  | NULL |  |
| number | varchar(50) | YES |  | NULL |  |
| comment | text | YES |  | NULL |  |
| visible | tinyint(1) | NO | MUL | NULL |  |
| company | varchar(100) | YES |  | NULL |  |
| contact | varchar(100) | YES |  | NULL |  |
| address | text | YES |  | NULL |  |
| country | varchar(2) | NO |  | NULL |  |
| currency | varchar(3) | NO |  | NULL |  |
| phone | varchar(30) | YES |  | NULL |  |
| fax | varchar(30) | YES |  | NULL |  |
| mobile | varchar(30) | YES |  | NULL |  |
| email | varchar(75) | YES |  | NULL |  |
| homepage | varchar(100) | YES |  | NULL |  |
| timezone | varchar(64) | NO |  | NULL |  |
| color | varchar(7) | YES |  | NULL |  |
| time_budget | int | NO |  | 0 |  |
| budget | double | NO |  | 0 |  |
| vat_id | varchar(50) | YES |  | NULL |  |
| budget_type | varchar(10) | YES |  | NULL |  |
| billable | tinyint(1) | NO |  | 1 |  |
| invoice_template_id | int | YES | MUL | NULL |  |
| invoice_text | longtext | YES |  | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

