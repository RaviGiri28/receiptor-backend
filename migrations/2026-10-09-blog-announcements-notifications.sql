-- Run ONCE against receiptor_db before starting the updated server.
-- Blog posts, dashboard announcements and notification read-tracking.

CREATE TABLE blog_posts (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    summary VARCHAR(300) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    tag VARCHAR(30) NOT NULL DEFAULT 'update',
    cover_image VARCHAR(255) NULL,
    cover_image_public_id VARCHAR(255) NULL,
    visibility VARCHAR(10) NOT NULL DEFAULT 'both',
    status VARCHAR(10) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP NULL DEFAULT NULL,
    author_id INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY UQ_blog_post_slug (slug),
    KEY IDX_blog_post_feed (status, visibility, published_at),
    CONSTRAINT FK_blog_post_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE announcements (
    id INT NOT NULL AUTO_INCREMENT,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(10) NOT NULL DEFAULT 'info',
    link_url VARCHAR(500) NULL,
    link_label VARCHAR(50) NULL,
    pinned TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(10) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP NULL DEFAULT NULL,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY IDX_announcement_live (status, published_at)
);

CREATE TABLE notification_reads (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    item_id INT NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY UQ_notification_read (user_id, item_type, item_id),
    CONSTRAINT FK_notification_read_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

ALTER TABLE users ADD COLUMN notifications_cleared_at TIMESTAMP NULL DEFAULT NULL;
