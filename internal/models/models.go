package models

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OllamaRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"`
}

type OllamaResponse struct {
	Message struct {
		Role     string `json:"role"`
		Content  string `json:"content"`
		Thinking string `json:"thinking"`
	} `json:"message"`
	Done bool `json:"done"`
}

type Chat struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Timestamp string `json:"timestamp"`
}
