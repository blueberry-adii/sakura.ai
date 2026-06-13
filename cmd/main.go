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

	go func() {
		defer close(out)

		url := "http://localhost:11434/api/chat" // comes from env

		var payload models.OllamaRequest

		if chatService != nil && chatId != "" {
			// Fetch previous conversation history
			history, err := chatService.FetchHistory(ctx, chatId)
			if err != nil {
				log.Printf("Failed to fetch history for chat %s: %v", chatId, err)
				payload = models.OllamaRequest{
					Model:    "qwen3:0.6b",
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
	dbPass := "pass"
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

	chatService = service.NewChatService(db)

	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("static"))

	mux.HandleFunc("GET /", fs.ServeHTTP)

	mux.HandleFunc("POST /api/v1/chat", streamHandler)

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

	log.Println("Starting server on :80...")
	http.ListenAndServe(":80", mux)
}
