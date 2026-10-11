const API = {
    signup: "/api/accounts/signup/",
    login: "/api/accounts/login/",
    me: "/api/accounts/me/",
    wallet: "/api/wallet/",
    transactions: "/api/transactions/",
    transfer: "/api/transactions/transfer/",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const state = {
    user: null,
    wallet: null,
    transactions: [],
    accessToken: localStorage.getItem("access_token"),
    refreshToken: localStorage.getItem("refresh_token"),
};

let toastTimer;

function showToast(message, type = "") {
    const toast = $("#toast");
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.className = "toast";
    }, 3500);
}

function formatMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "0.00 UZS";

    return new Intl.NumberFormat("uz-UZ", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount) + " UZS";
}

function getInitial(user) {
    const name = user?.first_name || user?.username || "U";
    return String(name).trim().charAt(0).toUpperCase() || "U";
}

function getErrorMessage(data) {
    if (!data) return "Noma'lum xatolik yuz berdi.";

    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
    if (typeof data.msg === "string") return data.msg;

    const messages = [];

    for (const [field, errors] of Object.entries(data)) {
        if (Array.isArray(errors)) {
            messages.push(`${field}: ${errors.join(", ")}`);
        } else if (typeof errors === "string") {
            messages.push(`${field}: ${errors}`);
        }
    }

    return messages.join("\n") || "So'rov bajarilmadi. Ma'lumotlarni tekshiring.";
}

/*
 * Barcha API so'rovlari shu funksiya orqali yuboriladi.
 */
