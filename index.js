const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const expressMongoDb = require('express-mongo-db');
const uWaterlooAPI = require('./api/uWaterlooAPI');
const MongoClient = require('mongodb').MongoClient;
const utils = require('./api/utils.js');

const MONGO_URL = 'mongodb://localhost:27017/coursenotifier';
const USER_DB = 'users';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressMongoDb(MONGO_URL));

MongoClient.connect(MONGO_URL, function(err, client) {
    const db = client.db('coursenotifier');
});

const port = 3000;

app.post('/', function(req, res) { // POST '/' will send your course tracking request to the server
    const email = req.body.email;
    const department = req.body.department;
    const courseNumber = req.body.courseNumber;
    const courseSection = req.body.courseSection;
    const term = req.body.term;

    const trackRequest = {
        department: department,
        courseNumber: courseNumber,
        courseSection: courseSection,
        term: term,
        lastNotified: null // Timestamp for the last time that you were notified. Used to check if it is time to send another email.
    };

    req.db.collection(USER_DB).find({ email: email }).toArray(function(err, user) {
        if (err) {
            utils.handleUnexpectedError(err, res);
            return;
        }
        if (user.length == 0) {
            const newUser = {
                email: email,
                trackings: [trackRequest]
            };

            req.db.collection(USER_DB).insertOne(newUser, function(err) {
                if (err) {
                    utils.handleUnexpectedError(err, res);
                    return;
                }
                res.send('ok');
            });
            console.log('New User!');
        } else {
            req.db.collection(USER_DB).find({
                email: email, 
                'trackings.department': department, 
                'trackings.courseNumber': courseNumber,
                'trackings.courseSection': courseSection,
                'trackings.term': term }).toArray(function (err, revisedUser) {
                if (err) {
                    utils.handleUnexpectedError(err, res);
                    return;
                }
                if (revisedUser.length == 0) {
                    user[0].trackings.push(trackRequest);
                    req.db.collection(USER_DB).updateOne({ email: email }, { $set: { trackings: user[0].trackings } }, function(err) {
                        if (err){
                            utils.handleUnexpectedError(err, res);
                            return;
                        }
                        res.send('ok');
                    });
                } else {
                    res.status(400).send('This email is already tracking this specific request!');
                    return;
                }
                console.log('Existing User!');
            });
        }
    });
    console.log(courseCode+courseSection);
});


app.post('/delete', function(req, res) { // POST '/delete' will remove your course tracking request from the server
    const email = req.body.email;
    const department = req.body.department;
    const courseNumber = req.body.courseNumber;
    const courseSection = req.body.courseSection;
    const term = req.body.term;

    req.db.collection(USER_DB).find({ email: email }).toArray(function(err, user) {
        if (err) {
            utils.handleUnexpectedError(err, res);
            return;
        }
        if (user.length == 0) {
            res.status(400).send('This email is not tracking any courses!');
            return;
        }
        req.db.collection(USER_DB).find({
            email: email, 
            'trackings.department': department, 
            'trackings.courseNumber': courseNumber,
            'trackings.courseSection': courseSection,
            'trackings.term': term }).toArray(function (err, revisedUser) {
            if (err) {
                utils.handleUnexpectedError(err, res);
                return;
            }
            if (revisedUser.length == 0) {
                res.status(400).send('This email is not tracking the specified request!');
                return;
                
            } else {
                console.log(revisedUser[0]);
            
                for (let i = 0; i < revisedUser[0].courses.length; i++) {
                    if (revisedUser[0].trackings[i].department == department && revisedUser[0].trackings[i].courseNumber == courseNumber &&
                        revisedUser[0].trackings[i].courseSection == courseSection && revisedUser[0].trackings[i].term == term) {
                        revisedUser[0].trackings.splice(i, 1);
                        break;
                    }
                }
                req.db.collection(USER_DB).updateOne({ email: email }, { $set: { trackings: revisedUser[0].trackings } }, function(err) {
                    if (err){
                        utils.handleUnexpectedError(err, res);
                        return;
                    }
                    res.send('ok');
                });
            }
            console.log('Removing ' + email + '\'s tracking request for ' + department + ' ' + courseNumber + ' ' + courseSection + ' ' + term + '.');
        });
    });
});

app.listen(port, () => console.log('Serving root on port ' + port));