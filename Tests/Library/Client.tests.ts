import assert = require("assert");
import crypto = require('crypto');
import sinon = require("sinon");
import Sinon = require("sinon");
import http = require("http");
import eventEmitter = require('events');

import Client = require("../../Library/NodeClient");
import Config = require("../../Library/Config");
import Contracts = require("../../Declarations/Contracts");
import RequestResponseHeaders = require("../../Library/RequestResponseHeaders");
import Util = require("../../Library/Util")
import EventTelemetry = require("../../Library/TelemetryTypes/EventTelemetry")
import DependencyTelemetry = require("../../Library/TelemetryTypes/DependencyTelemetry")
import EnvelopeFactory = require("../../Library/EnvelopeFactory");
import RequestTelemetry = require("../../Library/TelemetryTypes/RequestTelemetry")
import MetricTelemetry = require("../../Library/TelemetryTypes/MetricTelemetry")
import ExceptionTelemetry = require("../../Library/TelemetryTypes/ExceptionTelemetry")
import TraceTelemetry = require("../../Library/TelemetryTypes/TraceTelemetry")
import TelemetryType = require("../../Library/TelemetryTypes/TelemetryType")
import Identified = require("../../Library/TelemetryTypes/Identified")

describe("Library/Client", () => {

    var iKey = "Instrumentation-Key-12345-6789A";
    var appId = "Application-Key-12345-6789A";
    var name = "name";
    var value = 3;
    var testEventTelemetry = <EventTelemetry>{ name: "testEvent" };
    var properties: { [key: string]: string; } = { p1: "p1", p2: "p2", common: "commonArg" };
    var measurements: { [key: string]: number; } = { m1: 1, m2: 2 };
    var client = new Client(iKey);
    client.config.correlationId = `cid-v1:${appId}`;
    var trackStub: Sinon.SinonStub;
    var triggerStub: Sinon.SinonStub;
    var sendStub: Sinon.SinonStub;
    var saveOnCrashStub: Sinon.SinonStub;

    before(() => {
        trackStub = sinon.stub(client, "track");
        triggerStub = sinon.stub(client.channel, "triggerSend");
        sendStub = sinon.stub(client.channel, "send");
        saveOnCrashStub = sinon.stub(client.channel._sender, "saveOnCrash");
    });
    after(() => {
        trackStub.restore();
        triggerStub.restore();
        sendStub.restore();
        saveOnCrashStub.restore();

    });

    afterEach(() => {
        sendStub.reset();
        client.clearTelemetryProcessors();
        saveOnCrashStub.reset();
    })

    var invalidInputHelper = (name: string) => {
        assert.doesNotThrow(() => (<any>client)[name](null, null), "#1");
        assert.doesNotThrow(() => (<any>client)[name](<any>undefined, <any>undefined), "#2");
        assert.doesNotThrow(() => (<any>client)[name](<any>{}, <any>{}), "#3");
        assert.doesNotThrow(() => (<any>client)[name](<any>[], <any>[]), "#4");
        assert.doesNotThrow(() => (<any>client)[name](<any>"", <any>""), "#5");
        assert.doesNotThrow(() => (<any>client)[name](<any>1, <any>1), "#6");
        assert.doesNotThrow(() => (<any>client)[name](<any>true, <any>true), "#7");
    };

    describe("#constructor()", () => {
        it("should initialize config", () => {
            var client = new Client("key");
            assert.ok(client.config);
            assert.ok(client.config.instrumentationKey);
        });

        it("should initialize context", () => {
            var client = new Client("key");
            assert.ok(client.context);
            assert.ok(client.context.tags);
        });

        it("should initialize common properties", () => {
            var client = new Client("key");
            assert.ok(client.commonProperties);
        });

        it("should initialize channel", () => {
            var client = new Client("key");
            assert.ok(client.channel);
        });
    });

    describe("#trackEvent()", () => {
        it("should track Event with correct data", () => {
            trackStub.reset();
            client.trackEvent({ name: name });
            client.trackEvent({ name: name, properties });
            client.trackEvent({ name: name, properties, measurements });

            assert.ok(trackStub.calledThrice);

            var eventTelemetry1 = <EventTelemetry>trackStub.firstCall.args[0];
            var eventTelemetry2 = <EventTelemetry>trackStub.secondCall.args[0];
            var eventTelemetry3 = <EventTelemetry>trackStub.thirdCall.args[0];

            assert.equal(eventTelemetry1.name, name);
            assert.equal(eventTelemetry2.name, name);
            assert.deepEqual(eventTelemetry2.properties, properties);
            assert.equal(eventTelemetry3.name, name);
            assert.deepEqual(eventTelemetry3.properties, properties);
            assert.equal(eventTelemetry3.measurements, measurements);
        });

        it("should not crash with invalid input", () => {
            invalidInputHelper("trackEvent");
        });
    });

    describe("#trackTrace()", () => {
        it("should track Trace with correct data", () => {
            trackStub.reset();
            client.trackTrace({ message: name });
            client.trackTrace({ message: name, severity: 0 });
            client.trackTrace({ message: name, severity: 0, properties: properties });

            assert.ok(trackStub.calledThrice);

            var traceTelemetry1 = <TraceTelemetry>trackStub.firstCall.args[0];
            var traceTelemetry2 = <TraceTelemetry>trackStub.secondCall.args[0];
            var traceTelemetry3 = <TraceTelemetry>trackStub.thirdCall.args[0];

            assert.equal(traceTelemetry1.message, name);
            assert.equal(traceTelemetry2.message, name);
            assert.deepEqual(traceTelemetry2.severity, 0);
            assert.equal(traceTelemetry3.message, name);
            assert.deepEqual(traceTelemetry3.severity, 0);
            assert.equal(traceTelemetry3.properties, properties);
        });

        it("should not crash with invalid input", () => {
            invalidInputHelper("trackTrace");
        });
    });

    describe("#trackException()", () => {
        it("should track Exception with correct data - Error only", () => {
            trackStub.reset();
            client.trackException({ exception: new Error(name) });

            assert.ok(trackStub.calledOnce);

            var exceptionTelemetry = <ExceptionTelemetry>trackStub.firstCall.args[0];


            assert.equal(exceptionTelemetry.exception.message, name);
        });

        it("should track Exception with correct data - Error and properties", () => {
            trackStub.reset();
            client.trackException({ exception: new Error(name), properties: properties });

            assert.ok(trackStub.calledOnce);

            var exceptionTelemetry = <ExceptionTelemetry>trackStub.firstCall.args[0];
            assert.equal(exceptionTelemetry.exception.message, name);
            assert.deepEqual(exceptionTelemetry.properties, properties);
        });

        it("should track Exception with correct data - Error, properties and measurements", () => {
            trackStub.reset();
            client.trackException({ exception: new Error(name), properties: properties, measurements: measurements });

            assert.ok(trackStub.calledOnce);

            var exceptionTelemetry = <ExceptionTelemetry>trackStub.firstCall.args[0];

            assert.equal(exceptionTelemetry.exception.message, name);
            assert.deepEqual(exceptionTelemetry.properties, properties);
            assert.deepEqual(exceptionTelemetry.measurements, measurements);
        });

        it("should not crash with invalid input", () => {
            invalidInputHelper("trackException");
        });
    });

    describe("#trackMetric()", () => {
        it("should track Metric with correct data", () => {
            trackStub.reset();
            var count = 1;
            var min = 0;
            var max = 0;
            var stdev = 0;
            client.trackMetric({ name: name, value: value });
            client.trackMetric({ name: name, value: value, count: count, min: min, max: max, stdDev: stdev, properties: properties });

            assert.ok(trackStub.calledTwice);

            var metricTelemetry1 = <MetricTelemetry>trackStub.firstCall.args[0];
            var metricTelemetry2 = <MetricTelemetry>trackStub.secondCall.args[0];

            assert.equal(metricTelemetry1.name, name);
            assert.equal(metricTelemetry1.value, value);

            assert.equal(metricTelemetry2.name, name);
            assert.equal(metricTelemetry2.value, value);
            assert.equal(metricTelemetry2.count, count);
            assert.equal(metricTelemetry2.min, min);
            assert.equal(metricTelemetry2.max, max);
            assert.equal(metricTelemetry2.stdDev, stdev);
            assert.deepEqual(metricTelemetry2.properties, properties);
        });

        it("should not crash with invalid input", () => {
            invalidInputHelper("trackMetric");
        });
    });

    describe("request tracking", () => {
        var response = {
            emitFinish: function (): void {
                if (this.finishCallback) {
                    this.finishCallback();
                }
            },
            once: function (event: string, callback: Function): eventEmitter.EventEmitter {
                if (event === 'finish') {
                    this.finishCallback = callback;
                }
                return new eventEmitter.EventEmitter();
            },
            statusCode: 200,
            headers: <{ [id: string]: string }>{},
            getHeader: function (name: string) { return this.headers[name]; },
            setHeader: function (name: string, value: string) { this.headers[name] = value; },
        };

        var request = {
            emitError: function (): void {
                if (this.errorCallback) {
                    var error = {
                        "errorProp": "errorVal"
                    }
                    this.errorCallback(error);
                }
            },
            emitResponse: function (): void {
                if (this.responseCallback) {
                    this.responseCallback(response);
                }
            },
            on: function (event: string, callback: (error: any) => void): void {
                if (event === 'error') {
                    this.errorCallback = callback;
                } else if (event === 'response') {
                    this.responseCallback = callback;
                }
            },
            method: "GET",
            url: "/search?q=test",
            connection: {
                encrypted: false
            },
            agent: {
                protocol: 'http'
            },
            headers: <{ [id: string]: string }>{
                host: "bing.com"
            },
            getHeader: function (name: string) { return this.headers[name]; },
            setHeader: function (name: string, value: string) { this.headers[name] = value; },
        };

        afterEach(() => {
            delete request.headers[RequestResponseHeaders.requestContextHeader];
            delete response.headers[RequestResponseHeaders.requestContextHeader];
            client.config = new Config(iKey);
            client.config.correlationId = `cid-v1:${appId}`;
        });

        function parseDuration(duration: string): number {
            if (!duration) {
                return 0;
            }

            var parts = duration.match("(\\d\\d):(\\d\\d):(\\d\\d).(\\d\\d\\d)");
            return parseInt(parts[1]) * 60 * 60 * 1000 + parseInt(parts[2]) * 60 * 1000 + parseInt(parts[3]) * 1000 + parseInt(parts[4]);
        }

        describe("#trackNodeHttpRequest()", () => {
            var clock: Sinon.SinonFakeTimers;

            before(() => {
                clock = sinon.useFakeTimers();
            });

            after(() => {
                clock.restore();
            });

            it("should not crash with invalid input", () => {
                invalidInputHelper("trackRequest");
            });

            it('should track request with correct data on response finish event ', () => {
                trackStub.reset();
                clock.reset();
                client.trackNodeHttpRequest({ request: <any>request, response: <any>response, properties: properties });

                // finish event was not emitted yet
                assert.ok(trackStub.notCalled);

                // emit finish event
                clock.tick(10);
                response.emitFinish();

                assert.ok(trackStub.calledOnce);
                var requestTelemetry = <RequestTelemetry>trackStub.firstCall.args[0];

                assert.equal(requestTelemetry.resultCode, "200");
                assert.deepEqual(requestTelemetry.properties, properties);
                assert.equal(requestTelemetry.duration, 10);
            });

            it('should track request with correct tags on response finish event', () => {
                trackStub.reset();
                clock.reset();
                client.trackNodeHttpRequest({ request: <any>request, response: <any>response, properties: properties });

                // emit finish event
                response.emitFinish();

                // validate
                var args = trackStub.args;
                assert.ok(trackStub.calledOnce);
                var requestTelemetry = <RequestTelemetry>trackStub.firstCall.args[0];
                var tags = requestTelemetry.tagOverrides;

                assert.equal(tags["ai.operation.name"], "GET /search");
                assert.equal(tags["ai.device.id"], "");
                assert.equal(tags["ai.device.type"], null);
            });

            it('should track request with correct data on request error event #1', () => {
                trackStub.reset();
                clock.reset();
                client.trackNodeHttpRequest({ request: <any>request, response: <any>response, properties: properties });

                // finish event was not emitted yet
                assert.ok(trackStub.notCalled);

                // emit finish event
                clock.tick(10);
                request.emitError();
                assert.ok(trackStub.calledOnce);
                var requestTelemetry = <RequestTelemetry>trackStub.firstCall.args[0];

                assert.equal(requestTelemetry.success, false);
                assert.equal(requestTelemetry.properties['errorProp'], 'errorVal');
                assert.equal(requestTelemetry.duration, 10);
            });

            it('should use source and target correlationId headers', () => {
                trackStub.reset();
                clock.reset();

                // Simulate an incoming request that has a different source correlationId header.
                let testCorrelationId = 'cid-v1:Application-Id-98765-4321A';
                request.headers[RequestResponseHeaders.requestContextHeader] = `${RequestResponseHeaders.requestContextSourceKey}=${testCorrelationId}`;

                client.trackNodeHttpRequest({ request: <any>request, response: <any>response, properties: properties });

                // finish event was not emitted yet
                assert.ok(trackStub.notCalled);

                // emit finish event
                clock.tick(10);
                response.emitFinish();
                assert.ok(trackStub.calledOnce);
                var requestTelemetry = <RequestTelemetry>trackStub.firstCall.args[0];
                assert.equal(requestTelemetry.source, testCorrelationId);

                // The client's correlationId should have been added as the response target correlationId header.
                assert.equal(response.headers[RequestResponseHeaders.requestContextHeader],
                    `${RequestResponseHeaders.requestContextTargetKey}=${client.config.correlationId}`);
            });

            it('should NOT use source and target correlationId headers when url is on the excluded list', () => {
                trackStub.reset();
                clock.reset();

                client.config.correlationHeaderExcludedDomains = ["bing.com"];

                // Simulate an incoming request that has a different source ikey hash header.
                let testCorrelationId = 'cid-v1:Application-Id-98765-4321A';
                request.headers[RequestResponseHeaders.requestContextHeader] = `${RequestResponseHeaders.requestContextSourceKey}=${testCorrelationId}`;

                client.trackNodeHttpRequest({ request: <any>request, response: <any>response, properties: properties });

                // finish event was not emitted yet
                assert.ok(trackStub.notCalled);

                // emit finish event
                clock.tick(10);
                response.emitFinish();
                assert.ok(trackStub.calledOnce);

                assert.equal(response.headers[RequestResponseHeaders.requestContextHeader], undefined);
            });
        });

        describe("#trackNodeHttpRequestSync()", () => {
            it('should track request with correct data synchronously', () => {
                trackStub.reset();
                client.trackNodeHttpRequestSync({ request: <any>request, response: <any>response, duration: 100, properties: properties });
                assert.ok(trackStub.calledOnce);
                var requestTelemetry = <RequestTelemetry>trackStub.firstCall.args[0];

                assert.equal(requestTelemetry.resultCode, "200");
                assert.equal(requestTelemetry.duration, 100);
                assert.deepEqual(requestTelemetry.properties, properties);
            });
        });

        describe("#trackNodeHttpDependency()", () => {
            var clock: Sinon.SinonFakeTimers;

            before(() => {
                clock = sinon.useFakeTimers();
            });

            after(() => {
                clock.restore();
            });

            it("should not crash with invalid input", () => {
                invalidInputHelper("trackNodeHttpDependency");
            });

            it('should track request with correct data from request options', () => {
                trackStub.reset();
                clock.reset();
                client.trackNodeHttpDependency({
                    options: {
                        host: 'bing.com',
                        path: '/search?q=test'
                    },
                    request: <any>request, properties: properties
                });

                // response event was not emitted yet
                assert.ok(trackStub.notCalled);

                // emit response event
                clock.tick(10);
                request.emitResponse();
                assert.ok(trackStub.calledOnce);
                var dependencyTelemetry = <DependencyTelemetry>trackStub.firstCall.args[0];


                assert.equal(dependencyTelemetry.success, true);
                assert.equal(dependencyTelemetry.duration, 10);
                assert.equal(dependencyTelemetry.name, "GET /search");
                assert.equal(dependencyTelemetry.data, "http://bing.com/search?q=test");
                assert.equal(dependencyTelemetry.target, "bing.com");
                assert.equal(dependencyTelemetry.dependencyTypeName, Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
                assert.deepEqual(dependencyTelemetry.properties, properties);
            });

            it('should track request with correct data on response event', () => {
                trackStub.reset();
                clock.reset();
                client.trackNodeHttpDependency({ options: 'http://bing.com/search?q=test', request: <any>request, properties: properties });

                // response event was not emitted yet
                assert.ok(trackStub.notCalled);

                // emit response event
                clock.tick(10);
                request.emitResponse();
                assert.ok(trackStub.calledOnce);
                var dependencyTelemetry = <DependencyTelemetry>trackStub.firstCall.args[0];

                assert.equal(dependencyTelemetry.success, true);
                assert.equal(dependencyTelemetry.duration, 10);
                assert.equal(dependencyTelemetry.name, "GET /search");
                assert.equal(dependencyTelemetry.data, "http://bing.com/search?q=test");
                assert.equal(dependencyTelemetry.target, "bing.com");
                assert.equal(dependencyTelemetry.dependencyTypeName, Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
                assert.deepEqual(dependencyTelemetry.properties, properties);
            });

            it('should track request with correct data on request error event #2', () => {
                trackStub.reset();
                clock.reset();
                client.trackNodeHttpDependency({ options: 'http://bing.com/search?q=test', request: <any>request, properties: properties });

                // error event was not emitted yet
                assert.ok(trackStub.notCalled);

                // emit error event
                clock.tick(10);
                request.emitError();
                assert.ok(trackStub.calledOnce);
                var dependencyTelemetry = <DependencyTelemetry>trackStub.firstCall.args[0];

                assert.equal(dependencyTelemetry.success, false);
                assert.equal(dependencyTelemetry.duration, 10);
                assert.equal(dependencyTelemetry.name, "GET /search");
                assert.equal(dependencyTelemetry.data, "http://bing.com/search?q=test");
                assert.equal(dependencyTelemetry.target, "bing.com");
                assert.deepEqual(dependencyTelemetry.properties, properties);
            });

            it('should use source and target correlationId headers', () => {
                trackStub.reset();
                clock.reset();
                client.trackNodeHttpDependency({
                    options: {
                        host: 'bing.com',
                        path: '/search?q=test'
                    },
                    request: <any>request, properties: properties
                });

                // The client's correlationId should have been added as the request source correlationId header.
                assert.equal(request.headers[RequestResponseHeaders.requestContextHeader],
                    `${RequestResponseHeaders.requestContextSourceKey}=${client.config.correlationId}`);

                // response event was not emitted yet
                assert.ok(trackStub.notCalled);

                // Simulate a response from another service that includes a target correlationId header.
                const targetCorrelationId = "cid-v1:Application-Key-98765-4321A";
                response.headers[RequestResponseHeaders.requestContextHeader] =
                    `${RequestResponseHeaders.requestContextTargetKey}=${targetCorrelationId}`;

                // emit response event
                clock.tick(10);
                request.emitResponse();
                assert.ok(trackStub.calledOnce);
                var dependencyTelemetry = <DependencyTelemetry>trackStub.firstCall.args[0];

                assert.equal(dependencyTelemetry.target, "bing.com | " + targetCorrelationId);
                assert.equal(dependencyTelemetry.dependencyTypeName, "Http (tracked component)");
            });

            it('should not set source correlationId headers when the host is on a excluded domain list', () => {
                trackStub.reset();
                clock.reset();

                client.config.correlationHeaderExcludedDomains = ["*.domain.com"]
                client.trackNodeHttpDependency({
                    options: {
                        host: 'excluded.domain.com',
                        path: '/search?q=test'
                    },
                    request: <any>request, properties: properties
                });

                // The client's correlationId should NOT have been added for excluded domains
                assert.equal(request.headers[RequestResponseHeaders.requestContextHeader], null);
            });
        });
    });

    describe("#trackDependency()", () => {
        it("should create envelope with correct properties", () => {
            trackStub.restore();
            var commandName = "http://bing.com/search?q=test";
            var dependencyTypeName = "dependencyTypeName";
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            client.trackDependency({ name: name, data: commandName, duration: value, success: true, resultCode: "0", dependencyTypeName: dependencyTypeName, properties: properties });
            assert.ok(createEnvelopeSpy.calledOnce);


            var envelopeCreated = createEnvelopeSpy.firstCall.returnValue;
            var obj0 = <Contracts.Data<Contracts.RemoteDependencyData>>envelopeCreated.data;
            createEnvelopeSpy.restore();

            assert.equal(obj0.baseData.name, name);
            assert.equal(obj0.baseData.data, commandName);
            assert.equal(obj0.baseData.target, 'bing.com');
            assert.equal(obj0.baseData.duration, Util.msToTimeSpan(value));
            assert.equal(obj0.baseData.success, true);
            assert.equal(obj0.baseData.type, dependencyTypeName);
            assert.deepEqual(obj0.baseData.properties, properties);
        });

        it("should process the id when specified", () => {
            trackStub.restore();
            var commandName = "http://bing.com/search?q=test";
            var dependencyTypeName = "dependencyTypeName";
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            client.trackDependency(<DependencyTelemetry & Identified>{ id: "testid", name: name, data: commandName, duration: value, success: true, resultCode: "0", dependencyTypeName: dependencyTypeName, properties: properties });
            assert.ok(createEnvelopeSpy.calledOnce);


            var envelopeCreated = createEnvelopeSpy.firstCall.returnValue;
            var obj0 = <Contracts.Data<Contracts.RemoteDependencyData>>envelopeCreated.data;
            createEnvelopeSpy.restore();
            assert.equal(obj0.baseData.id, "testid");
            assert.deepEqual(obj0.baseData.properties, properties);
        });

        it("should auto-generate the id when not specified", () => {
            trackStub.restore();
            var commandName = "http://bing.com/search?q=test";
            var dependencyTypeName = "dependencyTypeName";
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            client.trackDependency(<DependencyTelemetry>{ name: name, data: commandName, duration: value, success: true, resultCode: "0", dependencyTypeName: dependencyTypeName, properties: properties });
            assert.ok(createEnvelopeSpy.calledOnce);


            var envelopeCreated = createEnvelopeSpy.firstCall.returnValue;
            var obj0 = <Contracts.Data<Contracts.RemoteDependencyData>>envelopeCreated.data;
            createEnvelopeSpy.restore();
            assert.ok(!!obj0.baseData.id);
            assert.deepEqual(obj0.baseData.properties, properties);
        });
    });

    describe("#trackRequest()", () => {
        it("should create envelope with correct properties", () => {
            trackStub.restore();
            var url = "http://bing.com/search?q=test";
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            client.trackRequest({ url: url, source: "source", name: name, duration: value, success: true, resultCode: "200", properties: properties });
            assert.ok(createEnvelopeSpy.calledOnce);


            var envelopeCreated = createEnvelopeSpy.firstCall.returnValue;
            var obj0 = <Contracts.Data<Contracts.RequestData>>envelopeCreated.data;
            createEnvelopeSpy.restore();

            assert.equal(obj0.baseData.name, name);
            assert.equal(obj0.baseData.url, url);
            assert.equal(obj0.baseData.source, 'source');
            assert.equal(obj0.baseData.duration, Util.msToTimeSpan(value));
            assert.equal(obj0.baseData.success, true);
            assert.equal(obj0.baseData.responseCode, "200");
            assert.deepEqual(obj0.baseData.properties, properties);
        });

        it("should process the id when specified", () => {
            trackStub.restore();
            var url = "http://bing.com/search?q=test";
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            client.trackRequest(<RequestTelemetry & Identified>{ id: "testid", url: url, source: "source", name: name, duration: value, success: true, resultCode: "200", properties: properties });
            assert.ok(createEnvelopeSpy.calledOnce);


            var envelopeCreated = createEnvelopeSpy.firstCall.returnValue;
            var obj0 = <Contracts.Data<Contracts.RequestData>>envelopeCreated.data;
            createEnvelopeSpy.restore();

            assert.equal(obj0.baseData.id, "testid");
            assert.deepEqual(obj0.baseData.properties, properties);
        });

        it("should auto-generate the id when not specified", () => {
            trackStub.restore();
            var url = "http://bing.com/search?q=test";
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            client.trackRequest({ url: url, source: "source", name: name, duration: value, success: true, resultCode: "200", properties: properties });
            assert.ok(createEnvelopeSpy.calledOnce);


            var envelopeCreated = createEnvelopeSpy.firstCall.returnValue;
            var obj0 = <Contracts.Data<Contracts.RequestData>>envelopeCreated.data;
            createEnvelopeSpy.restore();

            assert.ok(!!obj0.baseData.id);
            assert.deepEqual(obj0.baseData.properties, properties);
        });
    });

    describe("#flush()", () => {

        afterEach(() => {
            client.clearTelemetryProcessors();
            saveOnCrashStub.reset();
            sendStub.restore();
            sendStub = sinon.stub(client.channel, "send");
            triggerStub.restore();
            triggerStub = sinon.stub(client.channel, "triggerSend");
        });

        it("should invoke the sender", () => {
            triggerStub.reset();
            client.flush();
            assert.ok(triggerStub.calledOnce);
        });

        it("should accept a callback", () => {
            triggerStub.reset();
            var callback = sinon.spy();
            client.flush({ callback: callback });
            assert.strictEqual(triggerStub.firstCall.args[0], false);
            assert.strictEqual(triggerStub.firstCall.args[1], callback);
        });

        it("should save on disk when isAppCrashing option is set to true", () => {
            sendStub.reset();
            client.flush({ isAppCrashing: true });
            assert.ok(sendStub.notCalled, "saveOnCrash should be called, not send");
            saveOnCrashStub.reset();

            // temporarily restore send and trigger stubs to allow saveOnCrash to be called
            sendStub.restore();
            triggerStub.restore();

            // fake something in the buffer
            client.channel._buffer.push("");
            client.flush({ isAppCrashing: true });

            assert.ok(saveOnCrashStub.calledOnce);
            saveOnCrashStub.restore();

        });

    });

    describe("#track()", () => {
        it("should pass data to the channel", () => {
            sendStub.reset();

            trackStub.restore();
            client.track(testEventTelemetry, TelemetryType.Event);
            trackStub = sinon.stub(client, "track");

            assert.ok(sendStub.calledOnce);
        });


        it("should send the envelope that was created", () => {
            sendStub.reset();
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            trackStub.restore();
            client.track(testEventTelemetry, TelemetryType.Event);
            trackStub = sinon.stub(client, "track");

            var expected = createEnvelopeSpy.firstCall.returnValue;
            var actual = sendStub.firstCall.args[0];
            createEnvelopeSpy.restore();

            assert.deepEqual(actual, expected);
        });

        it("should use timestamp if it was set", () => {
            var timestamp = new Date("Mon Aug 28 2017 11:44:17");
            var createEnvelopeSpy = sinon.spy(EnvelopeFactory, "createEnvelope");
            trackStub.restore();
            client.trackEvent({ name: "eventName", time: timestamp });
            trackStub = sinon.stub(client, "track");
            var envelope = <Contracts.Envelope>createEnvelopeSpy.firstCall.returnValue;
            createEnvelopeSpy.restore();
            assert.equal(envelope.time, timestamp.toISOString());
        });

        it("telemetry processor can change the envelope", () => {
            trackStub.restore();
            var expectedName = "I was here";

            client.addTelemetryProcessor((env) => {
                env.name = expectedName;
                return true;
            });

            client.track(testEventTelemetry, TelemetryType.Event);

            assert.equal(sendStub.callCount, 1, "send called once");

            var actualData = sendStub.firstCall.args[0] as Contracts.Envelope;
            assert.equal(actualData.name, expectedName, "envelope name should be changed by the processor");
        });

        it("telemetry processor can access the context object", () => {
            trackStub.restore();
            var expectedName = "I was here";

            client.addTelemetryProcessor((env, contextObjects) => {
                env.name = contextObjects["name"];
                return true;
            });
            testEventTelemetry.contextObjects = { "name": expectedName };

            client.track(testEventTelemetry, TelemetryType.Event);
            testEventTelemetry.contextObjects = undefined;

            assert.equal(sendStub.callCount, 1, "send called once");

            var actualData = sendStub.firstCall.args[0] as Contracts.Envelope;
            assert.equal(actualData.name, expectedName, "envelope name should be changed by the processor");
        });

        it("telemetry processors are executed in a right order", () => {
            trackStub.restore();

            client.addTelemetryProcessor((env) => {
                env.name = "First";
                return true;
            });

            client.addTelemetryProcessor((env) => {
                env.name += ", Second";
                return true;
            });

            client.addTelemetryProcessor((env) => {
                env.name += ", Third";
                return true;
            });
            client.track(testEventTelemetry, TelemetryType.Event);
            assert.equal(sendStub.callCount, 1, "send called once");

            var actualData = sendStub.firstCall.args[0] as Contracts.Envelope;
            assert.equal(actualData.name, "First, Second, Third", "processors should executed in the right order");
        });

        it("envelope rejected by the telemetry processor will not be sent", () => {
            trackStub.restore();

            client.addTelemetryProcessor((env) => {
                return false;
            });

            client.track(testEventTelemetry, TelemetryType.Event);

            assert.ok(sendStub.notCalled, "send should not be called");
        });

        it("envelope is sent when processor throws exception", () => {
            trackStub.restore();

            client.addTelemetryProcessor((env): boolean => {
                throw "telemetry processor failed";
            });

            client.addTelemetryProcessor((env): boolean => {
                env.name = "more data";
                return true;
            });

            client.track(testEventTelemetry, TelemetryType.Event);

            assert.ok(sendStub.called, "send should be called despite telemetry processor failure");
            var actualData = sendStub.firstCall.args[0] as Contracts.Envelope;
            assert.equal(actualData.name, "more data", "more data is added as part of telemetry processor");
        });
    });

    describe("#addTelemetryProcessor()", () => {
        it("adds telemetry processor to the queue", () => {
            trackStub.restore();
            var processorExecuted = false;

            client.addTelemetryProcessor((env) => {
                processorExecuted = true;
                return true;
            });

            client.track(testEventTelemetry, TelemetryType.Event);

            assert.ok(processorExecuted, "telemetry processor should be executed");
        });
    });

    describe("#clearTelemetryProcessors()", () => {
        it("removes all processors from the telemetry processors list", () => {
            trackStub.restore();
            var processorExecuted = false;

            client.addTelemetryProcessor((env) => {
                processorExecuted = true;
                return true;
            });

            client.clearTelemetryProcessors();
            client.track(testEventTelemetry, TelemetryType.Event);

            assert.ok(!processorExecuted, "telemetry processor should NOT be executed");
        });
    });
});
