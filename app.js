/*jshint esversion: 6 */
var Datastore = require('nedb'),
    db = {};

db.users = new Datastore({filename: 'db/users.db', autoload: true });
db.movies = new Datastore({filename: 'db/movies.db', autoload: true });
db.recommendations = new Datastore({filename: 'db/recommendations.db', autoload: true });

db.users.ensureIndex({ fieldName: 'facebook_id', unique: true}, function (err) {
  if (err) throw err;
});

db.movies.ensureIndex( {fieldName: 'id', unique: true}, function (err) {
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

};

function possibleMovies(player_movies) {
  var possibleMovies = [];
  movies.forEach(function(m) {
    if (!player_movies.some(function(elem) {
        return elem.id === m.id;
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
    if (!doc || doc.length < 1) {
      db.users.insert(post);
      user = post;
    } else {
      user = doc;
    }
    socket.emit('setUser', user);
  });
}

function playerConnect(currPlayer) {
  // if(players.length < 1) updateMovies(); //TODO wait for movies to update
  console.log(currPlayer);
  var joinedPlayer = joinedPlayers[currPlayer.username];
  if (joinedPlayer) {
    // this.emit('loadAssets', joinedPlayer.availableMovies);
    this.emit('resume', joinedPlayer);
    players.push(joinedPlayer);
  } else {
    joinedPlayers[currPlayer.username] = currPlayer;
    currPlayer.roundScore = 0;
    currPlayer.streak = 0;
    currPlayer.socket = this.id;
    // player.availableMovies = possibleMovies(player.movieList);
    // this.emit('loadAssets', player.availableMovies);
    players.push(currPlayer);
  }
  if (players.length === 2) {
    console.log("here0");
    updateMovies(function () {
      console.log("here");
      io.emit('loadAssets', movies);
      // player.availableMovies = movies; //TODO wait fo people to join to serve movies

      io.sockets.emit('startGame');
            console.log("here3");
      timer = setInterval(function() {
        time++;
        if (time >= 3 * 60) {
          clearInterval(timer);
          gameOver();
        }
      }, 1000);
      console.log("here4");
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
  clearInterval(timer);
}


function cardAssigned(data) {
  console.log(data);

  var cards = joinedPlayers[data.assignedBy].cards;
  cards.forEach(function(card) {
    if (card.id == data.id) {
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
  updateScore(assignedPlayer, this, data.id);
  var chosen_movie = getMovie(data.id);
  pile.push(chosen_movie);

  io.sockets.emit('placeOnPile', [chosen_movie]);
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

function updateScore(assignedTo, assignedBy, movie) {
  console.log(assignedTo.username);
  var score = 0;
  if (assignedTo.movieList.some(function(userMovie) {
      return userMovie.id === movie;
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
  console.log("break?");
  io.sockets.emit('playerJoined', players);
  console.log("break2?");
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
  pile = [];
  playersFinished = 0;
  timer = undefined;
  time = 0;
  userMovies = [];
}

function shakeCard(card) {
  console.log(card);
  io.sockets.emit('shakeCard', card.username, card.index, card.remove);
}

function addMovie(movie, user) {
  db.users.update({ facebook_id : user }, { $addToSet: { movies: movie } });
  db.movies.insert(movie, function (err) {
    if (err) {
      if (err.errorType != 'uniqueViolated') throw err;
      else {
        console.log(movie);
        console.log(err);
      }
    }

  });
}

function removeMovie(movie, user) {
  db.users.update({ facebook_id : user }, { $pull: { movies: movie } });
}
