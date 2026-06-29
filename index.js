// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
let x = 0;

const topicReadings = "sensorReadings";
const topicControl = "sensorControl"; 

// Data Runtime Medis Terkini (Untuk Dasar Pengambilan Keputusan Cerdas)
let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };

// Variable Alur Terpandu (Workflow State): 0=Idle, 1=Suhu, 2=Oxy, 3=Tensi, 4=Selesai
let currentStep = 0; 

const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white" },
  margin: { l: 40, r: 20, t: 40, b: 30 }
};

// ================= INITIALIZE PLOTLY CHARTS =================
Plotly.newPlot("chartTemp", [{ x: [], y: [], mode: "lines", line: { color: "cyan", width: 3 } }], { ...darkLayout, title: "Tren Suhu (°C)" });
Plotly.newPlot("chartSpo2", [{ x: [], y: [], mode: "lines", line: { color: "lime", width: 3 } }], { ...darkLayout, title: "Tren SpO₂ (%)" });
Plotly.newPlot("chartHR", [{ x: [], y: [], mode: "lines", line: { color: "red", width: 3 } }], { ...darkLayout, title: "Tren Heart Rate (BPM)" });
Plotly.newPlot("chartTensi", [{ x: [], y: [], mode: "lines", line: { color: "orange", width: 3 } }], { ...darkLayout, title: "Grafik Tekanan Manset Real-time (mmHg)" });

function drawGauge(id, value, color, max, unit) {
  Plotly.newPlot(id, [{
    type: "indicator",
    mode: "gauge+number",
    value: value,
    number: { suffix: " " + unit, font: { size: 24 } },
    gauge: {
      axis: { range: [0, max] },
      bar: { color: color, thickness: .35 },
      bgcolor: "black",
      bordercolor: "#333",
      borderwidth: 2,
      steps: [
        { range: [0, max * .5], color: "#001a00" },
        { range: [max * .5, max * .8], color: "#222200" },
        { range: [max * .8, max], color: "#2b0000" }
      ]
    }
  }], {
    paper_bgcolor: "black",
    font: { color: "white" },
    height: 190,
    margin: { t: 30, b: 10, l: 15, r: 15 }
  });
}

// ================= CONNECT & SUBSCRIBE =================
client.on("connect", () => {
  console.log("MQTT CONNECTED ✅");
  client.subscribe(topicReadings);
});

// ================= DATA PROCESSING =================
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

    // Simpan ke memory runtime
    currentData.temp = suhu;
    currentData.spo2 = spo2;
    currentData.hr = hr;
    if(systolic > 0) { 
      currentData.sys = systolic; 
      currentData.dia = diastolic; 
      if (currentStep === 3) { currentStep = 4; updateWorkflowUI(); } // Tensi selesai, alur finish
    }

    // Render Nilai ke Layout Card Atas
    document.getElementById("temp").innerHTML = suhu.toFixed(1) + "°C";
    document.getElementById("spo2").innerHTML = spo2 + "%";
    document.getElementById("hr").innerHTML = hr + " bpm";
    document.getElementById("bp").innerHTML = currentData.sys + "/" + currentData.dia + " mmHg";

    // Update Jalur Data Grafik Real-time
    Plotly.extendTraces("chartTemp", { x: [[x]], y: [[suhu]] }, [0]);
    Plotly.extendTraces("chartSpo2", { x: [[x]], y: [[spo2]] }, [0]);
    Plotly.extendTraces("chartHR", { x: [[x]], y: [[hr]] }, [0]);
    Plotly.extendTraces("chartTensi", { x: [[x]], y: [[mmHgLive]] }, [0]); 

    ["chartTemp", "chartSpo2", "chartHR", "chartTensi"].forEach(id => {
      Plotly.relayout(id, { "xaxis.range": [Math.max(0, x - 20), x] });
    });

    // Render Gauges
    let hrColor = (hr > 100 || hr < 60) ? "red" : "lime";
    drawGauge("gauge1", suhu, "cyan", 50, "°C");
    drawGauge("gauge2", spo2, "lime", 100, "%");
    drawGauge("gauge3", hr, hrColor, 150, "bpm");
    drawGauge("gauge4", mmHgLive, "orange", 200, "mmHg"); 

    // 1. Evaluasi Status Klinis Utama (Footer Status)
    let status = "NORMAL";
    let color = "lime";
    if (hr > 100 || hr < 50 || spo2 < 94 || suhu > 37.5 || currentData.sys > 135) {
      status = "WASPADA / ABNORMAL";
      color = "red";
    }
    document.getElementById("status").innerHTML = status;
    document.getElementById("status").style.color = color;

    // 2. Evaluasi Rekomendasi Cerdas Kontekstual Berdasarkan Langkah Alur Aktif
    generateMedicalAdvice();

    x++;
  } 
  catch (e) { console.log("JSON ERROR:", e); }
});

