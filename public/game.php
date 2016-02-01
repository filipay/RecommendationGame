<?php

include_once 'includes/db_connect.php';
include_once 'includes/functions.php';

sec_session_start();
?>
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>Game</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                background-color: #000000;
            }
        </style>
        <!-- <link rel="stylesheet" href="styles/main.css" /> -->
        <script src="//code.jquery.com/jquery-1.12.0.min.js"></script>
        <script src="//code.jquery.com/jquery-migrate-1.2.1.min.js"></script>
        <script src="/js/pixi.js"></script>
        <script src="/js/tween.js"></script>
    </head>
    <body>
        <?php if (login_check($mysqli)) : ?>
            <script src="http://localhost:3000/socket.io/socket.io.js"></script>
            <script src="js/game.js"></script>
        <?php else : ?>
            <h1>You need to be logged in to access this page</h1>
            <p>
                Please <a href="/index.php">login.</a>
            </p>
        <?php endif; ?>
    </body>
</html>
