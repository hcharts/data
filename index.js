'use strict';

const Hapi = require('hapi');
const QRCode = require('qrcode');
const md5 = require('md5');
const fs = require('fs');
const Mock = require('mockjs');

const config = require('./config.json');
const server = new Hapi.Server();

server.connection({
    host: 'localhost',
    port: config.port
});

server.register(require('inert'), (err) => {

    if (err) {
        throw err;
    }

    // qrcode generator
    server.route({
        method: 'GET',
        path: '/qrcode/{url}',
	config: {
	    state: {
       	        parse: false, // parse and store in request.state
        	failAction: 'ignore' // may also be 'ignore' or 'log'
      	    }
	},
        handler: function(request, reply) {
            const url = request.params.url,
                md5Url = md5(url),
                path = config.qrcode + md5Url + '.jpg';

            fs.exists(path, function(exists) {
                if (exists) {
                    reply.file(path);
                } else {
                    QRCode.save(path, url, {
                        errorCorrectLevel: 'high'
                    }, function(err) {
                        if (err) {
                            throw err;
                        }
                        reply.file(path);
                    });
                }
            });
        }
    });

    server.route({
        method: 'GET',
        path: '/jsonp',
        handler: function(request, reply) {
            const params = request.query,
                json = {
                    code: 1,
                    msg: '参数错误'
                },
                err = {
                    code: -1,
                    msg: '系统错误'
                };

            if (!params.callback) {
                params.callback = 'callback';
            }

            // static data file
            if (params.filename) {

                if (/^[a-zA-Z]+[a-zA-Z\d\-\_\.\/]+\.json$/.test(params.filename)) {
                    json = fs.readFileSync(config.datas + params.filename).toString();
                } else if (/^[a-zA-Z]+[a-zA-Z\d\-\_\.\/]+\.csv$/.test(params.filename)) {
                    json = fs.readFileSync(config.datas + params.filename).toString();
                    // replace all
                    json = json.replace(/\"/g, '\"');
                    json = json.replace(/[\r\n]+/g, '\\n');
                    json = '"' + json + '"';
                }
            }


            if (typeof json === 'object') {
                json = JSON.stringify(json);
            }

            reply(params.callback + '(' + json + ');').type('text/javascript');

        }
    });

    // mock data
    server.route({
        method: 'GET',
        path: '/mock/{template}',
        handler: function(request, reply) {
            const template = request.params.template;
            const data = Mock.mock(JSON.parse(template));
            reply(JSON.stringify(data)).type('application/json');
        }
    });

    server.route({
        method: 'POST',
        path: '/mock',
        handler: function(request, reply) {
            const params = request.payload;
            if (params && params.template) {
                const data = Mock.mock(JSON.parse(params.template));
                reply(JSON.stringify(data)).type('application/json').header('Access-Control-Allow-Origin', '*');
            } else {
                reply('{code: 0, msg: "参数错误"}').type('application/json').header('Access-Control-Allow-Origin', '*');
            }
        }
    });



    server.start((err) => {

        if (err) {
            throw err;
        }

        console.log('Server running at:', server.info.uri);
    });
});
