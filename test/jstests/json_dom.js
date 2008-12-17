windmill.jsTest.require('shared.js');

windmillMain.test_jsonDom = new function () {
  // Navigate to the main page
  this.setup = windmillMain.shared.test_navMain;
  this.test_getData = function () {
    // Callback function -- sets temp flag to 'returned'
    var success = function (s) {
      var data = eval('('+s+')');
      windmillMain.tempData = data;
    };
    var url = windmillMain.shared.util.getCurrentDir() + 'data.json';
    fleegix.xhr.get(success, url);
  };
  this.test_wait = windmillMain.shared.util.waitForTempData;
  this.test_verifyData = function () {
    var data = windmillMain.tempData;
    var albums = data.albums;
    jum.assertNotNaN(albums.length);
  };
  this.test_writeDom = function () {
    var data = windmillMain.tempData;
    var albums = data.albums;
    var c = $('content');
    for (var i = 0; i < albums.length; i++) {
      var d = $elem('div', {
        id: 'album_' + i,
        innerHTML: albums[i]
      });
      c.appendChild(d);
    }
    jum.assertTrue(c.hasChildNodes());
  };
  // Call asserts directly from JavaScript
  this.test_domNodesCreated = function () {
    wmAsserts.assertNode({ id: 'album_9' });
  };
  this.test_domNodeContent = function () {
    wmAsserts.assertText({ id: 'album_9', validator: 'Power Windows' });
  };
  // Same as the two tests above, but done in the JSON-action style
  this.test_domNodesActionStyle = [
    { method: "asserts.assertNode", params: {id: 'album_9'} },
    { method: "asserts.assertText", params: {id: 'album_9',
      validator: 'Power Windows'} }
  ];
  this.teardown = function () {
    // Clear out the temp data
    windmillMain.tempData = null;
    // Clear the DOM
    $('content').innerHTML = '';
  };
};
