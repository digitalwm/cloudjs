/**
 * Created by Dan Harabagiu
 * Date: 2/18/12
 * Time: 7:50 PM
 */

/*
    Events emited:
    - newPeer -> id
    - lostPeer -> id
    - "userEvent" -> array(msg, id)
*/

/*
    config = {
        hasPool     :   bool,
        timeout     :   int,
        balance     :   int,
        heartbeat   :   int
        hasEncryption : bool,
        encryptionKey : string
    }
 */

//noinspection JSUnresolvedVariable
var util = require('util'),
    events = require('events').EventEmitter,
    crypto = require('cryptojs').Crypto,
    dgram = require('dgram'),
    serializer = require("JASON"),
    totalOps = 0, totalTime = 0;

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

function distributeDataToCloud(clouder) {
    var numberOfPeers,
        numberOfItems,
        itemsPerPeer,
        itemToMove,
        i, j,
        itemString,
        transportedObj;

    //do a fast quit, we have no items
    if(clouder._hasPool === false) {
        process.exit(0);
    }

    numberOfPeers = clouder.peers.length;
    numberOfItems = clouder.pool.length;

    if(numberOfPeers <= 0) {
        process.exit(0);
    }

    itemsPerPeer = Math.ceil(numberOfItems / numberOfPeers);
    for(i = 0; i < numberOfPeers ; i++) {
        for(j = 0 ; j < itemsPerPeer; j++) {
            itemToMove = getAndMarkItem(clouder.timers);
            if(itemToMove === null) {
                return;
            }
            else {
                console.log("Moving item to " + clouder.peers[i].id);
                transportedObj = {
                    obj     :   itemToMove[0],
                    timer   :   itemToMove[1],
                    did     :   clouder.peers[i].id
                };
                itemString = serializer.stringify(transportedObj);
                clouder.sendOperational("moveItem",itemString,false);
            }
        }
    }
    clouder.terminated = true;
    console.log("Waiting for a timer to run, so we give socket time to send...");
    return;
}

function sortPeers(a, b) {
    /*
    -1 -> a < b
    0 -> a = b
    1 -> a > b
     */

    if(a.score < b.score) {
        return -1;
    }
    else if(a.score > b.score) {
        return 1;
    }
    else {
        return 0;
    }
}

function runTimers(initialArray) {
    var i, cnt, rtVal,
        objectArray, removeArray,
        start, stop,
        clouder;

    objectArray = initialArray[0];
    removeArray = initialArray[1];
    clouder = initialArray[2];

    if(clouder.terminated === true) {
        process.exit(0);
    }

    if(typeof(objectArray) === 'undefined') {
        return;
    }

    start = new Date().getTime();
    cnt = 0;
    for(i = 0; i < objectArray.list.length; i++) {
        if(typeof(objectArray.list[i].obj) !== 'undefined' && typeof(objectArray.list[i].obj.run) === 'function') {
            rtVal = objectArray.list[i].obj.run(objectArray.list[i].id);
            if(rtVal === -1) {
                removeArray.push(objectArray.list[i].id.toString());
                objectArray.list.removeElement(objectArray.list[i]);
            }
            else if(objectArray.list[i].toMove === true) {
                removeArray.push(objectArray.list[i].id.toString());
                objectArray.list.removeElement(objectArray.list[i]);
            }
            cnt++;
        }
    }
    stop = new Date().getTime();
    objectArray.lastOp = cnt;
    totalOps += cnt;
    totalTime += (stop - start);
}

function clearTimers(object) {
    var timer, timerObj, i;

    if(object.terminated === true) {
        process.exit(0);
    }

    for(timer in object.timers) {
        if (object.timers.hasOwnProperty(timer)) {
            timerObj = object.timers[timer];
            if(timerObj.lastOp === 0) {
                clearInterval(timerObj.interval);
                object.timers.removeElement(timerObj);
            }
        }
    }

    for(i = 0; i < object.removeTimers.length ; i++) {
        object.removeElementFromPool(object.removeTimers[i]);
    }

    object.removeTimers.length = 0;

    object.score = Math.ceil(totalOps * 0.7 + totalTime * 0.6);
    console.log("Total runs : " + totalOps + " in total time : " + totalTime + " ms -> with score of " + object.score);
    totalOps = 0;
    totalTime = 0;
}


