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
