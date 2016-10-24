'use strict';

var assert = require('assert');
var crypto = require('crypto');
var Wit = require('node-wit').Wit;
var interactive = require('node-wit').interactive;
var redis = require('redis');
var express = require('express');
var fs = require('fs');
var https = require('https');
var app = express();
var bodyParser = require('body-parser');
var Toby = require('toby-node-client');
var twilio = require('twilio');
var prompt = require("prompt");
var request = require("request");
var receiveMessage = require('./lib/receive.js').receiveMessage;
var fb = require('./lib/fb-messenger.js');



app.use(express.static(__dirname + '/www'));
app.use(bodyParser.urlencoded({extended:false})); // to let us parse request body

// LOAD CONFIGURATION
var config;
try {
  config = require('./' + process.argv[2]);
  console.log("Loaded configuration from " + process.argv[2]);
} catch (Error) {
  console.log("Could not load configuration");
	console.log('usage: node index.js <config_file>');
  process.exit(1);
}

// Wit.ai
const accessToken = config.wit_ai.server_access_token;
const client = new Wit({accessToken: config.wit_ai.server_access_token});

// Redis
var db = redis.createClient(config.redis.port, config.redis.url);
db.auth(config.redis.auth);
console.log('Redis connected and authorized')

// Twilio
var accountSid = config.twilio.account_sid;
var authToken = config.twilio.auth_token;
var twilio_client = new twilio.RestClient(accountSid, authToken);


app.post('/twilio_hook', function(req, res) {
  var body = req.body;
  if (!body || !body.Body || !body.From) return res.send("");

  receiveMessage(client, twilio_client, body.From, body.Body, receiveMessage);
  res.send("");
});


// MESSENGER //////////////////////////////////////////////////////////////////

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === config.facebook.validation_token) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          fb.receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          fb.receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          fb.receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          fb.receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          fb.receivedMessageRead(messagingEvent);
        } else if (messagingEvent.account_linking) {
          fb.receivedAccountLink(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL.
 *
 */
app.get('/authorize', function(req, res) {
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
});

// END MESSENGER ///////////////////////////////////////////////////////////////


app.get('/', function(req, res){
  res.sendFile(__dirname + '/www/index.html');
});

app.get('*', function(req, res){
  res.status(404).send('404');    // any other get requests get 404 error
});

https.createServer({
  key: fs.readFileSync(__dirname + '/.key.pem'),
  cert: fs.readFileSync(__dirname + '/.cert.pem')
}, app).listen(config.express.port, function() {
  console.log('Node app is running on port', config.express.port);
});
