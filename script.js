/************ CONFIG ************/
const ADMIN_PIN = "1234";
const DEFAULT_AVATAR =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSIzNSIgcj0iMTgiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSIyMCIgeT0iNjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==";

/************ GLOBALS ************/
let data = JSON.parse(localStorage.getItem("pgData")) || [];
let ACTIVE_MONTH = localStorage.getItem("activeMonth") || getCurrentMonthKey();
let chart = null;
let historyChart = null;
let cropper = null;
let croppedImage = null;

/************ ELEMENTS ************/
const chartEl = document.getElementById("chart");
const historyChartEl = document.getElementById("historyChart");

/************ DATE HELPERS ************/
function getCurrentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(key) {
    const [y, m] = key.split("-");
    return new Date(y, m - 1).toLocaleString("default", { month: "short", year: "numeric" });
}

function getMonthRange(key) {
    const [y, m] = key.split("-");
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
}

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
}

/************ IMAGE CROP ************/
photoInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        cropImage.src = reader.result;
        cropModal.style.display = "flex";
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, { aspectRatio: 1 });
    };
    reader.readAsDataURL(file);
});

function saveCropped() {
    croppedImage = cropper.getCroppedCanvas({ width: 300, height: 300 }).toDataURL();
    cropper.destroy();
    cropper = null;
    cropModal.style.display = "none";
}

function cancelCrop() {
    cropModal.style.display = "none";
    if (cropper) cropper.destroy();
}

/************ ADD TENANT ************/
function addTenant() {
    if (!nameInput.value || !dueDateInput.value) {
        alert("Fill all fields");
        return;
    }

    data.push({
        name: nameInput.value,
        room: roomInput.value,
        phone: phoneInput.value,
        rent: +rentInput.value,
        dueDate: dueDateInput.value,
        photo: croppedImage || DEFAULT_AVATAR,
        history: {}
    });

    nameInput.value = roomInput.value = phoneInput.value = rentInput.value = dueDateInput.value = "";
    croppedImage = null;

    save();
    render();
}

/************ MONTH ************/
function populateMonthSelector() {
    monthSelector.innerHTML = "";
    const y = new Date().getFullYear();
    for (let i = 0; i < 12; i++) {
        const key = `${y}-${String(i + 1).padStart(2, "0")}`;
        const o = document.createElement("option");
        o.value = key;
        o.textContent = new Date(y, i).toLocaleString("default", { month: "short", year: "numeric" });
        if (key === ACTIVE_MONTH) o.selected = true;
        monthSelector.appendChild(o);
    }
}

function changeMonth(m) {
    ACTIVE_MONTH = m;
    localStorage.setItem("activeMonth", m);
    render();
}

/************ PAYMENT ************/
function isPaid(t) {
    return t.history?.[ACTIVE_MONTH]?.status === "Paid";
}

function getTotal(t) {
    let total = t.rent;
    if (isPaid(t)) return total;

    const due = new Date(t.dueDate);
    const { end } = getMonthRange(ACTIVE_MONTH);
    if (end < due) return total;

    const today = new Date() < end ? new Date() : end;
    const daysLate = Math.floor((today - due) / 86400000);
    if (daysLate > 0) total += daysLate * 10;
    return total;
}

function markPaid(i) {
    data[i].history[ACTIVE_MONTH] = { paid: getTotal(data[i]), status: "Paid" };
    save();
    render();
}

/************ WHATSAPP ************/
function sendWhatsApp(i) {
    const t = data[i];
    const msg = encodeURIComponent(
        `Hello ${t.name}, your PG rent for ${getMonthName(ACTIVE_MONTH)} is ₹${getTotal(t)}`
    );
    window.open(`https://wa.me/${t.phone}?text=${msg}`);
}

/************ DELETE ************/
function removeTenant(i) {
    if (confirm("Delete tenant?")) {
        data.splice(i, 1);
        save();
        render();
    }
}

/************ RENDER ************/
function render() {
    tenantList.innerHTML = "";
    let paid = 0, unpaid = 0;

    data.forEach((t, i) => {
        const total = getTotal(t);
        isPaid(t) ? (paid += total) : (unpaid += total);

        tenantList.innerHTML += `
      <div class="card">
        <img src="${t.photo}">
        <h3>${t.name}</h3>
        <small>Room ${t.room}</small>
        <small>Due: ${new Date(t.dueDate).toDateString()}</small>
        <p><strong>₹${total}</strong></p>
        <div class="actions">
          ${!isPaid(t) ? `<button onclick="markPaid(${i})">✔ Paid</button>` : ""}
          <button onclick="sendWhatsApp(${i})">📲 WhatsApp</button>
          <button onclick="removeTenant(${i})" class="danger">🗑 Delete</button>
        </div>
      </div>`;
    });

    paidEl.textContent = paid;
    pendingEl.textContent = unpaid;

    drawChart(paid, unpaid);
    drawHistoryChart();
    populateMonthSelector();
}

/************ CHARTS (MOBILE SAFE) ************/
function drawChart(paid, unpaid) {
    if (chart) chart.destroy();
    chart = new Chart(chartEl, {
        type: "doughnut",
        data: { labels: ["Paid", "Pending"], datasets: [{ data: [paid, unpaid] }] },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
}

function drawHistoryChart() {
    const h = JSON.parse(localStorage.getItem("monthlyHistory")) || {};
    const labels = Object.keys(h);
    if (!labels.length) return;

    if (historyChart) historyChart.destroy();
    historyChart = new Chart(historyChartEl, {
        type: "bar",
        data: {
            labels: labels.map(getMonthName),
            datasets: [
                { label: "Paid", data: labels.map(m => h[m].paid) },
                { label: "Pending", data: labels.map(m => h[m].unpaid) }
            ]
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
}

/************ SAVE ************/
function save() {
    localStorage.setItem("pgData", JSON.stringify(data));
    const h = JSON.parse(localStorage.getItem("monthlyHistory")) || {};
    let paid = 0, unpaid = 0;
    data.forEach(t => (isPaid(t) ? (paid += getTotal(t)) : (unpaid += getTotal(t))));
    h[ACTIVE_MONTH] = { paid, unpaid };
    localStorage.setItem("monthlyHistory", JSON.stringify(h));
}

/************ INIT ************/
populateMonthSelector();
render();
