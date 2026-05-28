package com.example.messenger.chat;

import com.example.messenger.user.UserEntity;
import com.example.messenger.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.messenger.message.MessageEntity;
import com.example.messenger.message.MessageRepository;
import com.example.messenger.message.MessageResponse;
import java.time.Instant;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class ChatService {

    private final ChatRepository chatRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;

    public ChatService(
            ChatRepository chatRepository,
            ChatMemberRepository chatMemberRepository,
            UserRepository userRepository,
            MessageRepository messageRepository
    ) {
        this.chatRepository = chatRepository;
        this.chatMemberRepository = chatMemberRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional
    public ChatResponse markChatAsRead(UUID chatId, UUID currentUserId) {
        ChatMemberEntity membership = chatMemberRepository.findByChatIdAndUserId(chatId, currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        messageRepository.findFirstByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(chatId)
                .ifPresent(membership::setLastReadMessage);

        chatMemberRepository.save(membership);

        return getChat(chatId, currentUserId);
    }

    @Transactional
    public ChatResponse createOrGetDirectChat(UUID currentUserId, UUID targetUserId) {
        if (currentUserId.equals(targetUserId)) {
            throw new IllegalArgumentException("Cannot create direct chat with yourself");
        }

        UserEntity currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Current user not found"));

        UserEntity targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found"));

        String directKey = buildDirectKey(currentUserId, targetUserId);

        ChatEntity chat = chatRepository.findByDirectKey(directKey)
                .orElseGet(() -> createDirectChat(currentUser, targetUser, directKey));

        return toResponse(chat, currentUserId);
    }

    @Transactional(readOnly = true)
    public List<ChatResponse> getUserChats(UUID currentUserId) {
        List<ChatMemberEntity> currentUserMemberships =
                chatMemberRepository.findAllByUserIdOrderByChatUpdatedAtDesc(currentUserId);

        return currentUserMemberships.stream()
                .map(ChatMemberEntity::getChat)
                .distinct()
                .map(chat -> toResponse(chat, currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public ChatResponse getChat(UUID chatId, UUID currentUserId) {
        if (!chatMemberRepository.existsByChatIdAndUserId(chatId, currentUserId)) {
            throw new IllegalArgumentException("Chat not found");
        }

        ChatEntity chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        return toResponse(chat, currentUserId);
    }

    private ChatEntity createDirectChat(
            UserEntity currentUser,
            UserEntity targetUser,
            String directKey
    ) {
        ChatEntity chat = new ChatEntity(
                ChatType.DIRECT,
                null,
                directKey,
                currentUser
        );

        ChatEntity savedChat = chatRepository.save(chat);

        chatMemberRepository.save(new ChatMemberEntity(
                savedChat,
                currentUser,
                ChatMemberRole.MEMBER
        ));

        chatMemberRepository.save(new ChatMemberEntity(
                savedChat,
                targetUser,
                ChatMemberRole.MEMBER
        ));

        return savedChat;
    }

    @Transactional(readOnly = true)
    public ChatResponse toResponse(ChatEntity chat, UUID currentUserId) {
        List<ChatMemberResponse> members = chatMemberRepository.findAllByChatId(chat.getId())
            .stream()
            .map(ChatMemberEntity::getUser)
            .sorted(Comparator.comparing(UserEntity::getUsername))
            .filter(user -> shouldIncludeMember(chat.getType(), user.getId(), currentUserId))
            .map(ChatMemberResponse::fromUser)
            .toList();

        MessageResponse lastMessage = messageRepository
                .findFirstByChatIdAndDeletedAtIsNullOrderByCreatedAtDesc(chat.getId())
                .map(MessageResponse::fromEntity)
                .orElse(null);

        ChatMemberEntity currentMembership = chatMemberRepository
                .findByChatIdAndUserId(chat.getId(), currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        Instant lastReadAt = currentMembership.getLastReadMessage() == null
                ? null
                : currentMembership.getLastReadMessage().getCreatedAt();

        long unreadCount = lastReadAt == null
                ? messageRepository.countUnreadMessages(
                        chat.getId(),
                        currentUserId
                )
                : messageRepository.countUnreadMessagesAfter(
                        chat.getId(),
                        currentUserId,
                        lastReadAt
                );

        return new ChatResponse(
                chat.getId(),
                chat.getType(),
                chat.getTitle(),
                members,
                lastMessage,
                unreadCount,
                chat.getCreatedAt(),
                chat.getUpdatedAt()
        );
    }

    private boolean shouldIncludeMember(ChatType chatType, UUID memberUserId, UUID currentUserId) {
        if (chatType == ChatType.DIRECT) {
            return !memberUserId.equals(currentUserId);
        }

        return true;
    }

    private String buildDirectKey(UUID firstUserId, UUID secondUserId) {
        return List.of(firstUserId, secondUserId)
                .stream()
                .map(UUID::toString)
                .sorted()
                .reduce((first, second) -> first + ":" + second)
                .orElseThrow();
    }
}