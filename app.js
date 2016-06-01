/*jshint esversion: 6 */
var extend = require('util')._extend;
var Datastore = require('nedb'),
    db = {}, autoCompact = 10 * 1000;

db.users = new Datastore({filename: 'db/users.db', autoload: true });
db.movies = new Datastore({filename: 'db/movies.db', autoload: true });
db.games = new Datastore({filename: 'db/games.db', autoload: true });


db.users.ensureIndex({ fieldName: 'facebook_id', unique: true}, function (err) {
  if (err) throw err;
});

db.movies.ensureIndex( {fieldName: 'id', unique: true}, function (err) {
  if (err) throw err;
});

db.games.ensureIndex( {fieldName: 'gameId', unique: true}, function (err) {
  if (err) throw err;
});

db.users.persistence.setAutocompactionInterval(autoCompact);
db.movies.persistence.setAutocompactionInterval(autoCompact);
db.games.persistence.setAutocompactionInterval(autoCompact);

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
var maxTime = 6 * 60;
var userMovies = [];
var maxPlayers = 3;
var recommendations = {};
var gameId;
var roundNo = 0;
var bin = {
  username: 0,
  name: 'bin',
  movieList: [],
  roundScore: 0
};
var gameStarted = false;
var deckSize = 60;
var readyPlayers = 0;

function updateMovies(callback) {
  db.movies.find( {} , function (err, docs) {
    movies = docs;
    callback();
  });
}


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
  gameSocket.on('setConfig', setConfig);
  gameSocket.on('playerReady', playerReady);
  gameSocket.on('fetchRecommendations', fetchRecommendations);
  gameSocket.on('updateRating', updateRating);
};


Array.prototype.shuffle = function () {
  var j, x, i;
  a = this;
  for (i = a.length; i; i -= 1) {
      j = Math.floor(Math.random() * i);
      x = a[i - 1];
      a[i - 1] = a[j];
      a[j] = x;
  }
};

Array.prototype.unique = function (array) {
  var set = {};
  this.forEach(function(movie) {
    set[movie.id] = movie;
  });
  array.forEach(function(movie) {
    if (set[movie.id]) {
      delete set[movie.id];
    }
  });
  return Object.keys(set).map(function(key) { return set[key]; });
};

function createDeck(size) {
  var deck = [];
  players.forEach(function (player) {
    deck.push.apply(deck, player.movieList.slice(0,15));
  });
  var randomMovies = movies.unique(userMovies);
  randomMovies.shuffle();
  deck.push.apply(deck, randomMovies.slice(0, size - deck.length));
  return deck;
}

function amountOfPlayers() {
  console.log('amountOfPlayers called: ' + players.length);
  this.emit('gameSize', players.length);
}

function getUser(user) {
  var socket = this;
  user.movies = [];
  var data = {
    facebook_id: user.id,
    name: user.name,
    picture: user.picture,
    movies: []
  };

  db.users.findOne({ facebook_id : user.id }, function (err, doc) {
    if (err) throw err;
    if (!doc || doc.length < 1) {
      db.users.insert(data);
      user = data;
    } else {
      user = doc;
    }
    socket.emit('setUser', user);
  });
}

