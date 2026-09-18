/* =========================================================
   QUICKFIX — CORE SCRIPT
   Version: 2026
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     SUPABASE
     ======================================================= */

  const SUPABASE_URL =
    "https://dpaqoamvgxbcztoaxxqv.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_6KCoCn8dmj4NMQTpXu5G2Q_KuGxY4l7";

  if (!window.supabase) {
    console.error("QuickFix: Supabase library is missing.");
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  window.QuickFix = {
    db
  };


  /* =======================================================
     CONSTANTS
     ======================================================= */

  const STORAGE = {
    savedProviders: "quickfix_saved_providers",
    lastSearch: "quickfix_last_search"
  };


  /* =======================================================
     GENERAL HELPERS
     ======================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function formatDate(value) {
    if (!value) return "Recently";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Recently";
    }

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }


  function formatStatus(status) {
    const labels = {
      pending: "Pending",
      accepted: "Accepted",
      declined: "Declined",
      cancelled: "Cancelled",
      "on-the-way": "On the way",
      arrived: "Arrived",
      "work-started": "Work started",
      completed: "Completed",
      paid: "Paid"
    };

    if (labels[status]) {
      return labels[status];
    }

    return String(status || "Unknown")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }


  function statusClass(status) {
    return `status-${String(status || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`;
  }


  function showToast(message, type = "success") {
    let toast = $("#quickfix-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "quickfix-toast";

      Object.assign(toast.style, {
        position: "fixed",
        left: "50%",
        bottom: "24px",
        transform: "translateX(-50%)",
        zIndex: "99999",
        maxWidth: "90%",
        padding: "13px 18px",
        borderRadius: "12px",
        background: "#101820",
        color: "#fff",
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 15px 40px rgba(0,0,0,.35)",
        fontWeight: "700",
        textAlign: "center"
      });

      document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.style.borderColor =
      type === "error"
        ? "rgba(255,80,80,.5)"
        : "rgba(57,229,140,.35)";

    clearTimeout(window.__quickfixToastTimer);

    window.__quickfixToastTimer = setTimeout(() => {
      toast.remove();
    }, 3000);
  }


  function setLoading(button, loading, text = "Please wait...") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = text;
    } else {
      button.disabled = false;
      button.textContent =
        button.dataset.originalText ||
        button.textContent;
    }
  }


  /* =======================================================
     AUTH
     ======================================================= */

  async function getCurrentUser() {
    try {
      const {
        data,
        error
      } = await db.auth.getUser();

      if (error) {
        console.error("QuickFix auth:", error);
        return null;
      }

      return data?.user || null;

    } catch (error) {
      console.error("QuickFix auth exception:", error);
      return null;
    }
  }


  async function requireUser() {
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "account.html";
      return null;
    }

    return user;
  }


  async function logout() {
    const { error } = await db.auth.signOut();

    if (error) {
      console.error(error);
      showToast(
        error.message || "Unable to sign out.",
        "error"
      );
      return false;
    }

    window.location.href = "account.html";
    return true;
  }


  /* =======================================================
     SAVED PROVIDERS
     ======================================================= */

  function getSavedProviders() {
    try {
      return JSON.parse(
        localStorage.getItem(
          STORAGE.savedProviders
        ) || "[]"
      );
    } catch {
      return [];
    }
  }


  function isProviderSaved(providerId) {
    return getSavedProviders().some(
      provider =>
        String(provider.id) === String(providerId)
    );
  }


  function toggleSavedProvider(provider) {
    const saved = getSavedProviders();

    const index = saved.findIndex(
      item =>
        String(item.id) === String(provider.id)
    );

    if (index >= 0) {
      saved.splice(index, 1);

      localStorage.setItem(
        STORAGE.savedProviders,
        JSON.stringify(saved)
      );

      return false;
    }

    saved.push({
      id: provider.id,
      name: provider.name || "",
      service: provider.service || "",
      location: provider.location || "",
      phone: provider.phone || ""
    });

    localStorage.setItem(
      STORAGE.savedProviders,
      JSON.stringify(saved)
    );

    return true;
  }


  /* =======================================================
     MODALS
     ======================================================= */

  function openModal(modal) {
    if (!modal) return;

    modal.style.display = "flex";
    modal.classList.add("active");

    document.body.classList.add("modal-open");
  }


  function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("active");

    if (
      modal.classList.contains("modal") ||
      modal.id
    ) {
      modal.style.display = "none";
    }

    document.body.classList.remove("modal-open");
  }


  /* =======================================================
     LOCATION
     ======================================================= */

  function attachLocationButton(input) {
    if (!input) return;

    if (
      input.parentElement?.querySelector(
        ".quickfix-location-button"
      )
    ) {
      return;
    }

    const button = document.createElement("button");

    button.type = "button";
    button.className = "quickfix-location-button";
    button.textContent = "📍 Use my location";

    Object.assign(button.style, {
      marginTop: "8px",
      padding: "9px 12px",
      borderRadius: "9px",
      border: "1px solid rgba(57,229,140,.35)",
      background: "rgba(57,229,140,.08)",
      color: "inherit",
      cursor: "pointer"
    });

    button.addEventListener("click", () => {
      if (!navigator.geolocation) {
        showToast(
          "Location is not supported on this device.",
          "error"
        );
        return;
      }

      button.disabled = true;
      button.textContent = "📍 Getting location...";

      navigator.geolocation.getCurrentPosition(
        position => {
          const {
            latitude,
            longitude
          } = position.coords;

          input.value =
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

          button.disabled = false;
          button.textContent = "📍 Use my location";

          showToast("Location added.");
        },

        error => {
          console.error(error);

          button.disabled = false;
          button.textContent = "📍 Use my location";

          showToast(
            "Location permission was not granted.",
            "error"
          );
        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });

    input.parentElement?.appendChild(button);
  }


  /* =======================================================
     SEARCH
     ======================================================= */

  async function searchProviders() {
    const input = $("#searchInput");
    const button = $("#searchButton");

    if (!input) return;

    const search = input.value.trim();

    if (!search) {
      showToast(
        "Enter a service to search.",
        "error"
      );
      return;
    }

    localStorage.setItem(
      STORAGE.lastSearch,
      search
    );

    setLoading(
      button,
      true,
      "Searching..."
    );

    const {
      data,
      error
    } = await db
      .from("providers")
      .select("*")
      .ilike(
        "service",
        `%${search}%`
      );

    setLoading(
      button,
      false
    );

    if (error) {
      console.error(
        "QuickFix provider search:",
        error
      );

      showToast(
        error.message ||
        "Unable to search right now.",
        "error"
      );

      return;
    }

    renderSearchResults(
      data || [],
      search
    );
  }


  function renderSearchResults(
    providers,
    search
  ) {
    const results = $("#results");
    const container = $("#searchResults");
    const summary = $("#searchResultsSummary");

    if (!container) {
      console.error(
        "QuickFix: #searchResults not found."
      );
      return;
    }

    if (results) {
      results.style.display = "block";
    }

    container.innerHTML = "";

    if (providers.length === 0) {
      if (summary) {
        summary.textContent =
          `No providers found for "${search}".`;
      }

      container.innerHTML = `
        <div class="empty-state">
          <h3>No providers found</h3>
          <p>
            Try another service such as plumbing,
            electrical, phone repair or computer help.
          </p>
        </div>
      `;

      results?.scrollIntoView({
        behavior: "smooth"
      });

      return;
    }

    if (summary) {
      summary.textContent =
        `${providers.length} provider${
          providers.length === 1 ? "" : "s"
        } found for "${search}".`;
    }

    providers.forEach(provider => {
      container.appendChild(
        createProviderCard(provider)
      );
    });

    results?.scrollIntoView({
      behavior: "smooth"
    });
  }


  function createProviderCard(provider) {
    const card =
      document.createElement("div");

    card.className = "provider-card";

    const saved =
      isProviderSaved(provider.id);

    const firstLetter =
      (provider.name || "P")
        .charAt(0)
        .toUpperCase();

    card.innerHTML = `
      <div class="provider-card-main">

        <div class="provider-avatar">
          ${escapeHtml(firstLetter)}
        </div>

        <div class="provider-info">

          <h3>
            ${escapeHtml(
              provider.name ||
              "Service Provider"
            )}
          </h3>

          <p class="provider-service">
            ${escapeHtml(
              provider.service ||
              "Service"
            )}
          </p>

          <p class="provider-location">
            📍 ${escapeHtml(
              provider.location ||
              "Location not provided"
            )}
          </p>

          ${
            provider.phone
              ? `
                <p class="provider-phone">
                  📞 ${escapeHtml(
                    provider.phone
                  )}
                </p>
              `
              : ""
          }

        </div>

      </div>

      <div class="provider-actions">

        <button
          type="button"
          class="save-provider-btn ${
            saved ? "saved" : ""
          }"
        >
          ${saved ? "★ Saved" : "☆ Save"}
        </button>

        <button
          type="button"
          class="request-provider-btn"
        >
          Request service
        </button>

      </div>
    `;


    const saveButton =
      $(".save-provider-btn", card);

    saveButton?.addEventListener(
      "click",
      () => {
        const nowSaved =
          toggleSavedProvider(provider);

        saveButton.classList.toggle(
          "saved",
          nowSaved
        );

        saveButton.textContent =
          nowSaved
            ? "★ Saved"
            : "☆ Save";

        showToast(
          nowSaved
            ? "Provider saved."
            : "Provider removed from saved."
        );
      }
    );


    const requestButton =
      $(".request-provider-btn", card);

    requestButton?.addEventListener(
      "click",
      async () => {
        const user =
          await getCurrentUser();

        if (!user) {
          showToast(
            "Please log in before requesting a service.",
            "error"
          );

          window.location.href =
            "account.html";

          return;
        }

        openRequestModal(provider);
      }
    );


    return card;
  }


  /* =======================================================
     REQUEST MODAL
     ======================================================= */

  function openRequestModal(provider) {
    const modal =
      $("#requestModal");

    const providerName =
      $("#requestProviderName");

    const description =
      $("#requestDescription");

    const location =
      $("#requestLocation");

    const phone =
      $("#requestPhone");

    const message =
      $("#requestMessage");

    if (!modal) {
      showToast(
        "Request form is unavailable.",
        "error"
      );
      return;
    }

    window.__quickfixSelectedProvider =
      provider;

    if (providerName) {
      providerName.textContent =
        provider.name ||
        "Service Provider";
    }

    if (description) {
      description.value = "";
    }

    if (location) {
      location.value = "";
    }

    if (phone) {
      phone.value =
        provider.phone || "";
    }

    if (message) {
      message.textContent = "";
    }

    openModal(modal);
  }


  async function submitServiceRequest() {
    const provider =
      window.__quickfixSelectedProvider;

    if (!provider) {
      showToast(
        "Please select a provider first.",
        "error"
      );
      return;
    }

    const user =
      await requireUser();

    if (!user) return;

    const description =
      $("#requestDescription")?.value.trim();

    const location =
      $("#requestLocation")?.value.trim();

    const phone =
      $("#requestPhone")?.value.trim();

    const button =
      $("#submitRequest");

    const message =
      $("#requestMessage");

    if (!description) {
      if (message) {
        message.textContent =
          "Please describe what you need.";
      }

      showToast(
        "Please describe what you need.",
        "error"
      );

      return;
    }

    setLoading(
      button,
      true,
      "Sending..."
    );

    const payload = {
      customer_id: user.id,
      provider_id: provider.id,
      service:
        provider.service ||
        "Service",
      description,
      location:
        location || null,
      phone:
        phone || null,
      status: "pending"
    };

    const {
      error
    } = await db
      .from("service_requests")
      .insert(payload);

    setLoading(
      button,
      false
    );

    if (error) {
      console.error(
        "QuickFix request:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Unable to send request.";
      }

      showToast(
        error.message ||
        "Unable to send request.",
        "error"
      );

      return;
    }

    if (message) {
      message.textContent =
        "Request sent successfully.";
    }

    showToast(
      "Service request sent."
    );

    setTimeout(() => {
      closeModal(
        $("#requestModal")
      );
    }, 700);
  }


  /* =======================================================
     CUSTOMER REQUESTS
     ======================================================= */

  async function loadCustomerRequests() {
    const list =
      $("#customerRequestList");

    if (!list) return;

    const user =
      await getCurrentUser();

    if (!user) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>Please log in</h3>
          <p>
            Log in to see your service requests.
          </p>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="empty-state">
        <p>Loading your requests...</p>
      </div>
    `;

    const {
      data,
      error
    } = await db
      .from("service_requests")
      .select("*")
      .eq(
        "customer_id",
        user.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (error) {
      console.error(
        "QuickFix customer requests:",
        error
      );

      list.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load requests</h3>
          <p>
            ${escapeHtml(
              error.message ||
              "Please try again."
            )}
          </p>
        </div>
      `;

      return;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>No requests yet</h3>

          <p>
            When you request a service,
            your requests will appear here.
          </p>

          <a
            href="find.html"
            class="find-btn"
          >
            Find a Service
          </a>
        </div>
      `;

      return;
    }

    list.innerHTML = "";

    data.forEach(request => {
      const card =
        document.createElement("div");

      card.className =
        "request-card";

      const status =
        request.status ||
        "pending";

      card.innerHTML = `
        <div class="request-card-header">

          <div>
            <h3>
              ${escapeHtml(
                request.service ||
                "Service request"
              )}
            </h3>

            <p class="request-meta">
              ${escapeHtml(
                request.provider_name ||
                "Provider"
              )}
            </p>
          </div>

          <span
            class="status-badge ${statusClass(status)}"
          >
            ${escapeHtml(
              formatStatus(status)
            )}
          </span>

        </div>

        <div class="request-card-body">

          <p>
            ${escapeHtml(
              request.description ||
              "No description provided."
            )}
          </p>

          <p class="request-meta">
            📍 ${escapeHtml(
              request.location ||
              "Location not provided"
            )}
          </p>

          <p class="request-meta">
            📞 ${escapeHtml(
              request.phone ||
              "No phone number"
            )}
          </p>

          <p class="request-meta">
            🕒 ${escapeHtml(
              formatDate(
                request.created_at
              )
            )}
          </p>

          ${
            status === "accepted"
              ? `
                <div class="request-actions">
                  <a
                    href="customer-messages.html"
                    class="request-action-btn"
                  >
                    Message provider
                  </a>
                </div>
              `
              : ""
          }

        </div>
      `;

      list.appendChild(card);
    });
  }


  /* =======================================================
     PROVIDER REQUESTS
     ======================================================= */

  async function getProviderProfile(userId) {
    const {
      data,
      error
    } = await db
      .from("providers")
      .select("*")
      .eq(
        "user_id",
        userId
      )
      .limit(1);

    if (error) {
      console.error(
        "QuickFix provider profile:",
        error
      );
      return null;
    }

    return data?.[0] || null;
  }


  async function loadProviderRequests() {
    const list =
      $("#requestList");

    if (!list) return;

    const user =
      await getCurrentUser();

    if (!user) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>Please log in</h3>
          <p>
            Log in to view customer requests.
          </p>
        </div>
      `;
      return;
    }

    const provider =
      await getProviderProfile(
        user.id
      );

    if (!provider) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>Provider profile not found</h3>
          <p>
            Your provider profile could not
            be found.
          </p>
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="empty-state">
        <p>Loading requests...</p>
      </div>
    `;

    const {
      data,
      error
    } = await db
      .from("service_requests")
      .select("*")
      .eq(
        "provider_id",
        provider.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (error) {
      console.error(
        "QuickFix provider requests:",
        error
      );

      list.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load requests</h3>
          <p>
            ${escapeHtml(
              error.message ||
              "Please try again."
            )}
          </p>
        </div>
      `;

      return;
    }

    if (!data || data.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>No service requests yet</h3>
          <p>
            Customer requests will appear here.
          </p>
        </div>
      `;
      return;
    }

    list.innerHTML = "";

    data.forEach(request => {
      list.appendChild(
        createProviderRequestCard(
          request
        )
      );
    });
  }


  function createProviderRequestCard(request) {
    const card =
      document.createElement("div");

    card.className =
      "request-card";

    const status =
      request.status ||
      "pending";

    card.innerHTML = `
      <div class="request-card-header">

        <div>
          <h3>
            ${escapeHtml(
              request.service ||
              "Service request"
            )}
          </h3>

          <p class="request-meta">
            Customer request
          </p>
        </div>

        <span
          class="status-badge ${statusClass(status)}"
        >
          ${escapeHtml(
            formatStatus(status)
          )}
        </span>

      </div>

      <div class="request-card-body">

        <p>
          <strong>Description:</strong>
          ${escapeHtml(
            request.description ||
            "No description provided."
          )}
        </p>

        <p class="request-meta">
          📍 ${escapeHtml(
            request.location ||
            "Location not provided"
          )}
        </p>

        <p class="request-meta">
          📞 ${escapeHtml(
            request.phone ||
            "No phone number"
          )}
        </p>

        <p class="request-meta">
          🕒 ${escapeHtml(
            formatDate(
              request.created_at
            )
          )}
        </p>

      </div>

      <div class="provider-request-actions">

        ${
          status === "pending"
            ? `
              <button
                type="button"
                class="request-action-btn accept-request-btn"
                data-request-id="${escapeHtml(
                  request.id
                )}"
              >
                Accept
              </button>

              <button
                type="button"
                class="request-action-btn decline-request-btn"
                data-request-id="${escapeHtml(
                  request.id
                )}"
              >
                Decline
              </button>
            `
            : ""
        }

        ${
          status === "accepted"
            ? `
              <a
                href="provider-messages.html"
                class="request-action-btn"
              >
                Message customer
              </a>

              <button
                type="button"
                class="request-action-btn"
                data-next-status="on-the-way"
                data-request-id="${escapeHtml(
                  request.id
                )}"
              >
                On the way
              </button>
            `
            : ""
        }

        ${
          status === "on-the-way"
            ? `
              <button
                type="button"
                class="request-action-btn"
                data-next-status="arrived"
                data-request-id="${escapeHtml(
                  request.id
                )}"
              >
                Mark arrived
              </button>
            `
            : ""
        }

        ${
          status === "arrived"
            ? `
              <button
                type="button"
                class="request-action-btn"
                data-next-status="work-started"
                data-request-id="${escapeHtml(
                  request.id
                )}"
              >
                Start work
              </button>
            `
            : ""
        }

        ${
          status === "work-started"
            ? `
              <button
                type="button"
                class="request-action-btn"
                data-next-status="completed"
                data-request-id="${escapeHtml(
                  request.id
                )}"
              >
                Mark completed
              </button>
            `
            : ""
        }

      </div>
    `;


    $(".accept-request-btn", card)
      ?.addEventListener(
        "click",
        async () => {
          await updateRequestStatus(
            request.id,
            "accepted"
          );
        }
      );


    $(".decline-request-btn", card)
      ?.addEventListener(
        "click",
        async () => {
          await declineRequest(
            request.id
          );
        }
      );


    $$(
      "[data-next-status]",
      card
    ).forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          await updateRequestStatus(
            request.id,
            button.dataset.nextStatus
          );
        }
      );
    });


    return card;
  }


  /* =======================================================
     UPDATE REQUEST STATUS
     ======================================================= */

  async function updateRequestStatus(
    requestId,
    newStatus
  ) {
    const user =
      await getCurrentUser();

    if (!user) {
      window.location.href =
        "account.html";
      return false;
    }

    const provider =
      await getProviderProfile(
        user.id
      );

    if (!provider) {
      showToast(
        "Provider profile not found.",
        "error"
      );
      return false;
    }

    const {
      error
    } = await db
      .from("service_requests")
      .update({
        status: newStatus
      })
      .eq(
        "id",
        requestId
      )
      .eq(
        "provider_id",
        provider.id
      );

    if (error) {
      console.error(
        "QuickFix status update:",
        error
      );

      showToast(
        error.message ||
        "Unable to update request.",
        "error"
      );

      return false;
    }

    showToast(
      `Request ${formatStatus(
        newStatus
      ).toLowerCase()}.`
    );

    await loadProviderRequests();

    return true;
  }


  /* =======================================================
     DECLINE REQUEST
     ======================================================= */

  async function declineRequest(
    requestId
  ) {
    const reason =
      window.prompt(
        "Why are you declining this request?"
      );

    if (reason === null) {
      return;
    }

    const cleanReason =
      reason.trim();

    if (!cleanReason) {
      showToast(
        "Please enter a decline reason.",
        "error"
      );
      return;
    }

    const user =
      await getCurrentUser();

    if (!user) {
      window.location.href =
        "account.html";
      return;
    }

    const provider =
      await getProviderProfile(
        user.id
      );

    if (!provider) {
      showToast(
        "Provider profile not found.",
        "error"
      );
      return;
    }

    /*
      decline_reason is intentionally included here.
      The database must contain this column before
      the decline reason can be stored successfully.
    */

    const {
      error
    } = await db
      .from("service_requests")
      .update({
        status: "declined",
        decline_reason: cleanReason
      })
      .eq(
        "id",
        requestId
      )
      .eq(
        "provider_id",
        provider.id
      );

    if (error) {
      console.error(
        "QuickFix decline:",
        error
      );

      showToast(
        error.message ||
        "Unable to decline request.",
        "error"
      );

      return;
    }

    showToast(
      "Request declined."
    );

    await loadProviderRequests();
  }


  /* =======================================================
     SERVICE CARD SHORTCUTS
     ======================================================= */

  function initializeServiceCards() {
    $$(".service-card").forEach(card => {
      card.addEventListener(
        "click",
        () => {
          const service =
            card.dataset.service ||
            $("h3", card)?.textContent.trim();

          if (!service) return;

          const input =
            $("#searchInput");

          if (!input) return;

          input.value = service;

          searchProviders();
        }
      );
    });
  }


  /* =======================================================
     FIND PAGE
     ======================================================= */

  function initializeFindPage() {
    const searchButton =
      $("#searchButton");

    const searchInput =
      $("#searchInput");

    if (!searchButton && !searchInput) {
      return;
    }

    searchButton?.addEventListener(
      "click",
      searchProviders
    );

    searchInput?.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          event.preventDefault();
          searchProviders();
        }
      }
    );

    const previousSearch =
      localStorage.getItem(
        STORAGE.lastSearch
      );

    if (
      previousSearch &&
      searchInput &&
      !searchInput.value
    ) {
      searchInput.value =
        previousSearch;
    }
  }


  /* =======================================================
     REQUEST PAGE ELEMENTS
     ======================================================= */

  function initializeRequestModal() {
    const modal =
      $("#requestModal");

    const closeButton =
      $("#closeRequest");

    const submitButton =
      $("#submitRequest");

    if (!modal) return;

    closeButton?.addEventListener(
      "click",
      () => closeModal(modal)
    );

    submitButton?.addEventListener(
      "click",
      submitServiceRequest
    );

    modal.addEventListener(
      "click",
      event => {
        if (event.target === modal) {
          closeModal(modal);
        }
      }
    );

    attachLocationButton(
      $("#requestLocation")
    );
  }


  /* =======================================================
     CUSTOMER DASHBOARD
     ======================================================= */

  async function initializeCustomerDashboard() {
    const list =
      $("#customerRequestList");

    if (!list) return;

    const user =
      await getCurrentUser();

    if (!user) {
      window.location.href =
        "account.html";
      return;
    }

    await loadCustomerRequests();

    $("#customerLogout")
      ?.addEventListener(
        "click",
        logout
      );
  }


  /* =======================================================
     PROVIDER DASHBOARD
     ======================================================= */

  async function initializeProviderDashboard() {
    const list =
      $("#requestList");

    if (!list) return;

    const user =
      await getCurrentUser();

    if (!user) {
      window.location.href =
        "account.html";
      return;
    }

    await loadProviderRequests();
  }


  /* =======================================================
     GENERIC LOGOUT BUTTONS
     ======================================================= */

  function initializeLogoutButtons() {
    $(
      "#logoutButton, #providerLogout"
    );

    const buttons = [
      ...$$(
        "#logoutButton"
      ),
      ...$$(
        "#providerLogout"
      ),
      ...$$(
        "#customerLogout"
      )
    ];

    buttons.forEach(button => {
      if (
        button.dataset.quickfixLogout
      ) {
        return;
      }

      button.dataset.quickfixLogout =
        "true";

      button.addEventListener(
        "click",
        async event => {
          event.preventDefault();

          setLoading(
            button,
            true,
            "Signing out..."
          );

          await logout();
        }
      );
    });
  }


  /* =======================================================
     ACCOUNT PAGE
     ======================================================= */

  function initializeAccountPage() {
    /*
      account.html currently contains its own
      authentication UI.

      We deliberately do NOT attach another
      authentication form here.

      This prevents two competing auth systems.
    */
  }


  /* =======================================================
     NAVIGATION SAFETY
     ======================================================= */

  function initializeNavigation() {
    $$(".qf-quick-service").forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const service =
              button.dataset.service;

            if (!service) return;

            const input =
              $("#searchInput");

            if (input) {
              input.value = service;
              searchProviders();
              return;
            }

            window.location.href =
              `find.html?service=${encodeURIComponent(
                service
              )}`;
          }
        );
      }
    );


    const joinProvider =
      $("#joinProvider");

    joinProvider?.addEventListener(
      "click",
      () => {
        window.location.href =
          "account.html?role=provider";
      }
    );


    const accountButton =
      $("#accountButton");

    accountButton?.addEventListener(
      "click",
      async event => {
        event.preventDefault();

        const user =
          await getCurrentUser();

        if (user) {
          window.location.href =
            "customer.html";
        } else {
          window.location.href =
            "account.html";
        }
      }
    );
  }


  /* =======================================================
     AUTH STATE
     ======================================================= */

  db.auth.onAuthStateChange(
    (event, session) => {
      console.log(
        "QuickFix auth:",
        event
      );

      if (
        event === "SIGNED_OUT"
      ) {
        console.log(
          "QuickFix user signed out."
        );
      }

      if (session?.user) {
        document.documentElement.dataset.authenticated =
          "true";
      } else {
        document.documentElement.dataset.authenticated =
          "false";
      }
    }
  );


  /* =======================================================
     ONLINE / OFFLINE
     ======================================================= */

  function updateConnection() {
    document.documentElement.dataset.online =
      navigator.onLine
        ? "true"
        : "false";
  }

  window.addEventListener(
    "online",
    () => {
      updateConnection();
      showToast(
        "You're back online."
      );
    }
  );

  window.addEventListener(
    "offline",
    () => {
      updateConnection();
      showToast(
        "You're offline. Some features may not work.",
        "error"
      );
    }
  );


  /* =======================================================
     KEYBOARD SHORTCUTS
     ======================================================= */

  document.addEventListener(
    "keydown",
    event => {
      const tag =
        document.activeElement?.tagName;

      if (
        event.key === "/" &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA"
      ) {
        const search =
          $("#searchInput");

        if (search) {
          event.preventDefault();
          search.focus();
        }
      }

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        const search =
          $("#searchInput");

        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
    }
  );


  /* =======================================================
     START QUICKFIX
     ======================================================= */

  async function initQuickFix() {
    updateConnection();

    initializeServiceCards();

    initializeFindPage();

    initializeRequestModal();

    initializeNavigation();

    initializeAccountPage();

    initializeLogoutButtons();

    await initializeCustomerDashboard();

    await initializeProviderDashboard();

    document.documentElement.dataset.quickfixReady =
      "true";

    console.log(
      "%cQuickFix 2026 core loaded.",
      "font-weight:700;font-size:16px;"
    );
  }


  /* =======================================================
     DOM READY
     ======================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initQuickFix,
      {
        once: true
      }
    );
  } else {
    initQuickFix();
  }


  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.QuickFix.searchProviders =
    searchProviders;

  window.QuickFix.getCurrentUser =
    getCurrentUser;

  window.QuickFix.loadCustomerRequests =
    loadCustomerRequests;

  window.QuickFix.loadProviderRequests =
    loadProviderRequests;

  window.QuickFix.updateRequestStatus =
    updateRequestStatus;

  window.QuickFix.logout =
    logout;

})();
