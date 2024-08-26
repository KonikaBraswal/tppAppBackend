const express = require('express');
const router =express.Router();
const axios = require('axios');
const https = require('https');
const CryptoJS = require('crypto-js');
const tunnel = require('tunnel');
const fs = require('fs');

// const cert = fs.readFileSync('.\\cert.pem');
// const key = fs.readFileSync('.\\key.key');

const { v4: uuidv4} = require('uuid');

const generateGuid = () => {
    return uuidv4();
};

var uuid =require('uuid');
const jwtFile = fs.readFileSync('jwt.js');
var nonce = uuid.v4();
const KJUR = require('jsrsasign');

let variables = {};

async function retrieveAccessToken(){ 
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;

    const body = {
        grant_type: 'client_credentials',
        client_id: variables.client_id,
        client_assertion: variables.jwt_token,
        scope: variables.scope,
        client_assertion_type: variables.client_assertion_type,
    };

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const options ={
        method: 'POST',
        url: `${variables.prerequest_url}`,
        headers: headers,
        data: body,
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
            cert: cert,
            key: key,
            passphrase: "password1",
            hostname: variables.https_host_name
         })
    }

    const response = await axios(options);
    variables.access_token_1 = response.data.access_token;
    console.log("first Response", response.data);
    return response;
}

async function accountRequest(permissions){     
    const alg = variables.alg;
    var header = {
        "http://openbanking.org.uk/iat": Math.round(Date.now() / 1000),
        "http://openbanking.org.uk/tan": "openbanking.org.uk",
        "http://openbanking.org.uk/iss": variables.tpp_id + "/" + variables.client_id,
        "kid": variables.signing_key_id,
        "alg": alg,
        "crit": [
            "http://openbanking.org.uk/iat",
            "http://openbanking.org.uk/iss",
            "http://openbanking.org.uk/tan"
        ]
    }

    var validFrom = new Date();
    var validTo = new Date();
    validTo.setDate(validFrom.getDate() + 1);

    const payload = {
        "Data": {
            "Permissions": permissions,
        },
        "Risk": {},
    };

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(payload);

    variables.consent_payload = sPayload;

    try{
        var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
        var spliJWT = sJWT.split(".");
        var dcJWT = spliJWT[0] + ".." + spliJWT[2];
        variables.x_jws_signature = dcJWT;
        const body = payload;
        const idempotency = generateGuid();

        const headers = {
            Host: variables.hader_host,
            port: '443',
            hostname: variables.header_host_name,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'x-jws-signature':variables.x_jws_signature,
            'x_idempotency-key': idempotency,
            Authorization: `Bearer ${variables.access_token_1}`,
            'Connection': 'keep-alive'
        }

        const httpsAgent = new https.Agent({
            cert: cert,
            key: key,
            passphrase: "password1",
            keepAlive: true
         })

         const tunnelingAgent = tunnel.httpsOverHttp({
            cert: cert,
            key: key,
            passphrase: "password1",
            proxy:{
                host: variables.proxy_host,
                port: "8080",
                proxyAuth: `${variables.user_name}:${variables.password}`,
                headers: {
                    'User-Agent': 'Node'
                }
            }
         });

        const apiUrl = `${variables.base_url}/open-banking/v3.1/aisp/account-access-consents`;
        console.log("Request URL:", apiUrl);

        const options ={
            method: 'POST',
            passphrase: "password1",
            url: apiUrl,
            headers: headers,
            data: body,
            httpsAgent: tunnelingAgent
        }

        require('axios-debug-log/enable');
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

        const response = await axios(options);
        
        var jsonData = response.data;
        var sConsentResponse = JSON.stringify(jsonData);
        var consentSelfLink = jsonData.Links.Self;

        variables.consent_id = jsonData.Data.ConsentId;
        variables.consent_self_link = consentSelfLink;
        variables.consent_response = sConsentResponse;

        var header1 = {
            "kid": variables.signing_key_id,
            "typ": "JWS",
            "alg": alg
        }   
        
        var data = {
            "iss": variables.client_id,
            "response_type": "code id_token",
            "client_id": variables.client_id,
            "redirect_uri": variables.redirect_uri,
            "scope": variables.scope,
            "consentRefId":jsonData.Data.ConsentId,
            "exp": Math.round(600 + Date.now() / 1000),
            "nonce": nonce,
            "claims": {
                "userinfo": {
                    "openbanking_intent_id": {
                        "value": jsonData.Data.ConsentId,
                        "essential": true
                    },
                    "acr": {
                        "essential": true
                    }
                },
                "id_token":{
                    "openbanking_intent_id": {
                        "value": jsonData.Data.ConsentId,
                        "essential": true
                    },
                    "acr": {
                        "essential": true
                    }
                }
            }
        }

        var sHeader1 = JSON.stringify(header1);
        var sPayload1 = JSON.stringify(data);

        function generateRandomString(length){
            var text = "";
            var possible = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (var i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));                
            }
            return text;
        }

        function base64URL(string) {
            return string.toString(CryptoJS.enc.Base64).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        }

        var pkce_challenge = base64URL(CryptoJS.SHA256(generateRandomString(32)));
        console.log("code challenge - " + pkce_challenge);

        var pkce_challenge_hash = base64URL(CryptoJS.SHA256(pkce_challenge));
        console.log("code verifier - " + pkce_challenge_hash);

        variables.auth_code_verifier = pkce_challenge;
        variables.auth_code_challenge = pkce_challenge_hash;

        var consent_auth_steps = "for login:\nCustomer Number: " + variables.customer_dbid + "\n\tYour PIN; " + variables.customer_pin + "\n\t Your Password: " + variables.customer_password + '\n\nfor challenge code:\n\tgo to http://11.159.34.141/challenge.aspx\n\tSelect test environment: ' + variables['2fa_challenge_test_env'] + "\n\tSelect brand: " + variables['2fa_challenge_brand'];
        console.log(consent_auth_steps);

        try{    
            var sJWT1 = KJUR.jws.JWS.sign(alg, sHeader1, sPayload1, prvKey);
            var urlToHit = variables.personal_iam_auth_url + "?client_id=" + variables.client_id + "&response_type=code%20id_token&request=" + sJWT1 + "&nonce=" + nonce + "&code_challenge_method=" + variables.accounts_auth_code_challenge_method + "&code_challenge=" + variables.accounts_auth_code_challenge;
            
            console.log("urlToHit", urlToHit);
        }catch(e) {
            console.error('Error', e);
        }

        return {response: response, url: urlToHit};
    }catch(e){
        console.error("Error", e);
    }
}

