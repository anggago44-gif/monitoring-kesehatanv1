// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
let x = 0;

const topicReadings = "sensorReadings";
const topicControl = "sensorControl"; 

let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
let currentStep = 0; 

// ================= LOGIKA PENYIMPANAN NAMA PASIEN AKTIF =================
function muatNamaPasienLama() {
  let namaTersimpan = localStorage.getItem("namaPasienAktif");
  if (namaTersimpan) {
    document.getElementById("p-name").innerText = namaTersimpan;
  } else {
    document.getElementById("p-name").innerText = "Tn. Ahmad Subarjo";
  }
}

function updateNamaPasien() {
  let inputVal = document.getElementById("input-nama-pasien").value;
  if(inputVal.trim() !== "") {
    document.getElementById("p-name").innerText = inputVal;
    localStorage.setItem("namaPasienAktif", inputVal);
    document.getElementById("input-nama-pasien").value = ""; 
  } else {
    alert("Silakan ketik nama terlebih dahulu!");
  }
}

// ================= LOGIKA TABEL RIWAYAT LOG & DOWNLOAD EXCEL (CSV) =================

// 1. Fungsi Simpan Riwayat Baru ke LocalStorage
function simpanKeRiwayatLog() {
  let namaPasien = document.getElementById("p-name").innerText;
  
  // Ambil waktu saat ini
  let sekarang = new Date();
  let waktuStr = sekarang.toLocaleDateString('id-ID') + " " + sekarang.toLocaleTimeString('id-ID');

  let dataBaru = {
    waktu: waktuStr,
    nama: namaPasien,
    suhu: currentData.temp.toFixed(1) + " °C",
    spo2: currentData.spo2 + " %",
    hr: currentData.hr + " bpm",
    tensi: currentData.sys + "/" + currentData.dia + " mmHg"
  };

  // Ambil riwayat lama dari localStorage (jika sudah ada)
  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];

  // Masukkan data baru ke baris paling atas
  arrayRiwayat.unshift(dataBaru);

  // Simpan kembali ke localStorage
  localStorage.setItem("riwayatMedisPasien", JSON.stringify(arrayRiwayat));

  // Perbarui tampilan tabel di web
  tampilkanTabelRiwayat();
}

