// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
const topicReadings = "sensorReadings";
const topicControl  = "sensorControl";

// Memory Data Pasien Real-time
let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
let liveMmHg = 0;

// Dynamic Filter Baseline untuk Grafik Denyut PPG
let irFilterBaseline = 0;

// Sumbu X UTUH & KAKU (Tetap dari 0 sampai 49, TIDAK BERGESER/BERJALAN)
const MAX_POINTS = 50;
const xDataStatic = Array.from({ length: MAX_POINTS }, (_, i) => i);

// Buffer Data Y (Nilai Sinyal)
let yDataHR = Array(MAX_POINTS).fill(0);
let yDataSpo2 = Array(MAX_POINTS).fill(0);
let yDataTemp = Array(MAX_POINTS).fill(0);
let yDataTensi = Array(MAX_POINTS).fill(0);

let isRenderPending = false;

// ================= FUNGSI RESET UTAMA =================
function resetSemuaParameter() {
  currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
  liveMmHg = 0;
  irFilterBaseline = 0;

  if (document.getElementById("temp")) {
    document.getElementById("temp").innerHTML = "0.0°C";
    document.getElementById("spo2").innerHTML = "0%";
    document.getElementById("hr").innerHTML   = "0 bpm";
    document.getElementById("bp").innerHTML   = "0/0 mmHg";
  }

  let statusEl = document.getElementById("status");
  let adviceBox = document.getElementById("medical-advice");
  if (statusEl) {
    statusEl.innerHTML = "DATA DIRESET / MENUNGGU DATA BARU";
    statusEl.style.color = "orange";
  }
  if (adviceBox) {
    adviceBox.innerHTML = "Tampilan berhasil direset. Silakan posisikan sensor pada pasien untuk pemeriksaan baru.";
  }

  // Clear Buffer Y
  yDataHR = Array(MAX_POINTS).fill(0);
  yDataSpo2 = Array(MAX_POINTS).fill(0);
  yDataTemp = Array(MAX_POINTS).fill(0);
  yDataTensi = Array(MAX_POINTS).fill(0);

  // Render Ulang Grafik Setelah Reset
  renderAllCharts();

  // Reset Gauges ke 0
  drawGauge("gaugeHR", 0, "lime", 150, "bpm");
  drawGauge("gaugeSpo2", 0, "lime", 100, "%");
  drawGauge("gaugeTemp", 0, "cyan", 50, "°C");
  drawGauge("gaugeBP", 0, "orange", 200, "mmHg");

  // Kirim perintah RESET ke ESP32
  sendCommand("RESET");

  console.log("Semua Parameter Berhasil Direset ke 0! ✅");
}

// ================= LOGIKA MEMUAT PROFIL PASIEN =================
function muatProfilPasienLama() {
  let profilTersimpan = localStorage.getItem("profilPasienAktif");
  
  if (profilTersimpan) {
    let profil = JSON.parse(profilTersimpan);
    updateTextElement("p-rm", profil.rm);
    updateTextElement("p-name", profil.nama);
    updateTextElement("p-ttl", (profil.tempat || "-") + ", " + (profil.tanggalStr || "-"));
    updateTextElement("p-age", profil.usia);
    updateTextElement("p-gender", profil.gender);
    updateTextElement("p-alamat", profil.alamat || "-");
  } else {
    updateTextElement("p-rm", "RM-2026-001");
    updateTextElement("p-name", "Belum Ada Pasien");
    updateTextElement("p-ttl", "-");
    updateTextElement("p-age", "-");
    updateTextElement("p-gender", "-");
    updateTextElement("p-alamat", "-");
  }
}

function updateTextElement(id, value) {
  let el = document.getElementById(id);
  if (el) el.innerText = value;
}

// ================= LOGIKA TABEL LOG & EXCEL =================
function simpanKeRiwayatLog() {
  let rmPasien = document.getElementById("p-rm") ? document.getElementById("p-rm").innerText : "-";
  let namaPasien = document.getElementById("p-name") ? document.getElementById("p-name").innerText : "-";
  let ttlPasien = document.getElementById("p-ttl") ? document.getElementById("p-ttl").innerText : "-";
  let usiaPasien = document.getElementById("p-age") ? document.getElementById("p-age").innerText : "-";
  let genderPasien = document.getElementById("p-gender") ? document.getElementById("p-gender").innerText : "-";
  let alamatPasien = document.getElementById("p-alamat") ? document.getElementById("p-alamat").innerText : "-";
  
  let sekarang = new Date();
  let waktuStr = sekarang.toLocaleDateString('id-ID') + " " + sekarang.toLocaleTimeString('id-ID');

  let dataBaru = {
    waktu: waktuStr,
    rm: rmPasien,
    nama: namaPasien,
    ttl: ttlPasien,
    gender: genderPasien,
    usia: usiaPasien,
    alamat: alamatPasien,
    suhu: currentData.temp.toFixed(1) + " °C",
    spo2: currentData.spo2 + " %",
    hr: currentData.hr + " bpm",
    tensi: currentData.sys + "/" + currentData.dia + " mmHg"
  };

  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];
  arrayRiwayat.unshift(dataBaru);

  localStorage.setItem("riwayatMedisPasien", JSON.stringify(arrayRiwayat));
  tampilkanTabelRiwayat();
}

