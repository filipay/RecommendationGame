var mysql = require('mysql');
var http = require('http');

var io;
var gameSocket;
var players = [];

var uri = 'www.omdbapi.com/?i={movieid}&type=movie&plot=short&tomatoes=true';

var connection = mysql.createConnection({
  host: 'localhost',
  user: 'sec_user',
  password: 'titan123',
  database: 'secure_login'
});

connection.connect();

var movies = [];
connection.query('SELECT * FROM movies', function(err, rows, fields) {
  if (err) throw err;

  rows.forEach(function(row) {
    movies.push(row);
  });
  // console.log(movies);
});

exports.initGame = function(s_io, socket) {
  "use strict";
  io = s_io;
  gameSocket = socket;

  gameSocket.on('newPlayer', newPlayer);
  gameSocket.on('assignCard', cardAssigned);
  gameSocket.on('disconnect', playerDisconnected);

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


function newPlayer(player) {
  console.log(player.username + " connected");
  if (players.indexOf(player) < 0) {
    player.socket = this.id;
    player.availableMovies = possibleMovies(player.movieList);
    players.push(player);
    // console.log(players);
    io.sockets.emit('playerJoined', players);
    this.emit('loadAssets', player.availableMovies);
  } else {
    console.log("this player already exists");
  }

}

function playerDisconnected() {

  var disconnected = this.id;
  console.log(disconnected);
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

  if (assignedPlayer.movieList.some(function(movie) {
      return movie.movie_id === data.movie;
    })) {
    console.log('MATCH FOUND');
    this.emit('updateScore', {
      score: 10
    });
  }
  var chosen_movie = getMovie(data.movie);
  // console.log(chosen_movie);
  io.sockets.emit('placeOnPile', chosen_movie);
}

function getMovie(movie_id) {
  var movie;
  movies.forEach(function (m) {
    if (m.movie_id === movie_id) { movie = m; }
  });
  return movie;
}
