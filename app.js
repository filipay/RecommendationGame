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
    gameSocket.on('requestLeaderboard', sendLeaderboard);
    gameSocket.on('userHand', userHand);
    gameSocket.on('requestResetTime', resetTime);
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
        this.emit('resume', joinedPlayer);
        players.push(joinedPlayer);
    } else {
        joinedPlayers[player.username] = player;
        player.socket = this.id;
        player.availableMovies = possibleMovies(player.movieList);
        this.emit('loadAssets', player.availableMovies);
        players.push(player);
    }
    io.sockets.emit('startTime');

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

    var disconnected = this.id;

    players.some(function(player) {
        if (player.socket === disconnected) {
            return (disconnected = player);
        }
        return false;
    });

    players.splice(players.indexOf(disconnected), 1);

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
    this.username = data.assignedBy;
    updateScore(assignedPlayer, this, data.movie_id);
    var chosen_movie = getMovie(data.movie_id);
    pile.push(chosen_movie);
    // console.log(chosen_movie);

    // console.log(suggested);
    // console.log(chosen_movie);
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
        joinedPlayers[assignedBy.username].score += 10;
        assignedBy.emit('updateScore', {
            score: 10
        });
    } else {
      //TODO make scoring system better
      //multipliers, bonuses, etc.
        addCollaborator(assignedTo, assignedBy, movie);
        var collaborators = suggested[assignedTo][movie];
        if (collaborators.length > 1) {
          for (var i = 0; i < collaborators.length; i++) {
              var score = (collaborators.length - i + 1) * 10;
              // console.log('================COLLABORATOR=================');
              // console.log(collaborators[i]);
              joinedPlayers[collaborators[i].username].score += score;
              collaborators[i].emit('updateScore', {
                  score: score,
              });
          }
        }
    }
    sendLeaderboard();
}

function outOfCards() {
    console.log('playersFinished = ' + playersFinished);
    console.log('playerLen = ' + players.length);
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

function sendLeaderboard() {
    // var sortedPlayers = players.slice().sort(function (p1, p2) {
    //   return p1.score - p2.score;
    // });
    var leaderboard = [];
    for (var player in joinedPlayers) {
      if (joinedPlayers.hasOwnProperty(player)) {
        var score = {
          name: joinedPlayers[player].name,
          score: joinedPlayers[player].score
        };
        leaderboard.push(score);
      }
    }
    leaderboard.sort(function (p1, p2) {
      return p2.score - p1.score;
    });
    io.sockets.emit('updateLeaderboard', leaderboard);

}

function userHand(username, cards) {
    joinedPlayers[username].cards = cards;
}

function resetTime() {
  io.sockets.emit('startTime');
}
