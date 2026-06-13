// Global Application State
let chats = [];
let activeChatId = null;
let sidebarCollapsed = false;
let currentTheme = 'dark';

// UI Element Selectors (lazy load if in browser context)
let sidebar, sidebarBackdrop, menuToggle, newChatBtn, chatHistoryList, messagesStream, chatInput, sendBtn, collapseSidebarBtn, settingsBtn, settingsDropdown, themeToggleCheckbox, themeIcon;

if (typeof document !== 'undefined') {
  sidebar = document.getElementById('sidebar');
  sidebarBackdrop = document.getElementById('sidebarBackdrop');
  menuToggle = document.getElementById('menuToggle');
  newChatBtn = document.getElementById('newChatBtn');
  chatHistoryList = document.getElementById('chatHistoryList');
  messagesStream = document.getElementById('messagesStream');
  chatInput = document.getElementById('chatInput');
  sendBtn = document.getElementById('sendBtn');
  collapseSidebarBtn = document.getElementById('collapseSidebarBtn');
  settingsBtn = document.getElementById('settingsBtn');
  settingsDropdown = document.getElementById('settingsDropdown');
  themeToggleCheckbox = document.getElementById('themeToggleCheckbox');
  themeIcon = document.getElementById('themeIcon');
}

// Mock responses dictionary for dynamic/contextual feel
const BOT_RESPONSES = {
  greeting: [
    "Hello! I am Sakura, your AI assistant. How can I help you today?",
    "Hi there! What can I do for you today?",
    "Greetings! I'm ready to assist. What are we working on?"
  ],
  coding: [
    "That is a great coding question! Here's a clean implementation of what you need:\n\n```javascript\n// Optimized solution\nfunction processData(input) {\n  return input.trim().toLowerCase();\n}\n```\nLet me know if you want to extend this!",
    "I can help you build that! Remember to keep your code modular and follow Clean Architecture principles, separating your controllers, services, and database layers.",
    "Sure! Let me write that for you. What language are we using, and what are the specific edge cases to consider?"
  ],
  concept: [
    "To explain that simply: imagine it like a library. The index is the database keys, and the books are the actual documents. When you query, you look at the index first instead of reading every book. Does that make sense?",
    "That's a fascinating concept. In simple terms, it works by separating the concerns into different layers, ensuring that one component doesn't need to know the implementation details of another."
  ],
  default: [
    "I understand. That's a great point! Let's explore how we can implement or solve this. Could you provide a bit more context?",
    "Interesting! I'd love to help you with that. Can you tell me more about your specific goal or constraints?",
    "Sakura is ready! That sounds like an exciting task. How would you like to proceed?"
  ]
};

// Initialize Application
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      loadStateFromStorage();
      applyTheme();
      applySidebarCollapse();
      renderSidebar();

      if (activeChatId) {
        selectChat(activeChatId);
      } else {
        showWelcomeScreen();
      }

      setupEventListeners();
      setupSakuraEffect();
      makeFaviconSquircle();
      console.log('[Sakura UI] Chat application initialized successfully');
    } catch (error) {
      console.error('[Sakura UI Error] Initialization failed:', error);
    }
  });
}

