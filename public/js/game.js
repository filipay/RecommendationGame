/**
 * Created by filip on 14/10/15.
 */

var Container = PIXI.Container,
    TextureCache = PIXI.utils.TextureCache,
    loader = PIXI.loader,
    resources = PIXI.loader.resources,
    Sprite = PIXI.Sprite,
    Graphics = PIXI.Graphics,
    Text = PIXI.Text,
    Point = PIXI.Point;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

var currentUser;


$.getJSON('/user.php', function(data) {
    currentUser = new User(data.name, data.username, data.movies);
    socket.emit('newPlayer', currentUser);
});

var randomMovies = [];

function loadAssets(movies) {
    randomMovies = movies;
    movies.forEach(function(movie) {
        loader.add(movie.poster_url);
    });
    loadPlaceholders();
}

function User(name, username, movieList, avatar) {
    this.name = name;
    this.username = username;
    this.avatar = avatar || 'images/avatar-placeholder.png';
    this.movieList = movieList;
    this.score = 0;
}

var width = 800,
    height = 600;

var renderer = PIXI.autoDetectRenderer(
    width, height, {
        antialiasing: true,
        transparent: false,
        resolution: window.devicePixelRatio,
        autoResize: true
    }
);
var socket = io.connect('http://localhost:3000');
socket.on('updateScore', updateScore);
socket.on('playerJoined', createTable);
socket.on('loadAssets', loadAssets);

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
        .add("movie", "images/movie-placeholder.jpg")
        .add("avatar", "images/avatar-placeholder.png")
        .load(setup);
}

var stage = new Container();

var card_w = 84,
    card_h = 124;


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

function Card(position, movie) {

    var container = new Container();

    for (var key in movie) {
        if (movie.hasOwnProperty(key)) {
            container[key] = movie[key];
        }
    }

    var background = new Sprite(resources.card.texture);
    background.anchor.set(0.5, 0.5);
    container.position = position;

    container.interactive = true;
    container.buttonMode = true;

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
    circle.drawCircle(position.x, position.y, avatar.width * 0.5);
    circle.endFill();

    avatar.mask = circle;

    player.addChild(avatar);
    player.addChild(username);

    return player;

}



function createHand(movies, container, rotation) {
    var hand = new Container();
    hand.position = new Point(container.width * 0.5, container.height * 1.3);
    // var start_x = x - movies.length * card_w * 0.5;

    for (i = 0; i < movies.length; i++) {
        x = i * (card_w + 10);

        var card = Card(new Point(x, 0), movies[i]);
        card.childNo = i;
        hand.addChild(card);
    }
    // hand.rotation = -Math.PI/10.0;
    container.addChildAt(hand, 1);
}


var table = new Container();

function createTable(players) {
    waitingText.visible = false;
    stage.removeChild(table);
    table = new Container();
    var angle_step = players.length > 2 ? -Math.PI / (players.length - 2) : 1;
    var radius = window.innerHeight * 0.5;
    var count = 0;
    players.forEach(function(player) {
        if (player.socket !== socket.id) {
            var angle = angle_step * count;
            var x = radius * Math.cos(angle);
            var y = radius * Math.sin(angle);

            x += window.innerWidth * 0.5;
            y += window.innerHeight - 200;
            console.log(player);
            var seat = Player(new PIXI.Point(x, y), new User(player.name, player.username));
            table.addChild(seat);

            count++;
        }
    });
    stage.addChildAt(table, 0);

}

function setup() {
    stage.addChild(waitingText);
    createHand(randomMovies.slice(0, 4), stage);
    requestAnimationFrame(animate);

}

function animate() {
    requestAnimationFrame(animate);

    renderer.render(stage);
}

function onDragStart(event) {
    // store a reference to the data
    // the reason for this is because of multitouch
    // we want to track the movement of this particular touch
    this.data = event.data;
    this.alpha = 0.8;
    this.dragging = true;
    this.player = undefined;
    this.origin = new PIXI.Point(this.position.x, this.position.y);
}

function onDragEnd() {

    if (this.username) {
        assignCard(this);
    } else {
        this.position = this.origin;
    }

    console.log(this.origin);
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
        isCardOnPlayer(this);
    }
}

function isCardOnPlayer(card) {
    table.children.forEach(function(player) {
        if (player.children[0].containsPoint(card.toGlobal(new Point(0, 0)))) {
            onPlayerHover(player);
            card.assignedTo = player.username;
        } else {
            onPlayerHoverOut(player);
            card.assignedTo = undefined;
        }
    });

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
        assignedTo: card.username,
        movie: card.movie_id
    });

    card.parent.removeChild(card);

}
