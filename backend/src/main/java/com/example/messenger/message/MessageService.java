package com.example.messenger.message;

import com.example.messenger.chat.ChatEntity;
import com.example.messenger.chat.ChatMemberRepository;
import com.example.messenger.chat.ChatRepository;
import com.example.messenger.user.UserEntity;
import com.example.messenger.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.time.Instant;

@Service
public class MessageService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;

    private final MessageRepository messageRepository;
    private final ChatRepository chatRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final UserRepository userRepository;

    public MessageService(
            MessageRepository messageRepository,
            ChatRepository chatRepository,
            ChatMemberRepository chatMemberRepository,
            UserRepository userRepository
    ) {
        this.messageRepository = messageRepository;
        this.chatRepository = chatRepository;
        this.chatMemberRepository = chatMemberRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getMessages(
            UUID chatId,
            UUID currentUserId,
            int limit,
            Instant before,
            Instant after,
            UUID around
    ) {
        ensureUserIsChatMember(chatId, currentUserId);

        int safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

        if (around != null) {
            return getMessagesAround(chatId, around, safeLimit);
        }

        PageRequest pageRequest = PageRequest.of(
                0,
                safeLimit,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        if (before != null) {
            List<MessageResponse> messages = messageRepository
                    .findAllByChatIdAndDeletedAtIsNullAndCreatedAtBeforeOrderByCreatedAtDesc(
                            chatId,
                            before,
                            pageRequest
                    )
                    .stream()
                    .map(MessageResponse::fromEntity)
                    .toList();

            return reversed(messages);
        }

        if (after != null) {
            PageRequest afterPageRequest = PageRequest.of(
                    0,
                    safeLimit,
                    Sort.by(Sort.Direction.ASC, "createdAt")
            );

            return messageRepository
                    .findAllByChatIdAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtAsc(
                            chatId,
                            after,
                            afterPageRequest
                    )
                    .stream()
                    .map(MessageResponse::fromEntity)
                    .toList();
        }

        return reversed(
                messageRepository
                        .findAllByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(chatId, pageRequest)
                        .stream()
                        .map(MessageResponse::fromEntity)
                        .toList()
        );
    }

    private List<MessageResponse> getMessagesAround(
            UUID chatId,
            UUID aroundMessageId,
            int limit
    ) {
        MessageEntity target = messageRepository.findByIdAndChatIdAndDeletedAtIsNull(
                aroundMessageId,
                chatId
        ).orElseThrow(() -> new IllegalArgumentException("Message not found"));

        int beforeLimit = Math.max(10, limit / 3);
        int afterLimit = Math.max(20, limit - beforeLimit);

        List<MessageEntity> beforeOrAt = messageRepository.findMessagesBeforeOrAt(
                chatId,
                target.getCreatedAt(),
                PageRequest.of(0, beforeLimit)
        );

        List<MessageEntity> after = messageRepository.findMessagesAfter(
                chatId,
                target.getCreatedAt(),
                PageRequest.of(0, afterLimit)
        );

        List<MessageEntity> result = new java.util.ArrayList<>();

        List<MessageEntity> beforeAscending = new java.util.ArrayList<>(beforeOrAt);
        java.util.Collections.reverse(beforeAscending);

        result.addAll(beforeAscending);
        result.addAll(after);

        return result.stream()
                .map(MessageResponse::fromEntity)
                .toList();
    }

    @Transactional
    public MessageResponse createMessage(
            UUID chatId,
            UUID currentUserId,
            CreateMessageRequest request
    ) {
        ensureUserIsChatMember(chatId, currentUserId);

        ChatEntity chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        UserEntity sender = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String content = request.content().trim();

        MessageEntity message = new MessageEntity(chat, sender, content);
        MessageEntity savedMessage = messageRepository.save(message);

        chat.touch();
        chatRepository.save(chat);

        return MessageResponse.fromEntity(savedMessage);
    }
    
    @Transactional
    public MessageResponse updateMessage(
            UUID chatId,
            UUID messageId,
            UUID currentUserId,
            UpdateMessageRequest request
    ) {
        ensureUserIsChatMember(chatId, currentUserId);

        MessageEntity message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        if (!message.getChat().getId().equals(chatId)) {
            throw new IllegalArgumentException("Message not found");
        }

        if (message.getDeletedAt() != null) {
            throw new IllegalArgumentException("Message is deleted");
        }

        if (message.getSender() == null || !message.getSender().getId().equals(currentUserId)) {
            throw new IllegalArgumentException("You can edit only your own messages");
        }

        message.markEdited(request.content().trim());

        MessageEntity savedMessage = messageRepository.save(message);

        return MessageResponse.fromEntity(savedMessage);
    }

    @Transactional
    public MessageResponse deleteMessage(
            UUID chatId,
            UUID messageId,
            UUID currentUserId
    ) {
        ensureUserIsChatMember(chatId, currentUserId);

        MessageEntity message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        if (!message.getChat().getId().equals(chatId)) {
            throw new IllegalArgumentException("Message not found");
        }

        if (message.getDeletedAt() != null) {
            return MessageResponse.fromEntity(message);
        }

        if (message.getSender() == null || !message.getSender().getId().equals(currentUserId)) {
            throw new IllegalArgumentException("You can delete only your own messages");
        }

        message.markDeleted();

        MessageEntity savedMessage = messageRepository.save(message);

        return MessageResponse.fromEntity(savedMessage);
    }

    @Transactional(readOnly = true)
    public void ensureCanPublishTyping(UUID chatId, UUID currentUserId) {
        ensureUserIsChatMember(chatId, currentUserId);
    }

    private void ensureUserIsChatMember(UUID chatId, UUID userId) {
        boolean isMember = chatMemberRepository.existsByChatIdAndUserId(chatId, userId);

        if (!isMember) {
            throw new IllegalArgumentException("Chat not found");
        }
    }

    private List<MessageResponse> reversed(List<MessageResponse> messages) {
        List<MessageResponse> copy = new java.util.ArrayList<>(messages);
        Collections.reverse(copy);
        return copy;
    }
}