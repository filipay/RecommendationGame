/*jshint esversion: 6 */

/**

This is the backend of this application. It concerns itself with connecting the
users, checking the matches (known or unknown) and analysing the data.

**/


//Imports and database declarations
var Datastore = require('nedb'),
    db = {}, autoCompact = 10 * 1000;

db.users = new Datastore({filename: 'db/users.db', autoload: true });
db.movies = new Datastore({filename: 'db/movies.db', autoload: true });
db.games = new Datastore({filename: 'db/games.db', autoload: true });
db.analytics = new Datastore({filename: 'db/analytics.db', autoload: true });


db.users.ensureIndex({ fieldName: 'facebook_id', unique: true}, function (err) {
  if (err) throw err;
});

db.movies.ensureIndex( {fieldName: 'id', unique: true}, function (err) {
  if (err) throw err;
});

db.games.ensureIndex( {fieldName: 'gameId', unique: true}, function (err) {
  if (err) throw err;
});

db.analytics.ensureIndex( {fieldName: 'score', unique: true}, function (err) {
  if (err) throw err;
});

db.users.persistence.setAutocompactionInterval(autoCompact);
db.movies.persistence.setAutocompactionInterval(autoCompact);
db.games.persistence.setAutocompactionInterval(autoCompact);

//Global variables
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

//Export module so it could be imported else where
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

//Utility methods for arrays
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

//Fetch the latest movie list
function updateMovies(callback) {
  db.movies.find( {} , function (err, docs) {
    movies = docs;
    callback();
  });
}

//Deck creation method
function createDeck(size) {
  var deck = [];
  players.forEach(function (player) {
    player.movieList.shuffle();
    deck.push.apply(deck, player.movieList.slice(0,15));
  });
  var randomMovies = movies.unique(userMovies);
  randomMovies.shuffle();
  deck.push.apply(deck, randomMovies.slice(0, size - deck.length));
  return deck;
}

//Fetch amount of players in the lobby
function amountOfPlayers() {
  this.emit('gameSize', players.length);
}

//Get user information if available, otherwise create a new entry
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

//Handle player connections, wait for all users to connect before strating game
function playerConnect(currPlayer) {
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
    players.push(currPlayer);
  }
  if (players.length === maxPlayers) {
    gameStarted = true;
    updateMovies(function () {
      gameId = Date.now();
      recommendations[gameId] = {};
      var deck = createDeck(deckSize);

      io.sockets.emit('loadAssets', deck);
    });
  } else {
    io.sockets.emit('updateWaitingScreen', {
      joinedUser: currPlayer.name,
      noPlayers: players.length,
      maxPlayers: maxPlayers
    });
  }

}


//Handle user getting disconnecting, if all disconnect restart game
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

