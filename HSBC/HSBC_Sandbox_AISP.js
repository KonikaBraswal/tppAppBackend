const express = require("express");
const { KEYUTIL, KJUR } = require("jsrsasign");
const uuid = require("uuid");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const envData = JSON.parse(fs.readFileSync("HSBC_Env.json"));
const ClientId = envData.bank_sandbox_ob_clientId;
const Kid = envData.bank_sandbox_ob_kid;
var aud = envData.bank_sandbox_ob_token_endpoint;
var sPKCS8PEM = envData.bank_sandbox_ob_PKCS8PEM;
var scope = envData.bank_sandbox_ob_scope;
const app = express();
const readline = require('readline');
var token="";
var clientAssertion="";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
var prvKey = KEYUTIL.getKey(sPKCS8PEM);
const port = 4000;
var consentIdd='';
const uuidd=uuid.v4();
var loginurl='';
const publicKey = fs.readFileSync("pubkeyQseal.pem");
const privateKey = fs.readFileSync("private.key");
const certificate = fs.readFileSync("Transport.crt");
//1
function GetClientCredentialsToken(callback) {
    const joseHeader = {
      alg: "PS256",
      kid: Kid,
    };
  
    const payload = {
      iss: ClientId,
      aud: "https://secure.sandbox.ob.hsbcnet.com/ce/obie/open-banking/v1.1/oauth2/token",
      sub: ClientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    clientAssertion = KJUR.jws.JWS.sign("PS256", joseHeader, payload, prvKey);
    //const token = jwt.sign(jwtPayload, { key: privateKey, publicKey }, { header: jwtHeader });
  console.log("??????????????");
  console.log(clientAssertion);
  console.log("*********88")
    const clientCredentials = new URLSearchParams({
      grant_type: "client_credentials",
      scope: scope,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
    });
  
    const options = {
      hostname: "secure.sandbox.ob.hsbc.co.uk",
      port: 443,
      path: "/obie/open-banking/v1.1/oauth2/token",
      method: "POST",
      key: privateKey,
      cert: certificate,
      headers: {
        "x-fapi-financial-id": uuid.v4(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      followRedirect: false,
    };
  
    const reqHttps = https.request(options, (resq) => {
      let responseData = "";
  
      resq.on("data", (chunk) => {
        responseData += chunk;
      });
  
      resq.on("end", () => {
        const responseJson = JSON.parse(responseData);
        accessToken = responseJson.access_token;
        console.log("accesstoken",accessToken);
        callback();
      });
    });
  
    reqHttps.on("error", (e) => {
      console.error(e);
    });
  
    reqHttps.write(clientCredentials.toString());
    reqHttps.end();
  }
  //2
  // Function to generate consent
  function CreateAccountAccessConsent(callback) {
    const bodyData = {
      Data: {
        Permissions: [
          "ReadAccountsBasic",
          "ReadAccountsDetail",
          "ReadBalances",
          "ReadBeneficiariesBasic",
          "ReadBeneficiariesDetail",
          "ReadDirectDebits",
          "ReadPAN",
          "ReadParty",
          "ReadProducts",
          "ReadStatementsBasic",
          "ReadStatementsDetail",
          "ReadScheduledPaymentsBasic",
          "ReadScheduledPaymentsDetail",
          "ReadStandingOrdersBasic",
          "ReadStandingOrdersDetail",
          "ReadTransactionsBasic",
          "ReadTransactionsCredits",
          "ReadTransactionsDebits",
          "ReadTransactionsDetail",
        ],
        ExpirationDateTime: "2030-12-31T10:40:00+02:00",
        TransactionFromDateTime: "2010-01-01T10:40:00+02:00",
        TransactionToDateTime: "2025-12-31T10:40:00+02:00",
      },
      Risk: {},
    };
  
    const requestBody = JSON.stringify(bodyData);
  
    const options = {
      hostname: "secure.sandbox.ob.hsbc.co.uk",
      port: 443,
      path: "/obie/open-banking/v3.1/aisp/account-access-consents",
      method: "POST",
      key: privateKey,
      cert: certificate,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-fapi-financial-id": uuidd,
        Accept: "application/json",
      },
    };
  
    const reqHttps = https.request(options, (resq) => {
      let responseData = "";
  
      resq.on("data", (chunk) => {
        responseData += chunk;
      });
  
      resq.on("end", () => {
        const r = JSON.parse(responseData);
        consentIdd = r.Data.ConsentId.toString();
        console.log(consentIdd);
        callback();
      });
    });
  
    reqHttps.on("error", (e) => {
      console.error(e);
    });
  
    reqHttps.write(requestBody);
    reqHttps.end();
  }

//3
  // Function to generate consent authorization
  function InitiateConsentAuthorisation(res) {
    const joseHeader = {
      alg: "PS256",
      kid: Kid,
    };
  
    const payload = {
      claims: {
        userinfo: {
          openbanking_intent_id: {
            value: consentIdd,
            essential: true,
          },
        },
        id_token: {
          openbanking_intent_id: {
            value: consentIdd,
            essential: true,
          },
          acr: {
            essential: false,
            values: [
              "urn:openbanking:psd2:sca",
              "urn:openbanking:psd2:ca",
            ],
          },
        },
      },
      iss: ClientId,
      aud: "https://secure.sandbox.ob.hsbc.co.uk",
      response_type: "code id_token",
      client_id: ClientId,
      state: "dummy-state",
      exp: Math.floor(Date.now() / 1000) + 3600,
      redirect_uri: "https://sg-dummy-acc-uk-03.com/callback",
      nonce: "dummy-nonce",
      scope: "openid accounts",
    };
  
   // const jwtToken = jwt.sign(jwtPayload, { key: privateKey, publicKey }, { header: jwtHeader });
    var requestJwt = KJUR.jws.JWS.sign("PS256", joseHeader, payload, prvKey);
    // Encode the JWT token for safe inclusion in the URL
    // const encodedJwtToken = encodeURIComponent(jwtToken);
    // console.log(encodedJwtToken);
  
    const params = new URLSearchParams({
      response_type: "code id_token",
      client_id: ClientId,
      state: "dummy-state",
      scope: "openid accounts",
      nonce: "dummy-nonce",
      redirect_uri: "https://sg-dummy-acc-uk-03.com/callback",
      request: requestJwt,
    });
  
    const optionsAuth = {
      hostname: "sandbox.ob.hsbc.co.uk",
      port: 443,
      path: `/obie/open-banking/v1.1/oauth2/authorize?response_type=code%20id_token&client_id=PFoMa1GDG1365GQlPk7eRcNxoy2Hcohb&state=dummy-state&scope=openid%20accounts&nonce=dummy-nonce&redirect_uri=https://sg-dummy-acc-uk-03.com/callback&request=${requestJwt}`,
      method: "GET",
      key: privateKey,
      cert: certificate,
      headers: {
        "cache-control": "no-cache",
      },
    };
  
    // Make the HTTPS request
    const reqHttps = https.request(optionsAuth, (resq) => {
      let responseData = "";
  
      // Collect response data
      resq.on("data", (chunk) => {
        responseData += chunk;
      });
      console.log("Status:", resq.statusCode);
      console.log("Headers", resq.headers);
      console.log("Location", resq.headers.location);
      loginurl=resq.headers.location;
      // Log the complete response data
      resq.on("end", () => {
        console.log("Response:", loginurl);
        res.json({ loginurl }); // Send the response data back to the client
      });
    });
  
    // Handle errors in the HTTPS request
    reqHttps.on("error", (e) => {
      console.error(e);
      res.status(500).json({ error: e.message }); // Send an error response back to the client
    });
  
    // End the request
    reqHttps.end();
  }
  function consentToken() {
    rl.question('Please enter the URL: ', (url) => {
        if (url) {
            const start = url.indexOf('code=') + 5;
            const end = url.indexOf('&scope');
            token = url.substring(start, end);
            console.log("**********************************")
            console.log("Token:", token);
            rl.close();
        } else {
            console.log("URL is empty. Please provide a valid URL.");
            rl.close();
        }
    });
}
//4
function GetAccessToken(callback){
    console.log("############")
    console.log(clientAssertion);
    const bodyData = {
        grant_type:"authorization_code",
        code:token,
        client_assertion_type:"urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion:clientAssertion,
        redirect_uri:"https://sg-dummy-acc-uk-03.com/callback"
      };
    
      const requestBody = JSON.stringify(bodyData);
    
      const options = {
        hostname: "secure.sandbox.ob.hsbc.co.uk",
        port: 443,
        path: "https://secure.sandbox.ob.hsbc.co.uk/obie/open-banking/v1.1/oauth2/token",
        method: "POST",
        key: privateKey,
        cert: certificate,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        
        },
      };
    
      const reqHttps = https.request(options, (resq) => {
        let responseData = "";
    
        resq.on("data", (chunk) => {
          responseData += chunk;
        });
    
        resq.on("end", () => {
          const r = JSON.parse(responseData);
          console.log(r);
          callback();
        });
      });
    
      reqHttps.on("error", (e) => {
        console.error(e);
      });
    
      reqHttps.write(requestBody);
      reqHttps.end(); 
}


  app.get("/r1", (req, res) => {
    GetClientCredentialsToken(() => {
        CreateAccountAccessConsent(() => {
            InitiateConsentAuthorisation(res);
        });
    });
    consentToken(() => {
        res.status(200).json({ message: "Consent token fetched successfully." });
    });


  

});
app.get("/r2", (req, res) => {
    GetAccessToken(() => {
        res.status(200).json({ message: "Consent token fetched succesffully." });
    });
});



//   app.get("/r1", (req, res) => {
//     generateToken(() => {
//         res.status(200).json({ message: "Access token generated successfully." });
//     });
    
//   });
//   app.get("/r2", (req, res) => {
//     generateConsent(() => {
//         res.status(200).json({ message: "Consent generated succesffully." });
//     });
    
//   });
//   app.get("/r3", (req, res) => {
//     consentAuthorization(() => {
//         res.status(200).json({ message: "r3 generated succesffully." });
//     });
    
//   });
  
  app.use(express.static("public"));
  
  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
