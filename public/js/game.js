/**

Main JavaScript which creates the game

**/

//Global variable declarations
var randomMovies = [];
var currentUser;
var cards;

var width = 800,
  height = 600;

//Import relevant PIXI objects
var Container = PIXI.Container,
  MovieClip = PIXI.extras.MovieClip,
  TextureCache = PIXI.utils.TextureCache,
  loader = PIXI.loader,
  resources = PIXI.loader.resources,
  Sprite = PIXI.Sprite,
  Graphics = PIXI.Graphics,
  Text = PIXI.Text,
  Point = PIXI.Point;

//Set triggers and responses
socket.on('updateScore', updateScore);
socket.on('playerJoined', createTable);
socket.on('loadAssets', loadAssets);
socket.on('placeOnPile', placeOnPile);
socket.on('createPile', createPile);
socket.on('newRound', newRound);
socket.on('resume', resume);
socket.on('updateLeaderboard', updateLeaderboard);
socket.on('startGame', startGame);
socket.on('setUser', setUser);
socket.on('gameOver', gameOver);
socket.on('shakeCard', shakeCard);
socket.on('updateWaitingScreen', updateWaitingScreen);
socket.on('showInfo', showInfo);

//Set the window
var renderer = PIXI.autoDetectRenderer(
  width, height, {
    antialias: true,
    transparent: false,
    resolution: window.devicePixelRatio,
    autoResize: true
  }
);

renderer.view.style.position = 'absolute';
renderer.view.style.display = 'block';
renderer.resize(window.innerWidth, window.innerHeight);
renderer.backgroundColor = 0x0B5394;

document.body.appendChild(renderer.view);

//Set sounds available
var cardPlaceSound = ['/sounds/cardPlace1.wav', '/sounds/cardPlace2.wav', '/sounds/cardPlace3.wav', '/sounds/cardPlace4.wav'];

var cardAssignSound = ['/sounds/cardSlide1.wav', '/sounds/cardSlide2.wav', '/sounds/cardSlide3.wav', '/sounds/cardSlide4.wav', '/sounds/cardSlide5.wav', '/sounds/cardSlide6.wav', '/sounds/cardSlide7.wav', '/sounds/cardSlide8.wav'];

var cardFeelSound = ['/sounds/cardShove1.wav', '/sounds/cardShove2.wav', '/sounds/cardShove3.wav', '/sounds/cardShove4.wav'];

//Set stages
var stage = new Container();
stage.baseContainer = true;
var waitingScreen = new Container();
waitingScreen.baseContainer = true;
var display = waitingScreen;


var waitingText = new Text('', {
  font: '40px sans-serif',
  fill: 0xFFFF0B
});

waitingText.anchor.set(0.5,0.5);
waitingText.position.set((window.innerWidth) * 0.5, (window.innerHeight ) * 0.5);
waitingScreen.addChild(waitingText);

requestAnimationFrame(animate);

//Utility functions
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDouble(min, max) {
  return Math.random() * (max - min) + min;
}


function updateWaitingScreen(data) {
  waitingText.text = 'Waiting for players... (' + data.noPlayers + ' / ' + data.maxPlayers+')';
  floatAwayText(data.joinedUser + ' joined!', 60, display);
}


//Set the user data
function setGameUser(user) {
  currentUser = new User(user.name, user.facebook_id, user.picture, user.movies);

  socket.emit('joinGame', currentUser);
}

setGameUser(FB.me);

//Load all of the textures needed for the game
function loadAssets(movies) {

  randomMovies = movies;
  var uniqueMovies = {};
  movies.forEach(function(movie) {
    uniqueMovies[movie.id] = movie;
  });
  var loadMovies = Object.keys(uniqueMovies).map(function(key) {
    return uniqueMovies[key];
  });

  loadMovies.forEach(function(movie) {
    loader.add(movie.poster_url);
  });
  loadPlaceholders();
}