//Check the assigned card and update scores and the pile
function cardAssigned(data) {

  var cards = joinedPlayers[data.assignedBy].cards;
  cards.forEach(function(card) {
    if (card === data.id) {
      cards.splice(cards.indexOf(card), 1);
    }
  });

  var assignedPlayer = joinedPlayers[data.assignedTo];


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
//Find the movie by ID
function getMovie(id) {
  var movie;
  movies.forEach(function(m) {
    if (m.id === id) {
      movie = m;
    }
  });
  return movie;
}

//Add collaborator to the datastructure
function addCollaborator(assignedTo, assignedBy, movie) {
  suggested[assignedTo] = suggested[assignedTo] || {};
  suggested[assignedTo][movie] = suggested[assignedTo][movie] || [];
  if (!suggested[assignedTo][movie].some(function(collaborator) {
      return assignedBy.username === collaborator.username;
    })) {
    suggested[assignedTo][movie].push(assignedBy);
  }
}

//Check if the binned movie belonged to a player
function checkBin(assignedBy, movie) {
  var recommendation = {};
  recommendation.known = false;
  var player = joinedPlayers[assignedBy.username];
  var movies = userMovies.unique(player.movieList);

  //Check if any movie in the set corresponds to a known movie of another player
  if (movies.some(function (m) {
    return m.id === movie;
  })) {
    recommendation.known = true;
    var score = -10;
    player.score += score;
    player.streak = 0;
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

//Update the scores of the respective players/collaborators
function updateScore(assignedTo, assignedBy, movie) {
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

//Trigger for when user empties their hand or time finishes
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

//Respond to request to send pile of cards
function sendPile() {
  this.emit('placeOnPile', pile);
}

//Respond to request to send the users at the table
function sendTable() {
  io.sockets.emit('playerJoined', players);
}

//Sort users by scores and respond to the request to send the leaderboard
function sendLeaderboard() {

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

//Handle data coming in about the players card
function userHand(username, cards) {
  if (cards.length === 0 && playersFinished === maxPlayers) {
    gameOver();
    return;
  }
  joinedPlayers[username].cards = cards;
}

//Respond to requset to reset the time
function resetTime() {
  io.sockets.emit('startGame');
}

//Reinitialise values
function gameOver() {
  io.sockets.emit('gameOver');

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

//Send trigger to send shake the resepective card in players hand
function shakeCard(card) {
  io.sockets.emit('shakeCard', card.username, card.index, card.remove);
}

//Trigger for handling new movie being added by a player to db
function addMovie(movie, user) {
  db.users.update({ facebook_id : user }, { $addToSet: { movies: movie } });
  db.movies.insert(movie, function (err) {
    if (err) {
      if (err.errorType != 'uniqueViolated') throw err;
    }

  });
}

//Update rating of a movie
function updateRating(user, data) {
  db.users.update({facebook_id: user}, { $addToSet: { rated: data}}, { upsert : true });
}

//Remove a movie from a users list
function removeMovie(movie, user) {
  db.users.update({ facebook_id : user }, { $pull: { movies: movie } }, {returnUpdatedDocs: true}, function (err, num, aff) {
    if (err) throw err;
  });
}

//Wait for all users to render the game before starting the timer
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

//Send trigger to show info about player bonus
function showInfo(player, info) {
  io.sockets.emit('showInfo', player, info);
}

//Store game data
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

//FOR Remote config, used manually
function setConfig(data) {
  deckSize = data.deckSize || 60;
  maxPlayers = data.maxPlayers || 2;
  maxTime = data.maxTime * 60 || 6 * 60 ;
}

//Fetch and format game data for analaysis
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

          possibleMovies[movie] = possibleMovies[movie] || {};
          possibleMovies[movie].collabs = possibleMovies[movie].collabs || {};
          possibleMovies[movie].appeared = possibleMovies[movie].appeared || 0;
          possibleMovies[movie].assigned = possibleMovies[movie].assigned || 0;
          possibleMovies[movie].appeared++;

          friendliness[round[match].playerId] = friendliness[round[match].playerId] || {};
          friendliness[round[match].playerId].total = friendliness[round[match].playerId].total || 0;
          friendliness[round[match].playerId].correct = friendliness[round[match].playerId].correct || 0;

          if (round[match].friendId === playerId) {

            // assignedMovies[movie] = assignedMovies[movie] || {};

            if (possibleMovies[movie].known === undefined) possibleMovies[movie].known = round[match].known;

            if (round[match].known) friendliness[round[match].playerId].correct++;
            friendliness[round[match].playerId].total++;

            possibleMovies[movie].collabs[round[match].playerId] = possibleMovies[movie].collabs[round[match].playerId] || [];
            possibleMovies[movie].collabs[round[match].playerId].push(order[round[match].playerId]);

            possibleMovies[movie].assigned++;

          }

        });
      });
    });
    friendliness.ratio = function (playerId) {
      return this[playerId].correct / this[playerId].total;
    };
    callback(possibleMovies, friendliness);
  });

}

//Fetch all the movies that need to be rated
function fetchRecommendations(playerId, testing) {
  var socket = this;
  fetchGameData(playerId, function (possibleMovies) {
    var list = [];

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
              if (!testing) socket.emit('recList', list);
              else console.log(testing+" = "+list.length);
          }

        });
      });
    });
  });

}
//based on if card was assigned or not
function score_0(playerId, threshold, results) {
  var best_movies = [];
  fetchGameData(playerId, function (possibleMovies) {
    //All these movies have a score of 1 since they were assigned
    var list = [];
    var movies = Object.keys(possibleMovies);
    movies.forEach(function (movie) {
      var score = possibleMovies[movie].assigned > 0 ? 1 : 0;
      if (score === threshold.atLeast || threshold.notUsed)
      list.push({
        movieId: movie,
        score: score
      });
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);
    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: threshold.notUsed ? best_movies : list
      });
    }
  });
}

