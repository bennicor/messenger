package com.example.messenger.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatMemberRepository extends JpaRepository<ChatMemberEntity, UUID> {

    boolean existsByChatIdAndUserId(UUID chatId, UUID userId);

    List<ChatMemberEntity> findAllByUserId(UUID userId);

    List<ChatMemberEntity> findAllByChatId(UUID chatId);
}