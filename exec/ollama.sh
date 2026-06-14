#!/bin/sh

OLLAMA_HOST="${OLLAMA_HOST:?Error: OLLAMA_HOST environment variable is required.}"
OLLAMA_MODEL="${OLLAMA_MODEL:?Error: OLLAMA_MODEL environment variable is required.}"

echo 'Waiting for Ollama to start...';

while ! curl -s ${OLLAMA_HOST}/api/tags > /dev/null; do sleep 2; done;

echo "Ollama is up! Pulling ${OLLAMA_MODEL} model...";

curl -X POST http://sakura:11434/api/pull -d "{\"name\": \"${OLLAMA_MODEL}\"}"