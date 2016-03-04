/**
 * Created by filip on 14/10/15.
 */
var randomMovies = [];
var currentUser;
var cards;

var width = 800,
  height = 600;

var Container = PIXI.Container,
  MovieClip = PIXI.extras.MovieClip,
  TextureCache = PIXI.utils.TextureCache,
  loader = PIXI.loader,
  resources = PIXI.loader.resources,
  Sprite = PIXI.Sprite,
  Graphics = PIXI.Graphics,
  Text = PIXI.Text,
  Point = PIXI.Point;

var socket = io.connect('http://localhost:3000');
socket.on('updateScore', updateScore);
socket.on('playerJoined', createTable);
socket.on('loadAssets', loadAssets);
socket.on('placeOnPile', placeOnPile);
socket.on('createPile', createPile);
socket.on('gameSize', gameSize);
socket.on('newRound', newRound);
socket.on('resume', resumeCards);

var renderer = PIXI.autoDetectRenderer(
  width, height, {
    antialias: true,
    transparent: false,
    resolution: window.devicePixelRatio,
    autoResize: true
  }
);

renderer.view.style.position = "absolute";
renderer.view.style.display = "block";
renderer.resize(window.innerWidth, window.innerHeight);
renderer.backgroundColor = 0x0B5394;

document.body.appendChild(renderer.view);

var cardPlaceSound = ['/sounds/cardPlace1.wav','/sounds/cardPlace2.wav','/sounds/cardPlace3.wav','/sounds/cardPlace4.wav'];
var cardAssignSound = ['/sounds/cardSlide1.wav','/sounds/cardSlide2.wav','/sounds/cardSlide3.wav','/sounds/cardSlide4.wav','/sounds/cardSlide5.wav','/sounds/cardSlide6.wav','/sounds/cardSlide7.wav','/sounds/cardSlide8.wav'];
var cardFeelSound = ['/sounds/cardShove1.wav','/sounds/cardShove2.wav','/sounds/cardShove3.wav','/sounds/cardShove4.wav'];
var stage = new Container();
var loadingText = new MovieClip.fromImages('images/start_game.mp4');//new Text(
//   "Loading...", {
//     font: "40px sans-serif",
//     fill: "white"
//   });
loadingText.position = new Point();
loadingText.width = window.innerWidth;
loadingText.height = window.innerHeight;
var display = new Container();

display.addChild(loadingText);
requestAnimationFrame(animate);
loadingText.play();

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDouble(min, max) {
  return Math.random() * (max - min) + min;
}

function gameSize(size) {
  $.getJSON('/user.php?user_id=' + (size + 2), function(data) {
    currentUser = new User(data.name, data.username, data.movies);
    socket.emit('joinGame', currentUser);
  });
}

socket.emit('gameSize');

// $.getJSON('/user.php?user_id=' + (socket.emit('gameSize') + 1), function(data) {
//     currentUser = new User(data.name, data.username, data.movies);
//     socket.emit('joinGame', currentUser);
// });


function loadAssets(movies) {
  randomMovies = movies;
  movies.forEach(function(movie) {
    loader.add(movie.poster_url);
  });
  loadPlaceholders();
}

function User(name, username, movieList, avatar) {
  this.name = name || username;
  console.log(name);
  this.username = username;
  this.avatar = avatar || 'images/avatar-placeholder.png';
  this.movieList = movieList;
  this.score = 0;
}


$(window).on('beforeunload', function() {
  socket.close();
});


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
  new TWEEN.Tween(currentScore.scale).to({
    x: 1.2,
    y: 1.2
  }, 200).repeat(1).yoyo(true).start();
}

function loadPlaceholders() {
  loader
    .add("card", "images/card.png")
    .add("blank_card", "images/back_card.png")
    .add("avatar", "images/avatar-placeholder.png")
    .add("background", "images/background.jpg")
    .load(setup);
}


var card_w = 84,
    card_h = 124;
// var card_w = 80;
// var card_h = card_w * 16.0 / 9.0;


var score = new PIXI.Text(
  "Your score : ", {
    font: "40px sans-serif",
    fill: "white"
  }
);

var time = 30;
var timeText = new PIXI.Text('0', {
    font: "40px sans-serif",
    fill: "white"
  });
timeText.position.x = 50;
timeText.position.y = 110;
function startTime() {
  setInterval(updateTime, 1000);
}
function updateTime() {
  time--;
  if (time < 0) {
    socket.emit('outOfCards');
  }
  var seconds = time % 60;
  var minutes = parseInt(time / 60);

  timeText.text = minutes + " : " + seconds;

}


currentScore = new PIXI.Text('0', {
    font: "40px sans-serif",
    fill: "white"
  });

