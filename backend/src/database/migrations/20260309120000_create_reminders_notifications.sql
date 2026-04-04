-- Reminders / Notifications Module (new tables only)

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  module_name VARCHAR(50),
  record_id VARCHAR(100),
  assigned_to_user UUID,
  reminder_date DATE,
  reminder_time TIME,
  priority VARCHAR(20),
  status VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  reminder_id UUID,
  recipient_type VARCHAR(20),
  recipient_id UUID,
  channel VARCHAR(20),
  title VARCHAR(255),
  message TEXT,
  status VARCHAR(20),
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  channel VARCHAR(20),
  module_name VARCHAR(50),
  template_text TEXT,
  variables JSONB,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY,
  notification_id UUID,
  channel VARCHAR(20),
  delivery_status VARCHAR(20),
  retry_count INT,
  provider_response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminder_module ON reminders(module_name);
CREATE INDEX IF NOT EXISTS idx_reminder_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_notification_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_status ON notifications(status);