function tampilkanTabelRiwayat() {
  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];
  let tbody = document.getElementById("log-table-body");
  
  if (!tbody) return; 
  tbody.innerHTML = ""; 

  if (arrayRiwayat.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#666;">Belum ada riwayat pemeriksaan pasien.</td></tr>`;
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
  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];

  if (arrayRiwayat.length === 0) {
    alert("Tidak ada data log yang bisa didownload!");
    return;
  }

  let csvContent = "Waktu Pemeriksaan,No RM,Nama Pasien,TTL,Gender,Usia,Alamat,Heart Rate (BPM),Saturasi SpO2,Suhu Tubuh,Tekanan Darah (mmHg)\n";

  arrayRiwayat.forEach(row => {
    csvContent += `"${row.waktu}","${row.rm}","${row.nama}","${row.ttl}","${row.gender}","${row.usia}","${row.alamat}","${row.hr}","${row.spo2}","${row.suhu}","${row.tensi}"\n`;
  });

  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Rekap_Log_Riwayat_Kesehatan.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ================= INITIALIZATION PLOTLY GRAFIK & GAUGE =================
const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white", size: 12 },
  margin: { l: 40, r: 20, t: 35, b: 30 }
};

// Sumbu X Kaku (Ter-lock)
const xAxisFixed = {
  range: [0, MAX_POINTS - 1],
  fixedrange: true,
  autorange: false,
  showgrid: true,
  gridcolor: "#222"
};

function initCharts() {
  if (!document.getElementById("chartHR")) return;

  Plotly.newPlot("chartHR", [{ x: xDataStatic, y: yDataHR, mode: "lines", line: { color: "#ff3333", width: 2.5, shape: 'spline' } }], { ...darkLayout, title: "Grafik Denyut Jantung (PPG)", xaxis: xAxisFixed }, { responsive: true });
  Plotly.newPlot("chartSpo2", [{ x: xDataStatic, y: yDataSpo2, mode: "lines", line: { color: "lime", width: 2.5 } }], { ...darkLayout, title: "SpO₂ (%)", xaxis: xAxisFixed, yaxis: { range: [0, 105] } }, { responsive: true });
  Plotly.newPlot("chartTemp", [{ x: xDataStatic, y: yDataTemp, mode: "lines", line: { color: "cyan", width: 2.5 } }], { ...darkLayout, title: "Suhu Tubuh (°C)", xaxis: xAxisFixed, yaxis: { range: [20, 50] } }, { responsive: true });
  Plotly.newPlot("chartTensi", [{ x: xDataStatic, y: yDataTensi, mode: "lines", line: { color: "orange", width: 2.5 } }], { ...darkLayout, title: "Tekanan Manset (mmHg)", xaxis: xAxisFixed, yaxis: { range: [0, 220] } }, { responsive: true });
}

function drawGauge(id, value, color, max, unit) {
  if (!document.getElementById(id)) return;
  Plotly.react(id, [{
    type: "indicator",
    mode: "gauge+number",
    value: value,
    number: { suffix: " " + unit, font: { size: 24, weight: "bold" } },
    gauge: {
      axis: { range: [0, max], tickfont: { size: 10, color: "white" } },
      bar: { color: color, thickness: 0.35 },
      bgcolor: "black",
      bordercolor: "#333",
      borderwidth: 1.5,
      steps: [
        { range: [0, max * 0.5], color: "#001a00" },
        { range: [max * 0.5, max * 0.8], color: "#222200" },
        { range: [max * 0.8, max], color: "#2b0000" }
      ]
    }
  }], {
    paper_bgcolor: "black",
    font: { color: "white" },
    height: 180,
    margin: { t: 25, b: 15, l: 15, r: 15 }
  }, { responsive: true });
}

