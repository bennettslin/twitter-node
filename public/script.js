  // Convert URLs (w/ or w/o protocol), @mentions, and #hashtags into anchor links
  var linkify = function(text) {

    // convert URLs into links
    text = text.replace(
      /(>|<a[^<>]+href=['"])?(https?:\/\/([-a-z0-9]+\.)+[a-z]{2,5}(\/[-a-z0-9!#()\/?&.,]*[^ !#?().,])?)/gi,
      function($0, $1, $2) {
          return ($1 ? $0 : '<a href="' + $2 + '" target="_blank">' + $2 + '</a>');
      });

    // convert protocol-less URLs into links
    text = text.replace(
      /(:\/\/|>)?\b(([-a-z0-9]+\.)+[a-z]{2,5}(\/[-a-z0-9!#()\/?&.]*[^ !#?().,])?)/gi,
      function($0, $1, $2) {
          return ($1 ? $0 : '<a href="http://' + $2 + '">' + $2 + '</a>');
      });

    // convert @mentions into follow links
    text = text.replace(
      /(:\/\/|>)?(@([_a-z0-9\-]+))/gi,
      function($0, $1, $2, $3) {
          return ($1 ? $0 : '<a href="' + '/user/' + $3
              + '" title="Follow ' + $3 + '">@' + $3
              + '</a>');
      });

    // convert #hashtags into tag search links
    text = text.replace(
      /(:\/\/[^ <]*|>)?(\#([_a-z0-9\-]+))/gi,
      function($0, $1, $2, $3) {
          return ($1 ? $0 : '<a href="' + '/search/' + $3
              + '" title="Search tag: ' + $3 + '">#' + $3
              + '</a>');
      });

    return text;
  }