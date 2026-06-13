package main

import "net/http"

func main() {
	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("static"))

	mux.HandleFunc("GET /", fs.ServeHTTP)

	http.ListenAndServe(":80", mux)
}
