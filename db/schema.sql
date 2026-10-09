CREATE DATABASE IF NOT EXISTS sla_monitor CHARACTER SET utf8mb4;
USE sla_monitor;
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  ai_email VARCHAR(255) NOT NULL,
  ai_app_password_enc TEXT NOT NULL,
  monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 200.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS saas_integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  provider ENUM('cloudflare','aws','twilio','zendesk','salesforce') NOT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'disabled',
  zone_info JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uptime TINYINT(1) NOT NULL,
  latency_ms INT NOT NULL,
  status ENUM('ok','outage','degraded') NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_metrics_company_ts (company_id, ts)
);
CREATE TABLE IF NOT EXISTS incidents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  type ENUM('outage','latency') NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_min INT NOT NULL DEFAULT 0,
  affected_ratio FLOAT NOT NULL DEFAULT 1.0,
  credit_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  claim_deadline DATE NULL,
  status ENUM('open','claimed','recovered') NOT NULL DEFAULT 'open',
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id INT NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  kind ENUM('company','vendor') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('sent','failed') NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);
