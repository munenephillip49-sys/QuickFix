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

    if (!search) {

      alert(
        "Enter the service you need."
      );

      searchInput.focus();

      return;

    }


    const results =
      document.querySelector("#results");

    results.style.display = "block";

    results.innerHTML = `
      <h2>🔎 Finding help...</h2>
      <p>Searching QuickFix providers...</p>
    `;


    results.scrollIntoView({
      behavior: "smooth"
    });


    try {

      const {
        data,
        error
      } = await supabase
        .from("providers")
        .select("*")
        .ilike(
          "service",
          `%${search}%`
        );


      if (error) {

        console.error(error);

        results.innerHTML = `
          <h2>⚠️ Search failed</h2>
          <p>Please try again.</p>
        `;

        return;

      }


      if (!data || data.length === 0) {

        results.innerHTML = `
          <h2>🔍 No providers found</h2>

          <p>
            We don't have a provider for
            "<strong>${search}</strong>" yet.
          </p>

          <p>
            Try Plumbing, Electrical,
            Phone Repair, Computer Help,
            Car Repair or Home Repairs.
          </p>
        `;

        return;

      }


      results.innerHTML = `
        <h2>🛠️ Providers for ${search}</h2>

        <p>
          ${data.length} provider${data.length > 1 ? "s" : ""} found.
        </p>

        <div class="provider-list"></div>
      `;


      const providerList =
        results.querySelector(
          ".provider-list"
        );


      data.forEach(function (provider) {

        const card =
          document.createElement("div");

        card.className =
          "provider-card";


        card.innerHTML = `

          <div>

            <h3>
              🛠️ ${provider.name}
            </h3>

            <p>
              📍 ${provider.location}
            </p>

            <p>
              ${provider.description || "Local service provider."}
            </p>

            <p>
              ⭐ ${provider.rating || "New"}
            </p>

          </div>

          <div class="provider-actions">

            ${
              provider.phone
              ? `
                <a
                  class="contact-btn"
                  href="tel:${provider.phone}"
                >
                  📞 Call
                </a>
              `
              : ""
            }

            <button
              class="request-btn"
            >
              Request Service
            </button>

          </div>

        `;


        const requestButton =
          card.querySelector(
            ".request-btn"
          );


        requestButton.addEventListener(
          "click",
          function () {

            selectedProvider =
              provider;

            requestProviderName.textContent =
              `${provider.name} • ${provider.service}`;

            requestDescription.value = "";
            requestLocation.value = "";
            requestPhone.value = "";
            requestMessage.textContent = "";

            openModal(requestModal);

          }
        );


        providerList.appendChild(card);

      });

    }

    catch (error) {

      console.error(error);

      results.innerHTML = `
        <h2>⚠️ Connection error</h2>
        <p>Please try again.</p>
      `;

    }

  }


  searchButton.addEventListener(
    "click",
    searchService
  );


  searchInput.addEventListener(
    "keydown",
    function (event) {

      if (event.key === "Enter") {

        event.preventDefault();

        searchService();

      }

    }
  );


  // ==========================================
  // SERVICE CARDS
  // ==========================================

  serviceCards.forEach(
    function (card) {

      card.addEventListener(
        "click",
        function () {

          const service =
            card.querySelector("h3");

          if (!service) return;

          searchInput.value =
            service.textContent.trim();

          searchService();

        }
      );

    }
  );


  // ==========================================
  // AUTH MODE
  // ==========================================

  function updateAuthMode() {

    if (authMode === "signup") {

      authTitle.textContent =
        "Create Account";

      authIntro.textContent =
        "Create an account to use QuickFix.";

      authSubmit.textContent =
        "Create Account";

      switchAuthMode.textContent =
        "Already have an account? Log in";

    }

    else {

      authTitle.textContent =
        "Welcome Back";

      authIntro.textContent =
        "Log in to your QuickFix account.";

      authSubmit.textContent =
        "Log In";

      switchAuthMode.textContent =
        "Don't have an account? Create one";

    }

  }


  // ==========================================
  // AUTH SUBMIT
  // ==========================================

  authSubmit.addEventListener(
    "click",
    async function () {

      const email =
        authEmail.value.trim();

      const password =
        authPassword.value;


      if (!email || !password) {

        authMessage.textContent =
          "Enter your email and password.";

        return;

      }


      if (password.length < 6) {

        authMessage.textContent =
          "Password must be at least 6 characters.";

        return;

      }


      authSubmit.disabled = true;

      authMessage.textContent =
        "Please wait...";


      let result;


      if (authMode === "signup") {

        result =
          await supabase.auth.signUp({
            email: email,
            password: password
          });

      }

      else {

        result =
          await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

      }


      if (result.error) {

        console.error(result.error);

        authMessage.textContent =
          result.error.message;

        authSubmit.disabled = false;

        return;

      }


      if (
        authMode === "signup" &&
        !result.data.session
      ) {

        authMessage.textContent =
          "Account created. Check your email to verify your account.";

        authSubmit.disabled = false;

        return;

      }


      authMessage.textContent =
        "✅ You're logged in!";


      setTimeout(
        function () {

          closeModal(authModal);

          authSubmit.disabled = false;

        },
        700
      );

    }
  );


  switchAuthMode.addEventListener(
    "click",
    function () {

      authMode =
        authMode === "signup"
        ? "login"
        : "signup";

      authMessage.textContent = "";

      updateAuthMode();

    }
  );


  closeAuth.addEventListener(
    "click",
    function () {

      closeModal(authModal);

    }
  );


  // ==========================================
  // JOIN PROVIDER
  // ==========================================

  joinProvider.addEventListener(
    "click",
    async function () {

      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (user) {

        openModal(providerModal);

      }

      else {

        authMode = "signup";

        updateAuthMode();

        authMessage.textContent =
          "Create an account to become a provider.";

        openModal(authModal);

      }

    }
  );


  // ==========================================
  // PROVIDER REGISTRATION
  // ==========================================

  submitProvider.addEventListener(
    "click",
    async function () {

      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (!user) {

        providerMessage.textContent =
          "Please create an account first.";

        closeModal(providerModal);

        openModal(authModal);

        return;

      }


      const name =
        document.querySelector(
          "#providerName"
        ).value.trim();

      const service =
        document.querySelector(
          "#providerService"
        ).value.trim();

      const location =
        document.querySelector(
          "#providerLocation"
        ).value.trim();

      const phone =
        document.querySelector(
          "#providerPhone"
        ).value.trim();

      const description =
        document.querySelector(
          "#providerDescription"
        ).value.trim();


      if (
        !name ||
        !service ||
        !location ||
        !phone
      ) {

        providerMessage.textContent =
          "Please complete all required fields.";

        return;

      }


      submitProvider.disabled = true;

      providerMessage.textContent =
        "Creating your provider profile...";


      const {
        error
      } = await supabase
        .from("providers")
        .insert({

          user_id: user.id,

          name: name,

          service: service,

          location: location,

          phone: phone,

          description: description

        });


      if (error) {

        console.error(error);

        providerMessage.textContent =
          error.message;

        submitProvider.disabled = false;

        return;

      }


      providerMessage.textContent =
        "✅ You're now a QuickFix provider!";

      submitProvider.disabled = false;


      setTimeout(
        function () {

          closeModal(providerModal);

        },
        1200
      );

    }
  );


  closeProvider.addEventListener(
    "click",
    function () {

      closeModal(providerModal);

    }
  );


  // ==========================================
  // REQUEST SERVICE
  // ==========================================

  submitRequest.addEventListener(
    "click",
    async function () {

      if (!selectedProvider) {

        return;

      }


      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (!user) {

        closeModal(requestModal);

        authMode = "signup";

        updateAuthMode();

        authMessage.textContent =
          "Create an account before requesting a service.";

        openModal(authModal);

        return;

      }


      const description =
        requestDescription.value.trim();

      const location =
        requestLocation.value.trim();

      const phone =
        requestPhone.value.trim();


      if (
        !description ||
        !location ||
        !phone
      ) {

        requestMessage.textContent =
          "Please complete all fields.";

        return;

      }


      submitRequest.disabled = true;

      requestMessage.textContent =
        "Sending request...";


      const {
        error
      } = await supabase
        .from("service_requests")
        .insert({

          customer_id: user.id,

          provider_id: selectedProvider.id,

          service: selectedProvider.service,

          description: description,

          location: location,

          phone: phone,

          status: "pending"

        });


      if (error) {

        console.error(error);

        requestMessage.textContent =
          error.message;

        submitRequest.disabled = false;

        return;

      }


      requestMessage.textContent =
        "✅ Request sent!";


      setTimeout(
        function () {

          closeModal(requestModal);

          loadCustomerRequests();

        },
        1000
      );


      submitRequest.disabled = false;

    }
  );


  closeRequest.addEventListener(
    "click",
    function () {

      closeModal(requestModal);

    }
  );


  // ==========================================
  // CUSTOMER DASHBOARD
  // ==========================================

  async function loadCustomerRequests() {

    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();


    if (!user) {

      customerDashboardMessage.textContent =
        "Please log in.";

      return;

    }


    const {
      data,
      error
    } = await supabase
      .from("service_requests")
      .select(`
        *,
        providers (
          name,
          phone
        )
      `)
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

      console.error(error);

      customerDashboardMessage.textContent =
        "Unable to load requests.";

      return;

    }


    if (!data || data.length === 0) {

      customerDashboardMessage.textContent =
        "You have no requests yet.";

      customerRequestList.innerHTML = "";

      return;

    }


    customerDashboardMessage.textContent =
      `${data.length} request${data.length > 1 ? "s" : ""}`;


    customerRequestList.innerHTML = "";


    data.forEach(
      function (request) {

        const card =
          document.createElement("div");

        card.className =
          "request-card";


        card.innerHTML = `

          <h3>
            🛠️ ${request.service}
          </h3>

          <p>
            <strong>Provider:</strong>
            ${request.providers?.name || "Provider"}
          </p>

          <p>
            📍 ${request.location}
          </p>

          <p>
            ${request.description}
          </p>

          <p>
            <strong>Status:</strong>
            ${request.status.toUpperCase()}
          </p>

          ${
            request.status === "accepted"
            ? `
              <a
                class="contact-btn"
                href="tel:${request.providers?.phone || ""}"
              >
                📞 Contact Provider
              </a>
            `
            : ""
          }

        `;


        customerRequestList.appendChild(card);

      }
    );

  }


  // ==========================================
  // PROVIDER DASHBOARD
  // ==========================================

  async function loadProviderRequests() {

    const {
      data: {
        user
      }
    } = await supabase.auth.getUser();


    if (!user) {

      dashboardMessage.textContent =
        "Please log in.";

      return;

    }


    const {
      data: provider,
      error: providerError
    } = await supabase
      .from("providers")
      .select("id,name")
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();


    if (providerError || !provider) {

      dashboardMessage.textContent =
        "You are not registered as a provider yet.";

      requestList.innerHTML = "";

      return;

    }


    const {
      data,
      error
    } = await supabase
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

      console.error(error);

      dashboardMessage.textContent =
        "Unable to load requests.";

      return;

    }


    if (!data || data.length === 0) {

      dashboardMessage.textContent =
        "No service requests yet.";

      requestList.innerHTML = "";

      return;

    }


    dashboardMessage.textContent =
      `${data.length} request${data.length > 1 ? "s" : ""}`;


    requestList.innerHTML = "";


    data.forEach(
      function (request) {

        const card =
          document.createElement("div");

        card.className =
          "request-card";


        card.innerHTML = `

          <h3>
            🛠️ ${request.service}
          </h3>

          <p>
            <strong>Problem:</strong>
            ${request.description}
          </p>

          <p>
            📍 ${request.location}
          </p>

          <p>
            📞 ${request.phone}
          </p>

          <p>
            <strong>Status:</strong>
            ${request.status.toUpperCase()}
          </p>

          ${
            request.status === "pending"
            ? `

              <button
                class="accept-btn"
                data-id="${request.id}"
              >
                ✅ Accept
              </button>

              <button
                class="decline-btn"
                data-id="${request.id}"
              >
                ❌ Decline
              </button>

            `
            : ""
          }

        `;


        const accept =
          card.querySelector(
            ".accept-btn"
          );

        const decline =
          card.querySelector(
            ".decline-btn"
          );


        if (accept) {

          accept.addEventListener(
            "click",
            function () {

              updateRequest(
                request.id,
                "accepted"
              );

            }
          );

        }


        if (decline) {

          decline.addEventListener(
            "click",
            function () {

              updateRequest(
                request.id,
                "declined"
              );

            }
          );

        }


        requestList.appendChild(card);

      }
    );

  }


  async function updateRequest(
    id,
    status
  ) {

    const {
      error
    } = await supabase
      .from("service_requests")
      .update({

        status: status,

        provider_response_at:
          new Date().toISOString()

      })
      .eq(
        "id",
        id
      );


    if (error) {

      console.error(error);

      alert(
        "Unable to update request."
      );

      return;

    }


    loadProviderRequests();

  }


  // ==========================================
  // ACCOUNT
  // ==========================================

  accountButton.addEventListener(
    "click",
    async function () {

      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (!user) {

        authMode = "login";

        updateAuthMode();

        openModal(authModal);

        return;

      }


      accountEmail.textContent =
        user.email;

      accountMessage.textContent = "";

      openModal(accountModal);

    }
  );


  closeAccount.addEventListener(
    "click",
    function () {

      closeModal(accountModal);

    }
  );


  openCustomerDashboard.addEventListener(
    "click",
    async function () {

      closeModal(accountModal);

      providerDashboard.style.display =
        "none";

      customerDashboard.style.display =
        "block";

      customerDashboard.scrollIntoView({
        behavior: "smooth"
      });

      await loadCustomerRequests();

    }
  );


  openProviderDashboard.addEventListener(
    "click",
    async function () {

      closeModal(accountModal);

      customerDashboard.style.display =
        "none";

      providerDashboard.style.display =
        "block";

      providerDashboard.scrollIntoView({
        behavior: "smooth"
      });

      await loadProviderRequests();

    }
  );


  // ==========================================
  // LOGOUT
  // ==========================================

  logoutButton.addEventListener(
    "click",
    async function () {

      await supabase.auth.signOut();

      closeModal(accountModal);

      alert(
        "You have been logged out."
      );

    }
  );


  // ==========================================
  // CLOSE MODAL WHEN CLICKING BACKGROUND
  // ==========================================

  [
    authModal,
    providerModal,
    requestModal,
    accountModal
  ].forEach(
    function (modal) {

      modal.addEventListener(
        "click",
        function (event) {

          if (event.target === modal) {

            closeModal(modal);

          }

        }
      );

    }
  );


  // ==========================================
  // QUICKFIX READY
  // ==========================================

  console.log(
    "✅ QuickFix production MVP loaded."
  );

});
