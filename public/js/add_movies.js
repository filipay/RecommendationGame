var movie_div;
var image_url = 'http://image.tmdb.org/t/p/w500/';
var placeholder = 'images/placeholder_poster.png';
var results = {};

function prepareMovieSearch() {
  movie_div = $('.row.movies').clone();
  $('.row.movies').html('');

  $("#search").keyup(function(event) {
    if (event.keyCode === 13) {
      searchMovies();
    }
  });
  console.log("Prepare finished");
}

function searchMovies() {
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
        results[movie.id].poster_path = movie.poster_path === null ? placeholder : image_url + movie.poster_path;
        var new_listing = listing.clone();
        new_listing.html(movie.title);
        new_listing.attr('data-movieid', movie.id);

        $('.list-group.search-group').append(new_listing);

      });
      var movie = movies.results[0];

      $('.title-poster').html(movie.title + ' (' + movie.release_date.substring(0, movie.release_date.indexOf('-')) + ')');
      $('.overview').html(movie.overview);

      $('.img-thumbnail').prop('src', movie.poster_path);

      $('.btn-success').click(function(e) {
        movie.me = FB.me;
        socket.emit('updateUser', movie);
      });
    }
  });
}

function selected(event) {

  var html_tags = event.target.outerHTML;
  var begin = html_tags.indexOf('movieid');
  var end = html_tags.indexOf("\">", begin);
  var movie_id = html_tags.substring(begin + 9, end);

  var movie = results[movie_id];

  $('.title-poster').html(movie.title + ' (' + movie.release_date.substring(0, movie.release_date.indexOf('-')) + ')');
  $('.overview').html(movie.overview);

  $('.img-thumbnail').prop('src', movie.poster_path);

  $('.btn-success').unbind('click').click(function(e) {
    movie.me = FB.me;
    socket.emit('updateUser', movie);
  });

}
