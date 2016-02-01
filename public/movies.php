<?php

include_once 'includes/db_connect.php';
include_once 'includes/functions.php';

sec_session_start();
?>
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>Movies you like</title>
        <link rel="stylesheet" href="styles/main.css" />
        <script src="//code.jquery.com/jquery-1.12.0.min.js"></script>
        <script src="//code.jquery.com/jquery-migrate-1.2.1.min.js"></script>
        <script src="/js/add_movies.js"></script>
    </head>
    <body>
        <?php if (login_check($mysqli)) : ?>

        <input type="text" placeholder="Search movie" name="search"/>
        <input type="submit" onClick="searchMovies()"/>
        <div class="results">
            <div class="movie">
                <div>
                    <img class="poster" src="/img/placeholder_poster.png">
                </div>
                <div class="title"></div>
                <button type="button">+</button>
            </div>
        </div>
        <?php else : ?>
            <h1>You're not autharized to view this page</h1>
            <p>
                Please <a href="index.php">login</a>
            </p>
        <?php endif;?>
    </body>
</html>
