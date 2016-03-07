var movie_div;
var image_url = 'http://image.tmdb.org/t/p/w500/';
var placeholder = 'images/placeholder_poster.png';
var results = {};
var socket;

function prepareMovieSearch() {
  socket = io.connect();
  movie_div = $('.row.movies').clone();
  console.log(movie_div);

  $("#search").keyup(function(event){
      if(event.keyCode === 13){
          searchMovies();

      }
  });
  console.log("Prepare finished");
}

function searchMovies() {

  var search = $('input[name=search]').val();
  var search_url = 'http://api.themoviedb.org/3/search/movie?api_key=b98461ec9d721492b95834ab0a23759d&query='+search;

  var listing = movie_div.find('.list-group-item');

  $('.list-group').html('');
  $.getJSON(search_url, function(movies) {

    if (movies.results.length > 0) {
      // console.log(movies.Search);
      var first_movie = movies.results[0];
      $('.title-poster').html(first_movie.title);
      if (first_movie.poster_path) {
        $('.img-thumbnail').prop('src', image_url + first_movie.poster_path);
      }

      $('.overview').html(first_movie.overview);

      results = {};
      movies.results.forEach(function(movie) {
        results[movie.id] = movie;
        var new_listing = listing.clone();
        new_listing.html(movie.title);
        new_listing.attr('data-movieid', movie.id);

        $('.list-group').append(new_listing);


        // $('button:last').click(function(e) {
        //   var movie_details = {
        //     movie_id: movie.id,
        //     title: movie.title,
        //     poster: image_url + movie.poster_path
        //   };
          // $.post('includes/add_movie.php', movie_details, function(result) {
          //   console.log(result);
          // });
        // });
      });
    } else {
      // $('.results').html('<h1> No results found </h1>');
    }
  });
}

function selected(event) {

  var html_tags = event.target.outerHTML;
  var begin = html_tags.indexOf('movieid');
  var end = html_tags.indexOf("\">",begin);
  var movie_id = html_tags.substring(begin+9, end);

  var movie = results[movie_id];
  console.log(movie.overview);
  $('.title-poster').html(movie.title);
  $('.overview').html(movie.overview);
  if (movie.poster_path !== null) {
      $('.img-thumbnail').prop('src', image_url + movie.poster_path);
  } else {
      $('.img-thumbnail').prop('src', placeholder);
  }
  $('.btn-success').click(function (e) {
    socket.emit('updateUser', movie);
  });


}
