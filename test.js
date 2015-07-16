/*******************************************************************************
* helper method to convert an array of text descriptions
* into an array of objects, sorted from highest to lowest count.
* The object format is [ {text: "string1", count: n}, ... ].
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
    wordCountArr.push({text: prop, count: wordCount[prop]});
  }

  // sort based on count, largest first
  wordCountArr.sort(function(objectA, objectB) {
    return objectB.count - objectA.count;
  });

  return wordCountArr;
}

var sampleWords = ["再见", "再见", "你好", "こんにちは", "こんにちは", "有人能看到吗", "有人能看到吗", "can you see this?", "Bonjour", "Bonjour", "Bonjour", "مرحبا", "من أنت", "PubNub is pretty cool, eh", "buenos días", "Hello", "anybody there", "yo", "anybody?", "hahaha", "hahaha", "hahaha", "this is so awesome", "LOLCAT", "LOL", "LOL", "LOL", "LOL", "LOL", "Hey", "Hey", "Hey", "Yo", "Yo", "Yo", "Yo", "Yo", "ciao", "ciao", "ciao", "ciao", "ciao", "hi", "hi", "hi", "hi", "hi", "i love cats", "california", "folsom@3rd", "folsom@3rd", "folsom@3rd", "folsom@3rd", "folsom@3rd", "pubnub", "pubnub", "pubnub", "pubnub", "moo", "hi", "Android", "wut?", "yo", "yo", "hey", "oi", "hey", "helloooooooooo", "lolcat", "d3js", "brb", "lmao", "anybody", "anybody there?", "where are you guys", "hello?", "hello?", "hi", "Yo", "bye", "hello hello hello", "hello Bennett", "Bennett Bennett Bennett Bennett"];

console.log(getArrayOfWordCounts(sampleWords));