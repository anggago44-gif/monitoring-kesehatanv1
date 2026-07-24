// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
const topicReadings = "sensorReadings";

// Memory Data Pasien Real-time
let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
let ecgPhase = 0;

// Config Buffer Grafik (Fixed Array 30 Point - Ultra Ringan & Bebas Lag)
const MAX_POINTS = 30;
let xBuffer = Array.from({ length: MAX_POINTS }, (_, i) => i);
let yHrBuffer = Array(MAX_POINTS).fill(0);
let ySpo2Buffer = Array(MAX_POINTS).fill(0);
let yTempBuffer = Array(MAX_POINTS).fill(0);
let yTensiBuffer = Array(MAX_POINTS).fill(0);

let isRendering = false; // Mencegah CPU Lag / Bottleneck Rendering

// ================= FUNGSI RESET UTAMA =================
function resetSemuaData() {
  console.log("Memulai proses reset data...");

  // 1. Reset Variabel Internal Data Pasien
  currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
  
  // 2. Clear Buffer Array Grafik (Kembalikan ke Nilai 0)
  yHrBuffer.fill(0);
  ySpo2Buffer.fill(0);
  yTempBuffer.fill(0);
  yTensiBuffer.fill(0);

  // 3. Reset Tampilan Angka Card UI
  if (document.getElementById("temp")) document.getElementById("temp").innerText = "0.0°C";
  if (document.getElementById("spo2")) document.getElementById("spo2").innerText = "0%";
  if (document.getElementById("hr"))   document.getElementById("hr").innerText   = "0 bpm";
  if (document.getElementById("bp"))   document.getElementById("bp").innerText   = "0/0 mmHg";

  // 4. Reset Tampilan Status Medis
  let statusEl = document.getElementById("status");
  let adviceBox = document.getElementById("medical-advice");
  if (statusEl) {
    statusEl.innerText = "DATA DIRESET";
    statusEl.style.color = "orange";
  }
  if (adviceBox) {
    adviceBox.innerText = "Sistem telah direset. Silakan tempatkan sensor pada pasien.";
  }

  // 5. Render Ulang Grafik dan Gauge ke Nilai 0
  renderChartsFast();
  updateGaugeFast("gaugeHR", 0, "lime");
  updateGaugeFast("gaugeSpo2", 0, "lime");
  updateGaugeFast("gaugeTemp", 0, "cyan");
  updateGaugeFast("gaugeBP", 0, "orange");

  console.log("Semua data berhasil direset ke 0! ✅");
}

// Alias agar onclick="resetSemuaParameter()" pada HTML membaca fungsi ini
window.resetSemuaParameter = function() {
  resetSemuaData();
};

// ================= LOGIKA PROFIL PASIEN =================
function muatProfilPasienLama() {
  let profilTersimpan = localStorage.getItem("profilPasienAktif");
  if (profilTersimpan) {
    let profil = JSON.parse(profilTersimpan);
    updateText("p-rm", profil.rm);
    updateText("p-name", profil.nama);
    updateText("p-ttl", (profil.tempat || "-") + ", " + (profil.tanggalStr || "-"));
    updateText("p-age", profil.usia);
    updateText("p-gender", profil.gender);
    updateText("p-alamat", profil.alamat || "-");
  }
}

function updateText(id, val) {
  let el = document.getElementById(id);
  if (el) el.innerText = val || "-";
}

// ================= LOGIKA TABEL LOG & EXCEL =================
function simpanKeRiwayatLog() {
  let dataBaru = {
    waktu: new Date().toLocaleDateString('id-ID') + " " + new Date().toLocaleTimeString('id-ID'),
    rm: document.getElementById("p-rm")?.innerText || "-",
    nama: document.getElementById("p-name")?.innerText || "-",
    ttl: document.getElementById("p-ttl")?.innerText || "-",
    gender: document.getElementById("p-gender")?.innerText || "-",
    usia: document.getElementById("p-age")?.innerText || "-",
    alamat: document.getElementById("p-alamat")?.innerText || "-",
    suhu: (currentData.temp > 0 ? currentData.temp.toFixed(1) : "0.0") + " °C",
    spo2: currentData.spo2 + " %",
    hr: currentData.hr + " bpm",
    tensi: currentData.sys + "/" + currentData.dia + " mmHg"
  };

  let arrayRiwayat = JSON.parse(localStorage.getItem("riwayatMedisPasien") || "[]");
  arrayRiwayat.unshift(dataBaru);
  if (arrayRiwayat.length > 50) arrayRiwayat.pop();

  localStorage.setItem("riwayatMedisPasien", JSON.stringify(arrayRiwayat));
  tampilkanTabelRiwayat();
}

