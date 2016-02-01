var Container = PIXI.Container,
    TextureCache = PIXI.utils.TextureCache,
    loader = PIXI.loader,
    resources = PIXI.loader.resources,
    Sprite = PIXI.Sprite,
    Graphics = PIXI.Graphics,
    Text = PIXI.Text;

var me;

function Player(name, username, avatar) {
    this.name = name;
    this.username = username;
    this.avatar = avatar || new Sprite.fromImage('images/avatar-placeholder.png');
}

function Card(imdbID, movie_title, poster_url) {
    this.imdbID = imdbID;
    this.title = title;
    this.poster = poster;

    this.container = new Container();
    var background = new Sprite(resources.card.texture);
    background.anchor.set(0.5, 0.5);
    this.container.position.set(x, y);

    this.container.interactive = true;
    this.container.buttonMode = true;

    var poster = new Sprite.fromImage(poster_url);
    poster.scale(0.7);
    poster.anchor.set(0.5, 0.5);

    var title = new Text(movie_title, {
        font: "10px sans-serif",
        fill: "black"
    });
    title.anchor.set(0.5, 0.5);
    title.anchor.set(0, -poster.width * 0.4);

    this.container
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

    this.container.addChild(background);
    this.container.addChild(poster);
    this.container.addChild(title);
}
var assetsToLoad = [];
$.getJSON('/user.php', function(data) {
    me = data;
    data.movies.forEach(function (movie) {
        assetsToLoad.push(movie.poster_url);
    });
    loader.add(assetsToLoad).load(onAssetsReady);
});
