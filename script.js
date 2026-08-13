document.addEventListener("DOMContentLoaded", function () {

    const searchInput = document.querySelector(".search-box input");
    const searchButton = document.querySelector(".search-box button");
    const serviceCards = document.querySelectorAll(".service-card");
    const navLinks = document.querySelectorAll(".nav-links a");
    const getStartedButton = document.querySelector(".nav-btn");

    // Available QuickFix services
    const services = {
        plumbing: {
            icon: "🔧",
            name: "Plumbing",
            description: "Find plumbers for leaks, blocked pipes, taps and other plumbing problems."
        },
        electrical: {
            icon: "⚡",
            name: "Electrical",
            description: "Find electricians for wiring, sockets, lighting and electrical repairs."
        },
        "phone repair": {
            icon: "📱",
            name: "Phone Repair",
            description: "Find technicians who can repair phones, screens, batteries and software problems."
        },
        "computer help": {
            icon: "💻",
            name: "Computer Help",
            description: "Find computer technicians for repairs, software installation and technical problems."
        },
        "car repair": {
            icon: "🚗",
            name: "Car Repair",
            description: "Find mechanics for vehicle repairs, servicing and maintenance."
        },
        "home repairs": {
            icon: "🏠",
            name: "Home Repairs",
            description: "Find skilled workers for general home maintenance and repairs."
        }
    };

    // Create results section
    const resultsSection = document.createElement("section");
    resultsSection.id = "results";
    resultsSection.className = "results";
    resultsSection.style.display = "none";

    document.querySelector("main").insertBefore(
        resultsSection,
        document.querySelector("#services")
    );

    // Search function
    function searchService() {

        const search = searchInput.value.trim().toLowerCase();

        if (search === "") {
            alert("Please enter a problem or service.");
            searchInput.focus();
            return;
        }

        let foundService = null;

        for (const key in services) {
            if (
                search.includes(key) ||
                key.includes(search) ||
                services[key].name.toLowerCase().includes(search)
            ) {
                foundService = services[key];
                break;
            }
        }

        resultsSection.style.display = "block";

        if (foundService) {

            resultsSection.innerHTML = `
                <h2>${foundService.icon} ${foundService.name}</h2>
                <p>${foundService.description}</p>

                <div class="provider-card">
                    <div>
                        <h3>${foundService.icon} Local ${foundService.name} Provider</h3>
                        <p>📍 Available in your area</p>
                        <p>⭐ Trusted local service</p>
                    </div>

                    <button class="contact-btn">
                        Contact Provider
                    </button>
                </div>

                <p class="demo-note">
                    QuickFix is currently showing a demo provider.
                    Real providers will be connected later.
                </p>
            `;

            resultsSection.scrollIntoView({
                behavior: "smooth"
            });

            const contactButton =
                resultsSection.querySelector(".contact-btn");

            contactButton.addEventListener("click", function () {
                alert("Provider contact functionality will be connected next.");
            });

        } else {

            resultsSection.innerHTML = `
                <h2>🔍 No exact service found</h2>
                <p>
                    We couldn't find a service matching
                    "<strong>${search}</strong>".
                </p>
                <p>
                    Try: Plumbing, Electrical, Phone Repair,
                    Computer Help, Car Repair or Home Repairs.
                </p>
            `;

            resultsSection.scrollIntoView({
                behavior: "smooth"
            });
        }
    }

    // Find a Fix button
    searchButton.addEventListener("click", searchService);

    // Press Enter to search
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            searchService();
        }
    });

    // Service cards
    serviceCards.forEach(function (card) {

        card.style.cursor = "pointer";

        card.addEventListener("click", function () {

            const serviceName =
                card.querySelector("h3").textContent;

            searchInput.value = serviceName;

            searchService();
        });
    });

    // Get Started button
    getStartedButton.addEventListener("click", function () {

        searchInput.focus();

        document.querySelector(".hero").scrollIntoView({
            behavior: "smooth"
        });
    });

    // Navigation
    navLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            const destination = link.getAttribute("href");

            if (destination === "#") {
                event.preventDefault();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

                return;
            }

            const section = document.querySelector(destination);

            if (section) {
                event.preventDefault();

                section.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    });

});
