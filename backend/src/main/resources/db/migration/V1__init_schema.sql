CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(80),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_app_users_username UNIQUE (username),
    CONSTRAINT uq_app_users_email UNIQUE (email),
    CONSTRAINT chk_app_users_username_length CHECK (char_length(username) >= 3),
    CONSTRAINT chk_app_users_email_not_blank CHECK (char_length(email) >= 5)
);

CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,
    title VARCHAR(120),
    direct_key VARCHAR(80),
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_chats_type CHECK (type IN ('DIRECT', 'GROUP')),
    CONSTRAINT chk_group_chat_title CHECK (
        type <> 'GROUP' OR title IS NOT NULL
    ),
    CONSTRAINT uq_chats_direct_key UNIQUE (direct_key)
);

CREATE TABLE chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_message_id UUID,

    CONSTRAINT chk_chat_members_role CHECK (role IN ('OWNER', 'MEMBER')),
    CONSTRAINT uq_chat_members_chat_user UNIQUE (chat_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_messages_content_not_blank CHECK (char_length(trim(content)) > 0)
);

ALTER TABLE chat_members
    ADD CONSTRAINT fk_chat_members_last_read_message
    FOREIGN KEY (last_read_message_id)
    REFERENCES messages(id)
    ON DELETE SET NULL;

CREATE INDEX idx_app_users_username_lower ON app_users (lower(username));
CREATE INDEX idx_app_users_email_lower ON app_users (lower(email));

CREATE INDEX idx_chats_created_by ON chats (created_by);
CREATE INDEX idx_chats_type ON chats (type);

CREATE INDEX idx_chat_members_user_id ON chat_members (user_id);
CREATE INDEX idx_chat_members_chat_id ON chat_members (chat_id);

CREATE INDEX idx_messages_chat_id_created_at ON messages (chat_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);