async function apiRequest(url, options = {}, retry = true) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (state.access) {
        headers.Authorization = `Bearer ${state.access}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        // Server JSON qaytarmasa, data null qoladi.
    }

    // Access token muddati tugasa, refresh token bilan yangilashga urinamiz.
    if (
        response.status === 401 &&
        retry &&
        state.refresh &&
        !url.includes("login") &&
        !url.includes("signup")
    ) {
        const refreshed = await refreshAccessToken();

        if (refreshed) {
            return apiRequest(url, options, false);
        }
    }

    if (!response.ok) {
        if (response.status === 401 && !url.includes("login")) {
            clearSession();
            showAuth();
        }

        throw new Error(getErrorMessage(data));
    }

    return data;
}

async function refreshAccessToken() {
    if (!state.refresh) return false;

    try {
        /*
         * Bu URL sizning backend'ingizdagi refresh endpointiga mos bo'lishi kerak.
         * Professor kodingizda: /api/accounts/token-refresh/
         */
        const response = await fetch("/api/accounts/token-refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: state.refresh }),
        });

        const data = await response.json();

        if (!response.ok) return false;

        const newAccess = data.access || data.new_access || data.access_token;

        if (!newAccess) return false;

        state.access = newAccess;
        localStorage.setItem("paylite_access", newAccess);

        if (data.refresh) {
            state.refresh = data.refresh;
            localStorage.setItem("paylite_refresh", data.refresh);
        }

        return true;
    } catch {
        return false;
    }
}

function saveSession(data) {
    const access = data.access_token || data.access;
    const refresh = data.refresh_token || data.refresh;

    if (!access) {
        throw new Error("Login javobida access token topilmadi.");
    }

    state.access = access;
    state.refresh = refresh || null;

    localStorage.setItem("paylite_access", access);

    if (refresh) {
        localStorage.setItem("paylite_refresh", refresh);
    } else {
        localStorage.removeItem("paylite_refresh");
    }
}

function clearSession() {
    state.access = null;
    state.refresh = null;
    state.user = null;
    state.wallet = null;
    state.transactions = [];

    localStorage.removeItem("paylite_access");
    localStorage.removeItem("paylite_refresh");
}

/* -------------------- SAHIFALAR -------------------- */

function showAuth() {
    $("#authSection").classList.remove("hidden");

    ["dashboardPage", "transferPage", "transactionsPage", "profilePage"]
        .forEach((id) => $("#" + id).classList.add("hidden"));

    $("#pageTitle").textContent = "Hisobga kirish";
    $$(".sidebar .nav-link").forEach((button) => button.classList.remove("active"));
}

function showApp() {
    $("#authSection").classList.add("hidden");
    navigateTo("dashboard");
}

function navigateTo(page) {
    const pages = {
        dashboard: "dashboardPage",
        transfer: "transferPage",
        transactions: "transactionsPage",
        profile: "profilePage",
    };

    if (!pages[page]) return;

    $("#authSection").classList.add("hidden");

    Object.values(pages).forEach((id) => {
        $("#" + id).classList.add("hidden");
    });

    $("#" + pages[page]).classList.remove("hidden");

    const titles = {
        dashboard: "Dashboard",
        transfer: "Pul o‘tkazish",
        transactions: "Tranzaksiyalar",
        profile: "Profil",
    };

    $("#pageTitle").textContent = titles[page];

    $$(".sidebar .nav-link").forEach((button) => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    $("#sidebar").classList.remove("open");

    if (page === "transactions") loadTransactions();
    if (page === "profile") renderProfile();
    if (page === "transfer") renderTransferInfo();
}

/* -------------------- AUTH TABLARI -------------------- */

function setAuthTab(tab) {
    $$(".auth-tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.auth === tab);
    });

    $("#loginForm").classList.toggle("hidden", tab !== "login");
    $("#signupForm").classList.toggle("hidden", tab !== "signup");

    $("#authTitle").textContent =
        tab === "login" ? "Xush kelibsiz" : "Yangi hisob yarating";

    $("#authSubtitle").textContent =
        tab === "login"
            ? "Hisobingizga kiring va davom eting."
            : "Ma'lumotlaringizni kiriting va ro'yxatdan o'ting.";
}

/* -------------------- LOGIN -------------------- */

$("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    const payload = {
        username: formData.get("username").trim(),
        password: formData.get("password"),
    };

    button.disabled = true;
    button.textContent = "Kirilmoqda...";

    try {
        const data = await apiRequest(API.login, {
            method: "POST",
            body: JSON.stringify(payload),
        }, false);

        saveSession(data);
        await loadUserData();
        showApp();
        showToast("Hisobga muvaffaqiyatli kirdingiz!", "success");
        form.reset();
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
        button.innerHTML = 'Hisobga kirish <span>→</span>';
    }
});

/* -------------------- SIGNUP -------------------- */

$("#signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    const password = formData.get("password");
    const confirmPassword = formData.get("conf_pass");

    if (password !== confirmPassword) {
        showToast("Parollar bir-biriga mos kelmayapti.", "error");
        return;
    }

    const payload = {
        username: formData.get("username").trim(),
        first_name: formData.get("first_name").trim(),
        last_name: formData.get("last_name").trim(),
        email: formData.get("email").trim(),
        password,
        conf_pass: confirmPassword,
    };

    button.disabled = true;
    button.textContent = "Hisob yaratilmoqda...";

    try {
        await apiRequest(API.signup, {
            method: "POST",
            body: JSON.stringify(payload),
        }, false);

        showToast("Hisob yaratildi! Endi login qiling.", "success");
        form.reset();
        setAuthTab("login");

        $("#loginForm [name='username']").value = payload.username;
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
        button.innerHTML = 'Hisob yaratish <span>→</span>';
    }
});

/* -------------------- FOYDALANUVCHI VA BALANS -------------------- */

async function loadUserData() {
    const profileData = await apiRequest(API.me);
    state.user = profileData.data || profileData.user || profileData;

    renderProfile();
    renderTransferInfo();

    // Hamyon endpointi hali backendda yaratilmagan bo'lsa ham profil ishlaydi.
    try {
        const walletData = await apiRequest(API.wallet);
        state.wallet = walletData.wallet || walletData.data || walletData;
    } catch (error) {
        console.warn("Wallet endpointi hozircha ishlamadi:", error.message);
    }

    renderBalance();

    try {
        await loadTransactions();
    } catch (error) {
        console.warn("Tranzaksiyalarni yuklashda xatolik:", error.message);
    }
}

function renderProfile() {
    const user = state.user;
    if (!user) return;

    const fullName = [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ") || user.username || "Foydalanuvchi";

    $("#welcomeName").textContent = user.first_name || user.username || "foydalanuvchi";
    $("#balanceHolder").textContent = fullName;
    $("#headerAvatar").textContent = getInitial(user);
    $("#profileAvatar").textContent = getInitial(user);
    $("#profileName").textContent = fullName;
    $("#profileUsername").textContent = "@" + (user.username || "username");
    $("#profileFirstName").textContent = user.first_name || "—";
    $("#profileLastName").textContent = user.last_name || "—";
    $("#profileEmail").textContent = user.email || "—";
    $("#profilePhone").textContent = user.phone_number || "—";
}

function getBalance() {
    if (!state.wallet) return null;

    const raw =
        state.wallet.balance ??
        state.wallet.amount ??
        state.wallet.available_balance;

    return raw === undefined || raw === null ? null : Number(raw);
}

function renderBalance() {
    const balance = getBalance();

    $("#balanceValue").textContent =
        balance === null ? "Balans mavjud emas" : formatMoney(balance);

    $("#transferBalance").textContent =
        balance === null ? "Noma'lum" : formatMoney(balance);
}

function renderTransferInfo() {
    $("#transferSender").textContent =
        state.user?.username || "—";

    const balance = getBalance();
    $("#transferBalance").textContent =
        balance === null ? "Yuklanmagan" : formatMoney(balance);
}

/* -------------------- TRANZAKSIYALAR -------------------- */

function normalizeTransactions(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.transactions)) return data.transactions;
    if (Array.isArray(data.data)) return data.data;

    return [];
}

function transactionDirection(transaction) {
    const username = state.user?.username;

    const sender =
        transaction.sender_username ||
        transaction.sender?.username ||
        transaction.sender_name;

    const receiver =
        transaction.receiver_username ||
        transaction.receiver?.username ||
        transaction.receiver_name;

    if (sender && username && sender === username) return "sent";
    if (receiver && username && receiver === username) return "received";

    // Backend direction yoki type maydonini qaytarsa, undan foydalanamiz.
    if (["sent", "outgoing", "debit"].includes(transaction.direction)) return "sent";
    if (["received", "incoming", "credit"].includes(transaction.direction)) return "received";

    return "received";
}

function renderTransactions(container, transactions) {
    if (!transactions.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span>↔</span>
                <strong>Tranzaksiyalar hali yo‘q</strong>
                <p>Yangi operatsiyalar shu yerda ko‘rinadi.</p>
            </div>`;
        return;
    }

    container.innerHTML = transactions.map((transaction) => {
        const direction = transactionDirection(transaction);
        const amount = Number(transaction.amount || 0);
        const dateValue =
            transaction.created_at ||
            transaction.created ||
            transaction.timestamp;

        let dateText = "Sana ko‘rsatilmagan";

        if (dateValue) {
            const date = new Date(dateValue);
            if (!Number.isNaN(date.getTime())) {
                dateText = date.toLocaleString("uz-UZ", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
            }
        }

        const counterparty = direction === "sent"
            ? (
                transaction.receiver_username ||
                transaction.receiver?.username ||
                transaction.receiver_name ||
                "Qabul qiluvchi"
            )
            : (
                transaction.sender_username ||
                transaction.sender?.username ||
                transaction.sender_name ||
                "Jo‘natuvchi"
            );

        const sign = direction === "sent" ? "−" : "+";
        const icon = direction === "sent" ? "↗" : "↙";

        return `
            <div class="transaction-item ${direction}">
                <div class="transaction-icon">${icon}</div>
                <div class="transaction-info">
                    <strong>${escapeHTML(counterparty)}</strong>
                    <small>${escapeHTML(dateText)}</small>
                </div>
                <div class="transaction-amount">
                    ${sign}${escapeHTML(formatMoney(amount))}
                </div>
            </div>`;
    }).join("");
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    })[char]);
}

