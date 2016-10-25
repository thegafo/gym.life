
var generateResponseAndNewContext = require('./bot-logic.js');

var getContext = require('./context.js').getContext;
var setContext = require('./context.js').setContext;
var prompt = require('prompt');

// Twilio
var twilio;

/**
 * receiveMessage - given Wit client, senderId, and message, generate response
 *
 * @param  {type} wit_client description
 * @param  {type} senderId   description
 * @param  {type} message    description
 * @return {type}            description
 */
//function receiveSMSMessage(wit_client, twilio_client, senderId, message, receiveMessage) {
//	twilio = twilio_client;
//  wit_client.message(message, {})
//  .then((data) => {
//    console.log('Wit.ai response: ' + JSON.stringify(data));
//
//    var context = getContext(senderId);
//
//    generateResponseAndNewContext(context, data, senderId, receiveMessage, function(err, context, response, continuing, quickReplies) {
//			if (err) cb(err, false);
//
//
//			setContext(senderId, context);
//
//			if (continuing) {
//				return receiveMessage(wit_client, twilio_client, senderId, continuing, receiveMessage);
//			} else {
//				if (response)
//					sendSMSMessage(senderId, response);
//			}
//		});
//  })
//  .catch(console.error);
//}


//callback with response
function getResponse(wit_client, senderId, message, cb) {

  wit_client.message(message, {})
  .then((data) => {
    console.log('Wit.ai response: ' + JSON.stringify(data));

    var context = getContext(senderId);

    generateResponseAndNewContext(context, data, senderId, getResponse, function(err, context, response, quickReplies, continuing) {
			if (err) cb(err, false);

			setContext(senderId, context);

			if (continuing) {
				getResponse(wit_client, senderId, continuing, cb)
			} else {
				cb(null, response, quickReplies);
			}
		});
  })
  .catch(console.error);
}




function sendSMSMessage(recipient, message) {
  console.log("SENDING --> " + message);

  twilio.messages.create({
    body: message,
    To: recipient,
    from: "+13055047474"
  }, function(err, message) {
		if (err) return console.log(err);
    console.log(message.sid);
  });
}




//module.exports.receiveSMSMessage = receiveSMSMessage;
module.exports.getResponse = getResponse;