score.addChild(currentScore);
currentScore.position.x = score.width;
currentScore.scale.set(1,1);
score.position.set(50, 50);
stage.addChild(score);
stage.addChild(timeText);

startTime();

// var waitingText = new PIXI.Text(
//   "Waiting for players...", {
//     font: "40px sans-serif",
//     fill: "white"
//   }
// );
// waitingText.position.set(window.innerWidth * 0.5, window.innerHeight * 0.5);
// waitingText.anchor.set(0.5, 0.5);
// stage.addChild(waitingText);


function BlankCard(position, rotation) {
  var background = new Sprite(resources.card.texture);
  background.position = position;
  background.anchor.set(0.5, 0.5);
  background.scale.set(0.5, 0.5);
  background.rotation = rotation || 0;
  var sticker = new Sprite(resources.blank_card.texture)  ;
  sticker.anchor.set(0.5, 0.5);
  sticker.scale.set(0.9, 0.9);
  background.addChild(sticker);
  return background;
}

function Card(position, movie, options, rotation) {

  var container = new Container();
  container.position.x = position.x;
  container.position.y = position.y;
  container.rotation = rotation || 0;

  container.interactive = true;
  container.buttonMode = true;

  container.movable = options.movable;
  container.droppable = options.droppable;
  container.placeSound = new Howl({
    urls: [cardPlaceSound[getRandomInt(0,cardPlaceSound.length-1)]]
  });
  container.assignSound = new Howl({
    urls: [cardAssignSound[getRandomInt(0,cardAssignSound.length-1)]]
  });
  container.lookAtSound = new Howl({
    urls: [cardFeelSound[getRandomInt(0,cardFeelSound.length-1)]]
  })
  for (var key in movie) {
    if (movie.hasOwnProperty(key)) {
      container[key] = movie[key];
    }
  }

  var background = new Sprite(resources.card.texture);
  background.anchor.set(0.5, 0.5);

  var poster = new Sprite.fromImage(movie.poster_url);
  poster.width = card_w * 0.7;
  poster.height = card_h * 0.7;
  poster.anchor.set(0.5, 0.5);
  if (movie.title.length > 15) {
    movie.title = movie.title.substring(0, 12) + "...";
  }
  var title = new PIXI.Text(movie.title, {
    font: "10px sans-serif",
    fill: "black"
  });
  title.anchor.set(0.5, 0.5);
  title.position.set(0, -card_h * 0.4);

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

function Player(position, user) {
  var player = new Container();
  player.position.x = position.x;
  player.position.y = position.y;
  player.username = user.username;

  var avatar = new Sprite.fromImage(user.avatar);
  avatar.anchor.set(0.5, 0.5);
  avatar.width = avatar.height = window.innerHeight * 0.15;

  var username = new Text(
    user.name, {
      font: "20px sans-serif",
      fill: "white"
    }
  );
  username.anchor.set(0.5, 0.5);
  username.position.set(0, -avatar.height * 0.7);

  var circle = new Graphics();
  circle.lineStyle(0);
  circle.beginFill(0xFFFF0B, 0.5);
  circle.drawCircle(0, 0, avatar.width + 10);
  circle.endFill();
  avatar.addChild(circle);
  avatar.mask = circle;

  player.addChild(avatar);
  player.addChild(username);
  // player.addChild(BlankCard(new Point(0, )));
  player.addChild(createHand(getBlankCardsList(5), new Point(0, avatar.height * 0.7), {
    blank: true,
    space: -50
  }));


  return player;
}

function createHand(movies, position, options, rotation) {
  var start_angle = 150, end_angle = 210;
  var hand = new Container();
  var space = options.space || 10;
  hand.position = position;
  hand.position.x -= (movies.length-1) * (card_w+space) * 0.5;
  var origin = new Point(hand.position.x, 200);
  var rad_diff = (end_angle * Math.PI / 180) - (start_angle * Math.PI / 180);
  console.log(rad_diff);
  var rad_step = rad_diff / movies.length;


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
    }, 100).easing(TWEEN.Easing.Elastic.Out).delay(200).onComplete(function () {
        card.placeSound.play();
    }).start();
    }
    hand.addChild(card);
  }

  hand.rotation = rotation || 0;
  return hand;
}


var table = new Container();

function createTable(players) {

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
      var seat = Player(origin, new User(player.name, player.username));
      new TWEEN.Tween(seat.position).to({
        x: point.x,
        y: point.y
      }, 600).easing(TWEEN.Easing.Elastic.Out).start();
      table.addChild(seat);
      count++;
    }
  });
  stage.addChildAt(table, 2);

}
var pile = new Container();

