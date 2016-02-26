<?php
    include_once 'includes/db_connect.php';
    include_once 'includes/functions.php';

    sec_session_start();

    if (login_check($mysqli)) {
        if ($stmt = $mysqli->prepare('SELECT movies.* FROM movies, user_movies
            WHERE user_movies.user_id = ? AND user_movies.movie_id = movies.movie_id')) {
            $stmt->bind_param('i', $_SESSION['user_id']);
            $stmt->execute();
            $result = $stmt->get_result();
            $movies = [];
            while ($movie = $result->fetch_object()) {
                $movies[] = $movie;
            }
            $user = (object) array('name' => $_SESSION['name'],
                                    'username' => $_SESSION['username'],
                                    'movies' => $movies, );
            echo json_encode($user);
        }
    } else {
        //TODO DEVELOPMENT ONLY
        if ($_GET['user_id']) {
            if ($stmt = $mysqli->prepare('SELECT movies.* FROM movies, user_movies
                WHERE user_movies.user_id = ? AND user_movies.movie_id = movies.movie_id')) {
                $stmt->bind_param('i', $_GET['user_id']);
                $stmt->execute();
                $result = $stmt->get_result();
                $movies = [];
                while ($movie = $result->fetch_object()) {
                    $movies[] = $movie;
                }
                $stmt = $mysqli->prepare('SELECT users.name, users.username FROM users WHERE users.id = ?');
                $stmt->bind_param('i', $_GET['user_id']);
                $stmt->execute();
                $user = $stmt->get_result()->fetch_row();

                $user = (object) array('name' => $user[0],
                                        'username' => $user[1],
                                        'movies' => $movies, );
                echo json_encode($user);
            }
        }
        // $error = (object) array('response' => 401, 'error' => 'User not logged in');
        // echo json_encode($error);
    }