function calculateOptimalScore(scores) {
    var i, totalScore = 0;
    for(i = 0 ; i < scores.length; i++) {
        totalScore += scores[i];
    }

    if(scores.length > 0) {
        return Math.ceil(totalScore / scores.length);
    }
    else {
        return 0;
    }
}

function getNumberOfItemsToBalance(size, avgScore, actualScore) {
    //Aproach a smarter function
    var itemsAmount = 0;

    //assure that we are not working with 0 values
    if(avgScore > 0 && size > 0) {
        itemsAmount = Math.ceil((actualScore - avgScore) / Math.ceil(avgScore / size));
        return itemsAmount;
    }

    //falback we don't balance anything
    return 0;
}

function getAndMarkItem(timers) {
    var i, j;
    for(i in timers) {
        if(timers.hasOwnProperty(i)) {
            for(j = 0 ; j < timers[i].list.length; j++) {
                if(typeof(timers[i].list[j].toMove) === 'undefined') {
                    timers[i].list[j].toMove = true;
                    return [timers[i].list[j].obj,i];
                }
            }
        }
    }
    return null;
}

function distributeItems(peers, timers, optimalScore, scorePerItem, itemsToMove, socket) {
    var i,j,
        peerScore,
        diffScore,
        item,
        itemString,
        itemsWouldFit,
        transportedObj;

    //Nothing to move, don't bother
    if(itemsToMove <= 0) {
        return;
    }

    //calculate alocation to peers
    for(i = 0 ; i < peers.length; i++) {
        peerScore = peers[i].score;
        diffScore = optimalScore - peerScore;
        if(diffScore > 0 && itemsToMove > 0) {
            itemsWouldFit = Math.ceil(diffScore / scorePerItem);
            if(itemsWouldFit > itemsToMove) {
                itemsWouldFit = itemsToMove;
            }
            peers[i].toMove = itemsWouldFit;
            itemsToMove -= itemsWouldFit;
        }
    }

    //pick the fastest items to run and move them
    for(i = 0 ; i < peers.length; i++) {
        itemsWouldFit = peers[i].toMove;
        peers[i].toMove = 0;
        for(j = 0 ; j < itemsWouldFit; j++) {
            item = getAndMarkItem(timers);
            if(item !== null) {
                console.log("Moving item to " + peers[i].id);
                transportedObj = {
                    obj     :   item[0],
                    timer   :   item[1],
                    did     :   peers[i].id
                };
                itemString = serializer.stringify(transportedObj);
                socket.sendOperational("moveItem",itemString,false);
            }
        }
    }
}

function balanceSelf(self) {
    var i,
        scores,
        optimalScore,
        ourScoreDiff,
        itemsToMove,
        scorePerItem;

    if(self.terminated === true) {
        process.exit(0);
    }

    scores = [];
    for(i = 0 ; i < self.peers.length ; i++) {
        scores.push(self.peers[i].score);
    }
    scores.push(self.score);

    optimalScore = calculateOptimalScore(scores);
    //we are not alone
    if(optimalScore > 0) {
        ourScoreDiff = self.score - optimalScore;
        //We need to balance our load to others, because our difference is larger than 50% of the optimal value, providing a stabler load balancing
        if(ourScoreDiff > Math.ceil(optimalScore * 0.5)) {
            itemsToMove = getNumberOfItemsToBalance(self.pool.length, optimalScore, self.score);
            scorePerItem = Math.ceil(self.score / self.pool.length);
            distributeItems(self.peers, self.timers, optimalScore, scorePerItem, itemsToMove, self);
        }
    }
}

