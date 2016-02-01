<?php
include_once 'db_connect.php';
include_once 'functions.php';

sec_session_start(); // Our custom secure way of starting a PHP session.

if(login_check($mysqli)) {
    if(isset($_POST['movie_id'],$_POST['title'],$_POST['poster'])) {
        $movie_id = $_POST['movie_id'];
        $title = $_POST['title'];
        $poster = $_POST['poster'];

        $stmt = $mysqli->prepare('SELECT movie_id FROM movies WHERE movie_id = ? LIMIT 1');
        $stmt->bind_param('s',$movie_id);

        $stmt = $mysqli->prepare('INSERT INTO movies (movie_id, title, poster_url)
        VALUES (?,?,?)');
        $stmt->bind_param('sss',$movie_id,$title,$poster);
        $stmt->execute();

        $stmt = $mysqli->prepare('INSERT INTO user_movies (user_id, movie_id)
        VALUES (?,?)');
        $stmt->bind_param('ss',$_SESSION['user_id'], $movie_id);
        $stmt->execute();

        echo 200;
    }
} else {
    echo 403;
}
