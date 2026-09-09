// ==========================================
// QUICKFIX PAYMENTS & STRIPE INTEGRATION
// Add this to your script.js file or import as separate module
// ==========================================

// ==========================================
// STRIPE CONFIGURATION
// ==========================================

// Initialize Stripe (replace with your actual public key)
const STRIPE_PUBLIC_KEY = "pk_test_YOUR_KEY_HERE"; // Replace with actual Stripe key
let stripe = null;
let stripeElements = null;

async function initializeStripe() {
  if (!STRIPE_PUBLIC_KEY.startsWith("pk_")) {
    console.warn("⚠️  Stripe public key not configured. Payments disabled.");
    return false;
  }

  stripe = Stripe(STRIPE_PUBLIC_KEY);
  stripeElements = stripe.elements();
  return true;
}

// ==========================================
// PAYMENT CONFIGURATION
// ==========================================

const PAYMENT_CONFIG = {
  commission_percentage: 15, // QuickFix takes 15%
  min_payment: 5.00,
  max_payment: 999.99,
  currency: "USD"
};

// ==========================================
// PAYMENT HELPER FUNCTIONS
// ==========================================

function calculateCommission(amount) {
  const commission = (amount * PAYMENT_CONFIG.commission_percentage) / 100;
  const providerEarnings = amount - commission;
  return {
    gross: amount,
    commission: Math.round(commission * 100) / 100,
    provider_earnings: Math.round(providerEarnings * 100) / 100
  };
}

async function createPaymentIntent(requestId, amount) {
  if (!requestId || !amount) {
    showToast("Invalid payment details.", "error");
    return null;
  }

  if (amount < PAYMENT_CONFIG.min_payment || amount > PAYMENT_CONFIG.max_payment) {
    showToast(
      `Amount must be between $${PAYMENT_CONFIG.min_payment} and $${PAYMENT_CONFIG.max_payment}.`,
      "error"
    );
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast("Please log in to make a payment.", "error");
    return false;
  }

  // Call backend to create payment intent
  const { data, error } = 
    await supabase
      .functions
      .invoke("create-payment-intent", {
        body: {
          request_id: requestId,
          amount: Math.round(amount * 100), // Stripe uses cents
          customer_id: user.id
        }
      });

  if (error) {
    console.error("Payment intent error:", error);
    showToast("Unable to create payment. Please try again.", "error");
    return null;
  }

  return data?.client_secret;
}

async function processPayment(requestId, amount, paymentMethodId) {
  if (!requestId || !amount || !paymentMethodId) {
    showToast("Missing payment information.", "error");
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast("Please log in to make a payment.", "error");
    return false;
  }

  try {
    // Call backend to process payment
    const { data, error } = 
      await supabase
        .functions
        .invoke("process-payment", {
          body: {
            request_id: requestId,
            amount: Math.round(amount * 100),
            payment_method_id: paymentMethodId,
            customer_id: user.id
          }
        });

    if (error) {
      console.error("Payment processing error:", error);
      showToast("Payment failed. Please try again.", "error");
      return false;
    }

    if (data?.success) {
      // Create transaction record
      const commission = calculateCommission(amount);
      
      const { error: transError } = 
        await supabase
          .from("transactions")
          .insert([{
            request_id: requestId,
            customer_id: user.id,
            provider_id: (
              await supabase
                .from("service_requests")
                .select("provider_id")
                .eq("id", requestId)
                .single()
            ).data?.provider_id,
            amount: amount,
            commission_percentage: PAYMENT_CONFIG.commission_percentage,
            commission_amount: commission.commission,
            provider_earnings: commission.provider_earnings,
            status: "completed",
            stripe_payment_id: data.payment_id,
            stripe_charge_id: data.charge_id,
            payment_method: "stripe"
          }]);

      if (transError) {
        console.error("Transaction record error:", transError);
      }

      showToast("Payment successful! ✓", "success");
      return true;
    }

    return false;
  } catch (err) {
    console.error("Payment processing exception:", err);
    showToast("Payment failed. Please try again.", "error");
    return false;
  }
}

