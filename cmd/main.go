package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/blueberry-adii/aries.ai/internal/models"
)

func streamHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
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

	chunks := chat(r.Context(), body.Message)

	for chunk := range chunks {
		jsonBytes, err := json.Marshal(chunk)
		if err != nil {
			log.Printf("Error marshaling JSON: %v", err)
			continue
		}

		fmt.Fprintf(w, "data: %s\n\n", string(jsonBytes))

		flusher.Flush()
	}
}

func chat(ctx context.Context, message string) <-chan models.OllamaResponse {
	out := make(chan models.OllamaResponse)

	go func() {
		defer close(out)

		url := "http://localhost:11434/api/chat" // comes from env
		payload := models.OllamaRequest{
			Model:    "qwen3:0.6b",
			Stream:   true,
			Messages: []models.Message{{Role: "user", Content: message}},
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
	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("static"))

	mux.HandleFunc("GET /", fs.ServeHTTP)

	mux.HandleFunc("POST /api/v1/chat", streamHandler)

	http.ListenAndServe(":80", mux)
}
