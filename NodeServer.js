const https = require('https');
const http = require('http');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const bodyParser = require('body-parser');

const tunnel = require('tunnel');
const request = require('request');
const KJUR = require('jsrsasign');
const express = require('express');
const cors = require('cors');

const app1 = express();
const PORT1 = 4000;

const app2 = express();
const PORT2 = 4001;

const app3 = express();
const PORT3 = 4002;

app1.use(bodyParser.json());
app1.use(cors());

app2.use(bodyParser.json());
app2.use(cors());

app3.use(bodyParser.json());
app3.use(cors());

const endpoints1 = require('./sandboxBankSelection');
const endpoints2 = require('./sitEndpoint');
const endpoints3 = require('./prodEndpoint');

// Set up endpoints for each client
app1.use('/sandbox', endpoints1);
app2.use('/sit', endpoints2);
app3.use('/prod', endpoints3);

const server1 = http.createServer(app1);
server1.listen(PORT1, () => {
    console.log(`Server1 is running on PORT ${PORT1}`);
});

const server2 = http.createServer(app2);
server2.listen(PORT2, () => {
    console.log(`Server2 is running on PORT ${PORT2}`);
});

const server3 = http.createServer(app3);
server3.listen(PORT3, () => {
    console.log(`Server3 is running on PORT ${PORT3}`);
});
