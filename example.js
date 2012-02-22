/**
 * Created by JetBrains WebStorm.
 * User: dan
 * Date: 2/17/12
 * Time: 3:09 PM
 * To change this template use File | Settings | File Templates.
 */

var cloud,
    numberOfObjects = 3,
    addEveryXSeconds = 2;

cloud = require("./cloudjs.js");

var myObject = new cloud.Clouder(11211, "255.255.255.255", true);
myObject.connect();

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

var now = new Date().getTime();

function addShit() {
    var localNow = new Date().getTime();
    if(localNow - now < numberOfObjects * 1000) {
        myObject.addElementToPool(new Ob1(guidGenerator()), 5000);
    }
}

setInterval(addShit, addEveryXSeconds * 1000);