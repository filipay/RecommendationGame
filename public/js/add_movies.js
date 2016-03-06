var movie_div;

function prepareMovieSearch() {
  movie_div = $('.movie').clone();

  $('.results').html('');
  console.log("Prepare finished");
}

function searchMovies() {
  console.log('searching...');
  var search = $('input[name=search]').val();
  var search_url = 'http://www.omdbapi.com/?s=' + search + '&type=movie&r=json';
  console.log(search);
  $('.results').html('');

  $.getJSON(search_url, function(movies) {
    console.log(movies);
    if (movies.Search) {
      // console.log(movies.Search);
      movies.Search.forEach(function(movie) {
        $('.results').append(movie_div.clone());
        $('.title:last').html(movie.Title + ' (' + movie.Year + ')');
        if (movie.Poster.indexOf('http') > -1) {
          $('.poster:last').prop('src', movie.Poster);
        }
        $('button:last').click(function(e) {
          var movie_details = {
            movie_id: movie.imdbID,
            title: movie.Title,
            poster: movie.Poster
          };
          // $.post('includes/add_movie.php', movie_details, function(result) {
          //   console.log(result);
          // });
        });
      });
    } else {
      $('.results').html('<h1> No results found </h1>');
    }
  });
}
