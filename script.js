document.addEventListener("DOMContentLoaded", () => {

    console.log("QuickFix JavaScript loaded successfully");

    // Find a Fix button
    const findButtons = document.querySelectorAll("button");

    findButtons.forEach(button => {
        button.addEventListener("click", () => {

            const searchInput = document.querySelector(".search-box input");

            if (searchInput) {
                const problem = searchInput.value.trim();

                if (problem === "") {
                    alert("Please enter a problem you need help with.");
                    searchInput.focus();
                    return;
                }

                alert("Finding help for: " + problem);
            }
        });
    });

    // Service cards
    const serviceCards = document.querySelectorAll(".service-card");

    serviceCards.forEach(card => {
        card.style.cursor = "pointer";

        card.addEventListener("click", () => {
            const service = card.querySelector("h3");

            if (service) {
                alert("You selected: " + service.textContent);
            }
        });
    });

});
