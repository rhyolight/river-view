var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var yaml = require('js-yaml');
var async = require('async');
var moment = require('moment-timezone');
var expect = require('chai').expect;
var assert = require('chai').assert;
var CronJob = require('cron').CronJob;
var Lockmaster = require('../../lib/lockmaster.js');

var riverName = global._RIVER_NAME_;

var riverDir = path.join(__dirname, '..', '..', 'rivers', riverName);
var configPath = path.join(riverDir, 'config.yml');
var parserPath = path.join(riverDir, 'parser.js');

var TIMEOUT = 20000;

var config;
var httpResponses = {};
var lockmaster = new Lockmaster({});

function parseYaml(filePath) {
    var contents = fs.readFileSync(filePath, 'utf8');
    return yaml.safeLoad(contents);
}

describe('river directory', function() {

    it('exists', function(done) {
        fs.exists(riverDir, function(exists) {
            expect(exists).to.equal(true, 'Expected river directory at ' + riverDir);
            done();
        });
    });

    it('has a config.yml', function(done) {
        fs.exists(configPath, function(exists) {
            expect(exists).to.equal(true, 'Expected river config at ' + configPath);
            done();
        });
    });

    it('has a parser.js', function(done) {
        fs.exists(parserPath, function(exists) {
            expect(exists).to.equal(true, 'Expected river parser at ' + parserPath);
            done();
        });
    });

});

describe('river config', function() {

    this.timeout(TIMEOUT);

    it('is valid YAML', function(done) {
        try {
            config = parseYaml(configPath);
        } catch (e) {
            assert.fail(null, null, 'config.yml is not valid YAML.');
        } finally {
            done();
        }
    });

    it('has a name', function() {
        assert.ok(config.name, 'config.yml is missing "name"');
    });

    it('has a valid type', function() {
        assert.ok(config.type, 'config.yml is missing "type"');
        expect(['scalar', 'geospatial']).to.contain(config.type);
    });

    it('fields contains lat/lon if geospatial', function() {
        if (config.type == 'geospatial') {
            expect(config.fields).to.contain('latitude', 'longitude');
        }
    });

    it('has a description', function() {
        assert.ok(config.description, 'config.yml is missing "description"');
    });

    it('has an author', function() {
        assert.ok(config.description, 'config.yml is missing "author"');
    });

    it('has an email', function() {
        assert.ok(config.description, 'config.yml is missing "email"');
    });

    it('has a valid timezone', function() {
        assert.ok(config.timezone, 'config.yml is missing "timezone"');
        assert.ok(_.contains(moment.tz.names(), config.timezone), '"timezone" value in config must be a valid timezone string.');
    });

    it('has a valid interval', function() {
        var oneMin = moment.duration(1, 'minute').asSeconds();
        var intervalString = config.interval;
        if (config.hasOwnProperty('interval')) {
            var intervalString = config.interval
                interval = moment.duration(
                parseInt(intervalString.split(/\s+/).shift()),
                intervalString.split(/\s+/).pop()
            ).asSeconds();
            // Interval must be over 1 minute.
            expect(interval).to.be.at.least(oneMin);
        } else if (config.hasOwnProperty('cronInterval')) {
            var cronInterval = config.cronInterval;
            if (typeof cronInterval === 'string') {
                try {
                    new CronJob(config.cronInterval, function() {})
                } catch(e) {
                    assert.fail(null, null, 'Invalid cronInterval: ' + config.cronInterval);
                }
            } else { // list of cron intervals
                _.each(config.cronInterval, function(interval) {
                    try {
                        new CronJob(interval, function() {})
                    } catch(e) {
                        assert.fail(null, null, 'Invalid cronInterval in list: ' + interval);
                    }
                });
            }
        } else {
            assert.fail(null, null, 'No valid interval specified. (possible options are "interval" and "cronInterval")');
        }
    });

    it('has a valid expires', function() {
        var sixMonths = moment.duration(6, 'months').asMonths();
        var expiresString = config.expires;
        var expires = moment.duration(
            parseInt(expiresString.split(/\s+/).shift()),
            expiresString.split(/\s+/).pop()
        ).asMonths();
        assert.ok(config.expires, 'config.yml is missing "expires"');
        // Expires must be under 6 months.
        expect(expires).to.be.at.most(sixMonths);
    });

    it('has at least one source', function() {
        assert.ok(config.sources, 'config.yml is missing "sources"');
        expect(config.sources).to.be.instanceOf(Array, '"sources" must be an array of URLs.');
    });

    it('sources all resolve to working URLs', function(done) {
        var fetchers = {};
        var me = this;

        // Each source URL needs time for the HTTP call to respond. We will
        // increase the callback for each source.
        me.timeout(TIMEOUT * config.sources.length);

        _.each(config.sources, function(sourceUrl) {
            fetchers[sourceUrl] = function(callback) {
                lockmaster.makeRequest(sourceUrl, function(err, resp, body) {
                    if (err) callback(err);
                    callback(null, body);
                });
            };
        });
        async.parallel(fetchers, function(error, responses) {
            assert.notOk(error);
            httpResponses = responses;
            done()
        });
    });

    it('has at least one field', function() {
        assert.ok(config.fields, 'config.yml is missing "fields"');
        expect(config.fields).to.be.instanceOf(Array, '"fields" must be an array of strings.');
        _.each(config.fields, function(field) {
            assert.ok(field, 'at least one element of the "fields" array is empty');
        });
    });

});