async function startChatStream(message, chatObj) {
  // Add typing bubble UI element
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot typing-wrapper';
  typingDiv.innerHTML = `
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messagesStream.appendChild(typingDiv);
  scrollToBottom();

  const url = "/api/v1/chat";
  const payload = {
    chat_id: chatObj.id,
    message: message
  };

  let botBubble = null;
  let fullBotResponseText = "";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let isDone = false;
    let accumulatedBuffer = "";

    while (!isDone) {
      const { value, done } = await reader.read();
      if (done) {
        isDone = true;
        break;
      }

      const rawChunk = decoder.decode(value, { stream: true });
      accumulatedBuffer += rawChunk;

      const lines = accumulatedBuffer.split("\n");
      accumulatedBuffer = lines.pop(); // Keep partial/incomplete line in buffer

      for (const line of lines) {
        if (line.trim().startsWith("data: ")) {
          const jsonString = line.replace("data: ", "").trim();

          try {
            const parsedData = JSON.parse(jsonString);

            console.log("Received data:", parsedData);

            if (parsedData.message && parsedData.message.content) {
              if (!botBubble) {
                // Remove typing indicator once the first chunk of content arrives
                if (typingDiv) {
                  typingDiv.remove();
                }

                if (activeChatId === chatObj.id) {
                  const msgDiv = document.createElement('div');
                  msgDiv.className = 'message bot';
                  msgDiv.innerHTML = `
                    <div class="message-content">
                      <div class="message-bubble"></div>
                    </div>
                  `;
                  messagesStream.appendChild(msgDiv);
                  botBubble = msgDiv.querySelector('.message-bubble');
                }
              }

              fullBotResponseText += parsedData.message.content;
              if (botBubble && activeChatId === chatObj.id) {
                botBubble.innerHTML = formatMessageText(fullBotResponseText);
                scrollToBottom();
              }
            }

            if (parsedData.done === true) {
              console.log("Stream marked completed by backend.");
              isDone = true;
              break;
            }
          } catch (e) {
            console.error("Error parsing mini JSON chunk:", e, "on line:", jsonString);
          }
        }
      }
    }

    // Ensure typing indicator is removed when complete
    if (typingDiv) {
      typingDiv.remove();
    }

    // Append finalized bot response to memory state and save
    const botMsg = { sender: 'bot', text: fullBotResponseText, time: getShortTime() };
    chatObj.messages.push(botMsg);
    saveStateToStorage();

  } catch (error) {
    console.error("Failed to fetch or parse the stream:", error);
    if (typingDiv) {
      typingDiv.remove();
    }
    const errorMsgText = "Sorry, I encountered an error connecting to the Sakura service. Please ensure the backend is running.";
    if (activeChatId === chatObj.id) {
      appendMessageUI('bot', errorMsgText);
      scrollToBottom();
    }
    chatObj.messages.push({ sender: 'bot', text: errorMsgText, time: getShortTime() });
    saveStateToStorage();
  }
}

// Event Listeners Configuration
function setupEventListeners() {
  // Mobile Sidebar Toggle
  menuToggle.addEventListener('click', toggleMobileSidebar);
  sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Desktop/General Collapse Toggle
  collapseSidebarBtn.addEventListener('click', toggleSidebarCollapse);

  // Settings Panel Toggle
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle('active');
  });

  // Close Dropdowns clicking outside
  document.addEventListener('click', (e) => {
    if (settingsDropdown && !settingsDropdown.contains(e.target) && e.target !== settingsBtn) {
      settingsDropdown.classList.remove('active');
    }
    if (!e.target.closest('.chat-options-btn') && !e.target.closest('.chat-options-dropdown')) {
      document.querySelectorAll('.chat-options-dropdown').forEach(d => {
        d.classList.remove('active');
      });
    }
  });

  // Theme Toggle Switch
  themeToggleCheckbox.addEventListener('change', () => {
    currentTheme = themeToggleCheckbox.checked ? 'dark' : 'light';
    applyTheme();
    saveStateToStorage();
  });

  // New Chat Action
  newChatBtn.addEventListener('click', () => {
    startNewChat();
    closeMobileSidebar();
  });

  // Textarea Auto-growth & Keyboard Submissions
  chatInput.addEventListener('input', autoResizeTextarea);
  chatInput.addEventListener('keydown', handleKeydown);

  // Message Send Buttons
  sendBtn.addEventListener('click', handleSendMessage);
}

// Mobile Sidebar Drawer Control
function toggleMobileSidebar() {
  sidebar.classList.toggle('open');
  sidebarBackdrop.classList.toggle('active');
}

function closeMobileSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('active');
}

// Desktop Collapsible Sidebar Control
function toggleSidebarCollapse() {
  if (window.innerWidth <= 768) {
    closeMobileSidebar();
  } else {
    sidebarCollapsed = !sidebarCollapsed;
    applySidebarCollapse();
    saveStateToStorage();
  }
}

function applySidebarCollapse() {
  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
  } else {
    sidebar.classList.remove('collapsed');
  }
}

// Theme Switcher Control
function applyTheme() {
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    if (themeToggleCheckbox) {
      themeToggleCheckbox.checked = false; // Unchecked for Light mode
    }
    if (themeIcon) {
      themeIcon.className = 'fa-regular fa-sun';
    }
  } else {
    document.body.classList.remove('light-theme');
    if (themeToggleCheckbox) {
      themeToggleCheckbox.checked = true; // Checked for Dark mode
    }
    if (themeIcon) {
      themeIcon.className = 'fa-regular fa-moon';
    }
  }
}

// Textarea auto-resize helper
function autoResizeTextarea() {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${chatInput.scrollHeight}px`;
}