// 2. Fungsi Menampilkan Data dari LocalStorage ke Tabel HTML
function tampilkanTabelRiwayat() {
  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];
  let tbody = document.getElementById("log-table-body");
  
  tbody.innerHTML = ""; // Bersihkan tabel lama

  if(arrayRiwayat.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#666;">Belum ada riwayat pemeriksaan pasien.</td></tr>`;
    return;
  }

  arrayRiwayat.forEach(row => {
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.waktu}</td>
      <td style="color:#00ffff; font-weight:bold;">${row.nama}</td>
      <td>${row.suhu}</td>
      <td>${row.spo2}</td>
      <td>${row.hr}</td>
      <td>${row.tensi}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. Fungsi Download Data Tabel menjadi File Excel (.CSV)
function downloadCSV() {
  let riwayatLama = localStorage.getItem("riwayatMedisPasien");
  let arrayRiwayat = riwayatLama ? JSON.parse(riwayatLama) : [];

  if(arrayRiwayat.length === 0) {
    alert("Tidak ada data log yang bisa didownload!");
    return;
  }

  // Definisikan Header Kolom Excel
  let csvContent = "Waktu Pemeriksaan,Nama Pasien,Suhu Tubuh,Saturasi SpO2,Heart Rate (BPM),Tekanan Darah (mmHg)\n";

  // Susun baris demi baris data
  arrayRiwayat.forEach(row => {
    csvContent += `"${row.waktu}","${row.nama}","${row.suhu}","${row.spo2}","${row.hr}","${row.tensi}"\n`;
  });

  // Proses download file via browser
  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Log_Riwayat_Kesehatan_Pasien.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 4. Fungsi Hapus Semua Riwayat Permanen
function hapusSemuaRiwayat() {
  if(confirm("Apakah Anda yakin ingin menghapus TOTAL semua riwayat log pasien?")) {
    localStorage.removeItem("riwayatMedisPasien");
    tampilkanTabelRiwayat();
  }
}


// ================= LAYOUT GLOBAL PLOTLY (TEKS SUMBU DI-BESARKAN) =================
const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white", size: 15 },
  title: { font: { size: 18, weight: "bold" } },
  margin: { l: 55, r: 25, t: 50, b: 40 }
};

// INITIALIZE PLOTLY REALTIME CHARTS
Plotly.newPlot("chartTemp", [{ x: [], y: [], mode: "lines", line: { color: "cyan", width: 3.5 } }], { ...darkLayout, title: "Tren Suhu Tubuh (°C)" });
Plotly.newPlot("chartSpo2", [{ x: [], y: [], mode: "lines", line: { color: "lime", width: 3.5 } }], { ...darkLayout, title: "Tren SpO₂ (%)" });
Plotly.newPlot("chartHR", [{ x: [], y: [], mode: "lines", line: { color: "red", width: 3.5 } }], { ...darkLayout, title: "Tren Heart Rate (BPM)" });
Plotly.newPlot("chartTensi", [{ x: [], y: [], mode: "lines", line: { color: "orange", width: 3.5 } }], { ...darkLayout, title: "Grafik Tekanan Manset Real-time (mmHg)" });

// DYNAMIC GAUGE GENERATOR
function drawGauge(id, value, color, max, unit) {
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

// MQTT CLIENT HANDLER
client.on("connect", () => {
  console.log("MQTT CONNECTED SUCCESFULLY ✅");
  client.subscribe(topicReadings);
});

client.on("message", (topic, msg) => {
  if (topic !== topicReadings) return;

  try {
    let data = JSON.parse(msg.toString());
    
    let suhu = Number(data.temperature || 0);
    let spo2 = Number(data.spo2 || 0);
    let hr = Number(data.heartRate || 0);
    let mmHgLive = Number(data.mmHgLive || 0); 
    let systolic = Number(data.systolic || 0);  
    let diastolic = Number(data.diastolic || 0); 

    currentData.temp = suhu;
    currentData.spo2 = spo2;
    currentData.hr = hr;
    
    if(systolic > 0) { 
      currentData.sys = systolic; 
      currentData.dia = diastolic; 
      
      // Jika alur berada di tensi meter (step 3) dan data tensi final masuk, simpan log otomatis!
      if (currentStep === 3) { 
        currentStep = 4; 
        updateWorkflowUI(); 
        simpanKeRiwayatLog(); // Pemicu rekam data otomatis
      }
    }

    document.getElementById("temp").innerHTML = suhu.toFixed(1) + "°C";
    document.getElementById("spo2").innerHTML = spo2 + "%";
    document.getElementById("hr").innerHTML = hr + " bpm";
    document.getElementById("bp").innerHTML = currentData.sys + "/" + currentData.dia + " mmHg";

    Plotly.extendTraces("chartTemp", { x: [[x]], y: [[suhu]] }, [0]);
    Plotly.extendTraces("chartSpo2", { x: [[x]], y: [[spo2]] }, [0]);
    Plotly.extendTraces("chartHR", { x: [[x]], y: [[hr]] }, [0]);
    Plotly.extendTraces("chartTensi", { x: [[x]], y: [[mmHgLive]] }, [0]); 

    ["chartTemp", "chartSpo2", "chartHR", "chartTensi"].forEach(id => {
      Plotly.relayout(id, { "xaxis.range": [Math.max(0, x - 20), x] });
    });

    let hrColor = (hr > 100 || hr < 60) ? "red" : "lime";
    drawGauge("gauge1", suhu, "cyan", 50, "°C");
    drawGauge("gauge2", spo2, "lime", 100, "%");
    drawGauge("gauge3", hr, hrColor, 150, "bpm");
    drawGauge("gauge4", mmHgLive, "orange", 200, "mmHg"); 

    let statusText = "NORMAL";
    let statusColor = "lime";
    if (hr > 100 || hr < 50 || spo2 < 94 || suhu > 37.5 || currentData.sys > 135) {
      statusText = "WASPADA / ABNORMAL";
      statusColor = "red";
    }
    document.getElementById("status").innerHTML = statusText;
    document.getElementById("status").style.color = statusColor;

    generateMedicalAdvice();
    x++;
  } 
  catch (e) { console.log("JSON TRANSLATION ERROR:", e); }
});

// LOGIKA SISTEM REKOMENDASI MEDIS OTOMATIS
function generateMedicalAdvice() {
  let adviceBox = document.getElementById("medical-advice");
  
  if (currentStep === 1) {
    adviceBox.innerHTML = `⏳ <strong>[Langkah 1]</strong> Mengukur Suhu Tubuh aktif (${currentData.temp.toFixed(1)}°C)... <br>Sistem sedang menstabilkan data pembacaan sensor suhu.`;
    return;
  }
  if (currentStep === 2) {
    adviceBox.innerHTML = `⏳ <strong>[Langkah 2]</strong> Mengukur SpO₂ (${currentData.spo2}%) & Heart Rate (${currentData.hr} bpm)... <br>Pastikan jari menempel dengan pas dan tidak bergeser pada sensor oksimeter.`;
    return;
  }
  if (currentStep === 3) {
    adviceBox.innerHTML = `🩺 <strong>[Langkah 3]</strong> Pengecekan Tensi Meter Sedang Berjalan... <br>Manset lengan sedang melakukan pemompaan udara. Harap tenang dan tidak berbicara selama proses.`;
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

// CONTROL ALUR WORKFLOW MANAGEMENT
function updateWorkflowUI() {
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

function resetWorkflow() {
    currentStep = 0;
    updateWorkflowUI();
    client.publish(topicControl, "STOP");
    document.getElementById("medical-advice").innerHTML = 'Sistem direset. Silakan klik <strong>"MULAI PERIKSA LENGKAP"</strong> untuk memulai alur kembali.';
}

// AUTO RESPONSIVE LAYOUT TRIGGER
function resizeCharts() {
  ["chartTemp", "chartSpo2", "chartHR", "chartTensi", "gauge1", "gauge2", "gauge3", "gauge4"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { Plotly.Plots.resize(el); }
  });
}

window.addEventListener("load", () => {
  muatNamaPasienLama();
  tampilkanTabelRiwayat(); // Memuat tabel log saat web dibuka
  resizeCharts();
});
window.addEventListener("resize", resizeCharts);
setTimeout(resizeCharts, 600);