function tampilkanTabelRiwayat() {
  let arrayRiwayat = JSON.parse(localStorage.getItem("riwayatMedisPasien") || "[]");
  let tbody = document.getElementById("log-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (arrayRiwayat.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#666;">Belum ada riwayat pemeriksaan.</td></tr>`;
    return;
  }

  arrayRiwayat.forEach(row => {
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.waktu}</td>
      <td style="color:#00ffff; font-weight:bold;">${row.rm}</td>
      <td style="color:#f39c12; font-weight:bold;">${row.nama}</td>
      <td>${row.gender} (${row.usia})</td>
      <td style="color:#ff3333; font-weight:bold;">${row.hr}</td>
      <td>${row.spo2}</td>
      <td>${row.suhu}</td>
      <td style="color:orange; font-weight:bold;">${row.tensi}</td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadCSV() {
  let arrayRiwayat = JSON.parse(localStorage.getItem("riwayatMedisPasien") || "[]");
  if (arrayRiwayat.length === 0) {
    alert("Tidak ada data log yang bisa didownload!");
    return;
  }

  let csvContent = "Waktu,No RM,Nama,TTL,Gender,Usia,Alamat,HR (BPM),SpO2 (%),Suhu (°C),Tensi (mmHg)\n";
  arrayRiwayat.forEach(row => {
    csvContent += `"${row.waktu}","${row.rm}","${row.nama}","${row.ttl}","${row.gender}","${row.usia}","${row.alamat}","${row.hr}","${row.spo2}","${row.suhu}","${row.tensi}"\n`;
  });

  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Rekap_Log_Kesehatan.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ================= PLOTLY LAYOUT CONFIG (LIGHTWEIGHT) =================
const chartLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white", size: 11 },
  margin: { l: 35, r: 15, t: 30, b: 25 },
  xaxis: { visible: false, fixedrange: true },
  yaxis: { fixedrange: true }
};

function initPlotly() {
  if (!document.getElementById("chartHR")) return;

  Plotly.newPlot("chartHR", [{ x: xBuffer, y: yHrBuffer, mode: "lines", line: { color: "#ff3333", width: 2 } }], { ...chartLayout, title: "ECG / BPM" }, { staticPlot: true });
  Plotly.newPlot("chartSpo2", [{ x: xBuffer, y: ySpo2Buffer, mode: "lines", line: { color: "lime", width: 2 } }], { ...chartLayout, title: "SpO₂ (%)", yaxis: { range: [0, 105] } }, { staticPlot: true });
  Plotly.newPlot("chartTemp", [{ x: xBuffer, y: yTempBuffer, mode: "lines", line: { color: "cyan", width: 2 } }], { ...chartLayout, title: "Suhu (°C)", yaxis: { range: [20, 50] } }, { staticPlot: true });
  Plotly.newPlot("chartTensi", [{ x: xBuffer, y: yTensiBuffer, mode: "lines", line: { color: "orange", width: 2 } }], { ...chartLayout, title: "Manset (mmHg)", yaxis: { range: [0, 220] } }, { staticPlot: true });

  initGauge("gaugeHR", "bpm", 150);
  initGauge("gaugeSpo2", "%", 100);
  initGauge("gaugeTemp", "°C", 50);
  initGauge("gaugeBP", "mmHg", 200);
}

function initGauge(id, unit, max) {
  if (!document.getElementById(id)) return;
  Plotly.newPlot(id, [{
    type: "indicator", mode: "gauge+number", value: 0,
    number: { suffix: " " + unit, font: { size: 22, weight: "bold" } },
    gauge: {
      axis: { range: [0, max], tickfont: { size: 10, color: "white" } },
      bar: { color: "lime", thickness: 0.3 },
      bgcolor: "black", bordercolor: "#333", borderwidth: 1
    }
  }], { paper_bgcolor: "black", font: { color: "white" }, height: 160, margin: { t: 20, b: 10, l: 10, r: 10 } }, { staticPlot: true });
}

function renderChartsFast() {
  if (!document.getElementById("chartHR")) return;
  Plotly.react("chartHR", [{ x: xBuffer, y: yHrBuffer, mode: "lines", line: { color: "#ff3333", width: 2 } }], { ...chartLayout, title: "ECG / BPM" });
  Plotly.react("chartSpo2", [{ x: xBuffer, y: ySpo2Buffer, mode: "lines", line: { color: "lime", width: 2 } }], { ...chartLayout, title: "SpO₂ (%)", yaxis: { range: [0, 105] } });
  Plotly.react("chartTemp", [{ x: xBuffer, y: yTempBuffer, mode: "lines", line: { color: "cyan", width: 2 } }], { ...chartLayout, title: "Suhu (°C)", yaxis: { range: [20, 50] } });
  Plotly.react("chartTensi", [{ x: xBuffer, y: yTensiBuffer, mode: "lines", line: { color: "orange", width: 2 } }], { ...chartLayout, title: "Manset (mmHg)", yaxis: { range: [0, 220] } });
}

function updateGaugeFast(id, val, color) {
  if (document.getElementById(id)) {
    Plotly.restyle(id, { value: val, "gauge.bar.color": color }, [0]);
  }
}

function getEcgYValue(bpm) {
  if (bpm <= 0) return 0;
  ecgPhase = (ecgPhase + 1) % 10;
  if (ecgPhase === 5) return bpm * 1.8;
  if (ecgPhase === 6) return bpm * 0.6;
  return bpm;
}

// ================= MQTT RECEIVER =================
client.on("connect", () => {
  console.log("MQTT Terhubung ✅");
  client.subscribe(topicReadings);
});

client.on("message", (topic, msg) => {
  if (topic !== topicReadings) return;

  try {
    let data = JSON.parse(msg.toString());

    // 1. Parsing Suhu (Nilai Terkunci Agar Tidak Hilang Saat Tensi Kirim Data)
    let rawTemp = data.temperature ?? data.temp;
    if (rawTemp !== undefined && Number(rawTemp) > 25 && Number(rawTemp) < 50) {
      currentData.temp = Number(rawTemp);
    }

    // 2. Parsing SpO2 & Heart Rate
    if (data.spo2 && Number(data.spo2) > 0) currentData.spo2 = Number(data.spo2);
    let rawHr = data.heartRate ?? data.heartrate ?? data.hr;
    if (rawHr && Number(rawHr) > 0) currentData.hr = Number(rawHr);

    // 3. Parsing Tensi
    let mmHgLive = Number(data.mmHgLive || data.pressure || 0);
    let sys = Number(data.systolic || 0);
    let dia = Number(data.diastolic || 0);

    if (sys > 0 && dia > 0) {
      currentData.sys = sys;
      currentData.dia = dia;
      simpanKeRiwayatLog();
    }

    // 4. Update Array Buffer
    yHrBuffer.shift(); yHrBuffer.push(getEcgYValue(currentData.hr));
    ySpo2Buffer.shift(); ySpo2Buffer.push(currentData.spo2);
    yTempBuffer.shift(); yTempBuffer.push(currentData.temp);
    yTensiBuffer.shift(); yTensiBuffer.push(mmHgLive);

    // 5. Update Text UI
    updateUI(mmHgLive);

    // 6. Fast Rendering Anti-Lag (Throttle FPS)
    if (!isRendering) {
      isRendering = true;
      requestAnimationFrame(() => {
        renderChartsFast();
        isRendering = false;
      });
    }

  } catch (e) {
    console.error("Data Error:", e);
  }
});

function updateUI(mmHgLive) {
  if (!document.getElementById("temp")) return;

  document.getElementById("temp").innerText = (currentData.temp > 0 ? currentData.temp.toFixed(1) : "0.0") + "°C";
  document.getElementById("spo2").innerText = currentData.spo2 + "%";
  document.getElementById("hr").innerText   = currentData.hr + " bpm";
  document.getElementById("bp").innerText   = currentData.sys + "/" + currentData.dia + " mmHg";

  let hrColor = (currentData.hr > 100 || (currentData.hr < 60 && currentData.hr > 0)) ? "red" : "lime";
  updateGaugeFast("gaugeHR", currentData.hr, hrColor);
  updateGaugeFast("gaugeSpo2", currentData.spo2, "lime");
  updateGaugeFast("gaugeTemp", currentData.temp, "cyan");
  updateGaugeFast("gaugeBP", mmHgLive, "orange");

  evaluasiKondisiKlinis();
}

function evaluasiKondisiKlinis() {
  let statusEl = document.getElementById("status");
  let adviceBox = document.getElementById("medical-advice");
  if (!statusEl || !adviceBox) return;

  if (currentData.temp === 0 && currentData.spo2 === 0 && currentData.hr === 0) {
    statusEl.innerText = "MENUNGGU DATA...";
    statusEl.style.color = "orange";
    adviceBox.innerText = "Sistem siap. Tempelkan sensor ke pasien.";
    return;
  }

  let issues = [];
  if (currentData.temp > 37.5) issues.push("Demam");
  if (currentData.temp > 0 && currentData.temp < 35.0) issues.push("Hipotermia");
  if (currentData.spo2 > 0 && currentData.spo2 < 95) issues.push("Hipoksia (SpO2 Rendah)");
  if (currentData.hr > 100) issues.push("Takikardia (HR Tinggi)");
  if (currentData.hr > 0 && currentData.hr < 50) issues.push("Bradikardia (HR Rendah)");
  if (currentData.sys > 135) issues.push("Hipertensi");

  if (issues.length === 0) {
    statusEl.innerText = "AMAN (NORMAL)";
    statusEl.style.color = "#2ecc71";
    adviceBox.innerHTML = "✅ <strong>Kondisi Normal:</strong> Seluruh tanda vital pasien dalam keadaan baik.";
  } else {
    statusEl.innerText = "BUTUH PERAWATAN";
    statusEl.style.color = "#e74c3c";
    adviceBox.innerHTML = `⚠️ <strong>Peringatan Medis:</strong> ${issues.join(", ")}.`;
  }
}

// ================= EVENT LISTENER LOAD =================
window.addEventListener("load", () => {
  muatProfilPasienLama();
  tampilkanTabelRiwayat();
  initPlotly();

  // Pengikat tombol reset secara langsung
  let resetBtn = document.querySelector("button[onclick*='reset']");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetSemuaData);
    console.log("Tombol Reset Berhasil Terhubung! 🔘");
  }
});