// Enter key submit handling
function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

// Load/Save state from LocalStorage
function loadStateFromStorage() {
  try {
    const savedChats = localStorage.getItem('aries_chats');
    const savedActiveChat = localStorage.getItem('aries_active_chat_id');
    const savedTheme = localStorage.getItem('aries_theme');
    const savedCollapse = localStorage.getItem('aries_sidebar_collapsed');

    if (savedChats) {
      chats = JSON.parse(savedChats);
    }
    if (savedActiveChat) {
      activeChatId = savedActiveChat;
    }
    if (savedTheme) {
      currentTheme = savedTheme;
    }
    if (savedCollapse) {
      sidebarCollapsed = savedCollapse === 'true';
    }
  } catch (error) {
    console.error('[Sakura UI Error] Failed to load state from localStorage:', error);
    chats = [];
    activeChatId = null;
    currentTheme = 'dark';
    sidebarCollapsed = false;
  }
}

function saveStateToStorage() {
  try {
    localStorage.setItem('aries_chats', JSON.stringify(chats));
    localStorage.setItem('aries_active_chat_id', activeChatId || '');
    localStorage.setItem('aries_theme', currentTheme);
    localStorage.setItem('aries_sidebar_collapsed', sidebarCollapsed.toString());
  } catch (error) {
    console.error('[Sakura UI Error] Failed to save state to localStorage:', error);
  }
}

// Start a new blank chat
function startNewChat() {
  activeChatId = null;
  showWelcomeScreen();
  chatInput.focus();
}

// Switch UI into Welcome Overlay (Inline Empty Greeting State)
function showWelcomeScreen() {
  messagesStream.innerHTML = `
    <div class="empty-chat-state">
      <h1 class="empty-chat-greeting">${escapeHTML(getGreetingMessage())}</h1>
      <p class="empty-chat-subtext">Sakura is ready to collaborate. Type a message below to start a conversation.</p>
    </div>
  `;

  // Highlight nothing in sidebar
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
}

// Dynamic hourly greeting logic
function getGreetingMessage(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) {
    return "Good Morning! Sakura at your service.";
  } else if (hour >= 12 && hour < 17) {
    return "Good Afternoon! Sakura at your service.";
  } else if (hour >= 17 && hour < 22) {
    return "Good Evening! Sakura at your service.";
  } else {
    return "Sakura at your service. What are we building tonight?";
  }
}

// Date grouping helper
function groupChatsByDate(sortedChats) {
  const groups = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  sortedChats.forEach(chat => {
    const chatDate = new Date(chat.timestamp);
    chatDate.setHours(0, 0, 0, 0);

    let groupName = "";
    if (chatDate.getTime() === today.getTime()) {
      groupName = "Today";
    } else if (chatDate.getTime() === yesterday.getTime()) {
      groupName = "Yesterday";
    } else {
      // Format as "D Month YYYY" (e.g. "11 June 2026")
      groupName = chatDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(chat);
  });

  return groups;
}

// Render the sidebar history list
function renderSidebar() {
  chatHistoryList.innerHTML = '';

  // Sort chats by timestamp descending
  const sortedChats = [...chats].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (sortedChats.length === 0) {
    const emptyMsg = document.createElement('li');
    emptyMsg.style.padding = 'var(--spacing-md)';
    emptyMsg.style.color = 'var(--color-text-muted)';
    emptyMsg.style.fontSize = 'var(--font-sm)';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.textContent = 'No past chats';
    chatHistoryList.appendChild(emptyMsg);
    return;
  }

  const groups = groupChatsByDate(sortedChats);

  for (const [groupName, groupChats] of Object.entries(groups)) {
    // Render group header
    const headerItem = document.createElement('li');
    headerItem.className = 'sidebar-date-group-header';
    headerItem.textContent = groupName;
    chatHistoryList.appendChild(headerItem);

    // Render each simplified chat card in this group
    groupChats.forEach(chat => {
      const chatItem = document.createElement('li');
      chatItem.className = `chat-item ${chat.id === activeChatId ? 'active' : ''}`;
      chatItem.dataset.id = chat.id;

      chatItem.innerHTML = `
        <div class="chat-item-details">
          <div class="chat-item-title">${escapeHTML(chat.title)}</div>
        </div>
        <button class="chat-options-btn" aria-label="Chat Options">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>
        <div class="chat-options-dropdown">
          <button class="options-dropdown-item rename-opt">
            <i class="fa-regular fa-pen-to-square"></i> Rename
          </button>
          <button class="options-dropdown-item delete-opt">
            <i class="fa-regular fa-trash-can"></i> Delete
          </button>
        </div>
      `;

      // Touch events for mobile long press
      let touchTimer = null;
      let isLongPress = false;

      chatItem.addEventListener('touchstart', (e) => {
        if (e.target.closest('.chat-options-btn') || e.target.closest('.chat-options-dropdown')) {
          return;
        }
        isLongPress = false;
        touchTimer = setTimeout(() => {
          isLongPress = true;
          openChatOptions(chat.id, chatItem);
        }, 600);
      });

      chatItem.addEventListener('touchend', (e) => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
        if (isLongPress) {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      chatItem.addEventListener('touchmove', () => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      });

      // Bind context popover actions
      const renameOpt = chatItem.querySelector('.rename-opt');
      const deleteOpt = chatItem.querySelector('.delete-opt');
      const optionsBtn = chatItem.querySelector('.chat-options-btn');
      const dropdown = chatItem.querySelector('.chat-options-dropdown');

      if (optionsBtn) {
        optionsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openChatOptions(chat.id, chatItem);
        });
      }

      renameOpt.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        renameChatInline(chat.id, chatItem);
      });

      deleteOpt.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('active');
        deleteChat(chat.id);
      });

      // Click select chat
      chatItem.addEventListener('click', (e) => {
        if (e.target.closest('.chat-options-btn') || e.target.closest('.chat-options-dropdown')) {
          return;
        }
        selectChat(chat.id);
        closeMobileSidebar();
      });

      chatHistoryList.appendChild(chatItem);
    });
  }
}