//based on amount of users that recommended specific movie
function score_1(playerId, threshold, results) {
  var best_movies = [];
  fetchGameData(playerId, function (possibleMovies) {
    var list = [];
    var movies = Object.keys(possibleMovies);

    movies.forEach(function (movie) {
      if (possibleMovies[movie].assigned === threshold.atLeast || threshold.notUsed) {
        list.push({
          movieId: movie,
          score: possibleMovies[movie].assigned
        });
      }
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);

    //Check that the user participated in some games
    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: threshold.notUsed ? best_movies : list
      });
    }
  });
}

//Score based on amount assigned / amount appeared
function score_2(playerId, threshold, results ) {
  var best_movies = [];
  fetchGameData(playerId, function (possibleMovies) {
    var list = [];
    var movies = Object.keys(possibleMovies);

    movies.forEach(function (movie) {
      var score = possibleMovies[movie].assigned  / possibleMovies[movie].appeared;
      if ((score > threshold.min && score <= threshold.max) || threshold.notUsed) {
        list.push({
          movieId: movie,
          score: score
        });
      }
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);

    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: threshold.notUsed ? best_movies : list
      });
    }
  });
}

//Score based on amount assigned / amount appeared with threshold taken into consideration
function score_2_1(playerId, threshold, results) {
  var best_movies = [];
  fetchGameData(playerId, function (possibleMovies) {
    var list = [];
    var movies = Object.keys(possibleMovies);

    movies.forEach(function (movie) {
      var score = possibleMovies[movie].assigned  / possibleMovies[movie].appeared;
      if (((score > threshold.min && score <= threshold.max) || threshold.notUsed) && possibleMovies[movie].assigned >= threshold.atLeast) {
        list.push({
          movieId: movie,
          score: score
        });
      }
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);

    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: threshold.notUsed ? best_movies : list
      });
    }

  });
}


//Avg score based on order
function score_3(playerId, threshold, results) {
  var best_movies = [];
  var calcSumOrder = function (collaborators) {
    var sum = 0;
    var collabs = Object.keys(collaborators);
    collabs.forEach(function (collab) {
      collaborators[collab].forEach(function (order) {
        sum += 6 - order;
      });
    });
    return sum;
  };
  fetchGameData(playerId, function (possibleMovies) {
    var list = [];
    var movies = Object.keys(possibleMovies);
    movies.forEach(function (movie) {
      var score = calcSumOrder(possibleMovies[movie].collabs) / possibleMovies[movie].assigned;
      if ((score > threshold.min && score <= threshold.max) || threshold.notUsed) {
        list.push({
          movieId: movie,
          score: score
        });
      }
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);

    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: threshold.notUsed ? best_movies : list
      });
    }
  });
}

//Average score based on order with friendliness taken into account
function score_3_1(playerId, threshold, results) {
  var best_movies = [];
  var calcSumOrder = function (collaborators, friendliness) {
    var sum = 0;
    var collabs = Object.keys(collaborators);
    collabs.forEach(function (collab) {
      collaborators[collab].forEach(function (order) {
        sum += (6 - order) * friendliness.ratio(collab);
      });
    });
    return sum;
  };
  fetchGameData(playerId, function (possibleMovies, friendliness) {
    var list = [];
    var movies = Object.keys(possibleMovies);
    movies.forEach(function (movie) {
      var score = calcSumOrder(possibleMovies[movie].collabs, friendliness) / possibleMovies[movie].assigned;
      if ((score > threshold.min && score <= threshold.max) || threshold.notUsed) {
        list.push({
          movieId: movie,
          score: score
        });
      }
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);

    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: threshold.notUsed ? best_movies : list
      });
    }

  });
}

