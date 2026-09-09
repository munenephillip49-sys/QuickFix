// ==========================================
// QUICKFIX MESSAGING MODULE
// Add this to your script.js file or import as separate module
// ==========================================

// ==========================================
// MESSAGING - HELPER FUNCTIONS
// ==========================================

async function sendMessage(requestId, messageText) {
  if (!messageText || !messageText.trim()) {
    showToast("Message cannot be empty.", "error");
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast("Please log in to send messages.", "error");
    return false;
  }

  const { data: request, error: requestError } = 
    await supabase
      .from("service_requests")
      .select("*")
      .eq("id", requestId)
      .single();

  if (requestError || !request) {
    showToast("Request not found.", "error");
    return false;
  }

  // Determine receiver based on user role
  let receiverId = null;
  if (user.id === request.customer_id) {
    receiverId = (
      await supabase
        .from("providers")
        .select("user_id")
        .eq("id", request.provider_id)
        .single()
    ).data?.user_id;
  } else if (user.id === (await supabase
    .from("providers")
    .select("user_id")
    .eq("id", request.provider_id)
    .single()).data?.user_id) {
    receiverId = request.customer_id;
  }

  if (!receiverId) {
    showToast("Unable to identify message recipient.", "error");
    return false;
  }

  const { data, error } = 
    await supabase
      .from("messages")
      .insert([{
        request_id: requestId,
        sender_id: user.id,
        receiver_id: receiverId,
        message_text: messageText.trim()
      }])
      .select()
      .single();

  if (error) {
    console.error("QuickFix message error:", error);
    showToast("Unable to send message.", "error");
    return false;
  }

  // Create notification for receiver
  await createNotification(
    receiverId,
    "message",
    "New Message",
    `You have a new message about a service request.`,
    requestId
  );

  showToast("Message sent! ✓");
  return true;
}

async function getMessages(requestId, limit = 50) {
  if (!requestId) return [];

  const { data, error } = 
    await supabase
      .from("messages")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .limit(limit);

  if (error) {
    console.error("QuickFix messages error:", error);
    return [];
  }

  return data || [];
}

async function markMessagesAsRead(requestId) {
  const user = await getCurrentUser();
  if (!user) return false;

  const { error } = 
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("request_id", requestId)
      .eq("receiver_id", user.id);

  if (error) {
    console.error("QuickFix mark read error:", error);
    return false;
  }

  return true;
}

async function getUnreadMessageCount(userId) {
  if (!userId) return 0;

  const { count, error } = 
    await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);

  if (error) {
    console.error("QuickFix unread count error:", error);
    return 0;
  }

  return count || 0;
}

async function createNotification(userId, type, title, message, requestId = null) {
  if (!userId) return false;

  const { error } = 
    await supabase
      .from("notifications")
      .insert([{
        user_id: userId,
        type,
        title,
        message,
        related_request_id: requestId
      }]);

  if (error) {
    console.error("QuickFix notification error:", error);
    return false;
  }

  return true;
}

async function getNotifications(userId, limit = 20) {
  if (!userId) return [];

  const { data, error } = 
    await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(limit);

  if (error) {
    console.error("QuickFix notifications error:", error);
    return [];
  }

  return data || [];
}

// ==========================================
// MESSAGE THREAD UI
// ==========================================

