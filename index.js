/**

Simple script to set up the backend

**/

//Import relevant libraries
var express = require('express');
var path = require('path');

var app = express();

var game = require('./app');

//Use the html extensions
app.use(express.static(path.join(__dirname,'public'), {
  extensions: ['html']
}));

//Bind server to port 8080 if default is not available
var server = require('http').createServer(app).listen(process.env.PORT || 8080);
var io = require('socket.io').listen(server);

//Handle connections through the game backend
io.sockets.on('connection', function (socket) {
    "use strict";
    game.initGame(io, socket);
});