//User object init
function User(name, username, avatar, movieList) {
  this.name = name;
  this.username = username;
  this.avatar = avatar || 'images/avatar-placeholder.png';
  this.movieList = movieList;
  this.score = 0;
}

//Make sure to disconnect before closing the tab
$(window).on('beforeunload', function() {
  socket.close();
});

//Update user score
function updateScore(data) {
  if (data.score > 10) {
    new Howl({
      urls: ['sounds/score_collab.wav']
    }).play();
  } else {
    new Howl({
      urls: ['sounds/score_match.wav']
    }).play();
  }
  currentUser.score += data.score;
  currentScore.text = currentUser.score;

  floatAwayText('+' + data.score, 50, currentScore);
}

//Load the standard textures
function loadPlaceholders() {
  loader
    .add('card', 'images/card.png')
    .add('blank_card', 'images/back_card.png')
    .add('avatar', 'images/avatar-placeholder.png')
    .add('background', 'images/background.jpg')
    .load(setup);
}

//Set default card width
var card_w = 100,
  card_h = 150;

//Set the score text
var score = new PIXI.Text(
  'Score : ', {
    font: '40px sans-serif',
    fill: 'white'
  }
);

//Set the timers
var time = 30;
var timer;
var timeText = new PIXI.Text('00:00', {
  font: '40px sans-serif',
  fill: 'white'
});
timeText.position.x = 50;
timeText.position.y = 110;


//Start the game/clock
function startGame() {
  if (timer) clearInterval(timer);
  time = 30;
  timer = setInterval(updateTime, 1000);
}

//updateTime
function updateTime() {
  time--;
  timeText.text = pad(time);
  if (time < 1) {
    socket.emit('roundFinished', {
      username: currentUser.username,
      time: 0
    });
    time = 30;
  }
}

//Pad the time to have the 00:30
function pad(time) {
  var time_string = '';
  var seconds = time % 60;
  var minutes = parseInt(time / 60);

  if (seconds < 10) {
    seconds = '0' + seconds;
  }

  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  return minutes + ' : ' + seconds;
}

currentScore = new PIXI.Text('0', {
  font: '40px sans-serif',
  fill: 'white'
});

//Position the score elements
score.addChild(currentScore);
currentScore.anchor.set(0.5,0.5);
currentScore.position.x = score.width + 30;
currentScore.position.y = score.height * 0.5;
currentScore.scale.set(1, 1);
score.position.set(50, 50);
stage.addChild(score);
stage.addChild(timeText);


//Update the user on the current score of each player
function updateLeaderboard(players) {

  var highlight = true;
  table.leader = players[0];
  if (players[0].score === players[1].score) {
    highlight = false;
  }
  for (var i = 0; i < players.length; i++) {
    var player = table[players[i].username];
    if (player) {
      var diff = players[i].score - parseInt(player.score.text);

      player.score.highlight.stop();
      if (diff > 0) {
        floatAwayText('+' + diff, 30, player.score);
        player.score.text = players[i].score;
      }
      if (i === 0 && highlight) {
        player.score.highlight = highlightRainbow(player.score).start();
      }
    }
  }
}

//Create a blank card/face down
function BlankCard(position, rotation) {
  var background = new Sprite(resources.card.texture);
  background.position = position;
  background.anchor.set(0.5, 0.5);
  background.width = card_w * 0.5;
  background.height = card_h * 0.5;

  background.rotation = rotation || 0;
  var sticker = new Sprite(resources.blank_card.texture);
  sticker.anchor.set(0.5, 0.5);
  sticker.scale.set(0.9, 0.9);
  background.addChild(sticker);
  return background;
}