async function exchangeAuthCode(authCode){ 
    console.log(authCode);
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;

    const body = {
        grant_type: 'authorization_code',
        code_verifier: variables.auth_code_verifier,
        client_id: variables.client_id,
        code_challenge_metod: variables.accounts_auth_code_challenge_method,
        code: authCode,
        client_assertion: variables.jwt_token,
        client_assertion_type: variables.client_assertion_type,
        redirect_uri: variables.redirect_uri
    };

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const options ={
        method: 'POST',
        url: `${variables.prerequest_url}`,
        headers: headers,
        data: body,
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
            cert: cert,
            key: key,
            passphrase: "password1",
            hostname: variables.https_host_name
         })
    }

    const response = await axios(options);
    variables.access_token_2 = response.data.access_token;
    variables.refresh_token = response.data.refresh_token;
    console.log("first Response", response.data);
    return response;
}

async function refreshToken(){ 
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;

    const body = {
        grant_type: 'refresh_token',
        refresh_token: variables.refresh_token,
        client_id: variables.client_id,
        client_assertion: variables.jwt_token,
        client_assertion_type: variables.client_assertion_type
    };

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const options ={
        method: 'POST',
        url: `${variables.prerequest_url}`,
        headers: headers,
        data: body,
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
            cert: cert,
            key: key,
            passphrase: "password1",
            hostname: variables.https_host_name
         })
    }

    const response = await axios(options);
    variables.access_token_2 = response.data.access_token;
    variables.refresh_token = response.data.refresh_token;
    console.log("first Response", response.data);
    return response; 
}

// async function fetchAge(){     
//     try {

//         const headers = {
//             Authorization: `Bearer ${variables.access_token_2}`,
//             'Content-Type': 'application/json'
//         }

//         const apiUrl = `${variables.apiUrlPrefix}/zerocode/bankofapis.com/customer-age/v3/attributes/age`;

//         const options ={
//             method: 'GET',
//             url: apiUrl,
//             headers: headers,
//         }

//         const response = await axios(options);
//         console.log("second Response", response.data);

//         return response;
//     }catch(error){
//         console.error('Error in accountRequest function', error.response ? error.response.data : error.message);
 
//     }
// }

async function fetchAccounts(){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function fetchAccountDetails(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function fetchTransactions(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/transactions`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function fetchBalances(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/balances`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function fetchBeneficiaries(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/beneficiaries`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function fetchStatements(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/statements`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function directDebits(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/direct-debits`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function fetchProducts(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/product`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function standingOrders(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/standing-orders`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}

async function scheduledPayments(accountId){     
    const alg = variables.alg;
    var header = {
        "kid": variables.signing_key_id,
        "typ": "JWS",
        "alg": alg
    }

    var now_date = Math.round(Date.now() / 1000);
    var exp_date = Math.round(600 + Date.now() / 1000);

    var data = {
        "sub": variables.client_id,
        "aud": variables.prerequest_url,
        "scope": variables.scope,
        "iss": variables.client_id,
        "iat": now_date,
        "exp": exp_date,
        "jti": uuid.v4()
    }

    var prvKey = variables.private_key;
    var sHeader = JSON.stringify(header);
    var sPayload = JSON.stringify(data);

    var sJWT = KJUR.jws.JWS.sign(alg, sHeader, sPayload, prvKey);
    variables.jwt_token = sJWT;
    

    const headers = {
        authorization: `Bearer ${variables.access_token_2}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    const tunnelingAgent = tunnel.httpsOverHttp({
        cert: cert,
        key: key,
        passphrase: "password1",
        proxy:{
            host: variables.proxy_host,
            port: "8080",
            proxyAuth: `${variables.user_name}:${variables.password}`,
            headers: {
                'User-Agent': 'Node'
            }
        }
     });

    const options ={
        method: 'GET',
        url: `${variables.base_url}/open-banking/v3.1/aisp/accounts/${accountId}/scheduled-payments`,
        headers: headers,
        httpsAgent: tunnelingAgent
    }

    require('axios-debug-log/enable');
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

    const response = await axios(options);
   
    console.log("first Response", response.data);
    return response;
}


router.get('/certificate', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename = "cert.pem"');
        res.send(cert);
    }catch(error){
        console.error('Error Sending The Certificate');
    }
});

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
