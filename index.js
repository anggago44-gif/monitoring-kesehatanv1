// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
let x = 0;

const topicReadings = "sensorReadings";
const topicControl = "sensorControl"; 

let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
let currentStep = 0; 

// ================= LOGIKA MEMUAT PROFIL AKTIF (LOCALSTORAGE) =================
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

// ================= LOGIKA TABEL RIWAYAT LOG PASIEN & EXCEL =================
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
      <td>${row.suhu}</td>
      <td>${row.spo2}</td>
      <td>${row.hr}</td>
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

  let csvContent = "Waktu Pemeriksaan,No RM,Nama Pasien,TTL,Gender,Usia,Alamat,Suhu Tubuh,Saturasi SpO2,Heart Rate (BPM),Tekanan Darah (mmHg)\n";

  arrayRiwayat.forEach(row => {
    csvContent += `"${row.waktu}","${row.rm}","${row.nama}","${row.ttl}","${row.gender}","${row.usia}","${row.alamat}","${row.suhu}","${row.spo2}","${row.hr}","${row.tensi}"\n`;
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

// ================= LAYOUT GLOBAL PLOTLY =================
const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white", size: 15 },
  title: { font: { size: 18, weight: "bold" } },
  margin: { l: 55, r: 25, t: 50, b: 40 }
};

if (document.getElementById("chartTemp")) {
  Plotly.newPlot("chartTemp", [{ x: [], y: [], mode: "lines", line: { color: "cyan", width: 3.5 } }], { ...darkLayout, title: "Tren Suhu Tubuh (°C)" });
  Plotly.newPlot("chartSpo2", [{ x: [], y: [], mode: "lines", line: { color: "lime", width: 3.5 } }], { ...darkLayout, title: "Tren SpO₂ (%)" });
  Plotly.newPlot("chartHR", [{ x: [], y: [], mode: "lines", line: { color: "red", width: 3.5 } }], { ...darkLayout, title: "Tren Heart Rate (BPM)" });
  Plotly.newPlot("chartTensi", [{ x: [], y: [], mode: "lines", line: { color: "orange", width: 3.5 } }], { ...darkLayout, title: "Grafik Tekanan Manset Real-time (mmHg)" });
}

function drawGauge(id, value, color, max, unit) {
  if (!document.getElementById(id)) return;
  Plotly.newPlot(id, [{
    type: "indicator",
    mode: "gauge+number",
    value: value,
    number: { suffix: " " + unit, font: { size: 34, weight: "bold" } },
    gauge: {
      axis: { range: [0, max], tickfont: { size: 13, color: "white" } },
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
    height: 220,
    margin: { t: 40, b: 20, l: 20, r: 20 }
  });
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
    
    // Sinkronisasi Parsing Data dari Perangkat Keras (ESP32)
    let suhu = data.temperature !== undefined ? Number(data.temperature) : (data.temp !== undefined ? Number(data.temp) : currentData.temp);
    let saturasiOksi = data.spo2 !== undefined ? Number(data.spo2) : currentData.spo2;
    
    let hr = 0;
    if (data.heartRate !== undefined) hr = Number(data.heartRate);
    else if (data.heartrate !== undefined) hr = Number(data.heartrate);
    else hr = currentData.hr;

    let mmHgLive = Number(data.mmHgLive || 0); 
    let systolic = Number(data.systolic || 0);  
    let diastolic = Number(data.diastolic || 0); 

    // Update data global hanya jika nilai yang diterima valid
    if (suhu !== -127 && suhu > 0) currentData.temp = suhu;
    if (saturasiOksi > 0) currentData.spo2 = saturasiOksi;
    if (hr > 0) currentData.hr = hr;
    
    if (systolic > 0) { 
      currentData.sys = systolic; 
      currentData.dia = diastolic; 
      
      if (currentStep === 3) { 
        currentStep = 4; 
        updateWorkflowUI(); 
        simpanKeRiwayatLog(); 
      }
    }

    if (document.getElementById("temp")) {
      document.getElementById("temp").innerHTML = currentData.temp.toFixed(1) + "°C";
      document.getElementById("spo2").innerHTML = currentData.spo2 + "%";
      document.getElementById("hr").innerHTML = currentData.hr + " bpm";
      document.getElementById("bp").innerHTML = currentData.sys + "/" + currentData.dia + " mmHg";

      // Dorong data valid ke grafik tren Plotly
      Plotly.extendTraces("chartTemp", { x: [[x]], y: [[currentData.temp]] }, [0]);
      Plotly.extendTraces("chartSpo2", { x: [[x]], y: [[currentData.spo2]] }, [0]);
      Plotly.extendTraces("chartHR", { x: [[x]], y: [[currentData.hr]] }, [0]);
      Plotly.extendTraces("chartTensi", { x: [[x]], y: [[mmHgLive]] }, [0]); 

      ["chartTemp", "chartSpo2", "chartHR", "chartTensi"].forEach(id => {
        Plotly.relayout(id, { "xaxis.range": [Math.max(0, x - 20), x] });
      });

      let hrColor = (currentData.hr > 100 || currentData.hr < 60) ? "red" : "lime";
      drawGauge("gauge1", currentData.temp, "cyan", 50, "°C");
      drawGauge("gauge2", currentData.spo2, "lime", 100, "%");
      drawGauge("gauge3", currentData.hr, hrColor, 150, "bpm");
      drawGauge("gauge4", mmHgLive, "orange", 200, "mmHg"); 

      let statusText = "NORMAL";
      let statusColor = "lime";
      if (currentData.hr > 100 || currentData.hr < 50 || currentData.spo2 < 94 || currentData.temp > 37.5 || currentData.sys > 135) {
        statusText = "WASPADA / ABNORMAL";
        statusColor = "red";
      }
      document.getElementById("status").innerHTML = statusText;
      document.getElementById("status").style.color = statusColor;

      generateMedicalAdvice();
    }
    x++;
  } 
  catch (e) { console.log("JSON TRANSLATION ERROR:", e); }
});

function generateMedicalAdvice() {
  let adviceBox = document.getElementById("medical-advice");
  if (!adviceBox) return;
  
  if (currentStep === 1) {
    adviceBox.innerHTML = `⏳ <strong>[Langkah 1]</strong> Mengukur Suhu Tubuh aktif (${currentData.temp.toFixed(1)}°C)... <br>Sistem sedang menstabilkan data pembacaan sensor suhu.`;
    return;
  }
  if (currentStep === 2) {
    adviceBox.innerHTML = `⏳ <strong>[Langkah 2]</strong> Mengukur SpO₂ (${currentData.spo2}%) & Heart Rate (${currentData.hr} bpm)... <br>Pastikan jari menempel dengan pas pada sensor oksimeter.`;
    return;
  }
  if (currentStep === 3) {
    adviceBox.innerHTML = `🩺 <strong>[Langkah 3]</strong> Pengecekan Tensi Meter Sedang Berjalan... <br>Manset lengan sedang melakukan pemompaan udara. Harap tenang selama proses.`;
    return;
  }

  if (currentData.temp === 0 && currentData.spo2 === 0) return;

  let adviceText = "✅ <strong>Pemeriksaan Selesai.</strong> ";
  let issues = [];

  if (currentData.temp > 37.5) issues.push("Suhu tubuh tinggi (Demam)");
  if (currentData.temp < 35.0) issues.push("Suhu tubuh rendah (Hipotermia)");
  if (currentData.spo2 < 95) issues.push("Saturasi Oksigen Rendah (Hipoksia Ringan)");
  if (currentData.hr > 100) issues.push("Detak jantung cepat (Takikardia)");
  if (currentData.sys > 135) issues.push("Tekanan darah tinggi (Hipertensi)");

  if (issues.length === 0) {
    adviceText += "Seluruh parameter tanda vital pasien berada dalam batas <strong>NORMAL</strong>.";
  } else {
    adviceText += `⚠️ <strong>Temuan Indikasi Klinis:</strong> ${issues.join(", ")}. <br><em>Saran Medis:</em> Posisikan pasien berbaring rileks, berikan hidrasi cukup, dan lakukan pengecekan ulang berkala beberapa menit lagi.`;
  }
  adviceBox.innerHTML = adviceText;
}

function updateWorkflowUI() {
    if (!document.getElementById("step1")) return;
    for(let i=1; i<=3; i++) {
        let el = document.getElementById("step" + i);
        el.className = "step";
        if(i < currentStep || currentStep === 4) el.classList.add("done");
        if(i === currentStep) el.classList.add("active");
    }
    document.getElementById("btn-next-alur").disabled = (currentStep === 0 || currentStep >= 3);
}

function startWorkflow() {
    currentStep = 1;
    updateWorkflowUI();
    client.publish(topicControl, "ALUR_SUHU");
}

function nextStep() {
    if(currentStep === 1) {
        currentStep = 2;
        client.publish(topicControl, "ALUR_OXY");
    } else if(currentStep === 2) {
        currentStep = 3;
        client.publish(topicControl, "ALUR_TENSI");
    }
    updateWorkflowUI();
}

// ================= LOGIKA RESET TOTAL DASHBOARD & WORKFLOW =================
function resetWorkflow() {
    // 1. Kembalikan variabel data koordinat & nilai internal ke awal
    currentStep = 0;
    x = 0;
    currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
    
    // 2. Kirim sinyal interupsi total ke modul hardware ESP32
    client.publish(topicControl, "STOP");
    
    // 3. Kembalikan UI langkah alur kerja
    updateWorkflowUI();
    
    // 4. Setel ulang visual teks angka medis di HTML kembali ke nol
    if (document.getElementById("temp")) {
      document.getElementById("temp").innerHTML = "0.0°C";
      document.getElementById("spo2").innerHTML = "0%";
      document.getElementById("hr").innerHTML = "0 bpm";
      document.getElementById("bp").innerHTML = "0/0 mmHg";
      
      document.getElementById("status").innerHTML = "NORMAL";
      document.getElementById("status").style.color = "lime";
    }
    
    if (document.getElementById("medical-advice")) {
      document.getElementById("medical-advice").innerHTML = 'Sistem direset. Silakan klik <strong>"MULAI PERIKSA LENGKAP"</strong> untuk memulai alur kembali.';
    }

    // 5. Bersihkan data titik koordinat (X & Y) pada grafik real-time Plotly
    const chartIds = ["chartTemp", "chartSpo2", "chartHR", "chartTensi"];
    chartIds.forEach(id => {
      if (document.getElementById(id)) {
        Plotly.update(id, { x: [[]], y: [[]] }, {}, [0]);
        Plotly.relayout(id, { "xaxis.range": [0, 20] });
      }
    });

    // 6. Kembalikan jarum penunjuk indikator lingkaran (Gauge) ke angka nol
    if (document.getElementById("gauge1")) {
      drawGauge("gauge1", 0, "cyan", 50, "°C");
      drawGauge("gauge2", 0, "lime", 100, "%");
      drawGauge("gauge3", 0, "lime", 150, "bpm");
      drawGauge("gauge4", 0, "orange", 200, "mmHg");
    }
    
    console.log("DASHBOARD DAN WORKFLOW BERHASIL DIRESET TOTAL 🔄");
}

function resizeCharts() {
  ["chartTemp", "chartSpo2", "chartHR", "chartTensi", "gauge1", "gauge2", "gauge3", "gauge4"].forEach(id => {
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