//Score based on friendliness
function score_4(playerId, threshold, results) {
  var best_movies = [];
  var calcScoreFromCollab = function (collaborators, count, friendliness) {
    var sum = 0;
    var collabs = Object.keys(collaborators);
    collabs.forEach(function (c) {
      sum += friendliness.ratio(c);
    });
    return sum;
  };
  fetchGameData(playerId, function (possibleMovies, friendliness) {
    var list = [];
    var movies = Object.keys(possibleMovies);
    movies.forEach(function (movie) {
      var score = calcScoreFromCollab(possibleMovies[movie].collabs, possibleMovies[movie].appeared, friendliness);
      if ((score > threshold.min && score <= threshold.max)  || threshold.notUsed){
        list.push({
          movieId: movie,
          score: score
        });
      }
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);

    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: best_movies
      });
    }
  });
}


//Average score based on friendliness with threshold
function score_4_1(playerId, threshold, results) {
  var best_movies = [];
  var calcAvgScoreFromCollab = function (collaborators, friendliness) {
    var sum = 0;
    collaborators.forEach(function (c) {
      sum += friendliness.ratio(c);
    });
    return sum;
  };
  fetchGameData(playerId, function (possibleMovies, friendliness) {
    var list = [];
    var movies = Object.keys(possibleMovies);

    movies.forEach(function (movie) {
      var collabs = Object.keys(possibleMovies[movie].collabs);
      var score = calcAvgScoreFromCollab(collabs, friendliness);
      if (((score > threshold.min && score <= threshold.max) || threshold.notUsed) && collabs.length >= threshold.atLeast) {
        list.push({
          movieId: movie,
          score: score
        });
      }
    });

    list.sort(function (movie1, movie2) {
      return movie2.score - movie1.score;
    });

    best_movies = list.slice(0,10);

    if (movies.length > 0) {
      results.push({
        playerId: playerId,
        movies: best_movies
      });
    }
  });
}

//Function used for simple analysis of some specific game data
function analaysis(playerId, threshold) {
  db.games.find({}).sort({gameId: 1}).exec(function (err, docs) {
    var games = docs;
    var players = {};
    var total = 0;
    var numbergames = 0;
    games.forEach(function (game) {
      var exists = false;
      var sum = 0;
      game.players.forEach(function (player) {
        players[player] = players[player] || 0;
        players[player]++;
        total++;
      });

    });
    var sum = 0;
    Object.keys(players).forEach(function (key) {
      sum += players[key] / 32;
    });
  });
}

//Script for checking if everyone rated their movies
function checkWhoNeedsToRate() {
  db.users.find({}, function (err, docs) {
    docs.forEach(function (user) {
      fetchRecommendations(user.facebook_id, user.name);
    });
  });
}

//Script to run a scoring function over all users
function runFunctionOverEveryUser(callback, threshold, results) {
  var playerRatings = {};
  db.users.find({}, function (err, docs) {
    docs.forEach(function (user) {
      fetchRatings(user.facebook_id, playerRatings);
      callback(user.facebook_id, threshold, results);
    });

  });
  //Inefficent but solves the problem


  setTimeout(function () {
    var sumSetSize = 0;
    var sumRating = 0;
    var count = 0;
    results.forEach(function (result) {
      sumSetSize += result.movies.length;
      result.movies.forEach(function (movie) {
        if (playerRatings[result.playerId][movie.movieId]) {
          sumRating += playerRatings[result.playerId][movie.movieId];
          count++;
        }
      });
    });

    var avgResults = {
      func: callback.name,
      score: threshold.max,
      avgRating: sumRating / count,
      avgSetSize: sumSetSize / results.length
    };

    db.analytics.insert(avgResults,function (err) {
      if (err) console.log(err);
      console.log("done");
    });
  }, 1000);
}

//Fetch the ratings that the user gave to the movies, for analysis
function fetchRatings(playerId, result) {
  result[playerId] = {};
  db.users.findOne({facebook_id: playerId}, function (err, doc) {
    if (doc.rated) {
      doc.rated.forEach(function (rating) {
        result[playerId][rating.movieId] = rating.rating;
      });
    }
  });
}

//Timeout to prevent concurency errors during analysis
var waitFunc = function(arg) {
  setTimeout(function () {
    runFunctionOverEveryUser(analaysis, {min: arg, max: arg + 1, atLeast: 3}, []);
  }, arg * 1000);
};