// Open options dropdown for a chat item
function openChatOptions(chatId, chatItemElement) {
  document.querySelectorAll('.chat-options-dropdown').forEach(d => {
    d.classList.remove('active');
  });

  const dropdown = chatItemElement.querySelector('.chat-options-dropdown');
  if (dropdown) {
    dropdown.classList.add('active');
  }
}

// Rename conversation inline edit text box
function renameChatInline(id, chatItemElement) {
  const chat = chats.find(c => c.id === id);
  if (!chat) return;

  const titleEl = chatItemElement.querySelector('.chat-item-title');
  if (!titleEl) return;

  if (chatItemElement.querySelector('.chat-rename-input')) return;

  const currentTitle = chat.title;
  const detailsEl = chatItemElement.querySelector('.chat-item-details');

  titleEl.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-rename-input';
  input.value = currentTitle;
  detailsEl.appendChild(input);

  input.focus();
  input.select();

  let finished = false;

  function finishRename(save) {
    if (finished) return;
    finished = true;

    const val = input.value.trim();
    if (save && val && val !== currentTitle) {
      chat.title = val;
      saveStateToStorage();
    }

    input.remove();
    titleEl.style.display = 'block';
    renderSidebar();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      finishRename(true);
    } else if (e.key === 'Escape') {
      finishRename(false);
    }
  });

  input.addEventListener('blur', () => {
    finishRename(true);
  });

  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Select a specific chat by ID
function selectChat(id) {
  const selectedChat = chats.find(c => c.id === id);
  if (!selectedChat) {
    showWelcomeScreen();
    return;
  }

  activeChatId = id;
  saveStateToStorage();
  renderSidebar();
  renderMessages(selectedChat.messages);
}

// Delete a chat by ID
function deleteChat(id) {
  try {
    chats = chats.filter(c => c.id !== id);
    if (activeChatId === id) {
      activeChatId = chats.length > 0 ? chats[0].id : null;
    }

    saveStateToStorage();
    renderSidebar();

    if (activeChatId) {
      selectChat(activeChatId);
    } else {
      showWelcomeScreen();
    }
  } catch (error) {
    console.error('[Sakura UI Error] Failed to delete chat:', error);
  }
}

// Render message array to the stream
function renderMessages(messages) {
  messagesStream.innerHTML = '';

  if (messages.length === 0) {
    showWelcomeScreen();
    return;
  }

  messages.forEach(msg => {
    appendMessageUI(msg.sender, msg.text);
  });
  scrollToBottom();
}

