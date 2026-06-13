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
    "Hello! I am Aries, your AI assistant. How can I help you today?",
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
    "Aries is ready! That sounds like an exciting task. How would you like to proceed?"
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
      console.log('[Aries UI] Chat application initialized successfully');
    } catch (error) {
      console.error('[Aries UI Error] Initialization failed:', error);
    }
  });
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

  // Close Settings Dropdown clicking outside
  document.addEventListener('click', (e) => {
    if (settingsDropdown && !settingsDropdown.contains(e.target) && e.target !== settingsBtn) {
      settingsDropdown.classList.remove('active');
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
  sidebarCollapsed = !sidebarCollapsed;
  applySidebarCollapse();
  saveStateToStorage();
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
    console.error('[Aries UI Error] Failed to load state from localStorage:', error);
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
    console.error('[Aries UI Error] Failed to save state to localStorage:', error);
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
      <div class="empty-chat-icon"><i class="fa-solid fa-robot"></i></div>
      <h1 class="empty-chat-greeting">${escapeHTML(getGreetingMessage())}</h1>
      <p class="empty-chat-subtext">Aries is ready to collaborate. Type a message below to start a conversation.</p>
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
    return "Good Morning! Aries at your service.";
  } else if (hour >= 12 && hour < 17) {
    return "Good Afternoon! Aries at your service.";
  } else if (hour >= 17 && hour < 22) {
    return "Good Evening! Aries at your service.";
  } else {
    return "Aries at your service. What are we building tonight?";
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
        <button class="delete-chat-btn" aria-label="Delete Chat">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      `;
      
      // Add Click listener to select chat
      chatItem.addEventListener('click', (e) => {
        // Don't trigger select if delete button was clicked
        if (e.target.closest('.delete-chat-btn')) {
          e.stopPropagation();
          deleteChat(chat.id);
          return;
        }
        selectChat(chat.id);
        closeMobileSidebar();
      });
      
      chatHistoryList.appendChild(chatItem);
    });
  }
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
    console.error('[Aries UI Error] Failed to delete chat:', error);
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
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = sender === 'user' ? 'U' : '<i class="fa-solid fa-robot"></i>';
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMessageText(text);
  
  content.appendChild(bubble);
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(content);
  
  messagesStream.appendChild(msgDiv);
}

// Helper to format bot output with bold/code blocks
function formatMessageText(text) {
  let formatted = escapeHTML(text);
  // Simple code block replacement
  formatted = formatted.replace(/```(javascript|python|html|css)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Line break support
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
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
  messagesStream.scrollTop = messagesStream.scrollHeight;
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
  
  // Trigger Simulated Bot Response Loop
  await simulateBotResponse(text, currentChat);
}

// Simulate Typing and generate smart reply
async function simulateBotResponse(userPrompt, chatObj) {
  // Add typing bubble UI element
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot typing-wrapper';
  typingDiv.innerHTML = `
    <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
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
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
  
  // Clean up typing element
  typingDiv.remove();
  
  // Generate response content based on query keywords
  const botText = generateResponseText(userPrompt);
  const time = getShortTime();
  
  // Append bot response
  const botMsg = { sender: 'bot', text: botText, time };
  chatObj.messages.push(botMsg);
  
  // Update state & UI
  saveStateToStorage();
  appendMessageUI('bot', botText);
  scrollToBottom();
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

// Export functions for unit testing (CommonJS fallback)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateResponseText,
    escapeHTML,
    formatTimeAgo,
    getGreetingMessage
  };
}
// Export additional function for group testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports.groupChatsByDate = groupChatsByDate;
}
