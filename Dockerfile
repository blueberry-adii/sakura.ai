FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o main ./cmd/main.go

FROM alpine:3.24

WORKDIR /

COPY --from=builder /app/main /main
COPY --from=builder /app/static /static
COPY --from=builder /app/exec /exec

RUN chmod +x /exec/ollama.sh

EXPOSE 80

ENTRYPOINT [ "/main" ]