/**
 * Created by Dan Harabagiu.
 * Date: 2/24/12
 * Time: 11:36 AM
 */

var callbackList = [];
var onList = [];

Array.prototype.removeElement = function (o) {
    var idx = this.indexOf(o);
    if (idx !== -1) {
        this.splice(idx, 1);
        return true;
    }
    else {
        return false;
    }
};

function checkTimeouts() {
    var i, now, cleaningArray;

    now = new Date().getTime();
    cleaningArray = [];

    for(i = 0 ; i < callbackList.length ; i++) {
        if(callbackList[i].timeout < now) {
            cleaningArray.push(callbackList[i]);
        }
    }

    for(i = 0 ; i < cleaningArray ; i++) {
        callbackList.removeElement(cleaningArray[i]);
    }
    cleaningArray.length = 0;
}

setInterval(checkTimeouts, 1000);

/**
 * Add a callback for a specific message ID
 * @param string mesgId
 * @param function callbackFunction
 * @param number callbackTimeout
 */
function AddCallback(mesgId, callbackFunction, callbackTimeout) {
    var callbackElement, now;

    now = new Date().getTime();

    callbackElement = {
        id      :   mesgId,
        func    :   callbackFunction,
        timeout :   now + callbackTimeout
    };

    callbackList.push(callbackElement);
}

/**
 * Calls all the saved callbacks for a specific message ID
 * @param string mesgId
 * @param object data
 */
function ParseReply(mesgId, data, sid) {
    var i;

    for(i = 0 ; i < callbackList.length ; i++) {
        if(callbackList[i].id.toString() === mesgId.toString() ) {
            callbackList[i].func(data, sid);
        }
    }
}

/**
 * Adds an event tracker and the repsective callback
 * @param string title
 * @param function callback
 */
function AddOnEvent(title, callback) {
    onList.push({
        event   :   title,
        callback:   callback
    });
}

/**
 * Gets a list of callbacks for a requested event
 * @param string title
 * @return array
 */
function GetOnEvent(title) {
    var retList, i;

    retList = [];
    for(i = 0 ; i < onList.length ; i++) {
        if(onList[i].event.toString() === title.toString()) {
            retList.push(onList[i].callback);
        }
    }
    return retList;
}

exports.add = AddCallback;
exports.parse = ParseReply;
exports.on = AddOnEvent;
exports.getOnCallbacks = GetOnEvent;