describe('river parser', function() {

    var requirePath = path.join(parserPath.split('.')[0]);
    var riverModule = require(requirePath);
    var parse, initialize;

    this.timeout(TIMEOUT);

    it('parser module exports a parse function or parse/initialize functions', function() {
        if (typeof riverModule != 'function') {
            expect(riverModule).to.be.instanceOf(Object);
            expect(riverModule).to.have.keys('parse', 'initialize');
            expect(riverModule.parse).to.be.instanceOf(Function);
            expect(riverModule.initialize).to.be.instanceOf(Function);
            parse = riverModule.parse;
            initialize = riverModule.initialize;
        } else {
            expect(riverModule).to.be.instanceOf(Function);
            parse = riverModule;
        }
    });

    describe('when passed a live response body', function() {
        var temporalCallbacks = [];
        var metadataCallbacks = [];
        var riverModule = require(requirePath);
        var parse, initialize;

        if (typeof riverModule != 'function') {
            parse = riverModule.parse;
            initialize = riverModule.initialize;
        } else {
            parse = riverModule;
        }

        lockmaster = new Lockmaster({rivers: [{
            initialize: initialize,
            parse: parse
        }]});

            it('calls the temporalDataCallback with data matching config', function(done) {
                lockmaster.initializeRivers(function() {
                    var fetchers = [];
                    _.each(httpResponses, function(body, url) {
                        fetchers.push(function(cb) {
                            var options = {config: config, url: url};
                            parse(body, options,
                                function(id, ts, vals) {
                                    assert.ok(id, 'temporal data callback must be sent an id');
                                    assert.ok(ts === parseInt(ts, 10), 'timestamp is not an integer');
                                    expect(vals).to.be.instanceOf(Array);
                                    expect(vals).to.have.length(config.fields.length, 'length of values array sent to temporal callback should match the fields in the config.');
                                    // If this is a geospatial data stream, latitude and longitude MUST exist.
                                    if (config.type == 'geospatial') {
                                        assert.ok(vals[config.fields.indexOf('latitude')], 'geospatial river stream missing latitude value');
                                        assert.ok(vals[config.fields.indexOf('longitude')], 'geospatial river stream missing longitude value');
                                    }
                                    temporalCallbacks.push(arguments);
                                },
                                function(id, metadata) {}
                            );
                            setTimeout(cb, 1000);
                        });
                    });
                    async.parallel(fetchers, function(err) {
                        if (err) assert.fail(null, null, err.message);
                        expect(temporalCallbacks).to.have.length.above(0, 'temporal callback was never called');
                        done();
                    });
                });
            });

            it('calls the metadataCallback with JSON-parseable data', function(done) {
                lockmaster.initializeRivers(function() {
                    var fetchers = [];
                    _.each(httpResponses, function(body, url) {
                        fetchers.push(function(cb) {
                            var options = {config: config, url: url};
                            parse(body, options,
                                function() {},
                                function(id, metadata) {
                                    assert.ok(id, 'metadata data callback must be sent an id');
                                    metadataCallbacks.push(metadata);
                                }
                            );
                            setTimeout(cb, 1000);
                        });
                    });
                    async.parallel(fetchers, function(err) {
                        if (err) assert.fail(null, null, err.message);
                        if (metadataCallbacks.length) {
                            _.each(metadataCallbacks, function(id, metadata) {
                                assert.ok(id, 'Missing id when saving metadata');
                                try {
                                    JSON.stringify(metadata);
                                } catch(e) {
                                    assert.fail(null, null, 'Cannot stringify metadata response into JSON: ' + metadata);
                                }
                            });
                        }
                        done();
                    });
                });
            });




    });

});
