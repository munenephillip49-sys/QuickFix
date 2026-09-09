// ==========================================
// QUICKFIX REVIEWS & RATINGS MODULE
// Add this to your script.js file
// ==========================================

// ==========================================
// REVIEWS - HELPER FUNCTIONS
// ==========================================

async function submitReview(requestId, rating, reviewText) {
  if (!requestId || !rating) {
    showToast("Please provide a rating.", "error");
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast("Please log in to leave a review.", "error");
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

  if (request.customer_id !== user.id) {
    showToast("You can only review requests you created.", "error");
    return false;
  }

  const { data, error } = 
    await supabase
      .from("reviews")
      .insert([{
        request_id: requestId,
        customer_id: user.id,
        provider_id: request.provider_id,
        rating: parseInt(rating),
        review_text: reviewText || ""
      }])
      .select()
      .single();

  if (error) {
    console.error("QuickFix review error:", error);
    showToast("Unable to submit review.", "error");
    return false;
  }

  showToast("Review submitted successfully! ⭐");
  return true;
}

async function getProviderRating(providerId) {
  if (!providerId) return null;

  const { data, error } = 
    await supabase
      .from("providers")
      .select("rating, review_count")
      .eq("id", providerId)
      .single();

  if (error) {
    console.error("QuickFix rating error:", error);
    return null;
  }

  return data;
}

async function getProviderReviews(providerId, limit = 5) {
  if (!providerId) return [];

  const { data, error } = 
    await supabase
      .from("reviews")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(limit);

  if (error) {
    console.error("QuickFix reviews error:", error);
    return [];
  }

  return data || [];
}

function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  let stars = "";

  for (let i = 0; i < fullStars; i++) {
    stars += "★";
  }

  if (hasHalfStar) {
    stars += "½";
  }

  for (let i = stars.length; i < 5; i++) {
    stars += "☆";
  }

  return stars;
}

function formatRating(rating) {
  if (!rating) return "No rating";
  return `${rating.toFixed(1)} ${renderStars(rating)}`;
}

// ==========================================
// UPDATE SEARCH RESULTS TO SHOW RATINGS
// ==========================================

