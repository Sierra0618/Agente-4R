/**
 * Microsoft AI Foundry Agent Studio - Frontend Client Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const chatMessages = document.getElementById("chatMessages");
  const welcomeScreen = document.getElementById("welcomeScreen");
  const chatTextarea = document.getElementById("chatTextarea");
  const btnSend = document.getElementById("btnSend");
  const btnNewChat = document.getElementById("btnNewChat");
  const conversationsList = document.getElementById("conversationsList");
  const btnClearChat = document.getElementById("btnClearChat");
  const btnExportChat = document.getElementById("btnExportChat");
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const sidebar = document.getElementById("sidebar");
  const btnSidebarToggle = document.getElementById("btnSidebarToggle");
  const agentNameEls = document.querySelectorAll(".dynamic-agent-name");
  const agentEndpointEl = document.getElementById("agentEndpoint");

  // Matrix Modal Elements
  const matrixModal = document.getElementById("matrixModal");
  const btnOpenMatrixModal = document.getElementById("btnOpenMatrixModal");
  const btnMatrixModalTop = document.getElementById("btnMatrixModalTop");
  const btnCloseModal = document.getElementById("btnCloseModal");

  // State
  let currentConversationId = null;
  let isGenerating = false;
  let conversations = []; // { id, title, conversation_id, messages: [ { role, text, time } ] }

  // Initialize
  initApp();

  function initApp() {
    loadStoredConversations();
    fetchAgentInfo();
    setupEventListeners();
    renderConversationList();

    if (conversations.length > 0) {
      loadConversation(conversations[0].id);
    } else {
      startNewConversation();
    }
  }

  // Fetch Agent Info
  async function fetchAgentInfo() {
    try {
      const res = await fetch("/api/agent-info");
      if (res.ok) {
        const data = await res.json();
        agentNameEls.forEach(el => el.textContent = data.agent_name || "Jesus-Sierra");
        if (agentEndpointEl) {
          const url = new URL(data.endpoint);
          agentEndpointEl.textContent = url.hostname;
          agentEndpointEl.title = data.endpoint;
        }
      }
    } catch (e) {
      console.warn("Could not fetch agent info", e);
    }
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Send button
    btnSend.addEventListener("click", () => {
      const text = chatTextarea.value.trim();
      if (text && !isGenerating) {
        sendMessage(text);
      }
    });

    // Enter to send, Shift+Enter for newline
    chatTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = chatTextarea.value.trim();
        if (text && !isGenerating) {
          sendMessage(text);
        }
      }
    });

    // Matrix Modal open/close
    const openModal = () => matrixModal?.classList.add("open");
    const closeModal = () => matrixModal?.classList.remove("open");

    btnOpenMatrixModal?.addEventListener("click", openModal);
    btnMatrixModalTop?.addEventListener("click", openModal);
    btnCloseModal?.addEventListener("click", closeModal);
    matrixModal?.addEventListener("click", (e) => {
      if (e.target === matrixModal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && matrixModal?.classList.contains("open")) {
        closeModal();
      }
    });

    // Interactive cells in Matrix Table
    document.querySelectorAll(".matrix-table tbody tr").forEach((row) => {
      const actionName = row.querySelector("td strong")?.textContent || "";
      row.querySelectorAll("td").forEach((cell, idx) => {
        if (idx === 0) return;
        const questions = ["Por que", "Como", "Quem", "O que", "Onde", "Quando"];
        const qName = questions[idx - 1] || "Contexto";
        cell.style.cursor = "pointer";
        cell.title = `Clique para explorar "${actionName}" com a pergunta "${qName}"`;
        cell.addEventListener("click", () => {
          closeModal();
          const prompt = `Analise sob a ótica da Ação Cognitiva [${actionName}] respondendo à pergunta [${qName}]: avalie as 4 Dimensões (Recursos, Relacionamentos, Rumo, Resultados) para o nosso cenário operacional.`;
          chatTextarea.value = prompt;
          sendMessage(prompt);
        });
      });
    });


    // Textarea Auto-Resize
    chatTextarea.addEventListener("input", () => {
      chatTextarea.style.height = "auto";
      chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 180) + "px";
      btnSend.disabled = chatTextarea.value.trim().length === 0 || isGenerating;
    });

    // New Chat Button
    btnNewChat.addEventListener("click", () => {
      startNewConversation();
      if (window.innerWidth <= 900) {
        sidebar.classList.remove("open");
      }
    });

    // Clear Chat
    btnClearChat.addEventListener("click", () => {
      if (confirm("Deseja realmente limpar as mensagens desta conversa?")) {
        const active = getActiveConversation();
        if (active) {
          active.messages = [];
          active.conversation_id = null;
          saveConversations();
          renderMessages();
          showToast("Conversa limpa com sucesso.");
        }
      }
    });

    // Export Chat
    btnExportChat.addEventListener("click", () => {
      exportCurrentChat();
    });

    // Mobile Sidebar Toggle
    btnSidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    // Suggestion Cards click
    document.querySelectorAll(".suggestion-card").forEach((card) => {
      card.addEventListener("click", () => {
        const prompt = card.getAttribute("data-prompt");
        if (prompt && !isGenerating) {
          chatTextarea.value = prompt;
          sendMessage(prompt);
        }
      });
    });
  }

  // Conversation Management
  function loadStoredConversations() {
    try {
      const data = localStorage.getItem("foundry_agent_conversations");
      if (data) {
        conversations = JSON.parse(data);
      }
    } catch (e) {
      conversations = [];
    }
  }

  function saveConversations() {
    try {
      localStorage.setItem("foundry_agent_conversations", JSON.stringify(conversations));
    } catch (e) {
      console.error("Storage error", e);
    }
  }

  function getActiveConversation() {
    return conversations.find((c) => c.id === currentConversationId);
  }

  function startNewConversation() {
    const newId = "conv_" + Date.now();
    const newConv = {
      id: newId,
      title: "Nova Conversa",
      conversation_id: null, // Azure AI conversation ID
      messages: [],
      createdAt: new Date().toISOString()
    };
    conversations.unshift(newConv);
    saveConversations();
    currentConversationId = newId;
    renderConversationList();
    renderMessages();
    chatTextarea.focus();
  }

  function loadConversation(id) {
    currentConversationId = id;
    renderConversationList();
    renderMessages();
    if (window.innerWidth <= 900) {
      sidebar.classList.remove("open");
    }
  }

  function deleteConversation(id, event) {
    event.stopPropagation();
    if (confirm("Excluir esta conversa?")) {
      conversations = conversations.filter(c => c.id !== id);
      saveConversations();
      if (currentConversationId === id) {
        if (conversations.length > 0) {
          loadConversation(conversations[0].id);
        } else {
          startNewConversation();
        }
      } else {
        renderConversationList();
      }
      showToast("Conversa excluída.");
    }
  }

  function renderConversationList() {
    conversationsList.innerHTML = "";
    conversations.forEach((conv) => {
      const item = document.createElement("div");
      item.className = `history-item ${conv.id === currentConversationId ? "active" : ""}`;
      item.innerHTML = `
        <div class="history-item-content">
          <span class="history-item-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </span>
          <span class="history-item-title" title="${escapeHtml(conv.title)}">${escapeHtml(conv.title)}</span>
        </div>
        <button class="btn-delete-conv" title="Excluir conversa">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      item.addEventListener("click", () => loadConversation(conv.id));
      item.querySelector(".btn-delete-conv").addEventListener("click", (e) => deleteConversation(conv.id, e));
      conversationsList.appendChild(item);
    });
  }

  // Render Messages
  function renderMessages() {
    const active = getActiveConversation();
    if (!active || active.messages.length === 0) {
      welcomeScreen.style.display = "block";
      // Clear dynamic message rows
      const rows = chatMessages.querySelectorAll(".message-row, .typing-row");
      rows.forEach(r => r.remove());
      return;
    }

    welcomeScreen.style.display = "none";
    // Clear only message rows
    const rows = chatMessages.querySelectorAll(".message-row, .typing-row");
    rows.forEach(r => r.remove());

    active.messages.forEach(msg => {
      appendMessageToDOM(msg.role, msg.text, msg.time, false);
    });

    scrollToBottom();
  }

  function appendMessageToDOM(role, text, time, shouldScroll = true) {
    welcomeScreen.style.display = "none";
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const isAgent = role === "agent";
    const avatar = isAgent ? "JS" : "EU";
    const formattedHtml = isAgent ? formatMarkdown(text) : escapeHtml(text).replace(/\n/g, "<br>");

    row.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content-wrapper">
        <div class="message-bubble">
          ${formattedHtml}
        </div>
        <div class="message-actions">
          <span class="message-time">${time || getCurrentTime()}</span>
          ${isAgent ? `
            <button class="btn-msg-copy" title="Copiar resposta">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copiar
            </button>
          ` : ""}
        </div>
      </div>
    `;

    if (isAgent) {
      const copyBtn = row.querySelector(".btn-msg-copy");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(text).then(() => {
            showToast("Texto copiado para a área de transferência!");
          });
        });
      }

      // Add copy buttons to any pre/code blocks
      row.querySelectorAll("pre").forEach(pre => {
        const preCopy = document.createElement("button");
        preCopy.className = "btn-msg-copy";
        preCopy.style.position = "absolute";
        preCopy.style.top = "8px";
        preCopy.style.right = "8px";
        preCopy.innerHTML = "Copiar Código";
        preCopy.onclick = () => {
          const code = pre.querySelector("code")?.innerText || pre.innerText;
          navigator.clipboard.writeText(code).then(() => showToast("Código copiado!"));
        };
        pre.appendChild(preCopy);
      });
    }

    chatMessages.appendChild(row);
    if (shouldScroll) {
      scrollToBottom();
    }
  }

  // Send Message Logic
  async function sendMessage(text) {
    if (isGenerating) return;

    const active = getActiveConversation();
    if (!active) return;

    const userTime = getCurrentTime();

    // 1. Append User message
    active.messages.push({ role: "user", text, time: userTime });

    // Update conversation title if first message
    if (active.messages.length === 1) {
      active.title = text.slice(0, 32) + (text.length > 32 ? "..." : "");
      renderConversationList();
    }

    appendMessageToDOM("user", text, userTime);
    saveConversations();

    // Clear and reset textarea
    chatTextarea.value = "";
    chatTextarea.style.height = "auto";
    btnSend.disabled = true;

    // Show Typing Indicator
    isGenerating = true;
    showTypingIndicator();

    try {
      const payload = {
        message: text,
        conversation_id: active.conversation_id || null,
        is_first_message: active.messages.length <= 1
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erro do servidor (${response.status})`);
      }

      const data = await response.json();
      removeTypingIndicator();

      // Update active azure conversation ID
      active.conversation_id = data.conversation_id;

      const agentTime = getCurrentTime();
      active.messages.push({ role: "agent", text: data.reply, time: agentTime });
      saveConversations();

      appendMessageToDOM("agent", data.reply, agentTime);
    } catch (err) {
      removeTypingIndicator();
      console.error("Chat error:", err);
      const errorMsg = `Não foi possível obter resposta do agente no Microsoft Foundry: ${err.message}`;
      appendMessageToDOM("agent", errorMsg, getCurrentTime());
      showToast("Erro ao comunicar com o agente.");
    } finally {
      isGenerating = false;
      btnSend.disabled = chatTextarea.value.trim().length === 0;
      chatTextarea.focus();
    }
  }

  // Typing Indicator
  function showTypingIndicator() {
    const row = document.createElement("div");
    row.className = "typing-row";
    row.id = "typingIndicator";
    row.innerHTML = `
      <div class="message-avatar" style="background: var(--azure-gradient); color: #fff;">JS</div>
      <div class="typing-bubble">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <span class="typing-text">Jesus-Sierra está pensando...</span>
      </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById("typingIndicator");
    if (el) el.remove();
  }

  // Utilities
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function showToast(message) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  function exportCurrentChat() {
    const active = getActiveConversation();
    if (!active || active.messages.length === 0) {
      showToast("Nenhuma mensagem para exportar.");
      return;
    }

    let textContent = `# Conversa com ${active.title}\n`;
    textContent += `Data: ${new Date().toLocaleString()}\n`;
    textContent += `Azure Conversation ID: ${active.conversation_id || "N/A"}\n\n`;

    active.messages.forEach(m => {
      textContent += `[${m.time}] ${m.role === "agent" ? "Jesus-Sierra" : "Você"}:\n${m.text}\n\n`;
    });

    const blob = new Blob([textContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversa-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Conversa exportada com sucesso!");
  }

  function escapeHtml(string) {
    return String(string)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Simple Markdown Parser
  function formatMarkdown(text) {
    if (!text) return "";
    let html = escapeHtml(text);

    // Code blocks with syntax
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:1.05rem;margin:10px 0 6px 0;color:#fff;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:1.15rem;margin:12px 0 6px 0;color:#fff;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:1.25rem;margin:14px 0 8px 0;color:#fff;">$1</h1>');

    // Bullet points
    html = html.replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
    // Clean nested duplicate <ul> tags
    html = html.replace(/<\/ul>\s*<ul>/g, "");

    // Paragraph linebreaks
    const paragraphs = html.split(/\n{2,}/);
    html = paragraphs.map(p => {
      if (p.startsWith("<pre>") || p.startsWith("<ul>") || p.startsWith("<h")) {
        return p;
      }
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    return html;
  }
});
