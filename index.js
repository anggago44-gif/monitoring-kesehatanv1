// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
let x = 0;
let ecgPhase = 0; // Untuk simulasi gelombang ECG/Denyut Jantung

const topicReadings = "sensorReadings";
let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };

// Flag untuk mendeteksi apakah Gauge sudah di-init awal
let gaugeInitialized = false;

// ================= LOGIKA MEMUAT PROFIL AKTIF =================
function muatProfilPasienLama() {
  let profilTersimpan = localStorage.getItem("profilPasienAktif");
  
  if (profilTersimpan) {
    let profil = JSON.parse(profilTersimpan);
    document.getElementById("p-rm").innerText = profil.rm || "RM-2026-001";
    document.getElementById("p-name").innerText = profil.nama || "-";
    document.getElementById("p-ttl").innerText = (profil.tempat || "-") + ", " + (profil.tanggalStr || "-");
    document.getElementById("p-age").innerText = profil.usia || "-";
    document.getElementById("p-gender").innerText = profil.gender || "-";
    document.getElementById("p-alamat").innerText = profil.alamat || "-";
  } else {
    document.getElementById("p-rm").innerText = "RM-2026-001";
    document.getElementById("p-name").innerText = "Belum Ada Pasien";
    document.getElementById("p-ttl").innerText = "-";
    document.getElementById("p-age").innerText = "-";
    document.getElementById("p-gender").innerText = "-";
    document.getElementById("p-alamat").innerText = "-";
  }
}

// ================= LOGIKA TABEL LOG & EXCEL =================
function simpanKeRiwayatLog() {
  let rmPasien = document.getElementById("p-rm").innerText;
  let namaPasien = document.getElementById("p-name").innerText;
  let ttlPasien = document.getElementById("p-ttl").innerText;
  let usiaPasien = document.getElementById("p-age").innerText;
  let genderPasien = document.getElementById("p-gender").innerText;
  let alamatPasien = document.getElementById("p-alamat").innerText;
  
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
    suhu: (currentData.temp > 0 ? currentData.temp.toFixed(1) : "0.0") + " °C",
    spo2: currentData.spo2 + " %",
    hr: currentData.hr + " bpm",
    tensi: currentData.sys + "/" + currentData.dia + " mmHg"
  };

  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];
  arrayRiwayat.unshift(dataBaru);

  // Simpan maksimal 100 riwayat agar localStorage tidak overload
  if (arrayRiwayat.length > 100) arrayRiwayat.pop();

  localStorage.setItem("riwayatMedisPasien", JSON.stringify(arrayRiwayat));
  tampilkanTabelRiwayat();
}

