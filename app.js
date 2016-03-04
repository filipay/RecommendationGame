var mysql = require('mysql');
var http = require('http');

var io;
var gameSocket;
var joinedPlayers = {};
var players = [];
var suggested = {};
var movies = [];
var pile = [];
var playersFinished = 0;

//
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
    gameSocket.on('gameSize', amountOfPlayers);
    gameSocket.on('requestPile', sendPile);
    gameSocket.on('requestTable', sendTable);
    gameSocket.on('userHand', userHand);

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

function amountOfPlayers() {
    console.log('amountOfPlayers called: ' + players.length);
    this.emit('gameSize', players.length);
}

function playerConnect(player) {
    var joinedPlayer = joinedPlayers[player.username];
    if (joinedPlayer) {
        this.emit('loadAssets', joinedPlayer.availableMovies);
        this.emit('resume', joinedPlayer.cards);
        players.push(joinedPlayer);
    } else {
        joinedPlayers[player.username] = player;
        player.socket = this.id;
        player.availableMovies = possibleMovies(player.movieList);
        this.emit('loadAssets', player.availableMovies);
        players.push(player);
    }


    // if (players.indexOf(player) < 0) {
    //
    //     // players[player.socket] = player;
    //     console.log(players);
    //     // io.sockets.emit('createPile', suggested);
    // } else {
    //     console.log("this player already exists");
    // }

}



function playerDisconnect() {
    // var player = players[this.id];
    // if (player) {
    //     console.log(player.username + ' disconnected!');
    //     player = undefined;
    //     io.sockets.emit('playerJoined', players);
    // }
    console.log(players);
    var disconnected = this.id;
    console.log("disconnected id " + disconnected);
    // console.log(this);

    // console.log(disconnected);
    players.some(function(player) {
        if (player.socket === disconnected) {
            return (disconnected = player);
        }
        return false;
    });
    console.log('==========================================');
    console.log(disconnected);

    players.splice(players.indexOf(disconnected), 1);
    console.log(players);
    io.sockets.emit('playerJoined', players);
}


function cardAssigned(data) {
    console.log(data);

    var cards = joinedPlayers[data.assignedBy].cards;
    cards.forEach(function (card) {
        if (card.movie_id == data.movie_id) {
            cards.splice(cards.indexOf(card),1);
        }
    });

    var assignedPlayer;

    players.forEach(function(player) {
        if (player.username === data.assignedTo) {
            assignedPlayer = player;
        }
    });

    updateScore(assignedPlayer, this, data.movie_id);
    var chosen_movie = getMovie(data.movie_id);
    pile.push(chosen_movie);
    // console.log(chosen_movie);

    console.log(suggested);
    console.log(chosen_movie);
    io.sockets.emit('placeOnPile', [chosen_movie]);
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
    if (assignedTo.movieList.some(function(userMovie) {
            return userMovie.movie_id === movie;
        })) {
        console.log('MATCH FOUND');
        assignedBy.emit('updateScore', {
            score: 10
        });
    } else {
      //TODO make scoring system better
      //multipliers, bonuses, etc.
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
    console.log('playersFinished = ' + playersFinished);
    playersFinished++;
    if (playersFinished == players.length) {
        console.log('newROUND!!!!');
        pile = [];
        io.sockets.emit('newRound');
        playersFinished = 0;
    }

}

function sendPile() {
    this.emit('placeOnPile', pile);
}

function sendTable() {
    io.sockets.emit('playerJoined', players);
}

function userHand(username, cards) {
    joinedPlayers[username].cards = cards;
}
