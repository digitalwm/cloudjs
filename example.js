/**
 * Created by Dan Harabagiu
 * Date: 2/17/12
 * Time: 3:09 PM
 */

var cloud,
    numberOfObjects = 3,
    i,
    cloudConfig;

cloud = require("./cloudjs.js");

cloudConfig = {
    hasPool         :   true,
    timeout         :   3000,
    balance         :   20000,
    hasEncryption   :   true,
    encryptionKey   :   '12345'
};

var myObject = new cloud.Clouder(11211, "255.255.255.255", cloudConfig);
myObject.connect();

/*
    Object pool
 */

function guidGenerator() {
    var S4 = function() {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+"-"+S4());
}

function Ob1(id) {
    this.oid = id;
    this.start = function() {
        console.log("+" + this.oid);
    };
    this.run =function(id) {
        console.log(this.oid);
    };
}

for(i = 0 ; i < numberOfObjects ; i++) {
    myObject.addElementToPool(new Ob1(guidGenerator()), 5000);
}

/*
    Event fire and forget
 */

myObject.on("test", function(data, sid) {
    console.log("received " + data + " from " + sid);
});

myObject.send("test","test2");

/*
    Event with callbacks
 */

function mesgCallback1(data, sid) {
    console.log("Received callback from " + sid + ", time to return data");
    return "test" + sid;
}

function mesgCallback2(data, sid) {
    console.log("Received reply on event : " + data + " from "  + sid);
}

myObject.onWithReply("sendReply", mesgCallback1);
myObject.sendWithCallback("sendReply", "blah", mesgCallback2, 3000);
