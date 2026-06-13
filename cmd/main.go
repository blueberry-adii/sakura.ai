package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/blueberry-adii/aries.ai/internal/models"
)

func chat(message string) {
	url := "http://localhost:11434/api/chat" // comes from env

	payload := models.OllamaRequest{
		Model:    "qwen3:0.6b",
		Stream:   true,
		Messages: []models.Message{{Role: "user", Content: message}},
	}
	jsonValue, err := json.Marshal(payload)
	if err != nil {
		log.Fatalf("Failed to marshal request: %v", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		log.Fatalf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)

	fmt.Println("--- Streaming Response ---")
	for scanner.Scan() {
		var chunk models.OllamaResponse
		line := scanner.Bytes()

		if err := json.Unmarshal(line, &chunk); err != nil {
			log.Printf("Error unmarshaling chunk: %v", err)
			continue
		}

		if chunk.Message.Thinking != "" {
			fmt.Print(chunk.Message.Thinking)
		}

		if chunk.Message.Content != "" {
			fmt.Print(chunk.Message.Content)
		}

		if chunk.Done {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		log.Fatalf("Error reading stream: %v", err)
	}
	fmt.Println("\n--- Stream Finished ---")
}

func main() {
	chat("Why is the sky blue?")
	// mux := http.NewServeMux()

	// fs := http.FileServer(http.Dir("static"))

	// mux.HandleFunc("GET /", fs.ServeHTTP)

	// mux.HandleFunc("POST /api/v1/chat", func(w http.ResponseWriter, r *http.Request) {
	// 	var body struct {
	// 		Message string `json:"message"`
	// 	}

	// 	err := json.NewDecoder(r.Body).Decode(&body)
	// 	if err != nil {
	// 		http.Error(w, "Invalid request body", http.StatusBadRequest)
	// 		return
	// 	}
	// 	defer r.Body.Close()
	// 	chat(body.Message)

	// 	w.WriteHeader(http.StatusOK)
	// })

	// http.ListenAndServe(":80", mux)
}