//Create a card
function Card(position, movie, options, rotation) {

  var container = new Container();
  container.position.x = position.x;
  container.position.y = position.y;
  container.rotation = rotation || 0;

  container.interactive = true;
  container.buttonMode = true;

  container.movable = options.movable;
  container.assignable = options.assignable;
  container.placeSound = new Howl({
    urls: [cardPlaceSound[getRandomInt(0, cardPlaceSound.length - 1)]]
  });
  container.assignSound = new Howl({
    urls: [cardAssignSound[getRandomInt(0, cardAssignSound.length - 1)]]
  });
  container.lookAtSound = new Howl({
    urls: [cardFeelSound[getRandomInt(0, cardFeelSound.length - 1)]]
  });
  $.extend(container, movie);

  var background = new Sprite(resources.card.texture);
  background.anchor.set(0.5, 0.5);
  background.width = card_w;
  background.height = card_h;
  container.background = background;

  var poster = new Sprite.fromImage(movie.poster_url);
  poster.width = card_w * 0.7;
  poster.height = card_h * 0.7;
  poster.anchor.set(0.5, 0.5);
  if (movie.title.length > 15) {
    movie.title = movie.title.substring(0, 12) + '...';
  }
  var title = new PIXI.Text(movie.title, {
    font: card_h * 0.08 +'px sans-serif',
    fill: 'black'
  });
  title.anchor.set(0.5, 0.5);
  title.position.set(0, -title.height - poster.height * 0.5);

  container
  // events for drag start
    .on('mousedown', onDragStart)
    .on('touchstart', onDragStart)
    // events for drag end
    .on('mouseup', onDragEnd)
    .on('mouseupoutside', onDragEnd)
    .on('touchend', onDragEnd)
    .on('touchendoutside', onDragEnd)
    // events for drag move
    .on('mousemove', onDragMove)
    .on('touchmove', onDragMove)
    .on('mouseover', function() {
      new TWEEN.Tween(this.scale).to({
        x: 1.1,
        y: 1.1
      }, 300).easing(TWEEN.Easing.Elastic.Out).start();
    })
    .on('mouseout', function() {
      new TWEEN.Tween(this.scale).to({
        x: 1,
        y: 1
      }, 500).easing(TWEEN.Easing.Bounce.Out).start();
    });

  container.addChild(background);
  container.addChild(poster);
  container.addChild(title);

  return container;
}

//Create a player/avatar for the table
function Player(position, user, handSize) {
  var player = new Container();
  player.position.x = position.x;
  player.position.y = position.y;
  player.username = user.username;

  var avatar = new Sprite.fromImage(user.avatar);
  avatar.anchor.set(0.5, 0.5);
  avatar.width = avatar.height = 200;

  var username = new Text(
    user.name, {
      font: '20px sans-serif',
      fill: 'white'
    }
  );
  username.anchor.set(0.5, 0.5);
  username.position.set(0, -avatar.height * 0.4);

  var score = new Text('0', {
    font: '30px sans-serif',
    fill: 'white'
  });
  score.anchor.set(0.5, 0.5);
  score.position.set(0, -avatar.height * 0.6);
  score.highlight = highlightRainbow(score);



  var circle = new Graphics();
  circle.lineStyle(0);
  circle.beginFill(0xFFFF0B, 0.5);
  circle.drawCircle(0, 0, avatar.width*0.5);
  circle.endFill();
  avatar.addChild(circle);
  avatar.mask = circle;

  player.avatar = avatar;
  player.user = user;
  player.score = score;

  player.addChild(avatar);
  player.addChild(username);
  player.addChild(score);
  // player.addChild(BlankCard(new Point(0, )));

  player.cards = createHand(getBlankCardsList(handSize), new Point(0, avatar.height * 0.4), {
    blank: true,
    space: -50
  });
  player.addChild(player.cards);

  return player;
}

