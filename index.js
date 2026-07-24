// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
const topicReadings = "sensorReadings";

// Memory Data Pasien Real-time
let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
let ecgPhase = 0;

// Config Buffer Grafik (Fixed Array 30 Point)
const MAX_POINTS = 30;
let xBuffer = Array.from({ length: MAX_POINTS }, (_, i) => i);
let yHrBuffer = Array(MAX_POINTS).fill(0);
let ySpo2Buffer = Array(MAX_POINTS).fill(0);
let yTempBuffer = Array(MAX_POINTS).fill(0);
let yTensiBuffer = Array(MAX_POINTS).fill(0);

let isRendering = false;

// ================= FUNGSI RESET UTAMA =================
function resetSemuaData() {
  console.log("Memulai proses reset data...");

  currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
  
  yHrBuffer.fill(0);
  ySpo2Buffer.fill(0);
  yTempBuffer.fill(0);
  yTensiBuffer.fill(0);

  if (document.getElementById("temp")) document.getElementById("temp").innerText = "0.0°C";
  if (document.getElementById("spo2")) document.getElementById("spo2").innerText = "0%";
  if (document.getElementById("hr"))   document.getElementById("hr").innerText   = "0 bpm";
  if (document.getElementById("bp"))   document.getElementById("bp").innerText   = "0/0 mmHg";

  let statusEl = document.getElementById("status");
  let adviceBox = document.getElementById("medical-advice");
  if (statusEl) {
    statusEl.innerText = "DATA DIRESET";
    statusEl.style.color = "orange";
  }
  if (adviceBox) {
    adviceBox.innerText = "Sistem telah direset. Silakan tempatkan sensor pada pasien.";
  }

  renderChartsFast();
  updateGaugeFast("gaugeHR", 0, "lime");
  updateGaugeFast("gaugeSpo2", 0, "lime");
  updateGaugeFast("gaugeTemp", 0, "cyan");
  updateGaugeFast("gaugeBP", 0, "orange");

  console.log("Semua data berhasil direset ke 0! ✅");
}

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

// ================= PLOTLY LAYOUT CONFIG =================
const chartLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white", size: 11 },
  margin: { l: 35, r: 15, t: 30, b: 25 },
  xaxis: { visible: false, fixedrange: true },
  yaxis: { fixedrange: true, autorange: true }
};

function initPlotly() {
  if (!document.getElementById("chartHR")) return;

  Plotly.newPlot("chartHR", [{ x: xBuffer, y: yHrBuffer, mode: "lines+markers", line: { color: "#ff3333", width: 2 } }], { ...chartLayout, title: "ECG / BPM" }, { responsive: true });
  Plotly.newPlot("chartSpo2", [{ x: xBuffer, y: ySpo2Buffer, mode: "lines+markers", line: { color: "lime", width: 2 } }], { ...chartLayout, title: "SpO₂ (%)" }, { responsive: true });
  Plotly.newPlot("chartTemp", [{ x: xBuffer, y: yTempBuffer, mode: "lines+markers", line: { color: "cyan", width: 2 } }], { ...chartLayout, title: "Suhu (°C)" }, { responsive: true });
  Plotly.newPlot("chartTensi", [{ x: xBuffer, y: yTensiBuffer, mode: "lines+markers", line: { color: "orange", width: 2 } }], { ...chartLayout, title: "Manset (mmHg)" }, { responsive: true });

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
  }], { paper_bgcolor: "black", font: { color: "white" }, height: 160, margin: { t: 20, b: 10, l: 10, r: 10 } }, { responsive: true });
}

// FUNGSI UPDATE GRAFIK PAKSA RENDER ULANG
function renderChartsFast() {
  if (!document.getElementById("chartHR")) return;

  Plotly.react("chartHR", [{ x: xBuffer, y: [...yHrBuffer], mode: "lines+markers", line: { color: "#ff3333", width: 2 } }], { ...chartLayout, title: "ECG / BPM" });
  Plotly.react("chartSpo2", [{ x: xBuffer, y: [...ySpo2Buffer], mode: "lines+markers", line: { color: "lime", width: 2 } }], { ...chartLayout, title: "SpO₂ (%)" });
  Plotly.react("chartTemp", [{ x: xBuffer, y: [...yTempBuffer], mode: "lines+markers", line: { color: "cyan", width: 2 } }], { ...chartLayout, title: "Suhu (°C)" });
  Plotly.react("chartTensi", [{ x: xBuffer, y: [...yTensiBuffer], mode: "lines+markers", line: { color: "orange", width: 2 } }], { ...chartLayout, title: "Manset (mmHg)" });
}

function updateGaugeFast(id, val, color) {
  if (document.getElementById(id)) {
    Plotly.restyle(id, { value: val, "gauge.bar.color": color }, [0]);
  }
}

