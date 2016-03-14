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
var timer;
var time = 0;
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

exports.initGame = function(s_io, socket) {
  io = s_io;
  gameSocket = socket;

  gameSocket.on('connected', getUser);
  gameSocket.on('joinGame', playerConnect);
  gameSocket.on('assignCard', cardAssigned);
  gameSocket.on('disconnect', playerDisconnect);
  gameSocket.on('roundFinished', roundFinished);
  gameSocket.on('gameSize', amountOfPlayers);
  gameSocket.on('requestPile', sendPile);
  gameSocket.on('requestTable', sendTable);
  gameSocket.on('requestLeaderboard', sendLeaderboard);
  gameSocket.on('userHand', userHand);
  gameSocket.on('requestResetTime', resetTime);
  gameSocket.on('getUser', getUser);
  gameSocket.on('shakeCard', shakeCard);
  gameSocket.on('addMovie', addMovie);
  gameSocket.on('removeMovie', removeMovie);

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

function getUser(user) {
  // var id = players.length + 2;
  console.log(user);
  var socket = this;
  user.movies = [];
  var post = {
    facebook_id: user.id,
    name: user.name,
    picture: user.picture
  };
  connection.query('SELECT movies.* FROM movies, user_movies WHERE user_movies.user_id = ' + user.id + ' AND user_movies.movie_id = movies.movie_id', function(err, rows, fields) {
    if (err) throw err;
    if (rows.length < 1) {
      connection.query('INSERT IGNORE INTO users SET ?', post, function(err, rows, fields) {
        if (err) throw err;
      });
    } else {
      rows.forEach(function(row) {
        var movie = {
          movie_id: row.movie_id,
          title: row.title,
          poster_url: row.poster_url
        };
        user.movies.push(movie);
      });
    }

    socket.emit('setUser', user);
  });
}

function playerConnect(player) {
  console.log(player);
  var joinedPlayer = joinedPlayers[player.username];
  if (joinedPlayer) {
    this.emit('loadAssets', joinedPlayer.availableMovies);
    this.emit('resume', joinedPlayer);
    players.push(joinedPlayer);
  } else {
    joinedPlayers[player.username] = player;
    player.socket = this.id;
    player.availableMovies = movies;
    this.emit('loadAssets', player.availableMovies);
    players.push(player);
  }
  if (players.length === 3) {
    io.sockets.emit('startGame');
    timer = setInterval(function() {
      time++;
    }, 1000);
  }
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
  clearInterval(timer);
}


function cardAssigned(data) {
  console.log(data);

  var cards = joinedPlayers[data.assignedBy].cards;
  cards.forEach(function(card) {
    if (card.movie_id == data.movie_id) {
      cards.splice(cards.indexOf(card), 1);
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
  console.log(assignedTo.username);
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
    addCollaborator(assignedTo.username, assignedBy, movie);
    var collaborators = suggested[assignedTo.username][movie];
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

    console.log(suggested);
    // for (var badname in suggested) {
    //   if (suggested.hasOwnProperty(badname)) {
    //     console.log(suggested[badname]);
    //   }
    // }
  }
  sendLeaderboard();
}

function roundFinished() {
  console.log('playersFinished = ' + playersFinished);
  console.log('playerLen = ' + players.length);
  playersFinished++;
  if (playersFinished == players.length) {
    console.log('newROUND!!!!');
    pile = [];
    io.sockets.emit('newRound');
    playersFinished = 0;
  }
  // io.sockets.emit('gameOver');
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
  leaderboard.sort(function(p1, p2) {
    return p2.score - p1.score;
  });
  io.sockets.emit('updateLeaderboard', leaderboard);

}

function userHand(username, cards) {
  if (cards.length === 0) {
    gameOver();
  }
  joinedPlayers[username].cards = cards;
}

function resetTime() {
  io.sockets.emit('startGame');
}

function gameOver() {
  io.sockets.emit('gameOver');
}

function shakeCard(card) {
  console.log(card);
  io.sockets.emit('shakeCard', card.username, card.index, card.remove);
}

function addMovie(movie) {
  console.log(movie);
  var user_movie = {
    user_id: movie.me.id,
    movie_id: movie.id
  };
  var database_movie = {
    movie_id: movie.id,
    title: movie.title,
    poster_url: movie.poster_path,
    rating: movie.vote_average,
    rating_count: movie.vote_count
  };
  connection.query('SELECT movie_id FROM user_movies WHERE movie_id = ' + movie.id + ' AND user_id = '+ movie.me.id ,
    function(err, rows, fields) {
      if (err) throw err;
      if (rows.length < 1) {
        connection.query('INSERT IGNORE INTO user_movies SET ?', user_movie, function(err, rows, fields) {
          if (err) throw err;
        });
      }
    });

  connection.query('INSERT IGNORE INTO movies SET ?', database_movie, function(err, rows, fields) {
    if (err) throw err;
  });

}

function removeMovie(movie) {
    console.log(movie);
}
