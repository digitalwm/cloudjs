# About.
 It is Node JS module that will provide network distributed events. It uses UDP broadcast for sending it's useful data.

# Changelog
<br/>
v 0.0.3 - Added linux signal interception. When closed with signal SIGINT, SIGHUP and SIGQUIT the module distributes all its pool objects to all the remaining nodes in equal portions.<br/>
v 0.0.4 - Added encryption to events sent on the network. This can be switched on and off. Uses DES encryption method.<br/>
v 0.0.8 - Manage to fix the package.json with a proper forma. Added also special events that once emited they wait for a reply by providing a callback and a timeout. When the timeout is reached the callback is removed from the watch list. This events are non-blocking.<br/>
v 0.0.9 - All user generated events, are calling the assigned call back with two parameters (data and the ID of the event emiter instance)
<br/>
# Features

 This module is build upon Node JS and provides for the user the following features

* A network distributed event system. Similar to node JS standard event system
* A process pool, where objects can be added and ran at a periodic interval a predefined functions.
* An auto-balancing system, that migrate objects in the process pool, from one running instance to another, based on the load of each instance.

# How to use it?
 npm install cloudjs

# Configuration & Examples?
 For this check the example.js file

# Explenations?
 More and an updated documentation and explanations can be found at http://dan.harabagiu.net/cloudjs.

# Enjoy it, and drop me a line if you like it