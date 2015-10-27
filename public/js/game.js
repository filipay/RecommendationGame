/**
 * Created by filip on 14/10/15.
 */
var Container = PIXI.Container,
    TextureCache = PIXI.utils.TextureCache,
    loader = PIXI.loader,
    resources = PIXI.loader.resources,
    Sprite = PIXI.Sprite,
    Graphics = PIXI.Graphics,
    Text = PIXI.Text;


function Movie(title, poster) {
    this.title = title;
    this.poster = poster;
}

function Position(x, y) {
    this.x = x;
    this.y = y;
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
renderer.view.style.position = "absolute";
renderer.view.style.display = "block";
renderer.resize(window.innerWidth, window.innerHeight);
renderer.backgroundColor = 0x0B5394;

document.body.appendChild(renderer.view);
loader
    .add("card", "images/card.png")
    .add("movie", "images/movie-placeholder.jpg")
    .add("avatar", "images/avatar-placeholder.png")
    .load(setup);

var stage = new Container();

var card_w = 84,
    card_h = 124;

function createCard(x, y, movie_title, movie_poster) {


    var card = new Container();
    var plain_card = new Sprite(resources.card.texture);
    plain_card.anchor.set(0.5, 0.5);
    card.x = x;
    card.y = y;

    card.interactive = true;
    card.buttonMode = true;

    var poster = new Sprite(movie_poster);
    poster.width = card_w * 0.7;
    poster.height = card_h * 0.7;
    poster.anchor.set(0.5, 0.5);

    var title = new PIXI.Text(
        movie_title, {
            font: "10px sans-serif",
            fill: "black"
        }
    );

    title.anchor.set(0.5, 0.5);
    title.position.set(0, -card_h * 0.4);


    card
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

    card.addChild(plain_card);
    card.addChild(poster);
    card.addChild(title);
    return card;
}

var hand = new Container();

function createHand(size) {
    var x = window.innerWidth * 0.5,
        y = window.innerHeight - card_h * 0.5 - 10;

    var start_x = x - size * card_w * 0.5;

    for (i = 0; i < size; i++) {
        x = start_x + i * (card_w + 10);
        var card = createCard(x, y, "Sherlock Holmes", resources.movie.texture);
        card.childNo = i;
        hand.addChild(card);
        console.log(card.childNo);
    }
    stage.addChild(hand);
}

function createPlayer(x, y, profiler, name) {
    var avatar = new Sprite(profiler);
    avatar.position.set(x, y);
    avatar.anchor.set(0.5, 0.5);
    avatar.width = avatar.height = window.innerHeight * 0.15;

    var username = new Text(
        name, {
            font: "20px sans-serif",
            fill: "white"
        }
    );
    username.anchor.set(0.5, 0.5);
    username.position.set(x, y - avatar.height * 0.7);


    var circle = new Graphics();
    circle.lineStyle(0);
    circle.beginFill(0xFFFF0B, 0.5);
    circle.drawCircle(x, y, avatar.width * 0.5);
    circle.endFill();

    avatar.mask = circle;

    var player = new Container();
    player.addChild(avatar);
    player.addChild(username);

    return player;

}

var table = new Container();

function createTable(size) {
    var angle_step = -Math.PI / (size - 1);
    var radius = window.innerHeight * 0.5;

    for (var i = 0; i < size; i++) {
        var x = radius * Math.cos(angle_step * i);
        var y = radius * Math.sin(angle_step * i);

        x += window.innerWidth * 0.5;
        y += window.innerHeight - 200;
        var player = createPlayer(x, y, resources.avatar.texture, "Name");
        table.addChild(player);
    }
    stage.addChild(table);
}

function setup() {

    createTable(5);
    createHand(5);
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
    this.contact = false;
    this.origin = new PIXI.Point(this.position.x, this.position.y);
}

function onDragEnd() {

    if (this.contact) {
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
        this.contact = cardOnPlayer(this);
    }


}

function cardOnPlayer(card) {
    var contains = false;
    for (child in table.children) {
        if (table.children.hasOwnProperty(child)) {
            var player = table.children[child];
            if (player.children[0].containsPoint(new PIXI.Point(card.position.x, card.position.y))) {
                onPlayerHover(player);
                contains = true;
            } else {
                onPlayerHoverOut(player);
            }
        }
    }
    return contains;
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
    for (i = card.childNo + 1; i < hand.children.length; i++) {
        hand.children[i].childNo--;
    }

    hand.removeChildAt(card.childNo);
}