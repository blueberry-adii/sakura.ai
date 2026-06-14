package service

import (
	"context"
	"database/sql"
	"os"

	"github.com/blueberry-adii/sakura.ai/internal/models"
)

type ChatService struct {
	db *sql.DB
}

func NewChatService(db *sql.DB) *ChatService {
	return &ChatService{db}
}

func (s *ChatService) FetchHistory(ctx context.Context, chatId string) ([]models.Message, error) {
	query := `SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id ASC`
	rows, err := s.db.QueryContext(ctx, query, chatId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []models.Message
	for rows.Next() {
		var msg models.Message
		if err := rows.Scan(&msg.Role, &msg.Content); err != nil {
			return nil, err
		}
		history = append(history, msg)
	}
	return history, nil
}

func (s *ChatService) PrepareRequest(history []models.Message, newMessage string) models.OllamaRequest {
	messages := make([]models.Message, 0, len(history)+1)
	messages = append(messages, history...)
	messages = append(messages, models.Message{
		Role:    "user",
		Content: newMessage,
	})
	return models.OllamaRequest{
		Model:    os.Getenv("AI_MODEL"),
		Stream:   true,
		Messages: messages,
	}
}

func (s *ChatService) EnsureChatExists(ctx context.Context, chatId string, title string) error {
	query := `INSERT INTO chats (id, title) VALUES (?, ?) ON DUPLICATE KEY UPDATE id=id`
	_, err := s.db.ExecContext(ctx, query, chatId, title)
	return err
}

func (s *ChatService) SaveMessage(ctx context.Context, chatId string, role string, content string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	queryMsg := `INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)`
	if _, err := tx.ExecContext(ctx, queryMsg, chatId, role, content); err != nil {
		return err
	}

	queryChat := `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	if _, err := tx.ExecContext(ctx, queryChat, chatId); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *ChatService) FetchChats(ctx context.Context) ([]models.Chat, error) {
	query := `SELECT id, title, updated_at FROM chats ORDER BY updated_at DESC`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chats []models.Chat
	for rows.Next() {
		var chat models.Chat
		var updatedAt sql.NullTime
		if err := rows.Scan(&chat.ID, &chat.Title, &updatedAt); err != nil {
			return nil, err
		}
		if updatedAt.Valid {
			chat.Timestamp = updatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		chats = append(chats, chat)
	}
	return chats, nil
}

func (s *ChatService) RenameChat(ctx context.Context, chatId string, title string) error {
	query := `UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := s.db.ExecContext(ctx, query, title, chatId)
	return err
}

func (s *ChatService) DeleteChat(ctx context.Context, chatId string) error {
	query := `DELETE FROM chats WHERE id = ?`
	_, err := s.db.ExecContext(ctx, query, chatId)
	return err
}
