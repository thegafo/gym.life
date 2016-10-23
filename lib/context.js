



// TODO
// store context in redis instead of in memory like this
// this will reset each time the app starts
var context = {};



/**
 * getContext - return the current context for a user
 *
 * @param  {String} senderId the ID of the sender
 * @return {Context} returns conversation context, or false if it doesnt exist
 */
function getContext(senderId) {
  return context[senderId] || false;
}

/**
 * setContext - set the context for a user
 *
 * @param  {String} senderId the ID of the sender
 * @param  {Object} the context to set (JSON)
 */
function setContext(senderId, new_context) {
  context[senderId] = new_context;
}



module.exports.getContext = getContext;
module.exports.setContext = setContext;
