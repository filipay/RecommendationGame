var express = require('express');
var path = require('path');

var app = express();

var game = require('./app');

app.use(express.static(path.join(__dirname,'public'), {
  extensions: ['html']
}));

var server = require('http').createServer(app).listen(process.env.PORT || 8080);
var io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {
    "use strict";
    game.initGame(io, socket);
});
