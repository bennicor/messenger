package com.example.messenger.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {

    @EntityGraph(attributePaths = {"sender", "chat"})
    Page<MessageEntity> findAllByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID chatId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"sender", "chat"})
    Optional<MessageEntity> findFirstByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID chatId);

    @Query("""
            select count(m)
            from MessageEntity m
            where m.chat.id = :chatId
            and m.deletedAt is null
            and m.sender is not null
            and m.sender.id <> :userId
            """)
    long countUnreadMessages(
            @Param("chatId") UUID chatId,
            @Param("userId") UUID userId
    );

    @Query("""
            select count(m)
            from MessageEntity m
            where m.chat.id = :chatId
            and m.deletedAt is null
            and m.sender is not null
            and m.sender.id <> :userId
            and m.createdAt > :after
            """)
    long countUnreadMessagesAfter(
            @Param("chatId") UUID chatId,
            @Param("userId") UUID userId,
            @Param("after") Instant after
    );

    @EntityGraph(attributePaths = {"sender", "chat"})
    Page<MessageEntity> findAllByChatIdAndDeletedAtIsNullAndCreatedAtBeforeOrderByCreatedAtDesc(
            UUID chatId,
            Instant before,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"sender", "chat"})
    Optional<MessageEntity> findFirstByChatIdAndDeletedAtIsNullAndSenderIdNotOrderByCreatedAtAsc(
            UUID chatId,
            UUID senderId
    );

    @EntityGraph(attributePaths = {"sender", "chat"})
    Optional<MessageEntity> findFirstByChatIdAndDeletedAtIsNullAndSenderIdNotAndCreatedAtAfterOrderByCreatedAtAsc(
            UUID chatId,
            UUID senderId,
            Instant after
    );

    @EntityGraph(attributePaths = {"sender", "chat"})
    Optional<MessageEntity> findByIdAndChatIdAndDeletedAtIsNull(UUID id, UUID chatId);

    @Query("""
            select m
            from MessageEntity m
            where m.chat.id = :chatId
            and m.deletedAt is null
            and m.createdAt <= :createdAt
            order by m.createdAt desc
            """)
    @EntityGraph(attributePaths = {"sender", "chat"})
    List<MessageEntity> findMessagesBeforeOrAt(
            UUID chatId,
            Instant createdAt,
            Pageable pageable
    );

    @Query("""
            select m
            from MessageEntity m
            where m.chat.id = :chatId
            and m.deletedAt is null
            and m.createdAt > :createdAt
            order by m.createdAt asc
            """)
    @EntityGraph(attributePaths = {"sender", "chat"})
    List<MessageEntity> findMessagesAfter(
            UUID chatId,
            Instant createdAt,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"sender", "chat"})
    Page<MessageEntity> findAllByChatIdAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtAsc(
            UUID chatId,
            Instant after,
            Pageable pageable
    );
}