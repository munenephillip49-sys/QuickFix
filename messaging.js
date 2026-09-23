// ==========================================
// QUICKFIX 2026 — MESSAGING SYSTEM
// Step 5A
// Works with the current Supabase messages table:
// id, request_id, sender_id, receiver_id,
// message, is_read, created_at
// ==========================================

(function () {
  "use strict";

  const QF = window.QuickFix;

  if (!QF || !QF.db) {
    console.error("QuickFix core was not loaded before messaging.js.");
    return;
  }

  const supabase = QF.db;

  // ------------------------------------------
  // HELPERS
  // ------------------------------------------

  function escape(value) {
    if (typeof QF.escapeHtml === "function") {
      return QF.escapeHtml(String(value ?? ""));
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMessageTime(date) {
    if (!date) return "";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function toast(message, type = "success") {
    if (typeof QF.showToast === "function") {
      QF.showToast(message, type);
    } else {
      alert(message);
    }
  }

  // ------------------------------------------
  // CURRENT USER
  // ------------------------------------------

  async function getUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return null;
    }

    return data.user;
  }

  // ------------------------------------------
  // GET PROVIDER USER ID
  // ------------------------------------------

  async function getProviderUserId(providerId) {
    if (!providerId) return null;

    const { data, error } = await supabase
      .from("providers")
      .select("user_id")
      .eq("id", providerId)
      .single();

    if (error) {
      console.error("QuickFix provider lookup error:", error);
      return null;
    }

    return data?.user_id || null;
  }

  // ------------------------------------------
  // GET REQUEST
  // ------------------------------------------

  async function getRequest(requestId) {
    if (!requestId) return null;

    const { data, error } = await supabase
      .from("service_requests")
      .select(`
        id,
        customer_id,
        provider_id,
        service,
        description,
        location,
        status,
        created_at
      `)
      .eq("id", requestId)
      .single();

    if (error) {
      console.error("QuickFix request lookup error:", error);
      return null;
    }

    return data;
  }

  // ------------------------------------------
  // CHECK USER IS PART OF REQUEST
  // ------------------------------------------

  async function canAccessRequest(requestId, userId) {
    const request = await getRequest(requestId);

    if (!request || !userId) {
      return {
        allowed: false,
        request: null,
        receiverId: null
      };
    }

    if (request.customer_id === userId) {
      const providerUserId = await getProviderUserId(
        request.provider_id
      );

      return {
        allowed: !!providerUserId,
        request,
        receiverId: providerUserId
      };
    }

    const providerUserId = await getProviderUserId(
      request.provider_id
    );

    if (providerUserId === userId) {
      return {
        allowed: true,
        request,
        receiverId: request.customer_id
      };
    }

    return {
      allowed: false,
      request,
      receiverId: null
    };
  }

  // ------------------------------------------
  // SEND MESSAGE
  // ------------------------------------------

  async function sendMessage(requestId, text) {
    const message = String(text || "").trim();

    if (!message) {
      toast("Message cannot be empty.", "error");
      return false;
    }

    if (message.length > 1000) {
      toast("Message is too long.", "error");
      return false;
    }

    const user = await getUser();

    if (!user) {
      toast("Please log in first.", "error");
      return false;
    }

    const access = await canAccessRequest(
      requestId,
      user.id
    );

    if (!access.allowed) {
      toast(
        "You are not allowed to message this user.",
        "error"
      );
      return false;
    }

    if (!access.receiverId) {
      toast(
        "The other user could not be found.",
        "error"
      );
      return false;
    }

    // Messaging is only available after acceptance.
    if (
      access.request.status !== "accepted" &&
      access.request.status !== "completed"
    ) {
      toast(
        "Messaging becomes available after the request is accepted.",
        "error"
      );
      return false;
    }

    const { error } = await supabase
      .from("messages")
      .insert({
        request_id: requestId,
        sender_id: user.id,
        receiver_id: access.receiverId,
        message: message
      });

    if (error) {
      console.error("QuickFix send message error:", error);
      toast("Unable to send message.", "error");
      return false;
    }

    // Notification
    await supabase
      .from("notifications")
      .insert({
        user_id: access.receiverId,
        type: "message",
        title: "New Message",
        message: "You received a new QuickFix message.",
        related_request_id: requestId
      });

    return true;
  }

  // ------------------------------------------
  // LOAD MESSAGES
  // ------------------------------------------

  async function getMessages(requestId) {
    if (!requestId) return [];

    const user = await getUser();

    if (!user) return [];

    const access = await canAccessRequest(
      requestId,
      user.id
    );

    if (!access.allowed) {
      return [];
    }

    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        request_id,
        sender_id,
        receiver_id,
        message,
        is_read,
        created_at
      `)
      .eq("request_id", requestId)
      .order("created_at", {
        ascending: true
      });

    if (error) {
      console.error(
        "QuickFix load messages error:",
        error
      );
      return [];
    }

    return data || [];
  }

  // ------------------------------------------
  // MARK MESSAGES AS READ
  // ------------------------------------------

  async function markMessagesAsRead(requestId) {
    const user = await getUser();

    if (!user || !requestId) return false;

    const { error } = await supabase
      .from("messages")
      .update({
        is_read: true
      })
      .eq("request_id", requestId)
      .eq("receiver_id", user.id);

    if (error) {
      console.error(
        "QuickFix mark messages read error:",
        error
      );
      return false;
    }

    return true;
  }

  // ------------------------------------------
  // UNREAD COUNT
  // ------------------------------------------

  async function getUnreadMessageCount() {
    const user = await getUser();

    if (!user) return 0;

    const { count, error } = await supabase
      .from("messages")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error(
        "QuickFix unread count error:",
        error
      );
      return 0;
    }

    return count || 0;
  }

  // ------------------------------------------
  // GET CUSTOMER REQUESTS WITH CONVERSATIONS
  // ------------------------------------------

  async function getCustomerConversations(userId) {
    const { data, error } = await supabase
      .from("service_requests")
      .select(`
        id,
        customer_id,
        provider_id,
        service,
        description,
        status,
        created_at,
        providers (
          id,
          name,
          service,
          location
        )
      `)
      .eq("customer_id", userId)
      .not("provider_id", "is", null)
      .in("status", ["accepted", "completed"])
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(
        "QuickFix customer conversations error:",
        error
      );
      return [];
    }

    return data || [];
  }

  // ------------------------------------------
  // GET PROVIDER REQUESTS WITH CONVERSATIONS
  // ------------------------------------------

  async function getProviderConversations(userId) {
    const { data: provider, error: providerError } =
      await supabase
        .from("providers")
        .select("id, name")
        .eq("user_id", userId)
        .single();

    if (providerError || !provider) {
      console.error(
        "QuickFix provider profile error:",
        providerError
      );
      return [];
    }

    const { data, error } = await supabase
      .from("service_requests")
      .select(`
        id,
        customer_id,
        provider_id,
        service,
        description,
        status,
        created_at
      `)
      .eq("provider_id", provider.id)
      .in("status", ["accepted", "completed"])
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(
        "QuickFix provider conversations error:",
        error
      );
      return [];
    }

    return data || [];
  }

  // ------------------------------------------
  // GET OTHER USER NAME
  // ------------------------------------------

  async function getOtherUserName(
    request,
    currentUserId
  ) {
    if (request.customer_id === currentUserId) {
      const providerUser = await supabase
        .from("providers")
        .select("name")
        .eq("id", request.provider_id)
        .single();

      return providerUser.data?.name || "Provider";
    }

    return "Customer";
  }

  // ------------------------------------------
  // RENDER CONVERSATION LIST
  // ------------------------------------------

  async function renderConversationList(root, user) {
    if (!root || !user) return;

    const isCustomer =
      root.dataset.role === "customer";

    let requests = [];

    if (isCustomer) {
      requests =
        await getCustomerConversations(user.id);
    } else {
      requests =
        await getProviderConversations(user.id);
    }

    if (!requests.length) {
      root.innerHTML = `
        <div class="qf-message-empty">
          <div>
            <div class="qf-message-icon">💬</div>
            <h2>No conversations yet</h2>
            <p>
              ${
                isCustomer
                  ? "Once a provider accepts your request, your conversation will appear here."
                  : "Once you accept a customer's request, your conversation will appear here."
              }
            </p>
          </div>
        </div>
      `;

      return;
    }

    const cards = [];

    for (const request of requests) {
      const name =
        await getOtherUserName(
          request,
          user.id
        );

      const messages =
        await getMessages(request.id);

      const lastMessage =
        messages.length
          ? messages[messages.length - 1]
          : null;

      const unread =
        messages.filter(
          msg =>
            msg.receiver_id === user.id &&
            !msg.is_read
        ).length;

      cards.push(`
        <button
          type="button"
          class="qf-conversation-card"
          data-request-id="${escape(request.id)}"
        >
          <div class="qf-conversation-main">

            <div class="qf-conversation-top">
              <strong>
                ${escape(name)}
              </strong>

              ${
                unread
                  ? `<span class="qf-unread">${unread}</span>`
                  : ""
              }
            </div>

            <div class="qf-conversation-service">
              ${escape(
                request.service ||
                "Service request"
              )}
            </div>

            <div class="qf-conversation-preview">
              ${
                lastMessage
                  ? escape(lastMessage.message)
                  : "No messages yet — start the conversation."
              }
            </div>

          </div>

          <span class="qf-conversation-arrow">
            →
          </span>
        </button>
      `);
    }

    root.innerHTML = `
      <div class="qf-conversation-list">
        ${cards.join("")}
      </div>
    `;

    root
      .querySelectorAll(
        ".qf-conversation-card"
      )
      .forEach(card => {
        card.addEventListener(
          "click",
          () => {
            const requestId =
              card.dataset.requestId;

            openMessageWindow(
              requestId,
              root.dataset.role
            );
          }
        );
      });
  }

  // ------------------------------------------
  // MESSAGE WINDOW
  // ------------------------------------------

  async function openMessageWindow(
    requestId,
    role
  ) {
    const user = await getUser();

    if (!user) {
      toast(
        "Please log in first.",
        "error"
      );
      return;
    }

    const access =
      await canAccessRequest(
        requestId,
        user.id
      );

    if (!access.allowed) {
      toast(
        "You cannot access this conversation.",
        "error"
      );
      return;
    }

    const otherName =
      await getOtherUserName(
        access.request,
        user.id
      );

    const existing =
      document.getElementById(
        "qfMessageModal"
      );

    if (existing) {
      existing.remove();
    }

    const modal =
      document.createElement("div");

    modal.id = "qfMessageModal";
    modal.className =
      "qf-message-modal";

    modal.innerHTML = `
      <div class="qf-message-dialog">

        <div class="qf-message-header">

          <div>
            <div class="qf-message-label">
              QUICKFIX MESSAGE
            </div>

            <h2>
              ${escape(otherName)}
            </h2>

            <span>
              ${escape(
                access.request.service ||
                "Service request"
              )}
            </span>
          </div>

          <button
            type="button"
            class="qf-message-close"
            aria-label="Close messages"
          >
            ×
          </button>

        </div>

        <div
          class="qf-message-body"
          id="qfMessageBody"
        >
          <div class="qf-message-loading">
            Loading messages...
          </div>
        </div>

        <form
          class="qf-message-form"
          id="qfMessageForm"
        >

          <textarea
            id="qfMessageInput"
            maxlength="1000"
            placeholder="Type your message..."
            required
          ></textarea>

          <button
            type="submit"
            id="qfSendMessage"
          >
            Send
          </button>

        </form>

      </div>
    `;

    document.body.appendChild(modal);

    const body =
      modal.querySelector(
        "#qfMessageBody"
      );

    const form =
      modal.querySelector(
        "#qfMessageForm"
      );

    const input =
      modal.querySelector(
        "#qfMessageInput"
      );

    const close =
      modal.querySelector(
        ".qf-message-close"
      );

    await renderMessages(
      requestId,
      user.id,
      body
    );

    await markMessagesAsRead(
      requestId
    );

    close.addEventListener(
      "click",
      () => modal.remove()
    );

    modal.addEventListener(
      "click",
      event => {
        if (
          event.target === modal
        ) {
          modal.remove();
        }
      }
    );

    form.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const text =
          input.value.trim();

        if (!text) return;

        const sendButton =
          form.querySelector(
            "#qfSendMessage"
          );

        sendButton.disabled = true;
        sendButton.textContent =
          "Sending...";

        const success =
          await sendMessage(
            requestId,
            text
          );

        if (success) {
          input.value = "";

          await renderMessages(
            requestId,
            user.id,
            body
          );

          await markMessagesAsRead(
            requestId
          );
        }

        sendButton.disabled = false;
        sendButton.textContent =
          "Send";
      }
    );

    input.focus();
  }

  // ------------------------------------------
  // RENDER MESSAGES
  // ------------------------------------------

  async function renderMessages(
    requestId,
    currentUserId,
    container
  ) {
    const messages =
      await getMessages(requestId);

    if (!messages.length) {
      container.innerHTML = `
        <div class="qf-no-messages">
          <div>💬</div>
          <p>
            No messages yet.
          </p>
          <span>
            Start the conversation below.
          </span>
        </div>
      `;

      return;
    }

    container.innerHTML =
      messages
        .map(msg => {
          const own =
            msg.sender_id ===
            currentUserId;

          return `
            <div
              class="qf-chat-row ${
                own
                  ? "qf-chat-own"
                  : "qf-chat-other"
              }"
            >
              <div class="qf-chat-bubble">

                <div class="qf-chat-text">
                  ${escape(msg.message)}
                </div>

                <div class="qf-chat-time">
                  ${escape(
                    formatMessageTime(
                      msg.created_at
                    )
                  )}
                </div>

              </div>
            </div>
          `;
        })
        .join("");

    container.scrollTop =
      container.scrollHeight;
  }

  // ------------------------------------------
  // INITIALIZE MESSAGE PAGE
  // ------------------------------------------

  async function initializeMessagePage() {
    const root =
      document.getElementById(
        "messagingRoot"
      );

    if (!root) return;

    const user =
      await getUser();

    if (!user) {
      window.location.href =
        "account.html";
      return;
    }

    const isCustomerPage =
      window.location.pathname
        .toLowerCase()
        .includes(
          "customer-messages"
        );

    root.dataset.role =
      isCustomerPage
        ? "customer"
        : "provider";

    await renderConversationList(
      root,
      user
    );
  }

  // ------------------------------------------
  // PUBLIC API
  // ------------------------------------------

  window.QuickFixMessaging = {
    sendMessage,
    getMessages,
    markMessagesAsRead,
    getUnreadMessageCount,
    openMessageWindow,
    initializeMessagePage
  };

  // ------------------------------------------
  // START
  // ------------------------------------------

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      initializeMessagePage();
    }
  );

})();
