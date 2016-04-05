var movie_div;
var image_url = 'http://image.tmdb.org/t/p/w500';
var placeholder = 'images/placeholder_poster.png';
var results = {};
$('.navbar').hide();
function prepareMovieSearch() {
  movie_div = $('.row.movies').clone();

  $('.container.results').hide();

  $("#search").keyup(function(event) {
    if (event.keyCode === 13) {
      searchMovies();
    }
  });

  console.log("Prepare finished");
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

      selected({
        id: movie.id
      });
    }
    setUserMovies();
    $('.container.results').show();
  });
}

function selected(event) {

  var id = event.id || parseInt($(event.target).attr('data-movieid'));
  console.log(id);
  var movie = results[id];

  $('.title-poster').html(movie.title + ' (' + movie.release_date.substring(0, movie.release_date.indexOf('-')) + ')');
  $('.overview').html(movie.overview);
  $('.img-thumbnail').prop('src', movie.poster_url);


  if (FB.me.movies.some(function(m) {
      return m.id === id;
    })) {
    $('#interact').prop('class', 'btn btn-success btn-block disabled');
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

function runGame() {
  $('.navbar.navbar-default').hide();
  $('#main-screen').html($('#game').html());
}


function setUserMovies() {
  var listing = movie_div.find('.list-group-item.movie');
  var movies = $('.list-group.user-movies');
  movies.html('');

  var button = function(e) {
    socket.emit('removeMovie', movie, FB.me.facebook_id);
    FB.me.movies.pop(movie);
    $(e.target).parent().parent().remove();
  };
  for (var i = 0; i < FB.me.movies.length; i++) {
    var movie = FB.me.movies[i];
    console.log(movie);
    var new_listing = listing.clone();
    new_listing.prepend((i + 1) + '. ' + movie.title);
    new_listing.attr('data-movieid', movie.id);
    new_listing.find('.btn').on('click', button);
    movies.append(new_listing);
  }
}
