/*
Copyright 2006-2007, Open Source Applications Foundation

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

var windmill = new function() {

    //More namespacing
    this.builder = {};
    this.helpers = {};

    //The timeout for page loading, if the onload is never called
    //how long do we wait before we start firing tests again
    this.timeout = 10000;

    //How long xhr waits in seconds before calling the timout function
    this.xhrTimeout = 180;

    this.serviceDelay = 400;

    //Whether or not the IDE is in a waiting state
    //Is set to true when we run into any waits.*
    this.waiting = false;

    //The timeout ID of whatever is keeping
    //us from continuing the tests runs, if it reaches
    //windmill.timeout we stop the timeout and continue on
    this.loadTimeoutId = 0;

    //We need to allow users to store data locally
    //So we are using the fleegix hash data structure
    this.varRegistry = new fleegix.hash.Hash();

    //The app your testing
    this.testWindowStr = 'windmill.testWindow';
    this.testWindow = opener;
    this.initialHost = '';
    
    this.openWindow;
    
    this.locationObj = null;
    //Keep track of windows the page opened with pointers
    this.windowReg = new fleegix.hash.Hash();    
    
    //This is so that if you are doing multiple frame testing
    //And you have to change testingApp to point at various frames
    //You can still keep track of the base window
    this.baseTestWindow = opener;
    this.remoteLoaded = false;
    this.remote = parent.window;
    this.browser = null;
    
    this.init = function(b) { this.browser = b;}
    this.start = function() {
        var shell = new fleegix.shell.Shell($('shellForm').shellInput, $('shellOutput'));
        //make the action drop down work in a browser compatible way
        var dispatchDD = function(e){
          var sel = e.target.options[e.target.options.selectedIndex].id;
          switch(sel){
            case 'addSuite':
              windmill.ui.incRecSuite();
              windmill.ui.remote.getSuite();
            break;
            case 'addAction':
              windmill.ui.remote.addAction();
            break;
            case 'addActionJSON':
              windmill.ui.remote.actionFromJSON();
            break;
            case 'clearIDE':
              windmill.ui.remote.clearIDE();
            break;
            default:
              resetDD();
            break;
          }
          resetDD();
        }
        fleegix.event.listen($('actionDD'), 'onchange', dispatchDD);
        
        windmill.service.setStartURL();
        windmill.service.buildNotAsserts();
        
        var arr = window.location.hostname.split('.');
        if (arr.length > 2){
          arr.shift();
          windmill.docDomain = arr.join('.');
        }
        else { windmill.docDomain = window.location.hostname; }
        //windmill.docDomain = window.location.hostname.replace('www.','');

        try {
          var wdwTitle = opener.document.title;
          if (wdwTitle == "Windmill Testing Framework") {
              windmill.controller.waits._forNotTitleAttach({
                  title: "Windmill Testing Framework"
              });
          }
          else { windmill.controller.continueLoop(); }
          
          //rewrite the open function to keep track of windows popping up
          //windmill.controller.reWriteOpen();
          windmill.ui.results.writeResult("<br>Start UI output session.<br> <b>User Environment: " + 
          browser.current_ua + ".</b><br>");
          windmill.ui.results.writePerformance("<br>Starting UI performance session.<br> <b>User Environment: " + 
          browser.current_ua + ".</b><br>");
        }
        catch(err) {
			    //if the initial lode url was blah.com and redirected to www.blah.com
			    if (window.location.href.indexOf('www.') == -1){
			      alert('This application loads and immediately redirects to the www. version of itself, trying to correct the domain.');
			      window.location.href = 'http://www.'+window.location.hostname+"/windmill-serv/remote.html";
			      return;
		      }
		      windmill.controller.continueLoop();
		    }
		    //If the doc domain has changed
        //and we can't get to it, try updating it
        try{ var v = opener.document.domain; }
        catch(err){
          try { document.domain = windmill.docDomain; }
          catch(err){
            if (arr.length > 2){
              arr.shift();
              document.domain = arr.join('.');
            }
            else { document.domain = windmill.docDomain; }
          }
        }
        //setTimeout("windmill.controller.continueLoop()", 2000);  
        //Set a variable so that windmill knows that the remote has fully loaded
        try { 
          opener.windmill = windmill; 
          windmill.initialHost = opener.location.href;
        }
        catch(err){}
        this.remoteLoaded = true;
        document.getElementById('runningStatus').innerHTML = 'Waiting...';
        
        busyOff();
    };

    //When the page is unloaded turn off the loop until it loads the new one
    this.unloaded = function() {
        busyOn();
        this.controller.stopLoop();
        
        //if we are recording, we just detected a new page load, but only add one.
        //Opera and IE appear to be calling unload multiple times
        if (windmill.ui.recorder.recordState){
          var suiteActions = windmill.ui.remote.getSuite().childNodes;
          var lastNode = suiteActions[suiteActions.length-1];
          var method = null;
          try{ method = $(lastNode.id+'method').value;}
          catch(err){}
          if (method != "waits.forPageLoad"){
            var wfpl = windmill.ui.remote.buildAction("waits.forPageLoad", {timeout:20000});
            windmill.ui.remote.addAction(wfpl);
          }
        }
        
        checkPage = function() {
            windmill.controller.waits.forPageLoad({});
        }
        setTimeout('checkPage()', 1000);
    };

    //On load setup all the listener stuff
    //Set the listener on the testingApp on unload
    this.loaded = function() {
        busyOff();
        //When the waits happen I set a timeout
        //to ensure that if it takes longer than the
        //windmill default timeout to load
        //we start running tests.. failover incase something
        //breaks, but we don't want this same code to get
        //called twice, so I clear it here
        if (windmill.loadTimeoutId != 0) { clearTimeout(windmill.loadTimeoutId); }

        //If the doc domain has changed
        //and we can't get to it, try updating it
        try{ var v = opener.document.domain; }
        catch(err){ document.domain = windmill.docDomain; }
        //rewrite the open function to keep track of windows popping up
        //windmill.controller.reWriteOpen();
        //Making rewrite alert persist through the session
        if (windmill.reAlert == true) { windmill.controller.reWriteAlert(); }
        //Ovveride the window.open, so we can keep a registry of
        //Windows getting popped up

        //We need to define the windmill object in the
        //test window to allow the JS test framework
        //to access different functionality
        try {
          opener.windmill = windmill; 
          fleegix.event.unlisten(opener.document.body, 'onunload', windmill, 'unloaded');
          fleegix.event.listen(opener.document.body, 'onunload', windmill, 'unloaded');
        }
        catch(err){
          try { setTimeout('windmill.loaded()', 500); return;}
          catch(err){         
            windmill.ui.results.writeResult("Loaded method was unable to bind listeners, <br>Error: " + err);
          }
        }

        //Reset the explorer and recorder to what
        //they were before the new page load
        windmill.ui.domexplorer.setExploreState();
        windmill.ui.recorder.setRecState();
		
        delayed = function() {
          if (windmill.waiting == false) {
            windmill.controller.continueLoop(); 
          }
        }
        setTimeout('delayed()', 0);
    };

    //windmill Options to be set
    this.stopOnFailure = false;
    this.runTests = true;
    this.rwAlert = false;
};

//Set the browser
windmill.init(browser);
//Setup a convenience variable
var _w = opener;
fleegix.xhr.defaultTimeoutSeconds = windmill.xhrTimeout;
fleegix.event.compatibilityMode = true;