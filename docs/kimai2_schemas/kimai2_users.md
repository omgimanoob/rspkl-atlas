# kimai2_users Table Schema (Kimai)

Reference of the Kimai table `kimai2_users`.

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| username | varchar(180) | NO | UNI | NULL |  |
| email | varchar(180) | NO | UNI | NULL |  |
| password | varchar(255) | NO |  | NULL |  |
| alias | varchar(60) | YES |  | NULL |  |
| enabled | tinyint(1) | NO |  | NULL |  |
| registration_date | datetime | YES |  | NULL |  |
| title | varchar(50) | YES |  | NULL |  |
| avatar | varchar(255) | YES |  | NULL |  |
| roles | longtext | NO |  | NULL |  |
| last_login | datetime | YES |  | NULL |  |
| confirmation_token | varchar(180) | YES | UNI | NULL |  |
| password_requested_at | datetime | YES |  | NULL |  |
| api_token | varchar(255) | YES |  | NULL |  |
| auth | varchar(20) | YES |  | NULL |  |
| color | varchar(7) | YES |  | NULL |  |
| account | varchar(30) | YES |  | NULL |  |
| totp_secret | varchar(255) | YES |  | NULL |  |
| totp_enabled | tinyint(1) | NO |  | 0 |  |
| system_account | tinyint(1) | NO |  | 0 |  |
| supervisor_id | int | YES | MUL | NULL |  |

Notes:
- Atlas treats Kimai tables as read-only and builds replicas/views in the Atlas DB.

