/**
 * Created by filip on 16/10/15.
 */
//Aliases
var Container = PIXI.Container,
    autoDetectRenderer = PIXI.autoDetectRenderer,
    loader = PIXI.loader,
    resources = PIXI.loader.resources,
    Sprite = PIXI.Sprite;

//Create a Pixi stage and renderer and add the
//renderer.view to the DOM
var stage = new Container(),
    renderer = autoDetectRenderer(256, 256);
document.body.appendChild(renderer.view);

//load an image and run the `setup` function when it's done
loader
    .add("js/images/bunny.png")
    .load(setup);

function setup() {

    //Create the `cat` sprite, add it to the stage, and render it
    var cat = new Sprite(resources["js/images/bunny.png"].texture);
    stage.addChild(cat);
    renderer.render(stage);
}