// ================= LOGIKA SISTEM REKOMENDASI MEDIS OTOMATIS =================
function generateMedicalAdvice() {
  let adviceBox = document.getElementById("medical-advice");
  
  if (currentStep === 1) {
    adviceBox.innerHTML = `⏳ <strong>[Langkah 1]</strong> Mengukur Suhu Tubuh aktif (${currentData.temp.toFixed(1)}°C)... <br>Sistem sedang mengumpulkan kestabilan data suhu pasien.`;
    return;
  }
  if (currentStep === 2) {
    adviceBox.innerHTML = `⏳ <strong>[Langkah 2]</strong> Mengukur SpO₂ (${currentData.spo2}%) & Detak Jantung (${currentData.hr} bpm)... <br>Pastikan jari terpasang dengan pas di sensor Oksimeter.`;
    return;
  }
  if (currentStep === 3) {
    adviceBox.innerHTML = `🩺 <strong>[Langkah 3]</strong> Proses Tensi Meter Sedang Berjalan... <br>Manset sedang melakukan kompresi udara/inflasi. Mohon pasien tidak berbicara.`;
    return;
  }

  // Jika alur selesai atau dalam mode bebas, jalankan logika komprehensif (Opsi B)
  if (currentData.temp === 0 && currentData.spo2 === 0) return;

  let adviceText = "✅ <strong>Pemeriksaan Selesai.</strong> ";
  let issues = [];

  if (currentData.temp > 37.5) issues.push("Suhu tubuh tinggi (Demam/Infeksi)");
  if (currentData.temp < 35.0) issues.push("Suhu tubuh terlalu rendah (Hipotermia)");
  if (currentData.spo2 < 95) issues.push("Saturasi Oksigen Rendah (Hipoksia Ringan)");
  if (currentData.hr > 100) issues.push("Detak jantung cepat (Takikardia)");
  if (currentData.sys > 135) issues.push("Tekanan darah tinggi (Hipertensi)");

  if (issues.length === 0) {
    adviceText += "Seluruh parameter vital sign pasien dalam kondisi <strong>NORMAL</strong>. Kondisi fisik pasien terpantau stabil.";
  } else {
    adviceText += `⚠️ <strong>Temuan Klinis:</strong> ${issues.join(", ")}. <br><em>Saran:</em> Pasien disarankan beristirahat, diposisikan berbaring rileks, dan hubungi dokter untuk penanganan medis lebih lanjut.`;
  }
  
  adviceBox.innerHTML = adviceText;
}

// ================= LOGIKA WORKFLOW INTERFACE UPDATER =================
function updateWorkflowUI() {
    for(let i=1; i<=3; i++) {
        let el = document.getElementById("step" + i);
        el.className = "step";
        if(i < currentStep || currentStep === 4) el.classList.add("done");
        if(i === currentStep) el.classList.add("active");
    }
    // Kelola aktivasi tombol
    document.getElementById("btn-next-alur").disabled = (currentStep === 0 || currentStep >= 3);
}

function startWorkflow() {
    currentStep = 1;
    updateWorkflowUI();
    client.publish(topicControl, "ALUR_SUHU");
    console.log("Mengirim instruksi: ALUR_SUHU");
}

function nextStep() {
    if(currentStep === 1) {
        currentStep = 2;
        client.publish(topicControl, "ALUR_OXY");
        console.log("Mengirim instruksi: ALUR_OXY");
    } else if(currentStep === 2) {
        currentStep = 3;
        client.publish(topicControl, "ALUR_TENSI");
        console.log("Mengirim instruksi: ALUR_TENSI");
    }
    updateWorkflowUI();
}

function resetWorkflow() {
    currentStep = 0;
    updateWorkflowUI();
    client.publish(topicControl, "STOP");
    document.getElementById("medical-advice").innerHTML = 'Sistem direset. Silakan klik <strong>"MULAI PERIKSA LENGKAP"</strong> untuk mengulang alur terpandu.';
    console.log("Alur pemeriksaan dihentikan manual.");
}

// ================= AUTO RESPONSIVE LAYOUT PLOTLY =================
function resizeCharts() {
  ["chartTemp", "chartSpo2", "chartHR", "chartTensi"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { Plotly.Plots.resize(el); }
  });
}
window.load = resizeCharts;
window.addEventListener("resize", resizeCharts);
