// ================= MQTT =================

const client = mqtt.connect(
"wss://broker.hivemq.com:8884/mqtt"
);

let x = 0;


// ================= LAYOUT =================

const darkLayout = {

paper_bgcolor:"black",

plot_bgcolor:"black",

font:{
color:"white"
},

margin:{
l:30,
r:20,
t:40,
b:30
}

};


// ================= CHART =================

Plotly.newPlot(
"chartTemp",

[{
x:[],
y:[],
mode:"lines",

line:{
color:"cyan",
width:3
}

}],

{
...darkLayout,
title:"Suhu"
}
);



Plotly.newPlot(
"chartSpo2",

[{
x:[],
y:[],
mode:"lines",

line:{
color:"lime",
width:3
}

}],

{
...darkLayout,
title:"SpO₂"
}
);



Plotly.newPlot(
"chartHR",

[{
x:[],
y:[],
mode:"lines",

line:{
color:"red",
width:3
}

}],

{
...darkLayout,
title:"Heart Rate"
}
);


// ================= ECG =================

let ecgData=[];

for(let i=0;i<50;i++){
ecgData.push(0);
}


Plotly.newPlot(

"ecg",

[{

y:ecgData,

mode:"lines",

line:{

color:"lime",

width:2

}

}],

{

...darkLayout,

title:"ECG Monitor",

xaxis:{

visible:false

},

yaxis:{

showgrid:false

}

}

);


// ================= GAUGE =================

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

suffix:" "+unit,

font:{
size:28
}

},

gauge:{

axis:{
range:[0,max]
},

bar:{
color:color,
thickness:.35
},

bgcolor:"black",

bordercolor:"#333",

borderwidth:2,

steps:[

{
range:[0,max*.5],
color:"#002200"
},

{
range:[max*.5,max*.8],
color:"#333300"
},

{
range:[max*.8,max],
color:"#330000"
}

]

}

}],

{

paper_bgcolor:"black",

font:{
color:"white"
},

height:220,

margin:{
t:20,
b:20,
l:10,
r:10
}

}

);

}



// ================= MQTT CONNECT =================

client.on(

"connect",

()=>{

console.log(
"MQTT CONNECTED ✅"
);

client.subscribe(

"sensorReadings",

(err)=>{

if(err){

console.log(
"SUBSCRIBE ERROR"
);

}else{

console.log(
"SUBSCRIBE SUCCESS"
);

}

});

}

);


// ================= DATA =================

client.on(

"message",

(topic,msg)=>{

try{


let data=

JSON.parse(
msg.toString()
);


console.log(
"DATA:",
data
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


// TEXT

document.getElementById(
"temp"
).innerHTML=
suhu.toFixed(1)
+"°C";


document.getElementById(
"spo2"
).innerHTML=
spo2
+"%";


document.getElementById(
"hr"
).innerHTML=
hr
+" bpm";



// GRAFIK

Plotly.extendTraces(

"chartTemp",

{
x:[[x]],
y:[[suhu]]
},

[0]

);


Plotly.extendTraces(

"chartSpo2",

{
x:[[x]],
y:[[spo2]]
},

[0]

);


Plotly.extendTraces(

"chartHR",

{
x:[[x]],
y:[[hr]]
},

[0]

);



// batasi data

[
"chartTemp",
"chartSpo2",
"chartHR"

].forEach(id=>{

Plotly.relayout(

id,

{

"xaxis.range":[
Math.max(0,x-20),
x
]

}

);

});




// WARNA HR

let hrColor="lime";

if(hr>100){

hrColor="red";

}


// ================= GAUGE

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
hrColor,
150,
"bpm"
);




// ECG

ecgData.shift();

ecgData.push(

Math.sin(
x/2
)

+

Math.random()*0.3

);


Plotly.update(

"ecg",

{
y:[ecgData]
}

);




// STATUS

let status=
"NORMAL";

let color=
"lime";


if(
hr>100||
spo2<95||
suhu>37.5
){

status=
"WASPADA";

color=
"red";

}


document.getElementById(
"status"
).innerHTML=
status;


document.getElementById(
"status"
).style.color=
color;


x++;

}

catch(e){

console.log(
"JSON ERROR",
e
);

}

});



// ================= RESPONSIVE =================

function resizeCharts(){

[
"chartTemp",
"chartSpo2",
"chartHR",
"ecg"

].forEach(id=>{

const el=
document.getElementById(id);

if(el){

Plotly.Plots.resize(el);

}

});

}

window.addEventListener(
"load",
resizeCharts
);

window.addEventListener(
"resize",
resizeCharts
);