//Create the user hand, positioning
function createHand(movies, position, options, rotation) {
  var start_angle = 150,
    end_angle = 210;
  var hand = new Container();
  var space = options.space || 10;
  hand.position = position;
  hand.position.x -= (movies.length - 1) * (card_w + space) * 0.5;
  var origin = new Point(hand.position.x, 200);
  var rad_diff = (end_angle * Math.PI / 180) - (start_angle * Math.PI / 180);

  var rad_step = rad_diff / movies.length;

  var playSound = function(card) {
    return function () {
      card.placeSound.play();
    };
  };

  for (i = 0; i < movies.length; i++) {

    var x = i * (card_w + space);
    var rot = (end_angle * Math.PI / 180) - i * rad_step;
    var y = 100 * Math.sin(rot);
    var point = new Point(x, 0);
    var card = !options.blank ? Card(origin, movies[i], options) :
      BlankCard(new Point(x, 0), rot);

    if (!options.blank) {
      new TWEEN.Tween(card.position).to({
        x: point.x,
        y: point.y
      }, 100).easing(TWEEN.Easing.Elastic.Out).delay(500).onComplete(playSound(card)).start();
    }
    card.index = i;
    card.scale = card.scale || new Point(1,1);
    hand.addChild(card);
  }

  hand.rotation = rotation || 0;
  return hand;
}

//Create the table
var table = new Container();

function createTable(players, callback) {
  stage.removeChild(table);
  table = new Container();
  var angle_step = players.length > 2 ? -Math.PI / players.length : -Math.PI * 0.5; //-Math.PI * 0.5;
  var radius = window.innerHeight * 0.5;
  var count = 1;
  var origin = new Point(window.innerWidth * 0.5, -200);
  players.forEach(function(player) {
    if (player.username !== currentUser.username) {
      var angle = angle_step * count;
      var x = radius * Math.cos(angle);
      var y = radius * Math.sin(angle);

      x += window.innerWidth * 0.5;
      y += window.innerHeight - 200;

      var point = new Point(x, y);
      var seat = Player(origin, new User(player.name, player.username, player.avatar), player.cards.length || 5);
      table[player.username] = seat;
      new TWEEN.Tween(seat.position).to({
        x: point.x,
        y: point.y
      }, 600).easing(TWEEN.Easing.Elastic.Out).start();
      table.addChild(seat);
      count++;
    } else {
      table[player.username] = Player(new Point(0,0), currentUser, 0);
    }
  });
  stage.addChildAt(table, 2);
  socket.emit('playerReady');
}
var pile = new Container();

function createPile(position, size) {

  pile = new Sprite.fromImage('images/table.png');
  pile.position = position;
  pile.width = size.width;
  pile.height = size.height;

  return pile;
}

//Create the bin
var bin;
function Bin() {
  var bin = new Sprite.fromImage('images/bin.png');
  bin.anchor.set(0.5,0.5);
  bin.position.set(hand.position.x - 150, hand.position.y);
  bin.width = bin.height = 100;
  bin.username = 0;
  bin.name = 'bin';
  bin.movieList = [];
  bin.sound = new Howl({
    urls: ['sounds/bin.mp3']
  });
  return bin;
}


//Setup the game, creating the hand, players and the table
function setup() {
  if (!currentUser.cards) {
    currentUser.cards = getRandomCardList(randomMovies, 5);
    socket.emit('userHand', currentUser.username, currentUser.cards);
  }
  var background = new Sprite.fromImage('images/background.jpg');
  background.alpha = 0.1;
  background.width = window.innerWidth;
  background.height = window.innerHeight;

  stage.addChildAt(background, 0);
  stage.addChildAt(createPile(
    new Point((window.innerWidth - 500) * 0.5, (window.innerHeight - 500) * 0.5), {
      width: 500,
      height: 500
    }), 1);
  hand = createHand(currentUser.cards, new Point(window.innerWidth * 0.5, window.innerHeight * 0.9), {
    movable: true,
    assignable: true
  });
  stage.addChildAt(hand, stage.children.length - 1);

  bin = Bin();
  stage.addChildAt(bin, stage.children.length - 2);

  socket.emit('requestPile');
  socket.emit('requestTable');
  socket.emit('requestLeaderboard');
  display = stage;
  requestAnimationFrame(animate);

}
//Animation function
function animate(time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
  renderer.render(display);
}

