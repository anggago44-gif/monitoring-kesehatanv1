const client=
mqtt.connect(
"wss://broker.hivemq.com:8884/mqtt"
);

let x=0;


// pasien

let pasien=
JSON.parse(
localStorage.getItem(
"pasien"
)
);

let standby=
document.getElementById(
"standbyBox"
);

let dashboard=
document.getElementById(
"dashboardContent"
);


if(pasien){

standby.style.display=
"none";

dashboard.style.display=
"block";

}else{

standby.style.display=
"block";

dashboard.style.display=
"none";

}



// chart

Plotly.newPlot(
"chartTemp",
[{x:[],y:[],line:{color:"cyan"}}],
{
paper_bgcolor:"black",
plot_bgcolor:"black",
font:{color:"white"},
title:"Suhu"
}
);


Plotly.newPlot(
"chartSpo2",
[{x:[],y:[],line:{color:"lime"}}],
{
paper_bgcolor:"black",
plot_bgcolor:"black",
font:{color:"white"},
title:"SpO₂"
}
);


Plotly.newPlot(
"chartHR",
[{x:[],y:[],line:{color:"red"}}],
{
paper_bgcolor:"black",
plot_bgcolor:"black",
font:{color:"white"},
title:"Heart Rate"
}
);


// ecg

let ecgData=[];

for(let i=0;i<50;i++){

ecgData.push(0);

}

Plotly.newPlot(
"ecg",

[{
y:ecgData,

line:{
color:"lime"
}

}],

{
paper_bgcolor:"black",
plot_bgcolor:"black",
font:{color:"white"},
title:"ECG"
}
);


// gauge

function drawGauge(
id,
value,
color,
max,
unit
){

Plotly.newPlot(

id,

[{

type:"indicator",

mode:"gauge+number",

value:value,

number:{
suffix:
" "+unit
},

gauge:{
axis:{
range:[0,max]
},

bar:{
color:color
}

}

}]

);

}



// mqtt

client.on(
"connect",

()=>{

client.subscribe(
"sensorReadings"
);

}
);



client.on(
"message",

(topic,msg)=>{

let data=
JSON.parse(
msg.toString()
);

let suhu=
Number(
data.temperature||0
);

let spo2=
Number(
data.spo2||0
);

let hr=
Number(
data.heartRate||0
);


temp.innerHTML=
suhu.toFixed(1)+"°C";

spo2.innerHTML=
spo2+"%";

hr.innerHTML=
hr+" bpm";


Plotly.extendTraces(
"chartTemp",
{x:[[x]],y:[[suhu]]},
[0]
);

Plotly.extendTraces(
"chartSpo2",
{x:[[x]],y:[[spo2]]},
[0]
);

Plotly.extendTraces(
"chartHR",
{x:[[x]],y:[[hr]]},
[0]
);


drawGauge(
"gauge1",
suhu,
"cyan",
50,
"°C"
);

drawGauge(
"gauge2",
spo2,
"lime",
100,
"%"
);

drawGauge(
"gauge3",
hr,
"red",
150,
"bpm"
);


ecgData.shift();

ecgData.push(
Math.sin(x/2)+
Math.random()*0.3
);

Plotly.update(
"ecg",
{
y:[ecgData]
}
);


x++;

});
