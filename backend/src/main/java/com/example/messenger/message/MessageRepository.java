package com.example.messenger.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {

    Page<MessageEntity> findAllByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID chatId, Pageable pageable);
}