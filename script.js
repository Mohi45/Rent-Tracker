/************ CONFIG ************/
const ADMIN_PIN = "1234";
const DEFAULT_AVATAR =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSIzNSIgcj0iMTgiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSIyMCIgeT0iNjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==";

/************ DATE HELPERS ************/
function getCurrentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(key) {
    const [y, m] = key.split("-");
    return new Date(y, m - 1).toLocaleString("default", { month: "long", year: "numeric" });
}

let ACTIVE_MONTH = localStorage.getItem("activeMonth") || getCurrentMonthKey();

/************ STORAGE ************/
let data = JSON.parse(localStorage.getItem("pgData")) || [];
let chart, historyChart;

/************ LOGIN ************/
function login() {
    if (pin.value === ADMIN_PIN) {
        sessionStorage.setItem("login", "1");
        loginScreen.style.display = "none";
        app.style.display = "block";
        render();
    } else alert("Wrong PIN");
}
if (sessionStorage.getItem("login")) login();

/************ THEME ************/
function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark"));
}
if (localStorage.getItem("theme") === "true") document.body.classList.add("dark");

/************ ADD TENANT ************/
function addTenant() {
    if (!nameInput.value || !roomInput.value || !phoneInput.value || !rentInput.value || !dueDateInput.value) {
        alert("Fill all fields");
        return;
    }

    data.push({
        name: nameInput.value,
        room: roomInput.value,
        phone: phoneInput.value,
        rent: +rentInput.value,
        electricity: 0,
        maintenance: 0,
        dueDate: +dueDateInput.value,
        photo: DEFAULT_AVATAR,
        history: {}
    });

    nameInput.value = roomInput.value = phoneInput.value = rentInput.value = dueDateInput.value = "";
    save();
    populateMonthSelector();
    render();
}

/************ MONTH SELECTOR ************/
function populateMonthSelector() {
    const select = document.getElementById("monthSelector");
    if (!select) return;

    select.innerHTML = "";

    const year = new Date().getFullYear();
    const months = [
        "01", "02", "03", "04", "05", "06",
        "07", "08", "09", "10", "11", "12"
    ];

    months.forEach(m => {
        const key = `${year}-${m}`;
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = new Date(year, m - 1).toLocaleString("default", {
            month: "short",
            year: "numeric"
        });

        if (key === ACTIVE_MONTH) opt.selected = true;
        select.appendChild(opt);
    });
}

function changeMonth(m) {
    ACTIVE_MONTH = m;
    localStorage.setItem("activeMonth", m);
    render();
}

/************ PAYMENT LOGIC ************/
function getTotal(t) {
    const base = t.rent + t.electricity + t.maintenance;
    const today = new Date().getDate();
    let lateFee = 0;

    if (!isPaidThisMonth(t) && today > t.dueDate) {
        lateFee = (today - t.dueDate) * 10;
    }
    return base + lateFee;
}

function isPaidThisMonth(t) {
    return t.history?.[ACTIVE_MONTH]?.status === "Paid";
}

function isOverdue(t) {
    const today = new Date().getDate();
    return !isPaidThisMonth(t) && today > t.dueDate;
}

function markPaid(i) {
    const t = data[i];
    const total = getTotal(t);

    t.history[ACTIVE_MONTH] = {
        paid: total,
        status: "Paid"
    };

    save();
    render();
}

/************ RENDER ************/
function render() {
    tenantList.innerHTML = "";
    let paid = 0, unpaid = 0;

    data.forEach((t, i) => {
        const total = getTotal(t);
        const paidThisMonth = isPaidThisMonth(t);

        paidThisMonth ? paid += total : unpaid += total;

        tenantList.innerHTML += `
      <div class="card">
        <img src="${t.photo}">
        <h3>${t.name}</h3>
        <small>Room ${t.room}</small>
        <small>Due: ${t.dueDate}</small>

        <p><strong>₹${total}</strong></p>

        <span class="${paidThisMonth ? "paid" : isOverdue(t) ? "overdue" : "pending"}">
          ${paidThisMonth ? "Paid" : isOverdue(t) ? "Overdue" : "Pending"}
        </span>

        <div class="actions">
          ${!paidThisMonth ? `<button onclick="markPaid(${i})">✔ Paid</button>` : ""}
          <button onclick="viewHistory(${i})">📊 History</button>
          <button onclick="removeTenant(${i})">🗑️</button>
        </div>
      </div>
    `;
    });

    paidEl.textContent = paid;
    pendingEl.textContent = unpaid;

    drawChart(paid, unpaid);
    drawHistoryChart();
    populateMonthSelector();
}

