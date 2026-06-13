package service

import (
	"context"
	"database/sql"

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
		Model:    "qwen3:0.6b",
		Stream:   true,
		Messages: messages,
	}
}

func (s *ChatService) EnsureChatExists(ctx context.Context, chatId string, title string) error {
	query := `INSERT INTO chats (id, title) VALUES (?, ?) ON DUPLICATE KEY UPDATE id=id`
	_, err := s.db.ExecContext(ctx, query, chatId, title)
	return err
}

func (s *ChatService) SaveMessage(ctx context.Context, chatId string, role string, content string, thinking string) error {
	var thinkingVal sql.NullString
	if thinking != "" {
		thinkingVal = sql.NullString{String: thinking, Valid: true}
	}
	query := `INSERT INTO messages (chat_id, role, content, thinking) VALUES (?, ?, ?, ?)`
	_, err := s.db.ExecContext(ctx, query, chatId, role, content, thinkingVal)
	return err
}

