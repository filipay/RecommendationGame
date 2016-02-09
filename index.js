var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var game = require('./app');

server.listen(3000);

io.sockets.on('connection', function (socket) {
    "use strict";
    game.initGame(io, socket);
});
