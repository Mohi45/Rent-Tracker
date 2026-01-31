/************ CONFIG ************/
const ADMIN_PIN = "1234";
const DEFAULT_AVATAR =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSIzNSIgcj0iMTgiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSIyMCIgeT0iNjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==";

/************ GLOBALS ************/
let data = JSON.parse(localStorage.getItem("pgData")) || [];
let chart, historyChart;
let cropper;
let croppedImageData = null;

/************ DATE HELPERS ************/
function getCurrentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthName(key) {
    const [y, m] = key.split("-");
    return new Date(y, m - 1).toLocaleString("default", {
        month: "short",
        year: "numeric"
    });
}

let ACTIVE_MONTH =
    localStorage.getItem("activeMonth") || getCurrentMonthKey();

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
if (localStorage.getItem("theme") === "true")
    document.body.classList.add("dark");

/************ IMAGE CROP ************/
photoInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        cropImage.src = reader.result;
        cropModal.style.display = "flex";

        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, {
            aspectRatio: 1,
            viewMode: 1
        });
    };
    reader.readAsDataURL(file);
});

function saveCropped() {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300
    });

    croppedImageData = canvas.toDataURL("image/png");
    cropModal.style.display = "none";
    cropper.destroy();
    cropper = null;
}

function cancelCrop() {
    cropModal.style.display = "none";
    if (cropper) cropper.destroy();
    cropper = null;
}

/************ ADD TENANT ************/
function addTenant() {
    if (
        !nameInput.value ||
        !roomInput.value ||
        !phoneInput.value ||
        !rentInput.value ||
        !dueDateInput.value
    ) {
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
        photo: croppedImageData || DEFAULT_AVATAR,
        history: {}
    });

    nameInput.value =
        roomInput.value =
        phoneInput.value =
        rentInput.value =
        dueDateInput.value =
        "";
    photoInput.value = "";
    croppedImageData = null;

    save();
    render();
}

/************ MONTH SELECTOR (JAN–DEC) ************/
function populateMonthSelector() {
    const select = document.getElementById("monthSelector");
    if (!select) return;

    select.innerHTML = "";
    const year = new Date().getFullYear();

    for (let i = 0; i < 12; i++) {
        const m = String(i + 1).padStart(2, "0");
        const key = `${year}-${m}`;

        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = new Date(year, i).toLocaleString("default", {
            month: "short",
            year: "numeric"
        });

        if (key === ACTIVE_MONTH) opt.selected = true;
        select.appendChild(opt);
    }
}

function changeMonth(m) {
    ACTIVE_MONTH = m;
    localStorage.setItem("activeMonth", m);
    render();
}

/************ PAYMENT ************/
function isPaidThisMonth(t) {
    return t.history?.[ACTIVE_MONTH]?.status === "Paid";
}

function getTotal(t) {
    const base = t.rent + t.electricity + t.maintenance;
    const today = new Date().getDate();
    let lateFee = 0;
    if (!isPaidThisMonth(t) && today > t.dueDate)
        lateFee = (today - t.dueDate) * 10;
    return base + lateFee;
}

function markPaid(i) {
    const t = data[i];
    t.history[ACTIVE_MONTH] = {
        paid: getTotal(t),
        status: "Paid"
    };
    save();
    render();
}

/************ RENDER ************/
function render() {
    tenantList.innerHTML = "";
    let paid = 0,
        unpaid = 0;

    data.forEach((t, i) => {
        const total = getTotal(t);
        isPaidThisMonth(t) ? (paid += total) : (unpaid += total);

        tenantList.innerHTML += `
      <div class="card">
        <img src="${t.photo}">
        <h3>${t.name}</h3>
        <small>Room ${t.room}</small>
        <p>₹${total}</p>
        <button onclick="markPaid(${i})">✔ Paid</button>
      </div>`;
    });

    paidEl.textContent = paid;
    pendingEl.textContent = unpaid;
    populateMonthSelector();
}

/************ SAVE ************/
function save() {
    localStorage.setItem("pgData", JSON.stringify(data));
}

/************ OFFLINE / ONLINE ************/
function updateOnlineStatus() {
    if (!navigator.onLine)
        alert("⚠️ You are offline. App is running in offline mode.");
}
window.addEventListener("offline", updateOnlineStatus);
window.addEventListener("online", () =>
    console.log("🌐 Back Online")
);

/************ SERVICE WORKER ************/
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js");
    });
}

/************ INIT ************/
populateMonthSelector();
render();