async function searchServiceWithRatings() {
  const search = searchInput?.value.trim();

  if (search) {
    localStorage.setItem(QUICKFIX.lastSearchKey, search);
  }

  if (!search) {
    showToast("Enter a service to search.", "error");
    return;
  }

  if (searchButton) {
    searchButton.disabled = true;
    searchButton.textContent = "Searching...";
  }

  const { data, error } =
    await supabase
      .from("providers")
      .select("*")
      .ilike("service", `%${search}%`);

  if (searchButton) {
    searchButton.disabled = false;
    searchButton.textContent = "Search";
  }

  if (error) {
    console.error(error);
    showToast("Unable to search right now.", "error");
    return;
  }

  const resultsSection =
    document.querySelector("#results");

  const resultsContainer =
    document.querySelector("#searchResults");

  const resultsSummary =
    document.querySelector("#searchResultsSummary");

  if (!resultsContainer) {
    showToast("Search results could not be displayed.", "error");
    return;
  }

  if (resultsSection) {
    resultsSection.style.display = "block";
  }

  resultsContainer.innerHTML = "";

  if (!data || data.length === 0) {
    if (resultsSummary)
      resultsSummary.textContent = `No providers found for "${search}".`;

    resultsContainer.innerHTML = `
      <div class="empty-state">
        <h3>No providers found</h3>
        <p>Try another service such as plumbing, electrical, phone repair or computer help.</p>
      </div>
    `;

    resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (resultsSummary)
    resultsSummary.textContent =
      `${data.length} provider${data.length === 1 ? "" : "s"} found for "${search}".`;

  data.forEach(provider => {
    const card = document.createElement("div");
    card.className = "provider-card";

    const saved = isProviderSaved(provider.id);
    const rating = provider.rating || 0;
    const reviewCount = provider.review_count || 0;

    card.innerHTML = `
      <div class="provider-card-main">
        <div class="provider-avatar">
          ${escapeHtml((provider.name || "P").charAt(0).toUpperCase())}
        </div>

        <div class="provider-info">
          <div class="provider-header">
            <div>
              <h3>${escapeHtml(provider.name || "Service Provider")}</h3>
              <div class="provider-rating">
                <span class="rating-stars">${renderStars(rating)}</span>
                <span class="rating-text">${rating > 0 ? rating.toFixed(1) : "New"}</span>
                <span class="review-count">(${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})</span>
              </div>
            </div>
          </div>

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

        <button
          class="view-reviews-btn"
          type="button"
          data-provider-id="${escapeHtml(provider.id)}"
        >
          👁️ Reviews
        </button>
      </div>
    `;

    const saveButton = card.querySelector("[data-save-provider]");
    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const nowSaved = toggleSavedProvider(provider);
        saveButton.classList.toggle("saved", nowSaved);
        saveButton.textContent = nowSaved ? "★ Saved" : "☆ Save";
        showToast(
          nowSaved
            ? "Provider saved."
            : "Provider removed from saved."
        );
      });
    }

    const requestButton = card.querySelector(".request-provider-btn");
    if (requestButton) {
      requestButton.addEventListener("click", async () => {
        const user = await getCurrentUser();

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

        selectedProvider = provider;

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
          requestPhone.value = provider.phone || "";

        openModal(requestModal);
      });
    }

    const reviewsButton = card.querySelector(".view-reviews-btn");
    if (reviewsButton) {
      reviewsButton.addEventListener("click", async () => {
        await showProviderReviews(provider.id, provider.name);
      });
    }

    resultsContainer.appendChild(card);
  });

  resultsSection?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function showProviderReviews(providerId, providerName) {
  const reviews = await getProviderReviews(providerId, 10);
  const rating = await getProviderRating(providerId);

  const modalContent = document.createElement("div");
  modalContent.className = "modal";
  modalContent.id = "reviewsModal";

  let reviewsHtml = `
    <div class="modal-box">
      <button type="button" class="close-button">×</button>

      <p class="section-label">PROVIDER REVIEWS</p>

      <h2>${escapeHtml(providerName || "Provider")}</h2>

      <div class="provider-rating-summary">
        <div class="rating-large">
          <span class="rating-stars-large">${renderStars(rating?.rating || 0)}</span>
          <span class="rating-number">${rating?.rating > 0 ? rating.rating.toFixed(1) : "New provider"}</span>
        </div>
        <p class="review-count-summary">${rating?.review_count || 0} ${rating?.review_count === 1 ? "review" : "reviews"}</p>
      </div>

      <div class="reviews-list">
  `;

  if (reviews.length === 0) {
    reviewsHtml += `
      <div class="empty-state">
        <p>No reviews yet. Be the first to review this provider!</p>
      </div>
    `;
  } else {
    reviews.forEach(review => {
      reviewsHtml += `
        <div class="review-item">
          <div class="review-header">
            <span class="review-stars">${renderStars(review.rating)}</span>
            <span class="review-rating">${review.rating}/5</span>
          </div>
          <p class="review-text">${escapeHtml(review.review_text || "No comment provided")}</p>
          <p class="review-date">${formatDate(review.created_at)}</p>
        </div>
      `;
    });
  }

  reviewsHtml += `
      </div>
    </div>
  `;

  modalContent.innerHTML = reviewsHtml;
  document.body.appendChild(modalContent);

  const closeBtn = modalContent.querySelector(".close-button");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modalContent.remove();
    });
  }

  modalContent.addEventListener("click", (event) => {
    if (event.target === modalContent) {
      modalContent.remove();
    }
  });

  openModal(modalContent);
}

// ==========================================
// ADD REVIEW FORM TO REQUEST MODAL
// ==========================================

function addReviewFormToModal() {
  const requestModal = document.querySelector("#requestModal");
  if (!requestModal) return;

  const closeRequest = document.querySelector("#closeRequest");
  
  closeRequest?.addEventListener("click", async () => {
    selectedProvider = null;
    closeModal(requestModal);
    
    // Check if any completed requests need reviews
    await checkForReviewableRequests();
  });
}

async function checkForReviewableRequests() {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: requests, error } = 
    await supabase
      .from("service_requests")
      .select("*")
      .eq("customer_id", user.id)
      .eq("status", "completed")
      .is("review_id", null);

  if (error || !requests || requests.length === 0) return;

  // Show review prompt for first completed request
  const request = requests[0];
  showReviewPrompt(request);
}