// ================= RENDER GRAFIK DENGAN LATAR DIAM/DI-LOCK =================
function renderAllCharts() {
  if (!document.getElementById("chartHR")) return;

  // 1. Render Denyut PPG (Rentang Y Menyesuaikan Gelombang Agar Tampak Berdetak)
  let minHR = Math.min(...yDataHR);
  let maxHR = Math.max(...yDataHR);
  let padHR = (maxHR - minHR) * 0.2 || 10;

  Plotly.react("chartHR", [{
    x: xDataStatic, y: yDataHR, mode: "lines", line: { color: "#ff3333", width: 2.5, shape: 'spline' }
  }], {
    ...darkLayout,
    title: "Grafik Denyut Jantung (PPG)",
    xaxis: xAxisFixed,
    yaxis: { range: [minHR - padHR, maxHR + padHR], zeroline: false }
  });

  // 2. Render SpO2 (Latar Kaku)
  Plotly.react("chartSpo2", [{
    x: xDataStatic, y: yDataSpo2, mode: "lines", line: { color: "lime", width: 2.5 }
  }], {
    ...darkLayout,
    title: "SpO₂ (%)",
    xaxis: xAxisFixed,
    yaxis: { range: [0, 105] }
  });

  // 3. Render Suhu (Latar Kaku)
  Plotly.react("chartTemp", [{
    x: xDataStatic, y: yDataTemp, mode: "lines", line: { color: "cyan", width: 2.5 }
  }], {
    ...darkLayout,
    title: "Suhu Tubuh (°C)",
    xaxis: xAxisFixed,
    yaxis: { range: [20, 50] }
  });

  // 4. Render Tekanan Manset (Latar Kaku)
  Plotly.react("chartTensi", [{
    x: xDataStatic, y: yDataTensi, mode: "lines", line: { color: "orange", width: 2.5 }
  }], {
    ...darkLayout,
    title: "Tekanan Manset (mmHg)",
    xaxis: xAxisFixed,
    yaxis: { range: [0, 220] }
  });
}

// ================= MQTT RECEIVER =================
client.on("connect", () => {
  console.log("MQTT CONNECTED SUCCESFULLY ✅");
  client.subscribe(topicReadings);
});

client.on("message", (topic, msg) => {
  if (topic !== topicReadings) return;

  try {
    let data = JSON.parse(msg.toString());

    // 1. Reading Raw Wave (PPG)
    let rawWave = 0;
    if (data.raw !== undefined) rawWave = Number(data.raw);
    else if (data.ir !== undefined) rawWave = Number(data.ir);
    else if (data.ppg !== undefined) rawWave = Number(data.ppg);

    // 2. DETEKSI JARI LEPAS / DATA KOSONG
    if (data.finger === false || rawWave < 10000 || (data.spo2 === 0 && (data.heartRate === 0 || data.hr === 0))) {
      currentData.temp = 0;
      currentData.spo2 = 0;
      currentData.hr   = 0;
      rawWave = 0;
      irFilterBaseline = 0;
    } else {
      if (data.temperature !== undefined) currentData.temp = Number(data.temperature);
      else if (data.temp !== undefined) currentData.temp = Number(data.temp);

      if (data.spo2 !== undefined) currentData.spo2 = Number(data.spo2);
      
      let rawHr = data.heartRate || data.heartrate || data.hr;
      if (rawHr !== undefined) currentData.hr = Number(rawHr);
    }

    // 3. Filter Gelombang PPG (Denyut Berayun Tanpa Menggeser Latar)
    let ppgPlotVal = 0;
    if (rawWave > 0) {
      if (irFilterBaseline === 0) irFilterBaseline = rawWave;
      irFilterBaseline = (irFilterBaseline * 0.9) + (rawWave * 0.1);
      ppgPlotVal = rawWave - irFilterBaseline;
    }

    // 4. Reading Manset Tensi
    if (data.mmHgLive !== undefined) liveMmHg = Number(data.mmHgLive);
    else if (data.pressure !== undefined) liveMmHg = Number(data.pressure);

    let systolic = Number(data.systolic || 0); 
    let diastolic = Number(data.diastolic || 0); 
    if (systolic > 0 && diastolic > 0) { 
      currentData.sys = systolic; 
      currentData.dia = diastolic; 
      simpanKeRiwayatLog();
    }

    // 5. UPDATE BUFFER HANYA UNTUK SUMBU Y (SUMBU X UTUH DARI 0-49)
    yDataHR.shift();
    yDataHR.push(ppgPlotVal);

    yDataSpo2.shift();
    yDataSpo2.push(currentData.spo2);

    yDataTemp.shift();
    yDataTemp.push(currentData.temp);

    yDataTensi.shift();
    yDataTensi.push(liveMmHg);

    // 6. Update UI Tampilan Angka Card & Gauge
    if (document.getElementById("temp")) {
      document.getElementById("temp").innerHTML = (currentData.temp > 0 ? currentData.temp.toFixed(1) : "0.0") + "°C";
      document.getElementById("spo2").innerHTML = (currentData.spo2 > 0 ? currentData.spo2 : "0") + "%";
      document.getElementById("hr").innerHTML   = (currentData.hr > 0 ? currentData.hr : "0") + " bpm";
      document.getElementById("bp").innerHTML   = currentData.sys + "/" + currentData.dia + " mmHg";

      let hrColor = (currentData.hr > 100 || (currentData.hr < 60 && currentData.hr > 0)) ? "red" : "lime";
      drawGauge("gaugeHR", currentData.hr, hrColor, 150, "bpm");
      drawGauge("gaugeSpo2", currentData.spo2, "lime", 100, "%");
      drawGauge("gaugeTemp", currentData.temp, "cyan", 50, "°C");
      drawGauge("gaugeBP", liveMmHg, "orange", 200, "mmHg");

      evaluasiKondisiKlinis();
    }

    // 7. Render Grafik
    if (!isRenderPending) {
      isRenderPending = true;
      requestAnimationFrame(() => {
        renderAllCharts();
        isRenderPending = false;
      });
    }

  } catch (e) { 
    console.error("JSON PARSE ERROR:", e); 
  }
});

