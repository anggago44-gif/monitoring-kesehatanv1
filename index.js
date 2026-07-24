// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
const topicReadings = "sensorReadings";

let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
let liveMmHg = 0;

// Counter sumbu X dan Fasa Gelombang
let xIndex = 0;
let ecgPhase = 0;

// Buffer Data Sumbu X dan Y untuk Plotly
const maxPoints = 50; // Jumlah titik garis yang tampil di layar
let xDataHR = Array.from({length: maxPoints}, (_, i) => i);
let yDataHR = Array(maxPoints).fill(0);

// ================= LOGIKA MEMUAT PROFIL AKTIF =================
function muatProfilPasienLama() {
  let profilTersimpan = localStorage.getItem("profilPasienAktif");
  
  if (profilTersimpan) {
    let profil = JSON.parse(profilTersimpan);
    document.getElementById("p-rm").innerText = profil.rm;
    document.getElementById("p-name").innerText = profil.nama;
    document.getElementById("p-ttl").innerText = (profil.tempat || "-") + ", " + (profil.tanggalStr || "-");
    document.getElementById("p-age").innerText = profil.usia;
    document.getElementById("p-gender").innerText = profil.gender;
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

// ================= LOGIKA RIWAYAT TABEL LOG & EXCEL =================
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

// ================= PLOTLY INITIALIZATION =================
const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white", size: 12 },
  margin: { l: 40, r: 20, t: 35, b: 30 }
};

if (document.getElementById("chartHR")) {
  // Setup grafik BPM dengan Sumbu Y terkunci agar lonjakan puncaknya terlihat jelas
  Plotly.newPlot("chartHR", [{
    x: xDataHR,
    y: yDataHR,
    mode: "lines",
    line: { color: "#ff3333", width: 2 }
  }], {
    ...darkLayout,
    title: "Grafik Gelombang Denyut Jantung (ECG / BPM)",
    yaxis: { range: [-20, 160], autorange: false }
  });

  Plotly.newPlot("chartSpo2", [{ x: [], y: [], mode: "lines", line: { color: "lime", width: 2.5 } }], { ...darkLayout, title: "Tren SpO₂ (%)" });
  Plotly.newPlot("chartTemp", [{ x: [], y: [], mode: "lines", line: { color: "cyan", width: 2.5 } }], { ...darkLayout, title: "Tren Suhu Tubuh (°C)" });
  Plotly.newPlot("chartTensi", [{ x: [], y: [], mode: "lines", line: { color: "orange", width: 2.5 } }], { ...darkLayout, title: "Grafik Tekanan Manset Real-time (mmHg)" });
}

function drawGauge(id, value, color, max, unit) {
  if (!document.getElementById(id)) return;
  Plotly.newPlot(id, [{
    type: "indicator",
    mode: "gauge+number",
    value: value,
    number: { suffix: " " + unit, font: { size: 26, weight: "bold" } },
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
    height: 190,
    margin: { t: 25, b: 15, l: 15, r: 15 }
  });
}

// ================= GENERATOR GELOMBANG DENYUT JANTUNG (P-QRS-T) =================
function hitungNilaiDenyutEcg(bpm) {
  if (bpm <= 0) return 0; // Garis datar jika tidak ada denyut

  ecgPhase = (ecgPhase + 1) % 10;
  
  // Pola Bentuk Denyut ECG Rumah Sakit berdasarkan fase
  switch(ecgPhase) {
    case 1: return bpm * 0.15;            // Gelombang P kecil
    case 3: return -bpm * 0.20;           // Defleksi Q
    case 4: return bpm * 1.40;            // Puncak R-Spike (Denyut Paling Tinggi)
    case 5: return -bpm * 0.35;           // Lembah S
    case 7: return bpm * 0.25;            // Gelombang T
    default: return (Math.random() * 2);  // Noise baseline alami
  }
}

// ================= LOOP ANIMASI DILAKUKAN SETIAP 100 MS =================
setInterval(() => {
  if (!document.getElementById("chartHR")) return;

  xIndex++;
  let bpmVal = currentData.hr;
  let ecgY = hitungNilaiDenyutEcg(bpmVal);

  // Geser array data ke kiri (efek mengalir berdenyut)
  xDataHR.shift();
  xDataHR.push(xIndex);
  
  yDataHR.shift();
  yDataHR.push(ecgY);

  // Update grafik BPM
  Plotly.react("chartHR", [{
    x: xDataHR,
    y: yDataHR,
    mode: "lines",
    line: { color: "#ff3333", width: 2 }
  }], {
    ...darkLayout,
    title: "Grafik Gelombang Denyut Jantung (ECG / BPM)",
    yaxis: { range: [-30, Math.max(120, bpmVal * 1.6)], autorange: false },
    xaxis: { range: [xDataHR[0], xDataHR[maxPoints - 1]] }
  });

}, 100); // 100 milidetik = 10 FPS gelombang mengalir dinamis

// ================= MQTT RECEIVER =================
client.on("connect", () => {
  console.log("MQTT CONNECTED SUCCESFULLY ✅");
  client.subscribe(topicReadings);
});

client.on("message", (topic, msg) => {
  if (topic !== topicReadings) return;

  try {
    let data = JSON.parse(msg.toString());
    
    // 1. Parsing Suhu Tubuh
    let rawTemp = data.temperature !== undefined ? Number(data.temperature) : (data.temp !== undefined ? Number(data.temp) : 0);
    if (rawTemp > 25 && rawTemp !== 127 && rawTemp !== -127) {
      currentData.temp = rawTemp;
    } else if (rawTemp === 0) {
      currentData.temp = 0;
    }

    // 2. Parsing SpO2
    let rawSpo2 = data.spo2 !== undefined ? Number(data.spo2) : 0;
    currentData.spo2 = rawSpo2 > 0 ? rawSpo2 : currentData.spo2;

    // 3. Parsing Heart Rate (BPM)
    let rawHr = 0;
    if (data.heartRate !== undefined) rawHr = Number(data.heartRate);
    else if (data.heartrate !== undefined) rawHr = Number(data.heartrate);
    else if (data.hr !== undefined) rawHr = Number(data.hr);
    if (rawHr > 0) currentData.hr = rawHr;

    // 4. Parsing Tensi
    liveMmHg = Number(data.mmHgLive || 0); 
    let systolic = Number(data.systolic || 0);  
    let diastolic = Number(data.diastolic || 0); 

    if (systolic > 0) { 
      currentData.sys = systolic; 
      currentData.dia = diastolic; 
      simpanKeRiwayatLog();
    }

    // Update Text UI
    if (document.getElementById("temp")) {
      document.getElementById("temp").innerHTML = (currentData.temp > 0 ? currentData.temp.toFixed(1) : "0.0") + "°C";
      document.getElementById("spo2").innerHTML = currentData.spo2 + "%";
      document.getElementById("hr").innerHTML = currentData.hr + " bpm";
      document.getElementById("bp").innerHTML = currentData.sys + "/" + currentData.dia + " mmHg";

      // Update Grafik Garis Lainnya (SpO2, Temp, Tensi)
      Plotly.extendTraces("chartSpo2", { x: [[xIndex]], y: [[currentData.spo2]] }, [0]);
      Plotly.extendTraces("chartTemp", { x: [[xIndex]], y: [[currentData.temp]] }, [0]);
      Plotly.extendTraces("chartTensi", { x: [[xIndex]], y: [[liveMmHg]] }, [0]); 

      ["chartSpo2", "chartTemp", "chartTensi"].forEach(id => {
        Plotly.relayout(id, { "xaxis.range": [Math.max(0, xIndex - 40), xIndex] });
      });

      // Update Gauges
      let hrColor = (currentData.hr > 100 || (currentData.hr < 60 && currentData.hr > 0)) ? "red" : "lime";
      drawGauge("gaugeHR", currentData.hr, hrColor, 150, "bpm");
      drawGauge("gaugeSpo2", currentData.spo2, "lime", 100, "%");
      drawGauge("gaugeTemp", currentData.temp, "cyan", 50, "°C");
      drawGauge("gaugeBP", liveMmHg, "orange", 200, "mmHg"); 

      evaluasiKondisiKlinis();
    }
  } 
  catch (e) { console.log("JSON PARSE ERROR:", e); }
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
  resizeCharts();
});
window.addEventListener("resize", resizeCharts);
setTimeout(resizeCharts, 600);