// Create a new message bubble elements (Timestamp displays removed completely)
function appendMessageUI(sender, text) {
  // Clear empty state if visible
  const emptyState = messagesStream.querySelector('.empty-chat-state');
  if (emptyState) {
    emptyState.remove();
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;

  const content = document.createElement('div');
  content.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMessageText(text);

  content.appendChild(bubble);
  msgDiv.appendChild(content);

  messagesStream.appendChild(msgDiv);
}

// Helper to format bot output with standard Markdown elements (headers, lists, bold, inline code, and code blocks)
function formatMessageText(text) {
  // 1. Escape HTML to prevent XSS (done first so we can safely inject HTML tags later)
  let escaped = escapeHTML(text);

  // 2. Extract and format multi-line code blocks to shield them from inline formatting
  const codeBlocks = [];
  escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
    codeBlocks.push(`<pre class="code-block ${lang ? 'lang-' + lang : ''}"><code>${code}</code></pre>`);
    return placeholder;
  });

  // 3. Parse headers (###, ##, #)
  escaped = escaped.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  escaped = escaped.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  escaped = escaped.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // 4. Inline code blocks (`code`)
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 5. Bold & Italics
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 6. Indent-aware List Parser
  const lines = escaped.split('\n');
  const parsedLines = [];
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)$/);
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

    if (bulletMatch || numMatch) {
      const indent = (bulletMatch ? bulletMatch[1] : numMatch[1]).length;
      const type = bulletMatch ? 'ul' : 'ol';
      const content = bulletMatch ? bulletMatch[3] : numMatch[3];

      // Close sub-lists that have greater indentation than the current list item
      while (stack.length > 0 && stack[stack.length - 1].indent > indent) {
        const closed = stack.pop();
        parsedLines.push(`</${closed.type}>`);
      }

      if (stack.length > 0 && stack[stack.length - 1].indent === indent) {
        if (stack[stack.length - 1].type !== type) {
          const closed = stack.pop();
          parsedLines.push(`</${closed.type}>`);
          parsedLines.push(`<${type}>`);
          stack.push({ type, indent });
        } else {
          parsedLines.push('</li>');
        }
      } else {
        parsedLines.push(`<${type}>`);
        stack.push({ type, indent });
      }

      parsedLines.push(`<li>${content}`);
    } else {
      // Line is not a list item: close all currently open list scopes
      while (stack.length > 0) {
        const closed = stack.pop();
        parsedLines.push(`</li></${closed.type}>`);
      }
      parsedLines.push(line);
    }
  }

  while (stack.length > 0) {
    const closed = stack.pop();
    parsedLines.push(`</li></${closed.type}>`);
  }

  escaped = parsedLines.join('\n');

  // 7. Line breaks (preserve inside list items or general paragraphs)
  escaped = escaped.replace(/\n/g, '<br>');

  // Clean up duplicate breaks near block and list elements to prevent unwanted empty spaces
  escaped = escaped.replace(/<\/(ul|ol|pre|h1|h2|h3|li)><br>/g, '</$1>');
  escaped = escaped.replace(/<br><(ul|ol|pre|h1|h2|h3|li)>/g, '<$1>');
  escaped = escaped.replace(/<(ul|ol)><br>/g, '<$1>');
  escaped = escaped.replace(/<br><\/(ul|ol)>/g, '</$1>');

  // 9. Restore code blocks
  codeBlocks.forEach((html, index) => {
    escaped = escaped.replace(`__CODE_BLOCK_PLACEHOLDER_${index}__`, html);
  });

  return escaped;
}

// Generate human-friendly timestamp
function getShortTime() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Format relative dates for sidebar list
function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// HTML Escaping Utility
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Scroll messages pane to bottom
function scrollToBottom() {
  if (messagesStream) {
    messagesStream.scrollTop = messagesStream.scrollHeight;
  }
}

// Dynamically generate a squircle favicon using the brand asset and theme gradient
function makeFaviconSquircle() {
  if (typeof document === 'undefined') return;
  const img = new Image();
  img.src = 'assets/sakura.png';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background squircle mask
    ctx.beginPath();
    const r = 16; // Rounded corner radius for squircle look
    ctx.moveTo(r, 0);
    ctx.lineTo(64 - r, 0);
    ctx.quadraticCurveTo(64, 0, 64, r);
    ctx.lineTo(64, 64 - r);
    ctx.quadraticCurveTo(64, 64, 64 - r, 64);
    ctx.lineTo(r, 64);
    ctx.quadraticCurveTo(0, 64, 0, 64 - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();

    // Fill with theme's user message gradient
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, '#ff758f');
    gradient.addColorStop(1, '#ff4d6d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    // Draw the sakura logo in the center
    const iconSize = 44;
    const offset = (64 - iconSize) / 2;
    ctx.drawImage(img, offset, offset, iconSize, iconSize);

    // Set favicon href
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL('image/png');
  };
}

