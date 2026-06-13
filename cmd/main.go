package main

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/blueberry-adii/aries.ai/internal/models"
)

func chat() {
	url := "http://localhost:11434/api/chat" // comes from env

	payload := models.ChatPayload{
		Model:    "gwen3:0.6b",
		Messages: []models.Message{{Role: "user", Content: "why is the sky blue?"}},
	}
	jsonValue, _ := json.Marshal(payload)

	http.Post(url, "application/json", bytes.NewBuffer(jsonValue))
}

func main() {
	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("static"))

	mux.HandleFunc("GET /", fs.ServeHTTP)

	http.ListenAndServe(":80", mux)
}
