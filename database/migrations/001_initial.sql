CREATE TABLE users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL, email VARCHAR(254) NULL UNIQUE, phone VARCHAR(20) NULL UNIQUE,
 contact_phone VARCHAR(20) NULL, password_hash VARCHAR(255) NULL, role ENUM('customer','partner','admin') NOT NULL DEFAULT 'customer',
 status ENUM('active','disabled') NOT NULL DEFAULT 'active', city VARCHAR(100) NOT NULL DEFAULT '',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 INDEX ix_users_role_id (role,id), INDEX ix_users_status_id (status,id)
) ENGINE=InnoDB;
CREATE TABLE sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, csrf_token CHAR(64) NOT NULL,
 expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX ix_sessions_user (user_id), INDEX ix_sessions_expiry (expires_at)
) ENGINE=InnoDB;
CREATE TABLE otp_challenges (
 id CHAR(36) PRIMARY KEY, phone VARCHAR(20) NOT NULL, code_hash CHAR(64) NOT NULL, attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 consumed BOOLEAN NOT NULL DEFAULT FALSE, expires_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX ix_otp_phone_created (phone,created_at)
) ENGINE=InnoDB;
CREATE TABLE password_resets (
 token_hash CHAR(64) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at DATETIME(3) NOT NULL,consumed BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,INDEX ix_resets_expiry (expires_at)
) ENGINE=InnoDB;
CREATE TABLE categories (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL UNIQUE,slug VARCHAR(120) NOT NULL UNIQUE,active BOOLEAN NOT NULL DEFAULT TRUE) ENGINE=InnoDB;
CREATE TABLE products (
 id VARCHAR(36) PRIMARY KEY,category_id BIGINT UNSIGNED NOT NULL,name VARCHAR(160) NOT NULL,description TEXT NOT NULL,
 price_paise INT UNSIGNED NOT NULL,old_price_paise INT UNSIGNED NOT NULL DEFAULT 0,stock INT UNSIGNED NOT NULL DEFAULT 0,
 image VARCHAR(500) NOT NULL,badge VARCHAR(100) NOT NULL DEFAULT '',care VARCHAR(160) NOT NULL DEFAULT '',water VARCHAR(160) NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY (category_id) REFERENCES categories(id), INDEX ix_products_catalog (active,category_id,id), INDEX ix_products_price (active,price_paise,id), FULLTEXT INDEX fx_products_search (name,description)
) ENGINE=InnoDB;
CREATE TABLE service_categories (name VARCHAR(100) PRIMARY KEY,active BOOLEAN NOT NULL DEFAULT TRUE) ENGINE=InnoDB;
CREATE TABLE services (
 id VARCHAR(36) PRIMARY KEY,category VARCHAR(100) NOT NULL,name VARCHAR(160) NOT NULL,description TEXT NOT NULL,image VARCHAR(500) NOT NULL,label VARCHAR(100) NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY (category) REFERENCES service_categories(name),INDEX ix_services_category (active,category,id)
) ENGINE=InnoDB;
CREATE TABLE service_packages (id VARCHAR(36) PRIMARY KEY,service_id VARCHAR(36) NOT NULL,name VARCHAR(160) NOT NULL,description TEXT NOT NULL,price_paise INT UNSIGNED NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE, FOREIGN KEY (service_id) REFERENCES services(id),INDEX ix_packages_service (service_id,active)) ENGINE=InnoDB;
CREATE TABLE addresses (
 id CHAR(36) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,tag VARCHAR(50) NOT NULL,name VARCHAR(100) NOT NULL,phone VARCHAR(20) NOT NULL,line VARCHAR(500) NOT NULL,city VARCHAR(100) NOT NULL,pincode VARCHAR(10) NOT NULL,is_default BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,INDEX ix_addresses_user (user_id,is_default)
) ENGINE=InnoDB;
CREATE TABLE cart_items (user_id BIGINT UNSIGNED NOT NULL,product_id VARCHAR(36) NOT NULL,quantity SMALLINT UNSIGNED NOT NULL, PRIMARY KEY(user_id,product_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products(id)) ENGINE=InnoDB;
CREATE TABLE wishlist (user_id BIGINT UNSIGNED NOT NULL,product_id VARCHAR(36) NOT NULL,PRIMARY KEY(user_id,product_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products(id)) ENGINE=InnoDB;
CREATE TABLE partners (
 id CHAR(36) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL UNIQUE,name VARCHAR(160) NOT NULL,person VARCHAR(100) NOT NULL,city VARCHAR(100) NOT NULL,address VARCHAR(500) NOT NULL,experience VARCHAR(100) NOT NULL,
 status ENUM('Pending','Approved','Rejected','Suspended') NOT NULL DEFAULT 'Pending',available BOOLEAN NOT NULL DEFAULT FALSE,received_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(user_id) REFERENCES users(id), INDEX ix_partners_matching (city,status,available,received_count,id)
) ENGINE=InnoDB;
CREATE TABLE partner_categories (partner_id CHAR(36) NOT NULL,category VARCHAR(100) NOT NULL,PRIMARY KEY(partner_id,category),FOREIGN KEY(partner_id) REFERENCES partners(id),FOREIGN KEY(category) REFERENCES service_categories(name)) ENGINE=InnoDB;
CREATE TABLE orders (
 seq BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,id CHAR(36) NOT NULL UNIQUE,user_id BIGINT UNSIGNED NOT NULL,idempotency_key VARCHAR(128) NOT NULL,request_hash CHAR(64) NOT NULL,
 status VARCHAR(40) NOT NULL DEFAULT 'Awaiting payment',payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',subtotal_paise INT UNSIGNED NOT NULL,delivery_paise INT UNSIGNED NOT NULL,total_paise INT UNSIGNED NOT NULL,
 address_json JSON NOT NULL,inventory_released BOOLEAN NOT NULL DEFAULT FALSE,expires_at DATETIME(3) NOT NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(user_id) REFERENCES users(id),UNIQUE KEY uq_order_idempotency (user_id,idempotency_key),INDEX ix_orders_user_page (user_id,seq),INDEX ix_orders_expiry (status,expires_at),INDEX ix_orders_status_page (status,seq)
) ENGINE=InnoDB;
CREATE TABLE order_items (order_id CHAR(36) NOT NULL,product_id VARCHAR(36) NOT NULL,name VARCHAR(160) NOT NULL,quantity SMALLINT UNSIGNED NOT NULL,unit_price_paise INT UNSIGNED NOT NULL,PRIMARY KEY(order_id,product_id),FOREIGN KEY(order_id) REFERENCES orders(id),FOREIGN KEY(product_id) REFERENCES products(id)) ENGINE=InnoDB;
CREATE TABLE inventory_movements (seq BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,product_id VARCHAR(36) NOT NULL,order_id CHAR(36) NULL,actor_id BIGINT UNSIGNED NULL,delta INT NOT NULL,reason VARCHAR(50) NOT NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),INDEX ix_inventory_product (product_id,seq),FOREIGN KEY(product_id) REFERENCES products(id)) ENGINE=InnoDB;
CREATE TABLE payments (id CHAR(36) PRIMARY KEY,order_id CHAR(36) NULL UNIQUE,booking_id CHAR(36) NULL UNIQUE,provider_order_id VARCHAR(100) NULL UNIQUE,provider_payment_id VARCHAR(100) NULL UNIQUE,amount_paise INT UNSIGNED NOT NULL,currency CHAR(3) NOT NULL DEFAULT 'INR',status VARCHAR(30) NOT NULL DEFAULT 'creating',created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(order_id) REFERENCES orders(id)) ENGINE=InnoDB;
CREATE TABLE refunds (id CHAR(36) PRIMARY KEY,order_id CHAR(36) NULL UNIQUE,booking_id CHAR(36) NULL UNIQUE,payment_id CHAR(36) NOT NULL,amount_paise INT UNSIGNED NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'pending',provider_refund_id VARCHAR(100) NULL UNIQUE,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(order_id) REFERENCES orders(id),FOREIGN KEY(payment_id) REFERENCES payments(id)) ENGINE=InnoDB;
CREATE TABLE webhook_events (id VARCHAR(128) PRIMARY KEY,body_hash CHAR(64) NOT NULL,event_type VARCHAR(100) NOT NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB;
CREATE TABLE bookings (
 seq BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,id CHAR(36) NOT NULL UNIQUE,user_id BIGINT UNSIGNED NOT NULL,idempotency_key VARCHAR(128) NOT NULL,request_hash CHAR(64) NOT NULL,
 service_id VARCHAR(36) NOT NULL,package_id VARCHAR(36) NOT NULL,package_name VARCHAR(160) NOT NULL,price_paise INT UNSIGNED NOT NULL,
 customer VARCHAR(100) NOT NULL,phone VARCHAR(20) NOT NULL,city VARCHAR(100) NOT NULL,address VARCHAR(500) NOT NULL,property VARCHAR(100) NOT NULL,area INT UNSIGNED NOT NULL,
 preferred_date DATE NOT NULL,preferred_time TIME NOT NULL,description TEXT NOT NULL,status VARCHAR(40) NOT NULL,assigned_partner_id CHAR(36) NULL,remarks TEXT NULL,payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(service_id) REFERENCES services(id),FOREIGN KEY(package_id) REFERENCES service_packages(id),FOREIGN KEY(assigned_partner_id) REFERENCES partners(id),
 UNIQUE KEY uq_booking_idempotency (user_id,idempotency_key),INDEX ix_bookings_user_page(user_id,seq),INDEX ix_bookings_partner_page(assigned_partner_id,seq),INDEX ix_bookings_status_page(status,seq)
) ENGINE=InnoDB;
CREATE TABLE booking_recipients (booking_id CHAR(36) NOT NULL,partner_id CHAR(36) NOT NULL,status ENUM('open','accepted','declined','closed') NOT NULL DEFAULT 'open',created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),PRIMARY KEY(booking_id,partner_id),FOREIGN KEY(booking_id) REFERENCES bookings(id),FOREIGN KEY(partner_id) REFERENCES partners(id),INDEX ix_recipients_partner(partner_id,status,booking_id)) ENGINE=InnoDB;
CREATE TABLE booking_events (seq BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,booking_id CHAR(36) NOT NULL,actor_id BIGINT UNSIGNED NULL,status VARCHAR(40) NOT NULL,notes VARCHAR(1000) NOT NULL DEFAULT '',created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(booking_id) REFERENCES bookings(id),INDEX ix_events_booking(booking_id,seq)) ENGINE=InnoDB;
CREATE TABLE reviews (booking_id CHAR(36) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,partner_id CHAR(36) NOT NULL,rating TINYINT UNSIGNED NOT NULL,feedback VARCHAR(1000) NOT NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(booking_id) REFERENCES bookings(id),INDEX ix_reviews_partner(partner_id,created_at),CHECK(rating BETWEEN 1 AND 5)) ENGINE=InnoDB;
CREATE TABLE uploads (id CHAR(36) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,kind ENUM('reference','completion','document','catalog') NOT NULL,object_key VARCHAR(500) NOT NULL UNIQUE,original_name VARCHAR(160) NOT NULL,content_type VARCHAR(100) NOT NULL,size_bytes INT UNSIGNED NOT NULL,status ENUM('pending','ready') NOT NULL DEFAULT 'pending',created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(user_id) REFERENCES users(id),INDEX ix_uploads_user(user_id,id)) ENGINE=InnoDB;
CREATE TABLE booking_uploads (booking_id CHAR(36) NOT NULL,upload_id CHAR(36) NOT NULL,PRIMARY KEY(booking_id,upload_id),FOREIGN KEY(booking_id) REFERENCES bookings(id),FOREIGN KEY(upload_id) REFERENCES uploads(id)) ENGINE=InnoDB;
CREATE TABLE partner_uploads (partner_id CHAR(36) NOT NULL,upload_id CHAR(36) NOT NULL,PRIMARY KEY(partner_id,upload_id),FOREIGN KEY(partner_id) REFERENCES partners(id),FOREIGN KEY(upload_id) REFERENCES uploads(id)) ENGINE=InnoDB;
CREATE TABLE notifications (seq BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,title VARCHAR(160) NOT NULL,message VARCHAR(1000) NOT NULL,type VARCHAR(50) NOT NULL,payload JSON NULL,campaign_id CHAR(36) NULL,read_at DATETIME(3) NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),FOREIGN KEY(user_id) REFERENCES users(id),UNIQUE KEY uq_notification_campaign(user_id,campaign_id),INDEX ix_notifications_user_page(user_id,seq),INDEX ix_notifications_unread(user_id,read_at,seq)) ENGINE=InnoDB;
CREATE TABLE newsletter_subscribers (email VARCHAR(254) PRIMARY KEY,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB;
CREATE TABLE settings (`key` VARCHAR(100) PRIMARY KEY,value_json JSON NOT NULL) ENGINE=InnoDB;
CREATE TABLE outbox_jobs (id CHAR(36) PRIMARY KEY,type VARCHAR(50) NOT NULL,payload JSON NOT NULL,status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',attempts INT UNSIGNED NOT NULL DEFAULT 0,available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),lease_until DATETIME(3) NULL,lease_token CHAR(36) NULL,last_error VARCHAR(500) NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),INDEX ix_outbox_ready(status,available_at),INDEX ix_outbox_lease(status,lease_until)) ENGINE=InnoDB;
CREATE TABLE audit_logs (seq BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,actor_id BIGINT UNSIGNED NULL,action VARCHAR(100) NOT NULL,resource_type VARCHAR(50) NOT NULL,resource_id VARCHAR(100) NOT NULL,details JSON NULL,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),INDEX ix_audit_resource(resource_type,resource_id,seq),INDEX ix_audit_actor(actor_id,seq)) ENGINE=InnoDB;

ALTER TABLE payments ADD FOREIGN KEY (booking_id) REFERENCES bookings(id), ADD CHECK ((order_id IS NOT NULL AND booking_id IS NULL) OR (order_id IS NULL AND booking_id IS NOT NULL));
ALTER TABLE refunds ADD FOREIGN KEY (booking_id) REFERENCES bookings(id);
