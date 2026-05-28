package com.example.messenger.chat;

import com.example.messenger.message.MessageEntity;
import com.example.messenger.user.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_members")
public class ChatMemberEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chat_id", nullable = false)
    private ChatEntity chat;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private ChatMemberRole role;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_read_message_id")
    private MessageEntity lastReadMessage;

    protected ChatMemberEntity() {
    }

    public ChatMemberEntity(ChatEntity chat, UserEntity user, ChatMemberRole role) {
        this.chat = chat;
        this.user = user;
        this.role = role;
    }

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }

        if (joinedAt == null) {
            joinedAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public ChatEntity getChat() {
        return chat;
    }

    public UserEntity getUser() {
        return user;
    }

    public ChatMemberRole getRole() {
        return role;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public MessageEntity getLastReadMessage() {
        return lastReadMessage;
    }

    public void setChat(ChatEntity chat) {
        this.chat = chat;
    }

    public void setUser(UserEntity user) {
        this.user = user;
    }

    public void setRole(ChatMemberRole role) {
        this.role = role;
    }

    public void setLastReadMessage(MessageEntity lastReadMessage) {
        this.lastReadMessage = lastReadMessage;
    }
}