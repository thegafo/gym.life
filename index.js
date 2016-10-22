'use strict';

var assert = require('assert');
var Wit = require('node-wit').Wit;
var interactive = require('node-wit').interactive;
var redis = require('redis');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

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

// Wit.ai token
const accessToken = config.wit_ai.server_access_token;

// Connect to Redis
var db = redis.createClient(config.redis.port, config.redis.url);
console.log('Connected to redis')


// Get the first entity value returned from wit
const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

// Wit.ai actions
const actions = {
  send(request, response) {
    const {sessionId, context, entities} = request;
    const {text, quickreplies} = response;
    return new Promise(function(resolve, reject) {
      console.log('sending...', JSON.stringify(response));
      return resolve();
    });
  },

  getForecast({context, entities}) {
    return new Promise(function(resolve, reject) {
      var location = firstEntityValue(entities, 'location');
      if (location) {
        context.forecast = 'super sunny in ' + location; // we should call a weather API here
        delete context.missingLocation;
      } else {
        context.missingLocation = true;
        delete context.forecast;
      }
      return resolve(context);
    });
  },
};

const client = new Wit({accessToken, actions});
interactive(client);