// ==========================================
// PAYMENT MODAL UI
// ==========================================

async function showPaymentModal(requestId, providerName, estimatedAmount = 0) {
  const user = await getCurrentUser();
  if (!user) {
    showToast("Please log in to make a payment.", "error");
    return;
  }

  // Check if modal already exists
  if (document.querySelector("#paymentModal")) {
    document.querySelector("#paymentModal").remove();
  }

  const modal = document.createElement("section");
  modal.id = "paymentModal";
  modal.className = "modal";

  const commission = calculateCommission(estimatedAmount);

  modal.innerHTML = `
    <div class="modal-box payment-modal">
      <button type="button" class="close-button">×</button>

      <p class="section-label">SECURE PAYMENT</p>

      <h2>Pay ${escapeHtml(providerName)}</h2>

      <div class="payment-summary">
        <div class="payment-item">
          <span>Service Amount:</span>
          <span>$<span id="serviceAmount">${estimatedAmount.toFixed(2)}</span></span>
        </div>
        <div class="payment-item">
          <span>QuickFix Fee (${PAYMENT_CONFIG.commission_percentage}%):</span>
          <span>$<span id="commissionAmount">${commission.commission.toFixed(2)}</span></span>
        </div>
        <div class="payment-item total">
          <span>Total:</span>
          <span>$<span id="totalAmount">${commission.gross.toFixed(2)}</span></span>
        </div>
        <div class="payment-item provider">
          <span>Provider Receives:</span>
          <span>$<span id="providerAmount">${commission.provider_earnings.toFixed(2)}</span></span>
        </div>
      </div>

      <div class="payment-form">
        <div class="form-group">
          <label>Service Amount ($)</label>
          <input
            id="paymentAmount"
            type="number"
            placeholder="Enter amount"
            value="${estimatedAmount || ''}"
            min="${PAYMENT_CONFIG.min_payment}"
            max="${PAYMENT_CONFIG.max_payment}"
            step="0.01"
          >
        </div>

        <div class="form-group">
          <label>Card Details</label>
          <div id="cardElement" class="card-element"></div>
        </div>

        <button type="button" id="submitPaymentBtn" class="submit-button">
          Pay $<span id="buttonAmount">${(estimatedAmount || 0).toFixed(2)}</span>
        </button>

        <p id="paymentError" class="message error-message"></p>
        <p id="paymentSuccess" class="message success-message"></p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const amountInput = modal.querySelector("#paymentAmount");
  const submitBtn = modal.querySelector("#submitPaymentBtn");
  const closeBtn = modal.querySelector(".close-button");
  const errorMsg = modal.querySelector("#paymentError");
  const successMsg = modal.querySelector("#paymentSuccess");

  // Create card element if Stripe is initialized
  if (stripe && stripeElements) {
    const cardElement = stripeElements.create("card", {
      style: {
        base: {
          color: "#fff",
          fontFamily: "inherit",
          fontSize: "16px",
          "::placeholder": {
            color: "rgba(255,255,255,0.5)"
          }
        },
        invalid: {
          color: "#ff5050"
        }
      }
    });

    const cardContainer = modal.querySelector("#cardElement");
    if (cardContainer) {
      cardElement.mount(cardContainer);
    }
  } else {
    errorMsg.textContent = "Payment processing not available. Please contact support.";
    submitBtn.disabled = true;
  }

  // Update totals when amount changes
  amountInput.addEventListener("change", () => {
    const amount = parseFloat(amountInput.value) || 0;
    const calc = calculateCommission(amount);

    modal.querySelector("#serviceAmount").textContent = amount.toFixed(2);
    modal.querySelector("#commissionAmount").textContent = calc.commission.toFixed(2);
    modal.querySelector("#totalAmount").textContent = calc.gross.toFixed(2);
    modal.querySelector("#providerAmount").textContent = calc.provider_earnings.toFixed(2);
    modal.querySelector("#buttonAmount").textContent = calc.gross.toFixed(2);

    if (amount < PAYMENT_CONFIG.min_payment || amount > PAYMENT_CONFIG.max_payment) {
      submitBtn.disabled = true;
      errorMsg.textContent = `Amount must be between $${PAYMENT_CONFIG.min_payment} and $${PAYMENT_CONFIG.max_payment}.`;
    } else {
      submitBtn.disabled = false;
      errorMsg.textContent = "";
    }
  });

  // Submit payment
  submitBtn.addEventListener("click", async () => {
    const amount = parseFloat(amountInput.value);

    if (!amount || amount < PAYMENT_CONFIG.min_payment || amount > PAYMENT_CONFIG.max_payment) {
      errorMsg.textContent = `Please enter an amount between $${PAYMENT_CONFIG.min_payment} and $${PAYMENT_CONFIG.max_payment}.`;
      return;
    }

    setButtonLoading(submitBtn, true, "Processing payment...");
    errorMsg.textContent = "";
    successMsg.textContent = "";

    try {
      // Get payment method from Stripe
      const { error, paymentMethod } = 
        await stripe.createPaymentMethod({
          type: "card",
          card: cardElement
        });

      if (error) {
        errorMsg.textContent = error.message;
        setButtonLoading(submitBtn, false);
        return;
      }

      // Process payment
      const success = await processPayment(
        requestId,
        amount,
        paymentMethod.id
      );

      if (success) {
        successMsg.textContent = "Payment successful! ✓";
        setTimeout(() => {
          modal.remove();
        }, 2000);
      } else {
        setButtonLoading(submitBtn, false);
      }
    } catch (err) {
      console.error("Payment error:", err);
      errorMsg.textContent = "Payment processing failed. Please try again.";
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
// PROVIDER EARNINGS DASHBOARD
// ==========================================

async function showEarningsDashboard() {
  const user = await getCurrentUser();
  if (!user) {
    showToast("Please log in to view earnings.", "error");
    return;
  }

  // Get provider info
  const { data: provider, error: providerError } = 
    await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

  if (providerError || !provider) {
    showToast("Provider profile not found.", "error");
    return;
  }

  // Get transactions
  const { data: transactions, error: transError } = 
    await supabase
      .from("transactions")
      .select("*")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });

  if (transError) {
    showToast("Unable to load earnings.", "error");
    return;
  }

  // Check if modal already exists
  if (document.querySelector("#earningsModal")) {
    document.querySelector("#earningsModal").remove();
  }

  const modal = document.createElement("section");
  modal.id = "earningsModal";
  modal.className = "modal";

  // Calculate totals
  const totalEarnings = (transactions || [])
    .filter(t => t.status === "completed")
    .reduce((sum, t) => sum + (t.provider_earnings || 0), 0);

  const pendingEarnings = (transactions || [])
    .filter(t => t.status === "pending")
    .reduce((sum, t) => sum + (t.provider_earnings || 0), 0);

  let transactionsHtml = "";
  if (transactions && transactions.length > 0) {
    transactions.forEach(trans => {
      transactionsHtml += `
        <div class="transaction-item">
          <div class="transaction-info">
            <p class="transaction-amount">$${trans.provider_earnings.toFixed(2)}</p>
            <p class="transaction-status">${trans.status}</p>
          </div>
          <p class="transaction-date">${formatDate(trans.created_at)}</p>
        </div>
      `;
    });
  } else {
    transactionsHtml = `<div class="empty-state"><p>No transactions yet.</p></div>`;
  }

  modal.innerHTML = `
    <div class="modal-box earnings-modal">
      <button type="button" class="close-button">×</button>

      <p class="section-label">YOUR EARNINGS</p>

      <h2>Earnings Dashboard</h2>

      <div class="earnings-summary">
        <div class="earning-card">
          <p class="earning-label">Total Earnings</p>
          <p class="earning-amount">$${totalEarnings.toFixed(2)}</p>
        </div>
        <div class="earning-card pending">
          <p class="earning-label">Pending</p>
          <p class="earning-amount">$${pendingEarnings.toFixed(2)}</p>
        </div>
      </div>

      <h3>Recent Transactions</h3>
      <div class="transactions-list">
        ${transactionsHtml}
      </div>

      <button type="button" id="requestPayoutBtn" class="submit-button">
        Request Payout
      </button>

      <p id="payoutMessage" class="message"></p>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector(".close-button");
  const payoutBtn = modal.querySelector("#requestPayoutBtn");
  const payoutMsg = modal.querySelector("#payoutMessage");

  closeBtn.addEventListener("click", () => modal.remove());

  payoutBtn.addEventListener("click", async () => {
    if (totalEarnings <= 0) {
      payoutMsg.textContent = "You have no earnings to withdraw.";
      return;
    }

    setButtonLoading(payoutBtn, true, "Processing...");

    const { error } = 
      await supabase
        .from("provider_payouts")
        .insert([{
          provider_id: provider.id,
          amount: totalEarnings,
          status: "pending"
        }]);

    if (error) {
      console.error("Payout request error:", error);
      payoutMsg.textContent = "Unable to request payout. Please try again.";
      setButtonLoading(payoutBtn, false);
      return;
    }

    payoutMsg.textContent = "Payout request submitted! You'll receive your funds within 5-7 business days.";
    setButtonLoading(payoutBtn, false);

    setTimeout(() => modal.remove(), 3000);
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  openModal(modal);
}

// ==========================================
// CSS STYLES FOR PAYMENTS
// ==========================================

function injectPaymentStyles() {
  if (document.querySelector("#quickfix-payment-styles")) return;

  const style = document.createElement("style");
  style.id = "quickfix-payment-styles";
  style.textContent = `
    .payment-modal {
      max-width: 500px;
    }

    .payment-summary {
      background: rgba(46, 204, 113, 0.08);
      border: 1px solid rgba(46, 204, 113, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
    }

    .payment-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.8);
    }

    .payment-item.total {
      border-top: 1px solid rgba(46, 204, 113, 0.3);
      border-bottom: 1px solid rgba(46, 204, 113, 0.3);
      margin: 10px 0;
      padding: 12px 0;
      font-weight: 700;
      font-size: 1rem;
      color: #2ecc71;
    }

    .payment-item.provider {
      color: #2ecc71;
      font-weight: 600;
    }

    .card-element {
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      min-height: 50px;
    }

    .payment-form {
      margin-top: 16px;
    }

    .error-message {
      color: #ff5050 !important;
    }

    .success-message {
      color: #2ecc71 !important;
    }

    .earnings-modal {
      max-width: 500px;
    }

    .earnings-summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 16px 0;
    }

    .earning-card {
      background: rgba(46, 204, 113, 0.12);
      border: 1px solid rgba(46, 204, 113, 0.35);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }

    .earning-card.pending {
      border-color: rgba(255, 193, 7, 0.35);
      background: rgba(255, 193, 7, 0.08);
    }

    .earning-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
      margin: 0 0 8px 0;
    }

    .earning-amount {
      font-size: 1.8rem;
      font-weight: 800;
      color: #2ecc71;
      margin: 0;
    }

    .earning-card.pending .earning-amount {
      color: #ffc107;
    }

    .transactions-list {
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      padding: 12px;
      margin: 16px 0;
      max-height: 300px;
      overflow-y: auto;
    }

    .transaction-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 0.9rem;
    }

    .transaction-item:last-child {
      border-bottom: none;
    }

    .transaction-info {
      flex: 1;
    }

    .transaction-amount {
      font-weight: 700;
      color: #2ecc71;
      margin: 0;
    }

    .transaction-status {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
      margin: 4px 0 0 0;
      text-transform: uppercase;
    }

    .transaction-date {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.8rem;
      margin: 0;
    }

    @media (max-width: 600px) {
      .earnings-summary {
        grid-template-columns: 1fr;
      }

      .payment-summary {
        font-size: 0.9rem;
      }
    }
  `;

  document.head.appendChild(style);
}

// ==========================================
// INITIALIZE PAYMENT MODULE
// ==========================================

injectPaymentStyles();
initializeStripe();

console.log("✅ QuickFix Payments module loaded");
