package com.example.messenger.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    Optional<UserEntity> findByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);

    Page<UserEntity> findAllByIdNot(UUID currentUserId, Pageable pageable);

    @Query("""
            select u
            from UserEntity u
            where u.id <> :currentUserId
              and (
                lower(u.username) like lower(concat('%', :search, '%'))
                or lower(u.email) like lower(concat('%', :search, '%'))
                or lower(coalesce(u.displayName, '')) like lower(concat('%', :search, '%'))
              )
            order by u.username asc
            """)
    Page<UserEntity> searchUsers(UUID currentUserId, String search, Pageable pageable);
}