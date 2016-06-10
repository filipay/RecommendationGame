/**

Script concering itself with connecting with the Facebook Graph API.
Sends relevant info to backend
This is mostly based on the template provided by FB

**/

var socket;
var user;

function statusChangeCallback(response) {
  // The response object is returned with a status field that lets the
  // app know the current login status of the person.
  // Full docs on the response object can be found in the documentation
  // for FB.getLoginStatus().
  $('.navbar').show();
  console.log(response);
  if (response.status === 'connected') {
    // Logged into your app and Facebook.
    var button = $('#fb-btn');
    button.html('Logout');
    button.attr('onclick', 'logout();');

    socket = io.connect();
    socket.on('setUser', setUser);
    socket.on('recList', prepareRecommendations);

    $('#main-screen').html($('#search-movies').html());
    getUserInfo();
    prepareMovieSearch();
  } else if (response.status === 'not_authorized') {
    // The person is logged into Facebook, but not your app.
    $('#main-screen').html('Please log into this app.');
  } else {
    // The person is not logged into Facebook, so we're not sure if
    // they are logged into this app or not.
    $('#main-screen').html('Please log into Facebook.');

    document.getElementById('main-screen').innerHTML = 'Please log ' +
      'into Facebook.';
  }
}

window.fbAsyncInit = function() {
  FB.init({
    appId: '853972111414946',
    cookie: true, // enable cookies to allow the server to access
    // the session
    xfbml: true, // parse social plugins on this page
    version: 'v2.5' // use graph api version 2.5
  });


  FB.getLoginStatus(function(response) {
    statusChangeCallback(response);
  });

};

// Load the SDK asynchronously
(function(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0];
  if (d.getElementById(id)) return;
  js = d.createElement(s);
  js.id = id;
  js.src = '//connect.facebook.net/en_US/sdk.js';
  fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

//Check if the user exists in the db, fetch info if available
function getUserInfo() {
  console.log('getting user info..');
  FB.api('/me', function(response) {
    FB.me = response;
    FB.api('/me/picture?width=300', function (response) {
      FB.me.picture = response.data.url;
      socket.emit('getUser', FB.me);
    });
  });
}

//Handle trigger to set the user info
function setUser(user) {
  FB.me = user;
  setUserMovies();
}

//Custom login function.
function login() {
  FB.login(function (response) {
    if (response.authResponse) {
      statusChangeCallback({ status: 'connected' });
    } else {
      console.log('User cancelled login or did not fully authorize.');
    }
  });
}

//Custom logout function.
function logout() {
  console.log('Logging out...');
  FB.logout(function (response) {
    $('#main-screen').html('');
    var button = $('#fb-btn');
    button.html('Login with Facebook');
    button.attr('onclick', 'login();');
  });
}
