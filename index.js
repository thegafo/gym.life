'use strict';

var assert = require('assert');
var Wit = require('node-wit').Wit;
var interactive = require('node-wit').interactive;
var redis = require('redis');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var prompt = require('prompt');
var Toby = require('toby-node-client');
var twilio = require('twilio');

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

// Twilio
var accountSid = config.twilio.account_sid;
var authToken = config.twilio.auth_token;

var twilio = require('twilio');
var twilio_client = new twilio.RestClient(accountSid, authToken);


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



const client = new Wit({accessToken: config.wit_ai.server_access_token});


function receiveMessage(sender, message) {
  client.message(message, {})
  .then((data) => {
    console.log('Wit.ai response: ' + JSON.stringify(data));

    var entities = data.entities;
    var first_intent = firstEntityValue(data.entities, "intent");

    // If we are awaiting reply from user
    if (context[sender] && context[sender].awaiting) {
      if (first_intent = "yes_no") {
        if (entities.yes_no[0].value == "yes") {
          console.log("reply is positive. sending:", context[sender].awaitingMessagePos);
          receiveMessage(sender, context[sender].awaitingMessagePos);
        } else {
          console.log("reply is negative. sending:", context[sender].awaitingMessageNeg);
          receiveMessage(sender, context[sender].awaitingMessageNeg);
        }
        context[sender].awaiting = false;

      } else {
        return sendMessage(sender, "What? Try yes or no...")
      }


    // Not awaiting reply
    } else {

      if (entities) console.log("Entities:", entities);
      if (first_intent) console.log("First intent:", first_intent)

      // We know this user
      if (context[sender]) {

        // START WORKOUT INTENT
        if (first_intent == "start_workout") {

          // already in workout
          if (context[sender].inWorkout) {

            if (context[sender].inExercise) {
              sendMessage(sender, "You've already started a workout, and you're currently logging " + context[sender].exercise + ". Say start over to start over, say done to move on to the next exercise, or tell me weight/reps when you finish a set.");

            } else {
              sendMessage(sender, "You've already started a workout. Say start over to start over, or tell me what exercise you want to log next.");
            }
            // new workout
          } else {
            context[sender].inWorkout = true;
            sendMessage(sender, "Starting workout. What exercise are you doing first?");


          }


        } else if (first_intent == "exercise") {

          // not in workout
          if (!context[sender] || !context[sender].inWorkout) {
            context[sender].awaiting = true;
            context[sender].awaitingMessageNeg = "continue";
            context[sender].awaitingMessagePos = "Start workout";

            console.log("HERE");
            return sendMessage(sender, "Yeah, that's an exercise. Are you starting a workout?");
          }

          // already in exercise
          if (context[sender].inExercise) {
            sendMessage(sender, "You're doing " + context[sender].exercise + " right now...");

            // new exercise
          } else {
            var exercise = data.entities.exercise[0].value;
            context[sender].inExercise = true;
            context[sender].exercise = exercise;

            if (!context[sender].exercises[exercise])
            context[sender].exercises[exercise] = [];

            sendMessage(sender, "Starting " + exercise + ". Whenever you finish a set, tell me how much weight and how many reps you did.");
          }


        } else if (first_intent == "log_set") {

          // not in workout
          if (!context[sender].inWorkout) {
            context[sender].awaiting = true;
            context[sender].awaitingMessagePos = "Start workout";
            context[sender].awaitingMessageNeg = "continue";
            return sendMessage(sender, "Nice, but you're not in a workout. Are you starting one?");
          } else if (!context[sender].inExercise) {
            return sendMessage(sender, "You haven't told me what exercise you're doing. What do you want to start logging?")


          // TODO
          } else if (!(data.entities.reps && data.entities.weight && data.entities.weight_unit)) {
            return sendMessage(sender, "What?");
          }
          if (!(data.entities.reps[0] && data.entities.weight[0] && data.entities.weight_unit[0])) return sendMessage(sender, "What?");
          ////////////

          // log
          var exercise = context[sender].exercise;
          var reps = data.entities.reps[0].value;
          var weight = data.entities.weight[0].value;
          var weight_unit = data.entities.weight_unit[0].value;

          context[sender].exercises[exercise].push({
            weight: weight,
            weight_unit: weight_unit,
            reps: reps
          });

          sendMessage(sender, "Got it. If you're done, say done. Otherwise, keep going champ!");

        } else if (first_intent == "stop") {

          // in exercise
          if (context[sender].inExercise) {
            var exercise = context[sender].exercise;
            context[sender].inExercise = false;
            context[sender].exercise = false;

            context[sender].awaiting = true;
            context[sender].awaitingMessagePos = "stop";
            context[sender].awaitingMessageNeg = "continue";

            sendMessage(sender, "Done with " + exercise + ". Are you done with your workout?");


          } else {

            // in workout
            if (context[sender].inWorkout) {
              context[sender].inWorkout = false;
              sendMessage(sender, "Congrats, big guy. Here's your workout report: ...");
              console.log("WORKOUT REPORT", context[sender].exercises);

              // not in workout
            } else {
              sendMessage(sender, "You have nothing to stop.");
            }

          }
        } else if (first_intent == "continue") {

          if (context[sender].inExercise)
            sendMessage(sender, "Alright. Tell me weight/reps when you're done with the set.");
          else if (context[sender].inWorkout)
            sendMessage(sender, "What exercise are you doing now?");
          else
            sendMessage(sender, "Ok. Let me know when you are.");


        } else if (first_intent == "greeting") {
            if (!context[sender].inWorkout) {
              context[sender].awaiting = true;
              context[sender].awaitingMessagePos = "start workout";
              context[sender].awaitingMessageNeg = "continue";
              sendMessage(sender, "Hi, are you starting a workout?");
            }
        } else {
          sendMessage(sender, "Sorry, I have zero clue what you mean.");
        }

        // not in exercise
        // New user
      } else {
        context[sender] = {
          start: Date.now(),
          inWorkout: false,
          inExercise: false,
          exercise: false,
          exercises: {}
        }
        sendMessage(sender, "Hi, I'm Jim the gym journal bot. I can help you log and analyze your workouts. Just let me know whenever you're starting a workout'.");

      }

    }


    console.log("\n\n\n");
  })
  .catch(console.error);

}

function sendMessage(recipient, message) {
  console.log("SENDING --> " + message);

  //twilio_client.messages.create({
  //  body: message,
  //  to: recipient,
  //  from: config.twilio.number
  //}, function(err, message) {
  //  console.log(message.sid);
  //});
  Prompt();

}





prompt.start();


function Prompt() {
  prompt.get(['message'], function (err, result) {
    if (result.message)
      receiveMessage("+17864274900", result.message)
    else
      Prompt();
  });
}

Prompt();


var toby = new Toby("gym.life", "gym.life", function() {
  console.log("Connected to Toby");
}, function(from, message) {
  if (from == "@hook") {
    receiveMessage(message.From, message.Body);
  }
})

toby.start();




app.get('/', function(req, res){
  res.sendFile(__dirname + '/www/index.html');
});

app.get('*', function(req, res){
  res.status(404).send('404');    // any other get requests get 404 error
});

//app.listen(config.express.port, function () {
//   console.log("Express listening on port " + config.express.port);
//});
