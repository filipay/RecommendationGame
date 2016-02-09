var mysql = require('mysql');
var http = require('http');

var io;
var gameSocket;
var players = [];
var suggested = {};
var movies = [];


var uri = 'www.omdbapi.com/?i={movieid}&type=movie&plot=short&tomatoes=true';

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'sec_user',
    password: 'titan123',
    database: 'secure_login'
});

connection.connect();

connection.query('SELECT * FROM movies', function(err, rows, fields) {
    if (err) throw err;

    rows.forEach(function(row) {
        movies.push(row);
    });
    // console.log(movies);
});

connection.end();

exports.initGame = function(s_io, socket) {
    "use strict";
    io = s_io;
    gameSocket = socket;

    gameSocket.on('joinGame', playerConnect);
    gameSocket.on('assignCard', cardAssigned);
    gameSocket.on('disconnect', playerDisconnect);
    gameSocket.on('outOfCards', outOfCards);

};

function possibleMovies(player_movies) {
    var possibleMovies = [];
    movies.forEach(function(m) {
        if (!player_movies.some(function(elem) {
                return elem.movie_id === m.movie_id;
            })) {
            possibleMovies.push(m);
        }
    });
    return possibleMovies;
}


function playerConnect(player) {
    console.log(player.username + " connected");
    if (players.indexOf(player) < 0) {
        player.socket = this.id;
        player.availableMovies = possibleMovies(player.movieList);
        players.push(player);
        // players[player.socket] = player;
        console.log(players);
        // io.sockets.emit('createPile', suggested);
        io.sockets.emit('playerJoined', players);
        this.emit('loadAssets', player.availableMovies);
    } else {
        console.log("this player already exists");
    }

}

function playerDisconnect() {
    // var player = players[this.id];
    // if (player) {
    //     console.log(player.username + ' disconnected!');
    //     player = undefined;
    //     io.sockets.emit('playerJoined', players);
    // }

    var disconnected = this.id;
    // console.log(disconnected);
    players.forEach(function(player) {
        if (player.socket === disconnected.id) {
            disconnected = player;
        }
    });
    console.log(disconnected);

    players.splice(disconnected, 1);
    console.log('player len = ' + players.length);
    io.sockets.emit('playerJoined', players);
}


function cardAssigned(data) {
    console.log(data);
    var assignedPlayer;

    players.forEach(function(player) {
        if (player.username === data.assignedTo) {
            assignedPlayer = player;
        }
    });

    updateScore(assignedPlayer, this, data.movie_id);
    var chosen_movie = getMovie(data.movie_id);
    // console.log(chosen_movie);

    console.log(suggested);
    console.log(chosen_movie);
    io.sockets.emit('placeOnPile', chosen_movie);
}

function getMovie(movie_id) {
    var movie;
    movies.forEach(function(m) {
        if (m.movie_id === movie_id) {
            movie = m;
        }
    });
    return movie;
}

function addCollaborator(assignedTo, assignedBy, movie) {
    suggested[assignedTo] = suggested[assignedTo] || {};
    suggested[assignedTo][movie] = suggested[assignedTo][movie] || [];
    suggested[assignedTo][movie].push(assignedBy);
}

function updateScore(assignedTo, assignedBy, movie) {
    if (assignedTo.movieList.some(function(movie) {
            return movie.movie_id === movie;
        })) {
        console.log('MATCH FOUND');
        assignedBy.emit('updateScore', {
            score: 10
        });
    } else {
        addCollaborator(assignedTo, assignedBy, movie);
        var collaborators = suggested[assignedTo][movie];
        for (var i = 0; i < collaborators.length - 1; i++) {
            collaborators[i].emit('updateScore', {
                score: (collaborators.length - i + 1) * 10
            });
        }

    }
}

function outOfCards() {

}
