// create an array of assets to load
var assetsToLoad = ["https://dl.dropboxusercontent.com/u/139992952/coffee.png",
'http://ia.media-imdb.com/images/M/MV5BMzg2Mjg1OTk0NF5BMl5BanBnXkFtZTcwMjQ4MTA3Mw@@._V1_SX300.jpg'];

// create a new loader
loader = PIXI.loader;
loader.on('progress', function (loader, loadedResource) {
    console.log("Loading " + loader.progress);
});
// use callback

loader.add(assetsToLoad).load(onAssetsLoaded);
// $.getJSON('/user.php', function(data) {
//     me = data;
//     data.movies.forEach(function (movie) {
//         assetsToLoad.push(movie.poster_url);
//     });
//     loader.add(assetsToLoad).load(onAssetsLoaded);
// });


// create an new instance of a pixi stage
var stage = new PIXI.Stage(0xFFFFFF);

// create a renderer instance
var renderer = new PIXI.CanvasRenderer(1024, 640);


// add render view to DOM
document.body.appendChild(renderer.view);

var postition = 0;
var background;
var background2;





function onAssetsLoaded(){
    background = PIXI.Sprite.fromImage("https://dl.dropboxusercontent.com/u/139992952/coffee.png");

    background.x = 100;
    background.y = 200;

    var tween = new TWEEN.Tween({
        x: background.x,
        y: background.y
    }).to({
        x: background.x + 100,
        y: background.y + 200
    }, 1000).onUpdate(function () {
        background.x = this.x;
        background.y = this.y;
    }).easing(TWEEN.Easing.Back.Out)
    .start();




    // child = PIXI.Sprite.fromImage("http://ia.media-imdb.com/images/M/MV5BMzg2Mjg1OTk0NF5BMl5BanBnXkFtZTcwMjQ4MTA3Mw@@._V1_SX300.jpg");
    stage.addChild(background);
    // stage.addChild(child);
    // assetsToLoad.forEach(function (movie) {
    //     stage.addChild(PIXI.Sprite.fromImage(movie));
    // });
    requestAnimationFrame( animate );
}

function animate(time) {
    requestAnimationFrame( animate );
    renderer.render(stage);
    TWEEN.update(time);
}