async function loadTransactions() {
    const data = await apiRequest(API.transactions);
    state.transactions = normalizeTransactions(data);

    // API faqat joriy foydalanuvchining tranzaksiyalarini qaytarishi kerak.
    renderTransactions($("#recentTransactions"), state.transactions.slice(0, 5));
    renderTransactions($("#allTransactions"), state.transactions);
}

/* -------------------- PUL O'TKAZISH -------------------- */

$("#transferForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    const receiver = String(formData.get("receiver") || "").trim();
    const amount = Number(formData.get("amount"));

    if (!receiver) {
        showToast("Qabul qiluvchi username'ini kiriting.", "error");
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Summa noldan katta bo‘lishi kerak.", "error");
        return;
    }

    if (receiver === state.user?.username) {
        showToast("O‘zingizga pul o‘tkaza olmaysiz.", "error");
        return;
    }

    const balance = getBalance();

    if (balance !== null && amount > balance) {
        showToast("Balansda yetarli mablag‘ mavjud emas.", "error");
        return;
    }

    /*
     * MUHIM:
     * Bu payload backend serializeridagi field nomlariga mos bo'lishi kerak.
     * Hozir receiver va amount yuborilyapti.
     */
    
    const payload = {
        receiver_id: receiver,
        amount: amount.toFixed(2),
    };


    button.disabled = true;
    button.textContent = "O‘tkazilmoqda...";

    try {
        await apiRequest(API.transfer, {
            method: "POST",
            body: JSON.stringify(payload),
        });

        showToast("Pul o‘tkazmasi muvaffaqiyatli yuborildi!", "success");
        form.reset();

        await loadUserData();
        navigateTo("transactions");
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
        button.innerHTML = 'O‘tkazmani tasdiqlash <span>→</span>';
    }
});

