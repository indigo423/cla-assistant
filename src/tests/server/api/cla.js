/*global describe, it, beforeEach, afterEach*/

// unit test
var assert = require('assert');
var sinon = require('sinon');

// config
global.config = require('../../../config');

// models
var Repo = require('../../../server/documents/repo').Repo;
var User = require('../../../server/documents/user').User;

//services
var github = require('../../../server/services/github');
var cla = require('../../../server/services/cla');
var repo_service = require('../../../server/services/repo');
var org_service = require('../../../server/services/org');
var statusService = require('../../../server/services/status');
var prService = require('../../../server/services/pullRequest');
var log = require('../../../server/services/logger');

// Test data
var testData = require('../testData').data;

// api
var cla_api = require('../../../server/api/cla');

describe('', function () {
    var reqArgs;
    var resp;
    var error;

    beforeEach(function () {
        reqArgs = {
            cla: {
                getGist: {
                    gist: testData.repo_from_db.gist
                }
            },
            repoService: {
                get: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            },
            orgService: {
                get: {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    gist: 'https://gist.github.com/aa5a315d61ae9438b18d',
                    token: 'testToken',
                    org: 'octocat'
                }
            }
        };
        resp = {
            cla: {
                getGist: JSON.parse(JSON.stringify(testData.gist)) //clone object
            },
            github: {
                callPullRequest: [{
                    number: 1,
                    head: {
                        sha: 'sha1'
                    }
                }, {
                    number: 2,
                    head: {
                        sha: 'sha2'
                    }
                }],
                callMarkdown: {
                    statusCode: 200,
                    data: {}
                },
                callUser: {
                    id: 1,
                    login: 'one'
                },
                callRepos: testData.orgRepos.concat({
                    id: 2,
                    owner: {
                        login: 'org'
                    }
                })
            },
            repoService: {
                get: JSON.parse(JSON.stringify(testData.repo_from_db)), //clone object
                getByOwner: [JSON.parse(JSON.stringify(testData.repo_from_db))]
            },
            orgService: {
                get: JSON.parse(JSON.stringify(testData.org_from_db)), //clone object
            }
        };
        error = {
            cla: {
                getGist: null,
            },
            github: {
                pullReqest: null,
                markdown: null,
                user: null
            },
            repoService: {
                get: null,
                getByOwner: null
            },
            orgService: {
                get: null
            }
        };


        sinon.stub(cla, 'getGist').callsFake(function (args, cb) {
            if (args.gist && args.gist.gist_url) {
                assert.equal(args.gist.gist_url, reqArgs.cla.getGist.gist);
            } else {
                assert.equal(args.gist, reqArgs.cla.getGist.gist);
            }
            cb(error.cla.getGist, resp.cla.getGist);
        });

        sinon.stub(cla, 'getLinkedItem').callsFake(function (args, cb) {
            cb(error.cla.getLinkedItem, resp.cla.getLinkedItem);
        });

        sinon.stub(github, 'call').callsFake(function (args, cb) {
            if (args.obj === 'pullRequests') {
                assert(args.token);

                cb(error.github.pullReqest, resp.github.callPullRequest);
            } else if (args.obj === 'misc') {
                cb(error.github.markdown, resp.github.callMarkdown);
            } else if (args.obj === 'users') {
                cb(error.github.user, resp.github.callUser);
            } else if (args.obj === 'repos' && args.fun === 'getForOrg') {
                cb(error.github.repos, resp.github.callRepos);
            }
        });
        sinon.stub(repo_service, 'get').callsFake(function (args, cb) {
            assert.deepEqual(args, reqArgs.repoService.get);
            cb(error.repoService.get, resp.repoService.get);
        });
        sinon.stub(org_service, 'get').callsFake(function (args, cb) {
            sinon.assert.calledWithMatch(org_service.get, reqArgs.orgService.get);
            // assert.deepEqual(args, reqArgs.orgService.get);
            cb(error.orgService.get, resp.orgService.get);
        });

        sinon.stub(log, 'error').callsFake(function (msg) {
            assert(msg);
        });
        sinon.stub(log, 'warn').callsFake(function (msg) {
            assert(msg);
        });
        sinon.stub(log, 'info').callsFake(function (msg) {
            assert(msg);
        });

    });
    afterEach(function () {
        cla.getGist.restore();
        cla.getLinkedItem.restore();
        github.call.restore();
        org_service.get.restore();
        repo_service.get.restore();
        global.config.server.github.timeToWait = 0;
        log.error.restore();
        log.warn.restore();
        log.info.restore();
    });

    describe('cla:get', function () {
        it('should get gist and render it with repo token', function (it_done) {
            var req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            };

            cla_api.get(req, function () {
                assert(repo_service.get.called);
                assert(github.call.calledWithMatch({
                    obj: 'misc',
                    fun: 'renderMarkdown',
                    token: testData.repo_from_db.token
                }));

                it_done();
            });
        });

        it('should get gist and render it without user and repo token', function (it_done) {
            resp.repoService.get.token = undefined;

            var req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            };

            cla_api.get(req, function () {
                assert(repo_service.get.called);
                assert(github.call.calledWithMatch({
                    obj: 'misc',
                    fun: 'renderMarkdown',
                    token: undefined
                }));

                it_done();
            });
        });

        it('should get gist and render it with user token if there is no repo token', function (it_done) {
            reqArgs.repoService.get = {
                repoId: 1
            };
            resp.repoService.get.token = undefined;

            var req = {
                args: {
                    repoId: 1
                },
                user: {
                    token: 'user_token'
                }
            };

            cla_api.get(req, function () {
                assert(repo_service.get.called);
                assert(github.call.calledWithMatch({
                    obj: 'misc',
                    fun: 'renderMarkdown',
                    token: 'user_token'
                }));
                it_done();
            });
        });

        it('should handle wrong gist url', function (it_done) {

            var repoStub = sinon.stub(Repo, 'findOne').callsFake(function (args, cb) {
                var repo = {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    gist: '123',
                    token: 'abc'
                };
                cb(null, repo);
            });

            resp.cla.getGist = undefined;
            error.cla.getGist = 'error';

            var req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            };

            cla_api.get(req, function (err) {
                assert.equal(!!err, true);
                assert(!github.call.called);

                repoStub.restore();
                it_done();
            });

        });

        it('should handle result with no files', function (it_done) {
            resp.cla.getGist.files = undefined;

            var req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            };

            cla_api.get(req, function () {
                assert(repo_service.get.called);

                it_done();
            });

        });

        it('should render metadata-file with custom fields if provided', function (it_done) {
            var req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            };

            cla_api.get(req, function (err, gistContent) {
                assert.ifError(err);
                assert(github.call.calledTwice);
                assert(gistContent.raw);
                assert(gistContent.meta);

                it_done();
            });

        });

        describe('in case of failing github api', function () {
            var req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                },
                user: {
                    token: 'abc'
                }
            };

            it('should handle github error', function (it_done) {
                resp.github.callMarkdown = {};
                error.github.markdown = 'any error';
                cla_api.get(req, function (err) {
                    assert(err);
                    it_done();
                });
            });

            it('should handle error stored in response message', function (it_done) {
                resp.github.callMarkdown = {
                    statusCode: 500,
                    message: 'somthing went wrong, e.g. user revoked access rights'
                };
                error.github.markdown = null;
                cla_api.get(req, function (err) {
                    assert.equal(err, resp.github.callMarkdown.message);
                    it_done();
                });
            });

            it('should handle error only if status unequal 200 or there is no response', function (it_done) {
                resp.github.callMarkdown = {
                    statusCode: 200,
                    data: {}
                };
                error.github.markdown = 'any error';

                log.error.restore();
                sinon.stub(log, 'error').callsFake(function () {
                    assert();
                });

                cla_api.get(req, function (err, res) {

                    assert(res);
                    assert(!err);
                    it_done();
                });
            });
        });


    });

    describe('cla:sign', function () {
        var req, expArgs, testUser;
        beforeEach(function () {
            req = {
                user: {
                    id: 3,
                    login: 'user'
                },
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    gist: testData.repo_from_db.gist
                }
            };
            expArgs = {
                claSign: {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    user: 'user',
                    userId: 3
                }
            };
            testUser = {
                save: function () {
                },
                name: 'testUser',
                requests: [{
                    repo: 'Hello-World',
                    owner: 'octocat',
                    numbers: [1]
                }]
            };
            // reqArgs.cla.getLinkedItem
            resp.cla.getLinkedItem = resp.repoService.get;
            reqArgs.cla.getLinkedItem = {
                repo: 'Hello-World',
                owner: 'octocat'
            };
            error.cla.isClaRequired = null;
            resp.cla.isClaRequired = true;

            sinon.stub(statusService, 'update').callsFake(function (args, cb) {
                assert(args.signed);
                cb(null);
            });
            sinon.stub(cla, 'sign').callsFake(function (args, cb) {
                cb(null, 'done');
            });
            sinon.stub(cla, 'check').callsFake(function (args, cb) {
                args.gist = req.args.gist;
                cb(null, true);
            });
            sinon.stub(prService, 'editComment').callsFake(function (args, cb) {
                cb(null);
            });

            sinon.stub(User, 'findOne').callsFake((selector, cb) => {
                cb(null, testUser);
            });

            sinon.stub(cla, 'isClaRequired').callsFake(function (args, cb) {
                cb(error.cla.isClaRequired, resp.cla.isClaRequired);
            });
        });

        afterEach(function () {
            cla.check.restore();
            cla.sign.restore();
            prService.editComment.restore();
            statusService.update.restore();
            User.findOne.restore();
            cla.isClaRequired.restore();
        });

        it('should call cla service on sign', function (it_done) {
            cla_api.sign(req, function (err) {
                assert.ifError(err);
                assert(cla.sign.called);
                sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                it_done();
            });
        });

        it('should call cla service on sign with custom fields', function (it_done) {
            expArgs.claSign.custom_fields = '{"json":"as", "a":"string"}';

            req.args.custom_fields = '{"json":"as", "a":"string"}';
            cla_api.sign(req, function (err) {
                assert.ifError(err);
                assert(cla.sign.called);
                sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                it_done();
            });
        });

        it('should update status of pull request created by user, who signed', function (it_done) {
            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert.ok(res);
                assert(statusService.update.called);
                sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                it_done();
            });
        });

        it('should update status of pull request using token of linked org', function (it_done) {
            resp.repoService.get = null;
            resp.cla.getLinkedItem = resp.orgService.get;

            this.timeout(100);
            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert.ok(res);
                sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                setTimeout(function () {
                    assert(statusService.update.called);
                    it_done();
                }, 50);
            });
        });

        it('should update status of all open pull requests for the repo if user model has no requests stored', function (it_done) {
            testUser.requests = undefined;

            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert.ok(res);
                sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                assert.equal(statusService.update.callCount, 2);
                assert(github.call.calledWithMatch({
                    obj: 'pullRequests',
                    fun: 'getAll'
                }));
                assert(prService.editComment.called);

                it_done();
            });
        });

        it('should update status of all open pull requests for the repos and orgs that shared the same gist if user model has no requests stored', function (it_done) {
            testUser.requests = undefined;
            resp.cla.getLinkedItem = Object({
                sharedGist: true
            }, resp.cla.getLinkedItem);
            sinon.stub(cla_api, 'validateSharedGistItems').callsFake(() => { });
            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert(cla_api.validateSharedGistItems.called);
                cla_api.validateSharedGistItems.restore();
                it_done();
            });
        });

        it('should update status of all open pull requests for the org that when linked an org if user model has no requests stored', function (it_done) {
            testUser.requests = undefined;
            resp.cla.getLinkedItem = testData.org_from_db;
            sinon.stub(cla_api, 'validateOrgPullRequests').callsFake(() => { });
            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert(cla_api.validateOrgPullRequests.called);
                cla_api.validateOrgPullRequests.restore();
                it_done();
            });
        });

        it('should comment with user_map if it is given', function (it_done) {
            cla.check.restore();
            prService.editComment.restore();

            sinon.stub(cla, 'check').callsFake(function (args, cb) {
                args.gist = req.args.gist;
                cb(null, true, {
                    signed: [],
                    not_signed: []
                });
            });
            sinon.stub(prService, 'editComment').callsFake(function (args) {
                assert(args.user_map.signed);
            });

            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert.ok(res);
                sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                assert(!github.call.calledWithMatch({
                    obj: 'pullRequests',
                    fun: 'getAll'
                }));
                assert(statusService.update.called);
                assert(prService.editComment.called);
                it_done();
            });
        });

        it('should update users stored pull requests', function (it_done) {
            testUser.requests[0].numbers = [1, 2];

            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert.ok(res);
                sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                sinon.assert.called(User.findOne);
                sinon.assert.calledTwice(cla.check);

                it_done();
            });
        });

        it('should call update status of all PRs of the user in repos and orgs with the same shared gist', function (it_done) {
            resp.orgService.get.org = 'testOrg';
            testUser.requests.push({
                repo: 'testRepo',
                owner: 'testOrg',
                numbers: [1]
            });
            resp.cla.getLinkedItem.sharedGist = true;
            sinon.stub(repo_service, 'getRepoWithSharedGist').callsFake(function (gist, done) {
                done(null, [resp.repoService.get]);
            });
            sinon.stub(org_service, 'getOrgWithSharedGist').callsFake(function (gist, done) {
                done(null, [resp.orgService.get]);
            });
            sinon.stub(cla_api, 'validateSharedGistItems').callsFake(function (args, done) {
                done();
            });
            cla_api.sign(req, function (error) {
                sinon.assert.notCalled(cla_api.validateSharedGistItems);
                sinon.assert.calledTwice(cla.check);

                cla_api.validateSharedGistItems.restore();
                repo_service.getRepoWithSharedGist.restore();
                org_service.getOrgWithSharedGist.restore();
                it_done();
            });
        });

        it('should delete stored pull requests from unlinked org or repo', function (it_done) {
            testUser.requests.push({
                repo: 'Not linked anymore',
                owner: 'Test',
                numbers: [1]
            });
            cla.getLinkedItem.restore();
            sinon.stub(cla, 'getLinkedItem').callsFake(function (args, cb) {
                if (args.owner === 'octocat' && args.repo === 'Hello-World') {
                    cb(error.cla.getLinkedItem, resp.cla.getLinkedItem);
                } else {
                    cb(null, null);
                }
            });
            cla_api.sign(req, function (err, res) {
                assert.ifError(err);
                assert(!testUser.requests.length);
                sinon.assert.calledOnce(cla.check);

                it_done();
            });
        });
    });

    describe('cla api', function () {
        var req, getGistReq;
        beforeEach(function () {
            req = {
                user: {
                    id: 3,
                    login: 'user'
                },
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            };
            getGistReq = {
                args: {
                    repoId: 1
                }
            };
        });

        it('should call cla service on getLastSignature', function (it_done) {
            sinon.stub(cla, 'getLastSignature').callsFake(function (args, cb) {
                cb(null, {});
            });

            req.args = {
                repo: 'Hello-World',
                owner: 'octocat'
            };
            req.user = {
                login: 'testUser'
            };

            cla_api.getLastSignature(req, function (err) {
                assert.ifError(err);
                assert(cla.getLastSignature.calledWithMatch({
                    repo: 'Hello-World',
                    owner: 'octocat',
                    user: 'testUser'
                }));

                cla.getLastSignature.restore();
                it_done();
            });
        });

        it('should call cla service on getSignedCLA', function (it_done) {
            sinon.stub(cla, 'getSignedCLA').callsFake(function (args, cb) {
                assert.deepEqual(args, {
                    user: 'user'
                });
                cb(null, {});
            });

            req.args = {
                user: 'user'
            };

            cla_api.getSignedCLA(req, function (err) {
                assert.ifError(err);
                assert(cla.getSignedCLA.called);

                cla.getSignedCLA.restore();
                it_done();
            });
        });

        it('should call cla service on check', function (it_done) {
            sinon.stub(cla, 'check').callsFake(function (args, cb) {
                assert.deepEqual(args, {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    user: 'user',
                    userId: 3,
                    number: undefined
                });
                cb(null, true);
            });

            cla_api.check(req, function (err) {
                assert.ifError(err);
                assert(cla.check.called);

                cla.check.restore();
                it_done();
            });
        });

        it('should call cla service on getAll', function (it_done) {
            req.args.gist = testData.repo_from_db.gist;
            sinon.stub(cla, 'getAll').callsFake(function (args, cb) {
                assert.deepEqual(args, {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    gist: testData.repo_from_db.gist
                });
                cb(null, []);
            });

            cla_api.getAll(req, function (err) {
                assert.ifError(err);
                assert(cla.getAll.called);

                cla.getAll.restore();
                it_done();
            });
        });

        it('should call cla service on getGist with repoId', function (it_done) {
            reqArgs.repoService.get = {
                repoId: 1
            };
            cla_api.getGist(getGistReq, function (err) {
                assert.ifError(err);
                assert(cla.getGist.called);

                it_done();
            });
        });

        it('should call cla service on getGist with orgId', function (it_done) {
            getGistReq = {
                args: {
                    orgId: 1
                }
            };
            reqArgs.orgService.get = {
                orgId: 1
            };

            cla_api.getGist(getGistReq, function (err) {
                assert.ifError(err);
                assert(org_service.get.called);
                assert(cla.getGist.called);

                it_done();
            });
        });

        it('should call cla service using user token, not repo token', function (it_done) {
            req.args.gist = testData.repo_from_db.gist;
            req.user.token = 'user_token';

            cla_api.getGist(req, function (err) {
                assert.ifError(err);
                assert(cla.getGist.calledWith({
                    token: 'user_token',
                    gist: testData.repo_from_db.gist
                }));

                it_done();
            });
        });

        it('should call cla service getGist with user token even if repo is not linked anymore', function (it_done) {
            req.args.gist = {
                gist_url: testData.repo_from_db.gist
            };
            req.user.token = 'user_token';

            resp.repoService.get = null;
            error.repoService.get = 'There is no repo.';

            cla_api.getGist(req, function (err) {
                assert.ifError(err);
                assert(cla.getGist.called);

                it_done();
            });
        });

        it('should fail calling cla service getGist with user token even if repo is not linked anymore when no gist is provided', function (it_done) {
            req.user.token = 'user_token';

            resp.repoService.get = null;
            error.repoService.get = 'There is no repo.';

            cla_api.getGist(req, function (err) {
                assert(err);
                assert(!cla.getGist.called);

                it_done();
            });
        });
    });

    describe('cla:countCLA', function () {
        var req = {};
        beforeEach(function () {
            resp.cla.getLinkedItem = testData.repo_from_db;
            req.args = {
                repo: 'Hello-World',
                owner: 'octocat'
            };
            resp.cla.getAll = [{}];
            sinon.stub(cla, 'getAll').callsFake(function (args, cb) {
                assert(args.gist.gist_url);
                assert(args.gist.gist_version);
                assert(args.repoId || args.orgId);

                cb(error.cla.getAll, resp.cla.getAll);
            });
        });
        afterEach(function () {
            cla.getAll.restore();
        });

        it('should call getAll on countCLA', function (it_done) {
            reqArgs.repoService.get.gist = {
                gist_url: testData.repo_from_db.gist,
                gist_version: testData.gist.history[0].version
            };
            req.args.gist = {
                gist_url: testData.repo_from_db.gist,
                gist_version: testData.gist.history[0].version
            };


            cla_api.countCLA(req, function (err, number) {
                assert.ifError(err);
                assert(cla.getAll.called);
                assert.equal(number, 1);

                it_done();
            });
        });

        it('should call getAll on countCLA for repo of linked org', function (it_done) {
            resp.cla.getLinkedItem = testData.org_from_db;
            reqArgs.repoService.get.gist = {
                gist_url: testData.org_from_db.gist,
                gist_version: testData.gist.history[0].version
            };
            req.args.gist = {
                gist_url: testData.org_from_db.gist,
                gist_version: testData.gist.history[0].version
            };


            cla_api.countCLA(req, function (err, number) {
                assert.ifError(err);
                assert(cla.getAll.called);
                assert.equal(number, 1);

                it_done();
            });
        });
        it('should get gist version if not provided', function (it_done) {
            reqArgs.repoService.get.gist = {
                gist_url: testData.repo_from_db.gist
            };
            req.args.gist = {
                gist_url: testData.repo_from_db.gist
            };
            resp.cla.getAll = [{}, {}];


            cla_api.countCLA(req, function (err, number) {
                assert.ifError(err);
                assert(cla.getAll.called);
                assert.equal(number, resp.cla.getAll.length);

                it_done();
            });
        });
        it('should get gist url and version if not provided', function (it_done) {
            resp.cla.getAll = [{}, {}];

            cla_api.countCLA(req, function (err, number) {
                assert.ifError(err);
                assert(cla.getAll.called);
                assert.equal(number, resp.cla.getAll.length);

                it_done();
            });
        });

        it('it should handle unexisting gist', function (it_done) {
            resp.cla.getGist = null;

            cla_api.countCLA(req, function (err, number) {
                assert(err);
                assert(!cla.getAll.called);

                it_done();
            });
        });
    });

    describe('cla:upload', function () {
        var req;

        beforeEach(function () {
            reqArgs.cla.sign = {};
            req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    users: ['one']
                },
                user: {
                    token: 'user_token'
                }
            };
            sinon.stub(cla, 'sign').callsFake(function (args, cb) {
                cb(error.cla.sign, reqArgs.cla.sign);
            });
        });

        afterEach(function () {
            cla.sign.restore();
        });

        it('should silently exit when no users provided', function (it_done) {
            req.args.users = undefined;

            cla_api.upload(req, function (err, res) {
                assert.equal(err, undefined);
                assert.equal(res, undefined);
                it_done();
            });
        });

        it('should not "sign" cla when github user not found', function (it_done) {
            error.github.callUser = 'not found';
            resp.github.callUser = undefined;

            cla_api.upload(req, function () {
                assert(github.call.calledWith({
                    obj: 'users',
                    fun: 'getForUser',
                    arg: {
                        username: 'one'
                    },
                    token: 'user_token'
                }));
                assert(!cla.sign.called);
                it_done();
            });
        });

        it('should "sign" cla for two users', function (it_done) {
            req.args.users = ['one', 'two'];
            cla_api.upload(req, function () {
                assert(github.call.called);
                assert(cla.sign.calledWith({
                    repo: 'Hello-World',
                    owner: 'octocat',
                    user: 'one',
                    userId: 1
                }));
                assert(cla.sign.calledTwice);
                it_done();
            });
        });

        it('should "sign" cla for linked org', function (it_done) {
            req.args.users = ['one', 'two'];
            req.args.repo = undefined;
            cla_api.upload(req, function () {
                assert(github.call.called);
                assert(cla.sign.calledWith({
                    repo: undefined,
                    owner: 'octocat',
                    user: 'one',
                    userId: 1
                }));
                assert(cla.sign.calledTwice);
                it_done();
            });
        });
    });

    describe('cla: validatePullRequests', function () {
        var req;
        beforeEach(function () {
            reqArgs.orgService.get = {
                repo: 'Hello-World',
                owner: 'octocat',
                token: 'testToken',
                org: 'octocat'
            };
            req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    token: 'testToken',
                    gist: testData.repo_from_db.gist
                }
            };
            resp.cla.getLinkedItem = Object.assign({}, testData.repo_from_db);
            error.cla.isClaRequired = null;
            resp.cla.isClaRequired = true;

            sinon.stub(statusService, 'update').callsFake(function (args, cb) {
                assert(args.signed);
                assert(args.token);
                assert(args.sha);
                cb();
            });
            sinon.stub(statusService, 'updateForNullCla').callsFake(function (args, cb) {
                cb();
            });
            sinon.stub(cla, 'check').callsFake(function (args, cb) {
                args.gist = req.args.gist;
                cb(null, true);
            });
            sinon.stub(prService, 'editComment').callsFake(function (args, cb) {
                cb();
            });
            sinon.stub(prService, 'deleteComment').callsFake(function (args, cb) {
                cb();
            });
            sinon.stub(repo_service, 'getByOwner').callsFake(function (owner, cb) {
                cb(error.repoService.getByOwner, resp.repoService.getByOwner);
            });
            sinon.stub(cla, 'isClaRequired').callsFake(function (args, cb) {
                cb(error.cla.isClaRequired, resp.cla.isClaRequired);
            });
        });

        afterEach(function () {
            cla.check.restore();
            statusService.update.restore();
            statusService.updateForNullCla.restore();
            prService.editComment.restore();
            prService.deleteComment.restore();
            repo_service.getByOwner.restore();
            cla.isClaRequired.restore();
        });
        it('should update all open pull requests', function (it_done) {

            cla_api.validatePullRequests(req, function (err) {
                assert.ifError(err);
                assert.equal(statusService.update.callCount, 2);
                assert(github.call.calledWithMatch({
                    obj: 'pullRequests',
                    fun: 'getAll'
                }));
                assert(prService.editComment.called);

                it_done();
            });
        });

        it('should update all PRs with users token', function (it_done) {
            req.args.token = undefined;
            req.user = {
                token: 'user_token'
            };
            cla_api.validatePullRequests(req, function (err) {
                assert.ifError(err);
                assert.equal(statusService.update.callCount, 2);
                assert(github.call.calledWithMatch({
                    obj: 'pullRequests',
                    fun: 'getAll'
                }));
                assert(prService.editComment.called);

                it_done();
            });
        });

        it('should update status of all repos of the org', function (it_done) {
            req.args.org = 'octocat';

            resp.repoService.get = null;
            resp.cla.getLinkedItem = resp.orgService.get;
            global.config.server.github.timeToWait = 10;
            resp.repoService.getByOwner = [];

            this.timeout(100);
            cla_api.validateOrgPullRequests(req, function (err, res) {
                assert.ifError(err);
                assert.ok(res);
                // sinon.assert.calledWithMatch(cla.sign, expArgs.claSign);

                setTimeout(function () {
                    assert.equal(statusService.update.callCount, 4);
                    it_done();
                }, 50);
            });
        });

        it('should update status of all repos of the org slowing down', function (it_done) {
            this.timeout(600);
            req.args.org = 'octocat';
            resp.repoService.get = null;
            resp.cla.getLinkedItem = resp.orgService.get;
            resp.repoService.getByOwner = [];
            console.log(resp.github.callRepos.length);
            for (var index = 0; index < 28; index++) {
                resp.github.callRepos.push({
                    id: 'test_' + index,
                    owner: {
                        login: 'org'
                    }
                });
            }
            global.config.server.github.timeToWait = 10;

            cla_api.validateOrgPullRequests(req, function (err, res) {
                assert.ifError(err);
                assert.ok(res);

                setTimeout(function () {
                    assert.equal(statusService.update.callCount, 10 * resp.github.callPullRequest.length);
                }, 100);
                // 10 * timeToWait delay each 10th block
                setTimeout(function () {
                    assert.equal(statusService.update.callCount, 20 * resp.github.callPullRequest.length);
                }, 300);
                setTimeout(function () {
                    assert.equal(statusService.update.callCount, 30 * resp.github.callPullRequest.length);
                    global.config.server.github.timeToWait = 0;
                    it_done();
                }, 550);
            });
        });

        it('should delete comments when rechecking PRs of a repo with a null CLA', function (it_done) {
            resp.cla.getLinkedItem.gist = undefined;
            cla_api.validatePullRequests(req, function (err) {
                assert(prService.deleteComment.called);
                assert(statusService.updateForNullCla.called);
                it_done();
            });
        });
    });

    describe('cla: validateOrgPullRequests', function () {
        var req;
        beforeEach(function () {
            req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat',
                    gist: 'https://gist.github.com/aa5a315d61ae9438b18d',
                    token: 'testToken',
                    org: 'octocat'
                }
            };
            global.config.server.github.timeToWait = 0;
            resp.github.callRepos = testData.orgRepos;
            sinon.stub(repo_service, 'getByOwner').callsFake(function (owner, cb) {
                cb(error.repoService.getByOwner, resp.repoService.getByOwner);
            });
            sinon.stub(cla_api, 'validatePullRequests').callsFake(function (args, callback) {
                if (typeof callback === 'function') {
                    callback(null, null);
                }
            });
        });

        afterEach(function () {
            repo_service.getByOwner.restore();
            cla_api.validatePullRequests.restore();
        });

        it('should NOT validate repos in the excluded list', function (it_done) {
            resp.orgService.get.isRepoExcluded = function () {
                return true;
            };
            resp.repoService.getByOwner = [];
            cla_api.validateOrgPullRequests(req, function () {
                setTimeout(function () {
                    assert(!cla_api.validatePullRequests.called);
                    it_done();
                });
            });
        });

        it('should NOT validate repos with overridden cla', function (it_done) {
            resp.orgService.get.isRepoExcluded = function () {
                return false;
            };
            cla_api.validateOrgPullRequests(req, function () {
                setTimeout(function () {
                    assert(!cla_api.validatePullRequests.called);
                    it_done();
                });
            });
        });

        it('should validate repos that is not in the excluded list and don\'t have overridden cla', function (it_done) {
            resp.repoService.getByOwner = [];
            resp.orgService.get.isRepoExcluded = function () {
                return false;
            };
            cla_api.validateOrgPullRequests(req, function () {
                setTimeout(function () {
                    assert(cla_api.validatePullRequests.called);
                    it_done();
                });
            });
        });

        it('should NOT validate when querying repo collection throw error', function (it_done) {
            error.repoService.getByOwner = 'any error of querying repo collection';
            cla_api.validateOrgPullRequests(req, function (err) {
                assert(!!err);
                assert(!cla_api.validatePullRequests.called);
                it_done();
            });
        });
    });

    describe('cla:getLinkedItem', function () {
        it('should return linked repo or org using repo_name and owner', function (it_done) {
            var args = {
                repo: 'Hello-World',
                owner: 'octocat'
            };
            reqArgs.cla.getLinkedItem = args;

            cla_api.getLinkedItem({
                args: args
            }, function () {
                assert(cla.getLinkedItem.called);
                it_done();
            });
        });
    });

    describe('cla: validateSharedGistItems', function () {
        var req;

        beforeEach(function () {
            req = {
                args: {
                    repo: 'Hello-World',
                    owner: 'octocat1',
                    gist: testData.repo_from_db.gist,
                    sharedGist: true
                }
            };
            var repoWithSharedGist = {
                repoId: 1296269,
                owner: 'octocat1',
                repo: 'Hello-World',
                gist: 'gist1',
                token: 'token1',
                sharedGist: true
            };
            var orgWithSharedGist = {
                orgId: 1,
                org: 'octocat2',
                token: 'token',
                gist: 'gist1',
                sharedGist: true
            };
            error.repoService.getRepoWithSharedGist = null;
            error.orgService.getOrgWithSharedGist = null;
            resp.repoService.getRepoWithSharedGist = [repoWithSharedGist];
            resp.orgService.getOrgWithSharedGist = [orgWithSharedGist];
            sinon.stub(repo_service, 'getRepoWithSharedGist').callsFake(function (gist, done) {
                done(error.repoService.getRepoWithSharedGist, resp.repoService.getRepoWithSharedGist);
            });
            sinon.stub(org_service, 'getOrgWithSharedGist').callsFake(function (gist, done) {
                done(error.orgService.getOrgWithSharedGist, resp.orgService.getOrgWithSharedGist);
            });
            sinon.stub(cla_api, 'validateOrgPullRequests').callsFake(function (args, done) {
                done();
            });
            sinon.stub(cla_api, 'validatePullRequests').callsFake(function (args, done) {
                done();
            });
        });

        afterEach(function () {
            cla_api.validateOrgPullRequests.restore();
            cla_api.validatePullRequests.restore();
            repo_service.getRepoWithSharedGist.restore();
            org_service.getOrgWithSharedGist.restore();
        });

        it('should call validateOrgPullRequests and validatePullRequests to update status of all repos and orgs with the same shared gist', function (it_done) {
            cla_api.validateSharedGistItems(req, function (error) {
                assert.equal(cla_api.validateOrgPullRequests.callCount, 1);
                assert.equal(cla_api.validatePullRequests.callCount, 1);
                it_done();
            });
        });

        it('should return error when gist not is provided', function (it_done) {
            req.args.gist = undefined;
            cla_api.validateSharedGistItems(req, function (err) {
                assert(err);
                it_done();
            });
        });

        it('should log error when repoService.getRepoWithSharedGist() failed', function (it_done) {
            error.repoService.getRepoWithSharedGist = 'Error: get shared gist repo failed';
            cla_api.validateSharedGistItems(req, function (err) {
                assert(log.error.calledWithMatch(error.repoService.getRepoWithSharedGist));
                it_done();
            });
        });

        it('should log error when orgService.getOrgWithSharedGist() failed', function (it_done) {
            error.orgService.getOrgWithSharedGist = 'Error: get shared gist org failed';
            cla_api.validateSharedGistItems(req, function (err) {
                assert(log.error.calledWithMatch(error.orgService.getOrgWithSharedGist));
                it_done();
            });
        });
    });

    describe('cla:validatePullRequest', function () {
        var args;
        beforeEach(function () {
            args = {
                repo: 'Hello-World',
                owner: 'octocat',
                sha: 'abcde',
                number: 1,
                token: 'token'
            };
            resp.cla.check = {
                gist: 'github/gist',
                signed: false,
                user_map: {
                    signed: ['a'],
                    not_signed: ['b'],
                    unknown: ['c']
                }
            };
            resp.cla.getLinkedItem = Object.assign({}, testData.repo_from_db);
            error.cla.isClaRequired = null;
            resp.cla.isClaRequired = true;
            sinon.stub(cla, 'check').callsFake(function (args, cb) {
                cb(null, resp.cla.check.signed, resp.cla.check.user_map);
            });
            sinon.stub(cla, 'isClaRequired').callsFake(function (args, cb) {
                cb(error.cla.isClaRequired, resp.cla.isClaRequired);
            });
            sinon.stub(statusService, 'update').callsFake(function (args, cb) {
                return cb(null, null);
            });
            sinon.stub(statusService, 'updateForNullCla').callsFake(function (args, cb) {
                return cb(null, null);
            });
            sinon.stub(statusService, 'updateForClaNotRequired').callsFake(function (args, cb) {
                return cb(null, null);
            });
            sinon.stub(prService, 'editComment').callsFake(function (args, cb) {
                return cb(null, null);
            });
            sinon.stub(prService, 'deleteComment').callsFake(function (args, cb) {
                return cb(null, null);
            });
        });

        afterEach(function () {
            cla.check.restore();
            cla.isClaRequired.restore();
            statusService.update.restore();
            statusService.updateForNullCla.restore();
            statusService.updateForClaNotRequired.restore();
            prService.editComment.restore();
            prService.deleteComment.restore();
        });

        it('should update status and edit comment when the repo is NOT linked with a null CLA and the pull request is significant', function (it_done) {
            cla_api.validatePullRequest(args, function () {
                assert(statusService.update.calledWithMatch({
                    signed: resp.cla.check.signed,
                    repo: 'Hello-World',
                    owner: 'octocat',
                    sha: 'abcde',
                    number: 1
                }));
                assert(prService.editComment.calledWithMatch({
                    repo: 'Hello-World',
                    owner: 'octocat',
                    number: 1,
                    signed: resp.cla.check.signed,
                    user_map: resp.cla.check.user_map
                }));
                it_done();
            });
        });

        it('should update status and delete comment when the repo linked with a null CLA', function (it_done) {
            resp.cla.getLinkedItem.gist = undefined;
            cla_api.validatePullRequest(args, function (err) {
                assert(statusService.updateForNullCla.called);
                assert(prService.deleteComment.called);
                assert(!cla.isClaRequired.called);
                assert(!cla.check.called);
                it_done();
            });
        });

        it('should update status and delete comment when the repo is NOT linked with a null CLA and the pull request is NOT significant', function (it_done) {
            resp.cla.isClaRequired = false;
            cla_api.validatePullRequest(args, function (err) {
                assert(statusService.updateForClaNotRequired.called);
                assert(prService.deleteComment.called);
                assert(!cla.check.called);
                assert(!statusService.updateForNullCla.called);
                it_done();
            });
        });
    });

    describe('cla:addSignature', function () {
        var req;
        beforeEach(function () {
            req = {
                args: {
                    userId: 1,
                    user: 'user',
                    repo: 'Hello-World',
                    owner: 'octocat',
                    custom_fields: 'custom_fields'
                }
            };
            error.cla.sign = null;
            testUser = {
                save: function () {
                },
                name: 'testUser',
                requests: [{
                    repo: 'Hello-World',
                    owner: 'octocat',
                    numbers: [1]
                }]
            };
            resp.cla.getLinkedItem = Object.assign({}, testData.repo_from_db);
            sinon.stub(cla, 'sign').callsFake(function (args, cb) {
                cb(error.cla.sign, 'done');
            });
            sinon.stub(User, 'findOne').callsFake((selector, cb) => {
                cb(null, testUser);
            });
        });

        afterEach(function () {
            cla.sign.restore();
            User.findOne.restore();
        });

        it('should call cla service sign and update status of pull request created by user, who signed', function (it_done) {
            cla_api.addSignature(req, function (err) {
                assert.ifError(err);
                assert(cla.sign.called);
                assert(User.findOne.called);
                it_done();
            });
        });

        it('should send validation error when repo and owner or org is not provided', function (it_done) {
            var req = {
                args: {
                    userId: 1,
                    user: 'user'
                }
            };
            cla_api.addSignature(req, function (err) {
                assert(err);
                it_done();
            });
        });

        it('should send error and log error when sign cla failed', function (it_done) {
            error.cla.sign = 'You\'ve already signed the cla.';
            cla_api.addSignature(req, function (err) {
                assert(err === error.cla.sign);
                assert(log.error.called);
                it_done();
            });
        });
    });

    describe('cla:hasSignature', function () {
        var req;
        beforeEach(function () {
            req = {
                args: {
                    userId: 1,
                    user: 'user',
                    repo: 'Hello-World',
                    owner: 'octocat'
                }
            };
            sinon.stub(cla, 'check').callsFake(function (args, done) {
                done(null, true);
            });
        });

        afterEach(function () {
            cla.check.restore();
        });

        it('should call cla service check', function (it_done) {
            cla_api.hasSignature(req, function (err) {
                assert.ifError(err);
                assert(cla.check.called);
                it_done();
            });
        });

        it('should send validation error when repo and owner or org is not provided', function (it_done) {
            var req = {
                args: {
                    userId: 1,
                    user: 'user'
                }
            };
            cla_api.hasSignature(req, function (err) {
                assert(err);
                assert(!cla.check.called);
                it_done();
            });
        });
    });

    describe('cla:terminateSignature', function () {
        var req;
        beforeEach(function () {
            req = {
                args: {
                    userId: 1,
                    user: 'user',
                    repo: 'Hello-World',
                    owner: 'octocat',
                    endDate: new Date().toISOString()
                }
            };
            error.cla.terminate = null;
            sinon.stub(cla, 'terminate').callsFake(function (args, done) {
                done(error.cla.terminate);
            });
        });

        afterEach(function () {
            cla.terminate.restore();
        });

        it('should call cla service terminate', function (it_done) {
            cla_api.terminateSignature(req, function (err) {
                assert.ifError(err);
                assert(cla.terminate.called);
                it_done();
            });
        });

        it('should send validation error when repo and owner or org is not provided', function (it_done) {
            var req = {
                args: {
                    userId: 1,
                    user: 'user'
                }
            };
            cla_api.terminateSignature(req, function (err) {
                assert(err);
                assert(!cla.terminate.called);
                it_done();
            });
        });

        it('should send error and log error when terminate cla failed', function (it_done) {
            error.cla.terminate = 'Cannot find cla record';
            cla_api.terminateSignature(req, function (err) {
                assert(err === error.cla.terminate);
                assert(log.error.called);
                it_done();
            });
        });
    });
});