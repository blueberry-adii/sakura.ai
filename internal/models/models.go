package models

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatPayload struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type StreamResponse struct {
	Message struct {
		Role     string `json:"role"`
		Content  string `json:"content"`
		Thinking string `json:"thinking"`
	} `json:"message"`
	Done bool `json:"done"`
}