//Fetch random cards from the deck and remove them
function getRandomCardList(movies, size) {
  size = movies.length < size ? movies.length : size;
  var list = [];

  for (var i = 0; i < size; i++) {
    var index = getRandomInt(0, movies.length - 1);
    list.push(movies[index]);

    movies.splice(index, 1);
  }
  return list;
}


//Get blank cards to set the face down cards
function getBlankCardsList(size) {
  var movies = [];
  for (var i = 0; i < size; i++) {
    movies.push({
      blank: true
    });
  }
  return movies;
}

//Handling start of dragging event
function onDragStart(event) {
  // store a reference to the data
  // the reason for this is because of multitouch
  // we want to track the movement of this particular touch
  if (!this.dragging) {
      socket.emit('shakeCard',{
      index : this.index,
      id: this.id,
      username: currentUser.username
    });
  }
  if (this.movable) {
    this.data = event.data;
    this.alpha = 0.8;
    this.dragging = true;
    this.player = undefined;
    this.origin = new PIXI.Point(this.position.x, this.position.y);
  }

}

// Handle the end of a drag event
function onDragEnd() {
  if (this.assignedTo) {
    assignCard(this);
    onPlayerHoverOut(this.assignedTo);
    new TWEEN.Tween(this.assignedTo.children[0].scale).to({
      x: 0.5,
      y: 0.5
    }, 100).repeat(1).yoyo(true).start();
  } else {
    this.placeSound.play();
    new TWEEN.Tween(this.position).to({
      x: this.origin.x,
      y: this.origin.y
    }, 600).easing(TWEEN.Easing.Elastic.Out).start();
  }

  this.alpha = 1;

  this.dragging = false;

  // set the interaction data to null
  this.data = null;
}

//Handle the dragging of a card
function onDragMove() {

  if (this.dragging) {
    var newPosition = this.data.getLocalPosition(this.parent);

    this.position.x = newPosition.x;
    this.position.y = newPosition.y;
    if (this.assignable) isCardOnAvatar(this);
  }
}

function isCardOnAvatar(card) {
  // TODO fix this
  if (bin.containsPoint(card.toGlobal(new Point(0,0)))) {
    return (card.assignedTo = bin);

  }
  var players = table.children;
  table.children.some(function(player) {
    var avatar = player.children[0];
    if (avatar.containsPoint(card.toGlobal(new Point(0, 0)))) {
      onPlayerHover(player);
      return (card.assignedTo = player);
    } else {
      onPlayerHoverOut(player);
      return (card.assignedTo = undefined);
    }
  });
}

//If the player is hover over highlight their name
function onPlayerHover(player) {
  player.getChildAt(1).style = {
    font: '20px sans-serif',
    fill: 'yellow'
  };
}

//If the player hovers the card out change back the name to white
function onPlayerHoverOut(player) {
  player.getChildAt(1).style = {
    font: '20px sans-serif',
    fill: 'white'
  };
}

//Shake a card of a specific user
function shakeCard(username, cardIndex, remove) {
  var player;
  table.children.some(function (child) {
    if (child.username === username) player = child;
    return child.username === username;
  });
  if (player) {
    var card = player.cards.children[cardIndex];
    if (remove) {
      if (card.tween) card.tween.stop();
      card.tween = new TWEEN.Tween(card.scale).to({
        x: 0,
        y: 0
      },200);
      card.tween.start();
    } else {
      card.tween = new TWEEN.Tween(card.scale).to({
        x: 0.8,
        y: 0.8
      }, 300).repeat(1).yoyo(true).easing(TWEEN.Easing.Elastic.Out);
      card.tween.start();
    }
  }
}

//Assign a card to a player, send the trigger to backend
function assignCard(card) {
  if (card.assignedTo.sound) card.assignedTo.sound.play();
  socket.emit('assignCard', {
    assignedBy: currentUser.username,
    assignedTo: card.assignedTo.username,
    id: card.id
  });
  socket.emit('shakeCard', {
    index: card.index,
    username: currentUser.username,
    remove: true
  });
  if (card.parent.children.length == 1) {
    socket.emit('roundFinished', {
      username: currentUser.username,
      time: time
    });
  }
  card.parent.removeChild(card);
}

