var express = require("express");
var twitter = require('twitter');
var bodyParser = require("body-parser");
var async = require("async");
var geocoder = require("geocoder");
var moment = require("moment");

var router = express.Router();
router.use(bodyParser.urlencoded({extended: false}));


/*******************************************************************************
* FIXME: Simple form and dashboard for now.
*******************************************************************************/

var username;
var influencers = [];
var hashtags = [];

router.post("/form", function (req, res) {
  username = req.body.username;
  influencers[0] = (req.body.influencer1);
  influencers[1] = (req.body.influencer2);
  influencers[2] = (req.body.influencer3);
  hashtags[0] = (req.body.hashtag1);
  hashtags[1] = (req.body.hashtag2);
  hashtags[2] = (req.body.hashtag3);

  getMyUser({}, username, res);
});

router.get("/", function (req, res) {
  res.render("admin/form");
});

/*******************************************************************************
* FIXME: This "callback hell" should be made completely asynchronous at some point.
* For now, we're just trying to get it to work.
*
* This gets, in sequence: myUser, myFollowers, myTweets, influencers, hashtagPosts.
* For now, we're just passing these objects to the HTML directly.
*
* The desired data will eventually be stored in the database,
* and then only the desired data from the database will be passed to the HTML.
*
* At present, this does not get influencerTweets.
*******************************************************************************/

var getHashtagPosts = function(object, hashtags, res) {
  var hashtagPosts = [];
  async.each(hashtags, function(hashtag, callback) {
    client.get("search/tweets", {q: "#" + hashtag}, function(error, data, response) {
      if (!error) {
        formatDates(data.statuses);
        hashtagPosts.push(data.statuses);
        callback();
      } else {
        callback(error);
      }
    })
  }, function(error) {
    if (!error) {
      object.hashtags = hashtags;
      object.hashtagPosts = hashtagPosts;
      res.render("admin/dashboard", object);
    } else {
      res.send("Error:", error);
    }
  })
}

var getInfluencers = function(object, influencers, res) {
  var params = {screen_name: influencers.join(",")};
  client.get("users/lookup", params, function(error, data, response) {
    if (!error) {
      formatDates(data);
      object.influencers = data;
      getHashtagPosts(object, hashtags, res);
    } else {
      res.send("Error:", error);
    }
  })
}

var getMyTweets = function(object, user_id, res) {
  var params = {user_id: user_id, count: 200, include_rts: 1}
  client.get("statuses/user_timeline", params, function (error, data, response) {
    if (!error) {
      formatDates(data);
      object.myTweets = data;
      getInfluencers(object, influencers, res);
    } else {
      res.send("Error:", error);
    }
  });
}

var getMyFollowers = function(object, user_id, res) {
  var params = {user_id: user_id}
  client.get("followers/ids", params, function (error, data, response) {
    if (!error) {

      var ids = data.ids; // array of user ids

      // separate lists of a hundred, at most 10 for now
      // each list is a single string of user ids separated by comma
      var listsOf100 = [];
      while (listsOf100.length < 10 && ids.length > 0) {
        var listString = ids.splice(0, 100).join(",");
        listsOf100.push(listString);
      }

      // call Twitter API, 100 followers at a time
      var followers = [];
      async.each(listsOf100, function(listString, callback) {

        var params = {user_id: listString};
        client.get("users/lookup", params, function(error, data, response) {
          if (!error) {

            // success
            formatDates(data);
            followers = followers.concat(data);
            callback();

          } else {
            callback(error);
          }
        })

      }, function(error) {

        if (!error) {

          // add remaining ids
          var remainingIds = ids.map(function(id) {
            return { id_str: id, status: { id_str: "" } };
          })
          followers = followers.concat(remainingIds);
          object.myFollowers = followers;
          getMyTweets(object, user_id, res);

        } else {
          res.send("Error:", error);
        }

      })
    } else {
      res.send("Error:", error);
    }
  });
}

var getMyUser = function(object, username, res) {
  var params;
  if (isNaN(parseInt(username))) {
    params = {screen_name: username};
  } else {
    params = {user_id: username};
  }
  client.get("users/show", params, function(error, data, response) {

    if (!error) {
      object.myUser = data;
      getMyFollowers(object, data.id_str, res);
    } else {
      res.send("Error:", error);
    }
  });
}

/*******************************************************************************
* helper method for formatting dates
*******************************************************************************/

var formatDates = function(entities) {
  if (!Array.isArray(entities)) {
    entities = [entities];
  }

  entities.forEach(function(entity) {

    // check http://momentjs.com/docs/#/displaying/
    entity.created_at = moment(entity.created_at).format("ddd MMM Do YY, h:mma");
  });
}

/*******************************************************************************
* get keys and secrets from developer account on https://apps.twitter.com
*******************************************************************************/

var client = new twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

module.exports = router;