async function showMessageThread(requestId, providerName = "Provider") {
  const user = await getCurrentUser();
  if (!user) {
    showToast("Please log in to view messages.", "error");
    return;
  }

  // Check if modal already exists
  if (document.querySelector("#messageThreadModal")) {
    document.querySelector("#messageThreadModal").remove();
  }

  const modal = document.createElement("section");
  modal.id = "messageThreadModal";
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-box message-modal">
      <button type="button" class="close-button">×</button>

      <p class="section-label">QUICKFIX MESSAGES</p>

      <h2>${escapeHtml(providerName)}</h2>

      <div class="messages-container">
        <div class="messages-list" id="messagesList">
          <p class="loading">Loading messages...</p>
        </div>
      </div>

      <div class="message-input-section">
        <textarea
          id="messageInput"
          placeholder="Type your message here..."
          maxlength="500"
        ></textarea>
        <button type="button" id="sendMessageBtn" class="submit-button">
          Send Message
        </button>
      </div>

      <p id="messageError" class="message" style="color: #ff5050;"></p>
    </div>
  `;

  document.body.appendChild(modal);

  const messagesList = modal.querySelector("#messagesList");
  const messageInput = modal.querySelector("#messageInput");
  const sendBtn = modal.querySelector("#sendMessageBtn");
  const closeBtn = modal.querySelector(".close-button");
  const messageError = modal.querySelector("#messageError");

  // Load initial messages
  await loadAndDisplayMessages(requestId, messagesList);

  // Mark messages as read
  await markMessagesAsRead(requestId);

  // Send message handler
  sendBtn.addEventListener("click", async () => {
    const text = messageInput.value.trim();
    if (!text) {
      messageError.textContent = "Message cannot be empty.";
      return;
    }

    setButtonLoading(sendBtn, true, "Sending...");
    messageError.textContent = "";

    const success = await sendMessage(requestId, text);

    if (success) {
      messageInput.value = "";
      await loadAndDisplayMessages(requestId, messagesList);
    }

    setButtonLoading(sendBtn, false);
  });

  // Enter to send (Ctrl+Enter for multi-line)
  messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      sendBtn.click();
    }
  });

  closeBtn.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  // Auto-refresh messages every 3 seconds
  const refreshInterval = setInterval(async () => {
    if (!document.querySelector("#messageThreadModal")) {
      clearInterval(refreshInterval);
      return;
    }
    await loadAndDisplayMessages(requestId, messagesList);
  }, 3000);

  openModal(modal);
}

async function loadAndDisplayMessages(requestId, container) {
  if (!container) return;

  const messages = await getMessages(requestId);
  const user = await getCurrentUser();

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No messages yet. Start the conversation!</p>
      </div>
    `;
    return;
  }

  let html = "";

  messages.forEach(msg => {
    const isSent = msg.sender_id === user.id;
    const timeStr = formatDate(msg.created_at);

    html += `
      <div class="message ${isSent ? "sent" : "received"}">
        <div class="message-content">
          <p class="message-text">${escapeHtml(msg.message_text)}</p>
          <span class="message-time">${timeStr}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Scroll to bottom
  container.parentElement.scrollTop = container.parentElement.scrollHeight;
}

// ==========================================
// ADD MESSAGE BUTTON TO REQUEST CARDS
// ==========================================

function addMessageButtons() {
  // For customer dashboard
  const customerRequestCards = document.querySelectorAll("#customerRequestList .request-card");
  customerRequestCards.forEach(card => {
    if (card.querySelector(".message-btn")) return;

    const header = card.querySelector(".request-card-header");
    const providerName = card.querySelector(".request-meta")?.textContent || "Provider";
    const requestId = card.dataset.requestId;

    if (!header || !requestId) return;

    const messageBtn = document.createElement("button");
    messageBtn.type = "button";
    messageBtn.className = "message-btn";
    messageBtn.textContent = "💬 Message";

    messageBtn.addEventListener("click", () => {
      showMessageThread(requestId, providerName);
    });

    header.appendChild(messageBtn);
  });

  // For provider dashboard
  const providerRequestCards = document.querySelectorAll("#requestList .request-card");
  providerRequestCards.forEach(card => {
    if (card.querySelector(".message-btn")) return;

    const header = card.querySelector(".request-card-header");
    const requestId = card.dataset.requestId;

    if (!header || !requestId) return;

    const messageBtn = document.createElement("button");
    messageBtn.type = "button";
    messageBtn.className = "message-btn";
    messageBtn.textContent = "💬 Message Customer";

    messageBtn.addEventListener("click", () => {
      showMessageThread(requestId, "Customer");
    });

    header.appendChild(messageBtn);
  });
}

// ==========================================
// NOTIFICATION BADGE
// ==========================================

async function updateNotificationBadge() {
  const user = await getCurrentUser();
  if (!user) return;

  const count = await getUnreadMessageCount(user.id);

  let badge = document.querySelector("#notificationBadge");

  if (count > 0) {
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "notificationBadge";
      badge.className = "notification-badge";
      document.body.appendChild(badge);
    }
    badge.textContent = count > 9 ? "9+" : count;
    badge.style.display = "block";
  } else if (badge) {
    badge.style.display = "none";
  }
}

// ==========================================
// CSS STYLES FOR MESSAGING
// ==========================================

function injectMessagingStyles() {
  if (document.querySelector("#quickfix-messaging-styles")) return;

  const style = document.createElement("style");
  style.id = "quickfix-messaging-styles";
  style.textContent = `
    .message-modal {
      display: flex;
      flex-direction: column;
      max-height: 80vh;
      width: 100%;
      max-width: 500px;
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      margin: 16px 0;
      min-height: 300px;
      max-height: 400px;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      margin-bottom: 12px;
    }

    .message.sent {
      justify-content: flex-end;
    }

    .message.received {
      justify-content: flex-start;
    }

    .message-content {
      max-width: 70%;
      padding: 12px 14px;
      border-radius: 12px;
      word-wrap: break-word;
    }

    .message.sent .message-content {
      background: #2ecc71;
      color: #fff;
    }

    .message.received .message-content {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .message-text {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.4;
    }

    .message-time {
      display: block;
      font-size: 0.75rem;
      opacity: 0.7;
      margin-top: 6px;
    }

    .message.sent .message-time {
      text-align: right;
    }

    .message-input-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    #messageInput {
      width: 100%;
      min-height: 80px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      resize: vertical;
    }

    #messageInput:focus {
      outline: none;
      border-color: rgba(46, 204, 113, 0.5);
    }

    .message-btn {
      background: rgba(46, 204, 113, 0.12);
      border: 1px solid rgba(46, 204, 113, 0.35);
      color: inherit;
      padding: 9px 12px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .message-btn:hover {
      background: rgba(46, 204, 113, 0.2);
    }

    .notification-badge {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 32px;
      height: 32px;
      background: #ff5050;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.85rem;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(255, 80, 80, 0.4);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    .loading {
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
    }

    @media (max-width: 600px) {
      .message-modal {
        max-width: 90vw;
      }

      .message-content {
        max-width: 85% !important;
      }
    }
  `;

  document.head.appendChild(style);
}

// ==========================================
// INITIALIZE MESSAGING MODULE
// ==========================================

injectMessagingStyles();

// Update notification badge on load and periodically
updateNotificationBadge();
setInterval(updateNotificationBadge, 5000);

// Add message buttons when dashboards load
const observer = new MutationObserver(() => {
  addMessageButtons();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log("✅ QuickFix Messaging module loaded");