//Handle new cards being added to the pile
function placeOnPile(movies) {
  var padding = {
    x: 200,
    y: 200
  };

  movies.forEach(function(movie) {
    var x = getRandomInt(0 + padding.x, pile.width - padding.x),
      y = getRandomInt(0 + padding.y, pile.height - padding.y),
      rotation = getRandomDouble(-0.5, 0.5);

    var card = Card(new Point(x, y), movie, {
      movable: true
    }, rotation);
    card.scale.set(0.0, 0.0);
    new TWEEN.Tween(card.scale).to({
      x: '+1',
      y: '+1'
    }, 500).easing(TWEEN.Easing.Bounce.Out).start();
    card.assignSound.play();
    pile.addChild(card);

    var highlight;
    hand.children.some(function (cardInHand) {
        if (cardInHand.id === movie.id) {
          highlight = cardInHand;
        }
        return highlight;
    });

    if (highlight) {
      highlightAndFade(highlight.background, Math.random(), 1.5);
    }
  });

}

//Start a new round
function newRound() {
  socket.emit('requestResetTime');
  stage.removeChild(hand);
  currentUser.cards = getRandomCardList(randomMovies, 5);
  hand = createHand(currentUser.cards, new Point(window.innerWidth * 0.5, window.innerHeight * 0.9), {
    movable: true,
    assignable: true
  });
  stage.addChild(hand);
  socket.emit('userHand', currentUser.username, currentUser.cards);

  table.children.forEach(function (player) {
    player.cards.children.forEach(function (card) {
      if (card.tween) card.tween.stop();
      card.width = card_w * 0.5;
      card.height = card_h * 0.5;
    });
  });
  pile.removeChildren();
}

//Set the variables of the players after being disconnected
function resume(player) {
  display = stage;
  currentUser.score = player.score;
  currentScore.text = player.score;
  currentUser.cards = player.cards;
}

//Show the winner of the game and fade out the background elements
function gameOver() {
  clearInterval(timer);
  var gameOverText = new Text('Thanks for playing!', {
    font: '100px sans-serif',
    fill: 'white'
  });

  var winner =  new Text(table.leader.name + ' wins!', {
      font: '60px sans-serif',
      fill: 'yellow'
  });

  var fade = 1500;

  stage.children.forEach(function (child) {
    new TWEEN.Tween(child).to({
      alpha: 0
    }, fade).onComplete(function () {
      child.visible = false;
    }).start();
  });

  gameOverText.position = new Point((window.innerWidth - gameOverText.width)*0.5, (window.innerHeight - gameOverText.height)*0.5);
  winner.position = new Point((gameOverText.width - winner.width)*0.5, 120);

  gameOverText.addChild(winner);
  stage.addChild(gameOverText);
  gameOverText.scale.set(0,1);
  new TWEEN.Tween(gameOverText.scale).to({
    x: 1.0,
  }).easing(TWEEN.Easing.Bounce.Out).start();
}

//UTILITY FUNCTIONS FOR SHOWING INFORMATION

//Bring the text towards the player
function blowUpText(text, size, container, options) {
  var hex = hslToHex(Math.random(), 1.0, 0.6);
  var showText = new Text(text, {
    font: 'bold '+size+'px sans-serif',
    fill: hex,
    align: 'center'
  });
  options = options || {};
  var delay = options.delay || 0;
  var offset = options.offset || {};
  offset.x = offset.x || 0;
  offset.y = offset.y || 0;
  showText.anchor.set(0.5,0.5);
  showText.scale.set(0.5,0.5);

  if (container.baseContainer) {
    showText.position.set(window.innerWidth * 0.5 + offset.x, window.innerHeight * 0.5 + offset.y);
  } else {
    showText.position.set(offset.x, offset.y);
  }
  showText.alpha = 1;

  new TWEEN.Tween(showText).to({
    alpha: 0.0
  }, 2000).onStart(function () {
    container.addChild(showText);
  }).delay(delay).onComplete(function () {
    container.removeChild(showText);
    if (options.onComplete) options.onComplete();
  }).start();

  new TWEEN.Tween(showText.scale).to({
    x: 1,
    y: 1
  }, 1500).delay(delay).start();
}

