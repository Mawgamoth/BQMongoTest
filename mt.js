var cls = require('./lib/class.js');

module.exports = Database = cls.Class.extend({
    init: function() {
        var self = this;

        this.mongoClient = require("mongodb").MongoClient;
        this.ready = false;

        //settings
        this.host = "localhost";
        this.port = "27017";
        this.db = "bq";

        //collections
        this.accounts = null;
        this.characters = null;
    },

    connect: function(callback) {
        var self = this;

        if(this.ready) {
            return console.dir("Database already connected.");
        }

        this.mongoClient.connect("mongodb://"+this.host+":"+this.port+"/"+this.db, function(err, db) {
            if(err) {
                return console.dir(err);
            }

            console.dir("Connected to Database.");

            //creating and referencing collections are nested
            //starting with accounts
            db.createCollection('accounts', function(err, collection) {
                if(err) {
                    self.mongoClient.close(function() {});
                    return console.dir(err);
                }
                else {
                    self.accounts = collection;
                    self.accounts.ensureIndex( { "email": 1 }, { unique: true }, function(err, result) {});

                    //characters collection
                    db.createCollection('characters', function(err, collection) {
                        if(err) {
                            self.mongoClient.close(function() {});
                            return console.dir(err);
                        }
                        else {
                            self.characters = collection;

                            self.characters.ensureIndex( { "name": 1 }, { unique: true }, function(err, result) {
                                //all collections created/referenced and indexes insured
                                //database is good to go
                                self.ready = true;
                                if(callback)
                                    return callback();
                            });
                        }
                    });
                }
            });
        });

    },

    createAccount: function(email, password, callback)
    {
        if(!this.ready) {
            return console.dir("Database not connected.");
        }

         this.accounts.insert({"email":email, "password":password}, function(err, result) {
            if(err) {
                console.dir("Account " + email + " already exists.");
                if(callback)
                    callback(false);
            }
            else {
                console.dir("Account " + email + " created.");
                if(callback)
                    callback(true);
            }
        });
    },

    authenticateAccount: function(email, password, callback)
    {
        if(!this.ready) {
            return console.dir("Database not connected.");
        }

        this.accounts.findOne({"email":email, "password":password}, function (err, result) {
            if(err || result === null) {
                if(callback)
                    return callback(false);
            }
            else {
                if(callback)
                    return callback(true, result._id.toString());
            }
        });
    },

    saveCharacter: function(accountId, data, callback) {
        var self = this;

        if(!this.ready) {
            return console.dir("Database not connected.");
        }

        if(!accountId || !data.name)
        {
            console.dir("Cannot save character, no accountId or name specified.")
            if(callback)
                return callback(false);
            return;
        }
        this.characters.findOne({"accountId":accountId, "name":data.name}, function(err, result) {
            if(result === null) {//character doesn't exist yet
                data.accountId = accountId; //associate character with account
                self.characters.insert(data, function(err, result) {
                    if(err) {
                        console.dir(err);
                        if(callback)
                            callback(false);
                    }
                    else {
                        if(callback)
                            callback(true);  //character created
                    }
                });
            }
            else { //character exists, update it
                //it was my understanding that collection.update only saves what has been changed
                //but for some reason accountId keeps being removed
                data.accountId = accountId;
                self.characters.update({"accountId":accountId, "name":data.name}, data, function(err, result) {
                    if(err) {
                        console.dir(err);
                        if(callback)
                            return callback(false);
                    }
                    else {
                        if(callback)
                            return callback(true); //character updated
                    }
                });
            }
        });
    },

    loadCharacter: function(accountId, name, callback) {
        if(!this.ready) {
            return console.dir("Database not connected.");
        }

        this.characters.findOne({"accountId":accountId, "name":name}, function(error, result) {
            if(result === null) {  //character doesn't exist
                if(callback)
                    return callback(false, null);
            }
            else { //character found
                //delete result["accountId"];  //keep accountId with the results?  no for now
                delete result._id; //no need for this

                if(callback)
                    return callback(true, result);
            }
        });
    }
});

//testing
var database = new Database;
database.connect(function() {
    var bobLoggedIn = false;
    var dataToBeLoaded = {};

    var dataToBeSaved = {
        name: "Arthur",
        level: "99"
    };

    database.createAccount("bob", "bobpass", function(success) {});
    database.createAccount("bob", "bobbypass", function(success) {});    //should fail

    database.authenticateAccount("bob", "bobpass", function(success, accountId) {
        if(success) {
            console.dir("Login success.  ID: "+accountId);
            bobLoggedIn = true;

            database.saveCharacter(accountId, dataToBeSaved, function(success) {
                if(success) {
                    console.dir("Character data saved.");

                    database.loadCharacter(accountId, "Arthur", function(success, data){
                        if(success){
                            dataToBeLoaded = data;
                            console.dir("Character loaded.");
                            console.dir(dataToBeLoaded);
                        }
                        else {
                            console.dir("Character doesn't exist, or bad accountId("+accountId+").");
                        }
                    });
                }
                else {
                    console.dir("Problem saving character data.");

                    //try to do a load anyways
                    database.loadCharacter(accountId, "Arthur", function(success, data){
                        if(success){
                            dataToBeLoaded = data;
                            console.dir(dataToBeLoaded);
                        }
                        else {
                            console.dir("Character doesn't exist, or bad accountId("+accountId+").");
                        }
                    });
                }
            });

        }
        else {
            console.dir("Wrong email or password.");
        }
    });
});