function showReviewPrompt(request) {
  if (document.querySelector("#reviewPromptModal")) return;

  const modal = document.createElement("section");
  modal.id = "reviewPromptModal";
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-box">
      <button type="button" class="close-button">×</button>

      <p class="section-label">RATE YOUR EXPERIENCE</p>

      <h2>How was the service?</h2>

      <p>Share your feedback to help other customers find great providers.</p>

      <div class="review-form">
        <div class="form-group">
          <label>Rating</label>
          <div class="star-rating">
            <button class="star-btn" data-rating="1">★</button>
            <button class="star-btn" data-rating="2">★</button>
            <button class="star-btn" data-rating="3">★</button>
            <button class="star-btn" data-rating="4">★</button>
            <button class="star-btn" data-rating="5">★</button>
          </div>
        </div>

        <div class="form-group">
          <label>Your Review (Optional)</label>
          <textarea
            id="reviewText"
            placeholder="Tell others about your experience..."
            maxlength="500"
          ></textarea>
        </div>

        <button type="button" id="submitReviewBtn" class="submit-button">
          Submit Review
        </button>

        <p id="reviewMessage" class="message"></p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedRating = 0;
  const starBtns = modal.querySelectorAll(".star-btn");
  const reviewText = modal.querySelector("#reviewText");
  const submitBtn = modal.querySelector("#submitReviewBtn");
  const reviewMessage = modal.querySelector("#reviewMessage");
  const closeBtn = modal.querySelector(".close-button");

  starBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedRating = parseInt(btn.dataset.rating);
      starBtns.forEach((b, index) => {
        b.classList.toggle("active", index < selectedRating);
      });
    });
  });

  submitBtn.addEventListener("click", async () => {
    if (selectedRating === 0) {
      reviewMessage.textContent = "Please select a rating.";
      return;
    }

    setButtonLoading(submitBtn, true, "Submitting...");

    const success = await submitReview(
      request.id,
      selectedRating,
      reviewText.value.trim()
    );

    if (success) {
      modal.remove();
    } else {
      setButtonLoading(submitBtn, false);
    }
  });

  closeBtn.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  openModal(modal);
}

// ==========================================
// CSS STYLES FOR REVIEWS
// ==========================================

function injectReviewStyles() {
  if (document.querySelector("#quickfix-reviews-styles")) return;

  const style = document.createElement("style");
  style.id = "quickfix-reviews-styles";
  style.textContent = `
    .provider-rating {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
      font-size: 0.9rem;
    }

    .rating-stars {
      font-size: 1.1rem;
      color: #2ecc71;
      letter-spacing: 2px;
    }

    .rating-text {
      font-weight: 700;
      color: #2ecc71;
    }

    .review-count {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.85rem;
    }

    .provider-rating-summary {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px;
      background: rgba(46, 204, 113, 0.1);
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .rating-large {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .rating-stars-large {
      font-size: 2rem;
      color: #2ecc71;
      letter-spacing: 4px;
      margin-bottom: 8px;
    }

    .rating-number {
      font-size: 1.5rem;
      font-weight: 800;
      color: #2ecc71;
    }

    .review-count-summary {
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.95rem;
    }

    .reviews-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .review-item {
      padding: 15px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .review-item:last-child {
      border-bottom: none;
    }

    .review-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .review-stars {
      font-size: 1rem;
      color: #2ecc71;
      letter-spacing: 2px;
    }

    .review-rating {
      font-weight: 700;
      color: #2ecc71;
    }

    .review-text {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 8px;
    }

    .review-date {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.85rem;
    }

    .view-reviews-btn {
      border: 1px solid rgba(46, 204, 113, 0.35);
      background: rgba(46, 204, 113, 0.08);
      color: inherit;
      padding: 9px 12px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
    }

    .view-reviews-btn:hover {
      background: rgba(46, 204, 113, 0.15);
    }

    .star-rating {
      display: flex;
      gap: 12px;
      margin: 12px 0;
    }

    .star-btn {
      font-size: 2rem;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      transition: 0.2s ease;
    }

    .star-btn:hover {
      color: #2ecc71;
      transform: scale(1.2);
    }

    .star-btn.active {
      color: #2ecc71;
    }

    #reviewText {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #fff;
      font-family: inherit;
    }

    #reviewText:focus {
      outline: none;
      border-color: rgba(46, 204, 113, 0.5);
    }
  `;

  document.head.appendChild(style);
}

// ==========================================
// INITIALIZE REVIEWS MODULE
// ==========================================

injectReviewStyles();
addReviewFormToModal();

// Override searchService with rating version
if (searchButton) {
  searchButton.removeEventListener("click", searchService);
  searchButton.addEventListener("click", searchServiceWithRatings);
}

if (searchInput) {
  searchInput.removeEventListener("keydown", null);
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchServiceWithRatings();
    }
  });
}

console.log("✅ QuickFix Reviews module loaded");
