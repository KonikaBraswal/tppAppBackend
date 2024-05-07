const express = require('express');
const router =express.Router();
const axios = require('axios');

let variables = {};

async function retrieveAccessToken(){ 
    console.log('Hello world');
    console.log(variables.clientId);
    try {
        const body = {
          grant_type: 'client_credentials',
          client_id: variables.clientId,
          client_secret: variables.clientSecret,
          scope: variables.scope,
        };

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        const options ={
            method: 'POST',
            url: `${variables.tokenDomain}/token`,
            headers: headers,
            data: body
        }

        const response = await axios(options);
        // variables.access_token_1 = "";
        variables.access_token_1 = response.data.access_token;
        console.log("first Response", response.data);
        return response;
    }catch(error){
        console.error('Error in retrieveAccessToken function' + error);
    }
}

async function accountRequest(permissions){     
    try {
        const body = {
            "Data": {
              "Permissions": permissions,
            },
            "Risk": {},
        };

        const headers = {
            Authorization: `Bearer ${variables.access_token_1}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/account-access-consents`;
        console.log("Request URL:", apiUrl);

        const options ={
            method: 'POST',
            url: apiUrl,
            headers: headers,
            data: body
        }

        const response = await axios(options);
        console.log("second Response", response.data);
        variables.consentId = response.data.Data.ConsentId;

        let consentUrlWithVariables = `${variables.consentUrl}?client_id=${variables.clientId}&response_type=code id_token&scope=openid accounts&redirect_uri=${variables.redirectUrl}&request=${variables.consentId}`;

        console.log(consentUrlWithVariables);

        return {response: response, url: consentUrlWithVariables};
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function exchangeAuthCode(authCode){ 
    console.log(authCode);
    try {
        const body = {
          grant_type: 'authorization_code',
          client_id: variables.clientId,
          redirect_uri: variables.redirectUrl,
          client_secret: variables.clientSecret,
          code: authCode
        };

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        const options ={
            method: 'POST',
            url: `${variables.tokenDomain}/token`,
            headers: headers,
            data: body
        }

        const response = await axios(options);
        // variables.access_token_1 = "";
        variables.access_token_2 = response.data.access_token;
        variables.refresh_token = response.data.refresh_token;
        // console.log("variable access token 1: \n", variables.access_token_2);
        // console.log("response access token 1: \n", variables.access_token_2);
        // console.log("variable refresh token 1: \n", variables.refresh_token);
        // console.log("response refresh token 1: \n", variables.refresh_token);
        console.log("first Response", response.data);
        return response;
    }catch(error){
        console.error('Error in retrieveAccessToken function' + error);
    }
}

async function refreshToken(){ 
    
    try {
        const body = {
          grant_type: 'refresh_token',
          client_id: variables.clientId,
        //   redirect_uri: variables.redirectUri,
          client_secret: variables.clientSecret,
          refresh_token: variables.refresh_token
        };

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        const options ={
            method: 'POST',
            url: `${variables.tokenDomain}/token`,
            headers: headers,
            data: body
        }

        const response = await axios(options);
        // variables.access_token_1 = "";
        variables.access_token_2 = response.data.access_token;
        variables.refresh_token = response.data.refresh_token;
        console.log("first Response", response.data);
        // console.log("variable access token 2: \n", variables.access_token_2);
        // console.log("response access token 2: \n", variables.access_token_2);
        // console.log("variable refresh token 2: \n", variables.refresh_token);
        // console.log("response refresh token 2: \n", variables.refresh_token);
        return response;
    }catch(error){
        console.error('Error in retrieveAccessToken function' + error);
    }
}

async function fetchAge(){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/zerocode/bankofapis.com/customer-age/v3/attributes/age`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("second Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function fetchAccounts(){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("second Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function fetchAccountDetails(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("Particular Account Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function fetchTransactions(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/transactions`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("Transactions Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function fetchBalances(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/balances`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("Balances Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function fetchBeneficiaries(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/beneficiaries`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("Benefeciaries Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function fetchStatements(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/statements`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("statements Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function directDebits(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/direct-debits`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("direct-debits Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function fetchProducts(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/product`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("products Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function standingOrders(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/standing-orders`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("standing-orders Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}

async function scheduledPayments(accountId){     
    try {

        const headers = {
            Authorization: `Bearer ${variables.access_token_2}`,
            'Content-Type': 'application/json'
        }

        const apiUrl = `${variables.apiUrlPrefix}/open-banking/v3.1/aisp/accounts/${accountId}/scheduled-payments`;

        const options ={
            method: 'GET',
            url: apiUrl,
            headers: headers,
        }

        const response = await axios(options);
        console.log("scheduled-payments Response", response.data);

        return response;
    }catch(error){
        console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
    }
}



router.post(`/retrieveAccessToken`, async (req, res) => {
    try{
        const environment = req.environment;
        variables = environment.values.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {});
        const response = await retrieveAccessToken();
        res.send(response.data);

    }catch(error){
        console.error('Error occurred at retrieve Access Token endpoint');
    }
});

router.post(`/accountRequest`, async (req, res) => {
    try{
        
        const permissions = req.body.Permissions;
        console.log(permissions);
        const {response, url} = await accountRequest(permissions);
        const responseData = response.data;
        res.send({responseData, url});

    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.post(`/exchangeAuthCode`, async (req, res) => {
    try{
        const exchangeCode = req.headers['code'];
        console.log(exchangeCode);
        const  response = await exchangeAuthCode(exchangeCode);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.post(`/refreshAccessToken`, async (req, res) => {
    try{
        const  response = await refreshToken();
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAge`, async (req, res) => {
    try{
        const  response = await fetchAge();
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts`, async (req, res) => {
    try{
        const  response = await fetchAccounts();
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccountDetails/:accountId`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await fetchAccountDetails(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/transactions`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await fetchTransactions(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/balances`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await fetchBalances(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/beneficiaries`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await fetchBeneficiaries(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/statements`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await fetchStatements(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/direct-debits`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await directDebits(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/standing-orders`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await standingOrders(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/products`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await fetchProducts(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

router.get(`/fetchAccounts/:accountId/scheduled-payments`, async (req, res) => {
    try{
        const accountId = req.params.accountId;
        const  response = await scheduledPayments(accountId);
        res.send(response.data);
    }catch(error){
        console.error('Error occurred at accountRequest endpoint');
    }
});

module.exports = router;