function guidGenerator() {
    var S4 = function() {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function obidGenerator() {
    var S4, now;
    S4 = function() {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    now = new Date().getTime();
    return now + "-" + S4();
}

function Clouder(port, group, config) {
    var hasPool = false,
        timeout = 5000,
        balance = 10000,
        heartbeat = 2000,
        hasEncryption = false,
        encryptionKey = '12345';

    if(typeof(config) !== "undefined") {
        //set config values
        if(typeof(config.hasPool) === 'boolean') {
            hasPool = config.hasPool;
        }
        if(typeof(config.timeout) === 'number') {
            timeout = config.timeout;
        }
        if(typeof(config.balance) === 'number') {
            balance = config.balance;
        }
        if(typeof(config.heartbeat) === 'number') {
            heartbeat = config.heartbeat;
        }
        if(typeof(config.hasEncryption) === 'boolean') {
            hasEncryption = config.hasEncryption;
        }
        if(typeof(config.encryptionKey) === 'string') {
            encryptionKey = config.encryptionKey;
        }
    }

    this._hasPool = hasPool;
    this._timeout = timeout;
    this._balance = balance;
    this._heartbeat = heartbeat;
    this._hasEncription = hasEncryption;
    this._encryptionKey = encryptionKey;
    this.id = guidGenerator();
    this.port = port;
    this.group = group;
    this.score = 0;
    this.socket = dgram.createSocket("udp4");
    this.peers = [];
    if(this._hasPool === true) {
        this.pool = [];
        this.timers = [];
        this.removeTimers = [];
        setInterval(clearTimers, this._timeout, this);
        setInterval(balanceSelf, this._balance, this);
    }
    this.terminated = false;
    return this;
}

util.inherits(Clouder, events);

Clouder.prototype.connect = function () {
    var self = this;
    this.socket.bind(this.port);
    this.socket.setBroadcast(true);
    this.socket.setMulticastTTL(5);

    this.sendHeartbeat = function (obj) {
        obj.sendOperational("heartbeat", obj.score);
    };

    setInterval(this.sendHeartbeat, this._heartbeat, this);
    //noinspection JSUnresolvedFunction
    this.on("heartbeat", function (data) {
        var sid, score;

        sid = data[1];
        score = data[0];

        if(sid === self.id) {
            self.cleanPeer();
        }
        else {
            self.trackPeer(sid,score);
        }
    });

    this.on("moveItem", function (data) {
        var obj, timer;

        obj = data[0];
        timer = data[1];

        self.addElementToPool(obj, timer);
    });

    this.trackPeer = function(id, score) {
        var now, i;
        now = new Date().getTime();
        for(i = 0; i < this.peers.length; i++) {
            if(this.peers[i].id.toString() === id.toString()) {
                this.peers[i].lastSeen = now;
                this.peers[i].score = score;
                return;
            }
        }
        this.peers.push({
            id      :   id,
            lastSeen:   now,
            score   :   score
        });
        this.peers.sort(sortPeers);
        //noinspection JSUnresolvedFunction
        this.emit("newPeer", id);
    };

    this.cleanPeer = function() {
        var i, now;
        now = new Date().getTime();

        for(i = 0 ; i < this.peers.length; i++) {
            if(this.peers[i].lastSeen < now - 5000) {
                this.emit("lostPeer", this.peers[i].id);
                this.peers.removeElement(this.peers[i]);
            }
        }
    };

    //noinspection JSUnresolvedFunction
    this.socket.on('message', function (buf) {
        var msg, bodyParser,
            mode, dataBytes, dataDecripted;
        try {
            if(self._hasEncription === true) {
                mode = new crypto.mode.ECB(crypto.pad.pkcs7);
                dataBytes = crypto.util.hexToBytes(buf.toString());
                dataDecripted = crypto.DES.decrypt(dataBytes, self._encryptionKey, {asBytes: true, mode: mode});
                buf = crypto.charenc.UTF8.bytesToString(dataDecripted);
            }
            msg = serializer.parse(buf);
            if(typeof(msg.type) === 'undefined' || typeof(msg.title) === 'undefined' || typeof(msg.body) === 'undefined') {
                return;
            }

            if(msg.type === 1) {
                if(msg.title.toString() === "heartbeat") {
                    //noinspection JSUnresolvedFunction
                    self.emit("heartbeat", [msg.body,msg.sid]);
                }
                else if(msg.title.toString() === "moveItem") {
                    bodyParser = serializer.parse(msg.body);
                    if(bodyParser.did.toString() === self.id.toString()) {
                        console.log("Received item from : " + msg.sid);
                        //noinspection JSUnresolvedFunction
                        self.emit("moveItem", [bodyParser.obj, bodyParser.timer]);
                    }
                }
            }
            else if(msg.type === 2) {
                if(msg.bounce === true) {
                    //noinspection JSUnresolvedFunction
                    self.emit(msg.title, [msg.body, msg.sid]);
                }
                else {
                    if(msg.sid.toString() !== self.id.toString()) {
                        self.emit(msg.title, [msg.body, msg.sid]);
                    }
                }
            }
        }
        catch(Exception) {
            console.log(Exception);
        }
    });

    this.sendOperational = function (title, message, bounce) {
        var mode, dataBytes, dataEncripted;
        if(typeof(bounce) === 'undefined') {
            bounce = true;
        }
        var messageBuffer, msg = {
            sid     :   this.id,
            bounce  :   bounce,
            type    :   1,
            title   :   title,
            body    :   message
        };
        try {
            if(this._hasEncription === true) {
                mode = new crypto.mode.ECB(crypto.pad.pkcs7);
                dataBytes = crypto.charenc.UTF8.stringToBytes(serializer.stringify(msg));
                dataEncripted = crypto.DES.encrypt(dataBytes, this._encryptionKey, {asBytes: true, mode: mode});
                messageBuffer = new Buffer(crypto.util.bytesToHex(dataEncripted).toString());
            }
            else {
                messageBuffer = new Buffer(serializer.stringify(msg));
            }
        }
        catch(Exception) {
            throw "Message to complex to be sent";
        }
        this.socket.send(messageBuffer, 0, messageBuffer.length, this.port, this.group);
    };

    this.send = function (title, message, self) {
        var mode, dataBytes, dataEncripted;
        if(typeof(self) === 'undefined') {
            self = false;
        }

        var messageBuffer, msg = {
            sid     :   this.id,
            bounce  :   self,
            type    :   2,
            title   :   title,
            body    :   message
        };
        try {
            if(this._hasEncription === true) {
                mode = new crypto.mode.ECB(crypto.pad.pkcs7);
                dataBytes = crypto.charenc.UTF8.stringToBytes(serializer.stringify(msg));
                dataEncripted = crypto.DES.encrypt(dataBytes, this._encryptionKey, {asBytes: true, mode: mode});
                messageBuffer = new Buffer(crypto.util.bytesToHex(dataEncripted));
            }
            else {
                messageBuffer = new Buffer(serializer.stringify(msg));
            }
        }
        catch(Exception) {
            throw "Message to complex to be sent";
        }
        this.socket.send(messageBuffer, 0, messageBuffer.length, this.port, this.group);
    };

    /**
     * The pool system
     */

    this.addElementToPool = function(object, runtimeFreq) {
        if(typeof(this.pool) === 'undefined') {
            throw 'Pool system is not activated in this object';
        }
        var obId, obContainer, obPool;

        obId = obidGenerator();
        obContainer = {
            obj     :   object,
            id      :   obId,
            timer   :   runtimeFreq
        };

        if(typeof(this.timers[runtimeFreq]) === 'undefined') {
            this.timers[runtimeFreq] = {
                list    :   [],
                interval:   null,
                lastOp  :   -1
            };
            this.timers[runtimeFreq].list.push(obContainer);
            this.timers[runtimeFreq].interval = setInterval(runTimers, runtimeFreq, [this.timers[runtimeFreq], this.removeTimers, this]);
        }
        else {
            this.timers[runtimeFreq].list.push(obContainer);
        }
        if(typeof(object.start) === 'function') {
            object.start();
        }

        obPool = {
            id      :   obId,
            timer   :   runtimeFreq
        };
        this.pool.push(obPool);
    };

    this.removeElementFromPool = function (obId) {
        if(typeof(this.pool) === 'undefined') {
            throw 'Pool system is not activated in this object';
        }

        var i, fObPool;

        for(i = 0 ; i < this.pool.length; i++) {
            fObPool = this.pool[i];
            if(fObPool.id.toString() === obId.toString()) {
                this.pool.removeElement(fObPool);
                return;
            }
        }
    };

    process.on('SIGINT', function () {
        distributeDataToCloud(self);
    });

    process.on('SIGHUP', function () {
        distributeDataToCloud(self);
    });

    process.on('SIGQUIT', function () {
        distributeDataToCloud(self);
    });
};

exports.Clouder = Clouder;