// FUNGSI MEMBUAT PULSA DENYUT JANTUNG NYATA
function generateEcgPoint(bpm) {
  if (!bpm || bpm <= 0) return 0; // Mengembalikan 0 saat sensor lepas/BPM 0
  
  ecgPhase = (ecgPhase + 1) % 8;
  
  if (ecgPhase === 3) return bpm * 1.4; // Puncak R
  if (ecgPhase === 4) return -bpm * 0.2; // Lembah S
  if (ecgPhase === 5) return bpm * 0.3;  // Gelombang T
  return bpm * 0.8 + (Math.random() * 2 - 1);
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

    // 1. Parsing Suhu
    let rawTemp = data.temperature ?? data.temp;
    if (rawTemp !== undefined) {
      let valTemp = Number(rawTemp);
      currentData.temp = (valTemp >= 25 && valTemp < 50) ? valTemp : 0;
    }

    // 2. Parsing SpO2 & Heart Rate (Perbaikan: Tangani nilai 0 saat lepas)
    let rawSpo2 = data.spo2 ?? data.SpO2;
    if (rawSpo2 !== undefined) {
      let valSpo2 = Number(rawSpo2);
      currentData.spo2 = (valSpo2 > 0 && valSpo2 <= 100) ? valSpo2 : 0;
    }

    let rawHr = data.heartRate ?? data.heartrate ?? data.hr ?? data.bpm ?? data.BPM;
    if (rawHr !== undefined) {
      let valHr = Number(rawHr);
      currentData.hr = (valHr > 0 && valHr < 220) ? valHr : 0;
    }

    // 3. Parsing Tensi
    let mmHgLive = Number(data.mmHgLive || data.pressure || data.mmhg || 0);
    let sys = Number(data.systolic || data.sys || 0);
    let dia = Number(data.diastolic || data.dia || 0);

    if (sys > 0 && dia > 0) {
      currentData.sys = sys;
      currentData.dia = dia;
      simpanKeRiwayatLog();
    }

    // 4. Masukkan Data Baru ke Buffer Array
    yHrBuffer.shift(); 
    yHrBuffer.push(generateEcgPoint(currentData.hr));

    ySpo2Buffer.shift(); 
    ySpo2Buffer.push(currentData.spo2);

    yTempBuffer.shift(); 
    yTempBuffer.push(currentData.temp);

    yTensiBuffer.shift(); 
    let valTensi = mmHgLive > 0 ? mmHgLive : currentData.sys;
    yTensiBuffer.push(valTensi);

    // 5. Update UI & Render Grafik
    updateUI(mmHgLive);
    renderChartsFast();

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
  
  let bpGaugeVal = mmHgLive > 0 ? mmHgLive : currentData.sys;
  updateGaugeFast("gaugeBP", bpGaugeVal, "orange");

  evaluasiKondisiKlinis(mmHgLive);
}

// ================= SISTEM PENDUKUNG KEPUTUSAN KLINIS =================
function evaluasiKondisiKlinis(mmHgLive) {
  let statusEl = document.getElementById("status");
  let adviceBox = document.getElementById("medical-advice");
  if (!statusEl || !adviceBox) return;

  if (currentData.temp === 0 && currentData.spo2 === 0 && currentData.hr === 0 && currentData.sys === 0) {
    statusEl.innerText = "MENUNGGU DATA...";
    statusEl.style.color = "orange";
    adviceBox.innerText = "Sistem siap. Tempelkan sensor ke pasien.";
    return;
  }

  let issues = [];

  // 1. Evaluasi Suhu
  if (currentData.temp > 37.5) issues.push("Demam (Suhu Tinggi)");
  if (currentData.temp > 0 && currentData.temp < 35.0) issues.push("Hipotermia (Suhu Rendah)");

  // 2. Evaluasi SpO2
  if (currentData.spo2 > 0 && currentData.spo2 < 95) issues.push("Hipoksia (SpO2 Rendah)");

  // 3. Evaluasi Heart Rate (HR)
  if (currentData.hr > 100) issues.push("Takikardia (HR Tinggi)");
  if (currentData.hr > 0 && currentData.hr < 50) issues.push("Bradikardia (HR Rendah)");

  // 4. Evaluasi Tekanan Darah
  if (currentData.sys > 0 && currentData.dia > 0) {
    let tensiTinggi = (currentData.sys > 120 || currentData.dia > 80);
    let tensiRendah = (currentData.sys < 90  || currentData.dia < 60);

    if (tensiTinggi) {
      issues.push(`Tensi Tinggi (${currentData.sys}/${currentData.dia} mmHg)`);
    } else if (tensiRendah) {
      issues.push(`Tensi Rendah (${currentData.sys}/${currentData.dia} mmHg)`);
    }
  } else if (mmHgLive > 10) {
    issues.push(`Manset Sedang Memompa (${mmHgLive} mmHg)...`);
  }

  // Update Tampilan UI Dashboard
  if (issues.length === 0) {
    statusEl.innerText = "AMAN (NORMAL)";
    statusEl.style.color = "#2ecc71";
    adviceBox.innerHTML = "✅ <strong>Kondisi Normal:</strong> Seluruh tanda vital & tekanan darah pasien dalam keadaan baik.";
  } else {
    statusEl.innerText = "BUTUH PERAWATAN";
    statusEl.style.color = "#e74c3c";
    adviceBox.innerHTML = `⚠️ <strong>Peringatan Medis:</strong><br> • ${issues.join("<br> • ")}`;
  }
}

// ================= EVENT LISTENER LOAD =================
window.addEventListener("load", () => {
  muatProfilPasienLama();
  tampilkanTabelRiwayat();
  initPlotly();

  let resetBtn = document.querySelector("button[onclick*='reset']");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetSemuaData);
    console.log("Tombol Reset Berhasil Terhubung! 🔘");
  }
});
