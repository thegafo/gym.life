'use strict';

var assert = require('assert');
var Wit = require('node-wit').Wit;
var interactive = require('node-wit').interactive;
var redis = require('redis');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var Toby = require('toby-node-client');
var twilio = require('twilio');
var prompt = require("prompt");
var receiveMessage = require('./lib/receive.js').receiveMessage;


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
console.log('Connected to redis')

// Twilio
var accountSid = config.twilio.account_sid;
var authToken = config.twilio.auth_token;
var twilio_client = new twilio.RestClient(accountSid, authToken);


app.post('/twilio_hook', function(req, res) {
  var body = req.body;
  if (!body || !body.Body || !body.From) return res.sendStatus(400);

  receiveMessage(client, twilio_client, body.From, body.Body, receiveMessage);
  res.sendStatus(200);
})


app.get('/', function(req, res){
  res.sendFile(__dirname + '/www/index.html');
});

app.get('*', function(req, res){
  res.status(404).send('404');    // any other get requests get 404 error
});

app.listen(config.express.port, function () {
   console.log("Express listening on port " + config.express.port);
});