//Float some text away from a container
function floatAwayText(text, size, container, options) {
  var hex = hslToHex(Math.random(), 1.0, 0.6);
  var showText = new Text(text, {
    font: size+'px sans-serif',
    fill: hex
  });
  options = options || {};
  var delay = options.delay || 0;
  var offset = options.offset || {};
  offset.x = offset.x || 0;
  offset.y = offset.y || 0;
  showText.anchor.set(0.5,0.5);
  showText.alpha = 1;
  if (container.baseContainer) {
    showText.position.set(window.innerWidth * 0.5 + offset.x, window.innerHeight * 0.5 + offset.y);
  } else {
    showText.position.set(offset.x, -50 + offset.y);
  }

  new TWEEN.Tween(showText).to({
    alpha: 0
  }, 1500).onStart(function () {
    container.addChild(showText);
  }).delay(delay).onComplete(function () {
    container.removeChild(showText);
    if (options.onComplete) options.onComplete();
  }).start();

  new TWEEN.Tween(showText.position).to({
    y: '-150'
  }, 1000).delay(delay).start();
}

//Change component of RGB to HEX
function componentToHex(c) {
  var hex = c.toString(16);
  return hex == 1 ? '0' + hex : hex;
}

//Highlight a sprite with a tint and fade away
function highlightAndFade(sprite, hue, duration_s) {
  duration_s *= 1000;

  var hsl = {
    hue: hue,
    saturation: 1,
    luminosity: 0.6
  };
  sprite.tint = hslToHex(hsl.hue, hsl.saturation, hsl.luminosity);

  new TWEEN.Tween(hsl).to({
    luminosity: 1.0
  }, duration_s).onUpdate(function () {
    sprite.tint = hslToHex(this.hue, this.saturation, this.luminosity);
  }).start();
}

//Highlight the sprite continously with changing colours
function highlightRainbow(sprite) {

  var hsl = {
    hue: 0.0,
    saturation: 1,
    luminosity: 0.6
  };

  var tween = new TWEEN.Tween(hsl).to({
    hue: 1.0
  }, 2000).repeat(Infinity).onUpdate(function () {
    sprite.tint = hslToHex(this.hue, this.saturation, this.luminosity);
  }).onStart(function () {
    sprite.tint = hslToHex(this.hue, this.saturation, this.luminosity);
  }).onStop(function () {
    new TWEEN.Tween(hsl).to({
      luminosity: 1.0
    }, 500).onUpdate(function () {
        sprite.tint = hslToHex(this.hue, this.saturation, this.luminosity);
    }).start();
  });
  return tween;
}

//Convert hsl paramters to an rgb hex notation
function hslToHex(h, s, l){
    var r, g, b;

    if(s === 0){
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    r = componentToHex(Math.round(r * 255));
    g = componentToHex(Math.round(g * 255));
    b = componentToHex(Math.round(b * 255));
    return parseInt(r+g+b, 16);
}


// Queue the information coming so the user can see it 
var queue = 0;
function showInfo(player, info) {
  var options = {};
  options.delay = queue * 500;
  options.onComplete = function () {
    queue--;
  };
  queue++;

  if (player === currentUser.username) {
    blowUpText(info, 60, display, options);
  } else {
    table.children.forEach(function (child) {
      if (player === child.user.username) {
        options.offset = { y: -40 };
        floatAwayText(info, 40, child.score, options);
      }
    });
  }

}
