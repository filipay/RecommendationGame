var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);


server.listen(3000);

io.sockets.on('connection', function (socket) {
    "use strict";
    console.log("user connected");
    socket.on('disconnect', function () {
        console.log("user disconnected");
    });
});
