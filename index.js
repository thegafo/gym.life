'use strict';

var assert = require('assert');
var crypto = require('crypto');
var Wit = require('node-wit').Wit;
var interactive = require('node-wit').interactive;
var redis = require('redis');
var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var bodyParser = require('body-parser');
var Toby = require('toby-node-client');
var twilio = require('twilio');
var prompt = require("prompt");
var request = require("request");
var receiveMessage = require('./lib/receive.js').receiveSMSMessage;
var getResponse = require('./lib/receive.js').getResponse;
var enforce = require('express-sslify');

var fb = require('./lib/fb-messenger.js');

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
const wit_client = new Wit({accessToken: config.wit_ai.server_access_token});

// Redis
var db = redis.createClient(config.redis.port, config.redis.url);
db.auth(config.redis.auth);
console.log('Redis connected and authorized')

// Twilio
var accountSid = config.twilio.account_sid;
var authToken = config.twilio.auth_token;
var twilio_client = new twilio.RestClient(accountSid, authToken);

// Express



var app = express();
var app = require('./lib/fb-messenger')(app, wit_client, config.facebook.app_secret, config.facebook.validation_token, config.facebook.page_access_token, config.facebook.server_url);
app.use(enforce.HTTPS({ trustProtoHeader: true }));  // in case you are behind a load balancer (e.g. Heroku). See further comments below
app.use(express.static(__dirname + '/www'));



//secureServer.use(bodyParser.urlencoded({extended:false})); // to let us parse request body (this may mess up facebook parsing)
//secureServer.post('/twilio_hook', function(req, res) {
//  var body = req.body;
//  if (!body || !body.Body || !body.From) return res.send("");
//
//  receiveSMSMessage(client, twilio_client, body.From, body.Body, receiveMessage);
//  res.send("");
//});

app.get('/', function(req, res){
  res.sendFile(__dirname + '/www/index.html');
});

app.get('*', function(req, res){
  res.status(404).send('404');    // any other get requests get 404 error
});


var ssl_options = {
  key: fs.readFileSync(__dirname + '/.key.pem'),
  cert: fs.readFileSync(__dirname + '/.cert.pem')
};

https.createServer(ssl_options, app).listen(config.express.secure_port, function(err) {
  console.log("Application running on port " + config.express.secure_port);
});


//prompt.start();
//
//function Prompt() {
//  prompt.get(['message'], function (err, result) {
//    if (!result.message) return Prompt();
//    getResponse(wit_client, "asdfID", result.message, function (err,res) {
//      if (err) return console.log(err);
//      console.log("RESPONSE", res);
//      Prompt();
//    })
//  });
//}
//
//Prompt();
