const express = require("express");
const { KEYUTIL, KJUR } = require("jsrsasign");
const uuid = require("uuid");
const fs = require("fs");
const bodyParser = require("body-parser");
const https = require("https");
const axios = require("axios");
const envData = JSON.parse(fs.readFileSync("HSBC_Env.json"));
const ClientId = envData.bank_sandbox_ob_clientId;
const Kid = envData.bank_sandbox_ob_kid;
const sPKCS8PEM = envData.bank_sandbox_ob_PKCS8PEM;
const scope = envData.bank_sandbox_ob_scope;
var clientAssertion = "";
const app = express();
const port = 4000;
let accessTokenForCall = "";
const uuidd = uuid.v4();
const publicKey = fs.readFileSync("pubkeyQseal.pem");
const privateKey = fs.readFileSync("private.key");
const certificate = fs.readFileSync("Transport.crt");
var prvKey = KEYUTIL.getKey(sPKCS8PEM);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
//1
async function GetClientCredentialsToken(callback) {
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
  console.log("%%%%%", clientAssertion, "%%%%%");

  const clientCredentials = new URLSearchParams({
    grant_type: "client_credentials",
    scope: scope,
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
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
      "x-fapi-financial-id": uuidd,
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
      callback(responseJson); // Call the callback function with the response
    });
  });

  reqHttps.on("error", (e) => {
    console.error(e);
  });

  reqHttps.write(clientCredentials.toString());
  reqHttps.end();
}
//2
async function CreateAccountAccessConsent(accessToken) {
  return new Promise((resolve, reject) => {
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
        const consentIdd = r.Data.ConsentId.toString();
        resolve(consentIdd); // Resolve the promise with consentIdd
      });
    });

    reqHttps.on("error", (e) => {
      reject(e); // Reject the promise if there's an error
    });

    reqHttps.write(requestBody);
    reqHttps.end();
  });
}
//3
// Function to generate consent authorization
async function InitiateConsentAuthorisation(consent) {
  return new Promise((resolve, reject) => {
    const joseHeader = {
      alg: "PS256",
      kid: Kid,
    };

    const payload = {
      claims: {
        userinfo: {
          openbanking_intent_id: {
            value: consent,
            essential: true,
          },
        },
        id_token: {
          openbanking_intent_id: {
            value: consent,
            essential: true,
          },
          acr: {
            essential: false,
            values: ["urn:openbanking:psd2:sca", "urn:openbanking:psd2:ca"],
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
      loginurl = resq.headers.location;
      // Log the complete response data
      resq.on("end", () => {
        resolve(loginurl);
      });
    });

    // Handle errors in the HTTPS request
    reqHttps.on("error", (e) => {
      console.error(e);
      res.status(500).json({ error: e.message }); // Send an error response back to the client
    });

    // End the request
    reqHttps.end();
  });
}

function consentToken(url) {
  if (url) {
    const start = url.indexOf("code=") + 5;
    const end = url.indexOf("&scope");
    if (start !== -1 && end !== -1) {
      const token = url.substring(start, end);
      console.log("Token:", token);
      return token;
    } else {
      console.log("Invalid URL format. Could not extract token.");
      return null; // Return null if token extraction fails
    }
  } else {
    console.log("URL is empty. Please provide a valid URL.");
    return null; // Return null if URL is empty
  }
}

//4
async function GetAccessToken(authToken) {
  return new Promise((resolve, reject) => {
    const codee = authToken;
    const clientAssertionn = clientAssertion;

    // Constructing request body with variables
    const requestBody = `grant_type=authorization_code&code=${codee}&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&client_assertion=${clientAssertionn}&redirect_uri=https%3A%2F%2Fsg-dummy-acc-uk-03.com%2Fcallback`;

    // Request options
    const options = {
      hostname: "secure.sandbox.ob.hsbc.co.uk",
      port: 443,
      path: "/obie/open-banking/v1.1/oauth2/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "cache-control": "no-cache",
      },
      key: fs.readFileSync("private.key"),
      cert: fs.readFileSync("transport.crt"),
    };

    // Send the request
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        console.log("Response Status:", res.statusCode);
        console.log("Response Body:", data);
        //accessTokenForCall=data.access_token;
        //callback(data);
        resolve(data);
      });
    });

    req.on("error", (error) => {
      console.error("Request Error:", error);
    });

    req.write(requestBody);
    req.end();
  });
}


//4.1