// ================= KONTROL PERINTAH KE ESP32 =================
function sendCommand(cmd) {
  if (client && client.connected) {
    client.publish(topicControl, cmd);
    console.log("Perintah Terkirim ke ESP32:", cmd);
  } else {
    alert("MQTT belum terhubung!");
  }
}

// ================= EVALUASI KONDISI KLINIS PASIEN =================
function evaluasiKondisiKlinis() {
  let statusEl = document.getElementById("status");
  let adviceBox = document.getElementById("medical-advice");
  if (!statusEl || !adviceBox) return;

  if (currentData.temp === 0 && currentData.spo2 === 0 && currentData.hr === 0) {
    statusEl.innerHTML = "MENUNGGU DATA / JARI LEPAS";
    statusEl.style.color = "orange";
    adviceBox.innerHTML = "Sensor siap. Silakan posisikan jari pasien pada sensor.";
    return;
  }

  let issues = [];

  if (currentData.temp > 37.5) issues.push("Demam (Suhu Tinggi)");
  if (currentData.temp > 0 && currentData.temp < 35.0) issues.push("Hipotermia (Suhu Rendah)");
  if (currentData.spo2 > 0 && currentData.spo2 < 95) issues.push("Saturasi Oksigen Rendah");
  if (currentData.hr > 100) issues.push("Detak Jantung Cepat (Takikardia)");
  if (currentData.hr > 0 && currentData.hr < 50) issues.push("Detak Jantung Lambat (Bradikardia)");
  if (currentData.sys > 135) issues.push("Tekanan Darah Tinggi (Hipertensi)");

  if (issues.length === 0) {
    statusEl.innerHTML = "NORMAL";
    statusEl.style.color = "#2ecc71";
    adviceBox.innerHTML = "✅ <strong>Status Pasien: NORMAL.</strong> Seluruh parameter tanda vital pasien dalam batas aman.";
  } else {
    statusEl.innerHTML = "BUTUH PERAWATAN";
    statusEl.style.color = "#e74c3c";
    adviceBox.innerHTML = `⚠️ <strong>Status Pasien: BUTUH PERAWATAN.</strong><br><em>Indikasi Klinis Terdeteksi:</em> ${issues.join(", ")}.<br><em>Saran:</em> Posisikan pasien rileks dan berikan tindakan perawatan awal atau observasi lebih lanjut.`;
  }
}

function resizeCharts() {
  ["chartHR", "chartSpo2", "chartTemp", "chartTensi", "gaugeHR", "gaugeSpo2", "gaugeTemp", "gaugeBP"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { Plotly.Plots.resize(el); }
  });
}

window.addEventListener("load", () => {
  muatProfilPasienLama();
  tampilkanTabelRiwayat(); 
  initCharts();
  resizeCharts();
});
window.addEventListener("resize", resizeCharts);
setTimeout(resizeCharts, 600);
