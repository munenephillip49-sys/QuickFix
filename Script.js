document.addEventListener("DOMContentLoaded", function () {

  // ==========================================
  // SUPABASE
  // ==========================================

  const SUPABASE_URL =
    "https://dpaqoamvgxbcztoaxxqv.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_PmI-ae0wRI4rrGg00KLHAA_Pws_TFJm";

  const supabase =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );


  // ==========================================
  // QUICKFIX 2026 EXPERIENCE LAYER
  // ==========================================

  const QUICKFIX = {
    savedProvidersKey: "quickfix_saved_providers",
    lastSearchKey: "quickfix_last_search"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getSavedProviders() {
    try {
      return JSON.parse(localStorage.getItem(QUICKFIX.savedProvidersKey) || "[]");
    } catch {
      return [];
    }
  }

  function isProviderSaved(id) {
    return getSavedProviders().some(item => String(item.id) === String(id));
  }

  function toggleSavedProvider(provider) {
    const saved = getSavedProviders();
    const index = saved.findIndex(item => String(item.id) === String(provider.id));

    if (index >= 0) {
      saved.splice(index, 1);
      localStorage.setItem(QUICKFIX.savedProvidersKey, JSON.stringify(saved));
      return false;
    }

    saved.push({
      id: provider.id,
      name: provider.name,
      service: provider.service,
      location: provider.location,
      phone: provider.phone || ""
    });
    localStorage.setItem(QUICKFIX.savedProvidersKey, JSON.stringify(saved));
    return true;
  }

  function showToast(message, type = "success") {
    let toast = document.querySelector("#quickfix-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "quickfix-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }

    toast.className = `quickfix-toast quickfix-toast-${type}`;
    toast.textContent = message;

    requestAnimationFrame(() => toast.classList.add("show"));

    clearTimeout(window.__quickfixToastTimer);
    window.__quickfixToastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function formatStatus(status) {
    const labels = {
      pending: "Pending",
      accepted: "Accepted",
      declined: "Declined",
      cancelled: "Cancelled",
      completed: "Completed",
      paid: "Paid",
      "on-the-way": "On the way",
      arrived: "Arrived",
      "work-started": "Work started"
    };

    return labels[status] || String(status || "Unknown")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function statusClass(status) {
    return `status-${String(status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }

  function formatDate(value) {
    if (!value) return "Recently";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";

    return date.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function setButtonLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = loadingText;
      button.classList.add("is-loading");
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
      button.classList.remove("is-loading");
    }
  }

  function hideDashboards() {
    if (customerDashboard) customerDashboard.style.display = "none";
    if (providerDashboard) providerDashboard.style.display = "none";
  }

  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("QuickFix auth:", error);
      return null;
    }
    return data?.user || null;
  }

  function addLocationButton(input, message = "Location added.") {
    if (!input || input.parentElement?.querySelector(".quickfix-location-btn")) return;

    const wrapper = input.parentElement;
    if (!wrapper) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "quickfix-location-btn";
    button.textContent = "📍 Use my location";
    button.addEventListener("click", () => {
      if (!navigator.geolocation) {
        showToast("Location is not supported on this device.", "error");
        return;
      }

      button.disabled = true;
      button.textContent = "📍 Getting location...";

      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          input.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          button.disabled = false;
          button.textContent = "📍 Use my location";
          showToast(message);
        },
        error => {
          console.error("QuickFix location:", error);
          button.disabled = false;
          button.textContent = "📍 Use my location";
          showToast("Location permission was not granted.", "error");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });

    wrapper.appendChild(button);
  }

  function injectExperienceStyles() {
    if (document.querySelector("#quickfix-js-styles")) return;

    const style = document.createElement("style");
    style.id = "quickfix-js-styles";
    style.textContent = `
      .quickfix-toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translate(-50%, 20px);
        opacity: 0;
        z-index: 99999;
        max-width: min(92vw, 420px);
        padding: 13px 18px;
        border-radius: 14px;
        background: rgba(10,15,20,.96);
        color: #fff;
        border: 1px solid rgba(255,255,255,.12);
        box-shadow: 0 18px 50px rgba(0,0,0,.35);
        transition: .25s ease;
        font-weight: 600;
        text-align: center;
      }
      .quickfix-toast.show { opacity: 1; transform: translate(-50%, 0); }
      .quickfix-toast-error { border-color: rgba(255,80,80,.45); }
      .quickfix-location-btn {
        margin-top: 8px;
        border: 1px solid rgba(46,204,113,.35);
        background: rgba(46,204,113,.08);
        color: inherit;
        padding: 8px 12px;
        border-radius: 10px;
        cursor: pointer;
      }
      .quickfix-location-btn:disabled { opacity: .6; cursor: wait; }
      .request-card .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border-radius: 999px;
        font-size: .78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .04em;
        background: rgba(255,255,255,.08);
      }
      .request-card .request-meta {
        color: rgba(255,255,255,.62);
        font-size: .82rem;
      }
      .provider-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .save-provider-btn {
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.05);
        color: inherit;
        padding: 9px 12px;
        border-radius: 10px;
        cursor: pointer;
      }
      .save-provider-btn.saved {
        border-color: rgba(46,204,113,.45);
        background: rgba(46,204,113,.12);
      }
      .is-loading { opacity: .7; cursor: wait !important; }
      @media (max-width: 600px) {
        .quickfix-toast { bottom: 14px; }
      }
    `;
    document.head.appendChild(style);
  }

  injectExperienceStyles();


  // ==========================================
  // ELEMENTS
  // ==========================================

  const searchInput =
    document.querySelector("#searchInput");

  const searchButton =
    document.querySelector("#searchButton");

  const serviceCards =
    document.querySelectorAll(".service-card");

  const joinProvider =
    document.querySelector("#joinProvider");

  const accountButton =
    document.querySelector("#accountButton");


  // AUTH

  const authModal =
    document.querySelector("#authModal");

  const closeAuth =
    document.querySelector("#closeAuth");

  const authEmail =
    document.querySelector("#authEmail");

  const authPassword =
    document.querySelector("#authPassword");

  const authSubmit =
    document.querySelector("#authSubmit");

  const authMessage =
    document.querySelector("#authMessage");

  const authTitle =
    document.querySelector("#authTitle");

  const authIntro =
    document.querySelector("#authIntro");

  const switchAuthMode =
    document.querySelector("#switchAuthMode");


  // PROVIDER

  const providerModal =
    document.querySelector("#providerModal");

  const closeProvider =
    document.querySelector("#closeProvider");

  const submitProvider =
    document.querySelector("#submitProvider");

  const providerMessage =
    document.querySelector("#providerMessage");


  // REQUEST

  const requestModal =
    document.querySelector("#requestModal");

  const closeRequest =
    document.querySelector("#closeRequest");

  const submitRequest =
    document.querySelector("#submitRequest");

  const requestMessage =
    document.querySelector("#requestMessage");

  const requestProviderName =
    document.querySelector("#requestProviderName");

  const requestDescription =
    document.querySelector("#requestDescription");

  const requestLocation =
    document.querySelector("#requestLocation");

  const requestPhone =
    document.querySelector("#requestPhone");


  // ACCOUNT

  const accountModal =
    document.querySelector("#accountModal");

  const closeAccount =
    document.querySelector("#closeAccount");

  const accountEmail =
    document.querySelector("#accountEmail");

  const openCustomerDashboard =
    document.querySelector("#openCustomerDashboard");

  const openProviderDashboard =
    document.querySelector("#openProviderDashboard");

  const logoutButton =
    document.querySelector("#logoutButton");

  const accountMessage =
    document.querySelector("#accountMessage");


  // DASHBOARDS

  const customerDashboard =
    document.querySelector("#customer-dashboard");

  const providerDashboard =
    document.querySelector("#provider-dashboard");

  const customerRequestList =
    document.querySelector("#customerRequestList");

  const requestList =
    document.querySelector("#requestList");

  const customerDashboardMessage =
    document.querySelector("#customerDashboardMessage");

  const dashboardMessage =
    document.querySelector("#dashboardMessage");


  let authMode = "signup";

  let selectedProvider = null;

  addLocationButton(requestLocation, "Location added to your request.");


  // ==========================================
  // HELPERS
  // ==========================================

  function openModal(modal) {

    if (!modal) return;

    modal.classList.add("active");

    document.body.classList.add("modal-open");

  }


  function closeModal(modal) {

    if (!modal) return;

    modal.classList.remove("active");

    document.body.classList.remove("modal-open");

  }


  // ==========================================
  // SEARCH
  // ==========================================

  async function searchService() {

    const search =
      searchInput.value.trim();

    if (search) {
      localStorage.setItem(QUICKFIX.lastSearchKey, search);
    }

    if (!search) {

      showToast("Enter a service to search.", "error");

      return;

    }

    searchButton.disabled = true;
    searchButton.textContent = "Searching...";

    const { data, error } =
      await supabase
        .from("providers")
        .select("*")
        .ilike("service", `%${search}%`);

    searchButton.disabled = false;
    searchButton.textContent = "Search";

    if (error) {

      console.error(error);

      showToast("Unable to search right now.", "error");

      return;

    }

    const resultsContainer =
      document.querySelector("#searchResults");

    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    if (!data || data.length === 0) {

      resultsContainer.innerHTML = `
        <div class="empty-state">
          <h3>No providers found</h3>
          <p>Try another service such as plumbing, electrical, phone repair or computer help.</p>
        </div>
      `;

      return;

    }

    data.forEach(provider => {

      const card =
        document.createElement("div");

      card.className = "provider-card";

      const saved =
        isProviderSaved(provider.id);

      card.innerHTML = `
        <div class="provider-card-main">
          <div class="provider-avatar">
            ${escapeHtml((provider.name || "P").charAt(0).toUpperCase())}
          </div>

          <div class="provider-info">
            <h3>${escapeHtml(provider.name || "Service Provider")}</h3>

            <p class="provider-service">
              ${escapeHtml(provider.service || "Service")}
            </p>

            <p class="provider-location">
              📍 ${escapeHtml(provider.location || "Location not provided")}
            </p>

            ${provider.phone ? `
              <p class="provider-phone">
                📞 ${escapeHtml(provider.phone)}
              </p>
            ` : ""}
          </div>
        </div>

        <div class="provider-actions">

          <button
            class="save-provider-btn ${saved ? "saved" : ""}"
            type="button"
            data-save-provider="${escapeHtml(provider.id)}"
          >
            ${saved ? "★ Saved" : "☆ Save"}
          </button>

          <button
            class="request-provider-btn"
            type="button"
          >
            Request service
          </button>

        </div>
      `;

      const saveButton =
        card.querySelector("[data-save-provider]");

      saveButton?.addEventListener("click", () => {

        const nowSaved =
          toggleSavedProvider(provider);

        saveButton.classList.toggle(
          "saved",
          nowSaved
        );

        saveButton.textContent =
          nowSaved ? "★ Saved" : "☆ Save";

        showToast(
          nowSaved
            ? "Provider saved."
            : "Provider removed from saved."
        );

      });


      const requestButton =
        card.querySelector(".request-provider-btn");

      requestButton?.addEventListener("click", async () => {

        const user =
          await getCurrentUser();

        if (!user) {

          showToast(
            "Please log in before requesting a service.",
            "error"
          );

          authMode = "login";

          if (authTitle)
            authTitle.textContent = "Welcome back";

          if (authIntro)
            authIntro.textContent =
              "Log in to request a service.";

          openModal(authModal);

          return;

        }

        selectedProvider =
          provider;

        if (requestProviderName)
          requestProviderName.textContent =
            provider.name || "Service Provider";

        if (requestMessage)
          requestMessage.textContent = "";

        if (requestDescription)
          requestDescription.value = "";

        if (requestLocation)
          requestLocation.value = "";

        if (requestPhone)
          requestPhone.value =
            provider.phone || "";

        openModal(requestModal);

      });

      resultsContainer.appendChild(card);

    });

  }


  if (searchButton) {

    searchButton.addEventListener(
      "click",
      searchService
    );

  }


  if (searchInput) {

    searchInput.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {

          event.preventDefault();

          searchService();

        }

      }
    );

    const previousSearch =
      localStorage.getItem(
        QUICKFIX.lastSearchKey
      );

    if (previousSearch) {

      searchInput.value =
        previousSearch;

    }

  }


  serviceCards.forEach(card => {

    card.addEventListener(
      "click",
      () => {

        const service =
          card.dataset.service ||
          card.textContent.trim();

        if (searchInput) {

          searchInput.value =
            service;

          searchService();

        }

      }
    );

  });


  // ==========================================
  // AUTH MODE
  // ==========================================

  function updateAuthMode() {

    if (authMode === "signup") {

      if (authTitle)
        authTitle.textContent =
          "Create your QuickFix account";

      if (authIntro)
        authIntro.textContent =
          "Join QuickFix and get local help when you need it.";

      if (authSubmit)
        authSubmit.textContent =
          "Create account";

      if (switchAuthMode)
        switchAuthMode.textContent =
          "Already have an account? Log in";

    } else {

      if (authTitle)
        authTitle.textContent =
          "Welcome back";

      if (authIntro)
        authIntro.textContent =
          "Log in to your QuickFix account.";

      if (authSubmit)
        authSubmit.textContent =
          "Log in";

      if (switchAuthMode)
        switchAuthMode.textContent =
          "Don't have an account? Create one";

    }

  }


  if (switchAuthMode) {

    switchAuthMode.addEventListener(
      "click",
      () => {

        authMode =
          authMode === "signup"
            ? "login"
            : "signup";

        updateAuthMode();

      }
    );

  }


  // ==========================================
  // OPEN AUTH
  // ==========================================

  if (accountButton) {

    accountButton.addEventListener(
      "click",
      async () => {

        const user =
          await getCurrentUser();

        if (user) {

          if (accountEmail)
            accountEmail.textContent =
              user.email || "";

          if (accountMessage)
            accountMessage.textContent = "";

          openModal(accountModal);

        } else {

          authMode = "login";

          updateAuthMode();

          openModal(authModal);

        }

      }
    );

  }


  if (joinProvider) {

    joinProvider.addEventListener(
      "click",
      async () => {

        const user =
          await getCurrentUser();

        if (!user) {

          authMode = "login";

          updateAuthMode();

          openModal(authModal);

          showToast(
            "Log in first to become a provider.",
            "error"
          );

          return;

        }

        if (providerMessage)
          providerMessage.textContent = "";

        openModal(providerModal);

      }
    );

  }


  // ==========================================
  // AUTH SUBMIT
  // ==========================================

  if (authSubmit) {

    authSubmit.addEventListener(
      "click",
      async () => {

        const email =
          authEmail?.value.trim();

        const password =
          authPassword?.value;

        if (!email || !password) {

          if (authMessage)
            authMessage.textContent =
              "Enter your email and password.";

          return;

        }

        setButtonLoading(
          authSubmit,
          true,
          authMode === "signup"
            ? "Creating..."
            : "Logging in..."
        );

        if (authMessage)
          authMessage.textContent = "";

        let result;

        if (authMode === "signup") {

          result =
            await supabase.auth.signUp({
              email,
              password
            });

        } else {

          result =
            await supabase.auth.signInWithPassword({
              email,
         password
            });
        }

        if (result.error) {

          console.error("QuickFix auth:", result.error);

          if (authMessage)
            authMessage.textContent =
              result.error.message || "Authentication failed.";

          setButtonLoading(authSubmit, false);

          return;
        }

        if (authMode === "signup") {

          if (result.data?.session) {

            showToast("Account created successfully.");

            closeModal(authModal);

          } else {

            if (authMessage)
              authMessage.textContent =
                "Account created. Check your email to confirm your account.";

            showToast(
              "Check your email to confirm your account."
            );

          }

        } else {

          showToast("Welcome back.");

          closeModal(authModal);

        }

        setButtonLoading(authSubmit, false);

        if (authEmail)
          authEmail.value = "";

        if (authPassword)
          authPassword.value = "";

      });

  }


  // ==========================================
  // CLOSE AUTH MODAL
  // ==========================================

  if (closeAuth) {

    closeAuth.addEventListener(
      "click",
      () => closeModal(authModal)
    );

  }


  // ==========================================
  // CLOSE PROVIDER MODAL
  // ==========================================

  if (closeProvider) {

    closeProvider.addEventListener(
      "click",
      () => closeModal(providerModal)
    );

  }


  // ==========================================
  // CLOSE REQUEST MODAL
  // ==========================================

  if (closeRequest) {

    closeRequest.addEventListener(
      "click",
      () => {

        selectedProvider = null;

        closeModal(requestModal);

      }
    );

  }


  // ==========================================
  // CLOSE ACCOUNT MODAL
  // ==========================================

  if (closeAccount) {

    closeAccount.addEventListener(
      "click",
      () => closeModal(accountModal)
    );

  }


  // ==========================================
  // CLICK OUTSIDE MODALS
  // ==========================================

  [
    authModal,
    providerModal,
    requestModal,
    accountModal
  ].forEach(modal => {

    if (!modal) return;

    modal.addEventListener(
      "click",
      event => {

        if (event.target === modal) {

          closeModal(modal);

        }

      }
    );

  });


  // ==========================================
  // ESC KEY
  // ==========================================

  document.addEventListener(
    "keydown",
    event => {

      if (event.key !== "Escape") return;

      [
        authModal,
        providerModal,
        requestModal,
        accountModal
      ].forEach(modal => {

        if (modal?.classList.contains("active")) {

          closeModal(modal);

        }

      });

    }
  );


  // ==========================================
  // PROVIDER REGISTRATION
  // ==========================================

  if (submitProvider) {

    submitProvider.addEventListener(
      "click",
      async () => {

        const user =
          await getCurrentUser();

        if (!user) {

          closeModal(providerModal);

          authMode = "login";

          updateAuthMode();

          openModal(authModal);

          showToast(
            "Please log in first.",
            "error"
          );

          return;

        }


        const providerName =
          document.querySelector("#providerName")?.value.trim();

        const providerService =
          document.querySelector("#providerService")?.value.trim();

        const providerLocation =
          document.querySelector("#providerLocation")?.value.trim();

        const providerPhone =
          document.querySelector("#providerPhone")?.value.trim();

        if (
          !providerName ||
          !providerService ||
          !providerLocation
        ) {

          if (providerMessage)
            providerMessage.textContent =
              "Please complete all required fields.";

          return;

        }


        setButtonLoading(
          submitProvider,
          true,
          "Joining..."
        );

        if (providerMessage)
          providerMessage.textContent = "";


        const providerData = {

          user_id: user.id,

          name: providerName,

          service: providerService,

          location: providerLocation,

          phone: providerPhone || null

        };


        const { data, error } =
          await supabase
            .from("providers")
            .insert([providerData])
            .select()
            .single();


        if (error) {

          console.error(
            "QuickFix provider registration:",
            error
          );

          if (providerMessage)
            providerMessage.textContent =
              error.message ||
              "Unable to register as a provider.";

          setButtonLoading(
            submitProvider,
            false
          );

          return;

        }


        showToast(
          "You're now a QuickFix provider!"
        );

        closeModal(providerModal);

        setButtonLoading(
          submitProvider,
          false
        );


        const providerInputs = [
          "#providerName",
          "#providerService",
          "#providerLocation",
          "#providerPhone"
        ];

        providerInputs.forEach(selector => {

          const input =
            document.querySelector(selector);

          if (input)
            input.value = "";

        });


        if (data) {

          console.log(
            "QuickFix provider created:",
            data
          );

        }

      }
    );

  }


  // ==========================================
  // SUBMIT SERVICE REQUEST
  // ==========================================

  if (submitRequest) {

    submitRequest.addEventListener(
      "click",
      async () => {

        const user =
          await getCurrentUser();

        if (!user) {

          closeModal(requestModal);

          authMode = "login";

          updateAuthMode();

          openModal(authModal);

          showToast(
            "Please log in before requesting a service.",
            "error"
          );

          return;

        }


        if (!selectedProvider) {

          showToast(
            "Please select a provider first.",
            "error"
          );

          return;

        }


        const description =
          requestDescription?.value.trim();

        const location =
          requestLocation?.value.trim();

        const phone =
          requestPhone?.value.trim();


        if (!description || !location || !phone) {

          if (requestMessage)
            requestMessage.textContent =
              "Please complete all required fields.";

          return;

        }


        setButtonLoading(
          submitRequest,
          true,
          "Sending..."
        );

        if (requestMessage)
          requestMessage.textContent = "";


        const requestData = {

          customer_id: user.id,

          provider_id: selectedProvider.id,

          provider_name:
            selectedProvider.name || null,

          service:
            selectedProvider.service || null,

          description,

          location,

          phone,

          status: "pending"

        };


        const { data, error } =
          await supabase
            .from("service_requests")
            .insert([requestData])
            .select()
            .single();


        if (error) {

          console.error(
            "QuickFix request:",
            error
          );

          if (requestMessage)
            requestMessage.textContent =
              error.message ||
              "Unable to send your request.";

          setButtonLoading(
            submitRequest,
            false
          );

          return;

        }


        showToast(
          "Service request sent successfully!"
        );


        closeModal(requestModal);


        selectedProvider = null;


        setButtonLoading(
          submitRequest,
          false
        );


        if (requestDescription)
          requestDescription.value = "";

        if (requestLocation)
          requestLocation.value = "";

        if (requestPhone)
          requestPhone.value = "";


        if (data) {

          console.log(
            "QuickFix request created:",
            data
          );

        }

      }
    );

  }


  // ==========================================
  // CUSTOMER DASHBOARD
  // ==========================================

  async function loadCustomerRequests() {

    if (!customerRequestList) return;


    const user =
      await getCurrentUser();

    if (!user) {

      customerRequestList.innerHTML = `
        <div class="empty-state">
          <h3>Please log in</h3>
          <p>Log in to view your service requests.</p>
        </div>
      `;

      return;

    }


    if (customerDashboardMessage)
      customerDashboardMessage.textContent =
        "Loading your requests...";


    const { data, error } =
      await supabase
        .from("service_requests")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", {
          ascending: false
        });


    if (error) {

      console.error(
        "QuickFix customer requests:",
        error
      );

      customerRequestList.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load requests</h3>
          <p>${escapeHtml(error.message || "Please try again.")}</p>
        </div>
      `;

      if (customerDashboardMessage)
        customerDashboardMessage.textContent = "";

      return;

    }


    if (!data || data.length === 0) {

      customerRequestList.innerHTML = `
        <div class="empty-state">
          <h3>No service requests yet</h3>
          <p>Search for a provider and request a service to get started.</p>
        </div>
      `;

      if (customerDashboardMessage)
        customerDashboardMessage.textContent = "";

      return;

    }


    customerRequestList.innerHTML = "";


    data.forEach(request => {

      const card =
        document.createElement("div");

      card.className =
        "request-card";


      const status =
        request.status || "pending";


      card.innerHTML = `

        <div class="request-card-header">

          <div>

            <h3>
              ${escapeHtml(
                request.service ||
                request.provider_name ||
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

          <span class="status-badge ${statusClass(status)}">
            ${escapeHtml(formatStatus(status))}
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
            ${escapeHtml(
              formatDate(request.created_at)
            )}
          </p>

        </div>

      `;


      customerRequestList.appendChild(card);

    });


    if (customerDashboardMessage)
      customerDashboardMessage.textContent =
        `${data.length} request${data.length === 1 ? "" : "s"}`;

  }


  // ==========================================
  // OPEN CUSTOMER DASHBOARD
  // ==========================================

  if (openCustomerDashboard) {

    openCustomerDashboard.addEventListener(
      "click",
      async () => {

        const user =
          await getCurrentUser();

        if (!user) {

          closeModal(accountModal);

          authMode = "login";

          updateAuthMode();

          openModal(authModal);

          return;

        }

        closeModal(accountModal);

        hideDashboards();

        if (customerDashboard)
          customerDashboard.style.display = "block";

        await loadCustomerRequests();

        customerDashboard?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      }
    );

}
  // ==========================================
  // PROVIDER DASHBOARD
  // ==========================================

  async function loadProviderRequests() {

    if (!requestList) return;

    const user =
      await getCurrentUser();

    if (!user) {

      requestList.innerHTML = `
        <div class="empty-state">
          <h3>Please log in</h3>
          <p>Log in to view service requests.</p>
        </div>
      `;

      return;

    }

    if (dashboardMessage)
      dashboardMessage.textContent =
        "Loading service requests...";


    // Find the provider profile belonging
    // to the currently logged-in user.

    const {
      data: providers,
      error: providerError
    } =
      await supabase
        .from("providers")
        .select("*")
        .eq("user_id", user.id)
        .limit(1);


    if (providerError) {

      console.error(
        "QuickFix provider profile:",
        providerError
      );

      requestList.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load provider profile</h3>
          <p>${escapeHtml(
            providerError.message ||
            "Please try again."
          )}</p>
        </div>
      `;

      if (dashboardMessage)
        dashboardMessage.textContent = "";

      return;

    }


    const provider =
      providers?.[0];


    if (!provider) {

      requestList.innerHTML = `
        <div class="empty-state">
          <h3>Provider profile not found</h3>
          <p>Join QuickFix as a provider before opening the provider dashboard.</p>
        </div>
      `;

      if (dashboardMessage)
        dashboardMessage.textContent = "";

      return;

    }


    // Get requests assigned to this provider.

    const {
      data,
      error
    } =
      await supabase
        .from("service_requests")
        .select("*")
        .eq("provider_id", provider.id)
        .order("created_at", {
          ascending: false
        });


    if (error) {

      console.error(
        "QuickFix provider requests:",
        error
      );

      requestList.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load requests</h3>
          <p>${escapeHtml(
            error.message ||
            "Please try again."
          )}</p>
        </div>
      `;

      if (dashboardMessage)
        dashboardMessage.textContent = "";

      return;

    }


    if (!data || data.length === 0) {

      requestList.innerHTML = `
        <div class="empty-state">
          <h3>No service requests yet</h3>
          <p>When customers request your services, their requests will appear here.</p>
        </div>
      `;

      if (dashboardMessage)
        dashboardMessage.textContent =
          "No requests";

      return;

    }


    requestList.innerHTML = "";


    data.forEach(request => {

      const card =
        document.createElement("div");

      card.className =
        "request-card";


      const status =
        request.status || "pending";


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

          <span class="status-badge ${statusClass(status)}">
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
              formatDate(request.created_at)
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
                  data-request-id="${escapeHtml(request.id)}"
                  data-request-status="accepted"
                >
                  Accept
                </button>

                <button
                  type="button"
                  class="request-action-btn decline-request-btn"
                  data-request-id="${escapeHtml(request.id)}"
                  data-request-status="declined"
                >
                  Decline
                </button>
              `
              : ""
          }


          ${
            status === "accepted"
              ? `
                <button
                  type="button"
                  class="request-action-btn"
                  data-request-id="${escapeHtml(request.id)}"
                  data-request-status="on-the-way"
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
                  data-request-id="${escapeHtml(request.id)}"
                  data-request-status="arrived"
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
                  data-request-id="${escapeHtml(request.id)}"
                  data-request-status="work-started"
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
                  data-request-id="${escapeHtml(request.id)}"
                  data-request-status="completed"
                >
                  Mark completed
                </button>
              `
              : ""
          }

        </div>

      `;


      // ----------------------------------------
      // REQUEST STATUS BUTTONS
      // ----------------------------------------

      card
        .querySelectorAll(
          "[data-request-status]"
        )
        .forEach(button => {

          button.addEventListener(
            "click",
            async () => {

              const requestId =
                button.dataset.requestId;

              const newStatus =
                button.dataset.requestStatus;


              if (!requestId || !newStatus)
                return;


              setButtonLoading(
                button,
                true,
                "Updating..."
              );


              const success =
                await updateRequest(
                  requestId,
                  newStatus
                );


              if (success) {

                showToast(
                  `Request ${formatStatus(newStatus).toLowerCase()}.`
                );

                await loadProviderRequests();

              } else {

                setButtonLoading(
                  button,
                  false
                );

              }

            }
          );

        });


      requestList.appendChild(card);

    });


    if (dashboardMessage)
      dashboardMessage.textContent =
        `${data.length} request${data.length === 1 ? "" : "s"}`;

  }


  // ==========================================
  // UPDATE REQUEST
  // ==========================================

  async function updateRequest(
    requestId,
    newStatus
  ) {

    if (!requestId || !newStatus)
      return false;


    const user =
      await getCurrentUser();

    if (!user) {

      showToast(
        "Please log in first.",
        "error"
      );

      return false;

    }


    // Confirm that the logged-in user
    // actually owns the provider profile.

    const {
      data: providers,
      error: providerError
    } =
      await supabase
        .from("providers")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);


    if (providerError) {

      console.error(
        "QuickFix provider verification:",
        providerError
      );

      showToast(
        "Unable to verify provider account.",
        "error"
      );

      return false;

    }


    const provider =
      providers?.[0];


    if (!provider) {

      showToast(
        "Provider profile not found.",
        "error"
      );

      return false;

    }


    // Only update a request belonging
    // to this provider.

    const {
      data,
      error
    } =
      await supabase
        .from("service_requests")
        .update({
          status: newStatus
        })
        .eq("id", requestId)
        .eq("provider_id", provider.id)
        .select()
        .single();


    if (error) {

      console.error(
        "QuickFix request update:",
        error
      );

      showToast(
        error.message ||
        "Unable to update request.",
        "error"
      );

      return false;

    }


    console.log(
      "QuickFix request updated:",
      data
    );


    return true;

  }


  // ==========================================
  // OPEN PROVIDER DASHBOARD
  // ==========================================

  if (openProviderDashboard) {

    openProviderDashboard.addEventListener(
      "click",
      async () => {

        const user =
          await getCurrentUser();


        if (!user) {

          closeModal(accountModal);

          authMode = "login";

          updateAuthMode();

          openModal(authModal);

          return;

        }


        // Verify that this user is registered
        // as a provider.

        const {
          data,
          error
        } =
          await supabase
            .from("providers")
            .select("id")
            .eq("user_id", user.id)
            .limit(1);


        if (error) {

          console.error(
            "QuickFix provider check:",
            error
          );

          showToast(
            "Unable to check provider account.",
            "error"
          );

          return;

        }


        if (!data || data.length === 0) {

          showToast(
            "You are not registered as a provider yet.",
            "error"
          );

          closeModal(accountModal);

          openModal(providerModal);

          return;

        }


        closeModal(accountModal);

        hideDashboards();


        if (providerDashboard)
          providerDashboard.style.display =
            "block";


        await loadProviderRequests();


        providerDashboard?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      }
    );

  }


  // ==========================================
  // LOGOUT
  // ==========================================

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      async () => {

        setButtonLoading(
          logoutButton,
          true,
          "Logging out..."
        );


        const {
          error
        } =
          await supabase.auth.signOut();


        if (error) {

          console.error(
            "QuickFix logout:",
            error
          );

          showToast(
            error.message ||
            "Unable to log out.",
            "error"
          );

          setButtonLoading(
            logoutButton,
            false
          );

          return;

        }


        closeModal(accountModal);

        hideDashboards();


        showToast(
          "You've been logged out."
        );


        if (accountEmail)
          accountEmail.textContent = "";


        setButtonLoading(
          logoutButton,
          false
        );

      }
    );

  }


  // ==========================================
  // AUTH STATE
  // ==========================================

  supabase.auth.onAuthStateChange(
    async (event, session) => {

      console.log(
        "QuickFix auth state:",
        event
      );


      if (session?.user) {

        if (accountEmail)
          accountEmail.textContent =
            session.user.email || "";

      }


      if (event === "SIGNED_OUT") {

        hideDashboards();

      }

    }
  );


  // ==========================================
  // INITIAL AUTH CHECK
  // ==========================================

  async function initializeQuickFix() {

    const user =
      await getCurrentUser();


    if (!user) {

      hideDashboards();

      return;

    }


    if (accountEmail)
      accountEmail.textContent =
        user.email || "";


    console.log(
      "QuickFix user session restored:",
      user.email
    );

  }


  initializeQuickFix();


  // ==========================================
  // KEYBOARD SHORTCUTS
  // ==========================================

  document.addEventListener(
    "keydown",
    event => {

      // "/" focuses search

      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          document.activeElement?.tagName
        )
      ) {

        event.preventDefault();

        searchInput?.focus();

      }


      // Ctrl/Cmd + K focuses search

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {

        event.preventDefault();

        searchInput?.focus();

      }

    }
  );
  // ==========================================
  // MOBILE / TOUCH EXPERIENCE
  // ==========================================

  document.addEventListener(
    "touchstart",
    () => {
      document.body.classList.add("quickfix-touch");
    },
    { passive: true, once: true }
  );


  // ==========================================
  // ONLINE / OFFLINE STATUS
  // ==========================================

  function updateConnectionStatus() {

    if (navigator.onLine) {

      document.body.classList.remove(
        "quickfix-offline"
      );

    } else {

      document.body.classList.add(
        "quickfix-offline"
      );

      showToast(
        "You're offline. Some QuickFix features may not work.",
        "error"
      );

    }

  }


  window.addEventListener(
    "online",
    () => {

      updateConnectionStatus();

      showToast(
        "You're back online."
      );

    }
  );


  window.addEventListener(
    "offline",
    () => {

      updateConnectionStatus();

    }
  );


  updateConnectionStatus();


  // ==========================================
  // PREVENT DOUBLE SUBMISSIONS
  // ==========================================

  [
    authSubmit,
    submitProvider,
    submitRequest
  ].forEach(button => {

    if (!button) return;

    button.addEventListener(
      "click",
      event => {

        if (button.disabled) {

          event.preventDefault();

          event.stopPropagation();

        }

      },
      true
    );

  });


  // ==========================================
  // IMPROVE FORM ENTER KEY BEHAVIOUR
  // ==========================================

  [
    authEmail,
    authPassword
  ].forEach(input => {

    input?.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" &&
          !authSubmit?.disabled
        ) {

          event.preventDefault();

          authSubmit?.click();

        }

      }
    );

  });


  [
    requestDescription,
    requestLocation,
    requestPhone
  ].forEach(input => {

    input?.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" &&
          event.ctrlKey
        ) {

          event.preventDefault();

          submitRequest?.click();

        }

      }
    );

  });


  // ==========================================
  // RESTORE LAST SEARCH
  // ==========================================

  const savedSearch =
    localStorage.getItem(
      QUICKFIX.lastSearchKey
    );


  if (
    savedSearch &&
    searchInput &&
    !searchInput.value
  ) {

    searchInput.value =
      savedSearch;

  }


  // ==========================================
  // SAVE PROVIDERS COUNT
  // ==========================================

  function updateSavedProviderCount() {

    const saved =
      getSavedProviders();

    const countElements =
      document.querySelectorAll(
        "[data-saved-provider-count]"
      );


    countElements.forEach(element => {

      element.textContent =
        String(saved.length);

    });

  }


  updateSavedProviderCount();


  // Listen for changes made by
  // other QuickFix tabs/windows.

  window.addEventListener(
    "storage",
    event => {

      if (
        event.key ===
        QUICKFIX.savedProvidersKey
      ) {

        updateSavedProviderCount();

      }

    }
  );


  // ==========================================
  // CLOSE DASHBOARDS WITH BACK BUTTON
  // ==========================================

  window.addEventListener(
    "popstate",
    () => {

      hideDashboards();

    }
  );


  // ==========================================
  // CLEAN UP MODAL STATE
  // ==========================================

  window.addEventListener(
    "beforeunload",
    () => {

      document.body.classList.remove(
        "modal-open"
      );

    }
  );


  // ==========================================
  // QUICKFIX READY
  // ==========================================

  document.documentElement.dataset.quickfixReady =
    "true";


  console.log(
    "%cQuickFix 2026 is ready.",
    "font-weight:700;font-size:16px;"
  );


});
