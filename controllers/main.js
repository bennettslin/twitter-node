var express = require("express");
var twitter = require('twitter');
var bodyParser = require("body-parser");
var geocoder = require("geocoder");

var router = express.Router();
router.use(bodyParser.urlencoded({extended: false}));

/*******************************************************************************
* get keys and secrets from developer account on https://apps.twitter.com
*******************************************************************************/

var client = new twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

/*******************************************************************************
* home page gets screen name of developer account
* currently disabled to avoid getting throttled by rate limit
*******************************************************************************/

router.get('/', function (req, res) {

/*
  client.get("account/settings", function (error, data, response) {
    if (!error) {
      res.render("main/index", {screen_name: data.screen_name});
    } else {
      res.render("main/index", {screen_name: ""});
    }
  });
*/

  res.render("main/index", {screen_name: ""});
});

/*******************************************************************************
* search
*******************************************************************************/

router.get("/search/:q", function(req, res) {
  var params = {q: req.params.q};
  client.get("search/tweets", params, function(error, data, response) {
    if (!error) {
      res.render("main/search", {q: req.params.q, tweets: data.statuses})
    } else {
      res.send("Error:", error);
    }
  })
});

/*******************************************************************************
* individual user
*******************************************************************************/

router.get("/user/:user", function(req, res) {
  var user = req.params.user;
  var params;
  if (isNaN(parseInt(user))) {
    params = {screen_name: user};
  } else {
    params = {user_id: user};
  }

  client.get("users/show", params, function(error, data, response) {
    if (!error) {
      console.log(data);
      res.render("main/user", {data: data});
    } else {
      res.send("Error:", error);
    }
  });
});

router.post("/user", function(req, res) {
  res.redirect("/user/" + req.body.user);
});

/*******************************************************************************
* individual tweet
*******************************************************************************/

router.get("/tweet/:tweet_id", function(req, res) {
  var tweet_id = req.params.tweet_id;
  var url = "statuses/show/" + tweet_id + ".json";
  client.get(url, function (error, data, response) {
    if (!error) {
      console.log(data);
      res.render("main/tweet", {tweets: [data]});
    } else {
      res.send("Error:", error);
    }
  });
});

router.post("/tweet", function(req, res) {
  res.redirect("/tweet/" + req.body.tweet_id);
});

/*******************************************************************************
* general list of users (user's friends or followers)
*******************************************************************************/

router.post("/follows", function(req, res) {
  var params = {user_id: req.body.user_id}
  client.get(req.body.follows + "/ids", params, function (error, data, response) {
    if (!error) {
      console.log(data);
      res.render("main/follows", {follows: req.body.follows, user_id: req.body.user_id, data: data});
    } else {
      res.send("Error:", error);
    }
  });
});

/*******************************************************************************
* general list of tweets
*******************************************************************************/

router.post("/tweets", function(req, res) {
  var params = {user_id: req.body.user_id, count: 200, include_rts: 1}
  client.get("statuses/user_timeline", params, function (error, data, response) {
    if (!error) {
      console.log(data);
      res.render("main/tweets", {user_id: req.body.user_id, tweets: data});
    } else {
      res.send("Error:", error);
    }
  });
});

/*******************************************************************************
* trends for place from geocoder
*******************************************************************************/

router.post("/trends-place", function(req, res) {

  // first geocode coordinates from address
  geocoder.geocode(req.body.address, function (error, data) {
    if (!error) {

      // next get woeid (Where On Earth ID) from coordinates
      // more info here: https://en.wikipedia.org/wiki/GeoPlanet
      var params = {lat: data.results[0].geometry.location.lat,
                    "long": data.results[0].geometry.location.lng};
      client.get("trends/closest", params, function(error, data, response) {
        if (!error) {

          // finally get top trends for woeid
          var params = {id: data[0].woeid};
          client.get("trends/place", params, function(error, data, response) {
            if (!error) {
              res.render("main/trends", {address: req.body.address, trends: data[0].trends})
            } else {
              res.send("Error:", error);
            }
          })

        } else {
          res.send("Error:", error);
        }
      })
    } else {
      res.send("Error:", error);
    }
  });
})

/*******************************************************************************
* streaming API
*******************************************************************************/

router.get("/stream", function(req, res) {

  client.stream('statuses/filter', {track: "microsoft"}, function(stream) {
    stream.on('data', function(data) {
      console.log("#############################################################");
      console.log("text:", data.text);
      console.log("user id:", data.user.screen_name);
      return;
    });

    stream.on('error', function(error) {
      res.send("Error:", error);
    });
  });
})

module.exports = router;