async function RefreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const codee = refreshToken;
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
    const clientAssertionRefreshToken = KJUR.jws.JWS.sign("PS256", joseHeader, payload, prvKey);
    const clientAssertionn = clientAssertionRefreshToken;
    console.log("*****************************",codee)
    // Constructing request body with variables
    const requestBody = `grant_type=refresh_token&refresh_token=${codee}&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&client_assertion=${clientAssertionn}&redirect_uri=https%3A%2F%2Fsg-dummy-acc-uk-03.com%2Fcallback`;

    // Request options
    const options = {
      hostname: "secure.sandbox.ob.hsbc.co.uk",
      port: 443,
      path: "/obie/open-banking/v1.1/oauth2/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "cache-control": "no-cache",
      },
      key: fs.readFileSync("private.key"),
      cert: fs.readFileSync("transport.crt"),
    };

    // Send the request
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        console.log("Response Status:", res.statusCode);
        console.log("Response Body:", data);
        //accessTokenForCall=data.access_token;
        //callback(data);
        resolve(data);
      });
    });

    req.on("error", (error) => {
      console.error("Request Error:", error);
    });

    req.write(requestBody);
    req.end();
  });
}
//5
async function GetAccounts(accessTokenForCalll) {
  return new Promise((resolve, reject) => {
    console.log("*******");
    console.log(accessTokenForCalll);
    const options = {
      hostname: "secure.sandbox.ob.hsbc.co.uk",
      port: 443,
      path: "/obie/open-banking/v3.1/aisp/accounts",
      method: "GET",
      key: privateKey,
      cert: certificate,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessTokenForCalll}`,
        "x-fapi-financial-id": uuidd,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        console.log("Response Status:", res.statusCode);
        console.log("Response Body:", data);
        resolve(data); // Resolve the promise with the response data
      });
    });

    req.on("error", (error) => {
      console.error("Request Error:", error);
      reject(error); // Reject the promise if there's an error
    });

    req.end(); // End the request
  });
}

//6
async function GetBalance(accessTokenForCalll, accountID) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "secure.sandbox.ob.hsbc.co.uk",
      port: 443,
      path: `/obie/open-banking/v3.1/aisp/accounts/${accountID}/balances`,
      method: "GET",
      key: privateKey,
      cert: certificate,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessTokenForCalll}`,
        "x-fapi-financial-id": uuidd,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        console.log("Response Status:", res.statusCode);
        console.log("Response Body:", data);
        resolve(data); // Resolve the promise with the response data
      });
    });

    req.on("error", (error) => {
      console.error("Request Error:", error);
      reject(error); // Reject the promise if there's an error
    });

    req.end();
  });
}

//7 

async function GetTransactions(accessToken, accountId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "secure.sandbox.ob.hsbc.co.uk",
      port: 443,
      path: `/obie/open-banking/v3.1/aisp/accounts/${accountId}/transactions`,
      method: "GET",
      key: privateKey,
      cert: certificate,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-fapi-financial-id": uuidd,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data)); // Resolve the promise with the parsed JSON data
        } else {
          reject(new Error(`Failed to fetch transactions: ${res.statusCode}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error); // Reject the promise if there's an error
    });

    req.end();
  });
}
app.post("/TokenConsentLogin_Sandbox_HSBC", async (req, res) => {
  console.log("Here")
  try {
    await GetClientCredentialsToken(async (response) => {
      const accessToken = response.access_token;
      const consentId = await CreateAccountAccessConsent(accessToken);
      const loginurl = await InitiateConsentAuthorisation(consentId);
      res.status(200).json({
        accessToken: accessToken,
        consentId: consentId,
        login: loginurl,
      }); // Send consentId in response
    });
  } catch (error) {
    console.error("Error in /r1 route:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/AccessToken_HSBC_Sandbox", async (req, res) => {
  try {
    const url = req.body.url;
    if (!url) {
      return res.status(400).json({ error: "URL is missing" });
    }
    const authToken = consentToken(url); // Call the function to extract the auth token from the URL
    if (!authToken) {
      return res.status(400).json({ error: "Invalid URL or auth token" });
    }
    console.log("Auth token:", authToken);
    // Call the function to get the access token passing the authToken
    const access = await GetAccessToken(authToken); // Await for the access token
    accessTokenForCall = access;
    // Send the access token back to the client
    res.status(200).json({
      message: "Access token received successfully",
      access: access, // Sending the access token in the response
    });
  } catch (error) {
    console.error("Error in /r2 route:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/FetchAccounts_HSBC_Sandbox", async (req, res) => {
  
  const responseObject = JSON.parse(accessTokenForCall);
  const accessToken = responseObject.access_token;
  console.log(accessToken);
  const accRes = await GetAccounts(accessToken);
  res.status(200).json({
    message: "accounts",
    accounts: accRes,
  });
});

app.post("/FetchAccounts_HSBC_Sandbox/:accountId/balances", async (req, res) => {
  try {
    const responseObject = JSON.parse(accessTokenForCall);
    const accessToken = responseObject.access_token;
    console.log(accessToken);
    const { accountId } = req.params;
    const accRes = await GetBalance(accessToken, accountId);
    res.status(200).json({
      message: "account balances",
      balances: accRes,
    });
  } catch (error) {
    console.error("Error in /FetchAccounts_HSBC_Sandbox/:accountId/balances route:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/FetchAccounts_HSBC_Sandbox/:accountId/transactions", async (req, res) => {
  try {
    const responseObject = JSON.parse(accessTokenForCall);
    const accessToken = responseObject.access_token;
    const { accountId } = req.params;

    if (!accessToken) {
      return res.status(400).json({ error: "Access token is missing" });
    }

    const transactions = await GetTransactions(accessToken, accountId);

    res.status(200).json({
      message: "Account transactions fetched successfully",
      transactions: transactions,
    });
  } catch (error) {
    console.error("Error in /FetchAccounts_HSBC_Sandbox/:accountId/transactions route:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/RefreshAccessToken_HSBC_Sandbox", async (req, res) => {
  try {
    const refreshtoken = req.body.refresh_token;
    console.log("refreshtoken token:", refreshtoken);
    // Call the function to get the access token passing the authToken
    const access = await RefreshAccessToken(refreshtoken); // Await for the access token
    accessTokenForCall = access;
    // Send the access token back to the client
    res.status(200).json({
      message: "Access token received successfully",
      access: access, // Sending the access token in the response
    });
  } catch (error) {
    console.error("Error in /r2 route:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
