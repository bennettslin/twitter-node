var express = require("express");
var twitter = require('twitter');
var bodyParser = require("body-parser");
var async = require("async");
var geocoder = require("geocoder");
var moment = require("moment");
var nodemailer = require("nodemailer");
var CronJob = require('cron').CronJob;

var router = express.Router();
router.use(bodyParser.urlencoded({extended: false}));

/*******************************************************************************
* cron job test
* this will make an API call and then email the result
*
* see docs at: https://github.com/ncb000gt/node-cron
*******************************************************************************/

new CronJob('*/5 * * * * *', function() {
  console.log(new Date(), 'You will see this message every 5 seconds.');
}, null, true, 'America/Los_Angeles');

new CronJob('00 * * * * *', function() {
  console.log(new Date(), 'You will see this message every minute.');
}, null, true, 'America/Los_Angeles');

new CronJob('*/10 * * * * *', function() {
    client.get("users/show", {screen_name: "alexthephallus"}, function(error, data, response) {
    if (!error) {

      formatDates(data);
      sendEmail("bennett@crownsocial.com", "Cron job message", "You should get this every ten seconds: " + JSON.stringify(data));
    } else {
      console.log("Error:", error);
    }
  });
}, null, true, 'America/Los_Angeles');

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

router.get("/", function (req, res) {

  res.render("main/index", {screen_name: ""});
});

/*******************************************************************************
* send email
*******************************************************************************/

router.post("/email", function(req, res) {
  sendEmail(req.body.email_to, req.body.subject, req.body.content, function(error, response) {
    if (error) {
      console.log("Error:", error);
      res.send("Error:", error);
    } else {
      console.log("Message sent: " + response.message);
      res.redirect("/");
    }
  });
});

/*******************************************************************************
* search query
*******************************************************************************/

router.get("/search/:q", function(req, res) {
  var params = {q: req.params.q};
  client.get("search/tweets", params, function(error, data, response) {
    if (!error) {

      formatDates(data.statuses);

      res.render("main/search", {q: req.params.q, tweets: data.statuses})
    } else {
      res.send("Error:", error);
    }
  })
});

router.post("/search", function(req, res) {
  res.redirect("/search/" + req.body.q);
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
      formatDates(data);
      res.render("main/user", {users: [data]});
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
      formatDates(data);
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
      var ids = data.ids; // array of user ids

      // separate lists of a hundred, at most 10 for now
      // each list is a single string of user ids separated by comma
      var listsOf100 = [];
      while (listsOf100.length < 10 && ids.length > 0) {
        var listString = ids.splice(0, 100).join(",");
        listsOf100.push(listString);
      }

      // call Twitter API, 100 users at a time
      var users = [];
      async.each(listsOf100, function(listString, callback) {

        var params = {user_id: listString};
        client.get("users/lookup", params, function(error, data, response) {
          if (!error) {

            // success
            formatDates(data);
            users = users.concat(data);
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
          users = users.concat(remainingIds);

          console.log("users count", users.length);
          res.render("main/follows", {follows: req.body.follows, user_id: req.body.user_id, users: users});

        } else {
          res.send("Error:", error);
        }

      })
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

      formatDates(data);
      markTopTweets(data);

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
* helper method for formatting dates
* check docs at http://momentjs.com/docs/#/displaying/
*******************************************************************************/

var formatDates = function(entities) {
  if (!Array.isArray(entities)) {
    entities = [entities];
  }

  entities.forEach(function(entity) {
    entity.created_at = moment(Date.parse(entity.created_at)).format("ddd MMM Do YY, h:mma");
  });
}

/*******************************************************************************
* helper method for marking top tweet(s) with highest retweet + favourite count
* with a top_tweet: true property
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
}

/*******************************************************************************
* helper method for sending email
*******************************************************************************/

var sendEmail = function(email_to, subject, content, callback) {
  var smtpTransport = nodemailer.createTransport("SMTP", {
    service: "Gmail",
    auth: {
      user: process.env.GMAIL_ADDRESS,
      pass: process.env.GMAIL_PASSWORD
    }
  });

  var mailOptions = {
    to: email_to,
    subject: subject,
    text: content
  }

  smtpTransport.sendMail(mailOptions, function(error, response) {
    if (callback) {
      callback(error, response);
    }
  });
}

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