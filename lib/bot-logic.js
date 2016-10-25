

/** Main Bot Logic
 *
 * Given data extracted by Wit.ai, generate a new context and response.
 *
 *
 */



function generateResponseAndNewContext(context, data, senderId, receiveMessage, cb) {

    var entities = data.entities;
    var first_intent = firstEntityValue(data.entities, "intent");

    // If we are awaiting reply from user //////////////////////////////////////
    if (context && context.awaiting) {

			// automatically set awaiting to false
			context.awaiting = false; // TODO this may be a bug

      if (first_intent = "yes_no" && entities.yes_no) {

				// Positive
        if (entities.yes_no[0].value == "yes") {
					return cb(null, context, false, [], context.awaitingMessagePos); // no response

				// Negative
        } else {
					return cb(null, context, false, [], context.awaitingMessageNeg); // no response
        }


      } else {
				context.awaiting = true;
				// leave awaiting messages the same

				return cb(null, context, "What? Try yes or no...", []);
        //return sendMessage(sender, "What? Try yes or no...")
      }


    // Not awaiting reply////////////////////////////////////////////////////////
    } else {

      if (entities) console.log("Entities:", entities);
      if (first_intent) console.log("First intent:", first_intent)

      // We know this user
      if (senderId && context) {

        // START WORKOUT INTENT
        if (first_intent == "start_workout") {

          // already in workout
          if (context.inWorkout) {

            if (context.inExercise) {
							return cb(null, context, "You've already started a workout, and you're currently logging " + context.exercise + ". Say done to move on to the next exercise, or tell me weight/reps when you finish a set.", [])
              //sendMessage(sender, );

            } else {
							return cb(null, context, "You've already started a workout. Say start over to start over, or tell me what exercise you want to log next.", [])
              //sendMessage(sender, );
            }
            // new workout
          } else {
            context.inWorkout = true;
						return cb(null, context, "Starting workout. What exercise are you doing first?", ["Bench press", "Squats", "Shoulder press"]);

          }


        } else if (first_intent == "exercise") {


          // not in workout
          if (!context || !context.inWorkout) {
            context.awaiting = true;
            context.awaitingMessageNeg = "continue";
            context.awaitingMessagePos = "Start workout";

						return cb(null, context, "Yeah, that's an exercise. Are you starting a workout?", ["Yes", "No"])


          // Already in workout
          } else {

            // if intent was exercise, but there are not exercise entities, then
            // we probably don't have that exercise in the database
            if (!data.entities.exercise) return cb(null, context, "Sorry, that exercise isn't in my system yet. You'll be able to add it soon.", ["You suck"])
            var exercise = data.entities.exercise[0].value;

            if (!context.exercises[exercise])
            	context.exercises[exercise] = [];

            // Already in exercise
            if (context.inExercise) {

              var old_exercise = context.exercise;
              context.exercise = exercise;
              context.inExercise = true;

              return cb(null, context, "Switched from " + old_exercise + " to " + exercise + ". Tell me how much weight and how many reps you did when you finish a set.", []);
            } else {
                context.exercise = exercise;
                context.inExercise = true;
						    return cb(null, context, "Starting " + exercise + ". Whenever you finish a set, tell me how much weight and how many reps you did.", []);
            }
          }


        } else if (first_intent == "log_set") {

          // not in workout
          if (!context.inWorkout) {
            context.awaiting = true;
            context.awaitingMessagePos = "Start workout";
            context.awaitingMessageNeg = "continue";
						return cb(null, context, "Nice, but you haven't told me that you're starting a workout. Are you starting one?", ["Yes", "no"]);
            //return sendMessage(sender, );
          } else if (!context.inExercise) {
						return cb(null, context, "You haven't told me what exercise you're doing. What do you want to start logging?", [])
            //return sendMessage(sender, )


          // in workout
          } else if (!(data.entities.reps && data.entities.weight && data.entities.weight_unit)) {
						return cb(null, context, "Sorry, I didn't understand that. I'm working on it, but for now, please include units.", [])
            //return sendMessage(sender, "What?");
          }
          if (!(data.entities.reps[0] && data.entities.weight[0] && data.entities.weight_unit[0])) return cb(null, context, "What?", [])
          ////////////

          // log
          var exercise = context.exercise;
          var reps = data.entities.reps[0].value;
          var weight = data.entities.weight[0].value;
          var weight_unit = data.entities.weight_unit[0].value;

          context.exercises[exercise].push({
            weight: weight,
            weight_unit: weight_unit,
            reps: reps
          });

					return cb(null, context, "Got it. If you're done, say done. Otherwise, keep going champ!", [])
          //sendMessage(sender, );

        // USER WANTS TO STOP CURRENT LEVEL
        } else if (first_intent == "stop") {

          // IN EXERCISE
          if (context.inExercise) {
            var exercise = context.exercise;
            context.inExercise = false;
            context.exercise = false;

            context.awaiting = true;
            context.awaitingMessagePos = "stop";
            context.awaitingMessageNeg = "continue";

						return cb(null, context, "Done with " + exercise + ". Are you done with your workout?", ["Yes", "No"]);
            //sendMessage(sender, );

          // NOT IN EXERCISE
          } else {

            // in workout
            if (context.inWorkout) {
							//console.log("WORKOUT REPORT", context.exercises);

							if (!Object.keys(context.exercises).length) {
                context.inWorkout = false;
                context.inExercise = false;
                context.exercises = {};
                return cb(null, context, "Congratulations, you completed a grand total of zero exercises! Keep it up champ!", []);
              }
							var report = "";
							for (ex in context.exercises) {
                if (!Object.keys(context.exercises[ex]).length) continue; // skip if no sets were done
								report += ex + ":\n";
								for (ex_set in context.exercises[ex]) {
									report += context.exercises[ex][ex_set].weight + " " + context.exercises[ex][ex_set].weight_unit + " X " + context.exercises[ex][ex_set].reps + " reps\n"
								}
								report += "\n";
							}
              context.inWorkout = false;
              context.inExercise = false;
              context.exercises = {};
							return cb(null, context, "Great work! Here's your workout report: \n\n"+ report, []);
              //sendMessage(sender, );

              // not in workout
            } else {
							return cb(null, context, "You have nothing to stop...", []);
              //sendMessage(sender, "You have nothing to stop.");
            }

          }


        } else if (first_intent == "help") {

          if (context.inExercise)
            return cb(null, context, "You are currently doing " + context.exercise + ". Tell me weight/reps to log a set, or tell me the next exercise you want to start", []);
          else if (context.inWorkout)
            return cb(null, context, "You're in the middle of a workout. Say done to end it, or tell me what exercise you want to start logging", []);
          else
            return cb(null, context, "You can start a workout by saying start workout.", ["Start workout"]);

        } else if (first_intent == "continue") {

          if (context.inExercise)
					  return cb(null, context, "Alright. Tell me weight/reps when you're done with the set.", [])
            //sendMessage(sender, );
          else if (context.inWorkout)
						return cb(null, context, "What exercise are you doing now?", [])
            //sendMessage(sender, );
          else
						return cb(null, context, "Ok. Let me know when you are.", []);
            //sendMessage(sender, "Ok. Let me know when you are.");


        } else if (first_intent == "greeting") {
            if (!context.inWorkout) {
              context.awaiting = true;
              context.awaitingMessagePos = "start workout";
              context.awaitingMessageNeg = "continue";
							return cb(null, context, "Hi, are you starting a workout?", ["Yes", "No"]);
              //sendMessage(sender, "Hi, are you starting a workout?");
            } else if (!context.inExercise) {
              return cb(null, context, "What exercise are you doing?", []);
            } else {
              return cb(null, context, "Concentrate.", [])
            }
        } else {
					if (!context.inWorkout){
            context.awaiting = true;
            context.awaitingMessagePos = "start workout";
            context.awaitingMessageNeg = "continue";
						return cb(null, context, "Are you starting a workout?", ["Yes", "No"]);
					} else if (context.inExercise) {
						return cb(null, context, "Just tell me reps/weight when you're done with a set, or say done if you're done with " + context.exercise, []);

          } else {
						//TODO
            return cb(null, context, "What exercise are you doing?", []);

						//return cb(null, context, "Just tell me reps/weight when you're done with a set, or say done if you're done with " + context.exercise);

					}
          //sendMessage(sender, "Sorry, I have zero clue what you mean.");
        }


      // New user
      } else {

        context = {
          start: Date.now(),
          inWorkout: false,
          inExercise: false,
          exercise: false,
          exercises: {}
        }

				cb(null, context, "Hi, I'm Jim the Gym Bot. I can help you log and analyze your workouts. Just say hey whenever you're starting a workout", ['Start now'], false);
      }
    }
}



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



module.exports = generateResponseAndNewContext;