function createPile(position, size) {
  // console.log(size.width);

  // console.log(pile.width);

  // pile = new Graphics();
  pile = new Sprite.fromImage('images/table.png');
  pile.position = position;
  pile.width = size.width;
  pile.height = size.height;
  // pile.beginFill(0x0b8c00);
  // pile.lineStyle(2, 0xffffff);
  // pile.drawRoundedRect(0, 0, size.width, size.height);
  // console.log(pile.width + ' = pile widht, ' + pile.height + ' = pile.height');
  // pile.endFill();
  // pile.width = size.width;
  // pile.height = size.height;
  return pile;
}


function setup() {
  if (!cards) {
    cards = getRandomCardList(randomMovies, 5);
    socket.emit('userHand', currentUser.username, cards);
  }
  var background = new Sprite.fromImage('images/background.jpg');
  background.alpha = 0.1;
  background.width = window.innerWidth;
  background.height = window.innerHeight;

  stage.addChildAt(background,0);
  stage.addChildAt(createPile(
    new Point((window.innerWidth - 500) * 0.5, (window.innerHeight - 500) * 0.5), {
      width: 500,
      height: 500
    }), 1);
  hand = createHand(cards, new Point(window.innerWidth * 0.5, window.innerHeight * 0.9), {
    movable: true,
    droppable: true
  });
  stage.addChildAt(hand, stage.children.length - 1);

  socket.emit('requestPile');
  socket.emit('requestTable');
  display = stage;
  requestAnimationFrame(animate);

}

function animate(time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
  renderer.render(display);
}

function getRandomCardList(movies, size) {
  console.log('m len : ' + movies.length);
  console.log('size : ' + size);
  size = movies.length < size ? movies.length : size;
  var list = [];

  for (var i = 0; i < size; i++) {
    // console.log(movies);
    var index = getRandomInt(0, movies.length - 1);
    list.push(movies[index]);

    movies.splice(index, 1);
  }
  // console.log(list);
  return list;
}

function getBlankCardsList(size) {
  var movies = [];
  for (var i = 0; i < size; i++) {
    movies.push({
      blank: true
    });
  }
  return movies;
}


function onDragStart(event) {
  // store a reference to the data
  // the reason for this is because of multitouch
  // we want to track the movement of this particular touch
  if (this.movable) {
    this.data = event.data;
    this.alpha = 0.8;
    this.dragging = true;
    this.player = undefined;
    this.origin = new PIXI.Point(this.position.x, this.position.y);
  }
}

function onDragEnd() {
  this.assignSound.play();
  if (this.assignedTo) {
    assignCard(this);
    onPlayerHoverOut(this.assignedTo);
    new TWEEN.Tween(this.assignedTo.children[0].scale).to({
      x: 0.5,
      y: 0.5
    },200).repeat(1).yoyo(true).start();
  } else {
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


function onDragMove() {

  if (this.dragging) {
    var newPosition = this.data.getLocalPosition(this.parent);

    this.position.x = newPosition.x;
    this.position.y = newPosition.y;
    if (this.droppable) isCardOnPlayer(this);
  }
}

function isCardOnPlayer(card) {
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
  console.log(card.assignedTo);
}

function onPlayerHover(player) {
  player.getChildAt(1).style = {
    font: "20px sans-serif",
    fill: "yellow"
  };
}

function onPlayerHoverOut(player) {
  player.getChildAt(1).style = {
    font: "20px sans-serif",
    fill: "white"
  };
}

function assignCard(card) {
  console.log(card);
  socket.emit('assignCard', {
    assignedBy: currentUser.username,
    assignedTo: card.assignedTo.username,
    movie_id: card.movie_id
  });
  if (card.parent.children.length == 1) {
    socket.emit('outOfCards');
  }
  card.parent.removeChild(card);
}

function placeOnPile(movies) {
  // if (!pile.children.some(function(m) {
  //         return m.movie_id === movie.movie_id;
  //     })) {
  console.log(movies);
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
    card.scale.set(0.0,0.0);
    new TWEEN.Tween(card.scale).to({
      x: "+1",
      y: "+1"
    }, 500).easing(TWEEN.Easing.Bounce.Out).start();
    pile.addChild(card);
  });

}

function newRound() {
  time = 30;
  stage.removeChild(hand);
  cards = getRandomCardList(randomMovies, 5);
  hand = createHand(cards, new Point(window.innerWidth * 0.5, window.innerHeight * 0.9), {
    movable: true,
    droppable: true
  });
  stage.addChild(hand);
  socket.emit('userHand', currentUser.username, cards);
  pile.removeChildren();

}

function resumeCards(oldCards) {
  cards = oldCards;
}