// Core action: Send User Message & Handle Bot Cycle
async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Create active chat if one isn't currently open
  if (!activeChatId) {
    const newId = 'chat_' + Date.now();
    const newChat = {
      id: newId,
      title: text.length > 25 ? text.substring(0, 25) + '...' : text,
      timestamp: new Date().toISOString(),
      messages: []
    };
    chats.push(newChat);
    activeChatId = newId;
    messagesStream.innerHTML = ''; // clear greeting state
  }

  const currentChat = chats.find(c => c.id === activeChatId);
  const time = getShortTime();

  // Append user message
  const userMsg = { sender: 'user', text, time };
  currentChat.messages.push(userMsg);
  currentChat.timestamp = new Date().toISOString();

  // Update UI & Storage
  saveStateToStorage();
  renderSidebar();
  appendMessageUI('user', text);
  scrollToBottom();

  // Trigger Chat Stream Response Loop
  await startChatStream(text, currentChat);
}

// Pure response generator helper
function generateResponseText(prompt) {
  const query = prompt.toLowerCase();

  if (query.includes('hello') || query.includes('hi') || query.includes('greetings')) {
    const list = BOT_RESPONSES.greeting;
    return list[Math.floor(Math.random() * list.length)];
  }

  if (query.includes('code') || query.includes('python') || query.includes('javascript') || query.includes('function') || query.includes('program')) {
    const list = BOT_RESPONSES.coding;
    return list[Math.floor(Math.random() * list.length)];
  }

  if (query.includes('explain') || query.includes('concept') || query.includes('quantum') || query.includes('why')) {
    const list = BOT_RESPONSES.concept;
    return list[Math.floor(Math.random() * list.length)];
  }

  const list = BOT_RESPONSES.default;
  return list[Math.floor(Math.random() * list.length)];
}

// Dynamic Sakura Falling Petals canvas simulation
function setupSakuraEffect() {
  if (typeof document === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.id = 'sakura-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const petalCount = 40;
  const petals = [];

  class Petal {
    constructor() {
      this.reset();
      this.y = Math.random() * height; // Distribute initial petals vertically
    }

    reset() {
      this.x = Math.random() * width;
      this.y = -20;
      this.r = 5 + Math.random() * 6; // Petal size
      this.d = 1.0 + Math.random() * 1.2; // Fall speed
      this.drift = -0.4 + Math.random() * 0.8; // Horizontal wind drift
      this.opacity = 0.35 + Math.random() * 0.4;
      this.angle = Math.random() * Math.PI * 2;
      this.angleSpeed = 0.01 + Math.random() * 0.015;
      this.flip = Math.random();
      this.flipSpeed = 0.01 + Math.random() * 0.02;
    }

    update() {
      this.y += this.d;
      this.x += this.drift + Math.sin(this.angle) * 0.3;
      this.angle += this.angleSpeed;
      this.flip += this.flipSpeed;

      if (this.y > height + 20 || this.x < -20 || this.x > width + 20) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.scale(Math.sin(this.flip), 1); // Simulate 3D flipping

      ctx.beginPath();
      // Draw classic cherry blossom curved petal shape
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(this.r * 0.8, -this.r * 1.2, this.r * 1.5, 0);
      ctx.quadraticCurveTo(this.r * 0.8, this.r * 1.2, 0, 0);

      ctx.fillStyle = `rgba(255, 117, 143, ${this.opacity})`;
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < petalCount; i++) {
    petals.push(new Petal());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    petals.forEach(petal => {
      petal.update();
      petal.draw();
    });
    requestAnimationFrame(animate);
  }

  animate();
}

// Export functions for unit testing (CommonJS fallback)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateResponseText,
    escapeHTML,
    formatTimeAgo,
    getGreetingMessage,
    formatMessageText
  };
}
// Export additional function for group testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports.groupChatsByDate = groupChatsByDate;
}
