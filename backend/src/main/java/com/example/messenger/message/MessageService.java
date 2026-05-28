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
    public List<MessageResponse> getMessages(UUID chatId, UUID currentUserId, int limit) {
        ensureUserIsChatMember(chatId, currentUserId);

        int safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

        PageRequest pageRequest = PageRequest.of(
                0,
                safeLimit,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        List<MessageResponse> messages = messageRepository
                .findAllByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(chatId, pageRequest)
                .stream()
                .map(MessageResponse::fromEntity)
                .toList();

        return reversed(messages);
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