/************ REMOVE ************/
function removeTenant(i) {
    if (confirm("Delete tenant?")) {
        data.splice(i, 1);
        save();
        render();
    }
}

/************ HISTORY VIEW ************/
function viewHistory(i) {
    const t = data[i];
    if (!t.history || !Object.keys(t.history).length) {
        alert("No history available");
        return;
    }

    let msg = `📊 ${t.name}\n\n`;
    Object.entries(t.history).forEach(([m, v]) => {
        msg += `${getMonthName(m)}: ₹${v.paid} (${v.status})\n`;
    });

    alert(msg);
}

/************ CHARTS ************/
function drawChart(paid, unpaid) {
    if (chart) chart.destroy();

    chart = new Chart(chartEl, {
        type: "doughnut",
        data: {
            labels: ["Paid", "Unpaid"],
            datasets: [{ data: [paid, unpaid] }]
        },
        options: { plugins: { legend: { position: "bottom" } } }
    });
}

function drawHistoryChart() {
    const history = JSON.parse(localStorage.getItem("monthlyHistory")) || {};
    const labels = Object.keys(history);
    if (!labels.length) return;

    const paidData = labels.map(m => history[m].paid);
    const unpaidData = labels.map(m => history[m].unpaid);

    if (historyChart) historyChart.destroy();

    historyChart = new Chart(historyChartEl, {
        type: "bar",
        data: {
            labels: labels.map(getMonthName),
            datasets: [
                { label: "Paid", data: paidData },
                { label: "Unpaid", data: unpaidData }
            ]
        },
        options: { plugins: { legend: { position: "bottom" } } }
    });
}

/************ MONTHLY AGGREGATE ************/
function updateMonthlyHistory() {
    let history = JSON.parse(localStorage.getItem("monthlyHistory")) || {};
    let paid = 0, unpaid = 0;

    data.forEach(t => {
        const total = getTotal(t);
        isPaidThisMonth(t) ? paid += total : unpaid += total;
    });

    history[ACTIVE_MONTH] = { paid, unpaid };
    localStorage.setItem("monthlyHistory", JSON.stringify(history));
}

/************ NOTIFICATIONS ************/
function overdueNotification() {
    if (!("Notification" in window)) return;

    Notification.requestPermission().then(p => {
        if (p !== "granted") return;

        const key = "notified-" + new Date().toDateString();
        if (localStorage.getItem(key)) return;

        data.filter(isOverdue).forEach(t => {
            new Notification("⚠️ Rent Overdue", {
                body: `${t.name} (Room ${t.room})`,
                icon: t.photo
            });
        });

        localStorage.setItem(key, "1");
    });
}

/************ SAVE ************/
function save() {
    localStorage.setItem("pgData", JSON.stringify(data));
    updateMonthlyHistory();
}
function viewAllHistory() {
    const history = JSON.parse(localStorage.getItem("monthlyHistory")) || {};

    if (!Object.keys(history).length) {
        alert("No monthly history available yet");
        return;
    }

    let message = "📊 Monthly Rent Summary\n\n";

    Object.keys(history)
        .sort()
        .forEach(month => {
            const h = history[month];
            message += `${month}\n`;
            message += `✔ Paid: ₹${h.paid}\n`;
            message += `⏳ Unpaid: ₹${h.unpaid}\n\n`;
        });

    alert(message);
}
/************ ONLINE / OFFLINE STATUS ************/
/************ ONLINE / OFFLINE ************/
function updateOnlineStatus() {
    if (!navigator.onLine) {
        alert("⚠️ You are offline. App is running in offline mode.");
    }
}

window.addEventListener("offline", updateOnlineStatus);
window.addEventListener("online", () => console.log("🌐 Back Online"));

/************ SERVICE WORKER ************/
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js");
    });
}

/************ INIT ************/
populateMonthSelector();
render();
overdueNotification();

