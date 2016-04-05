/*jshint esversion: 6 */
var mysql = require('mysql');
var Datastore = require('nedb'),
    db = {};

db.users = new Datastore({filename: 'db/users.db', autoload: true });
db.movies = new Datastore({filename: 'db/movies.db', autoload: true });
db.recommendations = new Datastore({filename: 'db/recommendations.db', autoload: true });

db.users.ensureIndex({ fieldName: 'facebook_id', unique: true}, function (err) {
  if (err) throw err;
});

db.movies.ensureIndex( {fieldName: 'movie_id', unique: true}, function (err) {
  if (err) throw err;
});


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
var userMovies = [];

var pool = mysql.createPool({
  host: 'localhost',
  user: 'sec_user',
  password: 'titan123',
  database: 'secure_login'
});


pool.query = function() {
  var queryArgs = Array.prototype.slice.apply(arguments);
  if (queryArgs.length < 1 || queryArgs.length > 3) throw "Wrong number of args";

  var query = queryArgs[0];
  var post = queryArgs.length > 2 ? queryArgs[1] : [];
  var callback = queryArgs[queryArgs.length - 1];

  this.getConnection(function(err, connection) {
    if (err) throw err;
    connection.query(query, post, function(err, results) {
      connection.release();
      callback(err, results);
    });
  });
};


db.movies.find( {} , function (err, docs) {
  console.log("MOVVIIESSSSSSSSSSSSSSS");
  console.log(docs);
  movies = docs;
});

pool.query('SELECT * FROM movies', function(err, rows, fields) {
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
    picture: user.picture,
    movies: []
  };

  db.users.findOne({ facebook_id : user.id }, function (err, doc) {
    if (err) throw err;
    console.log(doc);
    if (!doc || doc.length < 1) {
      db.users.insert(post);
      user = post;
    } else {
      user = doc;
    }
    socket.emit('setUser', user);
  });
  // pool.query('SELECT movies.* FROM movies, user_movies WHERE user_movies.user_id = ' + user.id + ' AND user_movies.movie_id = movies.movie_id', function(err, rows, fields) {
  //   if (err) throw err;
  //   if (rows.length < 1) {
  //     pool.query('INSERT IGNORE INTO users SET ?', post, function(err, rows, fields) {
  //       if (err) throw err;
  //     });
  //   } else {
  //     rows.forEach(function(row) {
  //       var movie = {
  //         movie_id: row.movie_id,
  //         title: row.title,
  //         poster_url: row.poster_url
  //       };
  //       user.movies.push(movie);
  //     });
  //     console.log(user);
  //   }
  //
  //   socket.emit('setUser', user);
  // });
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
    player.roundScore = 0;
    player.streak = 0;
    player.socket = this.id;
    player.availableMovies = possibleMovies(player.movieList);
    this.emit('loadAssets', player.availableMovies);
    players.push(player);
  }
  if (players.length === 2) {
    io.sockets.emit('startGame');
    timer = setInterval(function() {
      time++;
      if (time >= 3 * 60) {
        clearInterval(timer);
        gameOver();
      }
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
  if (!suggested[assignedTo][movie].some(function(collaborator) {
      return assignedBy.username === collaborator.username;
    })) {
    suggested[assignedTo][movie].push(assignedBy);
  }
}

function updateScore(assignedTo, assignedBy, movie) {
  console.log(assignedTo.username);
  var score = 0;
  if (assignedTo.movieList.some(function(userMovie) {
      return userMovie.movie_id === movie;
    })) {
    score = 10;
    score +=
      score * (Math.min(joinedPlayers[assignedBy.username].streak, 6) / 3);
    score = Math.round(score);
    assignedBy.emit('updateScore', {
      score: score
    });

    joinedPlayers[assignedBy.username].roundScore += score;
    joinedPlayers[assignedBy.username].score += score;
    joinedPlayers[assignedBy.username].streak += 1;
  } else {
    //TODO make scoring system better
    //multipliers, bonuses, etc.
    addCollaborator(assignedTo.username, assignedBy, movie);
    var collaborators = suggested[assignedTo.username][movie];
    if (collaborators.length > 1) {
      for (var i = 0; i < collaborators.length; i++) {
        score = (collaborators.length - i + 1) * 10;
        score += score * (Math.min(joinedPlayers[collaborators[i].username].streak, 6) / 3);
        score = Math.round(score);

        joinedPlayers[collaborators[i].username].roundScore += score;
        joinedPlayers[collaborators[i].username].score += score;
        collaborators[i].emit('updateScore', {
          score: score,
        });
        joinedPlayers[collaborators[i].username].streak += 1;
      }
    } else {
      joinedPlayers[assignedBy.username].streak = 0;
    }
  }
  sendLeaderboard();
}

function roundFinished(userData) {
  console.log(userData);
  console.log('playersFinished = ' + playersFinished);
  console.log('playerLen = ' + players.length);
  playersFinished++;
  var score = joinedPlayers[userData.username].roundScore;
  score = Math.round(score * (userData.time / 10));
  this.emit('updateScore', {
    score: score
  });

  joinedPlayers[userData.username].score += score;
  joinedPlayers[userData.username].roundScore = 0;
  sendLeaderboard();

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

  //TODO record all the events
  joinedPlayers = {};
  suggested = {};
}

function shakeCard(card) {
  console.log(card);
  io.sockets.emit('shakeCard', card.username, card.index, card.remove);
}

function addMovie(movie) {
  var user_movie = {
    user_id: movie.user_id,
    movie_id: movie.id
  };
  var database_movie = {
    movie_id: movie.id,
    title: movie.title,
    poster_url: movie.poster_path,
    rating: movie.vote_average,
    rating_count: movie.vote_count
  };

  console.log(user_movie);
  console.log(database_movie);

  db.users.update({ facebook_id : movie.user_id }, { $addToSet: { movies: database_movie } });
  db.movies.insert(movie, function (err) {
    if (err.errorType != 'uniqueViolated') throw err;
  });
  // pool.query('SELECT movie_id FROM user_movies WHERE movie_id = ' + movie.id + ' AND user_id = ' + movie.user_id,
  //   function(err, rows, fields) {
  //     if (err) throw err;
  //     if (rows.length < 1) {
  //       pool.query('INSERT IGNORE INTO user_movies SET ?', user_movie, function(err, rows, fields) {
  //         if (err) throw err;
  //       });
  //     }
  //   });
  //
  // pool.query('INSERT IGNORE INTO movies SET ?', database_movie, function(err, rows, fields) {
  //   if (err) throw err;
  // });

}

function removeMovie(movie, id) {
  db.users.update({ facebook_id : id }, { $pull: { movies: movie } });
  // pool.query('DELETE FROM user_movies WHERE user_id = ' + movie.user_id + ' AND movie_id = ' + movie.movie_id, function(err, rows, fields) {
  //   if (err) throw err;
  //   console.log(movie.title + " deleted");
  // });
}
