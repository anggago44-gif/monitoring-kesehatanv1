// ================= MQTT CONFIGURATION =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
let x = 0;

// Topik MQTT
const topicReadings = "sensorReadings";
const topicControl = "sensorControl"; // Topik untuk mengirim instruksi START/STOP ke ESP32

// ================= PLOTLY LAYOUT BASE =================
const darkLayout = {
  paper_bgcolor: "black",
  plot_bgcolor: "black",
  font: { color: "white" },
  margin: { l: 40, r: 20, t: 40, b: 30 }
};

// ================= INITIALIZE CHARTS =================
Plotly.newPlot("chartTemp", [{ x: [], y: [], mode: "lines", line: { color: "cyan", width: 3 } }], { ...darkLayout, title: "Tren Suhu (°C)" });
Plotly.newPlot("chartSpo2", [{ x: [], y: [], mode: "lines", line: { color: "lime", width: 3 } }], { ...darkLayout, title: "Tren SpO₂ (%)" });
Plotly.newPlot("chartHR", [{ x: [], y: [], mode: "lines", line: { color: "red", width: 3 } }], { ...darkLayout, title: "Tren Heart Rate (BPM)" });

// Grafik Tekanan Live Manset Tensi
Plotly.newPlot("chartTensi", [{ x: [], y: [], mode: "lines", line: { color: "orange", width: 3 } }], { ...darkLayout, title: "Grafik Tekanan Manset Real-time (mmHg)" });

// ================= INITIALIZE ECG MONITOR =================
let ecgData = [];
for (let i = 0; i < 50; i++) {
  ecgData.push(0);
}

Plotly.newPlot("ecg", [{ y: ecgData, mode: "lines", line: { color: "lime", width: 2 } }], {
  ...darkLayout,
  title: "ECG Monitor (Simulasi)",
  xaxis: { visible: false },
  yaxis: { showgrid: false }
});

// ================= GAUGE GENERATOR FUNCTION =================
function drawGauge(id, value, color, max, unit) {
  Plotly.newPlot(id, [{
    type: "indicator",
    mode: "gauge+number",
    value: value,
    number: { suffix: " " + unit, font: { size: 26 } },
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
    height: 220,
    margin: { t: 30, b: 10, l: 15, r: 15 }
  });
}

// ================= MQTT CLIENT HANDLERS =================
client.on("connect", () => {
  console.log("MQTT CONNECTED ✅");
  
  // Men-subscribe data sensor dari ESP32
  client.subscribe(topicReadings, (err) => {
    if (err) { console.log("SUBSCRIBE ERROR ❌"); } 
    else { console.log("SUBSCRIBE SUCCESS KATEGORI SENSOR CORNER 🚀"); }
  });
});

// Fungsi mengirim perintah kontrol ke ESP32 dari tombol Web
function sendControl(command) {
  client.publish(topicControl, command);
  console.log("MENGIRIM PERINTAH:", command);
}

// ================= INCOMING MQTT DATA PROCESSING =================
client.on("message", (topic, msg) => {
  if (topic !== topicReadings) return;

  try {
    let data = JSON.parse(msg.toString());
    console.log("DATA MASUK:", data);

    // Parsing data sensor (Jika key tidak ditemukan, fallback ke angka 0)
    let suhu = Number(data.temperature || 0);
    let spo2 = Number(data.spo2 || 0);
    let hr = Number(data.heartRate || 0);
    
    // Key Baru untuk Tensi Darah
    let mmHgLive = Number(data.mmHgLive || 0); 
    let systolic = Number(data.systolic || 0);  
    let diastolic = Number(data.diastolic || 0); 

    // 1. UPDATE VALUE TEXT KE LAYOUT HTML CARD
    document.getElementById("temp").innerHTML = suhu.toFixed(1) + "°C";
    document.getElementById("spo2").innerHTML = spo2 + "%";
    document.getElementById("hr").innerHTML = hr + " bpm";
    document.getElementById("bp").innerHTML = systolic + "/" + diastolic + " mmHg";

    // 2. EXTEND DATA BARU KE GRAFIK LINE PLOTLY
    Plotly.extendTraces("chartTemp", { x: [[x]], y: [[suhu]] }, [0]);
    Plotly.extendTraces("chartSpo2", { x: [[x]], y: [[spo2]] }, [0]);
    Plotly.extendTraces("chartHR", { x: [[x]], y: [[hr]] }, [0]);
    Plotly.extendTraces("chartTensi", { x: [[x]], y: [[mmHgLive]] }, [0]); // Grafik Tensi Baru

    // Geser X-Axis Grafik otomatis agar berjalan dinamis (Menampilkan 20 data terakhir)
    ["chartTemp", "chartSpo2", "chartHR", "chartTensi"].forEach(id => {
      Plotly.relayout(id, {
        "xaxis.range": [Math.max(0, x - 20), x]
      });
    });

    // 3. AMBANG BATAS WARNA DINAMIS GAUGE HEART RATE
    let hrColor = "lime";
    if (hr > 100 || hr < 60) { hrColor = "red"; }

    // RENDER ULANG SEMUA GAUGE (Termasuk Gauge Tensi Baru)
    drawGauge("gauge1", suhu, "cyan", 50, "°C");
    drawGauge("gauge2", spo2, "lime", 100, "%");
    drawGauge("gauge3", hr, hrColor, 150, "bpm");
    drawGauge("gauge4", mmHgLive, "orange", 200, "mmHg"); // Gauge Tensi Live

    // 4. ANIMASI JALAN GRAPH ECG (SIMULASI BERBASIS GELOMBANG SINUS)
    ecgData.shift();
    ecgData.push(Math.sin(x / 2) + Math.random() * 0.3);
    Plotly.update("ecg", { y: [ecgData] });

    // 5. EVALUASI STATUS KLINIS KONDISI PASIEN
    let status = "NORMAL";
    let color = "lime";

    // Kriteria diperketat dengan ambang batas Systolic abnormal (>135 atau <90 mmHg)
    if (hr > 100 || hr < 50 || spo2 < 94 || suhu > 37.5 || suhu < 35.0 || systolic > 135 || (systolic > 0 && systolic < 90)) {
      status = "WASPADA / ABNORMAL";
      color = "red";
    }

    document.getElementById("status").innerHTML = status;
    document.getElementById("status").style.color = color;

    x++;
  } 
  catch (e) {
    console.log("GAGAL MEMPROSES STRING JSON:", e);
  }
});

// ================= AUTO RESPONSIVE LAYOUT PLOTLY =================
function resizeCharts() {
  ["chartTemp", "chartSpo2", "chartHR", "chartTensi", "ecg"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { Plotly.Plots.resize(el); }
  });
}
window.addEventListener("load", resizeCharts);
window.addEventListener("resize", resizeCharts);