/* -------------------- NAVIGATSIYA -------------------- */

$$("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!state.access) {
            showAuth();
            return;
        }

        navigateTo(button.dataset.page);
    });
});

$$("[data-auth]").forEach((button) => {
    button.addEventListener("click", () => {
        setAuthTab(button.dataset.auth);
    });
});

$("#refreshButton").addEventListener("click", async () => {
    try {
        await loadUserData();
        showToast("Ma'lumotlar yangilandi.", "success");
    } catch (error) {
        showToast(error.message, "error");
    }
});

$("#transactionsRefresh").addEventListener("click", async () => {
    try {
        await loadTransactions();
        showToast("Tranzaksiyalar yangilandi.", "success");
    } catch (error) {
        showToast(error.message, "error");
    }
});

$("#mobileMenu").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
});

/* -------------------- LOGOUT -------------------- */

$("#logoutButton").addEventListener("click", async () => {
    /*
     * Tokenni blacklist qilish endpointi mavjud bo'lsa, shu yerda chaqiriladi.
     * Serverdagi logout endpoint bo'lmasa ham, brauzerdagi sessiya tozalanadi.
     */
    if (state.refresh) {
        try {
            await fetch("/api/accounts/logout/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(state.access
                        ? { Authorization: `Bearer ${state.access}` }
                        : {}),
                },
                body: JSON.stringify({ refresh: state.refresh }),
            });
        } catch (error) {
            console.warn("Server logout so‘rovi bajarilmadi:", error);
        }
    }

    clearSession();
    showAuth();
    setAuthTab("login");
    showToast("Hisobdan chiqdingiz.", "success");
});

/* -------------------- BOSHLANG'ICH HOLAT -------------------- */

async function initializeApp() {
    if (!state.access) {
        showAuth();
        setAuthTab("login");
        return;
    }

    try {
        await loadUserData();
        showApp();
    } catch (error) {
        console.warn("Sessiya tiklanmadi:", error.message);
        clearSession();
        showAuth();
    }
}

initializeApp();
