/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/
const url = require("url");
const path = require("path");
const https = require("https");
var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
const botauth = require("botauth");
const Dropbox = require("dropbox");
var fs = require('fs');
const upload = require("./upload");
const UploadRecognizer = require("./recognizer");
const DropboxOAuth2Strategy = require("passport-dropbox-oauth2").Strategy;
var Promise = require('bluebird');
var request_promise = require('request-promise').defaults({ encoding: null });
//var request = require('request');

// // Setup Restify Server
 var server = restify.createServer();
// server.use(restify.bodyParser());
// server.use(restify.queryParser());

// -------------------- OCR Image Process API Start ------------------ //
const request = require('request');
// Replace <Subscription Key> with your valid subscription key.
const subscriptionKey = 'ef46e2e021394aab92ca2d2eb57930b6';

// You must use the same location in your REST call as you used to get your
// subscription keys. For example, if you got your subscription keys from
// westus, replace "westcentralus" in the URL below with "westus".
const uriBase = 'https://eastus.api.cognitive.microsoft.com/vision/v1.0/ocr';

// -------------------- OCR Image Process API End ------------------ //

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3977, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var inMemoryStorage = new builder.MemoryBotStorage();
/*
var tableName = 'botdata';
var accountName = 'exocrbot9766';
var accountKey = 'o8YMwbDjsq7+PQ4vZHtFq5wOj/cQ+rPYjn3dD9TYJQDTLqVG0M/QqOg66LFbVksp8D3DTCwYt/I+TEDefvtv0w==';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, accountName,process.env['AzureWebJobsStorage']);
//console.log(azureTableClient);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
*/
// Create your bot with a function to receive messages from the user
//var bot = new builder.UniversalBot(connector);
//bot.set('storage', tableStorage);


var bot = new builder.UniversalBot(connector, { localizerSettings : { botLocalePath : path.join(__dirname, "./locale"), defaultLocale : "en" } });

bot.set('storage', inMemoryStorage);
// Initialize with the strategies we want to use
var ba = new botauth.BotAuthenticator(server, bot, { baseUrl: "https://localhost:3977/api/messages", secret : "TESTAUTH" });

// Configure the Dropbox authentication provider using the passport-dropbox strategy
ba.provider("dropbox", (options) => {
    return new DropboxOAuth2Strategy({
        clientID : "qtvqf73xnzhf0dx",
        clientSecret :"w2gyc5lqhfdnl9u",
        callbackURL : options.callbackURL
    }, (accessToken, refreshToken, profile, done) => {
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;

        done(null, profile);
    });
});


// Dialog labels
var DialogLabels = {
    getDetails: 'Get details',
    addDetails: 'Add details',
    editDetails: 'Edit details',
    saveDetails: 'Save details',
    uploadDetails:'Upload image to Drop Box'
};

var recog = new UploadRecognizer("upload");

bot.dialog("/", new builder.IntentDialog({ recognizers : [ recog ]})
    .matches(/logout/, "/logout")
    .matches("upload", "/upload")
    .onDefault((session, args) => {
        console.log("hi");
            session.endDialog("welcome");
    })
);
/* Original code
bot.dialog('/', [
    function (session) {
       builder.Prompts.text(session, "Hello... What's your name?");
        
    },
    function (session, results) {
        session.userData.name = results.response;
        session.send("Hi " + results.response + ", Welcome to OCR bot"); 
        builder.Prompts.choice(session, "Would you like to ", [DialogLabels.addDetails, DialogLabels.getDetails],{ listStyle: builder.ListStyle.button});
    },
    function (session, results) {
        //session.userData.coding = results.response;
        var selection = results.response.entity;        
        switch (selection) {
             case DialogLabels.addDetails:
                session.beginDialog('addDetails');
                break;
            case DialogLabels.getDetails:
                session.beginDialog('getDetails');
                break;
        }
        //builder.Prompts.choice(session, "What language do you code Node using?", ["JavaScript", "CoffeeScript", "TypeScript"]);
    }
    
]);*/

