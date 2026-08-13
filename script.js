// QuickFix basic interactions

document.addEventListener("DOMContentLoaded", function () {

    // Find a Fix buttons
    const findFixButtons = document.querySelectorAll(
        "#findFix, .find-fix, button"
    );

    findFixButtons.forEach(function (button) {
        button.addEventListener("click", function () {

            const searchBox = document.querySelector(
                'input[placeholder*="help"], input[placeholder*="problem"]'
            );

            if (searchBox && searchBox.value.trim() !== "") {
                alert("Searching for: " + searchBox.value.trim());
            } else {
                alert("Please enter the problem you need help with.");
            }
        });
    });

});
