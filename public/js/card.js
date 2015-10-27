/**
 * Created by filip on 14/10/15.
 */

var sprite;
Card.card_w = 84;
Card.card_h = 124;

function Card(position, movie) {
    this.sprite = new PIXI.Graphics();
    //this.sprite.lineStyle(4, 0x99CCFF, 1);
    this.sprite.beginFill(0xFFFFFF,1);
    this.sprite.drawRoundedRect(0, 0, 84, 36, 10);
    this.sprite.endFill();
    this.sprite.x = position.x;
    this.sprite.y = position.y;

    this.sprite.addChild(movie);
}

function setAnchor(x, y) {
    this.sprite.anchor = new Point(x, y);
}

function setPosition(x, y) {
    this.sprite.position = new Point(x, y);
}
