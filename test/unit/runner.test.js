'use strict';
var assert = require('assert'),
    q = require('q'),
    sinon = require('sinon'),
    assert = require('chai').assert,
    createSuite = require('../../lib/suite').create,
    flatSuites = require('../../lib/suite-util').flattenSuites,
    State = require('../../lib/state'),
    Runner = require('../../lib/runner'),
    StateError = require('../../lib/errors/state-error'),
    pool = require('../../lib/browser-pool'),
    Config = require('../../lib/config');

function addState(suite, name, cb) {
    var state = new State(suite, name, cb || function() {});
    suite.addState(state);
    return state;
}

describe('runner', function() {
    beforeEach(function() {
        this.sinon = sinon.sandbox.create();

        var browser = {
            id: 'browser',
            sessionId: 'sessionId',
            createActionSequence: this.sinon.stub().returns({
                perform: this.sinon.stub().returns(q.resolve()),
                getPostActions: this.sinon.stub().returns(null)
            }),

            captureFullscreenImage: this.sinon.stub().returns(q({
                getSize: this.sinon.stub().returns({}),
                crop: this.sinon.stub().returns(q({}))
            })),

            prepareScreenshot: this.sinon.stub().returns(q({
                captureArea: {},
                viewportOffset: {},
                ignoreAreas: []
            })),

            openRelative: this.sinon.stub().returns(q.resolve()),
            quit: this.sinon.stub().returns(q.resolve())
        };

        this.browser = browser;
        this.pool = {
            getBrowser: this.sinon.stub().returns(q(browser)),
            freeBrowser: this.sinon.stub().returns(q()),
            finalizeBrowsers: this.sinon.stub().returns(q()),
            cancel: this.sinon.stub()
        };

        this.sinon.stub(pool, 'create').returns(this.pool);

        this.root = createSuite('root');
        this.suite = createSuite('suite', this.root);
        this.suite.id = 0;
        this.suite.url = '/path';

        this.root.browsers = [browser.id];

        var config = new Config({
                system: {
                    projectRoot: '/'
                },
                rootUrl: 'http://example.com',
                gridUrl: 'http://grid.example.com',
                browsers: {
                    browser: {
                        desiredCapabilities: {}
                    }
                }
            });
        this.runner = new Runner(config);

        this.sinon.stub(this.runner.config, 'forBrowser')
            .returns({retry: 0});

        this.runSuites = function() {
            return this.runner.run(flatSuites(this.root));
        };
    });

    afterEach(function() {
        this.sinon.restore();
    });

    describe('run', function() {
        it('should emit `begin` event when tests start', function() {
            var spy = this.sinon.spy().named('onBegin');
            this.runner.on('begin', spy);
            return this.runSuites().then(function() {
                assert.calledOnce(spy);
            });
        });

        it('should pass total number of states when emitting `begin`', function() {
            addState(this.suite, '1');
            addState(this.suite, '2');
            var child = createSuite('child', this.suite);
            child.id = 1;
            addState(child, '3');

            var spy = this.sinon.spy().named('onBegin');
            this.runner.on('begin', spy);

            return this.runSuites().then(function() {
                assert.calledWith(spy, sinon.match({totalStates: 3}));
            });
        });

        it('should pass all browser ids when emitting `begin`', function() {
            this.sinon.stub(this.runner.config, 'getBrowserIds')
                .returns(['browser1', 'browser2']);

            var spy = this.sinon.spy().named('onBegin');
            this.runner.on('begin', spy);

            return this.runSuites().then(function() {
                assert.calledWith(spy, sinon.match({
                    browserIds: ['browser1', 'browser2']
                }));
            });
        });

        it('should pass config when emitting `begin`', function() {
            var spy = this.sinon.spy().named('onBegin');
            this.runner.on('begin', spy);

            var _this = this;
            return this.runSuites().then(function() {
                assert.calledWith(spy, sinon.match({
                    config: _this.runner.config
                }));
            });
        });

        it('should launch each browser in config if testBrowsers are not set', function() {
            this.sinon.stub(this.runner.config, 'getBrowserIds')
                .returns(['browser1', 'browser2']);
            this.root.browsers = ['browser1', 'browser2'];

            addState(this.suite, 'state');

            return this.runSuites().then(function() {
                assert.calledWith(this.pool.getBrowser, 'browser1');
                assert.calledWith(this.pool.getBrowser, 'browser2');
            }.bind(this));
        });

        it('should launch only browsers specified in testBrowsers', function() {
            this.sinon.stub(this.runner.config, 'getBrowserIds')
                .returns(['browser1', 'browser2']);
            this.root.browsers = ['browser1', 'browser2'];
            this.runner.setTestBrowsers(['browser1']);

            addState(this.suite, 'state');
            return this.runSuites().then(function() {
                assert.calledWith(this.pool.getBrowser, 'browser1');
                assert.neverCalledWith(this.pool.getBrowser, 'browser2');
            }.bind(this));
        });

        it('should run only in browsers specified for suite', function() {
            this.sinon.stub(this.runner.config, 'getBrowserIds')
                .returns(['browser1', 'browser2', 'browser3']);
            this.root.browsers = ['browser2', 'browser3'];

            addState(this.suite, 'state');

            return this.runSuites().then(function() {
                assert.neverCalledWith(this.pool.getBrowser, 'browser1');
                assert.calledWith(this.pool.getBrowser, 'browser2');
                assert.calledWith(this.pool.getBrowser, 'browser3');
            }.bind(this));
        });

        it('should emit `startBrowser` event when starting browser', function() {
            this.sinon.stub(this.runner.config, 'getBrowserIds')
                .returns(['browser']);

            var spy = this.sinon.spy().named('onStartBrowser');
            this.runner.on('startBrowser', spy);
            return this.runSuites().then(function() {
                assert.calledWith(spy, {browserId: 'browser'});
            });
        });

        it('should emit `beginSuite` event for each suite', function() {
            var spy = this.sinon.spy().named('onBeginSuite'),
                _this = this;

            this.runner.on('beginSuite', spy);
            return this.runSuites().then(function() {
                assert.calledWith(spy, {
                    suite: _this.suite,
                    browserId: 'browser'
                });
            });
        });

        it('should call `before` hook with action sequence and find function', function() {
            var stub = this.sinon.stub(this.suite, 'beforeHook'),
                sequence = {
                    stub: true,
                    perform: this.sinon.stub().returns(q.resolve()),
                    getPostActions: this.sinon.stub().returns(null)
                };

            this.browser.createActionSequence.returns(sequence);

            addState(this.suite, 'state');
            return this.runSuites().then(function() {
                assert.calledWith(stub, sequence, require('../../lib/find-func').find);
            });
        });

        it('should perform before sequence ', function() {
            var sequence = {
                perform: this.sinon.stub().returns(q()),
                getPostActions: this.sinon.stub().returns(null)
            };

            this.browser.createActionSequence.returns(sequence);

            addState(this.suite, 'state');

            return this.runSuites().then(function() {
                assert.called(sequence.perform);
            });
        });

        it('should emit `beginState` for each suite state', function() {
            var spy = this.sinon.spy().named('onBeginState'),
                _this = this,
                state = addState(this.suite, 'state');
            this.runner.on('beginState', spy);

            return this.runSuites().then(function() {
                assert.calledWith(spy, {
                    suite: _this.suite,
                    state: state,
                    browserId: 'browser',
                    sessionId: 'sessionId'
                });
            });
        });

        it('should not emit `beginState` if state is skipped', function() {
            var spy = this.sinon.spy().named('onBeginState');
            this.suite.addState({
                name: 'state',
                suite: this.suite,
                shouldSkip: this.sinon.stub().returns(true)
            });
            this.runner.on('beginState', spy);
            return this.runSuites().then(function() {
                assert.notCalled(spy);
            });
        });

        it('should emit `skipState` if state is skipped', function() {
            var spy = this.sinon.spy().named('onSuiteSkip'),
                _this = this,
                state = {
                    name: 'state',
                    suite: this.suite,
                    shouldSkip: this.sinon.stub().returns(true)
                };

            this.suite.addState(state);
            this.runner.on('skipState', spy);
            return this.runSuites().then(function() {
                assert.calledWith(spy, {
                    suite: _this.suite,
                    state: state,
                    browserId: 'browser',
                    sessionId: 'sessionId'
                });
            });
        });

        it('should not emit `skipState` if state is not skipped', function() {
            var spy = this.sinon.spy();
            this.suite.addState({
                name: 'state',
                suite: this.suite,
                callback: function() {},
                shouldSkip: this.sinon.stub().returns(false)
            });
            this.runner.on('skipState', spy);
            return this.runSuites().then(function() {
                assert.notCalled(spy);
            });
        });

        it('should not emit state events in second browser when first fails', function() {
            this.sinon.stub(this.runner.config, 'getBrowserIds')
                .returns(['browser1', 'browser2']);

            var spy = this.sinon.spy().named('onBeginState');
            this.runner.on('endState', spy);
            this.pool.getBrowser.withArgs('browser1').returns(q.reject(new Error('error')));
            addState(this.suite, 'state');

            return this.runSuites()
                .then(function() {
                    assert.fail('Promise should not resolve');
                })
                .fail(function() {
                    assert.neverCalledWith(spy, sinon.match({browserId: 'browser'}));
                });
        });

        it('should open suite url in browser', function() {
            addState(this.suite, 'state');

            return this.runSuites().then(function() {
                assert.calledWith(this.browser.openRelative, '/path');
            }.bind(this));
        });

        it('should emit `endState` for each suite state', function() {
            var spy = this.sinon.spy(),
                _this = this,
                state = addState(this.suite, 'state');
            this.runner.on('endState', spy);

            return this.runSuites().then(function() {
                assert.calledWith(spy, {
                    suite: _this.suite,
                    state: state,
                    browserId: 'browser',
                    sessionId: 'sessionId'
                });
            });
        });

        it('should not emit `endState` if state is skipped', function() {
            var spy = this.sinon.spy();
            this.suite.addState({
                name: 'state',
                suite: this.suite,
                shouldSkip: this.sinon.stub().returns(true)
            });
            this.runner.on('endState', spy);
            return this.runSuites().then(function() {
                assert.notCalled(spy);
            });
        });

        it('should execute next state only after previous has been finished', function() {
            var state1 = addState(this.suite, 'state1'),
                state2 = addState(this.suite, 'state2'),
                endState = this.sinon.spy().named('end state 1'),
                beginState = this.sinon.spy().named('begin state 2');

            this.runner.on('endState', endState);
            this.runner.on('beginState', beginState);

            return this.runSuites().then(function() {
                assert.callOrder(
                    endState.withArgs(sinon.match({state: state1})),
                    endState.withArgs(sinon.match({state: state2}))
                );
            });
        });

        it('should call `after` hook with sequence and find function', function() {
            var stub = this.sinon.stub(this.suite, 'afterHook'),
                sequence = {
                    stub: true,
                    perform: this.sinon.stub().returns(q.resolve()),
                    getPostActions: this.sinon.stub().returns(null)
                };

            this.browser.createActionSequence.returns(sequence);

            addState(this.suite, 'state');
            return this.runSuites().then(function() {
                assert.calledWith(stub, sequence, require('../../lib/find-func').find);
            });
        });

        it('should extend state errors with metadata', function(done) {
            var state = addState(this.suite, 'state', function() {
                    throw new StateError('error');
                }),
                _this = this;
            this.runner.on('error', function(e) {
                assert.equal(e.state, state);
                assert.equal(e.suite, _this.suite);
                done();
            });
            this.runSuites()
                .done(q.reject.bind(null, 'no error'), done);
        });

        it('should emit `endSuite` for each suite', function() {
            var spy = this.sinon.spy().named('endSuite'),
                _this = this;
            this.runner.on('endSuite', spy);
            return this.runSuites().then(function() {
                assert.calledWith(spy, {
                    suite: _this.suite,
                    browserId: 'browser'
                });
            });
        });

        it('should also run child suites automatically', function() {
            var spy = this.sinon.spy(),
                child = createSuite('child', this.suite);
            child.id = 1;

            this.runner.on('beginSuite', spy);

            return this.runSuites().then(function() {
                assert.deepEqual(spy.thirdCall.args, [{
                    suite: child,
                    browserId: 'browser'
                }]);
            });
        });

        it('should allow to run a suite without url and states', function() {
            var beginSuite = sinon.spy(),
                endSuite = sinon.spy(),
                suite = createSuite('suite', this.root);

            this.runner.on('beginSuite', beginSuite);
            this.runner.on('endSuite', endSuite);

            return this.runSuites().then(function() {
                assert.calledWith(beginSuite, sinon.match({suite: suite}));
                assert.calledWith(endSuite, sinon.match({suite: suite}));
            });
        });

        it('should emit `stopBrowser` after all suites', function() {
            this.sinon.stub(this.runner.config, 'getBrowserIds')
                .returns(['browser']);

            var spy = this.sinon.spy().named('onStartBrowser');
            this.runner.on('stopBrowser', spy);
            return this.runSuites().then(function() {
                assert.calledWith(spy, {browserId: 'browser'});
            });
        });

        it('should emit `end` after all suites', function() {
            var spy = this.sinon.spy();
            this.runner.on('end', spy);
            return this.runSuites().then(function() {
                assert.calledWith(spy);
            });
        });

        it('should emit events in correct order', function() {
            var begin = this.sinon.spy().named('onBegin'),
                startBrowser = this.sinon.spy().named('onStartBrowser'),
                beginSuite = this.sinon.spy().named('onBeginSuite'),
                beginState = this.sinon.spy().named('onBeginState'),
                endState = this.sinon.spy().named('onEndState'),
                endSuite = this.sinon.spy().named('onEndSuite'),
                stopBrowser = this.sinon.spy().named('onStartBrowser'),
                end = this.sinon.spy().named('onEnd');

            addState(this.suite, 'state');

            this.runner.on('begin', begin);
            this.runner.on('startBrowser', startBrowser);
            this.runner.on('beginSuite', beginSuite);
            this.runner.on('beginState', beginState);
            this.runner.on('endState', endState);
            this.runner.on('endSuite', endSuite);
            this.runner.on('stopBrowser', stopBrowser);
            this.runner.on('end', end);

            return this.runSuites().then(function() {
                assert.callOrder(
                    begin,
                    startBrowser,
                    beginSuite,
                    beginState,
                    endState,
                    endSuite,
                    stopBrowser,
                    end
                );
            });
        });
    });

    describe('relaunch', function() {
        beforeEach(function() {
            this.runSuites = function() {
                return this.runner.run(flatSuites(this.suite));
            };
        });

        it('should not relaunch suites by default', function() {
            this.pool.getBrowser.onFirstCall().returns(q.reject(new Error('error')));

            return assert.isRejected(this.runSuites());
        });

        describe('with predefined "retry" option', function() {
            beforeEach(function() {
                var config = new Config({
                        system: {
                            projectRoot: '/'
                        },
                        rootUrl: 'http://example.com',
                        gridUrl: 'http://grid.example.com',
                        browsers: {
                            browser: {
                                desiredCapabilities: {},
                                retry: 3
                            },
                            browser2: {
                                desiredCapabilities: {}
                            }
                        }
                    });
                this.runner = new Runner(config);
            });

            it('should emit `info` message on retry', function() {
                var spy = this.sinon.spy().named('onInfo');

                this.runner.on('info', spy);
                this.pool.getBrowser.onFirstCall().returns(q.reject(new Error('error')));

                return this.runSuites().then(function() {
                    assert.calledOnce(spy);
                });
            });

            it('should relaunch suites after first call', function() {
                var getBrowser = this.pool.getBrowser;

                getBrowser.onFirstCall().returns(q.reject(new Error('error')));

                return this.runSuites().then(function() {
                    assert.calledTwice(getBrowser);
                });
            });

            it('should relaunch suite as many times as specified in "retry" option', function() {
                var getBrowser = this.pool.getBrowser,
                    // count of retries + first function call
                    totalCallCount = this.runner.config.forBrowser('browser').retry + 1;

                getBrowser.returns(q.reject(new Error('error')));

                return this.runSuites().fail(function() {
                    assert.callCount(getBrowser, totalCallCount);
                });
            });

            it('should apply "retry" option personally for each browser', function() {
                this.root.browsers = ['browser', 'browser2'];
                var getBrowser = this.pool.getBrowser,
                    firstBrowser = getBrowser.withArgs('browser'),
                    secondBrowser = getBrowser.withArgs('browser2'),
                    firstBrowserCallCount = this.runner.config.forBrowser('browser').retry + 1;

                getBrowser.returns(q.reject(new Error('error')));

                return this.runSuites().fail(function() {
                    assert.callCount(firstBrowser, firstBrowserCallCount);
                    assert.calledOnce(secondBrowser);
                });
            });

            it('should not relaunch suite if it was manually stopped', function() {
                var getBrowser = this.pool.getBrowser;

                getBrowser.onFirstCall().returns(q.reject(new pool.CancelledError()));

                return this.runSuites().then(function() {
                    assert.calledOnce(getBrowser);
                });
            });
        });
    });
});