function playerConnect(currPlayer) {
  // if(players.length < 1) updateMovies(); //TODO wait for movies to update
  var joinedPlayer = joinedPlayers[currPlayer.username];
  if (joinedPlayer) {
    this.emit('loadAssets', joinedPlayer.availableMovies);
    joinedPlayer.socket = this.id;
    this.emit('resume', joinedPlayer);
    players.push(joinedPlayer);
  } else {
    joinedPlayers[currPlayer.username] = currPlayer;
    currPlayer.roundScore = 0;
    currPlayer.streak = 0;
    currPlayer.socket = this.id;
    userMovies.push.apply(userMovies, currPlayer.movieList);
    // player.availableMovies = possibleMovies(player.movieList);
    // this.emit('loadAssets', player.availableMovies);
    players.push(currPlayer);
  }
  if (players.length === maxPlayers) {
    gameStarted = true;
    updateMovies(function () {
      gameId = Date.now();
      recommendations[gameId] = {};
      var deck = createDeck(deckSize);

      io.sockets.emit('loadAssets', deck);
      // player.availableMovies = movies; //TODO wait fo people to join to serve movies
    });
  } else {
    io.sockets.emit('updateWaitingScreen', {
      joinedUser: currPlayer.name,
      noPlayers: players.length,
      maxPlayers: maxPlayers
    });
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
  // clearInterval(timer);
  if (players.length === 0) gameOver();
  if (!gameStarted) io.sockets.emit('updateWaitingScreen', {
    joinedUser: '- ' + disconnected.name,
    noPlayers: players.length,
    maxPlayers: maxPlayers
  });
}


function cardAssigned(data) {
  console.log(data);

  var cards = joinedPlayers[data.assignedBy].cards;
  cards.forEach(function(card) {
    if (card === data.id) {
      cards.splice(cards.indexOf(card), 1);
    }
  });

  var assignedPlayer = joinedPlayers[data.assignedTo];

  // players.forEach(function(player) {
  //   if (player.username === data.assignedTo) {
  //     assignedPlayer = player;
  //   }
  // });


  this.username = data.assignedBy;

  if (data.assignedTo === bin.username) {
    checkBin(this, data.id);
  } else {
    updateScore(assignedPlayer, this, data.id);
    var chosen_movie = getMovie(data.id);
    pile.push(chosen_movie);
    io.sockets.emit('placeOnPile', [chosen_movie]);//
  }
}

function getMovie(id) {
  var movie;
  movies.forEach(function(m) {
    if (m.id === id) {
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

function checkBin(assignedBy, movie) {
  var recommendation = {};
  recommendation.known = false;
  var player = joinedPlayers[assignedBy.username];
  //Get movies of players (excluding current player)
  var movies = userMovies.unique(player.movieList);

  //Check if any movie in the set corresponds to a known movie of another player
  if (movies.some(function (m) {
    return m.id === movie;
  })) {
    recommendation.known = true;
    var score = -10;
    player.score += score;
    assignedBy.emit('updateScore', {
      score: score
    });
    showInfo(player.username, 'UNLUCKY!');
    sendLeaderboard();
  }
  recommendation.playerId = assignedBy.username;
  recommendation.friendId = bin.username;
  recommendation.movieId = movie;
  storePlayerInfo(recommendation);

}

function updateScore(assignedTo, assignedBy, movie) {
  console.log(assignedTo.username);
  var score = 0;
  var recommendation = {};
  if (assignedTo.movieList.some(function(userMovie) {
      return userMovie.id === movie;
    })) {
    recommendation.known = true;
    var player = joinedPlayers[assignedBy.username];

    score = 10;
    score +=
      score * (Math.min(player.streak, 6) / 3);
    score = Math.round(score);
    assignedBy.emit('updateScore', {
      score: score
    });

    if (player.streak > 0) {
      showInfo(player.username, 'STREAK x' + (player.streak + 1));
    }
    player.roundScore += score;
    player.score += score;
    player.streak += 1;
  } else {

    addCollaborator(assignedTo.username, assignedBy, movie);
    var collaborators = suggested[assignedTo.username][movie];

    if (collaborators.length > 1) {
      for (var i = 0; i < collaborators.length; i++) {
        var collaborator = joinedPlayers[collaborators[i].username];
        score = (collaborators.length - i + 1) * 10;
        score += score * (Math.min(collaborator.streak, 6) / 3);
        score = Math.round(score);

        collaborator.roundScore += score;
        collaborator.score += score;
        collaborators[i].emit('updateScore', {
          score: score,
        });
        if (collaborator.streak > 0) {
          showInfo(collaborator.username,
            'STREAK x' + (collaborator.streak + 1) + '\nCOLLABORATOR');
        } else {
          showInfo(collaborator.username, 'COLLABORATOR');
        }

        collaborator.streak += 1;

      }
    } else {
      joinedPlayers[assignedBy.username].streak = 0;
    }

    recommendation.known = false;

    recommendation.collaborators = collaborators.map(function (player) {
      return player.username;
    });
  }
  recommendation.playerId = assignedBy.username;
  recommendation.playerScore = joinedPlayers[assignedBy.username].score;
  recommendation.friendId = assignedTo.username;
  recommendation.movieId = movie;
  storePlayerInfo(recommendation);

  sendLeaderboard();
}

function roundFinished(userData) {

  playersFinished++;
  var score = joinedPlayers[userData.username].roundScore;
  score = Math.round(score * (userData.time / 10));
  this.emit('updateScore', {
    score: score
  });
  if (userData.time > 0) {
    showInfo(userData.username, 'EARLY FINISH');
  }
  joinedPlayers[userData.username].score += score;
  joinedPlayers[userData.username].roundScore = 0;
  sendLeaderboard();

  if (playersFinished === players.length) {
    pile = [];
    io.sockets.emit('newRound');
    playersFinished = 0;
    roundNo++;
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
        username: joinedPlayers[player].username,
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
    return;
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
  players = [];
  suggested = {};
  // movies = [];
  roundNo = 0;
  pile = [];
  playersFinished = 0;
  clearInterval(timer);
  gameStarted = false;
  timer = undefined;
  time = 0;
  userMovies = [];
  readyPlayers = 0;
}

function shakeCard(card) {
  io.sockets.emit('shakeCard', card.username, card.index, card.remove);
}

function addMovie(movie, user) {
  db.users.update({ facebook_id : user }, { $addToSet: { movies: movie } });
  db.movies.insert(movie, function (err) {
    if (err) {
      if (err.errorType != 'uniqueViolated') throw err;
    }

  });
}

function updateRating(user, data) {
  db.users.update({facebook_id: user}, { $addToSet: { rated: data}}, { upsert : true });
}

function removeMovie(movie, user) {
  console.log(movie.id);
  db.users.update({ facebook_id : user }, { $pull: { movies: movie } }, {returnUpdatedDocs: true}, function (err, num, aff) {
    if (err) throw err;
    console.log(aff);
  });
}

function playerReady() {
  readyPlayers++;
  if (readyPlayers === maxPlayers) {
    io.sockets.emit('startGame');

    timer = setInterval(function() {
      time++;
      if (time >= maxTime) {
        clearInterval(timer);
        gameOver();
      }
    }, 1000);
  }
}

function showInfo(player, info) {
  io.sockets.emit('showInfo', player, info);
}


function storePlayerInfo(data) {
  data.timestamp = Date.now();
  var game = recommendations[gameId] || {};
  var round_id = 'round_' + roundNo;
  game.gameId = gameId;
  game.players = game.players || players.map(function (player) {
    return player.username;
  });
  var round = game[round_id] || {};
  round['match_' + data.timestamp] = data;
  game[round_id] = round;

  db.games.update( { gameId : game.gameId }, game, { upsert : true }, function (err) {
    if (err) throw err;
  });
}


function setConfig(data) {
  console.log(data);
  deckSize = data.deckSize || 60;
  maxPlayers = data.maxPlayers || 2;
  maxTime = data.maxTime * 60 || 6 * 60 ;
}


function fetchGameData(playerId, callback) {

  db.games.find({players: { $elemMatch: playerId}}).sort({gameId: 1}).exec(function (err, docs) {
    var assignedMovies = {};
    var possibleMovies = {};
    var games = docs;
    var friendliness = {};

    games.forEach(function (game) {
      var rounds = [];
      Object.keys(game).forEach(function (key) {

        if (/[round_][0-9]+/.test(key)) {
          rounds.push(game[key]);
        }
      });
      rounds.forEach(function (round) {
        var order = {};
        Object.keys(round).forEach(function (match) {
          order[round[match].playerId] = order[round[match].playerId] || 0;
          order[round[match].playerId]++;


          var movie = round[match].movieId;
          if (round[match].friendId === playerId) {


            friendliness[round[match].playerId] = friendliness[round[match].playerId] || 0;
            assignedMovies[movie] = assignedMovies[movie] || {};

            if (assignedMovies[movie].known === undefined) assignedMovies[movie].known = round[match].known;

            if (round[match].known) friendliness[round[match].playerId] += 1;


            assignedMovies[movie].collabs = assignedMovies[movie].collabs || [];
            assignedMovies[movie].collabs.push(round[match].playerId);

            assignedMovies[movie].assigned = assignedMovies[movie].assigned || 0;
            assignedMovies[movie].assigned++;

            assignedMovies[movie].orders = assignedMovies[movie].orders || [];
            assignedMovies[movie].orders.push(order[round[match].playerId]);

          }
          possibleMovies[movie] = possibleMovies[movie] || {};
          possibleMovies[movie].appeared = possibleMovies[movie].appeared || 0;
          possibleMovies[movie].appeared++;
        });
      });
    });

    callback(assignedMovies, possibleMovies, friendliness);
  });

}

function fetchRecommendations(playerId) {
  var socket = this;
  fetchGameData(playerId, function (assignedMovies, possibleMovies) {
    var list = [];
    var uniqueKeys = Object.keys(assignedMovies);
    var possibleKeys = Object.keys(possibleMovies);

    db.users.findOne({facebook_id: playerId}, function (err, user) {
      possibleKeys.forEach(function (movie) {
        var movie_i = parseInt(movie);
        db.movies.findOne({id : movie_i}, function (err, doc) {

          if (!user.rated || !user.rated.some(function (rated) {
            return rated.movieId === movie_i;
          })) {
            list.push(doc);
          }
          if (movie === possibleKeys[possibleKeys.length - 1]) {
              socket.emit('recList', list);
              // console.log(list);
          }

        });
      });
    });
  });

}
//based on if card was assigned or not
function score_0(playerId) {
  var best_movies = [];
  fetchGameData(playerId, function (assignedMovies, possibleMovies) {
    //All these movies have a score of 1 since they were assigned
    var movies = Object.keys(assignedMovies);
    best_movies = movies.slice(0,5);
    console.log(best_movies);
  });

  return best_movies;
}

//based on amount of users that recommended specific movie
function score_1(playerId) {
  var best_movies = [];
  fetchGameData(playerId, function (assignedMovies, possibleMovies) {
    var list = [];
    var movies = Object.keys(assignedMovies);
    movies.forEach(function (movie) {
      list.push({
        movieId: movie,
        score: assignedMovies[movie].assigned
      });
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,5);
    console.log(best_movies);
  });
}

function score_2(playerId) {
  var best_movies = [];
  fetchGameData(playerId, function (assignedMovies, possibleMovies) {
    var list = [];
    var movies = Object.keys(assignedMovies);

    movies.forEach(function (movie) {
      list.push({
        movieId: movie,
        score: assignedMovies[movie].assigned  / possibleMovies[movie].appeared
      });
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,5);
    console.log(best_movies);
  });
}


function score_3(playerId) {
  var best_movies = [];
  var calcAvgOrder = function (orders) {
    var sum = 0;
    orders.forEach(function (order) {
      sum += 6 - order;
    });
    return orders.length > 1 ? sum / orders.length : 0;
  };
  fetchGameData(playerId, function (assignedMovies, possibleMovies) {
    var list = [];
    var movies = Object.keys(assignedMovies);
    // console.log(assignedMovies);
    movies.forEach(function (movie) {
      list.push({
        movieId: movie,
        score: calcAvgOrder(assignedMovies[movie].orders)
      });
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,5);
    console.log(best_movies);
  });
}

function score_4(playerId) {
  var best_movies = [];
  var calcScoreFromCollab = function (collabs, friendliness) {
    var sum = 0;
    collabs.forEach(function (c) {
      sum += friendliness[c];
    });
    return sum;//collabs.length > 1 ? sum / collabs.length : 0;
  };
  fetchGameData(playerId, function (assignedMovies, possibleMovies, friendliness) {
    var list = [];
    var movies = Object.keys(assignedMovies);
    // console.log(assignedMovies);
    movies.forEach(function (movie) {
      list.push({
        movieId: movie,
        score: calcAvgScoreFromCollab(assignedMovies[movie].collabs, friendliness)
      });
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,5);
    console.log(best_movies);
  });
}

// console.log(score_4('963545110359760'));
// updateRating('963545110359760', 11, 4);
// fetchRecommendations('883367995105144');