function tampilkanTabelRiwayat() {
  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];
  let tbody = document.getElementById("log-table-body");
  
  if (!tbody) return; 
  tbody.innerHTML = ""; 

  if(arrayRiwayat.length === 0) {
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

  if(arrayRiwayat.length === 0) {
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

// ================= FUNGSI RESET DATA =================
function resetSemuaData() {
  if (confirm("Apakah Anda yakin ingin mereset data riwayat dan grafik real-time?")) {
    // 1. Reset Variabel Internal
    currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
    x = 0;

    // 2. Clear LocalStorage Riwayat
    localStorage.removeItem("riwayatMedisPasien");
    tampilkanTabelRiwayat();

    // 3. Reset Tampilan UI Text
    if (document.getElementById("temp")) {
      document.getElementById("temp").innerHTML = "0.0°C";
      document.getElementById("spo2").innerHTML = "0%";
      document.getElementById("hr").innerHTML = "0 bpm";
      document.getElementById("bp").innerHTML = "0/0 mmHg";
    }

    // 4. Purge / Clear Grafik Line
    ["chartHR", "chartSpo2", "chartTemp", "chartTensi"].forEach(id => {
      if (document.getElementById(id)) {
        Plotly.react(id, [{ x: [], y: [], mode: "lines", line: { width: 3 } }], darkLayout);
      }
    });

    // 5. Reset Gauges ke 0
    updateGauge("gaugeHR", 0, "lime");
    updateGauge("gaugeSpo2", 0, "lime");
    updateGauge("gaugeTemp", 0, "cyan");
    updateGauge("gaugeBP", 0, "orange");

    evaluasiKondisiKlinis();
    alert("Data berhasil direset!");
  }
}

// ================= PLOTLY LAYOUT & OPTIMIZED GAUGE =================
const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white", size: 14 },
  title: { font: { size: 16, weight: "bold" } },
  margin: { l: 50, r: 20, t: 40, b: 35 }
};

function initChartsAndGauges() {
  if (!document.getElementById("chartHR")) return;

  // Inisialisasi Chart Line
  Plotly.newPlot("chartHR", [{ x: [], y: [], mode: "lines", line: { color: "#ff3333", width: 2.5 } }], { ...darkLayout, title: "Grafik Gelombang Denyut Jantung (ECG / BPM)" });
  Plotly.newPlot("chartSpo2", [{ x: [], y: [], mode: "lines", line: { color: "lime", width: 3 } }], { ...darkLayout, title: "Tren SpO₂ (%)" });
  Plotly.newPlot("chartTemp", [{ x: [], y: [], mode: "lines", line: { color: "cyan", width: 3 } }], { ...darkLayout, title: "Tren Suhu Tubuh (°C)" });
  Plotly.newPlot("chartTensi", [{ x: [], y: [], mode: "lines", line: { color: "orange", width: 3 } }], { ...darkLayout, title: "Grafik Tekanan Manset Real-time (mmHg)" });

  // Inisialisasi Gauge Sekali di Awal (Mencegah Lag / Delay)
  createInitialGauge("gaugeHR", 0, "lime", 150, "bpm");
  createInitialGauge("gaugeSpo2", 0, "lime", 100, "%");
  createInitialGauge("gaugeTemp", 0, "cyan", 50, "°C");
  createInitialGauge("gaugeBP", 0, "orange", 200, "mmHg");

  gaugeInitialized = true;
}

function createInitialGauge(id, value, color, max, unit) {
  if (!document.getElementById(id)) return;
  Plotly.newPlot(id, [{
    type: "indicator",
    mode: "gauge+number",
    value: value,
    number: { suffix: " " + unit, font: { size: 28, weight: "bold" } },
    gauge: {
      axis: { range: [0, max], tickfont: { size: 11, color: "white" } },
      bar: { color: color, thickness: 0.35 },
      bgcolor: "black",
      bordercolor: "#333",
      borderwidth: 2,
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
  });
}

// UPDATE GAUGE DENGAN RESTYLE (SANGAT CEPAT, NO DELAY)
function updateGauge(id, val, barColor) {
  if (!document.getElementById(id) || !gaugeInitialized) return;
  Plotly.restyle(id, {
    value: val,
    "gauge.bar.color": barColor
  }, [0]);
}

// SIMULASI GELOMBANG DENYUT JANTUNG (ECG) BERDASARKAN NILAI BPM
function getEcgYValue(bpm) {
  if (bpm <= 0) return 0;
  ecgPhase = (ecgPhase + 1) % 10;
  if (ecgPhase === 2) return bpm + (bpm * 0.15);  // P Wave
  if (ecgPhase === 4) return bpm - (bpm * 0.25);  // Q Dip
  if (ecgPhase === 5) return bpm + (bpm * 0.85);  // R Spike
  if (ecgPhase === 6) return bpm - (bpm * 0.40);  // S Dip
  if (ecgPhase === 8) return bpm + (bpm * 0.25);  // T Wave
  return bpm; // Baseline
}

// ================= MQTT CLIENT HANDLER =================
client.on("connect", () => {
  console.log("MQTT CONNECTED SUCCESFULLY ✅");
  client.subscribe(topicReadings);
});

client.on("message", (topic, msg) => {
  if (topic !== topicReadings) return;

  try {
    let data = JSON.parse(msg.toString());

    // ----------------------------------------------------
    // 1. FIX SUHU HILANG-HILANG: HANYA UPDATE JIKA DATA ADA
    // ----------------------------------------------------
    let rawTemp = data.temperature !== undefined ? Number(data.temperature) : (data.temp !== undefined ? Number(data.temp) : null);
    if (rawTemp !== null && rawTemp > 25 && rawTemp !== 127 && rawTemp !== -127) {
      currentData.temp = rawTemp; // Update jika suhu valid
    }

    // 2. Parsing Saturasi Oksigen SpO2
    if (data.spo2 !== undefined && Number(data.spo2) > 0) {
      currentData.spo2 = Number(data.spo2);
    }

    // 3. Parsing Heart Rate (BPM)
    let rawHr = data.heartRate || data.heartrate || data.hr;
    if (rawHr !== undefined && Number(rawHr) > 0) {
      currentData.hr = Number(rawHr);
    }

    // 4. Parsing Tensi Meter
    let mmHgLive = data.mmHgLive !== undefined ? Number(data.mmHgLive) : 0; 
    let systolic = data.systolic !== undefined ? Number(data.systolic) : 0;  
    let diastolic = data.diastolic !== undefined ? Number(data.diastolic) : 0; 

    if (systolic > 0 && diastolic > 0) { 
      currentData.sys = systolic; 
      currentData.dia = diastolic; 
      simpanKeRiwayatLog(); // Simpan log saat pengukuran tensi selesai
    }

    // UPDATE DISPLAY UI
    if (document.getElementById("temp")) {
      document.getElementById("temp").innerHTML = (currentData.temp > 0 ? currentData.temp.toFixed(1) : "0.0") + "°C";
      document.getElementById("spo2").innerHTML = currentData.spo2 + "%";
      document.getElementById("hr").innerHTML = currentData.hr + " bpm";
      document.getElementById("bp").innerHTML = currentData.sys + "/" + currentData.dia + " mmHg";

      // Extend Data Real-time ke Grafik Plotly
      let ecgY = getEcgYValue(currentData.hr);
      Plotly.extendTraces("chartHR", { x: [[x]], y: [[ecgY]] }, [0]);
      Plotly.extendTraces("chartSpo2", { x: [[x]], y: [[currentData.spo2]] }, [0]);
      Plotly.extendTraces("chartTemp", { x: [[x]], y: [[currentData.temp]] }, [0]);
      Plotly.extendTraces("chartTensi", { x: [[x]], y: [[mmHgLive]] }, [0]); 

      // Geser Sumbu X (Max 30 Data Point untuk Efisiensi Memori)
      ["chartHR", "chartSpo2", "chartTemp", "chartTensi"].forEach(id => {
        Plotly.relayout(id, { "xaxis.range": [Math.max(0, x - 30), x] });
      });

      // Update Gauge secara ringan menggunakan restyle
      let hrColor = (currentData.hr > 100 || (currentData.hr < 60 && currentData.hr > 0)) ? "red" : "lime";
      updateGauge("gaugeHR", currentData.hr, hrColor);
      updateGauge("gaugeSpo2", currentData.spo2, "lime");
      updateGauge("gaugeTemp", currentData.temp, "cyan");
      updateGauge("gaugeBP", mmHgLive, "orange"); 

      // EVALUASI KONDISI PASIEN
      evaluasiKondisiKlinis();
    }
    x++;
  } 
  catch (e) { 
    console.error("JSON PARSING / MQTT ERROR:", e); 
  }
});

function evaluasiKondisiKlinis() {
  let statusEl = document.getElementById("status");
  let adviceBox = document.getElementById("medical-advice");
  if (!statusEl || !adviceBox) return;

  if (currentData.temp === 0 && currentData.spo2 === 0 && currentData.hr === 0) {
    statusEl.innerHTML = "MENUNGGU DATA...";
    statusEl.style.color = "orange";
    adviceBox.innerHTML = "Sistem siap menerima data. Silakan tempatkan sensor pada pasien.";
    return;
  }

  let issues = [];

  // Ambang batas parameter medis
  if (currentData.temp > 37.5) issues.push("Suhu tinggi (Demam)");
  if (currentData.temp > 0 && currentData.temp < 35.0) issues.push("Suhu rendah (Hipotermia)");
  if (currentData.spo2 > 0 && currentData.spo2 < 95) issues.push("Saturasi O2 rendah (Hipoksia)");
  if (currentData.hr > 100) issues.push("Detak jantung cepat (Takikardia)");
  if (currentData.hr > 0 && currentData.hr < 50) issues.push("Detak jantung lambat (Bradikardia)");
  if (currentData.sys > 135) issues.push("Tekanan darah tinggi (Hipertensi)");

  if (issues.length === 0) {
    statusEl.innerHTML = "AMAN (NORMAL)";
    statusEl.style.color = "#2ecc71";
    adviceBox.innerHTML = "✅ <strong>Sistem Terdeteksi Normal:</strong> Seluruh tanda-tanda vital pasien dalam ambang batas aman.";
  } else {
    statusEl.innerHTML = "BUTUH PERAWATAN";
    statusEl.style.color = "#e74c3c";
    adviceBox.innerHTML = `⚠️ <strong>Peringatan Indikasi Klinis:</strong> ${issues.join(", ")}. <br><em>Rekomendasi:</em> Segera lakukan evaluasi medis lanjutan atau tindakan pertolongan pertama pada pasien.`;
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
  initChartsAndGauges();
  resizeCharts();
});

window.addEventListener("resize", resizeCharts);
