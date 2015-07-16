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
*******************************************************************************/

var getHashtagPosts = function(object, hashtags, res) {
  var hashtagPosts = [];
  async.each(hashtags, function(hashtag, callback) {
    client.get("search/tweets", {q: "#" + hashtag}, function(error, data, response) {
      if (!error) {
        formatDates(data.statuses);
        var topTweet = markTopTweets(data.statuses);
        hashtagPosts.push({hashtag: hashtag, tweets: data.statuses, topTweet: topTweet});
        callback();
      } else {
        callback(error);
      }
    })
  }, function(error) {
    if (!error) {
      console.log("get hashtag posts successful.");

      object.hashtagPosts = hashtagPosts;

      console.log("my user top tweet", object.myTopTweet.id_str, object.myTopTweet.text);
      console.log("influencer 1 top tweet", object.influencers[0].topTweet.user.screen_name, object.influencers[0].topTweet.text);
      console.log("influencer 2 top tweet", object.influencers[1].topTweet.user.screen_name, object.influencers[1].topTweet.text);
      console.log("influencer 3 top tweet", object.influencers[2].topTweet.user.screen_name, object.influencers[2].topTweet.text);
      console.log(object.hashtagPosts[0].hashtag, "top tweet", object.hashtagPosts[0].topTweet.user.screen_name, object.hashtagPosts[0].topTweet.text);
      console.log(object.hashtagPosts[1].hashtag, "top tweet", object.hashtagPosts[1].topTweet.user.screen_name, object.hashtagPosts[1].topTweet.text);
      console.log(object.hashtagPosts[2].hashtag, "top tweet", object.hashtagPosts[2].topTweet.user.screen_name, object.hashtagPosts[2].topTweet.text);

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
      async.each(data, function(influencer, callback) {
        var params = {user_id: influencer.id_str, count: 200, include_rts: 1};
        client.get("statuses/user_timeline", params, function(error, data, response) {
          if (!error) {
            formatDates(data);
            influencer.tweets = data;
            influencer.topTweet = markTopTweets(data);
            callback();
          } else {
            callback(error);
          }
        })
      }, function(error) {
        if (!error) {
          console.log("get influencers successful.");
          getHashtagPosts(object, hashtags, res);
        } else {
          res.send("Error:", error);
        }
      });

    } else {
      res.send("Error:", error);
    }
  })
}

var getMyTweets = function(object, user_id, res) {
  var params = {user_id: user_id, count: 200, include_rts: 1};
  client.get("statuses/user_timeline", params, function(error, data, response) {
    if (!error) {
      console.log("get tweets successful.");
      formatDates(data);
      object.myTweets = data;
      object.myTopTweet = markTopTweets(data);
      getInfluencers(object, influencers, res);
    } else {
      res.send("Error:", error);
    }
  });
}

var getMyFollowers = function(object, user_id, res) {
  var params = {user_id: user_id};
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
          console.log("get followers successful.");

          // add remaining ids
          var remainingIds = ids.map(function(id) {
            return { id_str: id, status: { id_str: "" } };
          })
          followers = followers.concat(remainingIds);
          object.myFollowers = followers;

          // get follower descriptions
          var descriptions = [];
          followers.forEach(function(follower) {
            if (follower.description) {
              descriptions.push(follower.description);
            }
          });

          // sort descriptions, and add to object
          object.wordCountArray = sortedArrayOfWordCounts(descriptions);
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
      console.log("get user successful.");
      object.myUser = data;
      getMyFollowers(object, data.id_str, res);
    } else {
      res.send("Error:", error);
    }
  });
}

/*******************************************************************************
* helper method to convert an array of text descriptions
* into an array of objects, sorted from highest to lowest count.
* The object format is [ {word: "string1", count: n}, ... ].
*******************************************************************************/

var sortedArrayOfWordCounts = function(strings) {
  if(!strings) return;

  // Convert array to a long string
  strings = strings.join(' ');

  // Strip stringified objects and punctuations from the string
  strings = strings.toLowerCase().replace(/object Object/g, '').replace(/[\+\.,\/#!$%\^&\*{}=_`~]/g,'');

  // Convert the str back into an array
  strings = strings.split(' ');

  // Count frequency of word occurrence
  var wordCount = {};

  for(var i = 0; i < strings.length; i++) {
    if (!wordCount[strings[i]])
        wordCount[strings[i]] = 0;

    wordCount[strings[i]]++; // {'hi': 12, 'foo': 2 ...}
  }

  var wordCountArr = [];

  for(var prop in wordCount) {
    wordCountArr.push({word: prop, count: wordCount[prop]});
  }

  // sort based on count, largest first
  wordCountArr.sort(function(objectA, objectB) {
    return objectB.count - objectA.count;
  });

  return wordCountArr;
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
    entity.created_at = moment(Date.parse(entity.created_at)).format("ddd MMM Do YY, h:mma");
  });
}

/*******************************************************************************
* helper method for marking top tweet(s) with highest retweet + favourite count
* with a top_tweet: true property
*
* return first top tweet
*******************************************************************************/

var markTopTweets = function(tweets) {
  var topCount = 0;
  var topIndices = [];
  tweets.forEach(function(tweet, index) {
    var thisCount = tweet.retweet_count + tweet.favorite_count;
    if (thisCount > topCount) {
      topCount = thisCount;
      topIndices = [index];
    } else if (thisCount == topCount) {
      topIndices.push(index);
    }
  });
  topIndices.forEach(function(topIndex) {
    tweets[topIndex].top_tweet = true;
  })
  return tweets[topIndices[0]];
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