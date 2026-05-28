package com.example.messenger.message;

import com.example.messenger.chat.ChatEntity;
import com.example.messenger.user.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages")
public class MessageEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chat_id", nullable = false)
    private ChatEntity chat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id")
    private UserEntity sender;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "edited_at")
    private Instant editedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected MessageEntity() {
    }

    public MessageEntity(ChatEntity chat, UserEntity sender, String content) {
        this.chat = chat;
        this.sender = sender;
        this.content = content;
    }

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }

        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public ChatEntity getChat() {
        return chat;
    }

    public UserEntity getSender() {
        return sender;
    }

    public String getContent() {
        return content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEditedAt() {
        return editedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setChat(ChatEntity chat) {
        this.chat = chat;
    }

    public void setSender(UserEntity sender) {
        this.sender = sender;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void markEdited(String content) {
        this.content = content;
        this.editedAt = Instant.now();
    }

    public void markDeleted() {
        this.deletedAt = Instant.now();
    }
}