bot.dialog('getDetails', [
    function (session) {
        //session.send('Welcome to get passport details bot!');
        builder.Prompts.text(session, 'Please enter your passport number');
    },
    function (session, results, next) {
        const PassNumber = results.response;
        session.dialogData.PassPortNumber = results.response;
        session.send(`Your Passport details as follow: <br/>Name: Jolly Shah <br/>Number: ${session.dialogData.PassPortNumber} <br/>Issue: 21/12/2017 <br/>Expiry: 21/12/2023`);

        builder.Prompts.choice(
            session,
            'What would you like to do?<br/>',
            [DialogLabels.editDetails, DialogLabels.saveDetails],
            {
                maxRetries: 2,
                retryPrompt: 'Not a valid option'
            });    

        //builder.Prompts.confirm(session, "Would you like to edit?");
        next();
    },

    function (session, result) {
        if (!result.response) {
            // exhausted attemps and no selection, start over
            session.send('Ooops! Too many attemps :( But don\'t worry, I\'m handling that exception and you can try again!');
            session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('Failed with message: %s', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        
        var selection = result.response.entity;        
        switch (selection) {
            case DialogLabels.editDetails:
                //return 'editDetails';
                session.beginDialog('editDetails');
		        break;
            case DialogLabels.saveDetails:
                //return 'saveDetails';
                //return session.beginDialog('saveDetails');
                session.beginDialog('saveDetails');
                break;
        }
    }
]);

/*
var recog = new UploadRecognizer("upload");
bot.dialog("addDetails", new builder.IntentDialog({ recognizers : [ recog ]})
    .matches(/logout/, "/logout")
    .matches("upload", "/upload")
    .onDefault((session, args) => {
            session.endDialog("welcome");
    })
);
bot.dialog('/addDetails1',[
    function (session) {
        session.endDialog("welcome");
    }
]).triggerAction({ 
    matches: 'upload',
    onSelectAction: (session, args, skip) => {
        console.log("inside upload");
        //check if user is already connected or show a message
        if(!ba.profile(session, "dropbox")) {
            session.send("not_connected");
        }

        //save uploaded file information so we can get back to it         
        session.dialogData.attachments = session.message.attachments;
        session.save();

        skip();
    }

 });*/

bot.dialog('addDetails', [    
    function (session) {
        //session.send('Welcome to get passport details bot!');
        builder.Prompts.attachment(session, 'Please upload a file,will put it in your dropbox.');
    },    
    function (session, args, next) {
        var msg = session.message;
        var extractedUrl = extractUrl(msg);
        var attachment = msg.attachments[0];
        if (attachment) {
            //console.log(extractedUrl);
            //console.log(attachment);
            var fileDownload = new Promise(
                function(resolve, reject) {
                    var check = checkRequiresToken(msg);
                    if  (check==true) {
                        resolve(requestWithToken(attachment.contentUrl));
                    } else {
                        resolve(request_promise(attachment.contentUrl));
                    } 
                } 
            );

           /* var fileReadText = new Promise(function (resolve, reject) {
                fileDownload.then(function (value) {
                    readImageText(value, attachment.contentType, function (error, response, body) {
                        //session.send(`Your Passport details as follow: <br/>`+extractText(body));
                        resolve(request_promise(extractText(body)));
                        //session.send(extractText(body));
                    });
                }).catch(function (err, reply) {
                        console.log('Error with attachment: ', { 
                        statusCode: err.statusCode, 
                        message: err });
                        resolve("Error with attachment or reading image with %s", err);
                        //session.send("Error with attachment or reading image with %s", err);
                });
            });
            */
            fileDownload.then(
                function (response) {
                    session.sendTyping();
                    readImageText(response, attachment.contentType, function (error, response, body) {
                        session.send(`Your Passport details as follow: <br/>`+extractText(body));
                        //session.send(extractText(body));
                        next();
                    });

                }).catch(function (err, reply) {
                    console.log('Error with attachment: ', { 
                        statusCode: err.statusCode, 
                        message: err });
                        session.send("Error with attachment or reading image with %s", err);
                });
        }
        // It's a url link
        else if (extractedUrl != "") {
            readImageTextUrl(extractedUrl, 'application/json', function (error, response, body) {
                session.send(extractText(body));
            })
        }else {
            session.send("Hi!Try attaching an image or url link with words in it (jpeg, png, gif, or bmp work for me).")
        }
    
    /*    if (msg.attachments && msg.attachments.length > 0) {
     // Echo back attachment
        var attachment = msg.attachments[0];
            session.send({
                text: "You sent:",
                attachments: [
                {
                    contentType: attachment.contentType,
                    contentUrl: attachment.contentUrl,
                    name: attachment.name
                }
            ]
        });
    } else {
        // Echo back users text
        session.send("You said: %s", session.message.text);
    }              
    session.send(`Your Passport details as follow: <br/>Name: Jolly Shah <br/>Number: 12312321 <br/>Issue: 21/12/2017 <br/>Expiry: 21/12/2023`);*/
    // fileReadText.then(
    //     function(response){
    //     //console.log(value);
    //     session.send('Your Passport details as follow: <br/>'+response);
    //     builder.Prompts.choice(
    //         session,
    //         'What would you like to do?<br/>',
    //         [DialogLabels.editDetails, DialogLabels.saveDetails, DialogLabels.uploadDetails],
    //         {
    //             maxRetries: 3,
    //             retryPrompt: 'Not a valid option'
    //     });
    //     next();
    // });
            
       //next(); 
    },
    function (session, args, next) {
        builder.Prompts.choice(
                    session,
                    'What would you like to do?<br/>',
                    [DialogLabels.editDetails, DialogLabels.saveDetails, DialogLabels.uploadDetails],
                    {
                        maxRetries: 3,
                        retryPrompt: 'Not a valid option'
                });
                next();
    },
    function (session, result) {
        if (!result.response) {
            // exhausted attemps and no selection, start over
            session.send('Ooops! Too many attemps :( But don\'t worry, I\'m handling that exception and you can try again!');
            session.endDialog();
        }

        // on error, start over
        session.on('error', function (err) {
            session.send('Failed with message: %s', err.message);
            session.endDialog();
        });

        // continue on proper dialog
        
        var selection = result.response.entity;        
        switch (selection) {
            case DialogLabels.editDetails:
                //return 'editDetails';
                session.beginDialog('editDetails');
		        break;
            case DialogLabels.saveDetails:
                //return 'saveDetails';
                //return session.beginDialog('saveDetails');
                session.beginDialog('saveDetails');
                break;
            case DialogLabels.uploadDetails:
                //return 'saveDetails';
                //return session.beginDialog('saveDetails');
                session.beginDialog('uploadDetails');
                break;
        }
    
    }
]);


var recognizer = new UploadRecognizer("upload");
const intents = new builder.IntentDialog({ recognizers: [recognizer] });
console.log(intents);
bot.dialog("uploadDetails", intents.matches(/logout/, "/logout").matches("upload", "/upload")
    .onDefault((session, args) => {
        console.log("hi");
        session.endDialog("welcome");
    })
);


bot.dialog("/upload", [].concat(
    (session, args, skip) => {
        console.log(session);
        //check if user is already connected or show a message
        if(!ba.profile(session, "dropbox")) {
            session.send("not_connected");
        }

        //save uploaded file information so we can get back to it         
        session.dialogData.attachments = session.message.attachments;
        session.save();

        skip();
    },
    ba.authenticate("dropbox"),
    (session, args, skip) => {
        let user = ba.profile(session, "dropbox");
        console.log(user);
        console.log(session.dialogData);
        if(!(session.dialogData.attachments && session.dialogData.attachments.length > 0)) {
            return skip();
        }

        
        let attachmentUrl = session.dialogData.attachments[0].contentUrl;

        upload({ sourceUrl : attachmentUrl, dropboxToken : user.accessToken, path : "/" }, (err, result) => {
            if(err) {
                session.endDialog(`error uploading your file '${ err }'.`);
            } else {
                session.endDialog(`uploaded your file to '${ result.path_display }' in your dropbox.`);
            }
            
        });
    }
));

bot.dialog("/logout", (session) => {
        ba.logout(session, "dropbox");
        session.endDialog("logged_out");
    });

    

bot.dialog('saveDetails', [
    function (session) {
        session.sendTyping();
        session.send(`Your passport details are saved: <br/>Name: Jolly Shah <br/>Number: MH98745632 <br/>Issue: 21/12/2017 <br/>Expiry: 21/12/2023`);
        session.send('Thanks for useing OCR Passport Bot!');
        session.send("Please say 'Hi' to start conversation again");
        session.endDialog();
    }
]);

bot.dialog('editDetails', [
    function (session) {
        //session.sendTyping();
        session.send("Please enter your passport details one by one.");
        
        builder.Prompts.text(session, "Please enter your name as in passport.");
        //session.endConversation("Edit Details process here");
    },
    function (session, results) {
        session.dialogData.UserName = results.response;
        builder.Prompts.text(session, "Please enter your passport number");
    },
    function (session, results) {
        session.dialogData.PassPortNumber = results.response;
        builder.Prompts.time(session, "Please enter your issue date (eg.dd/mm/yyyy)");
    },
    function (session, results) {
        session.dialogData.IssueDate = builder.EntityRecognizer.resolveTime([results.response]);
        builder.Prompts.time(session, "Please enter your expiry date (eg.dd/mm/yyyy)");
    },
    function (session, results) {
        session.dialogData.expiryDate = builder.EntityRecognizer.resolveTime([results.response]);

        // Process request and display reservation details
        session.send(`Passport details: <br/>Name: ${session.dialogData.UserName} <br/>Number: ${session.dialogData.PassPortNumber} <br/>Issue: ${session.dialogData.IssueDate} <br/>Expiry: ${session.dialogData.expiryDate}`);
        builder.Prompts.confirm(session, "Is above detail correct?");
    },
    function (session, args) {
        if (args.response) {
            session.send("Your passport details are saved. Thanks for useing OCR Passport Bot!");

            session.send("Please say 'Hi' to start conversation again");
            session.endDialog();
        }
         else {
            session.send("Please try again");
         }
    },
]);

// Promise for obtaining JWT Token (requested once)
var obtainToken = Promise.promisify(connector.getAccessToken.bind(connector));

var checkRequiresToken = function (message) {
    return message.source === 'skype' || message.source === 'msteams';
};

// A request with binary image data to OCR API
var readImageText = function _readImageText(url, content_type, callback) {
        const options = {
            method: 'POST',
            url: "https://eastus.api.cognitive.microsoft.com/vision/v1.0/ocr?language=unk&detectOrientation=true",
            headers: {
                'Content-Type': 'application/octet-stream',
                'Ocp-Apim-Subscription-Key' : subscriptionKey
            },
            body: url,            
            json: false
        };

    /*var options = {
        method: 'POST',
        url: config.CONFIGURATIONS.COMPUTER_VISION_SERVICE.API_URL + "ocr/",
        headers: {
            'Ocp-Apim-Subscription-Key': config.CONFIGURATIONS.COMPUTER_VISION_SERVICE.API_KEY,
            'Content-Type': 'application/octet-stream'
        },
        body: url,
        json: false
    };*/
    request(options, callback);

};

var readImageTextUrl = function _readImageTextUrl(url, content_type, callback) {

    var options = {
        method: 'POST',
        url: config.CONFIGURATIONS.COMPUTER_VISION_SERVICE.API_URL + "ocr/",
        headers: {
            'ocp-apim-subscription-key': config.CONFIGURATIONS.COMPUTER_VISION_SERVICE.API_KEY,
            'content-type': content_type
        },
        body: {url: url, language: "en"},
        json: true
    };

    request(options, callback);

};

// Get the text if present in the response from service
var extractText = function _extractText(bodyMessage) {
    var bodyJson = bodyMessage;    

    // The attached images are json strings, the urls are not
    //  so only convert if we need to
    if (IsJsonString(bodyMessage)) {
        bodyJson = JSON.parse(bodyMessage);
    }

    // The "regions" - part of the json to drill down first level
    var regs = bodyJson.regions;
    text = "";

    if (typeof regs === "undefined") {return "Something's amiss, please try again.";};

    // Get line arrays
    var allLines = regs.map(x => x.lines);
    // Flatten array
    var allLinesFlat =  [].concat.apply([], allLines);
    // Get the words objects
    var allWords = allLinesFlat.map(x => x.words);
    // Flatten array
    var allWordsFlat = [].concat.apply([], allWords);
    // Get the text
    var allText = allWordsFlat.map(x => x.text);
    // Flatten
    var allTextFlat = [].concat.apply([], allText);

    text = allTextFlat.join(" ");

    if (text) {
        return text;
    } else {
        return "Could not find text in this image. :( Try again?";
    }
};

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

//=========================================================
// URL Helpers
//=========================================================


var extractUrl = function _extractUrl(message) {

    if (message.type !== "message") return;

    if (typeof message.attachments !== "undefined"
        && message.attachments.length > 0) {
        return message.attachments[0].contentUrl;
    }

    if (typeof message.text !== "") {
        return _findUrl(message.text);
    }

    return "";
};


function _findUrl(text) {
    var source = (text || '').toString();
    var matchArray;

    // Regular expression to find FTP, HTTP(S) and email URLs.
    var regexToken = /(((http|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)/g;

    // Iterate through any URLs in the text.
    if ((matchArray = regexToken.exec(source)) !== null) {
        var token = matchArray[0];
        return token;
    }

    return "";
}