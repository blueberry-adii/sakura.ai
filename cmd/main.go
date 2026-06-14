package main

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/blueberry-adii/sakura.ai/internal/models"
	service "github.com/blueberry-adii/sakura.ai/internal/services"
	_ "github.com/go-sql-driver/mysql"
)

var chatService *service.ChatService

func streamHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ChatID  string `json:"chat_id"`
		Message string `json:"message"`
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON payload: %v", err.Error()), http.StatusBadRequest)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	// 1. Ensure the chat session exists in the database
	if chatService != nil && body.ChatID != "" {
		title := body.Message
		if len(title) > 25 {
			title = title[:25] + "..."
		}
		if err := chatService.EnsureChatExists(r.Context(), body.ChatID, title); err != nil {
			log.Printf("Error ensuring chat session exists: %v", err)
		}

		// 2. Save user message to database
		if err := chatService.SaveMessage(r.Context(), body.ChatID, "user", body.Message); err != nil {
			log.Printf("Error saving user message: %v", err)
		}
	}

	// 3. Start response streaming
	chunks := chat(r.Context(), body.ChatID, body.Message)

	var fullResponseText strings.Builder

	for chunk := range chunks {
		if len(chunk.Message.Content) > 0 {
			fullResponseText.WriteString(chunk.Message.Content)
		}

		jsonBytes, err := json.Marshal(chunk)
		if err != nil {
			log.Printf("Error marshaling JSON: %v", err)
			continue
		}

		fmt.Fprintf(w, "data: %s\n\n", string(jsonBytes))
		flusher.Flush()
	}

	// 4. Save bot's complete response to database
	if chatService != nil && body.ChatID != "" && fullResponseText.Len() > 0 {
		if err := chatService.SaveMessage(context.Background(), body.ChatID, "assistant", fullResponseText.String()); err != nil {
			log.Printf("Error saving assistant message: %v", err)
		}
	}
}

func chat(ctx context.Context, chatId string, message string) <-chan models.OllamaResponse {
	out := make(chan models.OllamaResponse)
	baseUrl := os.Getenv("AI_URL")
	model := os.Getenv("AI_MODEL")

	go func() {
		defer close(out)

		url := baseUrl + "/api/chat" // comes from env

		var payload models.OllamaRequest

		if chatService != nil && chatId != "" {
			// Fetch previous conversation history
			history, err := chatService.FetchHistory(ctx, chatId)
			if err != nil {
				log.Printf("Failed to fetch history for chat %s: %v", chatId, err)
				payload = models.OllamaRequest{
					Model:    model,
					Stream:   true,
					Messages: []models.Message{{Role: "user", Content: message}},
				}
			} else {
				// Prepare payload with history injected
				payload = chatService.PrepareRequest(history, message)
			}
		} else {
			payload = models.OllamaRequest{
				Model:    "qwen3:0.6b",
				Stream:   true,
				Messages: []models.Message{{Role: "user", Content: message}},
			}
		}

		jsonValue, err := json.Marshal(payload)
		if err != nil {
			log.Printf("Failed to marshal request: %v", err)
			return
		}

		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonValue))
		if err != nil {
			log.Printf("Ollama stream error (req creation): %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("HTTP request failed: %v", err)
			return
		}
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				log.Println("User disconnected. Aborting stream loop.")
				return
			default:
			}

			var chunk models.OllamaResponse

			if err := json.Unmarshal(scanner.Bytes(), &chunk); err != nil {
				log.Printf("Error unmarshaling chunk: %v", err)
				continue
			}

			select {
			case out <- chunk:
			case <-ctx.Done():
				return
			}

			if chunk.Done {
				break
			}
		}
	}()

	return out
}

func main() {
	// Initialize database connection
	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "root"
	}
	dbPass := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "3306"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "sakura"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true", dbUser, dbPass, dbHost, dbPort, dbName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	if err := db.Ping(); err != nil {
		log.Printf("Warning: Database ping failed: %v. Database operations will fail if MySQL is offline.", err)
	}

	db.Exec(`CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );`)

	db.Exec(`CREATE TABLE IF NOT EXISTS messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        chat_id VARCHAR(36) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content MEDIUMTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        INDEX idx_chat_created (chat_id, created_at)
    );`)

	chatService = service.NewChatService(db)

	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("static"))

	mux.HandleFunc("GET /", fs.ServeHTTP)

	mux.HandleFunc("POST /api/v1/chat", streamHandler)

	mux.HandleFunc("GET /api/v1/chats", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if chatService == nil {
			json.NewEncoder(w).Encode([]models.Chat{})
			return
		}
		chats, err := chatService.FetchChats(r.Context())
		if err != nil {
			log.Printf("Failed to fetch chats: %v", err)
			http.Error(w, "Failed to fetch chats", http.StatusInternalServerError)
			return
		}
		if chats == nil {
			chats = []models.Chat{}
		}
		json.NewEncoder(w).Encode(chats)
	})

	mux.HandleFunc("GET /api/v1/chat/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		w.Header().Set("Content-Type", "application/json")
		if chatService == nil {
			json.NewEncoder(w).Encode([]models.Message{})
			return
		}
		messages, err := chatService.FetchHistory(r.Context(), id)
		if err != nil {
			log.Printf("Failed to fetch chat history for API: %v", err)
			http.Error(w, "Failed to fetch chat history", http.StatusInternalServerError)
			return
		}
		if messages == nil {
			messages = []models.Message{}
		}
		json.NewEncoder(w).Encode(messages)
	})

	mux.HandleFunc("PUT /api/v1/chat/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Title string `json:"title"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if chatService == nil {
			http.Error(w, "Database unavailable", http.StatusServiceUnavailable)
			return
		}
		if err := chatService.RenameChat(r.Context(), id, body.Title); err != nil {
			log.Printf("Failed to rename chat %s: %v", id, err)
			http.Error(w, "Failed to rename chat", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("DELETE /api/v1/chat/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if chatService == nil {
			http.Error(w, "Database unavailable", http.StatusServiceUnavailable)
			return
		}
		if err := chatService.DeleteChat(r.Context(), id); err != nil {
			log.Printf("Failed to delete chat %s: %v", id, err)
			http.Error(w, "Failed to delete chat", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	log.Println("Starting server on :80...")
	http.ListenAndServe(":80", mux)
}
