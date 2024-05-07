const express = require('express');
const sandboxEndpoints = require('./sandboxEndpoints')
const router = express.Router();

const fs = require('fs');


let variables = {}; 

const nwbFilepath = '.\\nwb_sandbox_environment.json';
const rbsFilepath = '.\\rbs sandbox environment.json';
const ubnFilepath = '.\\ubn sandbox environment.json';

function loadVariables(bank) {
    let filepath;
    if (bank === 'nwb') {
        filepath = nwbFilepath;
    } else if (bank === 'rbs') {
        filepath = rbsFilepath;
    } else {
        filepath = ubnFilepath;
    }
    const data = fs.readFileSync(filepath);
    variables[bank] = JSON.parse(data); // Set the environment variables globally
}

var environment = '';
 router.use('/:bankName', (req, res, next) => {
    const bankName = req.params.bankName;
    loadVariables(bankName);
    req.bankName = bankName;
    req.environment = variables[bankName];
    next();
 }, sandboxEndpoints);




module.exports = router;