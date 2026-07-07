// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
let x = 0;

const topicReadings = "sensorReadings";
const topicControl = "sensorControl"; 

let currentData = { temp: 0, spo2: 0, hr: 0, sys: 0, dia: 0 };
let currentStep = 0; 

// ================= LAYOUT GLOBAL PLOTLY (TEKS SUMBU DI-BESARKAN) =================
const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  
  // Mengatur ukuran font global untuk text angka sumbu X dan Y
  font: {
    color: "white",
    size: 15  // Nilai koordinat sumbu X & Y melompat jadi besar dan jelas
  },
  
  // Mengatur format Judul Grafik Atas agar menonjol
  title: {
    font: {
      size: 18, 
      weight: "bold"
    }
  },
  
  margin: { l: 55, r: 25, t: 50, b: 40 }
};

// ================= INITIALIZE PLOTLY REALTIME CHARTS =================
Plotly.newPlot("chartTemp", [{ x: [], y: [], mode: "lines", line: { color: "cyan", width: 3.5 } }], { ...darkLayout, title: "Tren Suhu Tubuh (°C)" });
Plotly.newPlot("chartSpo2", [{ x: [], y: [], mode: "lines", line: { color: "lime", width: 3.5 } }], { ...darkLayout, title: "Tren SpO₂ (%)" });
Plotly.newPlot("chartHR", [{ x: [], y: [], mode: "lines", line: { color: "red", width: 3.5 } }], { ...darkLayout, title: "Tren Heart Rate (BPM)" });
Plotly.newPlot("chartTensi", [{ x: [], y: [], mode: "lines", line: { color: "orange", width: 3.5 } }], { ...darkLayout, title: "Grafik Tekanan Manset Real-time (mmHg)" });

// ================= DYNAMIC GAUGE GENERATOR (TEKS ANGKA DI-BESARKAN) =================
function drawGauge(id, value, color, max, unit) {
  Plotly.newPlot(id, [{
    type: "indicator",
    mode: "gauge+number",
    value: value,
    number: { 
      suffix: " " + unit, 
      font: { 
        size: 34, // Teks angka utama sensor di tengah gauge menjadi 34px (Sangat Besar)
        weight: "bold" 
      } 
    },
    gauge: {
      axis: { 
        range: [0, max],
        tickfont: { size: 13, color: "white" } // Angka penanda skala busur luar
      },
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
      if (currentStep === 3) { currentStep = 4; updateWorkflowUI(); }
    }

    // Refresh Text Top Row Cards
    document.getElementById("temp").innerHTML = suhu.toFixed(1) + "°C";
    document.getElementById("spo2").innerHTML = spo2 + "%";
    document.getElementById("hr").innerHTML = hr + " bpm";
    document.getElementById("bp").innerHTML = currentData.sys + "/" + currentData.dia + " mmHg";

    // Extend Line Charts Realtime Data Stream
    Plotly.extendTraces("chartTemp", { x: [[x]], y: [[suhu]] }, [0]);
    Plotly.extendTraces("chartSpo2", { x: [[x]], y: [[spo2]] }, [0]);
    Plotly.extendTraces("chartHR", { x: [[x]], y: [[hr]] }, [0]);
    Plotly.extendTraces("chartTensi", { x: [[x]], y: [[mmHgLive]] }, [0]); 

    // Axis limit scroll shifting
    ["chartTemp", "chartSpo2", "chartHR", "chartTensi"].forEach(id => {
      Plotly.relayout(id, { "xaxis.range": [Math.max(0, x - 20), x] });
    });

    // Render 4 Gauges Kanan Vertikal
    let hrColor = (hr > 100 || hr < 60) ? "red" : "lime";
    drawGauge("gauge1", suhu, "cyan", 50, "°C");
    drawGauge("gauge2", spo2, "lime", 100, "%");
    drawGauge("gauge3", hr, hrColor, 150, "bpm");
    drawGauge("gauge4", mmHgLive, "orange", 200, "mmHg"); 

    // Global Indicator Kesimpulan Footer
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

// ================= LOGIKA SISTEM REKOMENDASI MEDIS OTOMATIS =================
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

// ================= CONTROL ALUR WORKFLOW MANAGEMENT =================
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

// ================= AUTO RESPONSIVE LAYOUT TRIGGER =================
function resizeCharts() {
  ["chartTemp", "chartSpo2", "chartHR", "chartTensi", "gauge1", "gauge2", "gauge3", "gauge4"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { Plotly.Plots.resize(el); }
  });
}
window.addEventListener("load", resizeCharts);
window.addEventListener("resize", resizeCharts);
setTimeout(resizeCharts, 600);
