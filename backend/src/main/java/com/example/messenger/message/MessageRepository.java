package com.example.messenger.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {

    @EntityGraph(attributePaths = {"sender"})
    Page<MessageEntity> findAllByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID chatId,
            Pageable pageable
    );
}