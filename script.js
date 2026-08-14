document.addEventListener("DOMContentLoaded", function () {

    // ==============================
    // SUPABASE CONNECTION
    // ==============================

    const SUPABASE_URL = "https://dpaqoamvgxbcztoaxxqv.supabase.co/rest/v1/";

    const SUPABASE_KEY = "sb_publishable_PmI-ae0wRI4rrGg00KLHAA_Pws_TFJm";

    const supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


    // ==============================
    // ELEMENTS
    // ==============================

    const searchInput = document.querySelector(".search-box input");
    const searchButton = document.querySelector(".search-box button");
    const serviceCards = document.querySelectorAll(".service-card");
    const navLinks = document.querySelectorAll(".nav-links a");
    const getStartedButton = document.querySelector(".nav-btn");


    // ==============================
    // RESULTS SECTION
    // ==============================

    const resultsSection = document.createElement("section");

    resultsSection.id = "results";
    resultsSection.className = "results";
    resultsSection.style.display = "none";

    document.querySelector("main").insertBefore(
        resultsSection,
        document.querySelector("#services")
    );


    // ==============================
    // SEARCH PROVIDERS
    // ==============================

    async function searchService() {

        const search = searchInput.value.trim();

        if (search === "") {
            alert("Please enter the problem you need help with.");
            searchInput.focus();
            return;
        }

        resultsSection.style.display = "block";

        resultsSection.innerHTML = `
            <h2>🔎 Finding help...</h2>
            <p>Searching QuickFix providers for "${search}"</p>
        `;

        resultsSection.scrollIntoView({
            behavior: "smooth"
        });


        try {

            const { data, error } = await supabase
                .from("providers")
                .select("*")
                .ilike("service", `%${search}%`);


            if (error) {
                console.error(error);

                resultsSection.innerHTML = `
                    <h2>⚠️ Something went wrong</h2>
                    <p>We couldn't connect to QuickFix providers.</p>
                `;

                return;
            }


            // ==============================
            // NO PROVIDERS
            // ==============================

            if (!data || data.length === 0) {

                resultsSection.innerHTML = `
                    <h2>🔍 No provider found</h2>

                    <p>
                        We couldn't find a provider for
                        "<strong>${search}</strong>" yet.
                    </p>

                    <p>
                        Try another service such as:
                        Plumbing, Electrical, Phone Repair,
                        Computer Help, Car Repair or Home Repairs.
                    </p>
                `;

                return;
            }


            // ==============================
            // PROVIDERS FOUND
            // ==============================

            resultsSection.innerHTML = `
                <h2>🛠️ ${search} providers</h2>

                <p>
                    We found ${data.length} provider${data.length > 1 ? "s" : ""}.
                </p>

                <div class="provider-list"></div>
            `;


            const providerList =
                resultsSection.querySelector(".provider-list");


            data.forEach(function (provider) {

                const card = document.createElement("div");

                card.className = "provider-card";


                card.innerHTML = `
                    <div class="provider-info">

                        <h3>🛠️ ${provider.name}</h3>

                        <p>📍 ${provider.location || "Location not provided"}</p>

                        <p>
                            ${provider.description || "Professional local service provider."}
                        </p>

                        <p>
                            ⭐ ${provider.rating || "New provider"}
                        </p>

                    </div>

                    <div class="provider-actions">

                        ${
                            provider.phone
                            ? `<a
                                class="contact-btn"
                                href="tel:${provider.phone}">
                                📞 Call Provider
                               </a>`
                            : ""
                        }

                    </div>
                `;


                providerList.appendChild(card);

            });

        }

        catch (error) {

            console.error(error);

            resultsSection.innerHTML = `
                <h2>⚠️ Connection error</h2>
                <p>Please try again.</p>
            `;

        }

    }


    // ==============================
    // FIND A FIX
    // ==============================

    searchButton.addEventListener(
        "click",
        searchService
    );


    // ENTER KEY

    searchInput.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Enter") {
                searchService();
            }

        }
    );


    // ==============================
    // SERVICE CARDS
    // ==============================

    serviceCards.forEach(function (card) {

        card.style.cursor = "pointer";

        card.addEventListener(
            "click",
            function () {

                const serviceName =
                    card.querySelector("h3").textContent;

                searchInput.value = serviceName;

                searchService();

            }
        );

    });


    // ==============================
    // GET STARTED
    // ==============================

    getStartedButton.addEventListener(
        "click",
        function () {

            searchInput.focus();

            document.querySelector(".hero").scrollIntoView({
                behavior: "smooth"
            });

        }
    );


    // ==============================
    // NAVIGATION
    // ==============================

    navLinks.forEach(function (link) {

        link.addEventListener(
            "click",
            function (event) {

                const destination =
                    link.getAttribute("href");


                if (destination === "#") {

                    event.preventDefault();

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });

                    return;
                }


                const section =
                    document.querySelector(destination);


                if (section) {

                    event.preventDefault();

                    section.scrollIntoView({
                        behavior: "smooth"
                    });

                }

            }
        );

    });

});
