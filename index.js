// ================= MQTT =================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

let x = 0;

// ================= CHART =================
Plotly.newPlot("chartTemp", [{x:[],y:[],line:{color:"cyan"}}], {paper_bgcolor:"black",plot_bgcolor:"black",font:{color:"white"},title:"Suhu"});
Plotly.newPlot("chartSpo2", [{x:[],y:[],line:{color:"lime"}}], {paper_bgcolor:"black",plot_bgcolor:"black",font:{color:"white"},title:"SpO₂"});
Plotly.newPlot("chartHR", [{x:[],y:[],line:{color:"red"}}], {paper_bgcolor:"black",plot_bgcolor:"black",font:{color:"white"},title:"Heart Rate"});

// ================= ECG =================
let ecgData = [];
for(let i=0;i<50;i++) ecgData.push(0);

Plotly.newPlot("ecg", [{
  y: ecgData,
  line:{color:"lime", width:2}
}], {
  paper_bgcolor:"black",
  plot_bgcolor:"black",
  font:{color:"white"},
  title:"ECG Monitor"
});

// ================= GAUGE + SATUAN =================
function drawGauge(id, value, color, max, unit){
  Plotly.newPlot(id, [{
    type:"indicator",
    mode:"gauge+number",
    value:value,

    number:{
      suffix: " " + unit,
      font:{ size:34 }
    },

    gauge:{
      axis:{ range:[0,max] },
      bar:{ color:color, thickness:0.35 },
      bgcolor:"black",
      borderwidth:2,
      bordercolor:"#333",
      steps:[
        { range:[0,max*0.5], color:"#002200" },
        { range:[max*0.5,max*0.8], color:"#333300" },
        { range:[max*0.8,max], color:"#330000" }
      ]
    }
  }],
  {
    paper_bgcolor:"black",
    font:{ color:"white" },
    height:260,
    margin:{t:20,b:20}
  });
}

// ================= CONNECT =================
client.on("connect", () => {
  console.log("MQTT CONNECTED ✅");

  client.subscribe("sensorReadings", (err)=>{
    if(err) console.log("SUBSCRIBE ERROR ❌", err);
    else console.log("SUBSCRIBE SUCCESS ✅");
  });
});

// ================= DATA =================
client.on("message", (topic, msg) => {

  console.log("DATA:", msg.toString());

  let data = JSON.parse(msg.toString());

  let suhu = Number(data.temperature || 0);
  let spo2 = Number(data.spo2 || 0);
  let hr = Number(data.heartRate || 0);

  // TEXT
  document.getElementById("temp").innerHTML = suhu.toFixed(2)+"°C";
  document.getElementById("spo2").innerHTML = spo2+"%";
  document.getElementById("hr").innerHTML = hr+" bpm";

  // CHART
  Plotly.extendTraces("chartTemp",{x:[[x]],y:[[suhu]]},[0]);
  Plotly.extendTraces("chartSpo2",{x:[[x]],y:[[spo2]]},[0]);
  Plotly.extendTraces("chartHR",{x:[[x]],y:[[hr]]},[0]);

  // WARNA HR
  let hrColor = "lime";
  if(hr > 100) hrColor = "red";

  // GAUGE (ADA SATUAN)
  drawGauge("gauge1", suhu, "cyan", 50, "°C");
  drawGauge("gauge2", spo2, "lime", 100, "%");
  drawGauge("gauge3", hr, hrColor, 150, "bpm");

  // ECG
  ecgData.shift();
  ecgData.push(Math.sin(x/2) + Math.random()*0.3);
  Plotly.update("ecg",{y:[ecgData]});

  // STATUS
  let status = "NORMAL";
  let color = "lime";

  if(hr>100 || spo2<95 || suhu>37.5){
    status="BAHAYA";
    color="red";
  }

  document.getElementById("status").innerHTML = status;
  document.getElementById("status").style.color = color;

  x++;
});