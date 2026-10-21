ALTER TABLE notifications ADD COLUMN push_enqueued_at DATETIME(3) NULL,ADD INDEX ix_notifications_push (push_enqueued_at,seq);
CREATE TABLE devices (
 id CHAR(36) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,session_hash CHAR(64) NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,token_ciphertext TEXT NOT NULL,platform ENUM('android','web') NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(session_hash) REFERENCES sessions(token_hash) ON DELETE CASCADE,INDEX ix_devices_user(user_id)
) ENGINE=InnoDB;
CREATE TABLE push_deliveries (
 notification_seq BIGINT UNSIGNED NOT NULL,device_id CHAR(36) NOT NULL,status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',attempts INT UNSIGNED NOT NULL DEFAULT 0,
 available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),lease_until DATETIME(3) NULL,lease_token CHAR(36) NULL,provider_id VARCHAR(255) NULL,last_error VARCHAR(100) NULL,
 PRIMARY KEY(notification_seq,device_id),FOREIGN KEY(notification_seq) REFERENCES notifications(seq) ON DELETE CASCADE,FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE,
 INDEX ix_push_ready(status,available_at),INDEX ix_push_lease(status,lease_until)
) ENGINE=InnoDB;
