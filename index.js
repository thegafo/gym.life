'use strict';

var assert = require('assert');
var Wit = require('node-wit').Wit;
var interactive = require('node-wit').interactive;
var redis = require('redis');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var prompt = require('prompt');

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


var context = {};



const client = new Wit({accessToken});


function receiveMessage(sender, message) {
  client.message(message, {})
  .then((data) => {
    console.log('Wit.ai response: ' + JSON.stringify(data));


    var entities = data.entities;
    var first_intent = firstEntityValue(data.entities, "intent");

    if (entities) console.log("Entities:", entities);
    if (first_intent) console.log("First intent:", first_intent)

    // We know this user
    if (context[sender]) {

      // START WORKOUT INTENT
      if (first_intent == "start_workout") {

        // already in workout
        if (context[sender].inWorkout) {

          // new workout
        } else {
          context[sender].inWorkout = true;
          sendMessage(sender, "Starting workout. What exercise are you doing first?");


        }


      } else if (first_intent == "exercise") {

        // not in workout
        if (!context[sender].inWorkout) return sendMessage(sender, "Yeah, that's an exercise. Do you want to start a workout?");


        // already in exercise
        if (context[sender].inExercise) {
          sendMessage(sender, "You're doing " + context[sender].exercise + " right now...");

        // new exercise
        } else {
          var exercise = data.entities.exercise[0].value;
          context[sender].inExercise = true;
          context[sender].exercise = exercise;
          context[sender].exercises[exercise] = [];

          sendMessage(sender, "Starting " + exercise + ". Whenever you finish a set, tell me how much weight and how many reps you did.");
        }


      } else if (first_intent == "log_set") {

        // not in workout
        if (!context[sender].inWorkout) return sendMessage(sender, "Nice, but you're not in a workout.");

        if (!context[sender].inExercise) return sendMessage(sender, "You're not in an exercise. Tell me what exercise you're doing before you start logging.")

        // log
        var exercise = context[sender].exercise;
        var reps = data.entities.reps[0].value;
        var weight = data.entities.weight[0].value;
        var weight_unit = data.entities.weight_unit[0].value;

        context[sender].exercises[exercise].push({
          weight: weight,
          weight_unit: weight_unit,
          reps: reps
        })

        sendMessage(sender, "Got it. If you're done, say done. Otherwise, keep going champ!");

      } else if (first_intent == "stop") {

        // in exercise
        if (context[sender].inExercise) {
          var exercise = context[sender].exercise;
          context[sender].inExercise = false;
          context[sender].exercise = false;
          sendMessage(sender, "Done with " + exercise + ". Are you done with your workout?");

        // not in exercise
        } else {

          // in workout
          if (context[sender].inWorkout) {
            context[sender].inWorkout = false;
            sendMessage(sender, "Congrats, big guy. Here's your workout report: ...");

          // not in workout
          } else {
            sendMessage(sender, "You have nothing to stop.");
          }

        }
      }

    // New user
    } else {
      context[sender] = {
        start: Date.now(),
        inWorkout: true,
        inExercise: false,
        exercise: false,
        exercises: {}
      }
      sendMessage(sender, "Starting workout. What exercise are you doing first?");

    }

    console.log("\n\n\n");
    Prompt();
  })
  .catch(console.error);

}

function sendMessage(recipient, message) {
  console.log("SENDING --> " + message);
}





prompt.start();


function Prompt() {
  prompt.get(['message'], function (err, result) {
    receiveMessage("+17864274900", result.message)
  });
}

Prompt();





app.get('/', function(req, res){
  res.sendFile(__dirname + '/www/index.html');
});

app.get('*', function(req, res){
  res.status(404).send('404');    // any other get requests get 404 error
});

//app.listen(config.express.port, function () {
//   console.log("Express listening on port " + config.express.port);
//});
