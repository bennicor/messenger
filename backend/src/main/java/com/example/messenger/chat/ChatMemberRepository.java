package com.example.messenger.chat;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatMemberRepository extends JpaRepository<ChatMemberEntity, UUID> {

    boolean existsByChatIdAndUserId(UUID chatId, UUID userId);

    @EntityGraph(attributePaths = {"chat", "user", "lastReadMessage"})
    Optional<ChatMemberEntity> findByChatIdAndUserId(UUID chatId, UUID userId);

    @EntityGraph(attributePaths = {"chat", "user", "lastReadMessage"})
    List<ChatMemberEntity> findAllByUserIdOrderByChatUpdatedAtDesc(UUID userId);

    @EntityGraph(attributePaths = {"chat", "user"})
    List<ChatMemberEntity> findAllByChatId(UUID chatId);
}