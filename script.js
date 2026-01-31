/********** CONSTANTS **********/
const ADMIN_PIN = "1234";
const DEFAULT_AVATAR =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSIzNSIgcj0iMTgiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSIyMCIgeT0iNjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==";
/********** STATE **********/
let data = [];
let ACTIVE_MONTH = localStorage.getItem("activeMonth") || getCurrentMonthKey();
let chart = null;
let cropper = null;
let croppedImage = null;
let imageReady = false;

/********** DOM **********/
const tenantList = document.getElementById("tenantList");
const chartEl = document.getElementById("chart");
const pin = document.getElementById("pin");
const monthSelector = document.getElementById("monthSelector");

/********** DATE HELPERS **********/
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

function getMonthRange(key) {
    const [y, m] = key.split("-");
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
}

function getDueDateForMonth(t, monthKey) {
    const [y, m] = monthKey.split("-");
    return new Date(y, m - 1, t.dueDay || 1);
}

/********** FIREBASE **********/
const firebaseConfig = {
    apiKey: "AIzaSyDAY3hRdAnDO9A-P6Krm_2q52idGqKhAPQ",
    authDomain: "renttracker-bd234.firebaseapp.com",
    databaseURL: "https://renttracker-bd234-default-rtdb.firebaseio.com",
    projectId: "renttracker-bd234",
    storageBucket: "renttracker-bd234.appspot.com",
    messagingSenderId: "669597729141",
    appId: "1:669597729141:web:0d674323c21599e0c6533c"
};

firebase.initializeApp(firebaseConfig);
const dbRef = firebase.database().ref("pgData");

dbRef.on("value", snap => {
    data = snap.val() || [];
    render();
});

/********** LOGIN **********/
function login() {
    if (pin.value === ADMIN_PIN) {
        sessionStorage.setItem("login", "1");
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("app").style.display = "block";
        render();
    } else alert("Wrong PIN");
}

if (sessionStorage.getItem("login")) login();

/********** THEME **********/
function toggleTheme() {
    document.body.classList.toggle("dark");
}

/********** IMAGE CROP **********/
document.getElementById("photoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    imageReady = false;
    croppedImage = null;

    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById("cropImage").src = reader.result;
        document.getElementById("cropModal").style.display = "block";

        if (cropper) cropper.destroy();
        cropper = new Cropper(document.getElementById("cropImage"), {
            aspectRatio: 1,
            viewMode: 1
        });
    };
    reader.readAsDataURL(file);
});

function saveCropped() {
    croppedImage = cropper
        .getCroppedCanvas({ width: 300, height: 300 })
        .toDataURL();

    imageReady = true;

    cropper.destroy();
    cropper = null;
    document.getElementById("cropModal").style.display = "none";
}

function cancelCrop() {
    imageReady = false;
    croppedImage = null;
    document.getElementById("cropModal").style.display = "none";
    if (cropper) cropper.destroy();
}

/********** ADD TENANT **********/
function addTenant() {
    if (!nameInput.value || !dueDateInput.value) {
        alert("Fill all fields");
        return;
    }

    if (!croppedImage) {
        alert("Please crop the image before saving");
        return;
    }

    const tenant = {
        name: nameInput.value,
        room: roomInput.value,
        phone: phoneInput.value,
        rent: +rentInput.value,
        dueDay: +dueDateInput.value,
        photo: croppedImage,
        history: {}
    };

    data.push(tenant);
    dbRef.set(data);

    nameInput.value =
        roomInput.value =
        phoneInput.value =
        rentInput.value =
        dueDateInput.value =
        "";

    croppedImage = null;
    imageReady = false;

    render();
}

/********** MONTH SELECT **********/
function populateMonthSelector() {
    monthSelector.innerHTML = "";
    const y = new Date().getFullYear();

    for (let i = 0; i < 12; i++) {
        const key = `${y}-${String(i + 1).padStart(2, "0")}`;
        const o = document.createElement("option");
        o.value = key;
        o.textContent = new Date(y, i).toLocaleString("default", {
            month: "short",
            year: "numeric"
        });
        if (key === ACTIVE_MONTH) o.selected = true;
        monthSelector.appendChild(o);
    }
}

function changeMonth(m) {
    ACTIVE_MONTH = m;
    localStorage.setItem("activeMonth", m);
    render();
}

/********** PAYMENT **********/
function isPaid(t) {
    return t.history?.[ACTIVE_MONTH]?.status === "Paid";
}

function getTotal(t) {
    let total = t.rent;
    if (isPaid(t)) return total;

    const due = getDueDateForMonth(t, ACTIVE_MONTH);
    const today = new Date();
    if (today < due) return total;

    const daysLate = Math.floor((today - due) / 86400000);
    if (daysLate > 0) total += daysLate * 10;

    return total;
}

function markPaid(i) {
    if (!data[i].history) {
        data[i].history = {};
    }

    data[i].history[ACTIVE_MONTH] = {
        paid: getTotal(data[i]),
        status: "Paid"
    };

    dbRef.set(data);
    render();
}


/********** WHATSAPP **********/
function sendWhatsApp(i) {
    const t = data[i];
    if (!t.phone) return alert(`No phone for ${t.name}`);

    const phone = t.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
        `Hello ${t.name}, PG rent for ${getMonthName(
            ACTIVE_MONTH
        )} is ₹${getTotal(t)}`
    );

    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
}

/********** DELETE **********/
function removeTenant(i) {
    const enteredPin = prompt("Enter admin PIN to delete tenant");

    if (enteredPin === null) return; // user cancelled

    if (enteredPin !== ADMIN_PIN) {
        alert("Wrong PIN. Deletion cancelled.");
        return;
    }

    if (!confirm("Are you sure you want to delete this tenant?")) return;

    data.splice(i, 1);
    dbRef.set(data);
    render();
}


/********** RENDER **********/
function render() {
    tenantList.innerHTML = "";
    let paid = 0,
        unpaid = 0;

    data.forEach((t, i) => {
        const total = getTotal(t);
        if (isPaid(t)) paid += total;
        else unpaid += total;

        tenantList.innerHTML += `
      <div class="card">
        <img src="${t.photo}">
        <h3>${t.name}</h3>
        <small>Room ${t.room}</small>
        <small>Due Day: ${t.dueDay}</small>
        <p>₹${total}</p>
        <div>
          ${!isPaid(t)
                ? `<button onclick="markPaid(${i})">✔ Paid</button>`
                : ""
            }
          <button onclick="sendWhatsApp(${i})">📲 WhatsApp</button>
          <button onclick="removeTenant(${i})">🗑 Delete</button>
        </div>
      </div>`;
    });

    document.getElementById("paidEl").textContent = paid;
    document.getElementById("pendingEl").textContent = unpaid;

    drawChart(paid, unpaid);
    populateMonthSelector();
}

/********** CHART **********/
function drawChart(paid, unpaid) {
    if (chart) chart.destroy();

    chart = new Chart(chartEl, {
        type: "doughnut",
        data: {
            labels: ["Paid", "Pending"],
            datasets: [{ data: [paid, unpaid] }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } }
        }
    });
}

/********** INIT **********/
populateMonthSelector();
render();
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js");
    });
}
