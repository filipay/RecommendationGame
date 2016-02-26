/**
 * Created by filip on 14/10/15.
 */
var randomMovies = [];
var currentUser;
var cards;

var Container = PIXI.Container,
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

var width = 800,
    height = 600;

var renderer = PIXI.autoDetectRenderer(
    width, height, {
        antialias: true,
        transparent: false,
        resolution: window.devicePixelRatio,
        autoResize: true
    }
);


$(window).on('beforeunload', function() {
    socket.close();
});


function updateScore(data) {
    currentUser.score += data.score;
    currentScore.text = "Your score: " + currentUser.score;
}

renderer.view.style.position = "absolute";
renderer.view.style.display = "block";
renderer.resize(window.innerWidth, window.innerHeight);
renderer.backgroundColor = 0x0B5394;

document.body.appendChild(renderer.view);

function loadPlaceholders() {
    loader
        .add("card", "images/card.png")
        .add("blank_card", "images/back_card.png")
        .add("avatar", "images/avatar-placeholder.png")
        .load(setup);
}

var stage = new Container();

var card_w = 84,
    card_h = 124;
// var card_w = 80;
// var card_h = card_w * 16.0 / 9.0;


var currentScore = new PIXI.Text(
    "Your score : 0", {
        font: "40px sans-serif",
        fill: "white"
    }
);

currentScore.position.set(50, 50);
stage.addChild(currentScore);

var waitingText = new PIXI.Text(
    "Waiting for players...", {
        font: "40px sans-serif",
        fill: "white"
    }
);
waitingText.position.set(window.innerWidth * 0.5, window.innerHeight * 0.5);
waitingText.anchor.set(0.5, 0.5);
stage.addChild(waitingText);


function BlankCard(position) {
    var background = new Sprite(resources.blank_card.texture);
    background.anchor.set(0.5, 0.5);

    return background;
}


function Card(position, movie, options, rotation) {

    var container = new Container();
    container.position = position;
    container.rotation = rotation || 0;

    container.interactive = true;
    container.buttonMode = true;

    container.movable = options.movable;
    container.droppable = options.droppable;

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
            this.scale.x = 1.1;
            this.scale.y = 1.1;
        })
        .on('mouseout', function() {
            this.scale.x = 1;
            this.scale.y = 1;
        });

    container.addChild(background);
    container.addChild(poster);
    container.addChild(title);

    return container;
}

function Player(position, user) {
    var player = new Container();
    player.position = position;
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
    circle.drawCircle(0,0, avatar.width + 10);
    circle.endFill();
    avatar.addChild(circle);
    avatar.mask = circle;

    player.addChild(avatar);
    player.addChild(username);

    return player;
}
var hand = new Container();
function createHand(movies, container, position, options, rotation) {
    hand.position = position;

    for (i = 0; i < movies.length; i++) {
        x = i * (card_w + 10);

        var card = Card(new Point(x, 0), movies[i], options);
        hand.addChild(card);
    }
    hand.position.x -= hand.width * 0.5 - 10;
    hand.rotation = rotation || 0;
    container.addChildAt(hand, 2);
}


var table = new Container();

function createTable(players) {
    waitingText.visible = false;
    stage.removeChild(table);
    table = new Container();
    var angle_step = players.length > 2 ? -Math.PI / players.length : -Math.PI * 0.5;//-Math.PI * 0.5;
    var radius = window.innerHeight * 0.5;
    var count = 1;
    players.forEach(function(player) {
        if (player.username !== currentUser.username) {
            var angle = angle_step * count;
            var x = radius * Math.cos(angle);
            var y = radius * Math.sin(angle);

            x += window.innerWidth * 0.5;
            y += window.innerHeight - 200;
            var point = new PIXI.Point(x, y);
            var seat = Player(point, new User(player.name, player.username));
            // createHand(getRandomCardList(randomMovies, 5), seat, new Point(0,0), undefined);
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

    pile = new Graphics();
    pile.position = position;

    pile.beginFill(0x0b8c00);
    pile.lineStyle(2, 0xffffff);
    pile.drawRoundedRect(0, 0, size.width, size.height);
    // console.log(pile.width + ' = pile widht, ' + pile.height + ' = pile.height');
    pile.endFill();
    // pile.width = size.width;
    // pile.height = size.height;
    return pile;
}


function setup() {
    if (!cards) {
        cards = getRandomCardList(randomMovies, 5);
        socket.emit('userHand', currentUser.username, cards);

    }
    stage.addChild(waitingText);
    stage.addChildAt(createPile(
        new Point((window.innerWidth - 500) * 0.5, (window.innerHeight - 500) * 0.5), {
            width: 500,
            height: 500
        }), 0);
    createHand(cards, stage, new Point(window.innerWidth * 0.5, window.innerHeight * 0.9), {
        movable: true,
        droppable: true
    });
    socket.emit('requestPile');
    socket.emit('requestTable');
    requestAnimationFrame(animate);

}

function animate() {
    requestAnimationFrame(animate);

    renderer.render(stage);
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
        movies.push();
    }
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
    console.log(this.position);
    if (this.assignedTo) {
        assignCard(this);
    } else {
        this.position = this.origin;
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
        if (player.children[0].containsPoint(card.toGlobal(new Point(0, 0)))) {
            onPlayerHover(player);
            return (card.assignedTo = player.username);
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
        assignedTo: card.assignedTo,
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
    movies.forEach(function (movie) {
        var x = getRandomInt(0 + padding.x, pile.width - padding.x),
            y = getRandomInt(0 + padding.y, pile.height - padding.y),
            rotation = getRandomDouble(-0.5, 0.5);

        var card = Card(new Point(x, y), movie, {movable: true}, rotation);

        pile.addChild(card);
    });

    // }

}

function newRound() {
    stage.removeChild(hand);
    createHand(getRandomCardList(randomMovies, 5), stage, new Point(window.innerWidth * 0.5, window.innerHeight * 0.9), {
        movable: true,
        droppable: true
    });
    pile.removeChildren();

}

function resumeCards(oldCards) {
    cards = oldCards;
}
