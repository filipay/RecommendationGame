var movie_div;
var image_url = 'http://image.tmdb.org/t/p/w500';
var placeholder = 'images/placeholder_poster.png';
var results = {};
$('.navbar').hide();


function prepareMovieSearch() {
  movie_div = $('.container.results').find('.row.movies').clone();
  $('#result').hide();
  $('.list-group.search-group').hide();


  $('#search').keypress(function (event) {
    if (event.keyCode === 13) {
      searchMovies();
    }
  });

  if (FB.me.movies) setUserMovies();

  console.log("Prepare finished");
}

function prepareRecommendations(movieList) {
  if (movieList.length > 0) {
    var recommend = $('.container.rec-results').clone();
    var listing = recommend.find('.list-group-item.rec');

    $('.list-group.rec-group').html('');

    if (movieList.length > 0) {
      // console.log(movies.Search);
      results = {};
      movieList.forEach(function(movie) {
        if (movie) {
          results[movie.id] = movie;
          results[movie.id].poster_url = movie.poster_path === null ? placeholder : image_url + movie.poster_path;
          var new_listing = listing.clone();
          new_listing.html(movie.title);
          new_listing.attr('data-movieid', movie.id);
          $('.list-group.rec-group').append(new_listing);
        }
      });
      var movie = movieList[0];

      selectedRecommendation({
        id: movie.id
      });
    }
  }
}

function searchMovies() {
  $('.container.results').hide();
  $('.row.movies').html(movie_div.clone());
  var search = $('input[name=search]').val();
  var search_url = 'http://api.themoviedb.org/3/search/movie?api_key=b98461ec9d721492b95834ab0a23759d&query=' + search;

  var listing = movie_div.find('.list-group-item.search');

  $('.list-group.search-group').html('');
  $.getJSON(search_url, function(movies) {

    if (movies.results.length > 0) {
      // console.log(movies.Search);
      results = {};
      movies.results.forEach(function(movie) {

        results[movie.id] = movie;
        results[movie.id].poster_url = movie.poster_path === null ? placeholder : image_url + movie.poster_path;
        var new_listing = listing.clone();
        new_listing.html(movie.title);
        new_listing.attr('data-movieid', movie.id);

        $('.list-group.search-group').append(new_listing);

      });
      var movie = movies.results[0];

      selectedMovie({
        id: movie.id
      });
    }
    setUserMovies();
    $('.container.results').show();
  });
}


function selectedRecommendation(event) {
  var id = parseInt(event.id) || parseInt($(event.target).attr('data-movieid'));
  var movie = results[id];
  console.log(id);
  $('.title-poster').html(movie.title + ' (' + movie.release_date.substring(0, movie.release_date.indexOf('-')) + ')');

  $('.overview').html(movie.overview);

  $('.img-thumbnail').prop('src', movie.poster_url);

  $('#submit-sel').off('click').on('click', function () {
    var rating = {
      movieId: id,
      rating: parseInt($('select option:selected').html().substr(0,1))
    };
    $('select').prop('selectedIndex',0);
    $('.list-group.rec-group').find('[data-movieid='+ id +']').remove();
    if ($('.list-group-item').first().html()) {
      selectedRecommendation({id: $('.list-group-item').first().attr('data-movieid')});
    }
    socket.emit('updateRating', FB.me.facebook_id, rating);
  });


}
function selectedMovie(event) {
  console.log("movies");
  var id = event.id || parseInt($(event.target).attr('data-movieid'));
  console.log(id);
  var movie = results[id];

  $('.title-poster').html(movie.title + ' (' + movie.release_date.substring(0, movie.release_date.indexOf('-')) + ')');
  if (movie.overview.length > 300) {
    $('.overview').html(movie.overview.substring(0, 300) + "...");
  } else {
    $('.overview').html(movie.overview);
  }
  $('.img-thumbnail').prop('src', movie.poster_url);


  if (FB.me.movies.some(function(m) {
      return m.id === id;
    })) {
    $('#interact').prop('class', 'btn btn-success btn-block disabled');
    $('#interact').unbind('click');
  } else {
    $('#interact').prop('class', 'btn btn-success btn-block');
    $('#interact').unbind('click').click(function(e) {
      $('#interact').prop('class', 'btn btn-success btn-block disabled');
      $('#interact').unbind('click');

      socket.emit('addMovie', movie, FB.me.facebook_id);
      FB.me.movies.unshift(movie);
      setUserMovies();
    });
  }


}

function showGame() {
  if (FB.me.movies.length >= 20) {
    $('.navbar.navbar-default').hide();
    $('#main-screen').html($('#game').html());
  } else {
    alert("You need to have 20 movies or more to play the game!");
  }

}

function showHowTo() {
  $('#nav-how-to').prop('class','active');
  $('#nav-recom').prop('class','inactive');
  $('#nav-movies').prop('class','inactive');
  $('#main-screen').html($('#how-to').html());
}

function showRecommendations() {
  $('#nav-how-to').prop('class','inactive');
  $('#nav-recom').prop('class','active');
  $('#nav-movies').prop('class','inactive');
  $('#main-screen').html($('#recommendations').html());
  socket.emit('fetchRecommendations', FB.me.facebook_id);

}

function showMovies() {
  $('#nav-how-to').prop('class','inactive');
  $('#nav-recom').prop('class','inactive');
  $('#nav-movies').prop('class','active');
  $('#main-screen').html($('#search-movies').html());
  prepareMovieSearch();

}

function setUserMovies() {
  var listing = movie_div.find('.list-group-item.movie');
  var movies = $('.list-group.user-movies');
  movies.html('');

  var button = function (movie) {
    return function(e) {
      socket.emit('removeMovie', movie, FB.me.facebook_id);
      FB.me.movies.pop(movie);
      $(e.target).parent().parent().remove();
    };
  };


  for (var i = 0; i < FB.me.movies.length; i++) {
    var movie = FB.me.movies[i];
    var new_listing = listing.clone();
    new_listing.prepend((i + 1) + '. ' + movie.title);
    new_listing.attr('data-movieid', movie.id);
    new_listing.find('.btn').on('click', button(movie));
    movies.append(new_listing);
  }
}
