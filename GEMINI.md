# RULES

You are the dedicated AI Engineer for this project. This file overrides your default coding behaviors. You must ingest and strictly adhere to these rules to ensure our codebase remains grounded, hyper-efficient, and maintainable. 

---

## 1. Core Coding Philosophy
*   **Keep it Grounded:** Write pragmatic, readable code over clever, deeply nested abstractions.
*   **No Half-Measures:** Never use placeholders like `// TODO: implement later` or `// ... rest of code`. Write the complete, production-ready implementation unless explicitly asked to draft.
*   **Cleanliness:** Do not use uneccessary comments, write documentation only where necessary.

---

## 2. Architecture & Patterns
Follow these structural rules blindly. If a request violates these, warn me before writing code.

*   **Separation of Concerns:** Do not mix up code and maintain strict code hierarchy.
*   **File Structure:** Adhere strictly to a feature based folder structure.
*   **Design Tokens:** Never hardcode hex values or spacing pixels. Always use tailwind/CSS variables (e.g., `var(--color-primary)`).
*   **Architecture:** Strictly follow MVC Clean Architecture for Backend, Controller, Service and Database Layers and Dependency Injections.

---

## 3. "Antigravity" Constraints (What NOT to do)
To prevent code drift and AI hallucinations, you are strictly forbidden from:
1.  **Installing Unsanctioned Dependencies:** Do not import or suggest new npm/pip packages without asking first. Use native APIs or existing dependencies.
2.  **Over-Engineering:** Do not create interfaces or classes for single-use functions. 
3.  **Silent Failures:** Always wrap asynchronous calls in clean try/catch blocks with structured logging.

---

## 4. Response & Output Format
When generating code or responding in the chat/terminal:

*   **Brief Explanations:** Give me the code first. Explain *why* you made a choice in 2 sentences or less below the code block.
*   **Diff-Friendly:** When updating existing files, provide the exact file path and use clear markdown code blocks, or show standard unified diff format if the file is large.
*   **Review Checklist:** End your major code generations with a 3-bullet-point "Risk Assessment" (e.g., performance impact, breaking changes, edge cases).
*   **History:** Save important information, context and checkpoints in History section.
*   **New Rules**: Learn New Rules from User Prompts and add them to this file.

---

## 5. Testing & Verification
*   Every new feature or bug fix must come with a corresponding unit test file (`*.test.js` / `*.test.go`).
*   Mock all network requests and external API calls by default.

---

> **SYSTEM NOTE:** Read this file at the start of every session. If you understand these rules and are ready to maintain the codebase, reply acknowledging your specific constraints.

---

# HISTORY

- **2026-06-13**: Created the AI Chatbot frontend under the `static/` directory using vanilla HTML, CSS variables, and Javascript.
  - Implemented glassmorphism layout, collapsible mobile drawer, and localStorage state synchronization.
  - Added a node-based test suite (`static/script.test.js`) verifying DOM-free string escaping, date formatting, and keyword classification.
  - Refined UI layout with a collapsible sidebar toggle, light/dark theme modes, pastel reddish-pink/red styling, and dynamic hourly greeting rotations.
  - Resolved sidebar collapse expand visibility, text wrap wrapping on empty states, and brand letter transparency.
  - Replaced the direct theme toggle with a profile settings dropdown card featuring user profile info and check switches.
  - Unified color scheme, hid past chats inside collapsed sidebars, dynamically categorized chats by calendar date groups, styled input text area gradient blurs, centered sending alignment, and removed message bubble timestamps.
  - Restored distinct soft pastel light mode styling variables and component overrides (sidebar, header, input boxes) for proper visibility.
  - Added a dynamic HTML5 Canvas cherry blossom falling animation and enhanced ambient dark-mode background glow.
  - Added slide/fade transitions for mobile sidebar drawer collapse and expand states.
  - Resolved stacking index overlaps on mobile view, ensuring the sidebar header elements render sharply on top of the main header blur.
  - Updated mobile collapse toggle to close the drawer overlay and slide it away cleanly.
  - Implemented desktop hover options button (3-dot vertical ellipsis) revealing a popover context dropdown.
  - Created touch start/move/end gesture timers to capture mobile 600ms long-press inputs, displaying Rename and Delete actions.
  - Fixed overflow clipping on chat cards to display option popover dropdowns completely outside card boundaries.
  - Replaced native browser dialog prompt with inline renaming input text box inside the sidebar chat cards.
  - Integrated real-time chat response streaming from Go backend using `/api/v1/chat` Server-Sent Events.
  - Added collapsible agent thought process container showing active reasoning logs with manual expansion dropdown button.
  - Added formatting support for bold markdown notation `**text**` with custom styled theme highlights.
- **2026-06-14**: Replaced text-based sidebar logo with `sakura.png` brand asset using `object-fit: contain`.
  - Added a dynamic HTML Canvas squircle favicon generator that clips `sakura.png` over the signature pink-red theme gradient and injects it as a base64 Data URL.
  - Integrated MySQL database-backed message history retrieval and storage within the Go backend (`cmd/main.go`, `internal/services/chatService.go`).
  - Synced frontend client requests to send unique conversation `chat_id` keys to target session context.
  - Implemented database-backed CRUD synchronization for listing (`GET`), renaming (`PUT`), and deleting (`DELETE`) chat sessions.
  - Fixed undefined currentChat exception in handleSendMessage by resetting activeChatId when a selected chat is not found on the server, and automatically creating a fallback session.

  - Implemented custom Markdown parsing in `static/script.js` to render headers, bullet points, numbered lists, inline code, and code blocks natively.
  - Refined list parser to be indent-aware and support nested bullet points under numbered list items.
  - Removed user and bot message avatar icons from message bubbles and cleaned up the corresponding css.
  - Removed the floating robot greeting icon from the empty chat welcome screen layout.




