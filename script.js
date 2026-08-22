document.addEventListener("DOMContentLoaded", function () {

    // ==========================================
    // SUPABASE CONNECTION
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
    // GET WEBSITE ELEMENTS
    // ==========================================

    const searchInput =
        document.querySelector(".search-box input");

    const searchButton =
        document.querySelector(".search-box button");

    const serviceCards =
        document.querySelectorAll(".service-card");

    const navLinks =
        document.querySelectorAll(".nav-links a");

    const getStartedButton =
        document.querySelector(".nav-btn");

    const joinProviderButton =
        document.querySelector("#joinProvider");

    const providerFormSection =
        document.querySelector("#provider-form-section");

    const closeProviderButton =
        document.querySelector("#closeProvider");

    const submitProviderButton =
        document.querySelector("#submitProvider");

    const providerMessage =
        document.querySelector("#providerMessage");
// ==========================================
// AUTH ELEMENTS
// ==========================================

const authModal =
    document.querySelector("#auth-modal");

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

let authMode = "signup";

    // ==========================================
    // REQUEST ELEMENTS
    // ==========================================

    const requestModal =
        document.querySelector("#request-modal");

    const closeRequest =
        document.querySelector("#closeRequest");

    const requestProviderName =
        document.querySelector("#requestProviderName");

    const requestDescription =
        document.querySelector("#requestDescription");

    const requestLocation =
        document.querySelector("#requestLocation");

    const requestPhone =
        document.querySelector("#requestPhone");

    const submitRequest =
        document.querySelector("#submitRequest");

    const requestMessage =
        document.querySelector("#requestMessage");

    let selectedProvider = null;


    // ==========================================
    // CHECK IMPORTANT ELEMENTS
    // ==========================================

    if (!searchInput) {
        console.error("QuickFix: Search input not found.");
        return;
    }

    if (!searchButton) {
        console.error("QuickFix: Search button not found.");
        return;
    }


    // ==========================================
    // CREATE RESULTS SECTION
    // ==========================================

    const resultsSection =
        document.createElement("section");

    resultsSection.id = "results";
    resultsSection.className = "results";
    resultsSection.style.display = "none";

    const main =
        document.querySelector("main");

    const servicesSection =
        document.querySelector("#services");

    if (main && servicesSection) {
        main.insertBefore(
            resultsSection,
            servicesSection
        );
    }


    // ==========================================
    // OPEN REQUEST MODAL
    // ==========================================

    function openRequestModal(provider) {

        if (!requestModal) {
            return;
        }

        selectedProvider = provider;

        if (requestProviderName) {
            requestProviderName.textContent =
                `Requesting ${provider.service} from ${provider.name}`;
        }

        if (requestDescription) {
            requestDescription.value = "";
        }

        if (requestLocation) {
            requestLocation.value = "";
        }

        if (requestPhone) {
            requestPhone.value = "";
        }

        if (requestMessage) {
            requestMessage.textContent = "";
        }

        requestModal.classList.add("active");

        document.body.classList.add("modal-open");
    }


    // ==========================================
    // CLOSE REQUEST MODAL
    // ==========================================

    function closeRequestModal() {

        if (!requestModal) {
            return;
        }

        requestModal.classList.remove("active");

        document.body.classList.remove("modal-open");
    }


    if (closeRequest) {
        closeRequest.addEventListener(
            "click",
            closeRequestModal
        );
    }


    // ==========================================
    // SEND SERVICE REQUEST
    // ==========================================

    if (submitRequest) {

        submitRequest.addEventListener(
            "click",
            async function () {

                if (!selectedProvider) {
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


                // Check logged-in user

                const {
                    data: {
                        user
                    }
                } = await supabase.auth.getUser();


                if (!user) {

                    requestMessage.textContent =
                        "Please log in before requesting a service.";

                    return;
                }


                submitRequest.disabled = true;

                requestMessage.textContent =
                    "Sending request...";


                try {

                    const {
                        error
                    } = await supabase
                        .from("service_requests")
                        .insert([
                            {
                                customer_id: user.id,
                                provider_id: selectedProvider.id,
                                service: selectedProvider.service,
                                description: description,
                                location: location,
                                phone: phone,
                                status: "pending"
                            }
                        ]);


                    if (error) {

                        console.error(
                            "Service request error:",
                            error
                        );

                        requestMessage.textContent =
                            "Failed to send request.";

                        submitRequest.disabled = false;

                        return;
                    }


                    requestMessage.textContent =
                        "✅ Request sent successfully!";


                    setTimeout(
                        function () {

                            closeRequestModal();

                        },
                        1500
                    );


                } catch (error) {

                    console.error(
                        "Request failed:",
                        error
                    );

                    requestMessage.textContent =
                        "Something went wrong.";

                }


                submitRequest.disabled = false;

            }
        );

    }


    // ==========================================
    // SEARCH FOR PROVIDERS
    // ==========================================

    async function searchService() {

        const search =
            searchInput.value.trim();


        if (search === "") {

            alert(
                "Please enter the problem or service you need help with."
            );

            searchInput.focus();

            return;
        }


        resultsSection.style.display = "block";

        resultsSection.innerHTML = `
            <h2>🔎 Finding help...</h2>

            <p>
                Searching QuickFix providers for
                "<strong>${search}</strong>"
            </p>
        `;


        resultsSection.scrollIntoView({
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

                console.error(
                    "Supabase search error:",
                    error
                );

                resultsSection.innerHTML = `
                    <h2>⚠️ Something went wrong</h2>

                    <p>
                        We couldn't connect to QuickFix providers.
                    </p>

                    <p>
                        Please try again.
                    </p>
                `;

                return;
            }


            if (!data || data.length === 0) {

                resultsSection.innerHTML = `
                    <h2>🔍 No provider found</h2>

                    <p>
                        We couldn't find a provider for
                        "<strong>${search}</strong>" yet.
                    </p>

                    <p>
                        Try:
                        Plumbing,
                        Electrical,
                        Phone Repair,
                        Computer Help,
                        Car Repair,
                        or Home Repairs.
                    </p>
                `;

                return;
            }


            resultsSection.innerHTML = `
                <h2>🛠️ ${search} providers</h2>

                <p>
                    We found
                    ${data.length}
                    provider${data.length > 1 ? "s" : ""}.
                </p>

                <div class="provider-list"></div>
            `;


            const providerList =
                resultsSection.querySelector(
                    ".provider-list"
                );


            // ==========================================
            // PROVIDER CARDS
            // ==========================================

            data.forEach(
                function (provider) {

                    const card =
                        document.createElement("div");

                    card.className =
                        "provider-card";


                    card.innerHTML = `

                        <div class="provider-info">

                            <h3>
                                🛠️ ${provider.name}
                            </h3>

                            <p>
                                📍 ${
                                    provider.location ||
                                    "Location not provided"
                                }
                            </p>

                            <p>
                                ${
                                    provider.description ||
                                    "Professional local service provider."
                                }
                            </p>

                            <p>
                                ⭐ ${
                                    provider.rating ||
                                    "New provider"
                                }
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
                                            📞 Call Provider
                                        </a>

                                        <button
                                            class="contact-btn request-service-btn"
                                            type="button"
                                        >
                                            📋 Request Service
                                        </button>
                                    `
                                    : `
                                        <span>
                                            Contact unavailable
                                        </span>
                                    `
                            }

                        </div>

                    `;


                    const requestButton =
                        card.querySelector(
                            ".request-service-btn"
                        );


                    if (requestButton) {

                        requestButton.addEventListener(
                            "click",
                            function () {

                                openRequestModal(
                                    provider
                                );

                            }
                        );

                    }


                    providerList.appendChild(card);

                }
            );

        }


        catch (error) {

            console.error(
                "QuickFix connection error:",
                error
            );

            resultsSection.innerHTML = `
                <h2>⚠️ Connection error</h2>

                <p>
                    Something went wrong while
                    searching for providers.
                </p>

                <p>
                    Please try again.
                </p>
            `;

        }

    }


    // ==========================================
    // FIND A FIX BUTTON
    // ==========================================

    searchButton.addEventListener(
        "click",
        searchService
    );


    // ==========================================
    // PRESS ENTER TO SEARCH
    // ==========================================

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

            card.style.cursor =
                "pointer";


            card.addEventListener(
                "click",
                function () {

                    const heading =
                        card.querySelector("h3");


                    if (!heading) {
                        return;
                    }


                    const serviceName =
                        heading.textContent.trim();


                    searchInput.value =
                        serviceName;


                    searchService();

                }
            );

        }
    );


    // ==========================================
    // GET STARTED BUTTON
    // ==========================================

    if (getStartedButton) {

        getStartedButton.addEventListener(
            "click",
            function () {

                const hero =
                    document.querySelector(".hero");


                if (hero) {

                    hero.scrollIntoView({
                        behavior: "smooth"
                    });

                }


                setTimeout(
                    function () {

                        searchInput.focus();

                    },
                    500
                );

            }
        );

    }


    // ==========================================
    // OPEN PROVIDER MODAL
    // ==========================================

    function openProviderModal() {

        if (!providerFormSection) {
            return;
        }

        providerFormSection.classList.add("active");

        document.body.classList.add("modal-open");

        if (providerMessage) {
            providerMessage.textContent = "";
        }

    }


    // ==========================================
    // CLOSE PROVIDER MODAL
    // ==========================================

    function closeProviderModal() {

        if (!providerFormSection) {
            return;
        }

        providerFormSection.classList.remove("active");

        document.body.classList.remove("modal-open");

    }


    // ==========================================
    // JOIN AS PROVIDER
    // ==========================================

    // ==========================================
// AUTHENTICATION
// ==========================================

function openAuthModal() {

    authModal.classList.add("active");
    document.body.classList.add("modal-open");

    authMessage.textContent = "";

}


function closeAuthModal() {

    authModal.classList.remove("active");
    document.body.classList.remove("modal-open");

}


function updateAuthMode() {

    if (authMode === "signup") {

        authTitle.textContent =
            "Create Your Account";

        authIntro.textContent =
            "Create an account to join QuickFix as a provider.";

        authSubmit.textContent =
            "Create Account";

        switchAuthMode.textContent =
            "Already have an account? Log in";

    } else {

        authTitle.textContent =
            "Welcome Back";

        authIntro.textContent =
            "Log in to continue to QuickFix.";

        authSubmit.textContent =
            "Log In";

        switchAuthMode.textContent =
            "Don't have an account? Create one";

    }

}


if (closeAuth) {

    closeAuth.addEventListener(
        "click",
        closeAuthModal
    );

}


if (switchAuthMode) {

    switchAuthMode.addEventListener(
        "click",
        function () {

            authMode =
                authMode === "signup"
                    ? "login"
                    : "signup";

            updateAuthMode();

            authMessage.textContent = "";

        }
    );

}


if (authSubmit) {

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

                console.error(result.error);

                authMessage.textContent =
                    result.error.message;

                authSubmit.disabled = false;

                return;

            }


            // SIGNUP
            if (authMode === "signup") {

                if (!result.data.session) {

                    authMessage.textContent =
                        "✅ Account created! Check your email, verify it, then log in.";

                    authSubmit.disabled = false;

                    return;

                }

            }


            // LOGIN SUCCESS
            authMessage.textContent =
                "✅ Login successful!";


            setTimeout(
                function () {

                    closeAuthModal();

                    openProviderModal();

                    authSubmit.disabled = false;

                },
                700
            );

        }
    );

}


// ==========================================
// JOIN AS PROVIDER
// ==========================================

if (joinProviderButton) {

    joinProviderButton.addEventListener(
        "click",
        async function () {

            const {
                data: {
                    user
                }
            } = await supabase.auth.getUser();


            if (user) {

                openProviderModal();

            } else {

                authMode = "signup";

                updateAuthMode();

                openAuthModal();

            }

        }
    );

}


    // ==========================================
    // CLOSE PROVIDER BUTTON
    // ==========================================

    if (closeProviderButton) {

        closeProviderButton.addEventListener(
            "click",
            closeProviderModal
        );

    }


    // ==========================================
    // CLICK OUTSIDE PROVIDER MODAL
    // ==========================================

    if (providerFormSection) {

        providerFormSection.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    providerFormSection
                ) {

                    closeProviderModal();

                }

            }
        );

    }


    // ==========================================
    // ESCAPE KEY
    // ==========================================

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                closeProviderModal();

                closeRequestModal();

            }

        }
    );


    // ==========================================
    // PROVIDER REGISTRATION
    // ==========================================

    if (submitProviderButton) {

        submitProviderButton.addEventListener(
            "click",
            async function () {

                const nameInput =
                    document.querySelector(
                        "#providerName"
                    );

                const serviceInput =
                    document.querySelector(
                        "#providerService"
                    );

                const locationInput =
                    document.querySelector(
                        "#providerLocation"
                    );

                const phoneInput =
                    document.querySelector(
                        "#providerPhone"
                    );

                const descriptionInput =
                    document.querySelector(
                        "#providerDescription"
                    );


                if (
                    !nameInput ||
                    !serviceInput ||
                    !locationInput ||
                    !phoneInput
                ) {

                    console.error(
                        "QuickFix: Provider form elements are missing."
                    );

                    return;

                }


                const name =
                    nameInput.value.trim();

                const service =
                    serviceInput.value.trim();

                const location =
                    locationInput.value.trim();

                const phone =
                    phoneInput.value.trim();

                const description =
                    descriptionInput
                        ? descriptionInput.value.trim()
                        : "";


                if (
                    !name ||
                    !service ||
                    !location ||
                    !phone
                ) {

                    providerMessage.textContent =
                        "Please fill in all required fields.";

                    return;

                }


                providerMessage.textContent =
                    "Checking your account...";

                submitProviderButton.disabled = true;


                try {

                    // ==================================
                    // GET CURRENT USER
                    // ==================================

                    const {
                        data: {
                            user
                        }
                    } = await supabase.auth.getUser();


                    if (!user) {

                        providerMessage.textContent =
                            "Please log in before creating a provider profile.";

                        submitProviderButton.disabled = false;

                        return;

                    }


                    providerMessage.textContent =
                        "Submitting your provider profile...";


                    // ==================================
                    // INSERT PROVIDER
                    // ==================================

                    const {
                        error
                    } = await supabase
                        .from("providers")
                        .insert([
                            {
                                user_id: user.id,
                                name: name,
                                service: service,
                                location: location,
                                phone: phone,
                                description: description,
                                verified: false
                            }
                        ]);


                    if (error) {

                        console.error(
                            "Provider registration error:",
                            error
                        );

                        providerMessage.textContent =
                            error.message;

                        submitProviderButton.disabled = false;

                        return;

                    }


                    providerMessage.textContent =
                        "✅ You're now listed on QuickFix!";


                    nameInput.value = "";
                    serviceInput.value = "";
                    locationInput.value = "";
                    phoneInput.value = "";

                    if (descriptionInput) {
                        descriptionInput.value = "";
                    }


                    submitProviderButton.disabled = false;


                    setTimeout(
                        function () {

                            closeProviderModal();

                        },
                        1800
                    );

                }


                catch (error) {

                    console.error(
                        "Provider registration failed:",
                        error
                    );

                    providerMessage.textContent =
                        "Something went wrong. Please try again.";

                    submitProviderButton.disabled = false;

                }

            }
        );

    }


    // ==========================================
    // NAVIGATION
    // ==========================================

    navLinks.forEach(
        function (link) {

            link.addEventListener(
                "click",
                function (event) {

                    const destination =
                        link.getAttribute("href");


                    if (
                        !destination ||
                        destination === "#"
                    ) {

                        event.preventDefault();

                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });

                        return;

                    }


                    const section =
                        document.querySelector(
                            destination
                        );


                    if (section) {

                        event.preventDefault();

                        section.scrollIntoView({
                            behavior: "smooth"
                        });

                    }

                }
            );

        }
    );

// ==========================================
// PROVIDER DASHBOARD
// ==========================================

const dashboard =
    document.querySelector("#provider-dashboard");

const requestList =
    document.querySelector("#request-list");

const dashboardMessage =
    document.querySelector("#dashboardMessage");


async function loadProviderRequests() {

    if (!dashboard || !requestList) {
        return;
    }

    const {
        data: {
            user
        }
    } = await supabase.auth.getUser();

    if (!user) {
        dashboardMessage.textContent =
            "Log in as a provider to view your requests.";

        return;
    }

    const {
        data: provider,
        error: providerError
    } = await supabase
        .from("providers")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

    if (providerError || !provider) {

        dashboardMessage.textContent =
            "You don't have a provider profile yet.";

        return;
    }

    const {
        data: requests,
        error
    } = await supabase
        .from("service_requests")
        .select("*")
        .eq("provider_id", provider.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {

        console.error(error);

        dashboardMessage.textContent =
            "Unable to load requests.";

        return;
    }

    if (!requests || requests.length === 0) {

        dashboardMessage.textContent =
            "No service requests yet.";

        requestList.innerHTML = "";

        return;
    }

    dashboardMessage.textContent =
        `${requests.length} request${requests.length > 1 ? "s" : ""}`;

    requestList.innerHTML = "";

    requests.forEach(function (request) {

        const card =
            document.createElement("div");

        card.className =
            "request-card";

        card.innerHTML = `

            <h3>🛠️ ${request.service}</h3>

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
                ${request.status}
            </p>

            ${
                request.status === "pending"
                    ? `
                        <button class="accept-request">
                            ✅ Accept
                        </button>

                        <button class="decline-request">
                            ❌ Decline
                        </button>
                    `
                    : ""
            }

        `;


        const acceptButton =
            card.querySelector(".accept-request");

        const declineButton =
            card.querySelector(".decline-request");


        if (acceptButton) {

            acceptButton.addEventListener(
                "click",
                function () {

                    updateRequestStatus(
                        request.id,
                        "accepted"
                    );

                }
            );

        }


        if (declineButton) {

            declineButton.addEventListener(
                "click",
                function () {

                    updateRequestStatus(
                        request.id,
                        "declined"
                    );

                }
            );

        }


        requestList.appendChild(card);

    });

}


async function updateRequestStatus(
    requestId,
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
        .eq("id", requestId);


    if (error) {

        console.error(error);

        alert(
            "Unable to update request."
        );

        return;
    }


    loadProviderRequests();

}


// Load dashboard
loadProviderRequests();
    
    // ==========================================
    // QUICKFIX READY
    // ==========================================

    console.log(
        "✅ QuickFix is ready."
    );

});
