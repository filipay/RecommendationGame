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
    // button.unbind('click').click(function (e) {
    //   console.log("Logging out...");
    //   FB.logout(function (response) {
    //     console.log(response);
    //   });
    // });
    socket = io.connect();
    socket.on('setUser', setUser);
    $('#main-screen').html($('#movies').html());
    getUserInfo();
    prepareMovieSearch();
    // console.log('connected!!!');
    // testAPI();
  } else if (response.status === 'not_authorized') {
    // The person is logged into Facebook, but not your app.
    document.getElementById('status').innerHTML = 'Please log ' +
      'into this app.';
  } else {
    // The person is not logged into Facebook, so we're not sure if
    // they are logged into this app or not.
    document.getElementById('status').innerHTML = 'Please log ' +
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

  // Now that we've initialized the JavaScript SDK, we call
  // FB.getLoginStatus().  This function gets the state of the
  // person visiting this page and can return one of three states to
  // the callback you provide.  They can be:
  //
  // 1. Logged into your app ('connected')
  // 2. Logged into Facebook, but not your app ('not_authorized')
  // 3. Not logged into Facebook and can't tell if they are logged into
  //    your app or not.
  //
  // These three cases are handled in the callback function.

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


function getUserInfo() {
  console.log('getting user info..');
  FB.api('/me', function(response) {
    console.log(response);
    FB.me = response;
    FB.api('/me/picture?width=300', function (response) {
      FB.me.picture = response.data.url;
      socket.emit('getUser', FB.me);
    });
  });
}

function setUser(user) {
  FB.me = user;
  setUserMovies();
}

function login() {
  FB.login(function (response) {
    if (response.authResponse) {
      statusChangeCallback({ status: 'connected' });
    } else {
      console.log('User cancelled login or did not fully authorize.');
    }
  });
}

function logout() {
  console.log('Logging out...');
  FB.logout(function (response) {
    $('#main-screen').html('');
    var button = $('#fb-btn');
    button.html('Login with Facebook');
    button.attr('onclick', 'login();');
  });
}
